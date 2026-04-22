# Fall Detection System — Slide Outline (Plan)

---

## Slide 1: สรุปสถานะปัจจุบัน

- LSTM v3 → accuracy 97.9% บน test set แต่ real-time ใช้ไม่ได้
- ปัญหาหลัก:
  - Training data ไม่ตรงกับ real-time (sequence mismatch, trimmed fall data)
  - ไม่มี class "ห้องว่าง"
  - Buffer ใหญ่เกินไป fall ถูกกลบ
- บทเรียน: accuracy สูงไม่ได้แปลว่า deploy ได้จริง

---

## Slide 2: แผนเก็บ Data ใหม่ (Real-time Collection)

### วิธีเก็บ
- เก็บจาก ESP32 โดยตรง แบบ real-time (ไม่ใช่จาก CSV เหมือนเดิม)
- ทำท่าจริงหน้า ESP32 → กด Enter เก็บทีละ sample

### ท่าที่เก็บ (11 ท่า, 450 samples)

| ประเภท | ท่า | จำนวน |
|---|---|---|
| Fall | ล้มหน้า, ล้มหลัง, ล้มข้าง, ล้มทรุดตัว, ล้มสะดุด | 5 × 40 = 200 |
| Non-fall | ยืนนิ่ง, เดิน, นั่ง-ลุก, ก้มหยิบของ, ห้องว่าง, เดินเร็ว-วิ่ง | 250 |

### Variation ที่จะทำ (ตามที่ mentor แนะนำ)
- ระยะ: ใกล้ / ไกล ESP32 (1-3m)
- ความสูง: วาง ESP32 สูง / ต่ำ
- ทิศทาง: หันหน้า / หันข้าง / หันหลัง
- ความเร็ว: เร็ว / ปกติ / ช้า

### แก้ปัญหาเดิม
- ✅ เก็บ real-time → train/inference distribution ตรงกัน
- ✅ มีท่า "ห้องว่าง" → model รู้จักตอนไม่มีคน
- ✅ Fall มี transition (ปกติ→ล้ม→นอน) ไม่ใช่ trim เหลือแค่ช่วงล้ม

---

## Slide 3: แผน Train 3 Models เปรียบเทียบ

### เก็บ data ครั้งเดียว → train 3 models

```
collect_realtime.py
  ├── X_rt.npy (N, 416)         → RF / One-Class
  └── X_rt_seq.npy (N, 10, 416) → LSTM
```

### Model 1: Random Forest
- Input: 1 window (200 pkts) → 416 features
- จุดเด่น: เร็ว, ไม่มีปัญหา buffer กลบ
- Classify ทีละ window → ตอบสนองไว

### Model 2: One-Class (SVM / Isolation Forest)
- เรียนรู้แค่ "ปกติ" → อะไรผิดปกติ = fall
- จุดเด่น: ตรวจจับท่าล้มที่ไม่เคยเห็นได้ (unseen fall)
- เหมาะกับ production → ไม่ต้องมี fall data ทุกรูปแบบ

### Model 3: LSTM (Real-time Retrain)
- Input: 10 windows ต่อเนื่อง → sequence (10, 416)
- จุดเด่น: เห็น pattern ก่อน-ระหว่าง-หลังล้ม
- ยังมีความเสี่ยงปัญหา buffer กลบ → ใช้เป็นตัวเปรียบเทียบ

### ตารางเปรียบเทียบ

| | RF | One-Class | LSTM |
|---|---|---|---|
| Input | 1 window | 1 window | 10 windows |
| ตรวจจับ unseen fall | ❌ | ✅ | ❌ |
| ปัญหา buffer กลบ | ❌ ไม่มี | ❌ ไม่มี | ⚠️ มี |
| ความเร็ว inference | เร็วมาก | เร็ว | ช้ากว่า |

---

## Slide 4: แผน Unseen Test

### แยก data ออกเป็น 2 ชุด
- **Training set** — เก็บจากคนเดียว ท่ามาตรฐาน
- **Unseen test set** — เก็บแยก ไม่ใช้ train

### Unseen scenarios ที่จะทดสอบ
- ท่าล้มที่ไม่เคย train (เช่น ล้มขณะถือของ, ล้มจากเก้าอี้)
- คนอื่นทำท่า (ไม่ใช่คนที่ train)
- ESP32 วางตำแหน่งใหม่ (สูงกว่า/ต่ำกว่าปกติ)
- กิจกรรมที่คล้ายล้ม (นั่งลงเร็วๆ, ก้มหยิบของ, นอนลง)

### เกณฑ์ตัดสิน
- Fall Recall ≥ 90% (ตรวจจับล้มได้)
- False Alarm ≤ 10% (ไม่แจ้งเตือนมัว)

---

## Slide 5: แผน Demo (คลิปวิดีโอ)

### สิ่งที่จะแสดง
1. Setup — ESP32 2 ตัว + Mac + หน้าจอ terminal
2. ทำท่า non-fall (เดิน, ยืน, นั่ง) → model ตอบ "non_fall"
3. ทำท่า fall → model ตอบ "fall" + confidence score
4. แสดง alert flow (notification → SMS/call)

### Format
- แบ่งจอ: กล้องถ่ายตัวเอง + หน้าจอ terminal แสดงผล predict
- ใส่ timestamp ให้เห็นว่า detect เร็วแค่ไหน

---

## Slide 6: Timeline

| สัปดาห์ | งาน |
|---|---|
| 1 | เก็บ data ใหม่ 450 samples (variation ระยะ/ความสูง/ทิศทาง) |
| 2 | Train 3 models + เปรียบเทียบผล |
| 2 | เก็บ unseen test data + ทดสอบ |
| 3 | ถ่ายคลิป demo + เตรียมสไลด์ผลลัพธ์ |
| 3 | นำเสนอ |
