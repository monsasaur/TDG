# คู่มือรัน Demo

**อัปเดต:** 2026-09-02
**ใช้เมื่อ:** จะสาธิตระบบให้อาจารย์ / mentor / ถ่ายวิดีโอ

---

## ⚡ สรุปสั้น — ถ้ารีบ

```bash
# 1. ML service
cd fall_detection_backend/ml_service && source venv/bin/activate
uvicorn app.main:app --port 8000

# 2. Express API (อีก terminal)
cd fall_detection_backend/express_api && npm run dev

# 3. ยิง demo
curl -X POST http://localhost:3000/api/v1/demo/fire \
  -H "x-api-key: $DEMO_API_KEY" -H 'Content-Type: application/json' \
  -d '{"device_id":"ESP-0001A","location":"ห้องนอน"}'
```

> ⚠️ **`x-api-key` เปลี่ยนแล้ว** — เดิมใช้ `API_KEY` ตัวเดียวทุกเส้น ตอนนี้แยกเป็น
> `DEVICE_API_KEY` / `APP_API_KEY` / `DEMO_API_KEY` ตาม scope
> **`/demo/fire` ต้องใช้ `DEMO_API_KEY` เท่านั้น** คีย์ของแอปเรียกไม่ได้แล้ว (401)
>
> ถ้ายังไม่ได้ตั้งคีย์แยก ระบบจะถอยไปใช้ `API_KEY` เดิม — ของเก่ายังใช้ได้ตามปกติ

---

## ก่อนวันสาธิต — ตรวจ 6 ข้อ

| # | ตรวจอะไร | คำสั่ง / วิธี |
|---|---|---|
| 1 | ตั้งคีย์ครบไหม | `grep -E "^(API_KEY|DEVICE_API_KEY|APP_API_KEY|DEMO_API_KEY)=" fall_detection_backend/express_api/.env` |
| 2 | Twilio โหมดไหน | `grep TWILIO_MODE .env` → `fake` = แค่ log · `real` = **โทรจริง** |
| 3 | เบอร์ที่จะโดนโทร | `grep ALERT_PHONES .env` — Twilio trial โทรได้เฉพาะเบอร์ที่ verify แล้ว |
| 4 | เวลารอ ack | `grep ACK_TIMEOUT_SECONDS .env` — สาธิตควรตั้ง 15–20 วิ ไม่ใช่ 60 |
| 5 | Supabase ต่อติดไหม | ดู log ตอน start ถ้าขึ้น `[DB mock]` = ยังไม่ได้ต่อ ข้อมูลจะหายตอน restart |
| 6 | โมเดลอยู่ครบ | `ls fall_detection_backend/ml_service/models/rf_v1.pkl` |
| 7 | **อุปกรณ์ที่จะใช้สาธิตผูกกับบ้านแล้วหรือยัง** | ใน Supabase: `select code, house_id from devices where code = 'ESP-0001A'` — ถ้า `house_id` ว่าง เหตุการณ์จะไม่โผล่ในแอป |

**ตั้งค่าที่แนะนำสำหรับสาธิต** (`express_api/.env`)

```env
ACK_TIMEOUT_SECONDS=20      # รอ ack 20 วิ กำลังดี — 60 วิ ยืนรอนานเกินไปบนเวที
COOLDOWN_SECONDS=30         # ยิงซ้ำได้เร็ว เผื่อสาธิตหลายรอบ (ปกติ 300)
DEMO_LOG=true               # log สวยเป็นกล่อง เห็นทุกขั้นตอนบนจอ
TWILIO_MODE=fake            # เปลี่ยนเป็น real เฉพาะตอนจะโชว์โทรจริง
PUSH_MODE=real              # ให้มือถือเด้งจริง
```

---

## รันเต็มรูปแบบ

### 1. ML service

```bash
cd fall_detection_backend/ml_service
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

เช็ค: `curl localhost:8000/health` → `{"status":"ok"}`

> ถ้าไม่อยากรัน ML service เลย ตั้ง `USE_MOCK_ML=true` ใน `express_api/.env`
> แล้วข้ามขั้นนี้ได้ — `/demo/fire` ไม่ได้เรียก ML อยู่แล้ว

### 2. Express API

```bash
cd fall_detection_backend/express_api
npm run dev
```

เช็ค: `curl localhost:3000/health` · log ตอน start ต้องขึ้น
```
API running on port 3000
🔁 escalation sweeper every 60s
```

### 3. แอปมือถือ

```bash
# ตั้ง IP เครื่องตัวเองก่อน ถ้าใช้มือถือจริง (ไม่ใช่ emulator)
ipconfig getifaddr en0        # เช่นได้ 192.168.1.42

# .env.local ที่ root ของโปรเจกต์
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:3000
EXPO_PUBLIC_API_KEY=<ค่าเดียวกับ APP_API_KEY ใน express_api/.env>

npm start
```

> **มือถือกับคอมต้องอยู่ WiFi วงเดียวกัน** ถ้าใช้ hotspot ให้ต่อทั้งสองเครื่องเข้า hotspot เดียวกัน
>
> Android emulator ใช้ `http://10.0.2.2:3000` ได้เลย ไม่ต้องตั้ง env

### 4. หน้าเว็บ admin (ถ้าจะโชว์)

ต้องตั้งก่อนใช้:
```bash
cd fall_detection_backend/express_api
node scripts/hash_admin_password.js 'รหัสที่จะใช้'
# เอาผลลัพธ์ใส่ ADMIN_PASSWORD_HASH ใน .env พร้อมตั้ง ADMIN_USERNAME
```
และ **ต้องรัน `ALTER TABLE devices` ใน Supabase ก่อน** (ดู `supabase/schema.sql`) ไม่งั้นหน้า Devices จะพัง

---

## ยิง demo

### วิธีที่ 1 — curl

```bash
curl -X POST http://localhost:3000/api/v1/demo/fire \
  -H "x-api-key: $DEMO_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"device_id":"ESP-0001A","location":"ห้องนอนผู้สูงอายุ"}'
```

### วิธีที่ 2 — iOS Shortcut (กดจากมือถือบนเวที)

สร้าง Shortcut → Get Contents of URL
- URL: `http://<IP เครื่อง>:3000/api/v1/demo/fire`
- Method: `POST` · Headers: `x-api-key` = **`DEMO_API_KEY`** (ไม่ใช่คีย์ของแอป)
- Body (JSON): `{"device_id":"ESP-0001A","location":"ห้องนอน"}`

### วิธีที่ 3 — จาก ESP32 จริง

ต่อ ESP32 แล้วรัน collector — ระบบจะยิง `/predict` ให้เอง ใช้ `DEVICE_API_KEY`

---

## สิ่งที่จะเกิดขึ้น (ลำดับที่จะเห็นบนจอ)

```
🚨 FALL DETECTED          ← กล่องแดงใน terminal (ต้องตั้ง DEMO_LOG=true)
  1. CSI Inference        ← LSTM predict → fall
  2. Database             ← event saved
  3. Escalation           ← timer armed (20s window)
  4. App Alert            ← เขียนแถวใน alerts ให้แอปแสดง
  5. Push Notification    ← มือถือเด้ง

  [ถ้ากด "รับทราบ" ในแอปทัน]  → ✅ escalation cancelled  จบ
  [ถ้าปล่อยครบ 20 วิ]         → ☎️ ESCALATING กล่องเหลือง
                                 → SMS + โทรออก (จริงถ้า TWILIO_MODE=real)
```

**จังหวะการเล่าบนเวที:** ยิง demo → ชี้ให้ดูมือถือเด้ง → *"ถ้าผู้ดูแลกดรับทราบ ระบบจะหยุด"*
กดโชว์ → ยิงอีกรอบ → *"แต่ถ้าไม่มีใครกด..."* → ปล่อยให้ครบเวลา → โทรออก

---

## แก้ปัญหาเฉพาะหน้า

| อาการ | สาเหตุที่พบบ่อย | แก้ |
|---|---|---|
| `401 Unauthorized` ตอนยิง demo | ใช้คีย์ผิด scope | `/demo/fire` ต้องใช้ `DEMO_API_KEY` ไม่ใช่ `APP_API_KEY` |
| `{"action":"cooldown"}` ยิงแล้วไม่เกิดอะไร | device เดิมเพิ่งยิงไป | รอ `COOLDOWN_SECONDS` หรือเปลี่ยน `device_id` |
| มือถือไม่เด้ง | token หายตอน restart | เปิดแอปใหม่ให้ลงทะเบียน token · `dbService` ใช้ memory ถ้าไม่ได้ต่อ Supabase |
| มือถือต่อ API ไม่ได้ | คนละ WiFi / IP เปลี่ยน | `ipconfig getifaddr en0` แล้วแก้ `.env.local` · restart expo |
| Twilio ไม่โทร | trial โทรได้เฉพาะเบอร์ที่ verify | verify เบอร์ใน Twilio console ก่อน |
| หน้า admin ตอบ 503 | ยังไม่ตั้งรหัส admin | `node scripts/hash_admin_password.js` แล้วใส่ใน `.env` |
| หน้า admin Devices ว่าง | ยังไม่รัน `ALTER TABLE devices` | รัน SQL ใน `supabase/schema.sql` |
| ข้อมูลหายหลัง restart | ไม่ได้ต่อ Supabase | log ขึ้น `[DB mock]` → ตั้ง `SUPABASE_URL`/`SUPABASE_KEY` |
| แอปสแกน BLE ไม่เจอ | รันบน Expo Go | ต้อง `eas build --profile development` ใหม่ · โหมด mock จะขึ้นป้ายเตือนในหน้า scan |
| ยิง demo แล้วมือถือเด้ง แต่ไม่มีในรายการแจ้งเตือน | อุปกรณ์ยังไม่ผูกกับบ้าน | log จะขึ้น `⚠️ [ALERT] device=... ยังไม่ได้ผูกกับบ้าน` — ตั้ง `house_id` ในตาราง `devices` ให้ตรงกับ `device_id` ที่ยิง |
| รายการแจ้งเตือนไม่อัปเดต | แอปดึงซ้ำทุก 10 วิ | รอสักครู่ หรือเข้าออกหน้าใหม่ |

---

## รีเซ็ตก่อนสาธิตรอบใหม่

```bash
# ล้างข้อมูล demo แล้วใส่ mock ชุดใหม่ (ถ้าใช้ Supabase)
# รัน fall_detection_backend/supabase/seed.sql ใน Supabase SQL Editor

# ถ้าใช้ in-memory: restart express_api ก็ล้างหมดแล้ว
```

---

## ⚠️ ก่อนกด demo ต่อหน้าคน

- [ ] `TWILIO_MODE` ตรงกับที่ตั้งใจ — `real` = **โทรออกจริง มีค่าใช้จ่าย และเบอร์ปลายทางจะดังจริง**
- [ ] เบอร์ใน `ALERT_PHONES` เป็นเบอร์ของคนในทีม ไม่ใช่เบอร์คนอื่น
- [ ] ซ้อมยิง 1 รอบก่อนขึ้นเวที — ให้ token ลงทะเบียนและ cooldown เคลียร์
- [ ] เปิด terminal ที่รัน `npm run dev` ไว้ให้เห็น จะได้ชี้ให้ดูตอนอธิบาย
