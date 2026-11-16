# Deploy ขึ้น Render — รายการตรวจ (13 พ.ย. 2026)

**สถานะ:** config พร้อม (`render.yaml` · Dockerfile ทั้งสอง service) · **ยังไม่เคย deploy จริง**
และยังไม่เคย build image เลย (เครื่องที่พัฒนาไม่มี docker) — ครั้งแรกให้ดู log ของ Render ตอน build ด้วย

> **2026-11-17: `render.yaml` ตั้งเป็นแผนฟรีสำหรับช่วง demo** — ดูหัวข้อ "แผนฟรีช่วง demo" ก่อน deploy
> (แผนฟรีรับ private network ไม่ได้ → ต้องกรอก `ML_SERVICE_URL` เอง · หลับหลัง 15 นาที → ปลุกก่อน demo)

---

## 0. แผนฟรีช่วง demo (ตั้งไว้ 2026-11-17 · ยังไม่ deploy)

ทั้งสอง service ใช้ `plan: free` · ประหยัดราว 475 บาท/เดือนเทียบ starter แต่มีข้อจำกัดที่ต้องรู้
(ที่มา: [render.com/docs/free](https://render.com/docs/free) · [render.com/docs/private-network](https://render.com/docs/private-network))

| ข้อจำกัดของแผนฟรี | ผลกับระบบนี้ | แก้ไว้แล้ว |
|---|---|---|
| **รับ private network ไม่ได้** (ส่งออกได้อย่างเดียว) | Express เรียก ML ผ่าน `fromService … hostport` ไม่ถึง | `ML_SERVICE_URL` เป็น `sync: false` → กรอก URL สาธารณะของ tdg-ml-service เอง (เช่น `https://tdg-ml-service.onrender.com`) |
| **หลับหลังไม่มีคนเรียก 15 นาที · ตื่นราว 1 นาที** | timeout เดิมสั้นกว่าเวลาตื่น → การล้มครั้งแรกหลังหลับ error แล้วหายไปเลย | Express รอ ML ได้ 90 วิ (`ML_TIMEOUT_MS`) · `fall_monitor` ส่งในเธรดเบื้องหลัง รอได้ 150 วิ (`--timeout`) · **ก่อน demo รัน `express_api/scripts/warm_render.sh`** |
| **750 ชม./เดือนต่อ workspace** (ช่วงที่หลับไม่นับ) · เกินแล้วถูกพักทั้งหมดจนขึ้นเดือนใหม่ | สองตัวเปิดตลอด = 1,440 ชม. | **ห้ามตั้งตัว ping กันหลับไว้ตลอด** — ปลุกเฉพาะวันที่ demo |
| Render รีสตาร์ต service ฟรีได้ทุกเมื่อ · ไฟล์ในเครื่องหายเมื่อหลับ | ตัวจับเวลาโทรออกอยู่ในหน่วยความจำ | Express กู้ timer จาก Supabase ตอน boot — **ต้องตั้ง `SUPABASE_URL`/`SUPABASE_KEY`** ไม่งั้นเหตุการณ์หายทุกครั้งที่หลับ |
| ไม่มี shell · instance เดียว | — | — |

ML service ใช้ RAM ราว 250 MB ตอนโหลด `rf_v2_event` (วัดบนแมค) · CPU ของแผนฟรีน้อย ตอนตื่นอาจนานกว่า 1 นาที

**ก่อน demo ทุกครั้ง**
```bash
cd fall_detection_backend/express_api
sh scripts/warm_render.sh https://<tdg-express-api>.onrender.com https://<tdg-ml-service>.onrender.com
#   ต้องได้ ✅ ทั้งสองตัว · ML ตอบ model_version rf_v2_event-r2-fall · n_features 39
#   ระหว่าง demo อย่าเว้นเกิน 15 นาที ไม่งั้นต้องปลุกใหม่
```

**ขึ้นแผนเสียเงิน (ใช้งานจริง)** — แก้ `render.yaml` 3 จุด: `plan: starter` ทั้งสองตัว ·
`ML_SERVICE_URL` กลับเป็น `fromService: { name: tdg-ml-service, type: web, property: hostport }` · ลบ `ML_TIMEOUT_MS`

---

## 1. ไฟล์โมเดล — ✅ ตัดสินใจแล้ว 2026-11-17: ดาวน์โหลดจาก GitHub Release ตอน build

Render build จาก git แต่ `ml_service/models/*.pkl` ถูก gitignore ไว้ → ไฟล์อยู่ที่ release
[`models-2026-11-17`](https://github.com/monsasaur/TDG/releases/tag/models-2026-11-17) (repo เป็น public — ใครก็โหลดได้)

- `ml_service/models/MANIFEST` — sha256 · ชื่อไฟล์ · URL ของ `rf_v2_event.pkl` · `rf_v1.pkl` · `scaler_rf_v1.pkl`
- `ml_service/scripts/fetch_models.sh` — Dockerfile เรียกตอน build · โหลดเฉพาะไฟล์ที่ยังไม่มี · sha256 ไม่ตรง = build ล้ม
  (build ในเครื่องที่มีไฟล์อยู่แล้วจะใช้ไฟล์ของเครื่อง)
- image มีโมเดลทั้งสองรุ่น · `render.yaml` ตั้ง `FALL_MODEL=rf_v2_event` · สลับกลับ `rf_v1` ได้จาก env อย่างเดียว
- ทดสอบสคริปต์แล้ว (โฟลเดอร์ว่าง → โหลดครบ sha ตรง · มีไฟล์แล้ว → ข้าม · sha ผิด → ล้ม) · **ยังไม่เคย build image จริง**

**เปลี่ยนโมเดลรอบหน้า**
```bash
cd fall_detection_backend/ml_service
gh release create models-<วันที่> --repo monsasaur/TDG --target dev --latest=false \
  --title "โมเดล ML service <วันที่>" --notes "..." models/rf_v2_event.pkl models/rf_v1.pkl models/scaler_rf_v1.pkl
shasum -a 256 models/*.pkl      # → แก้ sha256 + URL ใน models/MANIFEST แล้ว commit
```
ห้ามอัปโหลดไฟล์ทับใน release เดิม — sha256 จะไม่ตรงกับ MANIFEST แล้ว build ล้ม (ตั้งใจให้เป็นแบบนั้น)

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

1. ~~ตัดสินใจเรื่องไฟล์โมเดล~~ (เสร็จแล้ว · หัวข้อ 1)
2. Supabase: รัน `schema.sql` (ตัวที่รวม `escalation_method` แล้ว) · ถ้าจะเปิดระบบบัญชีด้วย ทำตาม `accounts_round1.md`
3. Render → New → **Blueprint** → เลือก repo → branch ที่จะ deploy (`dev`)
4. กรอก env ตามหัวข้อ 2 · แผนฟรี: กรอก `ML_SERVICE_URL` = URL สาธารณะของ tdg-ml-service ด้วย (หัวข้อ 0)
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
- `render.yaml` ตอนนี้ใช้แผน `free` สำหรับ demo (หัวข้อ 0) — ใช้งานจริงต้องเป็น `starter` เพราะแผนฟรีหลับเมื่อไม่มีคนเรียก
  ไม่เหมาะกับระบบแจ้งเหตุฉุกเฉิน · starter ราว $7/service/เดือน (≈ 475 บาท/เดือนสำหรับสองตัว · ตามเว็บเปรียบเทียบ 2026-11 · เช็ค render.com/pricing ก่อนจ่าย)
