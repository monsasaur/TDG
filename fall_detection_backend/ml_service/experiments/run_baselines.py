"""
run_baselines.py
================
เทียบสถาปัตยกรรมโมเดลบนฐานการวัดเดียวกัน — grouped 5-fold ตามไฟล์บันทึก

คำถามที่ต้องการคำตอบ
--------------------
1. ตัวเลขจริงของข้อมูลชุดนี้อยู่ที่เท่าไร เมื่อไม่ให้ window จากไฟล์เดียวกันรั่วข้ามฝั่ง
2. LSTM จำเป็นไหม — ในเมื่อแต่ละไฟล์มีแค่ 3 window และตอน serving ป้อน window เดียว
   ซ้ำ 10 ครั้งอยู่แล้ว โมเดลที่ดู window เดียวตรง ๆ อาจให้ผลเท่ากันโดยไม่ต้องมี
   sequence layer

    python experiments/run_baselines.py
"""

import os
import sys
import time
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")

import eval_harness as h                                    # noqa: E402
from sklearn.ensemble import RandomForestClassifier         # noqa: E402
from sklearn.linear_model import LogisticRegression         # noqa: E402
from sklearn.model_selection import train_test_split        # noqa: E402
from sklearn.neural_network import MLPClassifier            # noqa: E402
from sklearn.preprocessing import StandardScaler            # noqa: E402
from sklearn.svm import SVC                                 # noqa: E402

SEED = h.SEED


def sklearn_models():
    return {
        "LogisticRegression": lambda: LogisticRegression(max_iter=2000, random_state=SEED),
        "RandomForest":       lambda: RandomForestClassifier(n_estimators=300, random_state=SEED, n_jobs=-1),
        "SVM (RBF)":          lambda: SVC(probability=True, random_state=SEED),
        "MLP (256,128)":      lambda: MLPClassifier(hidden_layer_sizes=(256, 128), max_iter=600,
                                                    early_stopping=True, random_state=SEED),
    }


def run_per_window(name, make_model, X, y, groups):
    """โมเดลที่ดู window เดียว (416 features) ไม่มีมิติเวลา"""
    scores = []
    for train_idx, test_idx in h.folds(y, groups):
        scaler = StandardScaler().fit(X[train_idx])
        model  = make_model()
        model.fit(scaler.transform(X[train_idx]), y[train_idx])

        Xt   = scaler.transform(X[test_idx])
        pred = model.predict(Xt)
        prob = model.predict_proba(Xt)[:, list(model.classes_).index(h.FALL)]
        scores.append(h.score(y[test_idx], pred, prob))

    return h.aggregate(scores)


def run_lstm(seq_len, X, y, groups, epochs=80):
    """LSTM ที่ sequence สร้างจากไฟล์เดียวเท่านั้น — ไม่ข้ามขอบไฟล์เหมือน train_v3"""
    from tensorflow.keras.callbacks import EarlyStopping
    from tensorflow.keras.layers import Dense, Dropout, LSTM
    from tensorflow.keras.models import Sequential
    import tensorflow as tf

    Xs, ys, gs = h.load_sequences(seq_len)
    n_feat = Xs.shape[2]
    scores = []

    for fold, (train_idx, test_idx) in enumerate(h.folds(ys, gs)):
        tf.keras.utils.set_random_seed(SEED + fold)

        scaler = StandardScaler().fit(Xs[train_idx].reshape(-1, n_feat))
        def prep(a):
            return scaler.transform(a.reshape(-1, n_feat)).reshape(a.shape)

        Xtr, Xte = prep(Xs[train_idx]), prep(Xs[test_idx])

        # แบ่ง validation ออกจาก train เพื่อ early stopping — ห้ามแตะ test
        Xtr, Xval, ytr, yval = train_test_split(
            Xtr, ys[train_idx], test_size=0.15, random_state=SEED, stratify=ys[train_idx]
        )

        model = Sequential([
            LSTM(64, input_shape=(seq_len, n_feat), return_sequences=seq_len > 2, dropout=0.3),
        ] + ([LSTM(32, dropout=0.2)] if seq_len > 2 else []) + [
            Dense(32, activation="relu"),
            Dropout(0.3),
            Dense(1, activation="sigmoid"),
        ])
        model.compile(optimizer="adam", loss="binary_crossentropy")

        # sigmoid ทำนายความน่าจะเป็นของ "fall" → กลับ label ให้ fall = 1
        model.fit(
            Xtr, (ytr == h.FALL).astype(int),
            validation_data=(Xval, (yval == h.FALL).astype(int)),
            epochs=epochs, batch_size=32, verbose=0,
            callbacks=[EarlyStopping(patience=12, restore_best_weights=True)],
        )

        prob = model.predict(Xte, verbose=0).ravel()
        pred = np.where(prob >= 0.5, h.FALL, h.NON_FALL)
        scores.append(h.score(ys[test_idx], pred, prob))

    return h.aggregate(scores)


def run_leaky_reference(X, y):
    """
    ทำซ้ำวิธีแบ่งข้อมูลแบบ train_v3 (สุ่มโดยไม่สนไฟล์) ไว้เป็นจุดอ้างอิง
    ว่าการรั่วทำให้ตัวเลขสูงขึ้นเท่าไร — ไม่ใช่ตัวเลขที่ควรรายงาน
    """
    scores = []
    for fold in range(h.N_SPLITS):
        train_idx, test_idx = train_test_split(
            np.arange(len(X)), test_size=0.2, random_state=SEED + fold, stratify=y
        )
        scaler = StandardScaler().fit(X[train_idx])
        model  = RandomForestClassifier(n_estimators=300, random_state=SEED, n_jobs=-1)
        model.fit(scaler.transform(X[train_idx]), y[train_idx])

        Xt   = scaler.transform(X[test_idx])
        pred = model.predict(Xt)
        prob = model.predict_proba(Xt)[:, list(model.classes_).index(h.FALL)]
        scores.append(h.score(y[test_idx], pred, prob))

    return h.aggregate(scores)


def main():
    X, y, groups = h.load_windows()

    print(f"\nข้อมูล: {X.shape[0]:,} window · {len(np.unique(groups))} ไฟล์ · "
          f"{int(h.windows_per_file(groups).max())} window ต่อไฟล์")
    print(f"แบ่ง {h.N_SPLITS}-fold ตามไฟล์บันทึก (StratifiedGroupKFold)\n")

    results = {}

    print("── โมเดลที่ดู window เดียว (ไม่มีมิติเวลา) " + "─" * 30)
    for name, make in sklearn_models().items():
        t0 = time.time()
        results[name] = run_per_window(name, make, X, y, groups)
        print(h.report_row(name, results[name]) + f"   {time.time()-t0:.0f}s")

    print("\n── LSTM (sequence สร้างภายในไฟล์เดียว) " + "─" * 32)
    for seq_len in (2, 3):
        name = f"LSTM seq_len={seq_len}"
        t0 = time.time()
        results[name] = run_lstm(seq_len, X, y, groups)
        print(h.report_row(name, results[name]) + f"   {time.time()-t0:.0f}s")

    print("\n── อ้างอิง: วิธีแบ่งแบบเดิมที่ข้อมูลรั่ว (ไม่ใช่ตัวเลขที่ควรรายงาน) " + "─" * 5)
    results["[leaky] RandomForest random split"] = run_leaky_reference(X, y)
    print(h.report_row("RandomForest + random split", results["[leaky] RandomForest random split"]))

    path = h.save(results, "baselines.json")
    print(f"\nบันทึกผลที่ {path}\n")


if __name__ == "__main__":
    main()
