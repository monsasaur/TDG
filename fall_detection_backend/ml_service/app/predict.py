"""
predict.py
==========
Random Forest fall detection — classify ทีละ 1 window (416 features)
ไม่ต้องใช้ sequence เหมือน LSTM → เหมาะกับ real-time

Label mapping (จาก preprocess_v2): 0=fall, 1=non_fall

Output: {
    "prediction"  : "fall" | "no_fall"
    "confidence"  : float 0-1
    "is_fall"     : bool
}
"""

import os
import pickle
import numpy as np

# =================== Path ===================
BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH  = os.path.join(BASE_DIR, "models", "rf_v1.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler_rf_v1.pkl")

# =================== Config ===================
# preprocess_v2 label map: 0=fall, 1=non_fall
# แต่ model จริง output proba[0] สูง = ไม่ล้ม → สลับ
LABEL_NAMES    = ["non_fall", "fall"]
N_FEATURES     = 416
FALL_THRESHOLD  = 0.55

# =================== Load model ===================
print(f"🔄 กำลังโหลด RF model จาก {MODEL_PATH}")
with open(MODEL_PATH, "rb") as f:
    _model = pickle.load(f)
print("✅ โหลด model สำเร็จ")

with open(SCALER_PATH, "rb") as f:
    _scaler = pickle.load(f)
print("✅ โหลด scaler สำเร็จ")


# =================== Predict ===================
def run_model(features: list) -> dict:
    """
    Input  : features — list of list (sequence_len, 416)
             ใช้แค่ window สุดท้าย (ตัวล่าสุด)
    Output : prediction dict
    """
    # ใช้ window สุดท้าย
    arr = np.array(features[-1], dtype=np.float32).reshape(1, N_FEATURES)

    # Normalize
    arr_scaled = _scaler.transform(arr)

    # Predict
    proba   = _model.predict_proba(arr_scaled)[0]
    # proba[0] = class 0 (fall), proba[1] = class 1 (non_fall)
    fall_prob    = float(proba[0])
    nf_prob      = float(proba[1])
    is_fall      = fall_prob >= FALL_THRESHOLD

    # Debug
    print(f"  [DEBUG] non_fall={nf_prob:.4f}  fall={fall_prob:.4f} → {'FALL' if is_fall else 'ปกติ'}")

    return {
        "prediction": "fall" if is_fall else "no_fall",
        "confidence": round(fall_prob if is_fall else nf_prob, 4),
        "is_fall":    is_fall,
    }
