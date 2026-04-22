# 🚨 Hybrid AI-Driven Fall Detection System

ระบบตรวจจับการล้มอัจฉริยะโดยใช้ WiFi CSI (Channel State Information) ร่วมกับ AI/ML
สำหรับผู้สูงอายุหรือผู้ป่วยที่ต้องการการดูแลอย่างใกล้ชิด

---

## 📋 สารบัญ

- [ภาพรวมระบบ](#ภาพรวมระบบ)
- [Alert Flow (Binary + Acknowledge)](#alert-flow-binary--acknowledge)
- [โครงสร้างโปรเจค](#โครงสร้างโปรเจค)
- [เทคโนโลยีที่ใช้](#เทคโนโลยีที่ใช้)
- [การติดตั้ง ESP32](#การติดตั้ง-esp32)
- [การติดตั้ง Backend](#การติดตั้ง-backend)
- [การ Deploy บน Render](#การ-deploy-บน-render)
- [การตั้งค่า Supabase](#การตั้งค่า-supabase)
- [การตั้งค่า Twilio](#การตั้งค่า-twilio)
- [API Reference](#api-reference)
- [การทดสอบระบบ](#การทดสอบระบบ)
- [ทีมผู้พัฒนา](#ทีมผู้พัฒนา)

---

## ภาพรวมระบบ

```
ESP32 #2 (Sender)
    │  WiFi packet
    ▼
ESP32 #1 (Receiver + CSI Sensor)
    │  UDP :5500 (100 pkt/s)
    ▼
Express API (Node.js) ── Render
    │  Forward features
    ▼
ML Service (FastAPI + LSTM v3) ── Render
    │  Binary: fall / no_fall
    ▼
┌──────────────────────────────────────────────────────────┐
│  Fall detected                                           │
│    ├──► บันทึก event ลง Supabase                         │
│    └──► ส่ง Push Notification ไปแอปผู้ดูแล              │
│                                                          │
│         ⏱  รอ acknowledge (default 60 วินาที)            │
│            ┌────────────────┬────────────────┐          │
│            ▼                                 ▼          │
│      ✅ กด "รับทราบ"                   ❌ ไม่ตอบรับ      │
│         จบ flow                              │          │
│                                              ▼          │
│                                  🚨 Escalate ผ่าน Twilio │
│                                     • SMS               │
│                                     • Voice Call        │
└──────────────────────────────────────────────────────────┘
```

### Flow อธิบาย (Binary + Acknowledge System)
1. **ESP32** เก็บสัญญาณ WiFi CSI และส่งข้อมูลผ่าน UDP ไปยัง Cloud
2. **Express API** รับ features แล้วส่งต่อไปยัง ML Service
3. **LSTM v3 Model** ทำนายแบบ binary: `fall` หรือ `no_fall`
4. ถ้าตรวจพบการล้ม → บันทึก event ลง Supabase + **ส่ง Push Notification** ไปยังแอปผู้ดูแลทันที
5. ระบบตั้ง timer รอ **Acknowledgement** ภายในเวลาที่กำหนด (default 60 วินาที)
   - ✅ **ผู้ดูแลกด "รับทราบ" ในแอป** → หยุดแจ้งเตือน + mark event เป็น acknowledged
   - ❌ **หมดเวลาแล้วไม่มีการตอบรับ** → Escalate ฉุกเฉินผ่าน Twilio (SMS + Voice Call)
6. ทุก event + การตอบรับถูกบันทึกลง **Supabase Database**

> 💡 **เหตุผลที่ใช้ Binary + Acknowledge** แทนการแบ่งระดับความรุนแรง (Level A/B/C) — เพราะผู้ดูแลเป็นคนตัดสินใจว่าสถานการณ์นั้นฉุกเฉินจริงหรือไม่ (false positive ตัดออกได้เร็ว, ไม่ spam Twilio เปลือง, UX ชัดกว่า)

---

## Alert Flow (Binary + Acknowledge)

### ⏱ State Machine

```
                         ┌─────────────┐
                         │  DETECTED   │  is_fall = true
                         │  (no alert) │  บันทึก DB
                         └──────┬──────┘
                                │ Push notify
                                ▼
                     ┌────────────────────┐
                     │  AWAITING_ACK      │  เริ่ม timer 60s
                     └──┬──────────────┬──┘
                        │              │
             กด "รับทราบ"              timeout
                        │              │
                        ▼              ▼
               ┌─────────────┐  ┌──────────────┐
               │ ACKNOWLEDGED │  │   ESCALATED  │
               │   (จบ flow)  │  │ SMS + Call   │
               └─────────────┘  └──────────────┘
```

### 🎯 กฎการทำงาน

| เงื่อนไข | การกระทำ |
|---|---|
| `is_fall = false` | ไม่ทำอะไร (ปกติ) |
| `is_fall = true` | 1) บันทึก event<br>2) Push notification<br>3) Start ack timer |
| Ack ภายใน timeout | Mark `acknowledged=true` + cancel timer |
| ไม่ Ack ภายใน timeout | Mark `escalated=true` + ยิง Twilio SMS + Call |
| Device เดิมล้มซ้ำขณะ `AWAITING_ACK` | ไม่สร้าง event ใหม่ (cooldown) |

### ⚙️ พารามิเตอร์ที่ปรับได้ (`.env`)

```env
ACK_TIMEOUT_SECONDS=60    # รอกด ack กี่วินาที
COOLDOWN_SECONDS=300      # ไม่แจ้งซ้ำของ device เดียวกันภายใน 5 นาที
```

---

## โครงสร้างโปรเจค

```
fall-detection/
│
├── 📁 esp32-firmware/              # โค้ดสำหรับ ESP32
│   ├── src/
│   │   ├── main.cpp                # โปรแกรมหลัก
│   │   ├── csi_capture.cpp         # เก็บ CSI Signal
│   │   ├── feature_extract.cpp     # คำนวณ Features
│   │   └── api_client.cpp          # ส่งข้อมูลขึ้น Cloud
│   ├── include/
│   │   ├── config.example.h        # ตัวอย่าง Config (ไม่มีค่าจริง)
│   │   └── config.h                # Config จริง ❌ ไม่ขึ้น GitHub
│   └── platformio.ini
│
├── 📁 express-api/                 # Backend API (Node.js)
│   ├── src/
│   │   ├── index.js                # Entry point
│   │   ├── routes/
│   │   │   ├── predict.js          # POST /api/v1/predict
│   │   │   ├── alert.js            # POST /api/v1/alert/test
│   │   │   └── events.js           # GET  /api/v1/events
│   │   ├── services/
│   │   │   ├── mlService.js        # เรียก Python ML
│   │   │   ├── alertService.js     # Twilio SMS + Voice Call
│   │   │   └── dbService.js        # Supabase
│   │   └── middleware/
│   │       ├── auth.js             # API Key validation
│   │       └── validate.js         # Request validation
│   ├── .env.example                # ตัวอย่าง ENV
│   ├── package.json
│   └── Dockerfile
│
├── 📁 ml-service/                  # ML Service (Python)
│   ├── app/
│   │   ├── main.py                 # FastAPI entry point
│   │   ├── predict.py              # LSTM inference
│   │   ├── preprocess.py           # Preprocessing
│   │   └── schemas.py              # Data models
│   ├── models/
│   │   └── lstm_model.h5           # Model ❌ ไม่ขึ้น GitHub
│   ├── notebooks/
│   │   └── train_model.ipynb       # Notebook สำหรับ train
│   ├── requirements.txt
│   └── Dockerfile
│
├── 📁 supabase/
│   └── schema.sql                  # Database schema
│
├── 📁 docs/
│   ├── architecture.png            # รูป System Diagram
│   └── api.md                      # API Documentation
│
└── README.md
```

---

## เทคโนโลยีที่ใช้

| ส่วน | เทคโนโลยี | หน้าที่ |
|---|---|---|
| Hardware | ESP32 × 2 (AP+STA) | เก็บ CSI Signal |
| Backend API | Node.js + Express | รับข้อมูลจาก ESP32 + จัดการ Escalation |
| ML Service | Python + FastAPI | รัน LSTM Model |
| AI Model | TensorFlow / LSTM v3 | ตรวจจับการล้ม (Binary) |
| Mobile App | React Native + Expo | แสดงแจ้งเตือน + ปุ่มรับทราบ |
| Push Notification | Expo Push Notifications | แจ้งเตือนด่านแรก (ก่อน Twilio) |
| Database | Supabase (PostgreSQL) | เก็บ Event Log + Acknowledge |
| Alert Escalation | Twilio (SMS + Voice Call) | แจ้งเตือนเมื่อไม่มีการตอบรับ |
| Deploy | Render | Host Backend |

---

## การติดตั้ง ESP32

### สิ่งที่ต้องเตรียม
- [PlatformIO](https://platformio.org/) (แนะนำใช้กับ VS Code)
- ESP32 Development Board x2 (Sender + Receiver)
- WiFi Network

### ขั้นตอน

**1. Clone โปรเจค**
```bash
git clone https://github.com/your-username/fall-detection.git
cd fall-detection/esp32-firmware
```

**2. สร้าง config.h จาก config.example.h**
```bash
cp include/config.example.h include/config.h
```

**3. แก้ไข config.h ใส่ค่าจริง**
```cpp
#define WIFI_SSID       "ชื่อ WiFi ของคุณ"
#define WIFI_PASSWORD   "รหัส WiFi ของคุณ"
#define API_KEY         "API Key ที่ตั้งไว้ใน Express"
#define CLOUD_API_URL   "https://your-api.onrender.com"
#define DEVICE_ID       "ESP32_001"
#define LOCATION        "living_room"
```

**4. Upload ขึ้น ESP32**
```bash
pio run --target upload
```

**5. ดู Serial Monitor**
```bash
pio device monitor --baud 115200
```

---

## การติดตั้ง Backend

### สิ่งที่ต้องเตรียม
- Node.js v18+
- Python 3.10+
- LSTM Model file (`lstm_model.h5`) — ดาวน์โหลดจาก [Google Drive](#)

### Express API

**1. ติดตั้ง dependencies**
```bash
cd express-api
npm install
```

**2. สร้างไฟล์ .env**
```bash
cp .env.example .env
```

**3. แก้ไข .env**
```env
PORT=3000
API_KEY=ตั้งรหัสอะไรก็ได้ (ต้องตรงกับ config.h ใน ESP32)

ML_SERVICE_URL=http://localhost:8000

SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your_supabase_anon_key

# Twilio (ใช้เฉพาะตอน escalation — หมดเวลา ack)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1xxxxxxxxxx

# เบอร์ที่รับแจ้งเตือน (ตอน escalate) คั่นด้วย comma
ALERT_PHONES=+66812345678,+66898765432

# Acknowledge window — รอผู้ดูแลกด "รับทราบ" กี่วินาที ก่อน escalate ไปยัง Twilio
ACK_TIMEOUT_SECONDS=60

# Mock โมเดลช่วงโมเดลจริงยังไม่เสร็จ
USE_MOCK_ML=true
```

**4. รัน Server**
```bash
# Development
npm run dev

# Production
npm start
```

---

### ML Service (Python)

**1. ติดตั้ง dependencies**
```bash
cd ml-service
pip install -r requirements.txt
```

**2. วาง Model**
```bash
# วางไฟล์ lstm_model.h5 ไว้ที่
ml-service/models/lstm_model.h5
```

**3. รัน Service**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**4. เช็คว่า Service ทำงาน**
```bash
curl http://localhost:8000/health
# ตอบกลับ: {"status": "ok"}
```

---

## การ Deploy บน Render

### ขั้นตอน

**1. Push โค้ดขึ้น GitHub**
```bash
git add .
git commit -m "initial commit"
git push origin main
```

**2. Deploy Express API**
- ไปที่ [render.com](https://render.com) → New → Web Service
- เชื่อม GitHub repo
- ตั้งค่า:
  ```
  Name:       fall-detection-api
  Root Dir:   express-api
  Build:      npm install
  Start:      npm start
  ```
- เพิ่ม Environment Variables:
  ```
  API_KEY              = (ตั้งเองได้)
  ML_SERVICE_URL       = (URL ของ Python service ที่ deploy แล้ว)
  SUPABASE_URL         = (จาก Supabase)
  SUPABASE_KEY         = (จาก Supabase)
  TWILIO_ACCOUNT_SID   = (จาก Twilio Dashboard)
  TWILIO_AUTH_TOKEN    = (จาก Twilio Dashboard)
  TWILIO_PHONE         = (เบอร์ Twilio ของคุณ)
  ALERT_NUMBERS        = (เบอร์ที่รับแจ้งเตือน คั่นด้วย comma)
  ```

**3. Deploy ML Service**
- Render → New → Web Service
- ตั้งค่า:
  ```
  Name:       fall-detection-ml
  Root Dir:   ml-service
  Build:      pip install -r requirements.txt
  Start:      uvicorn app.main:app --host 0.0.0.0 --port 8000
  ```

> ⚠️ **หมายเหตุ:** ไฟล์ `lstm_model.h5` ต้องอัปโหลดแยก เพราะไม่ได้อยู่ใน GitHub
> แนะนำใช้ Render Disk หรือดาวน์โหลดจาก URL ตอน build

---

## การตั้งค่า Supabase

**1. สมัครที่ [supabase.com](https://supabase.com)**

**2. สร้าง Project ใหม่**

**3. ไปที่ SQL Editor แล้วรัน**
```sql
CREATE TABLE fall_events (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id         TEXT NOT NULL,
  timestamp         BIGINT NOT NULL,
  location          TEXT DEFAULT 'unknown',
  is_fall           BOOLEAN NOT NULL,
  confidence        FLOAT NOT NULL,

  -- Acknowledge tracking
  acknowledged      BOOLEAN DEFAULT FALSE,
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   TEXT,

  -- Escalation tracking (เมื่อไม่มีการตอบรับ)
  escalated         BOOLEAN DEFAULT FALSE,
  escalated_at      TIMESTAMPTZ,
  sms_sent          BOOLEAN DEFAULT FALSE,
  call_made         BOOLEAN DEFAULT FALSE,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_device_id    ON fall_events(device_id);
CREATE INDEX idx_is_fall      ON fall_events(is_fall);
CREATE INDEX idx_acknowledged ON fall_events(acknowledged);
CREATE INDEX idx_created_at   ON fall_events(created_at DESC);
```

**4. คัดลอก Credentials**
- ไปที่ Settings → API
- คัดลอก `Project URL` และ `anon public key`
- นำไปใส่ใน .env

---

## การตั้งค่า Twilio

**1. สมัครที่ [twilio.com](https://twilio.com)**

**2. Verify เบอร์โทรตัวเอง**
- ไปที่ Phone Numbers → Verified Caller IDs
- กด Add a new Caller ID → ใส่เบอร์มือถือ → รับ OTP

**3. รับเบอร์ Twilio ฟรี**
- ไปที่ Phone Numbers → Manage → Buy a number
- กด Get a free number (Trial)

**4. คัดลอก Credentials**
- ไปที่ Dashboard หน้าแรก
- คัดลอก `Account SID` และ `Auth Token`

**5. ใส่ค่าใน .env**
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE=+1xxxxxxxxxx
ALERT_NUMBERS=+66812345678,+66898765432
```

> ⚠️ **Twilio Trial** ส่งได้เฉพาะเบอร์ที่ Verify แล้วเท่านั้น
> ต้องไป Verify เบอร์ Caregiver และ Family ก่อนใช้งานได้

**6. ทดสอบ**
```bash
curl -X POST https://your-api.onrender.com/api/v1/alert/test \
  -H "x-api-key: YOUR_API_KEY"
# ควรได้รับ SMS และ Voice Call
```

---

## API Reference

### Base URL
```
https://your-api.onrender.com
```

### Headers (ทุก Request)
```
x-api-key: YOUR_API_KEY
Content-Type: application/json
```

---

### POST /api/v1/predict
รับ CSI Features จาก ESP32 และทำนายผล

**Request Body**
```json
{
  "device_id": "ESP32_001",
  "timestamp": 1234567890,
  "location": "living_room",
  "features": {
    "amplitude_mean": [0.12, 0.34, ...],
    "amplitude_std":  [0.01, 0.02, ...],
    "variance": 0.045,
    "energy": 1.23
  }
}
```

**Response**
```json
{
  "event_id": "uuid-xxxx",
  "is_fall": true,
  "confidence": 0.94,
  "action": "awaiting_acknowledge",
  "ack_timeout_seconds": 60,
  "timestamp": "2026-04-21T10:30:00.000Z"
}
```

หาก `is_fall: true` ระบบจะส่ง Push Notification ไปแอปทันที
และเริ่ม timer รอ acknowledge 60 วิ หากหมดเวลาจะยิง SMS + โทรผ่าน Twilio อัตโนมัติ

---

### POST /api/v1/alert/ack/:event_id
ผู้ดูแลกด "รับทราบ" → ยกเลิก escalation

**Request**
```
POST /api/v1/alert/ack/uuid-xxxx
Headers: x-api-key: YOUR_API_KEY
Body: { "acknowledged_by": "caregiver_user_id" }
```

**Response**
```json
{
  "event_id": "uuid-xxxx",
  "acknowledged": true,
  "acknowledged_at": "2026-04-21T10:30:25.000Z",
  "acknowledged_by": "caregiver_user_id",
  "escalation_cancelled": true
}
```

> ⏱ ต้องกดภายใน `ack_timeout_seconds` (default 60 วิ) ไม่งั้นระบบจะ escalate ไปแล้ว

---

### GET /api/v1/events
ดู Event ทั้งหมด

**Query Parameters**
```
device_id  (optional) กรองตาม device
limit      (optional) จำนวนสูงสุด default=50
```

**Response**
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

### GET /api/v1/events/falls
ดูเฉพาะ Fall Events

---

### POST /api/v1/alert/test
ทดสอบส่ง Twilio SMS + Voice Call

---

### GET /health
เช็คสถานะ Server

**Response**
```json
{
  "status": "ok",
  "timestamp": "2026-02-28T10:30:00.000Z"
}
```

---

## การทดสอบระบบ

### ทดสอบด้วย Postman หรือ curl

**1. เช็ค Health**
```bash
curl https://your-api.onrender.com/health
```

**2. ทดสอบ Predict**
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
# ควรได้รับ SMS และ Voice Call ที่เบอร์ที่ตั้งไว้
```

---

## ทีมผู้พัฒนา

| ชื่อ | หน้าที่ |
|---|---|
| [ชื่อ] | ESP32 Firmware |
| [ชื่อ] | Backend API |
| [ชื่อ] | ML Model |

**มหาวิทยาลัย:** [ชื่อมหาวิทยาลัย]  
**ภาควิชา:** [ชื่อภาควิชา]  
**ปีการศึกษา:** 2567

---

## License
MIT License — ใช้เพื่อการศึกษาได้อย่างอิสระ