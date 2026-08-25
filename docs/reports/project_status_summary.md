# สรุปสถานะโครงการ: Fall Detection System

**วันที่:** 2026-08-25

---

## 1. Project Scope (MVP) จาก Phase 1

**เป้าหมาย:** ระบบตรวจจับการล้ม (Fall Detection) ด้วย WiFi CSI (Channel State Information) ร่วมกับโมเดล LSTM สำหรับผู้สูงอายุ — ไม่ใช้กล้อง ไม่ต้องสวมใส่อุปกรณ์ (wearable) ใดๆ

**ขอบเขตของ MVP ประกอบด้วย:**

- **Hardware:** ESP32 สองตัว (AP + STA) ทำหน้าที่วัดค่า CSI ผ่าน USB Serial
- **ML:** โมเดล LSTM แยกประเภท fall vs non-fall
- **Backend:** Express API เชื่อมต่อ ML service, ฐานข้อมูล, และระบบแจ้งเตือน
- **Mobile App (Expo):** แสดงสถานะอุปกรณ์, event log, และรับ push notification
- **Alert Flow:** แจ้งเตือนผ่านแอปก่อน → หากไม่มีผู้ดูแลกด Acknowledge ภายในเวลาที่กำหนด → escalate ไปยัง Twilio (โทร/SMS ฉุกเฉิน)

**หมายเหตุ:** ในช่วงเตรียมพร้อมสำหรับ showcase ต่ออาจารย์ ทีมได้ปรับลำดับความสำคัญให้ทำ **app flow และ mock data ให้ทำงานได้ครบก่อน** ส่วนการ tune โมเดลให้แม่นยำขึ้นถูกเลื่อนออกไปเป็นลำดับถัดไป

---

## 2. Final Result / Prototype (สถานะปัจจุบัน)

| ส่วน | สถานะ | ผลลัพธ์ |
|---|---|---|
| LSTM v3 model | ✅ | Accuracy 97.9%, Fall Recall 98.5% |
| Express API (core) | ✅ | endpoint predict / events / alert ใช้งานได้ |
| Push Notification | ✅ | FCM V1 ผ่าน Expo SDK ยิงจริงได้ |
| Escalation / Acknowledge flow | ✅ | timer ทำงาน (in-memory) พร้อม fallback โทร Twilio |
| Mobile App (Expo) | ✅ | รับ push notification, ดู event log, กด acknowledge ได้ |
| Supabase Schema | ✅ | ตาราง `fall_events` และ `push_tokens` ใช้งานจริง |
| ESP32 USB Serial Mode | ✅ | เก็บข้อมูล CSI ที่ 921600 baud เสถียร |
| **End-to-end demo flow** | ✅ | ESP32 → API → Push → App → Acknowledge → Twilio ครบวงจร |

**สรุป:** Prototype สามารถสาธิตการทำงานได้ครบทั้ง flow แล้ว ตั้งแต่การตรวจจับการล้มไปจนถึงการแจ้งเตือนและ escalate ไปยังเบอร์ฉุกเฉินจริง พร้อมสำหรับการนำเสนอ

---

## 3. Plan Phase 2 (งานที่ยังค้าง)

| งาน | Priority | รายละเอียด |
|---|---|---|
| Threshold tuning | **High** | หาค่า threshold ที่เหมาะสมจาก ROC curve แทนการใช้ default softmax |
| Escalation timer persistence | Med | ย้ายจาก in-memory เป็น Redis/BullMQ เพื่อป้องกัน timer หายเมื่อ server restart |
| BLE WiFi Provisioning | Med | ให้ลูกค้าตั้งค่า WiFi ผ่านแอปได้เอง โดยไม่ต้อง hardcode SSID/รหัสผ่าน |
| One-class anomaly model | Low | ตามคำแนะนำของ mentor — ยังไม่เริ่มดำเนินการ |
| Unseen test scenario | Low | แยกชุดข้อมูลทดสอบจากสถานการณ์จริง (ไม่ overlap กับข้อมูลฝึกโมเดล) |
| Production Cloud Deploy | Low | เปลี่ยน API URL ใน `lib/api.ts` จาก localhost เป็น Render URL |

**เพิ่มเติมจาก feedback ของ mentor รอบก่อน (ยังไม่ได้ดำเนินการ):**
- Unseen test set
- One-class anomaly model
- Video demo
- Realistic dataset (ข้อมูลจากสถานการณ์จริงมากขึ้น)

งานกลุ่มนี้ควรเป็นแกนหลักของแผนงาน Phase 2 และเนื้อหารายงานในลำดับถัดไป
