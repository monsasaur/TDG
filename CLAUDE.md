# Fall Detection System — CLAUDE.md

## Current Status (2026-09-01)

### ✅ ทำเสร็จแล้ว

| Feature | สถานะ | หมายเหตุ |
|---|---|---|
| LSTM v3 model | ⚠️ | 97.9% วัดด้วย split ที่ข้อมูลรั่ว · ไม่รั่วได้ 95.6% · **แต่ 95.6% นั้นมาจากการแยก session ไม่ใช่การจับการล้ม** — ความสามารถจริงราว 72.6% · ดู `docs/reports/data_quality_audit_2026-09.md` |
| Express API (core) | ✅ | predict, events, alert endpoints |
| Push Notification (FCM V1) | ✅ | pushService.js + Expo SDK + useFcmV1 |
| Escalation / Acknowledge flow | ✅ | escalationService.js — timer in-memory, Twilio fallback |
| Push token registration | ✅ | `POST /api/v1/push/register` |
| Demo trigger endpoint | ✅ | `POST /api/v1/demo/fire` — ข้าม ML ไปยิง push ตรงๆ |
| Mobile app (Expo) | ✅ | 29 หน้า — บ้าน/สมาชิก/ผู้ติดต่อฉุกเฉิน/อุปกรณ์/แจ้งเตือน · รับ push, Acknowledge, poll fall event ทุก 4 วิ |
| Supabase schema | ✅ | fall_events + push_tokens tables |
| ESP32 USB Serial mode | ✅ | csi_collector_serial.py @ 921600 baud |
| End-to-end demo flow | ✅ | ESP32 → API → Push → App → Acknowledge → Twilio |
| Admin Client API | ✅ | 6 endpoints + auth แยกจาก x-api-key — ดู `docs/reports/admin_api_progress.md` |
| Escalation timer persistence | ✅ | สร้าง timer ใหม่จาก DB ตอน boot + sweeper ทุก 60 วิ ไม่ใช้ Redis |

### 🔲 ยังค้าง (Pending)

| Feature | Priority | หมายเหตุ |
|---|---|---|
| Threshold tuning | Med | หาแล้วสำหรับ RandomForest — แนะนำ 0.36 (recall 97.6%, false alarm 9.6%) เหลือแค่ตัดสินใจว่าจะเปลี่ยน production model ไหม |
| BLE WiFi Provisioning | Med | **โค้ดครบทั้งแอปและ firmware แล้ว** · เหลือ 1) build/flash/ทดสอบกับบอร์ดจริง (เครื่องที่เขียนไม่มี ESP-IDF) 2) หน้าจอกรอก PoP → **ใบงานทีมฟรอนต์** `docs/reports/frontend_req_device_pairing_code.md` |
| One-class anomaly model | ✅ ตอบแล้ว | ลอง 4 ตัว ROC-AUC ดีสุด 0.70 เทียบ supervised 0.985 — ใช้แทนไม่ได้กับ feature ชุดนี้ |
| เก็บ dataset ใหม่ (สลับคลาสใน session) | **High** | ข้อมูลชุดเดิมเก็บ fall ทั้งหมดก่อนแล้วค่อย non_fall → สภาพห้องกับคลาสทับกันสนิท แก้ย้อนหลังไม่ได้ · **ต้องสลับคลาสภายใน session เดียวกัน** ดูข้อกำหนดใน `docs/reports/data_quality_audit_2026-09.md` |
| Unseen test scenario | **High** | test set ต้องเป็น session ที่ไม่เคยเห็น ไม่ใช่แค่ไฟล์ที่ไม่เคยเห็น |
| **CSI uplink ในบ้านลูกค้า** | **High** | 🔴 **ยังไม่มีอะไรส่ง CSI ขึ้น cloud เลย** — ทั้งสองทางที่มีอยู่ต้องมีคอมเปิดในบ้าน และ `csi_streamer.py` ยิงตรงไป ML service ข้าม Express API (ไม่มี event/alert/push/escalation) · ตัวเลข + ทางเลือก: `docs/reports/production_csi_uplink_decision.md` |
| Production Cloud deploy | Med | **Dockerfile + render.yaml + compose พร้อมแล้ว** · เหลือ: ตัดสินใจเรื่องไฟล์โมเดลที่ถูก gitignore · กรอก env ใน Render · ทดสอบ `docker compose up` (ยังไม่ได้รัน — เครื่องนี้ไม่มี docker) |
| Hybrid AI escalation call | Low | **สเปค Phase 2a พร้อมให้ implement แล้ว** → `docs/reports/spec_hybrid_ai_escalation_phase2a.md` (จุดเชื่อมต่อระดับบรรทัด · คำตอบคำถามเปิด 5 ข้อ · เทสต์ 14 เคส · เกณฑ์งานเสร็จ) · Phase 2b ยังไม่อนุญาต ต้องผ่าน shadow mode ก่อน (`docs/reports/hybrid_ai_escalation_design.md`) |

---

## Project Overview

Hybrid AI-driven fall detection system using WiFi CSI (Channel State Information) and an LSTM model. Designed for elderly care — no camera, no wearable device required. Alerts caregivers via SMS and voice call when a fall is detected.

## Repository Structure

```
TDG/
├── app/                          # React Native + Expo (expo-router) — 29 หน้า
│   ├── _layout.tsx  index.tsx  welcome.tsx  home.tsx  settings.tsx
│   ├── houses.tsx  add-house.tsx  select-house.tsx  manage-home.tsx
│   ├── devices.tsx  device-details.tsx
│   ├── scan-devices.tsx  connect-device.tsx  add-network.tsx      # ← BLE provisioning flow
│   ├── wifi-password.tsx  device-setup.tsx                        #   (UI เสร็จ ยังเป็น mock)
│   ├── scan-qr.tsx  enter-code.tsx  invite-*.tsx                  # PoP / เชิญสมาชิก
│   ├── members.tsx  member-detail.tsx
│   ├── emergency-contacts.tsx  add-external-contact.tsx  edit-contact.tsx
│   └── notifications.tsx  clear-alerts.tsx
├── components/                   # 31 component (การ์ด alert, ปุ่ม, ฟอร์ม, dropdown)
├── contexts/                     # AlertsContext, DevicesContext
├── data/                         # ⚠️ hooks ที่คุยกับ Supabase ตรง ไม่ผ่าน Express API
│   ├── supabaseClient.ts
│   └── useAlerts · useDevices · useHouses · useContacts · useSystemAlerts
├── hooks/useLiveAlerts.ts        # poll Express API ทุก 4 วิ แล้ว merge เข้า AlertsContext
├── lib/                          # api.ts (Express API), notifications.ts, pushNotifications.ts
├── types/alert.ts
├── fall_detection_backend/
│   ├── express_api/              # Node.js + Express cloud API
│   │   ├── src/
│   │   │   ├── index.js          # Entry point (port 3000)
│   │   │   ├── routes/           # predict, alert, events, push, demo, admin
│   │   │   ├── services/         # mlService, alertService, dbService,
│   │   │   │                     # escalationService, pushService,
│   │   │   │                     # adminService, adminAuthService
│   │   │   └── middleware/       # auth (x-api-key), adminAuth (Bearer), cors, validate
│   │   ├── scripts/              # hash_admin_password.js, fake_csi_stream.sh
│   │   └── tests/                # 92 เคส (jest)
│   ├── ml_service/               # Python + FastAPI ML inference
│   │   ├── app/                  # main.py, predict.py, preprocess.py, schemas.py
│   │   ├── experiments/          # ⭐ eval_harness · check_dataset · audit_data
│   │   │                         #    run_baselines · run_oneclass · run_threshold
│   │   ├── notebooks/            # train_v3.ipynb, preprocess_v2.py
│   │   ├── data_collection/      # csi_collector_serial.py (มีโหมด session สลับคลาส)
│   │   ├── data/sessions/        # manifest ของแต่ละรอบเก็บข้อมูล
│   │   └── models/               # lstm_v3.h5, scaler_v3.pkl (NOT in git)
│   ├── ESP32-CSI-Tool/           # ESP32 firmware submodule
│   └── supabase/                 # schema.sql (backend) + seed.sql (mock ของแอป)
├── docs/reports/                 # สเปค · รายงานผลโมเดล · audit ข้อมูล
└── backend/                      # legacy server แยกต่างหาก ไม่เกี่ยวกับ express_api

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Mobile App | React Native + Expo (expo-router) | Expo 54, React 19 |
| Backend API | Node.js + Express | v18+ |
| ML Service | Python + FastAPI + LSTM (TensorFlow) | Python 3.10+ |
| Database | Supabase (PostgreSQL) | — |
| Alerts | Twilio (SMS + Voice Call) | — |
| Deploy | Render | — |
| Hardware | ESP32 (WiFi CSI) | — |

## Development Commands

### Mobile App (root directory)
```bash
npm install
npm start          # Expo dev server
npm run android
npm run ios
npm run web
npm run lint
```

### Express API
```bash
cd fall_detection_backend/express_api
npm install
npm run dev        # nodemon auto-reload
npm start          # production
```

### ML Service
```bash
cd fall_detection_backend/ml_service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Data Collection & Training Pipeline
```bash
cd fall_detection_backend/ml_service
pip install pyserial   # ครั้งแรกเท่านั้น

# 1. เช็ค ESP32 (USB serial)
python data_collection/esp_checker.py

# 2. เก็บ data ผ่าน USB serial (ไม่ใช้ UDP แล้ว)
python data_collection/csi_collector_serial.py
#    ⭐ ในเมนูให้กด 's' = โหมด session สลับคลาส — สคริปต์สั่งเองว่าตาต่อไปเก็บท่าอะไร
#    สลับ fall/non_fall ให้อัตโนมัติ กันปัญหา session confound ที่เจอในชุดข้อมูลแรก
#    เมนูเลือกท่าแบบเดิมยังใช้ได้ แต่จะเก็บทีละท่ารวดเดียว = ทำให้คลาสผูกกับเวลา
#    ห้าม reboot ESP32 / ห้ามขยับอุปกรณ์ / ห้ามย้ายของในห้อง ตลอด session
#    manifest บันทึกที่ data/sessions/session_<id>.json

# 3. Preprocess → data/processed_v2/
python notebooks/preprocess_v2.py
#    ออก X.npy, y.npy, file_ids.npy, session_ids.npy, metadata.json
#    session_ids มาจาก prefix s<id>_ ที่ collector เขียนไว้ (ไฟล์เก่าไม่มี prefix = "legacy")
#    จำเป็นสำหรับแบ่ง test set ตาม session — test ต้องเป็น session ที่โมเดลไม่เคยเห็น

# 4. ⭐ ตรวจข้อมูลก่อนเทรน — 0 = ผ่าน, 1 = ไม่ผ่าน
python experiments/check_dataset.py
#    เช็ค: สลับคลาสจริงไหม · สภาพห้องเลื่อนไหม · โมเดลจับระดับสัญญาณหรือการเคลื่อนไหว
#    · ข้าม session แล้วยังทำงานไหม · วิธีวัดรั่วไหม
#    ไม่ผ่าน = อย่าเพิ่งเทรน ตัวเลขที่ได้จะไม่สะท้อนความจริง
#    อยากรู้รายละเอียดว่าทำไม → python experiments/audit_data.py

# 5. Train → เปิด notebooks/train_v3.ipynb → Restart & Run All
```

> หมายเหตุ: `csi_collector.py` (UDP version) เก็บไว้สำหรับโหมด WiFi ในอนาคต — ตอนนี้ใช้ `csi_collector_serial.py` เท่านั้น

## API Endpoints (Express API — Render Cloud)

เอกสาร API มี 2 รูปแบบ ใช้ spec เดียวกัน:

| แบบ | ที่ไหน | เหมาะกับ |
|---|---|---|
| **คู่มือ API** | [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md) | อ่าน/รีวิวใน PR/ส่งให้คนอื่น ไม่ต้องรันอะไร |
| **กดยิงได้** | `http://localhost:3000/docs` | ลองยิงจริง กด Authorize ใส่คีย์ได้เลย |
| **วิธีใช้หน้า Swagger** | [`docs/SWAGGER_GUIDE.md`](docs/SWAGGER_GUIDE.md) | คนที่ไม่เคยใช้ Swagger — ใส่คีย์ยังไง, login admin 2 ขั้น, ปัญหาที่เจอบ่อย |

```bash
npm run docs          # สร้าง docs/API_REFERENCE.md ใหม่จาก spec
npm run docs:check    # เช็คว่าคู่มือตรงกับ spec ไหม
```

**แหล่งความจริงเดียวคือ `src/docs/openapi.js`** — ห้ามแก้ `API_REFERENCE.md` ด้วยมือ

ห่วงโซ่ที่กันเอกสารล้าสมัย (`tests/openapi.test.js` เช็คให้ทุกครั้งที่รันเทสต์):
```
route จริงใน Express  →  openapi.js  →  API_REFERENCE.md
       เพิ่ม route ไม่เขียน spec = fail
                    แก้ spec ไม่ regen คู่มือ = fail
```

ปิดหน้า `/docs` ด้วย `ENABLE_API_DOCS=false` · ML service มี `/docs` ของ FastAPI อยู่แล้วที่ `http://localhost:8000/docs`

All endpoints require `x-api-key` header.

> **`x-api-key` แยกตาม scope แล้ว** — `DEVICE_API_KEY` (predict) · `APP_API_KEY` (events/ack/push) ·
> `DEMO_API_KEY` (demo/fire, alert/test) · scope ไหนไม่ได้ตั้ง จะถอยไปใช้ `API_KEY` เดิม
> คีย์ที่ฝังใน APK จึงสั่งให้ระบบโทรออกไม่ได้ · ดู `src/middleware/auth.js`

### Core
- `POST /api/v1/predict` — รับ CSI features จาก ESP32, เรียก ML service, trigger alert ถ้า fall
- `GET  /api/v1/events` — list all events (`?device_id=&limit=50`)
- `GET  /api/v1/events/falls` — falls only
- `GET  /health`

### Push Notification
- `POST /api/v1/push/register` — ลงทะเบียน Expo push token (`{ token, device_id, platform }`)
- `GET  /api/v1/push/tokens` — debug: ดู token ทั้งหมด

### Acknowledge / Escalation
- `POST /api/v1/events/:id/acknowledge` — ผู้ดูแลกด OK → ยกเลิก escalation timer
- escalationService จะ auto-call Twilio ถ้าไม่มีใคร ack ภายใน `ACK_TIMEOUT_SECONDS` (default 60s)

### Admin Client (ใช้ Bearer token ไม่ใช่ x-api-key)
- `POST /api/v1/admin/login` / `logout` — `{ username, password }` → `{ token, expires_at }`
- `GET  /api/v1/admin/summary` — ตัวเลข dashboard (อุปกรณ์ online/offline, fall วันนี้/สัปดาห์นี้, escalation rate)
- `GET  /api/v1/admin/events` — ทุก device (`?from=&to=&device_id=&status=&limit=&offset=`)
- `GET  /api/v1/admin/events/:id` — รายละเอียด + timeline
- `GET  /api/v1/admin/devices` — รายการอุปกรณ์ + สถานะ (`?status=online|offline&include_inactive=`)

> ตั้ง `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH` ก่อนใช้ ไม่งั้นทุกเส้นตอบ 503
> สร้าง hash: `node scripts/hash_admin_password.js '<รหัส>'`

### Alert / Demo
- `POST /api/v1/alert/test` — test Twilio SMS + voice call
- `POST /api/v1/demo/fire` — **demo trigger**: ข้าม ML ไปสร้าง fall event + push ตรงๆ (`{ device_id?, location? }`)

## ML Service Endpoints (FastAPI, port 8000)

- `POST /predict` — LSTM inference, returns `{prediction, confidence, risk_score}`
- `GET  /health`

## Environment Variables

### Express API (`fall_detection_backend/express_api/.env`)
```
PORT=3000
API_KEY=...
ML_SERVICE_URL=http://localhost:8000
SUPABASE_URL=...
SUPABASE_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE=...
ALERT_NUMBERS=+66812345678,+66898765432
```

### ML Service (`fall_detection_backend/ml_service/.env`)
```
MODEL_PATH=models/lstm_v3.h5
SCALER_PATH=models/scaler_v3.pkl
PORT=8000
# Preprocess config — ต้องตรงกับ training (preprocess_v2.py)
CSI_WINDOW_SIZE=200
CSI_STRIDE=50
CSI_SEQUENCE_LEN=10
```

## ML Models

| Version | Files | Accuracy | สถานะ |
|---|---|---|---|
| Legacy | `lstm_model.h5`, `lstm_best.h5`, `lstm_binary.h5`, `scaler.pkl` | — | เก่า |
| v2 | `lstm_v2.h5`, `lstm_v2_best.h5`, `scaler_v2.pkl` | — | เก่า |
| **v3** ✅ | `lstm_v3.h5`, `lstm_v3_best.h5`, `scaler_v3.pkl` | 97.9% | **ใช้งานอยู่** |

### v3 Config
- Architecture: LSTM 128→64→32
- WINDOW_SIZE: 200, STRIDE: 50, SEQUENCE_LEN: 10
- Features: 8 stats × 52 subcarriers = 416
- Fall recall: 98.5% — **ตัวเลขนี้วัดด้วย split ที่ข้อมูลรั่ว อย่าใช้รายงาน**
- Train/Val/Test: 868 / 187 / 187 (`train_test_split` สุ่ม ไม่ได้แบ่งตามไฟล์บันทึก)

> ⚠️ **ปัญหาที่พบ 2026-09-01** — `train_v3.ipynb` ไม่ได้โหลด `file_ids.npy` ที่ preprocess เซฟไว้
> ทำให้ window จากการล้มครั้งเดียวกัน (ซ้อนกัน 75%) กระจายไปทั้ง train และ test
> และ SEQUENCE_LEN=10 ก็เกินกว่าที่ข้อมูลรองรับ (3 window ต่อไฟล์) → 100% ของ sequence
> ประกอบจากคนละไฟล์ · ฝั่ง serving workaround ด้วยการซ้ำ window เดียว 10 ครั้ง
> **ตัวเลขที่ควรใช้: accuracy 95.6% / fall recall 96.6% (RandomForest per-window, grouped 5-fold)**
> รายละเอียด: `docs/reports/model_evaluation_2026-09.md` · โค้ด: `ml_service/experiments/`

## Data Pipeline

> ⚠️ **pipeline ด้านล่างเป็นของ "ตอน train" เท่านั้น** — ต้องมีคอมพิวเตอร์รับข้อมูลจาก ESP32
> ในบ้านลูกค้าจริงยังไม่มีเส้นทางที่ใช้ได้ ดู `docs/reports/production_csi_uplink_decision.md`


```
ESP32 #2 (STA) ──WiFi packet──► ESP32 #1 (AP) ──USB Serial──► Mac
                                                  (921600 baud)
                                                       │
                                                       ▼
                              csi_collector_serial.py → raw CSV (400 pkts/file) → data/raw/
                              → preprocess_v2.py → X.npy (N, 416), y.npy → data/processed_v2/
                              → train_v3.ipynb   → lstm_v3.h5, scaler_v3.pkl → models/
```

### Data ปัจจุบัน (data/raw/)

> ⚠️ **ข้อมูลชุดนี้มี session confound** — เก็บ fall ทั้งหมดก่อนแล้วค่อยเก็บ non_fall
> ทำให้สภาพห้องกับคลาสแยกกันไม่ออก โมเดลได้ 95.6% จากการแยก session ไม่ใช่จับการล้ม
> ตรวจซ้ำได้ด้วย `python experiments/audit_data.py` · รายละเอียด `docs/reports/data_quality_audit_2026-09.md`


| Class | ไฟล์ | Windows |
|---|---|---|
| fall_A | 100 | 300 |
| fall_B | 100 | 300 |
| fall_C | 100 | 300 |
| non_fall | 120 | 360 |
| **รวม** | **420** | **1,260** |

## ESP32 Hardware Setup & Network Topology (Data Collection Mode)

### การเชื่อมต่อ — USB Serial Mode

โหมดเก็บ data ปัจจุบันใช้ **USB Serial** ส่งข้อมูล ไม่ต้องตั้ง hotspot ใดๆ

```
ESP32 #1 (active_ap) — AP-only
  ├── AP interface  → สร้าง WiFi "myssid" @ channel 6 (จาก Kconfig)
  │                   ← ESP32 #2 เชื่อมต่อเพื่อส่ง packet ให้วัด CSI
  └── USB Serial    → ส่ง CSI ออก /dev/cu.usbserial-* @ 921600 baud → Mac

ESP32 #2 (active_sta) — STA-only
  └── เชื่อมต่อ "myssid" → ส่ง WiFi packet (100/sec) ให้ ESP32 #1 วัด CSI
      Power: USB adapter ที่ไหนก็ได้ (ไม่ต้องเสียบ Mac)

Mac → อ่าน CSI จาก USB serial ผ่าน csi_collector_serial.py
```

### ข้อดีของ Serial Mode (เทียบกับ UDP Mode)

- ✅ ไม่ต้องใช้ hotspot (iPhone/Mac/router)
- ✅ Channel 6 fix แน่นอน — ไม่หลุดตาม external WiFi
- ✅ CSI 100% มาจาก ESP32 #2 — ไม่มี beacon ภายนอกปน
- ✅ ไม่มี firewall / client isolation issue
- ✅ Mac ยัง connect WiFi ปกติได้

### Flash Firmware

```bash
# ESP32 #1 (active_ap) — เสียบ USB ค้างไว้กับ Mac
cd fall_detection_backend/ESP32-CSI-Tool/active_ap
idf.py fullclean    # ครั้งแรกหลัง pull code ใหม่ (sdkconfig เปลี่ยนเป็น 921600 baud)
idf.py flash monitor

# ESP32 #2 (active_sta) — ตัวที่ส่ง packet ให้วัด CSI (เสียบ USB อะไรก็ได้)
cd fall_detection_backend/ESP32-CSI-Tool/active_sta
idf.py flash monitor
```

### Config ที่สำคัญ

**`active_ap/sdkconfig`** — UART baudrate (ต้องตรงกับ collector script):
```
CONFIG_ESP_CONSOLE_UART_BAUDRATE=921600
CONFIG_ESPTOOLPY_MONITOR_BAUD=921600
```

**`_components/csi_component.h`** — CSI callback ส่ง output ผ่าน `outprintf()` ไม่ใช่ UDP แล้ว

**`active_ap/main/main.cc`** — `WIFI_MODE_AP` (ไม่มี STA, ไม่มี hotspot config)

## Production WiFi Provisioning (TODO)

ใน production ESP32 #1 ต้องส่ง CSI ขึ้น cloud ผ่าน WiFi (ไม่ใช่ USB) — ลูกค้าไม่ต้อง hardcode WiFi → ใช้ BLE provisioning แทน

### สถานะ (2026-09-02)

| ส่วน | สถานะ |
|---|:---:|
| UI ทั้ง flow + permission (manifest และ runtime) | ✅ |
| BLE library + Expo config plugin + `lib/provisioning.ts` | ✅ |
| ต่อ 3 หน้าจอเข้ากับ BLE จริง | ✅ |
| **ESP32 firmware — `wifi_provisioning` + `scheme_ble`** | ✅ เขียนแล้ว |
| ปุ่ม reset กลับเข้าโหมดตั้งค่า | ✅ |
| **ยังไม่เคย build / flash / ทดสอบกับบอร์ดจริง** | ❌ |
| หน้าจอกรอก PoP ในแอป | ❌ ทีมฟรอนต์ — ใบงาน `docs/reports/frontend_req_device_pairing_code.md` |

### สองโหมดใน firmware — เลือกใน menuconfig

`CONFIG_ENABLE_BLE_PROVISIONING` **ค่าเริ่มต้นเป็น `n`**

| โหมด | ทำอะไร |
|---|---|
| `n` — เก็บข้อมูล (ค่าเริ่มต้น) | AP อย่างเดียว ช่องคงที่ ส่ง CSI ผ่าน USB Serial — **โหมดที่ใช้เก็บ dataset อยู่ตอนนี้** |
| `y` — production | ครั้งแรกเปิด BLE ให้แอปตั้ง WiFi บ้าน แล้วทำงาน AP+STA พร้อมกัน |

ตั้งค่าเริ่มต้นเป็น `n` โดยตั้งใจ — **การเก็บ dataset ที่กำลังจะทำต้องไม่ถูกรบกวน**

### ⚠️ สามเรื่องที่ต้องรู้ก่อน build

**1. Partition ไม่พอ — ต้องแก้ก่อน**
```
firmware ปัจจุบัน   924 KB
app partition เดิม  1 MB (partitions_singleapp.csv)  → เหลือ 123 KB
NimBLE + provisioning ต้องการอีก ~250-350 KB       → build ไม่ผ่านแน่นอน
```
เพิ่ม `active_ap/partitions.csv` (app 2 MB) และต้องใช้ flash 4 MB
`sdkconfig` เดิมตั้งไว้ 2MB ซึ่งน่าจะไม่ตรงของจริง — เช็คด้วย `esptool.py flash_id`

**2. Bluetooth ปิดอยู่** — `# CONFIG_BT_ENABLED is not set` ต้องเปิด NimBLE (ไม่ใช่ Bluedroid ซึ่งกินที่กว่ามาก)

**3. ช่องสัญญาณจะไม่ใช่ 6 อีกต่อไปในโหมด production**
ESP32 มีวิทยุชุดเดียว ในโหมด AP+STA **ช่องของ AP ถูกบังคับให้ตามเราเตอร์บ้าน**
ตั้ง `WIFI_CHANNEL` ไว้เท่าไรก็ไม่มีผล — CSI ที่เก็บได้ในบ้านลูกค้าจะอยู่คนละช่องกับตอนเทรน
(ตอนเก็บ dataset ใช้ช่อง 6 คงที่) **ต้องทดสอบว่าโมเดลทำงานข้ามช่องได้ไหม**

### ความปลอดภัย — เลือก Security 1

ESP-IDF ให้เลือกระหว่าง `secure1` (X25519 + AES-CTR ยืนยันด้วย PoP) กับ
`secure2` (SRP6a ต้องมี username + salt/verifier)

เลือก **secure1** เพราะ secure2 ต้อง generate salt/verifier แยกต่อเครื่องตอนผลิต
เพิ่มขั้นตอนโดยไม่ได้ประโยชน์เพิ่มในเมื่อ PoP เป็นสตริงสุ่มยาวบนกล่อง

> ⚠️ **PoP ต้องยาว สุ่ม และไม่ซ้ำกันระหว่างเครื่อง** — จุดอ่อนของ secure1 คือถ้า PoP
> สั้นหรือเดาง่าย คนที่ดักจับ handshake ไว้เอาไป brute force offline ได้
> ห้ามใช้ PIN 4 หลักหรือค่าเดียวกันทุกเครื่อง (`CONFIG_PROV_POP`)

ค่านี้ต้องตรงกันทั้งสองฝั่ง — `provisioning_component.h` กับ `lib/provisioning.ts`
ถ้าแก้ข้างเดียวจะจับคู่ไม่ติดโดยไม่มี error ที่บอกสาเหตุชัด

### ไฟล์ที่เพิ่ม/แก้

| ไฟล์ | |
|---|---|
| `_components/provisioning_component.h` | **ใหม่** — BLE provisioning + ปุ่ม reset (กด BOOT ค้าง 5 วิ) |
| `active_ap/main/main.cc` | แยกสองโหมด · เพิ่ม `apsta_start()` |
| `active_ap/partitions.csv` | **ใหม่** — app 2 MB |
| `active_ap/sdkconfig.defaults` | **ใหม่** — NimBLE, flash 4MB, baudrate 921600 |
| `active_ap/main/Kconfig.projbuild` | + เมนู BLE WiFi Provisioning |

### ขั้นตอน build โหมด production

```bash
cd fall_detection_backend/ESP32-CSI-Tool/active_ap
rm sdkconfig                    # ให้ sdkconfig.defaults มีผล
idf.py set-target esp32
idf.py menuconfig               # → ESP32 CSI Tool Config → BLE WiFi Provisioning
                                #   เปิด ENABLE_BLE_PROVISIONING
                                #   ตั้ง PROV_POP เป็นค่าสุ่มยาว
                                #   ตั้ง DEVICE_CODE เช่น ESP-0001A (ต้องมีใน Supabase ด้วย)
idf.py fullclean && idf.py build
idf.py -p /dev/cu.usbserial-XXXX flash monitor
```

**ยังไม่เคย build จริง** — เครื่องที่เขียนโค้ดไม่มี ESP-IDF ติดตั้ง
ต้องมีคนรัน `idf.py build` ยืนยันก่อน แล้วแก้ error ที่อาจมี

## Alert Flow (Production)

เปลี่ยนจากแบ่งระดับแจ้งเตือนตามคลาส → เป็น Binary + Acknowledge system
```
โมเดลตรวจจับ fall → ส่ง notification ไปแอปทันที
  → ผู้ดูแล/ผู้สูงอายุ กด "รับรู้แล้ว" ภายในเวลาที่กำหนด → หยุดแจ้งเตือน
  → ไม่มีใครกดยืนยัน → โทรฉุกเฉินทันทีผ่าน Twilio
```

## Environment Variables เพิ่มเติม

```
# Escalation timing
ACK_TIMEOUT_SECONDS=60     # วินาทีที่รอ ack ก่อน escalate (default 60)
COOLDOWN_SECONDS=300        # cooldown ระหว่าง alert ต่อ device (default 300)

# Push mode
PUSH_MODE=real              # real = ยิง FCM จริง | fake = log console แทน
```

## Important Notes

- `lstm_v3.h5`, `lstm_v3_best.h5`, `scaler_v3.pkl` are NOT committed to git — must be obtained separately
- `fall_detection_backend/ESP32-CSI-Tool/` **ไม่ใช่ submodule** — เป็นโฟลเดอร์ธรรมดาในรีโปหลัก (ไม่มี `.gitmodules` ไม่มี `.git` ข้างใน · git ติดตามไฟล์ในนั้น 50 ไฟล์) แก้ตรงได้เลย
- **`lib/api.ts`** — URL/คีย์ย้ายไป `app.config.js` แล้ว ตั้งผ่าน `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_API_KEY` · แต่คีย์ยังเป็นตัวเดียวกับ ESP32 อยู่ ดูหัวข้อ Deploy
- ต้องรัน `ALTER TABLE devices` ใน `schema.sql` ก่อนใช้หน้า Admin — คอลัมน์ `last_seen_at`/`is_active`/`installed_at` ยังไม่มีใน Supabase จริง
- escalationService เก็บ timer ใน memory แต่กู้คืนได้ — ตอน boot อ่านเหตุการณ์ที่ยัง pending จาก DB มาตั้ง timer ใหม่ด้วยเวลาที่เหลือจริง และมี sweeper เช็คซ้ำทุก 60 วิ (เหตุการณ์ที่เลยกำหนดเกิน 1 ชม. จะไม่โทร แต่ปิดสถานะไว้ไม่ให้ค้าง pending)
- Twilio Trial accounts can only send to verified numbers — verify caregiver numbers first
- `backend/` ที่ root เป็น legacy server แยกต่างหาก ไม่เกี่ยวกับ `fall_detection_backend/express_api/`

## Git Branch Strategy

- `dev` — main development branch
- `feature/ml-service` — current working branch

## Database Schema (Supabase)

> **แหล่งอ้างอิงจริงคือ `fall_detection_backend/supabase/schema.sql` เสมอ**
> หัวข้อนี้เคยล้าสมัยจนทำให้เอกสาร BA (`TDG_BA.pdf`) สั่งให้เพิ่มฟิลด์ที่มีอยู่แล้ว — ถ้าแก้ schema ต้องอัปเดตที่นี่ด้วย

### ตารางสองชุด — เชื่อมกันแล้วบางส่วน

Supabase โปรเจกต์เดียวมีตารางสองกลุ่มที่ออกแบบแยกกันคนละที

**กลุ่ม A — CSI pipeline** (มี `CREATE TABLE` ใน `schema.sql`)

Table: `fall_events` — Express API เขียนเมื่อ ESP32 ตรวจพบการล้ม
- `id` UUID PK · **`device_id` TEXT ← ตรงกับ `devices.code`** · `timestamp` BIGINT · `location` TEXT
- `is_fall` BOOLEAN — binary ไม่ใช่ `prediction` TEXT แล้ว
- `confidence` FLOAT
- `acknowledged` / `acknowledged_at` / `acknowledged_by`
- `escalated` / `escalated_at` · `sms_sent` / `call_made`
- `created_at` TIMESTAMPTZ

Table: `push_tokens` — `token` PK · `device_id` · `platform` · `created_at` / `updated_at`

**กลุ่ม B — แอปมือถือ** (❗ **ไม่มี `CREATE TABLE` ในรีโปเลย** รู้โครงสร้างได้จาก `seed.sql` กับโค้ดใน `data/` เท่านั้น)

| ตาราง | คอลัมน์ที่ใช้จริง |
|---|---|
| `houses` | `id` · `name` · `created_at` |
| `devices` | `id` (PK เช่น `'d1'`) · `house_id` → houses · `name` · **`code`** (`'ESP-0001A'`) · `wifi_ssid` · `status` · **+ `last_seen_at` · `is_active` · `installed_at`** (เพิ่มโดย `schema.sql` ให้ admin ใช้) |
| `emergency_contacts` | ผู้ติดต่อฉุกเฉิน (self / member / external) |
| `house_contacts` | เชื่อม contact กับบ้าน (many-to-many) |
| `alerts` | `id` · `house_id` · `title` · `description` · `location` · `status` · `answered_by` · `countdown` · `timeline` (JSON) · **+ `fall_event_id`** → ผูกกับ `fall_events` |

### ✅ ตัดสินใจแล้ว 2026-09-01 — `fall_events.device_id` ↔ `devices.code`

ใช้ตาราง `devices` ตัวเดียวร่วมกันทั้งแอปและ backend ไม่แยกเป็นสองตาราง

**ทำไมใช้ `code` ไม่ใช่ `id`:** `id` เป็น surrogate key ที่ต้องเปลี่ยนได้อิสระ (เช่นย้ายไป UUID)
ถ้าเอา firmware ไปผูกกับมัน อุปกรณ์ที่ flash ไปแล้วจะพังหมดตอน migrate ส่วน `code` คือรหัส
ที่พิมพ์บนตัวเครื่อง ซึ่ง BLE provisioning เขียนลง NVS และผู้ใช้สแกน QR ได้อยู่แล้ว

`dbService` แปลงคอลัมน์ให้ `adminService` อัตโนมัติ — `device_id ← code` · `label ← name` ·
`owner_name ← houses.name`

**`touchDevice()` ไม่สร้างแถวใหม่ให้อุปกรณ์ที่ไม่รู้จัก** เพราะ `devices.house_id` เป็น FK บังคับ
อุปกรณ์ต้องลงทะเบียนผ่านแอปก่อน — ถ้า ESP32 ส่งข้อมูลมาด้วย `code` ที่ไม่มีในตาราง ระบบยังบันทึก
`fall_events` และแจ้งเตือนตามปกติ แค่ไม่โผล่ในหน้า Devices

### ✅ ตัดสินใจแล้ว 2026-09-02 — `alerts` ผูกกับ `fall_events` แล้ว

`alerts.fall_event_id` เชื่อมสองตารางเข้าด้วยกัน · ทุกครั้งที่ตรวจพบการล้ม Express API
เขียนแถวใน `alerts` ให้ด้วย (`services/appAlertService.js`) โดยหา house จากอุปกรณ์:
`fall_events.device_id` → `devices.code` → `devices.house_id`

หน้าจอแอปที่มีอยู่จึงแสดงของจริงได้เลยโดยไม่ต้องแก้ UI — `title`, `description`,
`location`, `timeline`, `countdown` ถูกเติมจากข้อมูลจริง

| จังหวะ | `alerts.status` | timeline |
|---|---|---|
| ตรวจพบการล้ม | `active` + countdown | ตรวจพบ ❌ · แจ้งเตือนในแอป ⏳ · โทรฉุกเฉิน ⏳ |
| ผู้ดูแลกดรับทราบ | `completed` + `answered_by` | แจ้งเตือนในแอป ✅ รับทราบโดย : X |
| หมดเวลา → โทรออก | `in_progress` | แจ้งเตือนในแอป ❌ · โทรฉุกเฉิน ⏳ โทรออกแล้ว |

**ไม่ตั้ง `no_response`** เพราะจะรู้ว่า "ไม่มีใครรับสาย" จริง ๆ ต้องมี Twilio status callback ก่อน
เดาแล้วบอกผู้ใช้ว่าไม่มีใครรับ ทั้งที่อาจมีคนรับ เป็นการโกหกในเรื่องที่คนใช้ตัดสินใจต่อจากมัน

**อุปกรณ์ที่ยังไม่ผูกกับบ้าน** จะไม่มี alert สร้างให้ (`house_id` เป็น FK บังคับ) —
เหตุการณ์ยังบันทึกใน `fall_events` และแจ้งเตือนตามปกติ แค่ไม่โผล่ในแอป และขึ้น warning ใน log

ฝั่งแอป: `data/useAlerts.ts` ดึงซ้ำทุก 10 วินาที · `hooks/useLiveAlerts.ts` ถูกลบแล้ว
เพราะจะทำให้เหตุการณ์เดียวกันโผล่สองครั้ง (ทั้งจากตาราง `alerts` และจากการ poll API)

### 🔲 ยังต้องตัดสินใจ

1. **`devices.status` กับ online/offline ของ admin เป็นสองแหล่งความจริง**
   `status` ('connected'/'disconnected') ฝั่งแอปตั้งเอง · admin คำนวณจาก `last_seen_at` ตาม NFR-09
   ควรตัดสินใจว่าจะเลิกใช้ `status` แล้วอนุมานจาก `last_seen_at` อย่างเดียวไหม

### เส้นทางข้อมูลของแอป — มีสองทางขนานกัน

```
data/*.ts hooks  ──Supabase client ตรง──►  houses · devices · alerts · contacts
                                            (ส่วนใหญ่เป็น seed data)

hooks/useLiveAlerts ──poll ทุก 4 วิ──► Express API /api/v1/events/falls
lib/api.ts                             ──► /alert/ack/:id · /push/register · /health
```

`app/home.tsx` ใช้ทั้งสองทาง · หน้าอื่นเกือบทั้งหมดใช้ `data/` อย่างเดียว
