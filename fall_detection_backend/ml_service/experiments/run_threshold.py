"""
run_threshold.py
================
หา threshold ที่เหมาะกับ RandomForest (โมเดลที่ชนะใน run_baselines.py)

ปิดงานค้าง "Threshold tuning" ที่อยู่ใน Phase 2 backlog — เดิมใช้ค่ากลาง 0.5
โดยไม่เคยดูว่าจุดไหนเหมาะกับระบบที่ **พลาดการล้มจริงอันตรายกว่าเตือนผิด**

วัดด้วย grouped 5-fold ตามไฟล์บันทึก แล้วรวม out-of-fold prediction ของทุก fold
มาลากเส้นเดียว — ทุก window ถูกทำนายโดยโมเดลที่ไม่เคยเห็นไฟล์ของมันมาก่อน

    python experiments/run_threshold.py
"""

import os
import sys
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")

import eval_harness as h                                # noqa: E402
from sklearn.ensemble import RandomForestClassifier     # noqa: E402
from sklearn.metrics import roc_curve                   # noqa: E402
from sklearn.preprocessing import StandardScaler        # noqa: E402


def out_of_fold_scores(X, y, groups):
    """คะแนนความน่าจะเป็นของ fall ทุก window โดยโมเดลไม่เคยเห็นไฟล์นั้นตอนเทรน"""
    prob = np.zeros(len(y))

    for train_idx, test_idx in h.folds(y, groups):
        scaler = StandardScaler().fit(X[train_idx])
        model  = RandomForestClassifier(n_estimators=300, random_state=h.SEED, n_jobs=-1)
        model.fit(scaler.transform(X[train_idx]), y[train_idx])

        fall_col = list(model.classes_).index(h.FALL)
        prob[test_idx] = model.predict_proba(scaler.transform(X[test_idx]))[:, fall_col]

    return prob


def main():
    X, y, groups = h.load_windows()
    prob = out_of_fold_scores(X, y, groups)

    is_fall = (y == h.FALL).astype(int)
    n_fall, n_normal = int(is_fall.sum()), int((1 - is_fall).sum())

    print(f"\nRandomForest · out-of-fold {len(y):,} window "
          f"(fall {n_fall:,} · non_fall {n_normal:,})\n")

    print("  threshold   fall recall   false alarm rate   ล้มที่พลาด   เตือนผิด")
    print("  " + "─" * 68)

    rows = []
    for t in [0.20, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60, 0.70]:
        pred    = prob >= t
        recall  = pred[is_fall == 1].mean()
        far     = pred[is_fall == 0].mean()
        missed  = int((~pred[is_fall == 1]).sum())
        false_a = int(pred[is_fall == 0].sum())

        mark = "  ← ค่าที่ใช้อยู่" if t == 0.50 else ""
        print(f"    {t:.2f}      {recall*100:5.1f}%         {far*100:5.1f}%          "
              f"{missed:4d}        {false_a:4d}{mark}")
        rows.append({"threshold": t, "fall_recall": float(recall),
                     "false_alarm_rate": float(far),
                     "missed_falls": missed, "false_alarms": false_a})

    # เกณฑ์ที่เลือก: ดัน recall ให้สูงสุดโดยคุม false alarm ไม่เกิน 10%
    # ระบบมี acknowledge flow อยู่แล้ว — เตือนผิดผู้ดูแลกดปิดได้ใน 60 วิ
    # แต่ล้มที่พลาดคือไม่มีใครรู้เลย
    fpr, tpr, thresholds = roc_curve(is_fall, prob)
    ok = fpr <= 0.10
    best = int(np.argmax(tpr[ok]))
    chosen = float(thresholds[ok][best])

    print(f"\n  แนะนำ threshold = {chosen:.3f}")
    print(f"    fall recall {tpr[ok][best]*100:.1f}%  ·  false alarm {fpr[ok][best]*100:.1f}%")
    print("    เกณฑ์: ดัน recall สูงสุดโดยคุม false alarm ≤ 10%")
    print("    เหตุผล: ระบบมี acknowledge flow อยู่แล้ว เตือนผิดผู้ดูแลกดปิดได้ใน 60 วินาที")
    print("            แต่การล้มที่พลาดคือไม่มีใครรู้เลย\n")

    path = h.save({
        "model": "RandomForest (per-window)",
        "evaluation": f"out-of-fold, StratifiedGroupKFold n_splits={h.N_SPLITS} by file",
        "recommended_threshold": chosen,
        "criterion": "max fall recall subject to false alarm rate <= 10%",
        "sweep": rows,
    }, "threshold.json")
    print(f"บันทึกผลที่ {path}\n")


if __name__ == "__main__":
    main()
