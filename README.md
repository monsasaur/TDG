# 🚨 Hybrid AI-Driven Fall Detection System

> ระบบตรวจจับการล้มอัจฉริยะแบบ Real-time โดยใช้ WiFi CSI (Channel State Information) ร่วมกับ AI/ML
> สำหรับผู้สูงอายุหรือผู้ป่วยที่ต้องการการดูแลอย่างใกล้ชิด — ไม่ต้องติดกล้อง ไม่ต้องสวมใส่อุปกรณ์

---

## 📋 สารบัญ

- [ภาพรวมระบบ](#-ภาพรวมระบบ)
- [System Architecture](#-system-architecture)
- [โครงสร้างโปรเจค](#-โครงสร้างโปรเจค)
- [เทคโนโลยีที่ใช้](#-เทคโนโลยีที่ใช้)
- [การติดตั้งและใช้งาน](#-การติดตั้งและใช้งาน)
  - [1. ESP32 Firmware](#1-esp32-firmware)
  - [2. ML Service (Python)](#2-ml-service-python)
  - [3. Express API (Node.js)](#3-express-api-nodejs)
  - [4. Mobile App (React Native)](#4-mobile-app-react-native)
- [การ Deploy บน Render](#️-การ-deploy-บน-render)
- [การตั้งค่า Supabase](#-การตั้งค่า-supabase)
- [การตั้งค่า Twilio](#-การตั้งค่า-twilio)
- [API Reference](#-api-reference)
- [การทดสอบระบบ](#-การทดสอบระบบ)
- [ทีมผู้พัฒนา](#-ทีมผู้พัฒนา)

---

## 🧠 ภาพรวมระบบ

ระบบนี้ใช้คลื่น WiFi ที่มีอยู่แล้วในบ้านมาวิเคราะห์การเคลื่อนไหวของคน โดย ESP32 จะคอยดักจับการเปลี่ยนแปลงของสัญญาณ WiFi (CSI) แล้วส่งข้อมูลขึ้น Cloud ให้ AI Model ทำการประมวลผล หากพบว่ามีการล้มเกิดขึ้น ระบบจะแจ้งเตือนผู้ดูแลทันทีผ่าน SMS และ Voice Call

**จุดเด่น:**
- ✅ ไม่ต้องติดกล้องวงจรปิด — รักษาความเป็นส่วนตัว
- ✅ ไม่ต้องสวมใส่อุปกรณ์ — สะดวกสำหรับผู้สูงอายุ
- ✅ แจ้งเตือนแบบ Real-time ผ่าน SMS + Voice Call
- ✅ บันทึก Event Log ครบถ้วนใน Database

---

## 🏗 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Hardware Layer                        │
│                                                              │
│  ESP32 (Sender) ──── WiFi CSI Signal ────► ESP32 (Receiver) │
│                                                  │           │
│                                          Feature Extraction  │
│                               (amplitude_mean, amplitude_std,│
│                                   variance, energy)          │
└──────────────────────────────────┬──────────────────────────┘
                                   │ HTTP POST
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Backend (Render)                    │
│                                                              │
│   Express API (Node.js) ──► ML Service (FastAPI + LSTM)     │
│          │                          │                        │
│          │                   Prediction Result               │
│          │                 (fall / no_fall + confidence)     │
│          ◄──────────────────────────┘                        │
│          │                                                    │
│    Fall Detected?                                            │
│          │                                                    │
│     ┌────┴────┐                                              │
│     ▼         ▼                                              │
│  Twilio    Supabase                                          │
│ SMS + Call  Event Log                                        │
└─────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                      Mobile App (Expo)                       │
│                  ดู Device Status & Event Log                 │
└─────────────────────────────────────────────────────────────┘
```

### Flow การทำงาน

1. **ESP32** รับสัญญาณ WiFi CSI และทำ Feature Extraction
2. **Express API** รับ Features จาก ESP32 และส่งต่อไปยัง ML Service
3. **LSTM Model** ประมวลผลและทำนายว่าเกิดการล้มหรือไม่
4. หากพบการล้ม → **แจ้งเตือนทันที** ผ่าน Twilio (SMS + Voice Call)
5. บันทึก Event ทั้งหมดลง **Supabase Database**
6. **Mobile App** แสดงผล Device Status และ Event Log แบบ Real-time

---

## 📁 โครงสร้างโปรเจค

```
fall-detection-system/
│
├── 📱 app/                            # Mobile App (React Native + Expo)
│   ├── _layout.tsx                    # Root layout (expo-router)
│   └── index.tsx                      # Home screen แสดง IoT Devices
│
├── 📁 fall_detection_backend/         # Backend ทั้งหมด
│   │
│   ├── 📁 express_api/                # Cloud API (Node.js + Express)
│   │   ├── src/
│   │   │   ├── index.js               # Entry point
│   │   │   ├── routes/
│   │   │   │   ├── predict.js         # POST /api/v1/predict
│   │   │   │   ├── alert.js           # POST /api/v1/alert/test
│   │   │   │   └── events.js          # GET  /api/v1/events
│   │   │   ├── services/
│   │   │   │   ├── mlService.js       # เรียก Python ML Service
│   │   │   │   ├── alertService.js    # Twilio SMS + Voice Call
│   │   │   │   └── dbService.js       # Supabase Database
│   │   │   └── middleware/
│   │   │       ├── auth.js            # API Key validation
│   │   │       └── validate.js        # Request validation
│   │   ├── .env.example
│   │   ├── package.json
│   │   └── Dockerfile
│   │
│   ├── 📁 ml_service/                 # ML Service (Python + FastAPI)
│   │   ├── app/
│   │   │   ├── main.py                # FastAPI entry point
│   │   │   ├── predict.py             # LSTM Model inference
│   │   │   ├── preprocess.py          # Data preprocessing
│   │   │   └── schemas.py             # Pydantic data models
│   │   ├── models/
│   │   │   └── lstm_model.h5          # ⚠️ ไม่ได้อยู่ใน Git (ดาวน์โหลดแยก)
│   │   ├── notebooks/
│   │   │   └── train_model.ipynb      # Notebook สำหรับ train model
│   │   ├── data_collection/
│   │   │   ├── csi_collector.py       # เก็บข้อมูล CSI จาก ESP32
│   │   │   └── esp_checker.py         # ตรวจสอบการเชื่อมต่อ ESP32
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── 📁 ESP32-CSI-Tool/             # เครื่องมือเก็บ CSI จาก ESP32
│   │   ├── active_ap/                 # Mode: ESP32 เป็น Access Point
│   │   ├── active_sta/                # Mode: ESP32 เป็น Station
│   │   ├── passive/                   # Mode: Passive Sniffing
│   │   └── python_utils/              # Utility scripts สำหรับอ่านและ plot CSI
│   │
│   ├── 📁 supabase/
│   │   └── schema.sql                 # Database schema
│   │
│   └── 📁 docs/
│       ├── architecture.png           # รูป System Diagram
│       ├── api.md                     # API Documentation
│       └── setup.md                   # Setup Guide
│
├── app.json                           # Expo app configuration
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🛠 เทคโนโลยีที่ใช้

| Layer | เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-------|-----------|---------|---------|
| Hardware | ESP32 | - | เก็บ WiFi CSI Signal |
| Mobile App | React Native + Expo | 54 / React 19 | แสดงผล Device & Events |
| Backend API | Node.js + Express | v18+ | รับข้อมูล + จัดการ Logic |
| ML Service | Python + FastAPI | 3.10+ | รัน LSTM Model |
| AI Model | TensorFlow / LSTM | - | ตรวจจับการล้ม |
| Database | Supabase (PostgreSQL) | - | เก็บ Event Log |
| Alert | Twilio | - | SMS + Voice Call |
| Deploy | Render | - | Cloud Hosting |

---

## 🚀 การติดตั้งและใช้งาน

### Prerequisites

- [Node.js](https://nodejs.org/) v18 หรือสูงกว่า
- [Python](https://python.org/) 3.10 หรือสูงกว่า
- [PlatformIO](https://platformio.org/) (สำหรับ ESP32)
- ESP32 Development Board จำนวน 2 ตัว (Sender + Receiver)
- บัญชี [Supabase](https://supabase.com), [Twilio](https://twilio.com), [Render](https://render.com)
- ไฟล์ `lstm_model.h5` (ดาวน์โหลดแยกจาก [Google Drive](#))

---

### 1. ESP32 Firmware

**Clone โปรเจค**

```bash
git clone https://github.com/your-username/fall-detection-system.git
cd fall-detection-system/fall_detection_backend/ESP32-CSI-Tool
```

**ตั้งค่า config.h**

```bash
cp include/config.example.h include/config.h
```

แก้ไข `config.h` ใส่ค่าจริง:

```cpp
#define WIFI_SSID       "ชื่อ WiFi ของคุณ"
#define WIFI_PASSWORD   "รหัส WiFi ของคุณ"
#define API_KEY         "API Key ที่ตั้งไว้ใน Express"
#define CLOUD_API_URL   "https://your-api.onrender.com"
#define DEVICE_ID       "ESP32_001"
#define LOCATION        "living_room"
```

**Upload และ Monitor**

```bash
# Upload ขึ้น ESP32
pio run --target upload

# ดู Serial Monitor
pio device monitor --baud 115200
```

---

### 2. ML Service (Python)

```bash
cd fall_detection_backend/ml_service

# สร้าง virtual environment
python -m venv venv
source venv/bin/activate        # macOS/Linux
# หรือ  venv\Scripts\activate   # Windows

# ติดตั้ง dependencies
pip install -r requirements.txt

# วาง Model file
cp /path/to/lstm_model.h5 models/lstm_model.h5

# ตั้งค่า Environment Variables
cp .env.example .env
```

แก้ไข `.env`:

```env
MODEL_PATH=models/lstm_model.h5
PORT=8000
```

**รัน ML Service**

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

ทดสอบ:

```bash
curl http://localhost:8000/health
# {"status": "ok"}
```

---

### 3. Express API (Node.js)

```bash
cd fall_detection_backend/express_api

# ติดตั้ง dependencies
npm install

# ตั้งค่า Environment Variables
cp .env.example .env
```

แก้ไข `.env`:

```env
PORT=3000
API_KEY=your_secret_api_key

# ML Service URL (local หรือ Render URL)
ML_SERVICE_URL=http://localhost:8000

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1xxxxxxxxxx

# เบอร์ที่รับแจ้งเตือน (คั่นด้วย comma)
ALERT_NUMBERS=+66812345678,+66898765432
```

**รัน API Server**

```bash
# Development (auto-reload)
npm run dev

# Production
npm start
```

ทดสอบ:

```bash
curl http://localhost:3000/health
# {"status":"ok","timestamp":"..."}
```

---

### 4. Mobile App (React Native)

```bash
# ที่ root directory
npm install

# รัน Expo development server
npm start

# หรือรันบน platform เฉพาะ
npm run android
npm run ios
npm run web
```

> ⚠️ **หมายเหตุ:** แก้ไข URL ใน `app/index.tsx` จาก `http://localhost:3000` เป็น URL จริงของ API เมื่อ deploy แล้ว

---

## ☁️ การ Deploy บน Render

### Deploy ML Service (Python)

1. ไปที่ [render.com](https://render.com) → **New → Web Service**
2. เชื่อม GitHub repo และตั้งค่า:

```
Name:     fall-detection-ml
Root Dir: fall_detection_backend/ml_service
Build:    pip install -r requirements.txt
Start:    uvicorn app.main:app --host 0.0.0.0 --port 8000
```

3. เพิ่ม Environment Variable: `MODEL_PATH=models/lstm_model.h5`

> ⚠️ ไฟล์ `lstm_model.h5` ต้องอัปโหลดแยก — แนะนำใช้ **Render Disk** หรือดาวน์โหลดจาก URL ตอน build

### Deploy Express API

1. Render → **New → Web Service** และตั้งค่า:

```
Name:     fall-detection-api
Root Dir: fall_detection_backend/express_api
Build:    npm install
Start:    npm start
```

2. เพิ่ม Environment Variables ทั้งหมดจาก `.env.example`

---

## 🗄 การตั้งค่า Supabase

1. สมัครที่ [supabase.com](https://supabase.com) และสร้าง Project ใหม่
2. ไปที่ **SQL Editor** และรัน:

```sql
CREATE TABLE fall_events (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id   TEXT NOT NULL,
  timestamp   BIGINT NOT NULL,
  location    TEXT DEFAULT 'unknown',
  prediction  TEXT NOT NULL,
  confidence  FLOAT NOT NULL,
  risk_score  INT NOT NULL,
  alerted     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_id  ON fall_events(device_id);
CREATE INDEX idx_prediction ON fall_events(prediction);
CREATE INDEX idx_created_at ON fall_events(created_at DESC);
```

3. ไปที่ **Settings → API** คัดลอก `Project URL` และ `anon public key` ไปใส่ใน `.env`

---

## 📞 การตั้งค่า Twilio

1. สมัครที่ [twilio.com](https://twilio.com)
2. **Verify เบอร์โทร** ที่ต้องการรับแจ้งเตือน (Phone Numbers → Verified Caller IDs)
3. **รับเบอร์ Twilio ฟรี** (Phone Numbers → Manage → Buy a number)
4. คัดลอก `Account SID` และ `Auth Token` จาก Dashboard และใส่ใน `.env`

> ⚠️ **Twilio Trial Account** ส่งได้เฉพาะเบอร์ที่ Verify แล้วเท่านั้น ต้อง Verify เบอร์ Caregiver ก่อนใช้งาน

---

## 📡 API Reference

### Base URL

```
https://your-api.onrender.com
```

### Authentication

ทุก Request ต้องส่ง API Key ใน Header:

```
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

---

### `POST /api/v1/predict`

รับ CSI Features จาก ESP32 และทำนายการล้ม

**Request Body:**

```json
{
  "device_id": "ESP32_001",
  "timestamp": 1234567890,
  "location": "living_room",
  "features": {
    "amplitude_mean": [0.12, 0.34, 0.56],
    "amplitude_std":  [0.01, 0.02, 0.03],
    "variance": 0.045,
    "energy": 1.23
  }
}
```

**Response:**

```json
{
  "prediction": "fall",
  "confidence": 0.94,
  "risk_score": 94,
  "action": "alert_triggered",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

---

### `GET /api/v1/events`

ดู Event Log ทั้งหมด

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `device_id` | string | - | กรองตาม device |
| `limit` | number | 50 | จำนวนสูงสุดที่ดึง |

**Response:**

```json
{
  "events": [
    {
      "id": "uuid",
      "device_id": "ESP32_001",
      "prediction": "fall",
      "confidence": 0.94,
      "risk_score": 94,
      "location": "living_room",
      "alerted": true,
      "created_at": "2026-02-28T10:30:00Z"
    }
  ],
  "count": 1
}
```

---

### `GET /api/v1/events/falls`

ดูเฉพาะ Fall Events

---

### `POST /api/v1/alert/test`

ทดสอบส่ง SMS และ Voice Call ผ่าน Twilio

---

### `GET /health`

เช็คสถานะ API Server

```json
{ "status": "ok", "timestamp": "2026-02-28T10:30:00.000Z" }
```

---

## 🧪 การทดสอบระบบ

**1. Health Check**

```bash
curl https://your-api.onrender.com/health
curl https://your-ml.onrender.com/health
```

**2. ทดสอบ Prediction**

```bash
curl -X POST https://your-api.onrender.com/api/v1/predict \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "ESP32_001",
    "location": "living_room",
    "features": {
      "amplitude_mean": [0.1, 0.2, 0.3],
      "amplitude_std":  [0.01, 0.02, 0.03],
      "variance": 0.05,
      "energy": 1.5
    }
  }'
```

**3. ทดสอบ Twilio Alert**

```bash
curl -X POST https://your-api.onrender.com/api/v1/alert/test \
  -H "x-api-key: YOUR_API_KEY"
# ควรได้รับ SMS และ Voice Call
```

**4. ดู Event Log**

```bash
curl https://your-api.onrender.com/api/v1/events \
  -H "x-api-key: YOUR_API_KEY"
```

---

## 👥 ทีมผู้พัฒนา

| ชื่อ | GitHub | หน้าที่ |
|------|--------|---------|
| [ชื่อ] | [@username](https://github.com) | ESP32 Firmware & CSI Data Collection |
| [ชื่อ] | [@username](https://github.com) | Backend API (Node.js) |
| [ชื่อ] | [@username](https://github.com) | ML Model (LSTM) & Python Service |
| [ชื่อ] | [@username](https://github.com) | Mobile App (React Native) |

**สถาบัน:** [ชื่อมหาวิทยาลัย]
**ภาควิชา:** [ชื่อภาควิชา]
**ปีการศึกษา:** 2567

---

## 📄 License

MIT License — ใช้เพื่อการศึกษาได้อย่างอิสระ

---

<div align="center">
  Made with ❤️ for elderly care
</div>
