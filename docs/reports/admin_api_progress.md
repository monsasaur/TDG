# Admin Client API — บันทึกความคืบหน้า

**อัปเดตล่าสุด:** 2026-09-01
**ขอบเขตรอบนี้:** Admin Client API (frontend มีคนทำแล้ว) + escalation timer persistence
**อ้างอิง:** `TDG_BA.pdf` (Business Analysis) · `docs/reports/admin_client_plan.md` (แผนเดิม)
**Branch:** `feature/ml-service`

---

## สรุปสถานะ

| ส่วน | สถานะ |
|---|:---:|
| ตาราง `devices` + schema | ✅ |
| Admin authentication (login/logout/session) | ✅ |
| `GET /admin/summary` | ✅ |
| `GET /admin/events` | ✅ |
| `GET /admin/events/:id` | ✅ |
| `GET /admin/devices` | ✅ |
| CORS สำหรับเว็บ admin | ✅ |
| Escalation timer persistence | ✅ |
| แก้ schema ที่ล้าสมัยใน `CLAUDE.md` | ✅ |
| Unit test (52 เคสใหม่ / 92 เคสรวม) | ✅ |
| ทดสอบ end-to-end จริง | ✅ |
| Cost tracking | 🔲 ไม่อยู่ใน MVP |
| Alert / Twilio log | 🔲 ไม่อยู่ใน MVP |

---

## ⚠️ ข้อสำคัญ: เอกสาร BA อ้างอิง schema ที่ล้าสมัย

`TDG_BA.pdf` ข้อ 12.2 ระบุว่าต้องแก้ฐานข้อมูล 3 จุด แต่เมื่อตรวจกับ `fall_detection_backend/supabase/schema.sql`
ตัวจริงแล้วพบว่า **2 ใน 3 จุดมีอยู่ครบแล้ว**

| ข้อ 12.2 | เอกสาร BA บอกว่า | ของจริงในโค้ด | ต้องทำไหม |
|---|---|---|:---:|
| จุดที่ 1 — ไม่มีที่เก็บสถานะเหตุการณ์ | มีแค่ `alerted` ต้องเพิ่ม `acknowledged_at`, `escalated_at` | มี `acknowledged`, `acknowledged_at`, `acknowledged_by`, `escalated`, `escalated_at` ครบ | ❌ ไม่ต้อง |
| จุดที่ 2 — ไม่มีตารางอุปกรณ์ | ต้องเพิ่มตาราง `devices` | ไม่มีจริง | ✅ **ทำแล้วรอบนี้** |
| จุดที่ 3 — ไม่มี `sms_sent` / `call_made` | ต้องเพิ่ม | มีทั้งคู่ และ `markEscalated()` เขียนค่าลงจริง (`escalationService.js:79`) | ❌ ไม่ต้อง |

**สาเหตุ:** ตาราง `fall_events` ในหัวข้อ "Database Schema" ของ `CLAUDE.md` เป็นเวอร์ชันเก่า (มี `alerted`,
`prediction`, `risk_score`) ไม่ตรงกับ `supabase/schema.sql` ที่ใช้จริง ผู้เขียนเอกสาร BA อ่านจาก `CLAUDE.md`

**สิ่งที่ต้องทำต่อ:** อัปเดตหัวข้อ Database Schema ใน `CLAUDE.md` ให้ตรงกับของจริง ไม่งั้นรอบหน้าจะเข้าใจผิดซ้ำ

---

## สิ่งที่ทำไปแล้ว

### 1. ตาราง `devices` — BA ข้อ 12.2 จุดที่ 2

เพิ่มใน `fall_detection_backend/supabase/schema.sql`

| ฟิลด์ | ชนิด | หมายเหตุ |
|---|---|---|
| `device_id` | TEXT PK | ตรงกับที่ ESP32 ส่งมา |
| `label` | TEXT | ชื่อที่คนอ่านเข้าใจ |
| `owner_name` | TEXT | บ้าน/ผู้ใช้ที่ผูกไว้ |
| `location` | TEXT | ตำแหน่งติดตั้ง |
| `last_seen_at` | TIMESTAMPTZ | เวลาที่ได้รับข้อมูลล่าสุด |
| `is_active` | BOOLEAN | BR-08 — ปลดการติดตั้งแล้วตั้ง false |
| `installed_at`, `created_at` | TIMESTAMPTZ | |

> **ต้องรัน SQL นี้ใน Supabase SQL Editor ก่อนใช้งานจริง** — ยังไม่ได้รัน

**จุดที่เอกสาร BA เตือนไว้ และทำตามแล้ว:** `last_seen_at` อัปเดตทุกครั้งที่มี packet เข้ามา
ไม่ใช่เฉพาะตอนตรวจพบการล้ม → `predict.js` เรียก `dbService.touchDevice(device_id)` เป็นขั้นแรกสุด
ก่อนเช็คว่าล้มหรือไม่ ถ้าอัปเดตเฉพาะตอนล้ม บ้านที่ปลอดภัยที่สุดจะถูกแสดงว่า offline

เรียกแบบ fire-and-forget (`.catch()` ไม่ `await`) ตาม NFR-10 — หน้า admin ต้องไม่ทำให้ path
ตรวจจับการล้มช้าลงหรือพัง

### 2. Admin authentication — SEC-01 ถึง SEC-09

`src/services/adminAuthService.js` + `src/middleware/adminAuth.js`

| ข้อกำหนด | ทำแล้วอย่างไร |
|---|---|
| SEC-01 แยกจาก API key ของ ESP32 | `Authorization: Bearer <token>` คนละชั้นกับ `x-api-key` |
| SEC-02 ห้ามวาง API key ในเบราว์เซอร์ | CORS อนุญาตเฉพาะ header `Content-Type,Authorization` — เบราว์เซอร์ยิง `x-api-key` ข้าม origin ไม่ได้เลย |
| SEC-03 ตรวจสิทธิ์ทุกเส้น | ทุก route ยกเว้น `/login` ผ่าน `adminAuth` middleware |
| SEC-04 เซสชันหมดอายุ | ไม่ได้ใช้งานเกิน `ADMIN_SESSION_HOURS` (default 8) → token ใช้ไม่ได้ |
| SEC-05 hash ทางเดียว | scrypt + salt (`crypto` ของ Node ไม่เพิ่ม dependency) |
| SEC-08 จำกัดการล็อกอินผิด | ผิดเกิน 5 ครั้งใน 15 นาที ต่อ (username + IP) → 429 |
| SEC-09 ไม่เปิดเผยโครงสร้างภายใน | ผิด username กับผิด password ตอบข้อความเดียวกัน · error ทุกเส้นตอบ `internal error` |

**ตั้งรหัสผ่าน:**
```bash
cd fall_detection_backend/express_api
node scripts/hash_admin_password.js 'รหัสผ่านที่ต้องการ'
# เอาผลลัพธ์ไปใส่ ADMIN_PASSWORD_HASH ใน .env
```

**ถ้ายังไม่ตั้ง `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` → ทุกเส้น admin ตอบ 503**
(fail closed — ไม่เปิดทิ้งไว้)

### 3. Endpoints — BA ข้อ 13.2 ครบทั้ง 6 เส้น

| Endpoint | รองรับ | หมายเหตุ |
|---|---|---|
| `POST /api/v1/admin/login` | FR-22 | `{ username, password }` → `{ token, expires_at }` |
| `POST /api/v1/admin/logout` | FR-23 | ยกเลิก token |
| `GET /api/v1/admin/summary` | FR-01→06 | ตัวเลข Dashboard ทั้งหมด |
| `GET /api/v1/admin/events` | FR-08→13 | query: `from`, `to`, `device_id`, `status`, `limit`, `offset` |
| `GET /api/v1/admin/events/:id` | FR-14 | พร้อม timeline การแจ้งเตือน |
| `GET /api/v1/admin/devices` | FR-16→21 | query: `status`, `include_inactive` |

### 4. กฎธุรกิจที่ implement ไว้

| รหัส | กฎ | ทำแล้วอย่างไร |
|---|---|---|
| BR-02 | เกณฑ์ online/offline | `DEVICE_OFFLINE_AFTER_MINUTES` (default 15) |
| BR-03/BR-04 | หนึ่งเหตุการณ์มีสถานะเดียว | `escalated` > `acknowledged` > `pending` คำนวณฝั่งเซิร์ฟเวอร์ |
| BR-05 | escalation rate | escalated ÷ เหตุการณ์ล้มทั้งหมดในช่วงเดียวกัน |
| BR-06 | เหตุการณ์ที่โดน cooldown ไม่นับเป็น escalated | ถูกต้องอยู่แล้ว — `predict.js` return ตั้งแต่เจอ cooldown โดยไม่ `saveEvent` เหตุการณ์พวกนั้นจึงไม่อยู่ใน DB ไม่ถูกนับทั้งตัวตั้งและตัวหาร |
| BR-07 | MVP อ่านอย่างเดียว | ไม่มีเส้นไหนเปลี่ยนสถานะ |
| BR-08 | อุปกรณ์ที่ปลดแล้วไม่นับรวม แต่เหตุการณ์เก่ายังค้นได้ | `listDevices()` กรอง `is_active` แต่ `fall_events` ไม่แตะ |
| NFR-08 | เวลาไทย | `thaiMidnight()` คำนวณเที่ยงคืน UTC+7 สำหรับ "วันนี้" |
| NFR-09 | คำนวณฝั่งเซิร์ฟเวอร์เท่านั้น | หน้าเว็บได้ `status`, `rate`, `online/offline` มาสำเร็จรูป |
| REP-07 | บอกช่วงเวลาที่ใช้คำนวณ | ทุก response มี `window` / `filters` |
| REP-08 | ไม่มีข้อมูลต้องบอกว่าไม่มี ไม่ใช่ 0 | ทุก response มี `has_data` · `escalation.rate` เป็น `null` เมื่อไม่มีตัวหาร |
| REP-09 | ระบุเวลาที่คำนวณล่าสุด | ทุก response มี `calculated_at` |
| REP-10 | นิยาม "สัปดาห์นี้" | ย้อนหลัง 7 วันเต็ม ระบุไว้ใน `window.week_definition` |
| NFR-03 | ห้ามดึงทั้งตาราง | `limit` สูงสุด 200/หน้า · aggregate จำกัดที่ `ADMIN_MAX_SCAN` (5000) พร้อมธง `truncated` |

### 5. ทดสอบแล้ว

- **Unit test:** `tests/adminAuthService.test.js` (13 เคส) + `tests/adminService.test.js` (26 เคส) + `tests/escalationService.test.js` (+13 เคสกู้คืน) — รวมทั้งโปรเจกต์ 92 เคส ผ่านหมด
- **End-to-end จริง:** รันเซิร์ฟเวอร์ + ยิง predict จาก 2 อุปกรณ์ → เห็นใน `/admin/devices` เป็น online → ack → timeline ถูกต้อง → logout → token เดิมใช้ไม่ได้
- ยืนยันแล้วว่า `x-api-key` ของ ESP32 **เรียกเส้น admin ไม่ได้** (401) และเส้นเดิมของระบบยังทำงานปกติ

**บั๊กที่เจอระหว่างทดสอบและแก้แล้ว:** CORS ตอนแรกอนุญาต header `x-api-key` แต่ลืม `Authorization`
ทำให้เว็บ admin ยิง Bearer token ข้าม origin ไม่ผ่าน preflight

---

### 6. Escalation timer persistence

**ปัญหา:** `setTimeout` อยู่ใน memory — server restart แล้วหาย เหตุการณ์ที่กำลังรอ ack ตอนนั้น
จะค้างสถานะ `pending` ตลอดกาล ไม่มีวันถูกโทรออกและไม่มีวันถูกนับใน escalation rate
เห็นชัดขึ้นหลังทำ admin dashboard เสร็จ เพราะเป็นตัวเลขที่ผิดถาวรบนหน้าจอ

**แนวทาง: ไม่เก็บ timer เลย แต่สร้างใหม่จาก DB** — ข้อมูลที่ต้องใช้มีครบอยู่แล้ว

```
ถึงกำหนด escalate เมื่อ  created_at + ACK_TIMEOUT_SECONDS
ยังรออยู่เมื่อ           !acknowledged && !escalated   ← คือ queryEvents({ status: 'pending' })
```

จึงไม่ต้องเพิ่ม Redis/BullMQ ตามที่ backlog เดิมเขียนไว้ ซึ่งจะทำให้มี infra ต้องดูแลเพิ่ม
และต้อง provision บน Render

| จังหวะ | ทำอะไร |
|---|---|
| ตอน boot | `recoverPending()` — สแกนเหตุการณ์ค้างย้อนหลัง 24 ชม. |
| ทุก 60 วินาที | sweeper เรียก `recoverPending()` ซ้ำเป็นตาข่ายรองรับ |

**การตัดสินใจต่อเหตุการณ์ที่เจอ**

| สถานการณ์ | ทำอะไร |
|---|---|
| ยังไม่ถึงกำหนด | ตั้ง timer ใหม่ด้วย**เวลาที่เหลือจริง** ไม่ใช่เริ่มนับ 60 วิใหม่ |
| เลยกำหนด แต่ไม่เกิน `ESCALATION_MAX_AGE_SECONDS` (1 ชม.) | escalate ทันที ส่ง SMS + โทรจริง |
| เลยกำหนดเกิน 1 ชม. | **ไม่โทร** — โทรเรื่องการล้มเมื่อ 5 ชม.ที่แล้วไม่ได้ช่วยใคร แต่บันทึกเป็น escalated ที่ `sms_sent`/`call_made` = false เพื่อไม่ให้ค้าง pending และเห็นชัดว่าหลุด |
| ack ไปแล้วระหว่าง server ล่ม | ไม่แตะ |

**กันโทรซ้ำ:** `escalate()` อ่านสถานะล่าสุดจาก DB ก่อนยิงทุกครั้ง ถ้า acknowledged หรือ escalated
ไปแล้วจะข้าม — กันกรณี timer กับ sweeper คว้า event เดียวกัน

**แต่ถ้าอ่าน DB ไม่ได้ → ยิงต่อ ไม่บล็อก** นี่คือ path ฉุกเฉิน โทรซ้ำยังดีกว่าไม่มีใครได้รับสาย

**Cooldown นับจากเวลาที่เหตุการณ์เกิด ไม่ใช่เวลาที่กู้คืน** ไม่งั้นเหตุการณ์เก่าที่เพิ่งกู้มา
จะไปบล็อก alert ใหม่ของอุปกรณ์นั้นเป็นเวลา 5 นาที

**บั๊กที่เจอระหว่างทดสอบและแก้แล้ว:** mock path ของ `dbService.saveEvent` ใช้ id เป็น
`mock-${Date.now()}` — บันทึกหลาย event ในมิลลิวินาทีเดียวกันจะทับกันเงียบๆ (เจอตอนสร้าง
ข้อมูลทดสอบ 4 ตัวแล้วเหลือ 2) เพิ่ม counter ต่อท้ายแล้ว กระทบเฉพาะโหมด in-memory
เพราะของจริง Supabase สร้าง UUID ให้

### 7. แก้ schema ที่ล้าสมัยใน `CLAUDE.md`

อัปเดตหัวข้อ Database Schema ให้ตรงกับ `supabase/schema.sql` (เพิ่ม `is_fall`, กลุ่ม
acknowledge/escalate, `push_tokens`, `devices`) พร้อมหมายเหตุกำกับว่าแหล่งอ้างอิงจริงคือไฟล์ SQL
เพื่อไม่ให้เกิดกรณีเดียวกับเอกสาร BA ซ้ำอีก

---

## ตัวอย่าง response

`GET /api/v1/admin/summary`
```json
{
  "devices":    { "total": 2, "online": 2, "offline": 0, "has_data": true, "offline_after_minutes": 15 },
  "falls":      { "today": 2, "week": 2, "has_data": true },
  "escalation": { "escalated_week": 0, "falls_week": 2, "rate": 0, "has_data": true },
  "window": {
    "today_from": "2026-08-31T17:00:00.000Z",
    "week_from":  "2026-08-25T08:42:02.121Z",
    "week_definition": "rolling_7_days",
    "timezone": "UTC+7"
  },
  "calculated_at": "2026-09-01T08:42:02.121Z",
  "truncated": false
}
```

`GET /api/v1/admin/events/:id`
```json
{
  "id": "...", "device_id": "esp32-bedroom", "status": "acknowledged",
  "ack_latency_seconds": 12,
  "timeline": [
    { "step": "detected",     "at": "...", "detail": { "confidence": 0.97 } },
    { "step": "acknowledged", "at": "...", "detail": { "by": "caregiver-01", "latency_seconds": 12 } }
  ]
}
```

---

## Environment variables ที่เพิ่ม

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=scrypt$<salt>$<hash>
ADMIN_SESSION_HOURS=8
ADMIN_MAX_LOGIN_ATTEMPTS=5
ADMIN_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
DEVICE_OFFLINE_AFTER_MINUTES=15
ADMIN_TZ_OFFSET_HOURS=7
ADMIN_MAX_SCAN=5000

# escalation recovery
ESCALATION_SWEEP_SECONDS=60
ESCALATION_RECOVERY_LOOKBACK_HOURS=24
ESCALATION_MAX_AGE_SECONDS=3600
```

---

## 🔲 ยังไม่ได้ทำ / ต้องตัดสินใจ

### ต้องทำก่อนต่อ frontend
1. **รัน SQL สร้างตาราง `devices` ใน Supabase** — โค้ดพร้อมแล้วแต่ตารางจริงยังไม่มี
2. **ตั้ง `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` ใน `.env`** — ไม่ตั้งแล้วทุกเส้น admin ตอบ 503
3. **ยืนยัน `ADMIN_ORIGINS`** ให้ตรงกับ origin จริงที่เว็บ admin รันอยู่
4. **ถามคนทำ frontend ว่า response shape ตรงกับที่เขียนไว้ไหม** — ยังไม่ได้เทียบกับโค้ดฝั่งเว็บ

### ประเด็นเปิดจากเอกสาร BA
| รหัส | ประเด็น | สถานะ |
|---|---|---|
| OI-01 | เกณฑ์เวลา offline ควรเป็นเท่าไร | ตั้ง 15 นาทีไว้ก่อน ปรับผ่าน env ได้ **ยังต้องวัดจริงว่า ESP32 ส่งข้อมูลถี่แค่ไหน** |
| OI-02 | จะทำ admin auth แบบใด | เอกสารเสนอ Supabase Auth · **ทำเป็น username เดียว + scrypt + session in-memory ไปก่อน** เพราะไม่ต้องเพิ่ม dependency และทำงานได้แม้ยังไม่ต่อ Supabase — เปลี่ยนไป Supabase Auth ทีหลังแก้แค่ `adminAuthService.js` |
| OI-03 | จะแก้ schema ตาม 12.2 ไหม | **แก้แล้ว** — เพิ่มแค่ตาราง `devices` (อีก 2 จุดมีอยู่แล้ว) |
| OI-04 | นโยบายเก็บข้อมูลนานเท่าไร (PDPA) | ยังไม่ตัดสินใจ ไม่กระทบรอบนี้ |
| OI-05 | "สัปดาห์นี้" นับอย่างไร | **ตัดสินใจแล้ว** — ย้อนหลัง 7 วันเต็ม ตามที่เอกสารเสนอ |

### ข้อจำกัดที่รู้ตัว
- **Session เก็บใน memory** — server restart แล้ว admin ต้อง login ใหม่ (ข้อจำกัดเดียวกับ escalation timer)
- **FR-21 การลงทะเบียนอุปกรณ์** — อุปกรณ์สร้างแถวอัตโนมัติเมื่อส่ง packet แรก แต่อุปกรณ์ที่ยังไม่เคยส่งเลย ต้อง insert แถวเองใน Supabase (BR-07 บอกว่า MVP อ่านอย่างเดียว เลยยังไม่มีเส้นสร้างอุปกรณ์)
- **`ADMIN_MAX_SCAN` = 5000** — summary/devices ดึงแถวมารวมยอดในโค้ด ถ้าข้อมูลโตเกินนี้ต้องย้ายไปรวมยอดด้วย SQL (response มีธง `truncated` เตือนไว้)
- **เหตุการณ์ค้าง pending ถาวร** — ถ้า server restart ระหว่างรอ ack timer หายไป เหตุการณ์นั้นจะค้างสถานะ pending ตลอด (เกี่ยวกับงาน "escalation timer persistence" ใน Phase 2 backlog)
- **SEC-06 (HTTPS) และ SEC-07 (ปิดบังเบอร์โทร)** ยังไม่เกี่ยว เพราะ MVP ยังไม่ deploy และ API ยังไม่ส่งเบอร์โทรออกไปที่ไหน

### นอกขอบเขต MVP (ตามเอกสาร BA)
- Cost tracking + กราฟ Recharts — เอกสาร BA ตัดออกจาก MVP (แผนเดิมจัดไว้กลุ่ม "ควรมี")
  ข่าวดีคือ `sms_sent` / `call_made` เก็บข้อมูลสะสมอยู่แล้ว ทำทีหลังได้โดยข้อมูลย้อนหลังไม่หาย
- Alert / Twilio log · Threshold config ผ่าน UI · Export CSV · User management

---

## ไฟล์ที่แตะรอบนี้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `supabase/schema.sql` | + ตาราง `devices` + index |
| `express_api/src/services/adminService.js` | **ใหม่** — ตรรกะ summary / events / devices |
| `express_api/src/services/adminAuthService.js` | **ใหม่** — login / logout / session / scrypt |
| `express_api/src/middleware/adminAuth.js` | **ใหม่** — ตรวจ Bearer token |
| `express_api/src/middleware/cors.js` | **ใหม่** — CORS สำหรับเว็บ admin |
| `express_api/src/routes/admin.js` | **ใหม่** — 6 endpoints |
| `express_api/scripts/hash_admin_password.js` | **ใหม่** — สร้าง password hash |
| `express_api/src/services/dbService.js` | + `queryEvents`, `touchDevice`, `listDevices`, `mode` |
| `express_api/src/routes/predict.js` | + `touchDevice` ทุก packet |
| `express_api/src/index.js` | + mount cors และ admin router (ก่อน auth middleware ตัวหลัก) |
| `express_api/.env.example` | + ตัวแปรกลุ่ม admin |
| `express_api/tests/adminService.test.js` | **ใหม่** — 26 เคส |
| `express_api/tests/adminAuthService.test.js` | **ใหม่** — 13 เคส |
| `express_api/src/services/escalationService.js` | + `recoverPending`, `startSweeper` · เช็คสถานะก่อน escalate · cooldown นับจากเวลาเหตุการณ์ |
| `express_api/tests/escalationService.test.js` | + 13 เคสเรื่องการกู้คืน |
| `CLAUDE.md` | อัปเดต Database Schema ให้ตรงกับ `schema.sql` |
