"""
audit_data.py
=============
ตรวจว่าข้อมูลที่เก็บมาใช้ได้จริงไหม — โมเดลเรียน "การล้ม" หรือเรียน "เก็บตอนไหน"

คำถามหลัก
---------
accuracy 95.6% จาก grouped split ดูดี แต่ดีเพราะอะไร?
ถ้าโมเดลแยกออกเพราะสภาพห้องตอนเก็บ fall ต่างจากตอนเก็บ non_fall
ตัวเลขนั้นจะไม่มีความหมายเลยเมื่อเอาไปใช้ในบ้านจริง

    python experiments/audit_data.py
"""

import os
import sys
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")

import eval_harness as h                                # noqa: E402
from sklearn.ensemble import RandomForestClassifier     # noqa: E402
from sklearn.metrics import accuracy_score, recall_score  # noqa: E402
from sklearn.model_selection import StratifiedGroupKFold  # noqa: E402
from sklearn.preprocessing import StandardScaler        # noqa: E402
from sklearn.tree import DecisionTreeClassifier         # noqa: E402

SEED = h.SEED
STATS = ["mean", "min", "max", "std", "mad", "iqr", "skew", "kurt"]

# index 0,1,2 = ระดับสัญญาณ (สภาพห้อง) · 3-7 = ความแปรปรวน (การเคลื่อนไหว)
LEVEL_STATS = [0, 1, 2]
SPREAD_STATS = [3, 4, 5, 6, 7]


def evaluate(X, y, groups, label, verbose=True):
    acc, rec = [], []
    for tr, te in StratifiedGroupKFold(h.N_SPLITS, shuffle=True, random_state=SEED).split(X, y, groups=groups):
        scaler = StandardScaler().fit(X[tr])
        model = RandomForestClassifier(n_estimators=300, random_state=SEED, n_jobs=-1)
        model.fit(scaler.transform(X[tr]), y[tr])
        pred = model.predict(scaler.transform(X[te]))
        acc.append(accuracy_score(y[te], pred))
        rec.append(recall_score(y[te], pred, pos_label=h.FALL, zero_division=0))

    if verbose:
        print(f"  {label:46s} acc {np.mean(acc)*100:5.1f}%   fall recall {np.mean(rec)*100:5.1f}%")
    return float(np.mean(acc))


def check_integrity(X):
    print("\n[1] ความสมบูรณ์พื้นฐาน")
    print(f"  NaN {int(np.isnan(X).sum())} · Inf {int(np.isinf(X).sum())} · "
          f"แถวซ้ำเป๊ะ {len(X)-len(np.unique(X, axis=0))}")
    print(f"  feature ที่ค่าคงที่ทั้งคอลัมน์: {int(np.sum(X.std(axis=0) < 1e-12))}/{X.shape[1]}")


def check_collection_order(y, groups):
    """เก็บสลับคลาสไปมา หรือเก็บทีละคลาสเป็นบล็อก"""
    print("\n[2] ลำดับการเก็บข้อมูล")
    labels = {int(f): int(y[groups == f][0]) for f in np.unique(groups)}
    seq = [labels[f] for f in sorted(labels)]
    switches = sum(1 for i in range(1, len(seq)) if seq[i] != seq[i - 1])

    print(f"  ไฟล์ทั้งหมด {len(seq)} · สลับคลาส {switches} ครั้ง")
    if switches <= 5:
        print("  ⚠️  เก็บเป็นบล็อก — คลาสกับ session ทับกันสนิท แยกกันไม่ออก")
    else:
        print("  ✓ เก็บสลับกันไปมา")
    return switches


def check_session_drift(X, y, groups):
    """ภายในคลาสเดียวกัน แยก 'เก็บช่วงต้น' ออกจาก 'เก็บช่วงท้าย' ได้ไหม"""
    print("\n[3] สภาพห้องเปลี่ยนระหว่าง session ไหม")
    print("  แยกออกได้แม่น = feature จำได้ว่าเก็บตอนไหน ไม่ใช่จำว่าเกิดอะไรขึ้น")
    for cls, name in [(h.FALL, "fall"), (h.NON_FALL, "non_fall")]:
        mask = y == cls
        Xc, gc = X[mask], groups[mask]
        files = np.unique(gc)
        early_late = (gc >= files[len(files) // 2]).astype(int)
        evaluate(Xc, early_late, gc, f"ภายในคลาส {name}: ต้น-session vs ท้าย-session")


def check_trivial_feature(X, y, groups):
    """feature เดียวกับ decision stump อันเดียว แยกได้แม่นแค่ไหน"""
    print("\n[4] feature เดียวเก่งแค่ไหน")
    files = np.unique(groups)
    rng = np.random.RandomState(SEED)
    rng.shuffle(files)
    train_files = set(files[:len(files) // 2].tolist())
    tr = np.array([i for i in range(len(groups)) if groups[i] in train_files])
    te = np.setdiff1d(np.arange(len(groups)), tr)

    best = []
    for j in range(X.shape[1]):
        if X[:, j].std() < 1e-12:
            continue
        stump = DecisionTreeClassifier(max_depth=1, random_state=SEED).fit(X[tr, j:j+1], y[tr])
        best.append((accuracy_score(y[te], stump.predict(X[te, j:j+1])), j))
    best.sort(reverse=True)

    for acc, j in best[:5]:
        print(f"  #{j:3d} (subcarrier {j//8:2d}, {STATS[j%8]:5s})  →  {acc*100:5.1f}%  ด้วยเกณฑ์ตัดเดียว")
    return best[0][0]


def check_permutation(X, y, groups):
    """สลับ label ระดับไฟล์ — ถ้า harness ถูกต้องต้องได้ราว 50%"""
    print("\n[5] สลับ label แบบสุ่ม (ต้องได้ ~50%)")
    labels = {int(f): int(y[groups == f][0]) for f in np.unique(groups)}
    shuffled = list(labels.values())
    np.random.RandomState(SEED).shuffle(shuffled)
    mapping = dict(zip(sorted(labels), shuffled))
    y_random = np.array([mapping[int(f)] for f in groups])
    return evaluate(X, y_random, groups, "label สุ่มใหม่ระดับไฟล์")


def check_feature_groups(X, y, groups):
    """ระดับสัญญาณ (สภาพห้อง) กับความแปรปรวน (การเคลื่อนไหว) อย่างไหนพาไป"""
    print("\n[6] feature กลุ่มไหนที่พาไป")
    stat_of = np.arange(X.shape[1]) % 8
    evaluate(X, y, groups, "ครบทุก feature")
    evaluate(X[:, np.isin(stat_of, LEVEL_STATS)],  y, groups, "เฉพาะระดับสัญญาณ (mean/min/max)")
    evaluate(X[:, np.isin(stat_of, SPREAD_STATS)], y, groups, "เฉพาะความแปรปรวน (std/mad/iqr/skew/kurt)")

    print("\n  น้ำหนักที่ RandomForest ให้แต่ละ stat:")
    scaler = StandardScaler().fit(X)
    model = RandomForestClassifier(n_estimators=300, random_state=SEED, n_jobs=-1)
    model.fit(scaler.transform(X), y)
    for i, name in enumerate(STATS):
        total = model.feature_importances_[stat_of == i].sum()
        print(f"    {name:5s} {total*100:5.1f}%  {'█' * int(total * 100)}")


def main():
    X, y, groups = h.load_windows()
    print(f"\nตรวจข้อมูล: {X.shape[0]:,} window · {len(np.unique(groups))} ไฟล์")

    check_integrity(X)
    check_collection_order(y, groups)
    check_session_drift(X, y, groups)
    check_trivial_feature(X, y, groups)
    check_permutation(X, y, groups)
    check_feature_groups(X, y, groups)

    print("\nสรุปอยู่ที่ docs/reports/data_quality_audit_2026-09.md\n")


if __name__ == "__main__":
    main()
