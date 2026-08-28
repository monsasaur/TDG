# Admin Client — แผนฟีเจอร์ (Phase 2)

**สถานะ:** แนวคิด — ยังไม่ implement
**วันที่:** 2026-08-28

## จุดประสงค์

Client ฝั่ง admin แยกจากแอปผู้ดูแล (มือถือ) — ใช้โดยทีมงาน/เจ้าของระบบ เพื่อดูภาพรวมทุกอุปกรณ์/ทุกบ้าน, ดีบัก, และติดตามค่าใช้จ่ายในการดำเนินระบบ

---

## ฟีเจอร์ — เรียงตาม priority

### ต้องมี

| ฟีเจอร์ | รายละเอียด |
|---|---|
| Dashboard ภาพรวม | จำนวนอุปกรณ์ทั้งหมด, online/offline, fall event วันนี้/สัปดาห์นี้, escalation rate |
| Event log (ทุกอุปกรณ์) | ต่างจากแอปผู้ดูแลที่เห็นแค่บ้านตัวเอง — admin เห็นทุก device_id filter ตามวันที่/สถานะ (acknowledged / escalated / pending) |
| Device management | list ESP32 แต่ละตัว, device_id, บ้าน/ผู้ใช้ที่ผูกไว้, last seen, สถานะ |

### ควรมี

| ฟีเจอร์ | รายละเอียด |
|---|---|
| Manual demo trigger | ยิง `POST /api/v1/demo/fire` ผ่าน UI แทน curl/Postman |
| Alert / Twilio log | ดูว่า SMS/Call ส่งไปกี่ครั้ง สำเร็จ/fail — ไว้ debug ตอน Twilio มีปัญหา |
| Threshold config | ปรับ `ACK_TIMEOUT_SECONDS`, `COOLDOWN_SECONDS`, threshold โมเดล ผ่าน UI แทนแก้ `.env` แล้ว restart |
| **Cost Tracking** | ดูรายละเอียดด้านล่าง |

### ทำทีหลังก็ได้

- User/caregiver management (จัดการ push token, ผูก/ลบอุปกรณ์)
- Auth สำหรับ admin แยกจาก API key ที่ใช้ร่วมกันตอนนี้
- Export event log เป็น CSV

---

## Cost Tracking — สเปกละเอียด

**หลักการคำนวณ:** คำนวณเองจากจำนวนครั้งที่ยิงจริง (นับจาก DB) **คูณราคาคงที่ที่ตั้งไว้เอง** — ไม่ดึงจาก Twilio Billing API (เกิน scope ที่จำเป็น ง่ายกว่ามากสำหรับโปรเจกต์นี้)

### รายการที่ต้องนับ

| รายการ | วิธีนับ | ที่มาราคา |
|---|---|---|
| Twilio SMS | นับจำนวนครั้งที่ `sendSms()` สำเร็จ (`sms_sent = true` ใน `fall_events`) | ราคาคงที่/ข้อความ ตั้งเป็น constant ในโค้ด (เช่น `TWILIO_SMS_COST = 0.xx` บาท) |
| Twilio Voice Call | นับจำนวนครั้งที่ `makeCall()` สำเร็จ (`call_made = true`) | ราคาคงที่/นาที (ประมาณความยาวคงที่ เช่น 30 วิ/สาย) |
| AI agent (เผื่อ Phase 2a/2b) | นับจำนวนครั้งที่เรียก AI voice agent สำเร็จ | ราคาคงที่/ครั้ง (รวม LLM + TTS โดยประมาณ) |
| Infra (hosting, Supabase) | ค่าคงที่รายเดือน กรอกเอง ไม่ auto-calculate | manual input ในหน้า config |

### สิ่งที่ต้องเพิ่มใน backend

- ตั้ง cost constant ไว้ใน `.env` หรือไฟล์ config เดียว (เช่น `SMS_COST_THB`, `CALL_COST_PER_MIN_THB`) แก้ราคาได้โดยไม่ต้องแก้โค้ด
- Endpoint ใหม่ เช่น `GET /api/v1/admin/costs?range=daily|monthly` — query จาก `fall_events` (นับ `sms_sent`/`call_made` group by วันที่) แล้วคูณราคา ส่งกลับเป็น time series
- ไม่ต้องมีตารางใหม่ในฐานข้อมูล — คำนวณจาก field ที่มีอยู่แล้ว (`sms_sent`, `call_made`, `created_at`) ได้เลย

### UI

- **กราฟแนวโน้มค่าใช้จ่ายรายวัน/รายเดือน** (ยืนยันแล้วว่าต้องการ) — line/bar chart แยกสี SMS vs Call vs AI (ถ้ามี)
- การ์ดสรุปตัวเลขรวมด้านบนกราฟ: "เดือนนี้ใช้ไปแล้ว X บาท"
- Toggle สลับมุมมองรายวัน ↔ รายเดือน

---

## Tech stack ที่แนะนำ

- Frontend: React (Vite) หรือ Next.js เป็น web app แยกต่างหาก ไม่ต้องรวมกับ Expo app — เพราะ admin ใช้บนคอมพิวเตอร์เป็นหลัก ไม่ต้องเป็น mobile
- Chart library: Recharts (เบา, เข้ากับ React ง่าย, ทำ line/bar chart ได้ตรงตามที่ต้องการ)
- เรียก Express API เดิมที่มีอยู่แล้ว เพิ่มแค่ endpoint กลุ่ม `/api/v1/admin/*`

## คำถามที่ยังไม่ปิด

- ราคา SMS/Call ต่อครั้งตั้งเท่าไหร่ (ต้องเช็คราคาจริงจาก Twilio pricing page ตามประเทศ/เบอร์ที่ใช้)
- Admin auth จะทำแบบง่าย (username/password คงที่) หรือรอทำเต็มรูปแบบทีหลัง
