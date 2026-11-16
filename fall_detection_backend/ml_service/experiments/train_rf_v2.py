"""
train_rf_v2.py — เทรน rf_v2_event (ตรวจจับแบบดูต่อเนื่อง) จากทั้ง 5 คน → models/rf_v2_event.pkl
================================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    export OMP_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1          # ไม่งั้น numpy แย่ง thread กับ RF จนช้าหลายสิบเท่า
    python experiments/train_rf_v2.py                          # รุ่น 2 · แจ้งเฉพาะการล้ม (~3 นาที ครั้งแรก)
    python experiments/train_rf_v2.py --target floor           # รุ่น 2 · แจ้งเมื่อล้มหรือนอนบนพื้น (ไม่แนะนำ ดูด้านล่าง)
    python experiments/train_rf_v2.py --features stream --target fall --threshold 0.4 --confirm 5   # รุ่นก่อน

- feature: app/event_features — ตัวเดียวกับ fall_monitor.py (เลือกจาก feature_fn ในไฟล์โมเดล)
    v2     = feature_vector_v2 · 39 ค่า กรอบ 492 packet (เหตุการณ์ 18 + Doppler 11 + หลังเหตุการณ์ 10) ← ค่าเริ่มต้น
    stream = stream_feature_vector · 28 ค่า กรอบ 472 packet (รุ่น 2026-11-12)
- target: fall = ล้มเท่านั้น (ค่าเริ่มต้น · แบบรู้จังหวะ 81.1%) · floor = ล้มหรือลงไปนอนบนพื้น (แบบรู้จังหวะ 87.1%)
  เลือก fall (2026-11-17) เพราะแบบดูต่อเนื่องที่ไม่แจ้งผิดในกิจวัตรจริง: fall จับได้ 64.2% · floor 41.9% · รุ่นก่อน 46.5%
  (floor ไปแจ้งผิดตอนเดิน/ยืนนิ่งเพิ่ม) · fall ยังแจ้งตอนนอนลงบนพื้นอยู่ ~65%
- จุดทำงาน (smooth 1 · ยืนยัน 2 กรอบ · threshold 0.5) = จับได้มากสุดที่ไม่แจ้งผิดในไฟล์กิจวัตรจริง (~8.4 นาที)
- เทรนแบบ B ของ streaming_eval.py: กรอบที่มาร์ค ± เลื่อน + ตัวอย่างไม่ต้องแจ้งจากการเลื่อนกรอบ (class_weight balanced)
- threshold / confirm (กรอบติดกัน ห่างกัน 0.25 วิ) / smooth (เฉลี่ยคะแนนกี่กรอบล่าสุด) เป็นค่าเริ่มต้นของ fall_monitor.py
- ไฟล์ .pkl ไม่ commit (models/ ถูก gitignore) · รายงาน models/report_rf_v2_event.json ถูก commit ได้

⚠️ แบบดูต่อเนื่องประเมินจากไฟล์ยาว ~7–9 วิ (กิจวัตรรวม ~15 นาที) และรุ่น 2 ดูหลังเหตุการณ์ 1.5 วิ ทั้งที่ไฟล์จบ
   ราว 2.2 วิหลังมาร์ค — ตัวเลขจับได้ของ K สูงจึงต่ำกว่าจริง · ต้องยืนยันด้วยการทดสอบสด / ไฟล์ที่อัดยาวกว่านี้
"""

import argparse
import importlib.util
import json
import os
import pickle
import sys
from datetime import datetime, timezone

import numpy as np
import sklearn
from sklearn.metrics import roc_auc_score

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from app import event_features as AF   # noqa: E402

_spec = importlib.util.spec_from_file_location("streaming_eval", os.path.join(BASE, "experiments", "streaming_eval.py"))
SE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SE)

MODEL_PATH = os.path.join(BASE, "models", "rf_v2_event.pkl")
REPORT_PATH = os.path.join(BASE, "models", "report_rf_v2_event.json")
FEATURE_INFO = {"stream": ("stream_feature_vector", AF.STREAM_KEYS, "post_std"),
                "v2": ("feature_vector_v2", AF.KEYS_V2, "late_still")}
TARGET_LABEL = {"fall": "1 = ล้ม", "floor": "1 = ล้มหรือนอนลงบนพื้น"}


def marked_eval(rows, models, target):
    """แบบรู้จังหวะ (กรอบที่มาร์ค) ของโมเดลที่เทรนแบบ B · TTA = เฉลี่ยคะแนนกรอบเลื่อน ±0.3 วิ · ไม่รวมห้องว่าง"""
    actor = np.array([r["actor"] for r in rows])
    out = {}
    for tta in (False, True):
        y, p, who = [], [], []
        for i, r in enumerate(rows):
            if r["act"] == "ห้องว่าง" or 0 not in r["aligned"]:
                continue
            m = models[actor[i]]
            X = np.array(list(r["aligned"].values())) if tta else r["aligned"][0][None, :]
            p.append(float(m.predict_proba(X)[:, 1].mean())); y.append(SE.label_of(r, target)); who.append(actor[i])
        y, p, who = np.array(y), np.array(p), np.array(who)
        res, per = {}, {}
        for a in sorted(set(who.tolist())):
            s = who == a
            pr = p[s] >= 0.5
            per[int(a)] = {"balanced_acc": float((pr[y[s] == 1].mean() + 1 - pr[y[s] == 0].mean()) / 2),
                           "auc": float(roc_auc_score(y[s], p[s]))}
        res["balanced_acc@0.5"] = float(np.mean([v["balanced_acc"] for v in per.values()]))
        res["auc"] = float(np.mean([v["auc"] for v in per.values()]))
        res["per_actor"] = per
        out["tta" if tta else "single"] = res
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", choices=sorted(FEATURE_INFO), default="v2")
    ap.add_argument("--target", choices=sorted(TARGET_LABEL), default="fall")
    ap.add_argument("--threshold", type=float, default=0.5)
    ap.add_argument("--confirm", type=int, default=2)
    ap.add_argument("--smooth", type=int, default=1, help="เฉลี่ยคะแนนกี่กรอบล่าสุดก่อนเทียบ threshold (1 = ไม่เฉลี่ย)")
    args = ap.parse_args()
    kind, target = args.features, args.target
    fn_name, keys, still_key = FEATURE_INFO[kind]
    post = SE.FEATURE_SETS[kind][1]

    rows = SE.load_rows(kind)
    actor = np.array([r["actor"] for r in rows])
    people = sorted(set(actor.tolist()))
    print(f"{len(rows)} ไฟล์ · feature {kind} ({len(keys)} ค่า · กรอบ {AF.PRE + post}) · เป้าหมาย {target}", flush=True)

    # ประเมินแบบ unseen ก่อน (เทรน 4 คน ทดสอบคนที่ 5)
    models, raw_scores = {}, [None] * len(rows)
    for a in people:
        tr = np.where(actor != a)[0]
        X, y = SE.training_set(rows, tr, "B", target, post)
        models[a] = SE.make_model("B").fit(X, y)
        for i in np.where(actor == a)[0]:
            raw_scores[i] = models[a].predict_proba(rows[i]["Xs"])[:, 1]
    marked = marked_eval(rows, models, target)

    grid = {}
    T_GRID = (0.4, 0.5, 0.6, 0.7, 0.8)
    for n in (1, 3):
        sc = [SE.smooth(s, n) for s in raw_scores]
        for k in (1, 2, 3, 4):
            for t in T_GRID:
                grid[f"s{n}_k{k}_t{t}"] = SE.evaluate(rows, sc, t, k, target, post)
    chosen = SE.evaluate(rows, [SE.smooth(s, args.smooth) for s in raw_scores], args.threshold, args.confirm, target, post)

    # เกณฑ์ "ล้มแล้วนิ่ง" (fall_monitor --stay-still): การขยับหลังเหตุการณ์ที่ 90% ของเหตุการณ์ที่ต้องแจ้งไม่เกิน
    ip = keys.index(still_key)
    post_pos = np.array([r["aligned"][0][ip] for r in rows if SE.label_of(r, target) == 1 and 0 in r["aligned"]])
    walk = np.concatenate([r["Xs"][:, ip] for r in rows if r["act"] == "เดิน"])
    still_threshold = float(np.percentile(post_pos, 90))
    still_info = {"threshold": still_threshold, "fraction": 0.8, "events_pass": float(np.mean(post_pos <= still_threshold)),
                  "walk_windows_pass": float(np.mean(walk <= still_threshold)), "feature": still_key,
                  "note": "การขยับ = std ของค่าเฉลี่ย 10 packet ช่วงหลังเหตุการณ์ ÷ noise ต่อ packet ของช่วงก่อนทำท่า"}

    # โมเดลจริง: เทรนจากทุกคน
    X, y = SE.training_set(rows, range(len(rows)), "B", target, post)
    model = SE.make_model("B").fit(X, y)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    version = "rf_v2_event" if kind == "stream" else f"rf_v2_event-r2-{target}"
    meta = {"version": version, "model_name": "RandomForest", "trained_at": now,
            "feature_fn": fn_name, "feature_set": kind, "keys": keys, "target": target, "label": TARGET_LABEL[target],
            "pre": AF.PRE, "post": post, "window": AF.PRE + post, "step": SE.STEP,
            "threshold": args.threshold, "confirm": args.confirm, "smooth": args.smooth,
            "still_threshold": still_threshold, "still": still_info,
            "n_files": len(rows), "n_rows": int(len(y)), "n_positive_rows": int(y.sum()),
            "people": [int(p) for p in people], "sklearn": sklearn.__version__,
            "unseen_eval": {"marked": marked, "streaming_default": chosen, "streaming_grid": grid,
                            "note": "เทรน 4 คน ทดสอบคนที่ 5 · marked = กรอบที่มาร์ค (ไม่รวมห้องว่าง) · streaming = เลื่อนกรอบทุก "
                                    "0.25 วิ กิจวัตรรวม ~15 นาที · fall_recall = % ของเหตุการณ์ที่ต้องแจ้งที่จับได้ · "
                                    "ไฟล์จบ ~2.2 วิหลังมาร์ค จึงประเมินการจับของ K สูงต่ำไป"}}
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, **meta}, f)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)

    mk = marked["tta"]
    print(f"เทรนจาก {len(rows)} ไฟล์ · {len(y)} กรอบ (ต้องแจ้ง {int(y.sum())}) · {version}")
    print(f"unseen แบบรู้จังหวะ: balanced acc {marked['single']['balanced_acc@0.5']*100:.1f}% · +TTA {mk['balanced_acc@0.5']*100:.1f}% "
          f"· AUC {mk['auc']:.3f}")
    print(f"unseen แบบดูต่อเนื่อง (smooth {args.smooth} · K{args.confirm} · thr {args.threshold}): จับได้ {chosen['fall_recall']*100:.1f}% · "
          f"แจ้งผิดในกิจวัตรจริง {chosen['routine_only_alarms']} ครั้ง / {chosen['routine_only_hours']*60:.1f} นาที "
          f"(รวมช่วงก่อนเหตุการณ์ ~{chosen['routine_alarms_per_hour']:.0f}/ชม.) · ท่าคล้ายโดนแจ้ง {chosen['per_lookalike']}")
    print("  grid (จับได้ % / แจ้งผิดในกิจวัตรจริง ครั้ง):")
    for n in (1, 3):
        for k in (1, 2, 3, 4):
            print(f"   smooth {n} K{k}: " + " · ".join(
                f"t{t} {grid[f's{n}_k{k}_t{t}']['fall_recall']*100:4.1f}/{grid[f's{n}_k{k}_t{t}']['routine_only_alarms']}"
                for t in T_GRID))
    print(f"→ {MODEL_PATH}\n→ {REPORT_PATH}")


if __name__ == "__main__":
    main()
