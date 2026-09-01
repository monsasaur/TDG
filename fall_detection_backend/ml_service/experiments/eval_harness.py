"""
eval_harness.py
===============
ฐานร่วมสำหรับทุกการทดลองโมเดล — บังคับให้แบ่ง train/test ตามไฟล์บันทึกเสมอ

ทำไมต้องมี
----------
`notebooks/train_v3.ipynb` ใช้ `train_test_split` สุ่มธรรมดา ไม่ได้โหลด `file_ids.npy`
ที่ preprocess เซฟไว้ให้ ผลคือ window จากการล้มครั้งเดียวกันกระจายไปอยู่ทั้ง train และ test
(window ซ้อนกัน 75% เพราะ window_size=200 stride=50) ตัวเลขที่ได้จึงสูงกว่าความจริง

วัดแล้วบนข้อมูลชุดเดียวกัน (RandomForest, per-window):
    random split   acc 97.5%  fall recall 99.2%
    grouped split  acc 95.7%  fall recall 95.4%

ทุกการทดลองหลังจากนี้ต้องผ่านไฟล์นี้ เพื่อให้ตัวเลขเทียบกันได้จริง

หมายเหตุเรื่อง SEQUENCE_LEN
---------------------------
แต่ละไฟล์บันทึกมี 3 window เท่านั้น แต่ train_v3 ใช้ SEQUENCE_LEN=10
→ ทุก sequence ที่ใช้เทรนประกอบจากคนละไฟล์ วัดแล้วเป็น 100% (2,394 จาก 2,394)
→ มิติเวลาที่ LSTM เห็นคือลำดับการเรียงไฟล์ ไม่ใช่เวลาจริง
→ ฝั่ง serving รู้ปัญหานี้และ workaround ด้วยการซ้ำ window เดียว 10 ครั้ง
   (`app/preprocess.py` — `return [feat] * self.sequence_len`)

ไฟล์นี้จึงรองรับ seq_len ได้มากสุดเท่าจำนวน window ต่อไฟล์ และสร้าง sequence
ภายในไฟล์เดียวเท่านั้น
"""

import json
import os

import numpy as np
from sklearn.metrics import (
    accuracy_score, confusion_matrix, f1_score,
    precision_score, recall_score, roc_auc_score
)
from sklearn.model_selection import LeaveOneGroupOut, StratifiedGroupKFold

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "processed_v2")

# label_map จาก metadata.json — fall = 0, non_fall = 1
FALL, NON_FALL = 0, 1

N_SPLITS = 5
SEED = 42


def load_windows():
    """คืน (X, y, groups) ระดับ window — groups คือ id ของไฟล์บันทึก"""
    X = np.load(os.path.join(DATA_DIR, "X.npy"))
    y = np.load(os.path.join(DATA_DIR, "y.npy"))
    groups = np.load(os.path.join(DATA_DIR, "file_ids.npy"))

    if not (len(X) == len(y) == len(groups)):
        raise ValueError(f"ความยาวไม่ตรงกัน: X={len(X)} y={len(y)} groups={len(groups)}")

    return X, y, groups


def load_session_ids():
    """
    คืน session id ต่อ window — หรือ None ถ้า dataset นี้ preprocess ก่อนมีระบบ session

    session สำคัญกว่า file: ไฟล์ที่เก็บติดกันใน session เดียวอยู่ในสภาพห้องเดียวกัน
    แบ่ง test ตามไฟล์จึงยังให้โมเดลเห็นสภาพห้องของ test มาก่อนแล้ว
    ต้องแบ่งตาม session ถึงจะตอบได้ว่าไปบ้านที่ไม่เคยเห็นแล้วยังทำงานไหม
    """
    path = os.path.join(DATA_DIR, "session_ids.npy")
    if not os.path.exists(path):
        return None
    return np.load(path)


def session_folds(y, sessions, n_splits=N_SPLITS, seed=SEED):
    """
    แบ่ง fold โดยให้ทั้ง session อยู่ฝั่งเดียวกันเสมอ

    session น้อยกว่าจำนวน fold → ใช้ leave-one-session-out แทน
    (test คือ session เดียวที่ถูกกันออกทั้งชุด ซึ่งตรงกับคำถามที่อยากรู้พอดี)
    """
    n_sessions = len(np.unique(sessions))
    if n_sessions < 2:
        raise ValueError(
            f"มี session เดียว ({n_sessions}) — แบ่ง test ตาม session ไม่ได้ "
            "ต้องเก็บข้อมูลเพิ่มอีกอย่างน้อย 1 session"
        )

    if n_sessions <= n_splits:
        return list(LeaveOneGroupOut().split(np.zeros(len(y)), y, groups=sessions))

    splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    return list(splitter.split(np.zeros(len(y)), y, groups=sessions))


def windows_per_file(groups):
    counts = np.bincount(groups)
    return counts[counts > 0]


def load_sequences(seq_len):
    """
    สร้าง sequence ภายในไฟล์เดียวเท่านั้น — ไม่ข้ามขอบไฟล์เหมือน train_v3

    คืน (Xs, ys, groups) รูปร่าง (n, seq_len, n_features)
    ไฟล์ที่มี window ไม่ถึง seq_len จะถูกข้าม
    """
    X, y, groups = load_windows()

    Xs, ys, gs = [], [], []
    for file_id in np.unique(groups):
        idx = np.flatnonzero(groups == file_id)   # เรียงตามลำดับเดิมอยู่แล้ว
        if len(idx) < seq_len:
            continue
        for start in range(len(idx) - seq_len + 1):
            chunk = idx[start:start + seq_len]
            labels = y[chunk]
            if len(np.unique(labels)) != 1:       # ไฟล์เดียวกันต้อง label เดียว
                continue
            Xs.append(X[chunk])
            ys.append(labels[-1])
            gs.append(file_id)

    if not Xs:
        raise ValueError(
            f"สร้าง sequence ไม่ได้ที่ seq_len={seq_len} — "
            f"แต่ละไฟล์มี window มากสุด {int(windows_per_file(groups).max())} อัน"
        )

    return (np.asarray(Xs, dtype=np.float32),
            np.asarray(ys, dtype=np.int32),
            np.asarray(gs, dtype=np.int32))


def folds(y, groups, n_splits=N_SPLITS, seed=SEED):
    """
    แบ่ง k-fold โดยไฟล์เดียวกันอยู่ฝั่งเดียวเสมอ และคงสัดส่วน fall/non_fall ไว้

    ใช้ k-fold แทนการสุ่มแบ่งครั้งเดียว เพื่อไม่ให้ผลขึ้นกับ seed ที่บังเอิญได้
    """
    splitter = StratifiedGroupKFold(n_splits=n_splits, shuffle=True, random_state=seed)
    return list(splitter.split(np.zeros(len(y)), y, groups=groups))


def score(y_true, y_pred, y_score=None):
    """
    ตัวเลขที่รายงานทุกการทดลอง

    fall_recall สำคัญที่สุดสำหรับระบบนี้ — พลาดการล้มจริงอันตรายกว่าเตือนผิด
    ใช้ pos_label=FALL เพราะ fall = 0 ตาม label_map
    """
    tn, fp, fn, tp = confusion_matrix(
        y_true, y_pred, labels=[NON_FALL, FALL]
    ).ravel()

    result = {
        "accuracy":       float(accuracy_score(y_true, y_pred)),
        "fall_recall":    float(recall_score(y_true, y_pred, pos_label=FALL, zero_division=0)),
        "fall_precision": float(precision_score(y_true, y_pred, pos_label=FALL, zero_division=0)),
        "fall_f1":        float(f1_score(y_true, y_pred, pos_label=FALL, zero_division=0)),
        "missed_falls":   int(fn),    # ล้มจริงแต่ระบบไม่จับ — ตัวเลขที่อันตรายที่สุด
        "false_alarms":   int(fp),
        "n_test":         int(len(y_true)),
    }

    if y_score is not None:
        # y_score = คะแนนความน่าจะเป็นของคลาส fall
        result["roc_auc"] = float(roc_auc_score((y_true == FALL).astype(int), y_score))

    return result


def aggregate(fold_scores):
    """เฉลี่ย ± ส่วนเบี่ยงเบนข้าม fold"""
    keys = fold_scores[0].keys()
    out = {}
    for k in keys:
        values = [f[k] for f in fold_scores if k in f]
        if not values:
            continue
        if k in ("missed_falls", "false_alarms", "n_test"):
            out[k] = int(sum(values))
        else:
            out[k] = {"mean": float(np.mean(values)), "std": float(np.std(values))}
    return out


def report_row(name, agg):
    def pct(key):
        v = agg.get(key)
        return f"{v['mean']*100:5.1f} ±{v['std']*100:4.1f}" if v else "     —     "

    return (f"  {name:32s} "
            f"acc {pct('accuracy')}  "
            f"fall recall {pct('fall_recall')}  "
            f"F1 {pct('fall_f1')}  "
            f"missed {agg.get('missed_falls', 0):>3}/{agg.get('n_test', 0):<5}"
            f"false {agg.get('false_alarms', 0):>3}")


def save(results, filename):
    path = os.path.join(os.path.dirname(__file__), "results", filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    return path
