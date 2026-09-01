# Fall Detection System — CLAUDE.md

## Current Status (2026-05-07)

### ✅ ทำเสร็จแล้ว

| Feature | สถานะ | หมายเหตุ |
|---|---|---|
| LSTM v3 model | ✅ | Accuracy 97.9%, Fall Recall 98.5% |
| Express API (core) | ✅ | predict, events, alert endpoints |
| Push Notification (FCM V1) | ✅ | pushService.js + Expo SDK + useFcmV1 |
| Escalation / Acknowledge flow | ✅ | escalationService.js — timer in-memory, Twilio fallback |
| Push token registration | ✅ | `POST /api/v1/push/register` |
| Demo trigger endpoint | ✅ | `POST /api/v1/demo/fire` — ข้าม ML ไปยิง push ตรงๆ |
| Mobile app (Expo) | ✅ | รับ push notification, Event log, Acknowledge |
| Supabase schema | ✅ | fall_events + push_tokens tables |
| ESP32 USB Serial mode | ✅ | csi_collector_serial.py @ 921600 baud |
| End-to-end demo flow | ✅ | ESP32 → API → Push → App → Acknowledge → Twilio |
| Admin Client API | ✅ | 6 endpoints + auth แยกจาก x-api-key — ดู `docs/reports/admin_api_progress.md` |
| Escalation timer persistence | ✅ | สร้าง timer ใหม่จาก DB ตอน boot + sweeper ทุก 60 วิ ไม่ใช้ Redis |

### 🔲 ยังค้าง (Pending)

| Feature | Priority | หมายเหตุ |
|---|---|---|
| Threshold tuning | High | ยังใช้ default Softmax — ต้องหา optimal จาก ROC curve |
| BLE WiFi Provisioning | Med | ลูกค้าตั้งค่า WiFi ผ่านแอปได้โดยไม่ต้อง hardcode |
| One-class anomaly model | Low | Mentor แนะนำ — ยังไม่เริ่ม |
| Unseen test scenario | Low | แยก test data จาก real-world scenario |
| Production Cloud deploy | Low | API URL ยังเป็น localhost ใน lib/api.ts |
| Hybrid AI escalation call | Low | Phase 2a: AI voice agent ช่วยเนื้อหาการโทรตอน escalate, trigger ยังคง rule-based + fallback เป็น static TTS เสมอ · Phase 2b (มีเงื่อนไข): เปิดให้ AI ช่วยปรับ trigger ได้หลังพิสูจน์ผ่าน shadow mode (ดู `docs/reports/hybrid_ai_escalation_design.md`) |

---

## Project Overview

Hybrid AI-driven fall detection system using WiFi CSI (Channel State Information) and an LSTM model. Designed for elderly care — no camera, no wearable device required. Alerts caregivers via SMS and voice call when a fall is detected.

## Repository Structure

```
TDG/
├── app/                          # React Native + Expo mobile app (expo-router)
│   ├── _layout.tsx               # Root layout
│   └── index.tsx                 # Home screen (device status & event log)
├── fall_detection_backend/
│   ├── express_api/              # Node.js + Express cloud API
│   │   └── src/
│   │       ├── index.js          # Entry point (port 3000)
│   │       ├── routes/           # predict.js, alert.js, events.js
│   │       ├── services/         # mlService.js, alertService.js, dbService.js
│   │       └── middleware/       # auth.js (API key), validate.js
│   ├── ml_service/               # Python + FastAPI ML inference service
│   │   ├── app/                  # main.py, predict.py, preprocess.py, schemas.py
│   │   ├── models/               # lstm_v3.h5, scaler_v3.pkl (NOT in git)
│   │   ├── notebooks/            # Training notebooks (train_v3.ipynb, preprocess_v2.py)
│   │   └── data_collection/      # CSI collector scripts for ESP32
│   ├── ESP32-CSI-Tool/           # ESP32 firmware submodule
│   └── supabase/schema.sql       # Database schema
├── backend/                      # Simple Node.js backend (legacy/separate)
├── package.json                  # Mobile app dependencies (Expo 54, React 19)
└── app.json                      # Expo configuration
```

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

# 3. Preprocess → data/processed_v2/
python notebooks/preprocess_v2.py

# 4. Train → เปิด notebooks/train_v3.ipynb → Restart & Run All
```

> หมายเหตุ: `csi_collector.py` (UDP version) เก็บไว้สำหรับโหมด WiFi ในอนาคต — ตอนนี้ใช้ `csi_collector_serial.py` เท่านั้น

## API Endpoints (Express API — Render Cloud)

All endpoints require `x-api-key` header.

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
- Fall recall: 98.5%
- Train/Val/Test: 868 / 187 / 187

## Data Pipeline

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

### Flow
```
ลูกค้าเปิดแอป → แอปค้นหา ESP32 ผ่าน BLE → กรอก SSID + รหัส WiFi
→ ส่งให้ ESP32 ผ่าน BLE → ESP32 เชื่อมต่อ WiFi บ้านลูกค้า → เสร็จ ปิด BLE
→ ส่ง CSI ผ่าน UDP/HTTP ไป cloud
```

### รายละเอียด
- ใช้ ESP-IDF `wifi_provisioning` component + `scheme_ble`
- ฝั่งแอป React Native ใช้ `esp-idf-provisioning-react-native` หรือ `react-native-ble-plx`
- Security: ใช้ Proof of Possession (PoP) เช่น QR code / PIN ที่มากับกล่อง
- เก็บรหัส WiFi ใน NVS (Non-Volatile Storage) ของ ESP32 — reboot ไม่หาย
- ต้องมีปุ่ม reset บน ESP32 เพื่อเข้า provisioning mode ใหม่ (กรณีเปลี่ยน WiFi)
- Provision แค่ ESP32 #1 (active_ap) ตัวเดียว — STA interface ที่เชื่อมต่อ WiFi บ้าน
- ESP32 #2 (active_sta) ต่อ "CSI-Net" อัตโนมัติ ไม่ต้อง provision

### Network Topology (Production)
```
ESP32 #1 (active_ap) — Dual Mode
  ├── AP interface  → สร้าง WiFi "CSI-Net" (auto, ไม่ต้องตั้ง)
  │                   ← ESP32 #2 เชื่อมต่ออัตโนมัติ
  └── STA interface → เชื่อมต่อ WiFi บ้านลูกค้า (ได้จาก BLE provisioning)
                      → ส่ง CSI data ผ่าน UDP ไป cloud / local server

ESP32 #2 (active_sta)
  └── เชื่อมต่อ "CSI-Net" อัตโนมัติ
```

## Alert Flow (Production)

เปลี่ยนจากแบ่งระดับแจ้งเตือนตามคลาส → เป็น Binary + Acknowledge system
```
โมเดลตรวจจับ fall → ส่ง notification ไปแอปทันที
  → ผู้ดูแล/ผู้สูงอายุ กด "รับรู้แล้ว" ภายในเวลาที่กำหนด → หยุดแจ้งเตือน
  → ไม่มีใครกดยืนยัน → โทรฉุกเฉินทันทีผ่าน Twilio
```

## New Files (ยังไม่ commit)

| ไฟล์ | คำอธิบาย |
|---|---|
| `express_api/src/routes/demo.js` | Demo trigger — `POST /api/v1/demo/fire` ข้าม ML ไปยิง push ตรงๆ |
| `express_api/src/services/pushService.js` | Expo Push SDK (useFcmV1=true), รองรับ fake mode (`PUSH_MODE=fake`) |
| `express_api/src/services/escalationService.js` | Acknowledge timer — in-memory Map, auto-escalate → Twilio |
| `express_api/src/utils/demoLog.js` | Pretty console logger สำหรับ demo |
| `express_api/scripts/fake_csi_stream.sh` | Shell script จำลอง CSI stream สำหรับทดสอบ |
| `ml_service/data_collection/csi_collector_serial.py` | USB Serial CSI collector (921600 baud) — แทน UDP version |

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
- `fall_detection_backend/ESP32-CSI-Tool/` is a git submodule — do not edit directly
- **`lib/api.ts`** — API_BASE_URL ยังเป็น `http://10.0.2.2:3000` (Android emulator) ต้องเปลี่ยนเป็น Render URL สำหรับ production
- escalationService เก็บ timer ใน memory แต่กู้คืนได้ — ตอน boot อ่านเหตุการณ์ที่ยัง pending จาก DB มาตั้ง timer ใหม่ด้วยเวลาที่เหลือจริง และมี sweeper เช็คซ้ำทุก 60 วิ (เหตุการณ์ที่เลยกำหนดเกิน 1 ชม. จะไม่โทร แต่ปิดสถานะไว้ไม่ให้ค้าง pending)
- Twilio Trial accounts can only send to verified numbers — verify caregiver numbers first
- `backend/` ที่ root เป็น legacy server แยกต่างหาก ไม่เกี่ยวกับ `fall_detection_backend/express_api/`

## Git Branch Strategy

- `dev` — main development branch
- `feature/ml-service` — current working branch

## Database Schema (Supabase)

> **แหล่งอ้างอิงจริงคือ `fall_detection_backend/supabase/schema.sql` เสมอ**
> หัวข้อนี้เคยล้าสมัยจนทำให้เอกสาร BA (`TDG_BA.pdf`) สั่งให้เพิ่มฟิลด์ที่มีอยู่แล้ว — ถ้าแก้ schema ต้องอัปเดตที่นี่ด้วย

Table: `fall_events`
- `id` UUID PK
- `device_id` TEXT
- `timestamp` BIGINT
- `location` TEXT
- `is_fall` BOOLEAN — binary ไม่ใช่ `prediction` TEXT แล้ว
- `confidence` FLOAT
- `acknowledged` BOOLEAN / `acknowledged_at` TIMESTAMPTZ / `acknowledged_by` TEXT
- `escalated` BOOLEAN / `escalated_at` TIMESTAMPTZ
- `sms_sent` BOOLEAN / `call_made` BOOLEAN — ผลการยิง Twilio ตอน escalate
- `created_at` TIMESTAMPTZ

Table: `push_tokens`
- `token` TEXT PK
- `device_id` TEXT
- `platform` TEXT
- `created_at` / `updated_at` TIMESTAMPTZ

Table: `devices` — สำหรับหน้า Admin Client
- `device_id` TEXT PK
- `label` TEXT — ชื่อที่คนอ่านเข้าใจ
- `owner_name` TEXT
- `location` TEXT
- `last_seen_at` TIMESTAMPTZ — อัปเดตทุก packet ที่ ESP32 ส่งเข้ามา ไม่ใช่เฉพาะตอนล้ม
- `is_active` BOOLEAN — ปลดการติดตั้งแล้วตั้ง false
- `installed_at` / `created_at` TIMESTAMPTZ
