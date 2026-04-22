# Fall Detection — ปัญหาที่เจอและวิธีแก้

## 1. LSTM Model ไม่ Detect Fall ใน Real-time (stride=50)

**อาการ:** Model ให้ fall_prob ~0.004 ตลอด แม้ล้มจริง

**สาเหตุ:** Buffer ใหญ่เกินไป (650 packets) — ข้อมูล fall ที่เข้ามาใหม่ถูก non_fall เก่ากลบ เพราะ sliding window เลื่อนช้า 10 windows ซ้อนกันมาก

**วิธีแก้ (ชั่วคราว):** ลด stride จาก 50 → 25 หรือ 10 ให้ buffer เล็กลง

**ผลลัพธ์:** Detect ได้บ้าง แต่เกิดปัญหาใหม่ (ดูข้อ 2)

---

## 2. ลด Stride แล้ว False Positive สูง

**อาการ:** stride=25 หรือ 10 ทำให้ model ตรวจจับ fall ได้ แต่ก็แจ้ง fall มั่วด้วย (ไม่มีคนก็แจ้ง)

**สาเหตุ:** stride ตอน inference ไม่ตรงกับตอน train (stride=50) ทำให้ windows ซ้ำกันมาก feature distribution เปลี่ยน model จึงให้ผลไม่เสถียร

**วิธีแก้:** เพิ่ม debounce logic (ต้อง FALL ติดกัน N ครั้ง) แต่ไม่ได้แก้ต้นเหตุ

---

## 3. Training vs Real-time Sequence Mismatch (ปัญหาหลัก LSTM)

**อาการ:** Model มี 99% accuracy บน test set แต่ใช้งาน real-time ไม่ได้เลย

**สาเหตุ:**
- **Training:** `build_sequences()` สร้าง sequence 10 windows จาก **ข้ามไฟล์** (ต่าง recording) → แต่ละ window เป็นอิสระ
- **Real-time:** 10 windows มาจาก **buffer เดียวกัน** ซ้อนกัน (overlap 75%) → correlated สูง
- Model เรียนรู้ pattern จาก cross-file sequences ซึ่งไม่มีใน real-time

**บทเรียน:** Test accuracy สูงไม่ได้หมายความว่าจะ generalize ถ้า train/inference data distribution ต่างกัน

---

## 4. Training Data Trimming ทำให้ Model เห็นแต่ Fall ล้วน

**อาการ:** Window 200 packets ตอน train เต็มไปด้วย fall motion แต่ตอน real-time fall เกิดแค่ ~0.5-1 วิ ใน window 2 วิ

**สาเหตุ:** `preprocess_v2.py` ตัด (trim) fall data เหลือ 300 packets (3 วินาที) ที่เป็น **fall ล้วน** → window 200 packets จึงมีแต่ fall motion ทั้งหมด แต่ real-time window มี fall แค่ส่วนเล็กๆ ปนกับ non-fall

**บทเรียน:** ควร train ด้วย data ที่มี transition (ปกติ → ล้ม → นอนบนพื้น) ไม่ใช่ trim เหลือแค่ช่วงล้ม

---

## 5. Model Label สลับ

**อาการ:** ไม่มีคนแต่ model ให้ fall=99.96% ตลอด

**สาเหตุ:** `lstm_v3_binary_99acc.h5` ถูก train ด้วย label mapping ที่ต่างจาก code — code ใช้ `LABEL_NAMES = ["fall", "non_fall"]` (index 0 = fall) แต่ model จริง index 0 = non_fall

**วิธีแก้:** สลับ LABEL_NAMES เป็น `["non_fall", "fall"]`

**บทเรียน:** ควรบันทึก label mapping ไว้กับ model เสมอ (เช่นใน metadata JSON) ไม่ควร hardcode

---

## 6. Model ไม่เคยเห็น "ห้องว่าง"

**อาการ:** ไม่มีคนอยู่หน้า ESP32 แต่ model แจ้ง fall

**สาเหตุ:** Training data มีแค่ 2 สถานการณ์: fall (มีคนล้ม) กับ non_fall (มีคนเดิน/ยืน/ก้ม) — **ไม่มี class "ห้องว่าง"** ทำให้ CSI pattern ตอนไม่มีคน (signal นิ่ง) ถูก classify เป็น fall (เพราะ fall ตอนนอนนิ่งก็ signal นิ่งเหมือนกัน)

**วิธีแก้:** เก็บ data เพิ่มสำหรับ "ห้องว่าง/ไม่มีคน" เป็น non_fall แล้ว retrain

---

## 7. Model + Scaler ไม่ตรงกัน

**อาการ:** ผล predict ผิดปกติ

**สาเหตุ:** ใช้ model file หนึ่ง (`lstm_v3_binary_99acc.h5`) กับ scaler อีกไฟล์ (`scaler_v3.pkl`) ที่อาจ train คนละรอบ — notebook save model เป็น `lstm_v3.h5` แต่ไฟล์ถูก rename ทีหลัง

**วิธีแก้:** ตรวจสอบ `rf.classes_` และเทียบ feature stats ก่อน/หลัง scaling กับ training data:
```
Training:  RAW mean=6.53  std=11.36
Real-time: RAW mean=6.81  std=11.79  ← ใกล้กัน = scaler ถูกต้อง
```

**บทเรียน:** ควร save model + scaler + metadata เป็นชุดเดียวกัน ตั้งชื่อ version ให้ตรง

---

## 8. Port 8000 Already in Use

**อาการ:** `ERROR: [Errno 48] Address already in use`

**วิธีแก้:**
```bash
lsof -ti:8000 | xargs kill
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

---

## แนวทางแก้ปัจจุบัน

เปลี่ยนจาก LSTM → **Random Forest** classify ทีละ 1 window (ไม่ต้องใช้ sequence) และเก็บ real-time data ใหม่ด้วย `collect_realtime.py` แล้ว retrain ด้วย `retrain_rf.py`

### ขั้นตอน:
```bash
# 1. เก็บ data ใหม่ (ต้องมี fall + non_fall + ห้องว่าง)
python data_collection/collect_realtime.py

# 2. Retrain
python data_collection/retrain_rf.py

# 3. รีสตาร์ท ML Service
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 4. ทดสอบ
python data_collection/csi_streamer.py
```
