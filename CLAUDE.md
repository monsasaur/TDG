# Fall Detection System — CLAUDE.md

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

# 1. เช็ค ESP32
python data_collection/esp_checker.py

# 2. เก็บ data (fall 4 วิ, non_fall 4 วิ → CSV)
python data_collection/csi_collector.py

# 3. Preprocess → data/processed_v2/
python notebooks/preprocess_v2.py

# 4. Train → เปิด notebooks/train_v3.ipynb → Restart & Run All
```

## API Endpoints (Express API, port 3000)

All endpoints require `x-api-key` header.

- `POST /api/v1/predict` — receives CSI features from ESP32, calls ML service, triggers alert if fall detected
- `GET  /api/v1/events` — list all events (`?device_id=&limit=50`)
- `GET  /api/v1/events/falls` — falls only
- `POST /api/v1/alert/test` — test Twilio SMS + voice call
- `GET  /health` — health check

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
ESP32 UDP (100 pkt/s)
  → csi_collector.py → raw CSV (400 pkts/file) → data/raw/
  → preprocess_v2.py → X.npy (N, 416), y.npy  → data/processed_v2/
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

## ESP32 Hardware Setup & Network Topology

### การเชื่อมต่อ (Dual-Mode AP+STA)

```
ESP32 #1 (active_ap) — Dual Mode
  ├── AP interface  → สร้าง WiFi "CSI-Net" (รหัส: 11111111)
  │                   ← ESP32 #2 เชื่อมต่อเพื่อรับ/ส่ง packet สำหรับวัด CSI
  └── STA interface → เชื่อมต่อ Hotspot "View" (รหัส: 11111111)
                      → ส่ง CSI data ผ่าน UDP ไปหา Mac

ESP32 #2 (active_sta)
  └── เชื่อมต่อ "CSI-Net" → ส่ง WiFi packet ให้ ESP32 #1 วัด CSI

Mac → เชื่อมต่อ Hotspot "View" → รับ UDP จาก ESP32 #1 (port 5500)
```

### Flash Firmware

```bash
# ESP32 #1 (active_ap) — ตัวที่วัด CSI และส่งข้อมูลออก
cd fall_detection_backend/ESP32-CSI-Tool/active_ap
idf.py flash monitor

# ESP32 #2 (active_sta) — ตัวที่ส่ง packet ให้วัด CSI
cd fall_detection_backend/ESP32-CSI-Tool/active_sta
idf.py flash monitor
```

### UDP Target IP

กำหนดใน `_components/csi_component.h`:
```cpp
#define UDP_TARGET_IP   "172.20.10.3"  // IP ของ Mac บน Hotspot "View"
#define UDP_TARGET_PORT 5500
```

ถ้า IP ของ Mac เปลี่ยน ให้แก้ไฟล์นี้แล้ว flash ESP32 #1 ใหม่
เช็ค IP ปัจจุบันด้วย: `ipconfig getifaddr en0`

### Hotspot Config ใน active_ap

กำหนดใน `active_ap/main/main.cc`:
```cpp
#define HOME_WIFI_SSID  "View"        // ชื่อ hotspot
#define HOME_WIFI_PASS  "11111111"    // รหัส hotspot
```

## Production WiFi Provisioning (TODO)

ใน production ลูกค้าไม่ต้อง hardcode WiFi — ใช้ BLE provisioning แทน

### Flow
```
ลูกค้าเปิดแอป → แอปค้นหา ESP32 ผ่าน BLE → กรอก SSID + รหัส WiFi
→ ส่งให้ ESP32 ผ่าน BLE → ESP32 เชื่อมต่อ WiFi บ้านลูกค้า → เสร็จ ปิด BLE
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

## Important Notes

- `lstm_v3.h5`, `lstm_v3_best.h5`, `scaler_v3.pkl` are NOT committed to git — must be obtained separately
- `app/preprocess.py` config โหลดจาก env vars (`CSI_WINDOW_SIZE`, `CSI_STRIDE`, `CSI_SEQUENCE_LEN`) — ต้องตรงกับ training
- `fall_detection_backend/ESP32-CSI-Tool/` is a git submodule — do not edit directly
- Mobile app API URL is hardcoded in `app/index.tsx` — update to Render URL for production
- Twilio Trial accounts can only send to verified numbers — verify caregiver numbers first
- The `backend/` directory at root is a separate legacy Node.js server, distinct from `fall_detection_backend/express_api/`

## Git Branch Strategy

- `dev` — main development branch
- `feature/ml-service` — current working branch

## Database Schema (Supabase)

Table: `fall_events`
- `id` UUID PK
- `device_id` TEXT
- `timestamp` BIGINT
- `location` TEXT
- `prediction` TEXT (`fall` | `no_fall`)
- `confidence` FLOAT
- `risk_score` INT
- `alerted` BOOLEAN
- `created_at` TIMESTAMPTZ
