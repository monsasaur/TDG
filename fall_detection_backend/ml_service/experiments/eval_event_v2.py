"""
eval_event_v2.py — ตัวเลขแบบรู้จังหวะของ feature รุ่น 2 (หน้าสรุปให้อาจารย์ 2026-11-17)
=====================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    export OMP_NUM_THREADS=1 VECLIB_MAXIMUM_THREADS=1     # ไม่งั้น numpy แย่ง thread กับ RF จนช้าหลายสิบเท่า
    python experiments/eval_event_v2.py                   # ~1 นาที
    python experiments/eval_event_v2.py --perm 10         # + สลับ label 10 ครั้งต่อเป้าหมาย (~+3 นาที)
    # → docs/reports/figures/dataset_2026_11/numbers_v2.json

ใช้ app/event_features.feature_vector_v2 ตัวเดียวกับ fall_monitor / train_rf_v2 (39 ค่า):
    E = feature เหตุการณ์ 18 · D = Doppler 11 · L = หลังเหตุการณ์ 0.8–1.5 วิ 10
ทดสอบ unseen: เทรน 4 คน ทดสอบคนที่ 5 วนครบ · balanced accuracy ที่ 0.5 เฉลี่ยรายคน · ไม่รวมห้องว่าง
เทรนด้วยกรอบที่มาร์ค ± เลื่อน 0.15/0.3 วิ · ทดสอบกรอบที่มาร์ค · TTA = เฉลี่ยคะแนนกรอบเลื่อนทุกตัวของไฟล์นั้น
ใช้เฉพาะไฟล์ที่มีข้อมูลหลังมาร์ค ≥ 1.5 วิ (752/771) — ทุกแถวในตารางวัดบนไฟล์ชุดเดียวกัน

เป้าหมาย: fall = แจ้งเมื่อล้ม · floor = แจ้งเมื่อล้มหรือลงไปนอนบนพื้น

ผล 2026-11-17 (ตรงกับหน้าสรุป): fall E 72.6 → E+D 75.9 → E+D+L 80.5 → +TTA 81.1 ·
floor E 74.6 → 77.8 → 86.5 → +TTA 87.1 (AUC 0.95) · เทรน 2 คน → 3 คน 89.2%

⚠️ แบบรู้จังหวะเท่านั้น — แบบดูต่อเนื่องดู train_rf_v2.py / streaming_eval.py
   (แบบดูต่อเนื่อง floor แจ้งผิดตอนเดิน/ยืนนิ่งมากกว่า fall ชัดเจน)
"""

import argparse
import importlib.util
import json
import os
import sys
import time
from datetime import datetime

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import roc_auc_score

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(BASE))
sys.path.insert(0, BASE)
from app import event_features as AF   # noqa: E402

_spec = importlib.util.spec_from_file_location("streaming_eval", os.path.join(BASE, "experiments", "streaming_eval.py"))
SE = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(SE)
EF, P3 = SE.EF, SE.P3

OUT = os.path.join(REPO, "docs", "reports", "figures", "dataset_2026_11", "numbers_v2.json")
COLS = {"E": slice(0, 18), "D": slice(18, 29), "L": slice(29, 39)}
STEPS = [("E", "E", False), ("E+D", "ED", False), ("E+D+L", "EDL", False), ("E+D+L +TTA", "EDL", True)]


def rf():
    return RandomForestClassifier(n_estimators=400, min_samples_leaf=2, random_state=0, n_jobs=-1)


def bacc(y, p):
    pr = p >= 0.5
    return (pr[y == 1].mean() + 1 - pr[y == 0].mean()) / 2


def load():
    s2a = EF.actor_of_sessions()
    files, X, idx, sh = [], [], [], []
    for fname in sorted(os.listdir(P3.RAW_DIR)):
        mm = EF.NAME_RE.match(fname)
        if not mm or mm.group(1) not in s2a or mm.group(3) == "ห้องว่าง":
            continue
        sid, label, act = mm.groups()
        An, Ar, R, mark = SE.parse_file(os.path.join(P3.RAW_DIR, fname))
        m0 = mark if P3.needs_mark(label, fname) else P3.NO_EVENT_MARK
        if m0 < AF.PRE or len(An) < m0 + AF.POST_V2:
            continue
        i = len(files)
        files.append({"file": fname, "actor": s2a[sid][0], "y": int(label == "fall"), "act": act})
        for s in EF.SHIFTS:
            m = m0 + s
            if m >= AF.PRE and len(An) >= m + AF.POST_V2:
                X.append(AF.feature_vector_v2(An, Ar, R, m)); idx.append(i); sh.append(s)
    return files, np.array(X), np.array(idx), np.array(sh)


def feats(X, which):
    return {"E": X[:, COLS["E"]], "ED": X[:, :29], "EDL": X}[which]


def predict(Xa, idx, sh, y, train_files, test_files):
    tr = train_files[idx]
    model = rf().fit(Xa[tr], y[idx][tr])
    te = test_files[idx]
    pr = model.predict_proba(Xa[te])[:, 1]
    fi, si = idx[te], sh[te]
    p0, pt = np.full(len(y), np.nan), np.full(len(y), np.nan)
    p0[fi[si == 0]] = pr[si == 0]
    cnt = np.bincount(fi, minlength=len(y))
    ok = cnt > 0
    pt[ok] = np.bincount(fi, pr, minlength=len(y))[ok] / cnt[ok]
    return p0, pt


def loao(Xa, idx, sh, y, actor, tta):
    p = np.full(len(y), np.nan)
    for a in np.unique(actor):
        q0, qt = predict(Xa, idx, sh, y, actor != a, actor == a)
        p[actor == a] = (qt if tta else q0)[actor == a]
    return p


def summary(y, actor, p):
    people = np.unique(actor)
    per = {int(a): float(bacc(y[actor == a], p[actor == a])) for a in people}
    return {"balanced_acc": float(np.mean(list(per.values()))),
            "auc": float(np.mean([roc_auc_score(y[actor == a], p[actor == a]) for a in people])), "per_actor": per}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--perm", type=int, default=0, help="สลับ label (ภายในแต่ละคน) กี่ครั้งต่อเป้าหมาย")
    args = ap.parse_args()
    t0 = time.time()
    files, X, idx, sh = load()
    y_fall = np.array([f["y"] for f in files])
    actor = np.array([f["actor"] for f in files])
    act = np.array([f["act"] for f in files])
    y_floor = y_fall.copy()
    y_floor[np.isin(act, list(SE.FLOOR_ACTS))] = 1
    print(f"{len(files)} ไฟล์ · {len(idx)} แถวเทรน · {time.time() - t0:.0f}s", flush=True)
    out = {"generated_at": datetime.now().isoformat(timespec="seconds"), "n_files": len(files),
           "protocol": "unseen LOAO · balanced acc @0.5 เฉลี่ยรายคน · กรอบที่มาร์ค · ไม่รวมห้องว่าง · ไฟล์ที่มีข้อมูลหลังมาร์ค ≥1.5 วิ",
           "targets": {}}
    rng = np.random.default_rng(0)
    for target, y in (("fall", y_fall), ("floor", y_floor)):
        res = {"n_positive": int(y.sum()), "n_negative": int((1 - y).sum()), "ladder": {}}
        probs = {}
        for name, which, tta in STEPS:
            p = loao(feats(X, which), idx, sh, y, actor, tta)
            probs[name] = p
            res["ladder"][name] = summary(y, actor, p)
            s = res["ladder"][name]
            print(f"  {target:5s} {name:12s} {s['balanced_acc'] * 100:5.1f}%  AUC {s['auc']:.3f}  " +
                  " ".join(f"{v * 100:.1f}" for v in s["per_actor"].values()), flush=True)
        best, base = probs["E+D+L +TTA"], probs["E"]
        res["per_activity"] = {a: {"E": float((base[act == a] >= .5).mean()), "E+D+L +TTA": float((best[act == a] >= .5).mean())}
                               for a in EF.ORDER}
        lv, df = [], []
        for _ in range(2000):
            l1, d1 = [], []
            for a in np.unique(actor):
                i = np.where(actor == a)[0]
                j = rng.choice(i, len(i))
                l1.append(bacc(y[j], best[j])); d1.append(bacc(y[j], best[j]) - bacc(y[j], base[j]))
            lv.append(np.mean(l1)); df.append(np.mean(d1))
        res["bootstrap"] = {"level_ci95": [float(np.percentile(lv, 2.5)), float(np.percentile(lv, 97.5))],
                            "gain_vs_E": float(np.mean(df)),
                            "gain_vs_E_ci95": [float(np.percentile(df, 2.5)), float(np.percentile(df, 97.5))]}
        tr = np.isin(actor, [1, 2])
        _, qt = predict(X, idx, sh, y, tr, ~tr)
        res["train_2_test_3"] = {int(a): float(bacc(y[actor == a], qt[actor == a])) for a in (3, 4, 5)}
        if args.perm:
            null = []
            for _ in range(args.perm):
                yp = y.copy()
                for a in np.unique(actor):
                    i = np.where(actor == a)[0]
                    yp[i] = rng.permutation(y[i])
                pp = loao(X, idx, sh, yp, actor, True)
                null.append(float(np.mean([bacc(yp[actor == a], pp[actor == a]) for a in np.unique(actor)])))
            res["permutation"] = {"n": args.perm, "mean": float(np.mean(null)), "max": float(np.max(null))}
        b = res["bootstrap"]
        print(f"  {target:5s} CI {b['level_ci95'][0] * 100:.1f}–{b['level_ci95'][1] * 100:.1f}% · เทียบ E "
              f"{b['gain_vs_E'] * 100:+.1f} [{b['gain_vs_E_ci95'][0] * 100:+.1f}, {b['gain_vs_E_ci95'][1] * 100:+.1f}] · "
              f"เทรน 2 → 3 คน {np.mean(list(res['train_2_test_3'].values())) * 100:.1f}%"
              + (f" · สลับ label สูงสุด {res['permutation']['max'] * 100:.1f}%" if args.perm else ""), flush=True)
        out["targets"][target] = res
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"→ {OUT} · {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
