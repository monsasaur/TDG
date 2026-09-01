me# วิธีใช้หน้า Swagger — ทดสอบ API โดยไม่ต้องพิมพ์ curl

**สำหรับใคร:** ใครก็ตามที่ต้องเรียก API ของโปรเจกต์นี้ — คนทำ admin frontend,
คนทำฟีเจอร์ต่อ, หรือคนที่ต้องสาธิตระบบ · ไม่ต้องเคยใช้ Swagger มาก่อน

**เอกสารที่เกี่ยวข้อง:** [`API_REFERENCE.md`](API_REFERENCE.md) (คู่มืออ่านอย่างเดียว) ·
[`DEMO_RUNBOOK.md`](DEMO_RUNBOOK.md) (วิธีรันสาธิต)

---

## Swagger คืออะไร (สั้นที่สุด)

หน้าเว็บที่ลิสต์ endpoint ทั้งหมดของ API แล้ว**กดยิงจริงได้จากหน้านั้นเลย** —
ไม่ต้องเปิด Postman ไม่ต้องพิมพ์ `curl` ให้ผิด

---

## 1. เปิดหน้า

```bash
cd fall_detection_backend/express_api
npm run dev
```

รอจนขึ้นบรรทัดนี้ใน terminal แล้วเปิดลิงก์:

```
API running on port 3000
🔁 escalation sweeper every 60s
📖 API docs → http://localhost:3000/docs
```

> ถ้าเปิดแล้วเจอ `{"error":"Unauthorized"}` แทนหน้าเว็บ แปลว่ามีคนตั้ง
> `ENABLE_API_DOCS=false` ไว้ใน `.env` — เอาออกหรือตั้งเป็น `true`

---

## 2. หน้าตาที่เห็น

```
┌──────────────────────────────────────────────────────┐
│  Fall Detection API                    [ Authorize ] │ ← ปุ่มใส่คีย์ อยู่มุมขวาบน
│  เวอร์ชัน 1.0.0                                        │
│  ตารางบอกว่าคีย์แต่ละแบบเรียกอะไรได้                        │
├──────────────────────────────────────────────────────┤
│  Detection            ▸  POST /api/v1/predict        │ ← กดที่แถบเพื่อกาง
│  Events               ▸  GET  /api/v1/events         │
│  Push                 ▸                              │
│  Demo   ⚠️            ▸                              │
│  Admin                ▸                              │
│  System               ▸  GET  /health                │
└──────────────────────────────────────────────────────┘
```

ทุกกลุ่มถูก**พับไว้ตั้งแต่แรก** กดที่ชื่อกลุ่มหรือชื่อ endpoint เพื่อกางออก

สีของ method: <kbd>GET</kbd> ฟ้า = อ่านอย่างเดียว · <kbd>POST</kbd> เขียว = สร้าง/สั่งงาน

---

## 3. ใส่คีย์ก่อน ไม่งั้นยิงไม่ผ่าน

กด **Authorize** มุมขวาบน จะเห็น **2 ช่อง** เพราะระบบมีการยืนยันตัวตน 2 แบบคนละชั้น

```
┌─── Available authorizations ─────────────────────────┐
│                                                      │
│  apiKey  (apiKey)                                    │
│  Name: x-api-key                                     │
│  Value: [____________________]  [Authorize]          │ ← ช่องที่ 1
│                                                      │
│  adminToken  (http, Bearer)                          │
│  Value: [____________________]  [Authorize]          │ ← ช่องที่ 2
│                                                      │
└──────────────────────────────────────────────────────┘
```

### ช่องที่ 1 — `apiKey` สำหรับ endpoint ทั่วไป

ใส่คีย์**ตัวเดียว**ที่ตรงกับสิ่งที่จะเรียก ดูค่าได้จาก `express_api/.env`

| จะเรียกอะไร | ใส่ค่าจาก |
|---|---|
| `POST /predict` | `DEVICE_API_KEY` |
| `/events`, `/alert/ack`, `/push/register` | `APP_API_KEY` |
| `/demo/fire`, `/alert/test`, `/push/test` | `DEMO_API_KEY` |

> ถ้ายังไม่ได้ตั้งคีย์แยก ระบบจะใช้ `API_KEY` ตัวเดิมสำหรับทุกอย่าง — ใส่ค่านั้นได้เลย
>
> **สลับ scope:** Swagger เก็บได้ทีละคีย์ ถ้าจะเปลี่ยนไปเรียกอีก scope
> ต้องกด Authorize → **Logout** ในช่องนั้น → ใส่คีย์ใหม่

### ช่องที่ 2 — `adminToken` เฉพาะเส้น `/admin/*`

ต้อง login เอา token มาก่อน ดูวิธีในตัวอย่างที่ 2

กด **Close** เมื่อใส่เสร็จ · คีย์จะถูกจำไว้แม้ refresh หน้า (ไม่ต้องใส่ซ้ำทุกครั้ง)

---

## 4. ยิง request

กางendpoint ที่ต้องการ แล้วทำ 3 ขั้น:

1. กด **`Try it out`** (มุมขวาของกล่อง) — ช่องกรอกจะกดได้
2. แก้ค่าใน body / parameter ตามต้องการ
3. กด **`Execute`** ปุ่มสีน้ำเงินยาว

จะได้ผลลัพธ์ 3 ส่วน:

| ส่วน | คืออะไร |
|---|---|
| **Curl** | คำสั่ง curl ที่เทียบเท่ากัน — **คัดลอกไปใช้ใน terminal หรือส่งให้คนอื่นได้เลย** |
| **Request URL** | URL เต็มที่ยิงไป |
| **Server response** | รหัสตอบกลับ + body ที่ได้จริง |

---

## ตัวอย่างที่ 1 — จำลองการล้ม

**สิ่งที่ต้องมี:** ช่อง `apiKey` ใส่ `DEMO_API_KEY` ไว้แล้ว

1. กางกลุ่ม **Demo** → `POST /api/v1/demo/fire`
2. **Try it out**
3. แก้ body เป็นอุปกรณ์ที่มีจริง:
   ```json
   { "device_id": "ESP-0001A", "location": "ห้องนอน" }
   ```
4. **Execute**

ได้:
```json
{
  "event_id": "e6b1…",
  "is_fall": true,
  "confidence": 0.973,
  "action": "awaiting_acknowledge",
  "ack_timeout_seconds": 60
}
```

ตอนนี้มือถือควรเด้ง และถ้าไม่มีใครกดรับทราบภายในเวลาที่บอก ระบบจะโทรออก

**เอา `event_id` ที่ได้ไปกดรับทราบต่อ:** `POST /api/v1/alert/ack/{event_id}` —
แต่เส้นนี้ใช้ `APP_API_KEY` ต้องไป Logout แล้วใส่คีย์ใหม่ก่อน

---

## ตัวอย่างที่ 2 — เข้าหน้า admin (มี 2 ขั้น)

เส้น `/admin/*` ใช้ token ไม่ใช่ `x-api-key` — ต้อง login เอา token มาก่อน

**ขั้นที่ 1 — ขอ token**

1. กางกลุ่ม **Admin** → `POST /api/v1/admin/login`
2. **Try it out** → ใส่ body:
   ```json
   { "username": "admin", "password": "รหัสที่ตั้งไว้" }
   ```
3. **Execute** → จะได้:
   ```json
   {
     "token": "27fc1b43a6e16b6b…",
     "expires_at": "2026-09-02T01:28:27.223Z",
     "username": "admin"
   }
   ```
4. **คัดลอกค่า `token`** (เอาเฉพาะข้างในเครื่องหมายคำพูด ไม่เอา `"`)

**ขั้นที่ 2 — เอา token ไปใส่**

1. กด **Authorize** มุมขวาบน
2. วางลงช่อง **`adminToken`** (ช่องที่ 2) — **ใส่แค่ token เปล่า ๆ ไม่ต้องพิมพ์คำว่า `Bearer`**
3. กด **Authorize** → **Close**

เสร็จแล้วเรียก `/admin/summary`, `/admin/events`, `/admin/devices` ได้เลย

> token หมดอายุใน 8 ชั่วโมงถ้าไม่ได้ใช้งาน — เจอ `401` เมื่อไหร่ก็ login ใหม่

---

## ⚠️ ระวัง — endpoint กลุ่ม Demo สั่งงานจริง

กลุ่ม **Demo** ไม่ใช่การจำลอง มันสั่งระบบจริง:

| endpoint | ทำอะไรจริง |
|---|---|
| `POST /demo/fire` | สร้างเหตุการณ์ล้มจริง · **โทรออกจริงถ้าไม่มีใครกดรับทราบ** |
| `POST /alert/test` | ส่ง SMS และโทรออกทันที |
| `POST /push/test` | ยิง push ไปทุกเครื่องที่ลงทะเบียนไว้ |

**เช็ค `TWILIO_MODE` ใน `.env` ก่อนกด**

- `fake` = แค่ log สวย ๆ ใน terminal ไม่มีอะไรออกไปข้างนอก — ปลอดภัย
- `real` = **โทรออกจริง เบอร์ปลายทางดังจริง มีค่าใช้จ่ายจริง**

---

## ปัญหาที่เจอบ่อย

| อาการ | สาเหตุ | แก้ |
|---|---|---|
| `401 {"error":"Unauthorized"}` | ยังไม่ได้กด Authorize หรือ**ใส่คีย์ผิด scope** | ดูตารางในข้อ 3 · เส้น Demo ต้องใช้ `DEMO_API_KEY` ไม่ใช่คีย์ของแอป |
| `401` เฉพาะเส้น `/admin/*` | ใส่คีย์ผิดช่อง | ต้องใส่ช่อง `adminToken` ไม่ใช่ `apiKey` |
| `401` ทั้งที่เพิ่งใส่ token | token หมดอายุ (8 ชม.) | login ใหม่ |
| กรอกช่องไม่ได้ ปุ่มเทา | ยังไม่ได้กด `Try it out` | กดก่อน |
| `503 {"error":"admin auth not configured"}` | ยังไม่ตั้งรหัส admin | `node scripts/hash_admin_password.js '<รหัส>'` แล้วใส่ `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` ใน `.env` |
| `409` ตอนกดรับทราบ | หมดเวลาไปแล้ว ระบบ escalate ไปเรียบร้อย | ยิง `/demo/fire` ใหม่แล้วกดให้ทัน |
| `{"action":"cooldown"}` ไม่เกิดอะไรขึ้น | อุปกรณ์นั้นเพิ่งยิงไป | รอ `COOLDOWN_SECONDS` หรือเปลี่ยน `device_id` |
| ยิงสำเร็จแต่ไม่โผล่ในแอป | อุปกรณ์ยังไม่ผูกกับบ้าน | ดู log จะขึ้น `⚠️ [ALERT] ... ยังไม่ได้ผูกกับบ้าน` · ตั้ง `house_id` ในตาราง `devices` |
| เปิด `/docs` แล้วได้ `Unauthorized` | `ENABLE_API_DOCS=false` | เอาออกจาก `.env` |

---

## ML service ก็มีหน้าเดียวกัน

```bash
cd fall_detection_backend/ml_service && source venv/bin/activate
uvicorn app.main:app --port 8000
```
→ `http://localhost:8000/docs`

FastAPI สร้างให้เองอัตโนมัติ ไม่ต้องตั้งอะไร มี 2 endpoint (`/health`, `/predict`)
และ**ไม่ต้องใส่คีย์** เพราะ ML service ไม่ได้เปิดออกสู่ภายนอก

---

## อยากอ่านเฉย ๆ ไม่อยากรันเซิร์ฟเวอร์

ใช้ [`API_REFERENCE.md`](API_REFERENCE.md) — เนื้อหาเดียวกัน สร้างจาก spec ตัวเดียวกัน
เปิดอ่านใน GitHub หรือ editor ได้เลย
