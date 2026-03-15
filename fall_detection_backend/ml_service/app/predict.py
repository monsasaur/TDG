"""
predict.py
==========
Binary LSTM fall detection + Rule-based severity classification (v5)

LSTM  → จับว่าล้มหรือไม่ล้ม (fall / non_fall)
Rules → กำหนดระดับความรุนแรง (A / B / C) จากระยะเวลาที่ล้ม

ทำไมใช้ Binary ไม่ใช่ 3-class:
  - CSI ตอน "นอนนิ่งหลังล้ม" กับ "นอนปกติ" เหมือนกัน → 3-class accuracy แย่ (72%)
  - Binary ให้ accuracy สูงกว่า (88%)
  - FallStateTracker จัดการ duration + reset ด้วย rule-based แทน

Output: {
    "is_fall"          : bool
    "confidence"       : float 0-1
    "fall_level"       : "A" | "B" | "C" | null
    "risk_score"       : float 0-1
    "duration_on_floor": float (วินาที)
    "alert"            : str
    "probabilities"    : { "fall": float, "non_fall": float }
}

Rule-based severity:
  Level A  (<10 วิ)   → แจ้งเตือนเบา          risk=0.4
  Level B  (10-60 วิ) → แจ้ง caregiver         risk=0.7
  Level C  (>60 วิ)   → ฉุกเฉิน โทรขอความช่วยเหลือ  risk=1.0
"""

import os
import time
import pickle
import numpy as np
from tensorflow.keras.models import load_model

# =================== Path ===================
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH  = os.path.join(BASE_DIR, "models", "lstm_v3.h5")
SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler_v3.pkl")

# =================== Config ===================
LABEL_NAMES  = ["fall", "non_fall"]
SEQUENCE_LEN = 10
N_FEATURES   = 416

# Confidence threshold — ต่ำกว่านี้ถือว่า non_fall (กรอง false positive)
FALL_THRESHOLD = 0.55

# Rule-based thresholds (วินาที)
LEVEL_A_MAX  = 10    # < 10 วิ → Level A
LEVEL_B_MAX  = 60    # 10-60 วิ → Level B
                     # > 60 วิ → Level C

# ต้อง predict fall ติดกัน FALL_REQUIRED_STREAK ครั้ง → ถือว่าล้มจริง (debounce)
# (~0.5 วิ/ครั้ง → 5 ครั้ง ≈ 2.5 วิ)
FALL_REQUIRED_STREAK =  8

# ต้อง predict non_fall ติดกัน RESET_REQUIRED_NON_FALL ครั้ง → reset
# (~0.5 วิ/ครั้ง → 6 ครั้ง ≈ 3 วิติดกัน)
# ตั้งนานพอ ไม่งั้นนอนนิ่งหลังล้มแล้ว LSTM เห็นเป็น non_fall → reset ก่อนถึง Level B/C
RESET_REQUIRED_NON_FALL = 6

# Auto-reset ถ้า fall state ค้างนานเกินไป (กัน stuck ตลอดกาล)
FALL_STATE_TIMEOUT = 180  # วินาที (3 นาที)

RISK_SCORES = {
    "A": 0.4,
    "B": 0.7,
    "C": 1.0,
    None: 0.0,
}

ALERT_MESSAGES = {
    "A": "แจ้งเตือนเบา",
    "B": "แจ้ง caregiver",
    "C": "ฉุกเฉิน โทรขอความช่วยเหลือ",
    None: "-",
}

# =================== Load model ===================
print(f"🔄 กำลังโหลด binary model จาก {MODEL_PATH}")
_model = load_model(MODEL_PATH)
print("✅ โหลด model สำเร็จ")

with open(SCALER_PATH, "rb") as f:
    _scaler = pickle.load(f)
print("✅ โหลด scaler สำเร็จ")


# =================== Rule-based Severity ===================
class FallStateTracker:
    """
    ติดตาม state การล้มและคำนวณ duration บนพื้น

    Fall detection (debounce):
      - ต้องเห็น fall ติดกัน FALL_REQUIRED_STREAK ครั้ง → confirmed fall
      - ถ้าแว่บมาแค่ 1-2 frame → ไม่ trigger

    Reset (grace period):
      - ต้องเห็น non_fall ติดกัน RESET_REQUIRED_NON_FALL ครั้ง → reset
      - ตั้ง 20 ครั้ง (~10 วิ) เพื่อไม่ให้ reset เร็วเกิน
      - ระหว่าง grace period คืน duration สะสม (ไม่หายไป)
    """
    def __init__(self):
        self.fall_start: float | None = None
        self._fall_streak: int        = 0   # นับ fall ติดกัน (debounce)
        self._non_fall_streak: int    = 0   # นับ non_fall ติดกัน (reset)

    def update(self, lstm_is_fall: bool) -> float:
        now = time.time()

        # Auto-reset ถ้า fall state ค้างนานเกิน FALL_STATE_TIMEOUT
        if self.fall_start is not None and (now - self.fall_start) > FALL_STATE_TIMEOUT:
            self.reset()
            return 0.0

        if lstm_is_fall:
            self._non_fall_streak = 0        # ยกเลิก reset counter
            self._fall_streak    += 1

            if self._fall_streak >= FALL_REQUIRED_STREAK:
                if self.fall_start is None:
                    self.fall_start = now    # confirmed fall → เริ่มนับ
                return now - self.fall_start

            # ยังสะสม streak ไม่พอ
            if self.fall_start is not None:
                return now - self.fall_start # อยู่ใน fall state อยู่แล้ว
            return 0.0

        else:
            self._fall_streak = 0            # ยกเลิก fall streak

            if self.fall_start is None:
                return 0.0                   # ยังไม่เคยล้ม

            self._non_fall_streak += 1
            if self._non_fall_streak >= RESET_REQUIRED_NON_FALL:
                self.reset()                 # ลุกแล้ว reset
                return 0.0

            # grace period → คืน duration สะสม
            return now - self.fall_start

    def reset(self):
        self.fall_start       = None
        self._fall_streak     = 0
        self._non_fall_streak = 0


def classify_severity(duration_sec: float) -> str:
    """กำหนดระดับ A/B/C จาก duration บนพื้น (Rule-based)"""
    if duration_sec < LEVEL_A_MAX:
        return "A"
    elif duration_sec < LEVEL_B_MAX:
        return "B"
    else:
        return "C"


# singleton tracker — ใช้ร่วมกันทุก request (stateful)
_tracker = FallStateTracker()


# =================== Predict ===================
def run_model(features: list) -> dict:
    """
    Input  : features list (seq_len, 416) — windows จาก CSI
    Output : prediction dict
    """
    arr = np.array(features, dtype=np.float32)  # (n_windows, 416)

    # Pad หรือ trim ให้ได้ SEQUENCE_LEN
    if arr.shape[0] < SEQUENCE_LEN:
        pad = np.zeros((SEQUENCE_LEN - arr.shape[0], N_FEATURES), dtype=np.float32)
        arr = np.vstack([pad, arr])
    arr = arr[-SEQUENCE_LEN:]  # (SEQUENCE_LEN, 416)

    # Normalize
    arr_2d = arr.reshape(-1, N_FEATURES)
    arr_2d = _scaler.transform(arr_2d)
    arr    = arr_2d.reshape(1, SEQUENCE_LEN, N_FEATURES)  # (1, 10, 416)

    # LSTM predict → binary
    probs        = _model.predict(arr, verbose=0)[0]  # (2,)
    label_id     = int(np.argmax(probs))
    prediction   = LABEL_NAMES[label_id]
    confidence   = float(probs[label_id])
    lstm_is_fall = (prediction == "fall") and (confidence >= FALL_THRESHOLD)

    # Rule-based severity (ใช้ duration จาก tracker เป็นหลัก ไม่ใช่ raw LSTM)
    duration     = _tracker.update(lstm_is_fall)
    is_on_floor  = duration > 0          # สถานะจริง: ยังอยู่บนพื้นหรือเปล่า
    fall_level   = classify_severity(duration) if is_on_floor else None
    risk_score   = RISK_SCORES[fall_level]
    alert        = ALERT_MESSAGES[fall_level]

    return {
        "is_fall":           is_on_floor,
        "confidence":        round(confidence, 4),
        "fall_level":        fall_level,
        "risk_score":        risk_score,
        "duration_on_floor": round(duration, 1),
        "alert":             alert,
        "probabilities": {
            name: round(float(probs[i]), 4)
            for i, name in enumerate(LABEL_NAMES)
        },
    }
