"""
train_lstm_rt.py
================
Train LSTM model จาก real-time collected data (X_rt_seq.npy)

วิธีใช้:
  python data_collection/train_lstm_rt.py

Input:
  data/realtime/X_rt_seq.npy  — (N, 10, 416) sequences
  data/realtime/y_rt_seq.npy  — (N,) labels (0=fall, 1=non_fall)

Output:
  models/lstm_rt_v1.h5
  models/scaler_lstm_rt_v1.pkl
"""

import os
import numpy as np
import pickle
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split

os.environ["TF_CPP_MIN_LOG_LEVEL"] = "2"
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RT_DIR    = os.path.join(BASE_DIR, "data", "realtime")
OLD_DIR   = os.path.join(BASE_DIR, "data", "processed_v2")
MODEL_DIR = os.path.join(BASE_DIR, "models")

SEQUENCE_LEN = 10
N_FEATURES   = 416


def load_data():
    """โหลด LSTM sequence data"""
    X_path = os.path.join(RT_DIR, "X_rt_seq.npy")
    y_path = os.path.join(RT_DIR, "y_rt_seq.npy")

    if not os.path.exists(X_path):
        print("  ไม่พบ data/realtime/X_rt_seq.npy")
        print("  รัน collect_realtime.py ก่อน")
        return None, None

    X = np.load(X_path)
    y = np.load(y_path)
    print(f"  Real-time LSTM data: {X.shape}")
    print(f"    fall:     {(y == 0).sum()}")
    print(f"    non_fall: {(y == 1).sum()}")

    return X, y


def build_model():
    """สร้าง LSTM model (128→64→32) เหมือน v3"""
    model = Sequential([
        LSTM(128, return_sequences=True, input_shape=(SEQUENCE_LEN, N_FEATURES)),
        BatchNormalization(),
        Dropout(0.3),

        LSTM(64, return_sequences=True),
        BatchNormalization(),
        Dropout(0.3),

        LSTM(32),
        BatchNormalization(),
        Dropout(0.3),

        Dense(32, activation="relu"),
        Dropout(0.2),
        Dense(1, activation="sigmoid"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    return model


def main():
    print("=" * 55)
    print("  Train LSTM from Real-time Data")
    print("=" * 55)

    X, y = load_data()
    if X is None:
        return

    if len(X) < 20:
        print(f"  Data too small ({len(X)} samples) — need at least 20")
        return

    # ── Scale features per-step ──
    # Reshape (N, 10, 416) → (N*10, 416) for scaling
    N = X.shape[0]
    X_flat = X.reshape(-1, N_FEATURES)

    scaler = StandardScaler()
    X_flat_s = scaler.fit_transform(X_flat)
    X_scaled = X_flat_s.reshape(N, SEQUENCE_LEN, N_FEATURES)

    # ── Split ──
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y,
    )
    print(f"\n  Train: {len(X_train)}, Test: {len(X_test)}")

    # ── Train ──
    model = build_model()
    model.summary()

    callbacks = [
        EarlyStopping(patience=10, restore_best_weights=True, monitor="val_loss"),
        ReduceLROnPlateau(patience=5, factor=0.5, monitor="val_loss"),
    ]

    history = model.fit(
        X_train, y_train,
        validation_split=0.15,
        epochs=100,
        batch_size=32,
        callbacks=callbacks,
        verbose=1,
    )

    # ── Evaluate ──
    y_pred_prob = model.predict(X_test).flatten()
    y_pred = (y_pred_prob > 0.5).astype(int)

    print(f"\n{'─' * 45}")
    print(classification_report(y_test, y_pred, target_names=["fall(0)", "non_fall(1)"]))

    cm = confusion_matrix(y_test, y_pred)
    print(f"  Confusion Matrix:")
    print(f"              Pred fall  Pred non_fall")
    print(f"  True fall     {cm[0][0]:>5}      {cm[0][1]:>5}")
    print(f"  True non_fall {cm[1][0]:>5}      {cm[1][1]:>5}")

    if cm[0][0] + cm[0][1] > 0:
        recall = cm[0][0] / (cm[0][0] + cm[0][1])
        print(f"\n  Fall Recall: {recall:.1%}")
    if cm[1][0] + cm[1][1] > 0:
        false_alarm = cm[1][0] / (cm[1][0] + cm[1][1])
        print(f"  False Alarm: {false_alarm:.1%}")

    # ── Save ──
    test_acc = np.mean(y_pred == y_test)
    print(f"\n  Test Accuracy: {test_acc:.1%}")

    confirm = input("\n  Save model? (y/n): ").strip().lower()
    if confirm == "y":
        model_path  = os.path.join(MODEL_DIR, "lstm_rt_v1.h5")
        scaler_path = os.path.join(MODEL_DIR, "scaler_lstm_rt_v1.pkl")

        model.save(model_path)
        with open(scaler_path, "wb") as f:
            pickle.dump(scaler, f)

        print(f"  Saved -> models/lstm_rt_v1.h5 + scaler_lstm_rt_v1.pkl")
        print(f"  To use: update .env MODEL_PATH=models/lstm_rt_v1.h5")
    else:
        print("  Not saved")


if __name__ == "__main__":
    main()
