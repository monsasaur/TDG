# สถานะรอบเก็บ dataset ใหม่ — ถึงไหนแล้ว

**อัปเดตล่าสุด:** 2026-09-06 · **สถานะ: โค้ดพร้อมหมด รอลงมือเก็บ**

---

## ตัดสินใจไปแล้ว

| เรื่อง | สรุป |
|---|---|
| จำนวน | **396 รอบ ครั้งเดียวรวด** = 792 ไฟล์ (fall 99/ท่า · non_fall 66/ท่า) ≈ 99% ของชุดเดิม |
| Environment | **ห้องเดียว สภาพ ideal** — เรื่อง unseen/หลายห้อง เลื่อนไว้ก่อนโดยตั้งใจ |
| ทางรับข้อมูล | **UDP** (เพราะต้องไล่สายอยู่ดี) — serial ยังใช้ได้เป็น fallback |
| ท่า | 10 ท่า (4 fall + 6 non_fall) · **เพิ่ม "ห้องว่าง"** ที่ชุดเดิมไม่มี |
| ความยาวคลิป | ~12 วิ (900 pkt) + **มาร์คจุดล้ม** → ออกได้ 2 dataset จาก raw ชุดเดียว |
| โมเดลที่จะเทรน | **RandomForest** (`rf_v2`) ไม่ใช่ LSTM — มีหลักฐานแล้วว่า LSTM แพ้ทุกแบบ |

---

## โค้ดที่แก้/เขียนไว้แล้ว (ยังไม่ commit)

| ไฟล์ | ทำอะไร | ทดสอบ |
|---|---|---|
| `data_collection/csi_collector_serial.py` | serial + UDP · มาร์คจุดล้ม · กรอง MAC · วัดอัตรา · ท่าห้องว่าง | ✅ ครบ |
| `data_collection/esp_checker.py` | รองรับ UDP · แก้บั๊กวัดอัตราผิด · เกณฑ์ 73/41 | ✅ |
| `notebooks/preprocess_v3.py` **(ใหม่)** | แตก raw → dataset A (framed) + B (continuous) | ✅ 6 เคส |
| `experiments/eval_harness.py` | รองรับ env `CSI_DATA_DIR` | ✅ |
| `ESP32-CSI-Tool/_components/csi_component.h` | ส่ง UDP · แก้บั๊ก bind STA · broadcast | ❌ ยังไม่ compile |
| `ESP32-CSI-Tool/active_ap/main/Kconfig.projbuild` | + `SEND_CSI_TO_UDP`, `CSI_UDP_TARGET_IP` | ❌ |
| `docs/reports/collect_runbook.md` **(ใหม่)** | คู่มือเก็บ + checklist | — |

ทดสอบออฟไลน์ด้วย UDP ปลอม + CSI จริง ผ่านหมด: มาร์คตรงกับ index ใน CSV ·
กรอง MAC ได้ · เตือนล้มเร็ว/ไฟล์สั้น/อัตราต่ำ · แยก 2 session ถูก

---

## ⛔ ติดอยู่ 1 อย่าง

**ต้อง `idf.py build && flash`** เปิด `CONFIG_SEND_CSI_TO_UDP` ก่อนใช้โหมด UDP ได้
เครื่องที่เขียนโค้ดไม่มี ESP-IDF — ต้องมีคนช่วย build

> ถ้าไม่อยากรอ **เก็บด้วย serial ไปก่อนได้เลย** โค้ด Python รองรับทั้งสองทางแล้ว

---

## ขั้นตอนตอนกลับมาเก็บ

```bash
cd fall_detection_backend/ml_service && source venv/bin/activate
pip install pyserial

CSI_TRANSPORT=udp python data_collection/esp_checker.py
CSI_TRANSPORT=udp python data_collection/csi_collector_serial.py   # กด s → ใส่ 12 (ลองก่อน)
python notebooks/preprocess_v3.py                                  # ไฟล์ fall ต้องได้ A=3 ทุกไฟล์
```

ผ่าน → ลบไฟล์ทดลอง แล้วใส่ **396** เก็บจริง (~4.8 ชม.)
รายละเอียดทั้งหมดอยู่ใน [`collect_runbook.md`](collect_runbook.md)

---

## ข้อเท็จจริงที่เพิ่งค้นพบรอบนี้ (แก้เอกสารไปแล้ว)

1. **อัตรา CSI จริง = 73.2 pkt/s ไม่ใช่ 100** — วัดจาก `field[18] local_timestamp` ของ ESP32
   (timestamp ที่ Python เขียนเชื่อไม่ได้ ให้ค่าปลอมสูงกว่าจริง 3 เท่า)
2. **ชุดเดิมคลิปยาว ~12 วิ อยู่แล้ว** (median 865 pkt) ไม่ใช่ 400 pkt ตามที่ CLAUDE.md เขียน
   → สิ่งที่ทำให้ใช้กับ real-time ไม่ได้คือ **การ trim ตอน preprocess** ไม่ใช่ความยาวคลิป
3. **`preprocess_v2.py` ใช้กับข้อมูลใหม่ไม่ได้** — ตัด 300 pkt แรก = 4.1 วิแรก ซึ่งในโปรโตคอลใหม่
   คือช่วงยืนนิ่งก่อนล้ม → ต้องใช้ `preprocess_v3.py`
4. **LSTM v3 ไม่ได้ถูกใช้งานจริง** — `app/predict.py` hardcode `rf_v1.pkl` (RandomForest)
   และไม่อ่าน `MODEL_PATH` จาก .env
5. **window อิงเวลา (resample) — ทดลองแล้วไม่ช่วย** ช่องว่างข้ามอัตรา 1.8 → 2.0 จุด
   ไม่แคบลง · ผลของอัตราที่ไม่คงที่อยู่ที่ ~2 จุด ซึ่งเล็กกว่า session confound (23 จุด) มาก
6. **firmware ไม่กรอง MAC** — production (AP+STA) จะรับ beacon จากเราเตอร์บ้านมาปนใน feature
   (ฝั่ง collector แก้แล้ว ฝั่ง firmware ยังไม่ได้)

---

## งานค้างที่ยังไม่ทำ (ไม่ด่วน)

- [ ] commit ไฟล์ทั้งหมด (13 modified + 4 untracked)
- [ ] `app/preprocess.py` — ตรวจอัตราตอน serving ถ้าหลุดช่วงให้ log/ลดความเชื่อมั่น
- [ ] `app/predict.py` — เปลี่ยน `FALL_THRESHOLD` 0.55 → 0.36 ตามที่ tuning แนะนำ
- [ ] สคริปต์ replay — จำลอง real-time จากคลิปยาว หา debounce/threshold ที่ถูก
      (`csi_streamer.py` ตั้ง `FALL_CONFIRM=5` ซึ่งน่าจะยิงไม่ออก — ยังไม่ยืนยัน)
- [ ] เขียนสคริปต์เทรน `rf_v2` (ตัวที่สร้าง `rf_v1` ไม่อยู่ในรีโป)
