"""
run_oneclass.py
===============
ตอบคำถาม mentor: one-class (normal vs anomaly) ช่วยอะไรได้ไหม

แนวคิดต่างจาก binary classifier ตรงที่ **เทรนด้วย non_fall อย่างเดียว**
แล้วให้ทุกอย่างที่ผิดไปจากปกติถือเป็น anomaly

ข้อดีที่คาดหวัง: ไม่ต้องเก็บตัวอย่างการล้มให้ครบทุกท่า — ท่าล้มที่ไม่เคยเห็นก็ยังจับได้
ข้อเสียที่ต้องพิสูจน์: การเคลื่อนไหวปกติที่แปลกไป (สะดุด นั่งลงเร็ว) จะกลายเป็น false alarm

ใช้ฐานการวัดเดียวกับ run_baselines.py — grouped 5-fold ตามไฟล์บันทึก

    python experiments/run_oneclass.py
"""

import os
import sys
import time
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")

import eval_harness as h                                # noqa: E402
from sklearn.covariance import EllipticEnvelope         # noqa: E402
from sklearn.decomposition import PCA                   # noqa: E402
from sklearn.ensemble import IsolationForest            # noqa: E402
from sklearn.neighbors import LocalOutlierFactor        # noqa: E402
from sklearn.preprocessing import StandardScaler        # noqa: E402
from sklearn.svm import OneClassSVM                     # noqa: E402

SEED = h.SEED


def detectors():
    # ทุกตัวคืน decision_function ที่ "ยิ่งต่ำ = ยิ่งผิดปกติ"
    return {
        "OneClassSVM (rbf)":   lambda: OneClassSVM(kernel="rbf", gamma="scale", nu=0.05),
        "IsolationForest":     lambda: IsolationForest(n_estimators=300, random_state=SEED, n_jobs=-1),
        "LocalOutlierFactor":  lambda: LocalOutlierFactor(n_neighbors=20, novelty=True),
        "EllipticEnvelope":    lambda: EllipticEnvelope(support_fraction=0.9, random_state=SEED),
    }


def run(name, make_detector, X, y, groups, n_components=None):
    scores = []

    for train_idx, test_idx in h.folds(y, groups):
        # เทรนด้วย non_fall ในฝั่ง train เท่านั้น — ไม่ให้เห็นการล้มเลย
        normal_idx = train_idx[y[train_idx] == h.NON_FALL]

        scaler = StandardScaler().fit(X[normal_idx])
        Xtr = scaler.transform(X[normal_idx])
        Xte = scaler.transform(X[test_idx])

        # EllipticEnvelope ต้องการตัวอย่างมากกว่าจำนวน feature — 416 feature ไม่พอ
        if n_components:
            pca = PCA(n_components=n_components, random_state=SEED).fit(Xtr)
            Xtr, Xte = pca.transform(Xtr), pca.transform(Xte)

        det = make_detector()
        det.fit(Xtr)

        # -1 = anomaly = fall(0) · 1 = normal = non_fall(1)
        pred = np.where(det.predict(Xte) == -1, h.FALL, h.NON_FALL)
        anomaly_score = -det.decision_function(Xte)   # ยิ่งสูง = ยิ่งเหมือน fall

        scores.append(h.score(y[test_idx], pred, anomaly_score))

    return h.aggregate(scores)


def main():
    X, y, groups = h.load_windows()
    n_normal = int(np.sum(y == h.NON_FALL))

    print(f"\nเทรนด้วย non_fall เท่านั้น ({n_normal:,} window จาก {len(X):,}) "
          f"แล้ววัดกับ fall ที่โมเดลไม่เคยเห็น")
    print(f"แบ่ง {h.N_SPLITS}-fold ตามไฟล์บันทึก — ฐานเดียวกับ run_baselines.py\n")

    results = {}
    for name, make in detectors().items():
        # EllipticEnvelope ประมาณ covariance เต็มรูปแบบ ต้องลดมิติก่อน
        n_components = 30 if name == "EllipticEnvelope" else None
        t0 = time.time()
        results[name] = run(name, make, X, y, groups, n_components)
        print(h.report_row(name, results[name]) + f"   {time.time()-t0:.0f}s")

    print()
    for name, agg in results.items():
        auc = agg.get("roc_auc")
        if auc:
            print(f"  {name:22s} ROC-AUC {auc['mean']:.3f} ±{auc['std']:.3f}")

    path = h.save(results, "oneclass.json")
    print(f"\nบันทึกผลที่ {path}\n")


if __name__ == "__main__":
    main()
