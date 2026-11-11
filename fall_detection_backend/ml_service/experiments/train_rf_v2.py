"""
train_rf_v2.py — เทรน rf_v2_event (ตรวจจับแบบดูต่อเนื่อง) จากทั้ง 5 คน → models/rf_v2_event.pkl
================================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    python experiments/train_rf_v2.py                     # ~2 นาที (ใช้ cache ของ streaming_eval.py ถ้ามี)
    python experiments/train_rf_v2.py --threshold 0.4 --confirm 5

- feature: app/event_features.stream_feature_vector (28 ค่า · กรอบ 472 packet) — ตัวเดียวกับ fall_monitor.py
- เทรนแบบ B ของ streaming_eval.py: กรอบที่มาร์ค ± เลื่อน + ตัวอย่างไม่ล้มจากการเลื่อนกรอบ (class_weight balanced)
- threshold / confirm (จำนวนกรอบติดกัน ห่างกัน 0.25 วิ) เป็นค่าเริ่มต้นของ fall_monitor.py — แก้ทับได้ตอนรัน
- ไฟล์ .pkl ไม่ commit (models/ ถูก gitignore) · รายงาน models/report_rf_v2_event.json ถูก commit ได้

⚠️ ตัวเลขในรายงานประเมินจากไฟล์ยาว ~7–9 วิ (กิจวัตรรวม ~16 นาที) — ต้องยืนยันด้วยการทดสอบสด
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

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from app import event_features as AF   # noqa: E402

_spec = importlib.util.spec_from_file_location("streaming_eval", os.path.join(BASE, "experiments", "streaming_eval.py"))
SE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SE)

MODEL_PATH = os.path.join(BASE, "models", "rf_v2_event.pkl")
REPORT_PATH = os.path.join(BASE, "models", "report_rf_v2_event.json")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--threshold", type=float, default=0.4)
    ap.add_argument("--confirm", type=int, default=5)
    args = ap.parse_args()

    rows = SE.load_rows("stream")
    actor = np.array([r["actor"] for r in rows])
    people = sorted(set(actor.tolist()))

    # ประเมินแบบ unseen ก่อน (เทรน 4 คน ทดสอบคนที่ 5) ที่ค่าเริ่มต้น และค่ารอบ ๆ
    scores = [None] * len(rows)
    for a in people:
        tr = np.where(actor != a)[0]
        X, y = SE.training_set(rows, tr, "B")
        m = SE.make_model("B").fit(X, y)
        for i in np.where(actor == a)[0]:
            scores[i] = m.predict_proba(rows[i]["Xs"])[:, 1]
    grid = {f"k{k}_t{t}": SE.evaluate(rows, scores, t, k) for k in (3, 4, 5) for t in (0.3, 0.4, 0.5, 0.6)}
    chosen = SE.evaluate(rows, scores, args.threshold, args.confirm)

    # เกณฑ์ "ล้มแล้วนิ่ง" (fall_monitor --stay-still): การขยับช่วง 0.7–1.3 วิหลังตัวถึงพื้นที่ 90% ของการล้มไม่เกิน
    ip = AF.STREAM_KEYS.index("post_std")
    post_fall = np.array([r["aligned"][0][ip] for r in rows if r["y"] == 1 and 0 in r["aligned"]])
    walk = np.concatenate([r["Xs"][:, ip] for r in rows if r["act"] == "เดิน"])
    still_threshold = float(np.percentile(post_fall, 90))
    still_info = {"threshold": still_threshold, "fraction": 0.8, "falls_pass": float(np.mean(post_fall <= still_threshold)),
                  "walk_windows_pass": float(np.mean(walk <= still_threshold)),
                  "note": "การขยับ = std ของค่าเฉลี่ย 10 packet ใน 60 packet ล่าสุด ÷ noise ต่อ packet ของช่วงก่อนทำท่า"}

    # โมเดลจริง: เทรนจากทุกคน
    X, y = SE.training_set(rows, range(len(rows)), "B")
    model = SE.make_model("B").fit(X, y)
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    meta = {"version": "rf_v2_event", "model_name": "RandomForest", "trained_at": now,
            "feature_fn": "app.event_features.stream_feature_vector", "keys": AF.STREAM_KEYS,
            "pre": AF.PRE, "post": AF.STREAM_POST, "window": AF.STREAM_WINDOW, "step": SE.STEP,
            "threshold": args.threshold, "confirm": args.confirm, "label": "1 = fall",
            "still_threshold": still_threshold, "still": still_info,
            "n_files": len(rows), "n_rows": int(len(y)), "n_fall_rows": int(y.sum()),
            "people": [int(p) for p in people], "sklearn": sklearn.__version__,
            "unseen_eval": {"default": chosen, "grid": grid,
                            "note": "เทรน 4 คน ทดสอบคนที่ 5 · เลื่อนกรอบทุก 0.25 วิ · กิจวัตรรวม ~16 นาที (ประมาณคร่าว ๆ)"}}
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "wb") as f:
        pickle.dump({"model": model, **meta}, f)
    with open(REPORT_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f"เทรนจาก {len(rows)} ไฟล์ · {len(y)} กรอบ (ล้ม {int(y.sum())}) · threshold {args.threshold} · ยืนยัน {args.confirm} กรอบ")
    print(f"unseen: จับล้ม {chosen['fall_recall']*100:.1f}% · แจ้งผิดตอนกิจวัตร ~{chosen['routine_alarms_per_hour']:.0f}/ชม. · "
          f"ท่าคล้ายล้มโดนแจ้ง {chosen['lookalike_alarm_rate']*100:.1f}%")
    print(f"→ {MODEL_PATH}\n→ {REPORT_PATH}")


if __name__ == "__main__":
    main()
