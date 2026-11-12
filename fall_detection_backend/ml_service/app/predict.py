"""
predict.py
==========
Random Forest fall detection — classify ทีละ 1 window
- rf_v1 (ค่าเริ่มต้น): 416 features จาก preprocess_v2
- rf_v2_event (FALL_MODEL=rf_v2_event): 20 features จาก app/event_features.stream_feature_vector
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

# =================== เลือกโมเดล ===================
# FALL_MODEL=rf_v1 (ค่าเริ่มต้น · ตัวเดิม · 416 ค่า/window จาก preprocess_v2)
# FALL_MODEL=rf_v2_event (ตรวจแบบดูต่อเนื่อง · 20 ค่าจาก app/event_features.stream_feature_vector
#                         · ส่งมาจาก data_collection/fall_monitor.py · เทรนด้วย experiments/train_rf_v2.py)
# FALL_THRESHOLD แก้ทับ threshold ของ rf_v2_event ได้ (rf_v1 ใช้ 0.55 คงที่ตามเดิม)
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FALL_MODEL = os.getenv("FALL_MODEL", "rf_v1").strip()
if FALL_MODEL not in ("rf_v1", "rf_v2_event"):
    raise RuntimeError(f"FALL_MODEL={FALL_MODEL!r} ไม่รู้จัก — ใช้ rf_v1 หรือ rf_v2_event")

if FALL_MODEL == "rf_v2_event":
    MODEL_PATH = os.path.join(BASE_DIR, "models", "rf_v2_event.pkl")
    print(f"🔄 กำลังโหลด {FALL_MODEL} จาก {MODEL_PATH}")
    with open(MODEL_PATH, "rb") as f:
        _bundle = pickle.load(f)
    _model, _scaler = _bundle["model"], None
    N_FEATURES     = len(_bundle["keys"])
    FALL_THRESHOLD = float(os.getenv("FALL_THRESHOLD", _bundle["threshold"]))
    FALL_CLASS     = list(_model.classes_).index(1)          # train_rf_v2: 1 = fall
    MODEL_NAME     = _bundle["model_name"]
    MODEL_VERSION  = _bundle["version"]
    print(f"✅ โหลด model สำเร็จ · {N_FEATURES} feature · threshold {FALL_THRESHOLD}")
else:
    MODEL_PATH  = os.path.join(BASE_DIR, "models", "rf_v1.pkl")
    SCALER_PATH = os.path.join(BASE_DIR, "models", "scaler_rf_v1.pkl")
    # preprocess_v2 label map: 0=fall, 1=non_fall
    # แต่ model จริง output proba[0] สูง = ไม่ล้ม → สลับ
    LABEL_NAMES    = ["non_fall", "fall"]
    N_FEATURES     = 416
    FALL_THRESHOLD = 0.55
    FALL_CLASS     = 0
    # ── ที่มาของการทำนาย — ส่งกลับไปให้ Express บันทึกลง fall_events ──────────
    # เพื่อให้ย้อนตรวจได้ว่าเหตุการณ์ไหนตัดสินด้วยโมเดลตัวไหน
    # **ต้องแก้ MODEL_VERSION ทุกครั้งที่เปลี่ยนไฟล์โมเดล** ไม่งั้นบันทึกจะโกหก
    MODEL_NAME     = "RandomForest"
    MODEL_VERSION  = os.path.splitext(os.path.basename(MODEL_PATH))[0]   # "rf_v1"

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
    last = features[-1]
    if len(last) != N_FEATURES:
        raise ValueError(f"{MODEL_VERSION} ต้องการ {N_FEATURES} ค่าต่อ window แต่ได้ {len(last)} "
                         f"(ตั้ง FALL_MODEL ให้ตรงกับตัวที่ส่งข้อมูลมาหรือยัง)")
    arr = np.array(last, dtype=np.float64 if _scaler is None else np.float32).reshape(1, N_FEATURES)

    # Normalize (rf_v1 เท่านั้น · rf_v2_event ไม่มี scaler)
    arr_scaled = arr if _scaler is None else _scaler.transform(arr)

    # Predict
    proba   = _model.predict_proba(arr_scaled)[0]
    # rf_v1: proba[0] = fall · rf_v2_event: proba[FALL_CLASS] = fall
    fall_prob    = float(proba[FALL_CLASS])
    nf_prob      = 1.0 - fall_prob
    is_fall      = fall_prob >= FALL_THRESHOLD

    # Debug
    print(f"  [DEBUG] non_fall={nf_prob:.4f}  fall={fall_prob:.4f} → {'FALL' if is_fall else 'ปกติ'}")

    return {
        "prediction": "fall" if is_fall else "no_fall",
        "confidence": round(fall_prob if is_fall else nf_prob, 4),
        "is_fall":    is_fall,
        # ── ข้อมูลกำกับ ────────────────────────────────────────────────
        "model_name":    MODEL_NAME,
        "model_version": MODEL_VERSION,
        # risk_score = ความน่าจะเป็นว่าล้ม เป็นเปอร์เซ็นต์เต็มจำนวน
        # ⚠️ ไม่ใช่ข้อมูลใหม่ — เป็น fall_prob ตัวเดิม ไม่ใช่ตัวชี้วัดอิสระ
        #    (ต่างจาก confidence ตรงที่ confidence คือความมั่นใจของ "คำตอบที่เลือก"
        #     เวลาไม่ล้มจะเป็นความมั่นใจว่าไม่ล้ม — risk_score ชี้ไปทาง fall เสมอ)
        "risk_score":    int(round(fall_prob * 100)),
    }
