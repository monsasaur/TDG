"""
train_oneclass.py
=================
Train One-Class models จาก real-time collected data
เรียนรู้แค่ "ปกติ" → อะไรผิดปกติ = fall (anomaly)

ใช้ data เดียวกับ retrain_rf.py (X_rt.npy, y_rt.npy)

วิธีใช้:
  python data_collection/train_oneclass.py

Models ที่ train:
  1. One-Class SVM
  2. Isolation Forest
"""

import os
import numpy as np
import pickle
from sklearn.svm import OneClassSVM
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RT_DIR    = os.path.join(BASE_DIR, "data", "realtime")
OLD_DIR   = os.path.join(BASE_DIR, "data", "processed_v2")
MODEL_DIR = os.path.join(BASE_DIR, "models")

# Label mapping: 0=fall, 1=non_fall (จาก preprocess_v2 / collect_realtime)
FALL_LABEL    = 0
NORMAL_LABEL  = 1


def load_data():
    """โหลด data จาก realtime และ/หรือ processed_v2"""
    X_rt_path = os.path.join(RT_DIR, "X_rt.npy")
    y_rt_path = os.path.join(RT_DIR, "y_rt.npy")

    if not os.path.exists(X_rt_path):
        print("❌ ไม่พบ data/realtime/X_rt.npy")
        print("   รัน collect_realtime.py ก่อน")
        return None, None

    X = np.load(X_rt_path)
    y = np.load(y_rt_path)
    print(f"  Real-time data: {X.shape[0]} samples")
    print(f"    fall:     {(y == FALL_LABEL).sum()}")
    print(f"    non_fall: {(y == NORMAL_LABEL).sum()}")

    # Option: รวมกับ data เดิม
    X_old_path = os.path.join(OLD_DIR, "X.npy")
    if os.path.exists(X_old_path):
        X_old = np.load(X_old_path)
        y_old = np.load(os.path.join(OLD_DIR, "y.npy"))
        X_old = np.nan_to_num(X_old, nan=0.0, posinf=0.0, neginf=0.0)

        choice = input(f"\n  รวมกับ training data เดิม ({X_old.shape[0]} samples) ด้วยไหม? (y/n): ").strip().lower()
        if choice == "y":
            X = np.vstack([X, X_old])
            y = np.concatenate([y, y_old])
            print(f"  รวมแล้ว: {X.shape[0]} samples")

    return X, y


def split_data(X, y):
    """แยก data: train = non_fall เท่านั้น, test = ทั้ง fall + non_fall"""
    X_normal = X[y == NORMAL_LABEL]
    X_fall   = X[y == FALL_LABEL]

    # แบ่ง normal → 80% train, 20% test
    n_train = int(len(X_normal) * 0.8)
    idx = np.random.RandomState(42).permutation(len(X_normal))
    X_normal_train = X_normal[idx[:n_train]]
    X_normal_test  = X_normal[idx[n_train:]]

    # Test set = normal test + ทุก fall
    X_test = np.vstack([X_normal_test, X_fall])
    # One-Class label: 1=normal (inlier), -1=anomaly (fall)
    y_test = np.array([1] * len(X_normal_test) + [-1] * len(X_fall))

    print(f"\n  Train (non_fall only): {len(X_normal_train)}")
    print(f"  Test:  {len(X_normal_test)} non_fall + {len(X_fall)} fall = {len(X_test)}")

    return X_normal_train, X_test, y_test


def evaluate(name, y_true, y_pred):
    """แสดงผล evaluation"""
    print(f"\n  {'─' * 45}")
    print(f"  📊 {name}")
    print(f"  {'─' * 45}")

    # แปลง One-Class label → ชื่อ: 1=normal, -1=fall
    target_names = ["fall (-1)", "normal (1)"]
    print(classification_report(y_true, y_pred, target_names=target_names))

    cm = confusion_matrix(y_true, y_pred, labels=[-1, 1])
    print(f"  Confusion Matrix:")
    print(f"              Pred fall  Pred normal")
    print(f"  True fall     {cm[0][0]:>5}      {cm[0][1]:>5}")
    print(f"  True normal   {cm[1][0]:>5}      {cm[1][1]:>5}")

    # Fall recall สำคัญที่สุด
    if cm[0][0] + cm[0][1] > 0:
        fall_recall = cm[0][0] / (cm[0][0] + cm[0][1])
        print(f"\n  ⚠️  Fall Recall: {fall_recall:.1%} (ตรวจจับการล้มได้กี่ %)")
    if cm[1][0] + cm[1][1] > 0:
        false_alarm = cm[1][0] / (cm[1][0] + cm[1][1])
        print(f"  ⚠️  False Alarm: {false_alarm:.1%} (ปกติแต่แจ้งว่าล้ม)")


def main():
    print("=" * 55)
    print("  🔬  Train One-Class Models")
    print("=" * 55)

    X, y = load_data()
    if X is None:
        return

    X_train, X_test, y_test = split_data(X, y)

    # Scale
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    results = {}

    # ── 1. One-Class SVM ──
    print("\n  🔄 Training One-Class SVM...")
    oc_svm = OneClassSVM(kernel="rbf", gamma="scale", nu=0.05)
    oc_svm.fit(X_train_s)
    y_pred_svm = oc_svm.predict(X_test_s)
    evaluate("One-Class SVM", y_test, y_pred_svm)
    results["svm"] = (oc_svm, y_pred_svm)

    # ── 2. Isolation Forest ──
    print("\n  🔄 Training Isolation Forest...")
    iso_forest = IsolationForest(
        n_estimators=200,
        contamination=0.05,
        random_state=42,
        n_jobs=-1,
    )
    iso_forest.fit(X_train_s)
    y_pred_iso = iso_forest.predict(X_test_s)
    evaluate("Isolation Forest", y_test, y_pred_iso)
    results["iso"] = (iso_forest, y_pred_iso)

    # ── เลือก model ──
    print(f"\n  {'=' * 45}")
    print("  บันทึก model ไหนดี?")
    print("    1 = One-Class SVM")
    print("    2 = Isolation Forest")
    print("    3 = บันทึกทั้งคู่")
    print("    n = ไม่บันทึก")
    choice = input("  > ").strip().lower()

    def save_model(model, name, filename):
        model_path  = os.path.join(MODEL_DIR, f"{filename}.pkl")
        scaler_path = os.path.join(MODEL_DIR, f"scaler_{filename}.pkl")
        with open(model_path, "wb") as f:
            pickle.dump(model, f)
        with open(scaler_path, "wb") as f:
            pickle.dump(scaler, f)
        print(f"  ✅ {name} → models/{filename}.pkl + scaler_{filename}.pkl")

    if choice in ("1", "3"):
        save_model(results["svm"][0], "One-Class SVM", "ocsvm_v1")
    if choice in ("2", "3"):
        save_model(results["iso"][0], "Isolation Forest", "isoforest_v1")
    if choice == "n":
        print("  ⏭️  ไม่บันทึก")

    print("\n  💡 ถ้าจะใช้ one-class model ใน ML service")
    print("     ต้องแก้ predict.py ให้โหลด model ที่เลือก")
    print("     (one-class output: 1=ปกติ, -1=fall)")


if __name__ == "__main__":
    main()
