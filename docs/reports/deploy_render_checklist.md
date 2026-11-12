# Deploy ขึ้น Render — รายการตรวจ (13 พ.ย. 2026)

**สถานะ:** config พร้อม (`render.yaml` · Dockerfile ทั้งสอง service) · **ยังไม่เคย deploy จริง**
และยังไม่เคย build image เลย (เครื่องที่พัฒนาไม่มี docker) — ครั้งแรกให้ดู log ของ Render ตอน build ด้วย

---

## 1. ต้องตัดสินใจก่อน: ไฟล์โมเดล

Render build จาก git แต่ `ml_service/models/*.pkl` ถูก gitignore ไว้
→ Dockerfile ของ ml_service **ตั้งใจให้ build ล้ม** พร้อมข้อความบอกสาเหตุ (ดีกว่าไปพังตอน boot)

| ทางเลือก | ข้อดี | ข้อเสีย |
|---|---|---|
| **1. เอา `rf_v1.pkl` + `scaler_rf_v1.pkl` เข้า git** (2.6 MB · ยกเว้นใน `ml_service/.gitignore`) | ง่ายสุด build ได้ทันที | ไฟล์อยู่ใน history ถาวร · ไม่เหมาะกับ `rf_v2_event.pkl` (43 MB) |
| **2. เก็บไฟล์ไว้ที่อื่น** (Supabase Storage / GitHub Release) แล้วให้ Dockerfile ดาวน์โหลดตอน build + ตรวจ checksum | git สะอาด · ใช้กับไฟล์ใหญ่ได้ | ต้องเพิ่มขั้นใน Dockerfile และ URL ของไฟล์ |
| 3. Render Disk | — | disk ใช้ได้ตอน runtime ไม่ใช่ตอน build · ต้องอัปโหลดเอง |

แนะนำ **1** ถ้าใช้ `rf_v1` ไปก่อน · **2** ถ้าจะใช้ `rf_v2_event` บน cloud
(`FALL_MODEL` ใน `render.yaml` ตั้งเป็น `rf_v1` — Dockerfile เช็คเฉพาะไฟล์ของ rf_v1)

---

## 2. env ที่ต้องกรอกเองใน Render (Express)

| key | ค่า | หมายเหตุ |
|---|---|---|
| `API_KEY` · `DEVICE_API_KEY` · `APP_API_KEY` · `DEMO_API_KEY` | สตริงสุ่มยาว **คนละค่า** | `APP_API_KEY` = ค่าที่ใส่ใน `EXPO_PUBLIC_API_KEY` ของแอป · `DEVICE_API_KEY` = ESP32 / ตัวส่ง CSI · `DEMO_API_KEY` = ปุ่มสาธิต · ตั้งไม่ครบ = ถอยไปใช้ `API_KEY` ตัวเดียว แล้วคีย์ในแอปสั่งโทรออกได้ |
| `SUPABASE_URL` · `SUPABASE_KEY` | **service_role** | ไม่ใช่ anon — หลังรัน `accounts.sql` คีย์อื่นเขียนเหตุการณ์ไม่ได้ |
| `TWILIO_ACCOUNT_SID` · `TWILIO_AUTH_TOKEN` · `TWILIO_PHONE` · `ALERT_PHONES` | จาก Twilio | บัญชี trial โทรได้เฉพาะเบอร์ที่ verify แล้ว |
| `ADMIN_USERNAME` · `ADMIN_PASSWORD_HASH` · `ADMIN_ORIGINS` | hash จาก `node scripts/hash_admin_password.js '<รหัส>'` | ไม่ตั้ง = หน้า admin ตอบ 503 · `ADMIN_ORIGINS` = URL ของเว็บ admin |
| `TYPHOON_API_KEY` | จาก OpenTyphoon | ใช้เมื่อเปลี่ยน `AI_VOICE_ENABLED` เป็น `true` เท่านั้น (ค่าเริ่มต้นปิด) |

ค่าที่ตั้งไว้ใน `render.yaml` แล้ว: `TWILIO_MODE=real` · `PUSH_MODE=real` · `ACK_TIMEOUT_SECONDS=60` · `AI_VOICE_ENABLED=false` · ฯลฯ
`ML_SERVICE_URL` ต่อกับ ml service ให้อัตโนมัติ

> ⚠️ `ML_SERVICE_URL` ที่ Render ส่งมาเป็นแบบ `tdg-ml-service:10000` (ไม่มี `http://`) — เดิม Express เรียกไม่ได้ทุกครั้ง
> แก้แล้ว 13 พ.ย. (`mlService.js` เติม `http://` ให้) — ต้อง deploy จาก branch ที่มีการแก้นี้

---

## 3. ลำดับ

1. ตัดสินใจเรื่องไฟล์โมเดล (หัวข้อ 1)
2. Supabase: รัน `schema.sql` (ตัวที่รวม `escalation_method` แล้ว) · ถ้าจะเปิดระบบบัญชีด้วย ทำตาม `accounts_round1.md`
3. Render → New → **Blueprint** → เลือก repo → branch ที่จะ deploy (`dev`)
4. กรอก env ตามหัวข้อ 2
5. ตรวจหลัง deploy
   - `GET https://<tdg-express-api>.onrender.com/health` → `{"status":"ok"}`
   - หน้า `/docs` เปิดได้ (ไม่อยากเปิดสาธารณะ ตั้ง `ENABLE_API_DOCS=false`)
   - `POST /api/v1/demo/fire` ด้วย `DEMO_API_KEY` → มือถือได้ push · ไม่กดรับทราบ 60 วิ → มีสายโทรเข้า
6. แอป: `EXPO_PUBLIC_API_BASE_URL` = URL ของ tdg-express-api · `EXPO_PUBLIC_API_KEY` = `APP_API_KEY` → build ใหม่
7. ตัวส่ง CSI ใช้ `DEVICE_API_KEY` และชี้ไปที่ URL เดียวกัน

---

## 4. ต้องรู้ไว้

- **ยังไม่มีอะไรส่ง CSI จากบ้านขึ้น cloud ได้เอง** — ESP32 ยังต้องผ่านคอมในบ้าน (`production_csi_uplink_decision.md`)
  deploy แล้วจึงทดสอบได้ด้วย `/demo/fire` หรือสคริปต์จากคอม ยังไม่ใช่ระบบที่ติดตั้งในบ้านจริง
- **timer ของการโทรอยู่ในหน่วยความจำ** — deploy ใหม่ = restart · ตอน boot Express อ่านเหตุการณ์ที่ค้างจาก Supabase มาตั้ง timer ใหม่
  (ต้องต่อ Supabase แล้วเท่านั้น — ถ้าใช้ mock store ทุกอย่างหายตอน restart)
- `render.yaml` ใช้ plan `starter` ทั้งสอง service — แผนฟรีของ Render หยุด service ที่ไม่มีคนเรียกสักพัก ซึ่งไม่เหมาะกับระบบแจ้งเหตุฉุกเฉิน
  (ราคาดูที่ Render เอง ผมไม่ได้ใส่ตัวเลขเพราะไม่แน่ใจราคาปัจจุบัน)
