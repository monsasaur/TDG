"""
retrain_rf.py
=============
Train RF model จาก real-time collected data

วิธีใช้:
  python data_collection/retrain_rf.py
"""

import os
import numpy as np
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import classification_report
from sklearn.preprocessing import StandardScaler

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RT_DIR   = os.path.join(BASE_DIR, "data", "realtime")
OLD_DIR  = os.path.join(BASE_DIR, "data", "processed_v2")
MODEL_DIR = os.path.join(BASE_DIR, "models")

def main():
    print("=" * 55)
    print("  🔄  Retrain RF Model")
    print("=" * 55)

    # Load real-time data
    X_rt_path = os.path.join(RT_DIR, "X_rt.npy")
    y_rt_path = os.path.join(RT_DIR, "y_rt.npy")

    if not os.path.exists(X_rt_path):
        print("❌ ไม่พบ data/realtime/X_rt.npy")
        print("   รัน collect_realtime.py ก่อน")
        return

    X_rt = np.load(X_rt_path)
    y_rt = np.load(y_rt_path)
    print(f"\n  Real-time data: {X_rt.shape[0]} samples")
    print(f"    fall:     {(y_rt == 0).sum()}")
    print(f"    non_fall: {(y_rt == 1).sum()}")

    # Option: combine with old data
    X_old_path = os.path.join(OLD_DIR, "X.npy")
    if os.path.exists(X_old_path):
        X_old = np.load(X_old_path)
        y_old = np.load(os.path.join(OLD_DIR, "y.npy"))
        X_old = np.nan_to_num(X_old, nan=0.0, posinf=0.0, neginf=0.0)

        choice = input(f"\n  รวมกับ training data เดิม ({X_old.shape[0]} samples) ด้วยไหม? (y/n): ").strip().lower()
        if choice == "y":
            X = np.vstack([X_rt, X_old])
            y = np.concatenate([y_rt, y_old])
            print(f"  รวมแล้ว: {X.shape[0]} samples")
        else:
            X, y = X_rt, y_rt
    else:
        X, y = X_rt, y_rt

    if len(X) < 10:
        print("❌ ข้อมูลน้อยเกินไป (< 10 samples)")
        return

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    # Scale
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    # Train
    print("\n  Training RF...")
    rf = RandomForestClassifier(n_estimators=200, max_depth=20, random_state=42, n_jobs=-1)
    rf.fit(X_train_s, y_train)

    # Evaluate
    y_pred = rf.predict(X_test_s)
    print(f"\n{classification_report(y_test, y_pred, target_names=['fall(0)', 'non_fall(1)'])}")

    # Cross validation
    scores = cross_val_score(rf, scaler.transform(X), y, cv=5, scoring="accuracy")
    print(f"  CV Accuracy: {scores.mean():.1%} (+/- {scores.std():.1%})")

    # Save
    confirm = input("\n  บันทึก model ใหม่ทับ rf_v1.pkl? (y/n): ").strip().lower()
    if confirm == "y":
        with open(os.path.join(MODEL_DIR, "rf_v1.pkl"), "wb") as f:
            pickle.dump(rf, f)
        with open(os.path.join(MODEL_DIR, "scaler_rf_v1.pkl"), "wb") as f:
            pickle.dump(scaler, f)
        print("  ✅ บันทึกแล้ว → models/rf_v1.pkl, scaler_rf_v1.pkl")
        print("  🔄 รีสตาร์ท uvicorn เพื่อใช้ model ใหม่")
    else:
        print("  ⏭️  ไม่บันทึก")


if __name__ == "__main__":
    main()
