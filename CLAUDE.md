# Fall Detection System — CLAUDE.md

## Current Status (2026-09-01)

### ✅ ทำเสร็จแล้ว

| Feature | สถานะ | หมายเหตุ |
|---|---|---|
| LSTM v3 model | ⚠️ | 99.7% วัดด้วย split ที่ข้อมูลรั่ว · ไม่รั่วได้ 95.6% · **แต่ 95.6% นั้นมาจากการแยก session ไม่ใช่การจับการล้ม** — ความสามารถจริงราว 72.6% · ดู `docs/reports/data_quality_audit_2026-09.md` |
| Express API (core) | ✅ | predict, events, alert endpoints |
| Push Notification (FCM V1) | ✅ | pushService.js + Expo SDK + useFcmV1 |
| Escalation / Acknowledge flow | ✅ | escalationService.js — timer in-memory, Twilio fallback |
| Push token registration | ✅ | `POST /api/v1/push/register` |
| Demo trigger endpoint | ✅ | `POST /api/v1/demo/fire` — ข้าม ML ไปยิง push ตรงๆ |
| Mobile app (Expo) | ✅ | 31 หน้า — login/สมัคร/บ้าน/สมาชิก/ผู้ติดต่อฉุกเฉิน/อุปกรณ์/แจ้งเตือน · รับ push · รายการแจ้งเตือนดึงตาราง `alerts` ทุก 10 วิ · กดรับทราบผ่าน `AlertsContext.acknowledgeAlert` (แก้ 2026-11-12 — ตั้งแต่ 2 ก.ย. ปุ่มส่ง `alerts.id` แทน id ของ fall_events ได้ 404 แบบเงียบ กดแล้วระบบยังโทรฉุกเฉิน) |
| Supabase schema | ⚠️ | `schema.sql` ครบ แต่**ฐานข้อมูลจริงยังไม่ได้รันส่วนที่เพิ่มหลัง ก.ย.** — ดูแถว "ฐานข้อมูลจริง + Express ยังไม่ต่อกัน" |
| ESP32 USB Serial mode | ✅ | csi_collector_serial.py @ 921600 baud |
| End-to-end demo flow | ⚠️ | ESP32 → API → Push → Twilio ใช้ได้ · **รายการในแอปยังไม่เห็นเหตุการณ์จริง** จึงกดรับทราบจากรายการไม่ได้ (ตรวจ 2026-11-12 — ดูแถว "ฐานข้อมูลจริง + Express ยังไม่ต่อกัน") |
| Admin Client API | ✅ | 6 endpoints + auth แยกจาก x-api-key — ดู `docs/reports/admin_api_progress.md` |
| Escalation timer persistence | ✅ | สร้าง timer ใหม่จาก DB ตอน boot + sweeper ทุก 60 วิ ไม่ใช้ Redis |
| บัญชีผู้ใช้ รอบแรก | ⚠️ | login เบอร์โทร + รหัสผ่าน (Supabase Auth) · สิทธิ์ owner/caregiver ด้วย RLS · เชิญเข้าบ้านด้วยรหัส 6 ตัว/QR ของจริง · ทดสอบแล้ว (SQL 14/14 · web 29/29) **แต่ยังไม่เปิดบนฐานจริง** — ต้องเปิด Phone provider + รัน `accounts.sql` **หลัง**ทดสอบสด · dev client ต้อง build ใหม่ (AsyncStorage) · **รอบ 2 (13 พ.ย.):** push เฉพาะสมาชิกบ้าน + กดรับทราบต้อง login เป็นสมาชิก (มีผลหลังรัน accounts.sql) · ดู `docs/reports/accounts_round1.md` |

### 🔲 ยังค้าง (Pending)

| Feature | Priority | หมายเหตุ |
|---|---|---|
| Threshold tuning | Med | หาแล้วสำหรับ RandomForest — แนะนำ 0.36 (recall 97.6%, false alarm 9.6%) เหลือแค่ตัดสินใจว่าจะเปลี่ยน production model ไหม |
| BLE WiFi Provisioning | Med | ตรวจกับโค้ด 2026-11-12: ✅ build/flash บอร์ดจริง (13 ต.ค. · ESP-IDF v5.4 · บอร์ด 4MB · มือถือเห็น BLE) · ✅ บันทึกอุปกรณ์ลง Supabase + เลือกบ้านจริง (`device-setup` / `select-house`) · ✅ หน้ากรอกรหัสจับคู่ (PoP) `app/device-pairing-code.tsx` (2026-11-12 · สแกน QR หรือพิมพ์ · ทดสอบแบบกดจริงในโหมดจำลองแล้ว) · เหลือ: 1) จับคู่บอร์ดจริงจนจบ — ส่ง WiFi ผ่าน BLE + ปุ่ม BOOT ค้าง 5 วิ + สแกน QR ด้วยกล้องจริง (ยังไม่เคยทดสอบ ต้องมี dev client + firmware โหมด production) 2) ขั้นตอนผลิต device code + PoP + QR บนกล่อง (default เป็นค่าเดียวกันทุกเครื่อง · รูปแบบ QR ยังไม่ได้กำหนด แอปรับทั้งรหัสล้วนและ JSON ของ Espressif) |
| One-class anomaly model | ✅ ตอบแล้ว | ลอง 4 ตัว ROC-AUC ดีสุด 0.70 เทียบ supervised 0.985 — ใช้แทนไม่ได้กับ feature ชุดนี้ |
| เก็บ dataset ใหม่ (สลับคลาสใน session) | **High** | ✅ **เก็บครบ 5 คน 801 ไฟล์** (2026-11-11 · fall คนละ 80 · ไฟล์กดมาร์คพลาด 1 ไฟล์ย้ายไป `data/raw_excluded/` แล้วเก็บแทน) ไฟล์สะอาด แต่ลิงก์ noise สูงตลอดทุก session (กระตุก 8–12% vs ชุดแรก 3.6% · RSSI กระโดด 30–47% · ปิด Wi-Fi แมคแล้วไม่ช่วย) · **feature เดิมข้ามคนไม่ได้** (เทรน 4 คนทดสอบคนที่ 5: 54.5% ≈ เดาสุ่ม) · **feature แบบเหตุการณ์ + เลื่อนกรอบตอนเทรน** (`experiments/event_features.py`) ได้ **72.9%** (AUC 0.78 · สลับ label สูงสุด 54.5% · ไม่เลื่อนกรอบ 71.0%) · เทรนแค่ 2 คนแรกแล้วทดสอบ 3 คนที่ไม่เคยเห็น 71.7% · ตัวที่โมเดลใช้มากสุด = RSSI ที่สูงขึ้น ~6–7 dB หลังล้ม (ขึ้นกับตำแหน่งวางบอร์ด) · จุดอ่อน: ล้มข้างๆ จับได้ 60% · นอนลงบนพื้นแจ้งผิด 46% · ไซม่อน 63.5% · ตัวเลข+กราฟสไลด์: `experiments/presentation_numbers.py` → `make_figures.py` → `docs/reports/figures/dataset_2026_11/` · ⚠️ 72.9% วัดแบบรู้จังหวะเหตุการณ์ (กรอบอยู่ที่มาร์ค) · **แบบดูต่อเนื่อง (เลื่อนกรอบทุก 0.25 วิ · `experiments/streaming_eval.py`)** ได้แค่ **จับล้ม ~43% แจ้งผิด ~4/ชม.** ที่ threshold 0.4 ยืนยัน 5 กรอบ หลังเพิ่ม feature "นิ่งหลังเหตุการณ์" (เดิม 37% · ประมาณจากไฟล์สั้น · แจ้งผิดเกือบทั้งหมดมาจากตอนเดิน) · เทรนแล้วเป็น `rf_v2_event` (`experiments/train_rf_v2.py`) · ML service สลับด้วย `FALL_MODEL=rf_v2_event` · ตัวตรวจสด `data_collection/fall_monitor.py` · **เหลือ: ทดสอบสดตาม `docs/reports/live_test_rf_v2.md`** → แก้ลิงก์ก่อนเก็บรอบหน้า · ดู `docs/reports/collect_runbook.md` |
| Unseen test scenario | **High** | test set ต้องเป็น session ที่ไม่เคยเห็น ไม่ใช่แค่ไฟล์ที่ไม่เคยเห็น |
| **CSI uplink ในบ้านลูกค้า** | **High** | 🔴 **ยังไม่มีอะไรส่ง CSI ขึ้น cloud เลย** — ทั้งสองทางที่มีอยู่ต้องมีคอมเปิดในบ้าน และ `csi_streamer.py` ยิงตรงไป ML service ข้าม Express API (ไม่มี event/alert/push/escalation) · ตัวเลข + ทางเลือก: `docs/reports/production_csi_uplink_decision.md` |
| **ฐานข้อมูลจริง + Express ยังไม่ต่อกัน** | **High** | ตรวจ 2026-11-12 (อ่านอย่างเดียว): Express `.env` ไม่มี `SUPABASE_URL`/`SUPABASE_KEY` → `dbService` ใช้ mock store ในหน่วยความจำ (`fall_events` บน Supabase มี 0 แถว) · ฐานข้อมูลจริงยังไม่ได้รัน `schema.sql` (ไม่มี `alerts.fall_event_id` · `devices.last_seen_at`/`is_active`/`installed_at` · ตาราง `ml_models`) · `ESP-B96AB8` ยังไม่อยู่ใน `devices` → แอปไม่เห็นเหตุการณ์จริง เห็นแต่ push · หน้า Admin ใช้ไม่ได้ · วิธีแก้: `docs/reports/live_test_rf_v2.md` หัวข้อ "ให้เหตุการณ์ขึ้นในแอป" |
| Production Cloud deploy | Med | **Dockerfile + render.yaml + compose พร้อมแล้ว** · เหลือ: ตัดสินใจเรื่องไฟล์โมเดลที่ถูก gitignore · กรอก env ใน Render · ทดสอบ `docker compose up` (ยังไม่ได้รัน — เครื่องนี้ไม่มี docker) |
| Hybrid AI escalation call | Low | ✅ **Phase 2a merge เข้า dev แล้ว** (PR #34 · 2026-11-12) — เพื่อน implement (OpenTyphoon ไม่ใช่ Claude) + แก้บั๊ก 4 จุด + ข้อความที่มีวงเล็บ/อักษรโรมันถอยไปใช้ข้อความคงที่ · **ปิดเป็นค่าเริ่มต้น** ทำงานเมื่อตั้ง `AI_VOICE_ENABLED=true` + `TYPHOON_API_KEY` · ⚠️ branch นี้ (feature/ml-service) ยังไม่มีโค้ดนี้ — ตอน merge dev เข้ามา ต้องรัน `schema.sql` ที่รวมแล้วบน Supabase ก่อนต่อ Express (โค้ดใหม่เขียนคอลัมน์ `fall_events.escalation_method` ถ้าไม่มี mark escalated จะล้ม) · สเปค `docs/reports/spec_hybrid_ai_escalation_phase2a.md` · Phase 2b ยังไม่อนุญาต ต้องผ่าน shadow mode ก่อน (`docs/reports/hybrid_ai_escalation_design.md`) |

---

## Project Overview

Hybrid AI-driven fall detection system using WiFi CSI (Channel State Information) and an LSTM model. Designed for elderly care — no camera, no wearable device required. Alerts caregivers via SMS and voice call when a fall is detected.

## Repository Structure

```
TDG/
├── app/                          # React Native + Expo (expo-router) — 31 หน้า
│   ├── _layout.tsx  index.tsx  welcome.tsx  home.tsx  settings.tsx
│   ├── login.tsx  register.tsx                                    # เบอร์โทร + รหัสผ่าน (Supabase Auth)
│   ├── houses.tsx  add-house.tsx  select-house.tsx  manage-home.tsx
│   ├── devices.tsx  device-details.tsx
│   ├── scan-devices.tsx  device-pairing-code.tsx  connect-device.tsx  # ← BLE provisioning flow
│   ├── add-network.tsx  wifi-password.tsx  device-setup.tsx       #   ต่อ BLE จริงแล้ว · ทดสอบได้แค่โหมดจำลอง
│   ├── scan-qr.tsx  enter-code.tsx  invite-*.tsx                  # เชิญสมาชิกเข้าบ้าน (ไม่ใช่ PoP) · รหัส 6 ตัว/QR ของจริง · ต้องรัน accounts.sql
│   ├── members.tsx  member-detail.tsx
│   ├── emergency-contacts.tsx  add-external-contact.tsx  edit-contact.tsx
│   └── notifications.tsx  clear-alerts.tsx
├── components/                   # 31 component (การ์ด alert, ปุ่ม, ฟอร์ม, dropdown)
├── contexts/                     # AuthContext, AlertsContext, DevicesContext
├── data/                         # ⚠️ hooks ที่คุยกับ Supabase ตรง ไม่ผ่าน Express API
│   ├── supabaseClient.ts
│   └── useAlerts · useDevices · useHouses · useContacts · useSystemAlerts · houseInvites
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
│   │   ├── scripts/              # hash_admin_password.js, fake_csi_stream.sh,
│   │   │                         # check_live_setup.js (เช็คก่อนทดสอบสด · อ่านอย่างเดียว)
│   │   └── tests/                # 143 เคส (jest · นับ 2026-11-12)
│   ├── ml_service/               # Python + FastAPI ML inference
│   │   ├── app/                  # main.py, predict.py, preprocess.py, schemas.py
│   │   ├── experiments/          # ⭐ eval_harness · check_dataset · audit_data
│   │   │                         #    run_baselines · run_oneclass · run_threshold
│   │   ├── notebooks/            # train_v3.ipynb, preprocess_v2.py
│   │   ├── data_collection/      # csi_collector_serial.py (มีโหมด session สลับคลาส)
│   │   ├── data/sessions/        # manifest ของแต่ละรอบเก็บข้อมูล
│   │   └── models/               # rf_v1.pkl (ใช้จริง), lstm_v3_binary_99acc.h5 (NOT in git)
│   ├── ESP32-CSI-Tool/           # ESP32 firmware submodule
│   └── supabase/                 # schema.sql · accounts.sql (บัญชี + RLS · ยังไม่รันบนฐานจริง) · seed.sql (mock ของแอป)
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

> รายละเอียดทุกขั้น + ข้อห้าม: **`docs/reports/collect_runbook.md`** · firmware/อัตรา CSI: `docs/reports/esp_build_worklog.md` (2026-11-11)

แผนรอบนี้: คนแสดง 5 คน · คนละ session คนละ 80 รอบ = 800 ไฟล์ · ห้องเดียว · **ทาง USB Serial** (#1 เสียบสายกับแมค · แมคเกาะ WiFi บ้านได้)
> เปลี่ยนจาก UDP 2026-11-11 — ขา #1→แมคทาง WiFi ขาดเป็นพัก ๆ เพราะ macOS สแกน WiFi (ต่ำสุด 24 pkt/s) · serial ได้ 98-100 นิ่ง
ท่าถ่วงน้ำหนักตามความยาก (`ACTIVITY_WEIGHT` ใน `csi_collector_serial.py`) · อัตรา CSI 100 pkt/s (ชุดแรก 73 เพราะบั๊ก firmware)

```bash
cd fall_detection_backend/ml_service && source venv/bin/activate

# 1. #1 เสียบสาย USB กับแมค (firmware active_ap/build_serial) · #2 เสียบไฟ · แมคเสียบสายชาร์จ

# 2. เก็บด้วยหน้าเว็บ → http://localhost:8765 · เลือกคนแสดงจากการ์ด · Space/Y/N
caffeinate -i python data_collection/collect_web.py      # serial เป็นค่าเริ่มต้น
#    เปิดพอร์ตแล้ว #1 รีบูต → เปิดหน้าเว็บก่อน แล้วค่อยอุ่นบอร์ด 10-15 นาที · ป้ายบนสุดต้อง ~100 pkt/s · ส่งพลาด/ทิ้งซ้ำ 0
#    แผง "ทดสอบลิงก์" (หน้าแรก): ทุกคนนิ่ง → กระตุก ≤ 5% · RSSI กระโดด ≤ 5% · เดินผ่านจุดทำท่า → การเคลื่อนไหว ≥ 3 เท่า
#    อัตราครบ ≠ ข้อมูลดี — session 20261111_1333 อัตราครบทุกไฟล์แต่กระตุก 9% นำร่องไม่ผ่าน
#    (สำรอง) UDP: CSI_TRANSPORT=udp ... + udp_rate_check.py — ดู runbook หัวข้อ UDP
#    ซ้อมโดยไม่มีบอร์ด: python data_collection/collect_web.py --demo (เขียนลง data/raw จริง — ลบก่อนเก็บจริง)
#    ไฟล์ → data/raw/s<session>_<seq>_<label>_<ท่า>_*.csv · manifest → data/sessions/session_<id>.json (มี actor_id)

# 3. 🚦 ด่านนำร่อง — หลังคนแรกเก็บ ~30 รอบ ก่อนเก็บต่อ (โมเดลแยก fall/non_fall ได้ดีกว่าสุ่มไหม)
python experiments/pilot_check.py --actor 1

# 4. Preprocess → data/processed_v3_framed (dataset A) + processed_v3_continuous (dataset B)
python notebooks/preprocess_v3.py        # ห้ามใช้ preprocess_v2 กับข้อมูลชุดใหม่
#    window 273 pkt (2.73 วิ) · stride 68 · ออก file_ids / session_ids / actor_ids
#    ⚠️ ค้าง: เลือก subcarrier ผิด (ใช้ 0-51 ต้องเป็น 6-31,33-58) + ยังไม่หาร gain ต่อ packet — แก้ก่อนเทรน rf_v2
#    parser ทิ้งแถวเสียจากสาย USB (บรรทัดซ้อน/ขาดกลาง) + เฟรม legacy sig_mode 0 แล้ว (เดิมพังทั้งไฟล์ / เป็นทางลัดของโมเดล)

# 5. ตรวจข้อมูลก่อนเทรน (ใช้กับ dataset A เท่านั้น) — 0 = ผ่าน
CSI_DATA_DIR=data/processed_v3_framed python experiments/check_dataset.py
#    ข้อ "โมเดลจับอะไรอยู่" อาจ FAIL ทั้งที่ข้อมูลดี (ห้องว่าง/ท่านอนเปลี่ยนระดับสัญญาณจริง) — ดูคู่กับผลแบ่งตามคน

# 6. Train rf_v2 (RandomForest) — แบ่ง test ตามคน (leave-one-actor-out) · ยังไม่มี notebook
```

> CLI เดิม `csi_collector_serial.py` (กด `s`) ยังใช้ได้เป็นทางสำรอง · `csi_collector.py` (UDP รุ่นเก่า) ห้ามใช้ — ไม่มีโหมดสลับคลาส

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

> **`x-api-key` แยกตาม scope แล้ว** — `DEVICE_API_KEY` (predict) · `APP_API_KEY` (ack · push/register) ·
> `DEMO_API_KEY` (demo/fire, alert/test · debug: events, push/tokens ที่คืนข้อมูลทุกบ้าน) · scope ไหนไม่ได้ตั้ง จะถอยไปใช้ `API_KEY` เดิม
> คีย์ที่ฝังใน APK จึงสั่งให้ระบบโทรออกไม่ได้ **เมื่อตั้งคีย์แยกจริง** · ดู `src/middleware/auth.js`
> ⚠️ ตรวจ 2026-11-12: `.env` ของ express_api ตั้งแค่ `API_KEY` ตัวเดียว — ทุก scope ยังใช้คีย์เดียวกัน

### Core
- `POST /api/v1/predict` — รับ CSI features จาก ESP32, เรียก ML service, trigger alert ถ้า fall
- `GET  /api/v1/events` — list all events (`?device_id=&limit=50`) · **DEMO_API_KEY** (คืนทุกบ้าน · แอปไม่ได้ใช้)
- `GET  /api/v1/events/falls` — falls only · **DEMO_API_KEY**
- `GET  /health`

### Push Notification
- `POST /api/v1/push/register` — ลงทะเบียน Expo push token (`{ token, device_id, platform }`)
- `GET  /api/v1/push/tokens` — debug: ดู token ทั้งหมด · ใช้ **DEMO_API_KEY** (คืน token ทุกเครื่อง)
- push ตอนตรวจพบการล้ม: ก่อนรัน `accounts.sql` ส่งทุกเครื่อง · หลังรันส่งเฉพาะเครื่องของสมาชิกบ้าน (`pushService.recipientsFor`)

### Acknowledge / Escalation
- `POST /api/v1/alert/ack/:event_id` — ผู้ดูแลกด OK → ยกเลิก escalation timer ·
  `event_id` คือ id ของ `fall_events` (ในแอปคือ `alerts.fall_event_id`) **ไม่ใช่ `alerts.id`** —
  ส่งผิดตัวได้ 404 แล้วระบบโทรตามเวลาเหมือนไม่มีใครกด · หมดเวลาแล้วได้ 409
  · หลังรัน `accounts.sql` ต้องแนบ `Authorization: Bearer <access token ของบัญชี>` และเป็นสมาชิกบ้านของอุปกรณ์ ไม่งั้น 401/403 (`services/accountService.js`)
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
SUPABASE_KEY=...              # service_role ไม่ใช่ anon — จำเป็นหลังรัน accounts.sql (RLS)
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE=...
ALERT_PHONES=+66812345678,+66898765432
```

### ML Service (`fall_detection_backend/ml_service/.env`)
```
# เลือกโมเดล: rf_v1 (ค่าเริ่มต้น · 416 ค่า) | rf_v2_event (28 ค่า · ตัวตรวจแบบดูต่อเนื่อง)
FALL_MODEL=rf_v1
# FALL_THRESHOLD=0.4   # แก้ทับ threshold ของ rf_v2_event
# ⚠️ สองบรรทัดนี้ไม่มีผล — app/predict.py เลือกไฟล์จาก FALL_MODEL เท่านั้น
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
| v3 (LSTM) | `lstm_v3_binary_99acc.h5`, `lstm_v3_binary_best.h5`, `scaler_v3.pkl` | 99.7% (split รั่ว) | เทรนแล้วแต่ **ไม่ได้ใช้ serving** |
| **rf_v1** ✅ | `rf_v1.pkl`, `scaler_rf_v1.pkl` | 95.6% (grouped 5-fold) | **ตัวที่ ML service โหลดจริง** |
| rf_v2_event | `rf_v2_event.pkl` (+ `report_rf_v2_event.json`) | unseen 72.9% ที่มาร์ค · ดูต่อเนื่อง ~43% / แจ้งผิด ~4 ต่อชม. | ใช้เมื่อ `FALL_MODEL=rf_v2_event` · 28 ค่าจาก `app/event_features.py` · ยังไม่ผ่านทดสอบสด |

### v3 Config (LSTM — เทรนไว้ ไม่ได้ใช้ serving)
- Architecture: LSTM 128→64→32
- WINDOW_SIZE: 200, STRIDE: 50, SEQUENCE_LEN: 10
- Features: 8 stats × 52 subcarriers = 416
- Test accuracy 99.7% · Fall recall 100% — **ตัวเลขนี้วัดด้วย split ที่ข้อมูลรั่ว อย่าใช้รายงาน**
  (ที่มา `models/report_v3.json`)
- Train/Val/Test: **1,675 / 359 / 360** = 70/15/15 ของ 2,394 sequence
  (`train_test_split` สุ่ม stratify seed 42 · ไม่ได้แบ่งตามไฟล์บันทึก)

### rf_v1 Config (ตัวที่ ML service ใช้จริง)
- `app/predict.py` hardcode `models/rf_v1.pkl` + `models/scaler_rf_v1.pkl` —
  **ไม่ได้อ่าน `MODEL_PATH` / `SCALER_PATH` จาก .env**
- RandomForest 200 trees · per-window (416 features) ไม่ใช้ sequence
- `FALL_THRESHOLD = 0.55` ใน `predict.py` — ไม่ใช่ 0.5 และไม่ใช่ 0.36 ที่ tuning แนะนำ
- เทรนด้วย `data/processed_v2` 2,412 window · random split test_size=0.15 →
  **train 2,050 / test 362** (ยืนยันจาก `scaler_rf_v1.pkl.n_samples_seen_ = 2050`)
- สคริปต์ที่สร้างไฟล์นี้ไม่อยู่ในรีโป — `data_collection/retrain_rf.py` ใช้ test_size=0.2
  และอ่าน `data/realtime/` ซึ่งสร้างทีหลัง (rf_v1 ลงวันที่ 2026-03-23 · realtime 2026-04-22)

> ⚠️ **ปัญหาที่พบ 2026-09-01** — `train_v3.ipynb` ไม่ได้โหลด `file_ids.npy` ที่ preprocess เซฟไว้
> ทำให้ window จากการล้มครั้งเดียวกัน (ซ้อนกัน 75%) กระจายไปทั้ง train และ test
> และ SEQUENCE_LEN=10 ก็เกินกว่าที่ข้อมูลรองรับ (3 window ต่อไฟล์) → 100% ของ sequence
> ประกอบจากคนละไฟล์ · ฝั่ง serving workaround ด้วยการซ้ำ window เดียว 10 ครั้ง
> **ตัวเลขที่ควรใช้: accuracy 95.6% ±0.5 / fall recall 96.6% ±0.9**
> (RandomForest per-window · StratifiedGroupKFold 5-fold แบ่งตามไฟล์บันทึก · train 80% / test 20% ต่อ fold)
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
                              → train_v3.ipynb   → lstm_v3_binary_99acc.h5, scaler_v3.pkl → models/
```

### Data ปัจจุบัน (data/raw/)

> ⚠️ **ข้อมูลชุดนี้มี session confound** — เก็บ fall ทั้งหมดก่อนแล้วค่อยเก็บ non_fall
> ทำให้สภาพห้องกับคลาสแยกกันไม่ออก โมเดลได้ 95.6% จากการแยก session ไม่ใช่จับการล้ม
> ตรวจซ้ำได้ด้วย `python experiments/audit_data.py` · รายละเอียด `docs/reports/data_quality_audit_2026-09.md`


> ไฟล์ดิบอยู่ใน `data/raw/Data_2.zip` (804 ไฟล์ ยังไม่ได้แตก) · 3 window ต่อไฟล์คงที่

| Class | ท่า | ไฟล์ | Windows |
|---|---|---:|---:|
| fall | ล้มไปข้างหน้า | 100 | 300 |
| fall | ล้มไปข้างหลัง | 100 | 300 |
| fall | ล้มไปข้างๆ | 100 | 300 |
| fall | สดุดล้ม | 100 | 300 |
| non_fall | สะดุดแต่ไม่ล้ม | 82 | 246 |
| non_fall | เดิน | 81 | 243 |
| non_fall | นอนลงบนพื้น | 81 | 243 |
| non_fall | ก้มเก็บของ | 80 | 240 |
| non_fall | ยืนนิ่ง | 80 | 240 |
| **fall รวม** | | **400** | **1,200** (49.8%) |
| **non_fall รวม** | | **404** | **1,212** (50.2%) |
| **รวมทั้งหมด** | | **804** | **2,412** |

สัดส่วนคลาสสมดุลเกือบเป๊ะ 1:1.01 — `class_weight="balanced"` ใน `train_v3.ipynb`
จึงได้น้ำหนัก ~1.0 ทั้งสองคลาส เท่ากับไม่ได้ทำอะไร · `rf_v1` ตั้ง `class_weight=None`

มีคู่ท่าที่ตั้งใจให้แยกยาก: **"สดุดล้ม" (fall) กับ "สะดุดแต่ไม่ล้ม" (non_fall)**

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

### สถานะ (ตรวจกับโค้ด 2026-11-12)

| ส่วน | สถานะ |
|---|:---:|
| UI ทั้ง flow + permission (manifest และ runtime) | ✅ |
| บันทึกอุปกรณ์ลง Supabase หลังตั้งค่าเสร็จ | ✅ `device-setup.tsx` · ไม่มีค่าสำรองปลอมแล้ว |
| `select-house` ดึงบ้านจริง + ส่ง `house_id` ผ่าน flow | ✅ |
| BLE library + Expo config plugin + `lib/provisioning.ts` | ✅ |
| ต่อ 3 หน้าจอเข้ากับ BLE จริง | ✅ |
| **ESP32 firmware — `wifi_provisioning` + `scheme_ble`** | ✅ เขียนแล้ว |
| ปุ่ม reset กลับเข้าโหมดตั้งค่า | ✅ เขียนแล้ว · ⚠️ ยังไม่เคยทดสอบ |
| build / flash / ทดสอบกับบอร์ดจริง | ✅ build + flash + มือถือเห็น BLE (13 ต.ค.) · ❌ ยังไม่เคยส่ง WiFi ผ่าน BLE จนจบ |
| หน้าจอกรอก PoP ในแอป | ✅ `app/device-pairing-code.tsx` (2026-11-12) — ใบงาน `docs/reports/frontend_req_device_pairing_code.md` ปิดแล้ว · ยังไม่เคยสแกน QR ด้วยกล้องจริง |

### สองโหมดใน firmware — เลือกใน menuconfig

`CONFIG_ENABLE_BLE_PROVISIONING` **ค่าเริ่มต้นเป็น `n`**

| โหมด | ทำอะไร |
|---|---|
| `n` — เก็บข้อมูล (ค่าเริ่มต้น) | AP อย่างเดียว ช่องคงที่ ส่ง CSI ผ่าน USB Serial — **โหมดที่ใช้เก็บ dataset อยู่ตอนนี้** |
| `y` — production | ครั้งแรกเปิด BLE ให้แอปตั้ง WiFi บ้าน แล้วทำงาน AP+STA พร้อมกัน |

ตั้งค่าเริ่มต้นเป็น `n` โดยตั้งใจ — **การเก็บ dataset ที่กำลังจะทำต้องไม่ถูกรบกวน**

### ⚠️ สามเรื่องที่ต้องรู้ก่อน build

> ข้อ 1–2 แก้แล้ว build ผ่านจริง 13 ต.ค. — เก็บไว้เป็นเหตุผล · ข้อ 3 ยังเป็นความเสี่ยงที่ต้องทดสอบ

**1. Partition ไม่พอ — ต้องแก้ก่อน**
```
firmware ปัจจุบัน   924 KB
app partition เดิม  1 MB (partitions_singleapp.csv)  → เหลือ 123 KB
NimBLE + provisioning ต้องการอีก ~250-350 KB       → build ไม่ผ่านแน่นอน
```
เพิ่ม `active_ap/partitions.csv` (app 2 MB) และต้องใช้ flash 4 MB
`sdkconfig` เดิมตั้งไว้ 2MB ซึ่งไม่ตรงของจริง — **ยืนยันแล้ว 13 ต.ค. บอร์ดทั้งสองตัวเป็น 4MB** (`esptool.py flash_id`)

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

**build ผ่านแล้ว 13 ต.ค. 2026** (ESP-IDF v5.4 ที่ `~/esp/esp-idf-v5.4`) แต่ทำด้วย**ไฟล์ defaults ไม่ใช่ menuconfig** —
`sdkconfig.defaults` ที่เขียนเองเคยขาดออปชันจำเป็นแบบไม่มี warning 2 ครั้ง (baudrate กลายเป็น 115200 เงียบ ๆ · CSI ปิดจน reboot วน)
คำสั่งที่ใช้ได้จริง: `docs/reports/HANDOFF_2026-10-13.md` ข้อ 3 · บันทึกละเอียด `docs/reports/esp_build_worklog.md`
ยังไม่เคยส่ง WiFi ผ่าน BLE จนจบ และยังไม่เคยทดสอบปุ่ม BOOT ค้าง 5 วิ

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

- ไฟล์โมเดล (`rf_v1.pkl`, `scaler_rf_v1.pkl`, `lstm_v3_binary_99acc.h5`, `scaler_v3.pkl`) NOT committed to git — must be obtained separately · git ติดตามเฉพาะ `report_*.json` กับรูป `.png` ใน `models/`
- `fall_detection_backend/ESP32-CSI-Tool/` **ไม่ใช่ submodule** — เป็นโฟลเดอร์ธรรมดาในรีโปหลัก (ไม่มี `.gitmodules` ไม่มี `.git` ข้างใน · git ติดตามไฟล์ในนั้น 50 ไฟล์) แก้ตรงได้เลย
- **`lib/api.ts`** — URL/คีย์ย้ายไป `app.config.js` แล้ว ตั้งผ่าน `EXPO_PUBLIC_API_BASE_URL` / `EXPO_PUBLIC_API_KEY` · แต่คีย์ยังเป็นตัวเดียวกับ ESP32 อยู่ ดูหัวข้อ Deploy
- **ฐานข้อมูลจริงยังไม่ได้รัน `schema.sql`** (ตรวจ 2026-11-12 แบบอ่านอย่างเดียว) — ไม่มี `alerts.fall_event_id` (Express สร้าง alert ในแอปไม่ได้) · `devices.last_seen_at`/`is_active`/`installed_at` (หน้า Admin พัง) · ตาราง `ml_models` · แก้: วาง `schema.sql` ทั้งไฟล์ใน Supabase SQL Editor แล้วรัน (ทุกคำสั่งเป็น IF NOT EXISTS รันซ้ำได้)
- **`accounts.sql` รันหลังทดสอบสด และหลังลงแอปที่มีหน้า login แล้วเท่านั้น** — เปิด RLS แล้วแอปที่ไม่ได้ login ไม่เห็นอะไรเลย · Express ต้องใช้ service_role ก่อน · ลำดับเต็มใน `docs/reports/accounts_round1.md`
- Express `.env` ยังไม่ได้ตั้ง `SUPABASE_URL`/`SUPABASE_KEY` → `dbService` ใช้ mock store ในหน่วยความจำ เหตุการณ์ไม่ลงฐานข้อมูลและหายเมื่อรีสตาร์ต — แอปเห็นแค่ push ไม่เห็นในรายการ
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

**กลุ่ม B — แอปมือถือ** (`CREATE TABLE IF NOT EXISTS` อยู่ต้น `schema.sql` แล้ว 12 พ.ย. — เขียนตามโค้ดใน `data/` กับ `seed.sql` · ฐานจริงมีตารางอยู่ก่อน คำสั่งนี้จึงไม่แก้ตารางเดิม)

| ตาราง | คอลัมน์ที่ใช้จริง |
|---|---|
| `houses` | `id` · `name` · `created_at` |
| `devices` | `id` (PK เช่น `'d1'`) · `house_id` → houses · `name` · **`code`** (`'ESP-0001A'`) · `wifi_ssid` · `status` · **+ `last_seen_at` · `is_active` · `installed_at`** (เพิ่มโดย `schema.sql` ให้ admin ใช้) |
| `emergency_contacts` | ผู้ติดต่อฉุกเฉิน (self / member / external) |
| `house_contacts` | เชื่อม contact กับบ้าน (many-to-many) |
| `alerts` | `id` · `house_id` · `title` · `description` · `location` · `status` · `answered_by` · `countdown` · `timeline` (JSON) · **+ `fall_event_id`** → ผูกกับ `fall_events` (เพิ่มโดย `schema.sql` — ฐานข้อมูลจริงยังไม่มี ณ 2026-11-12) |

**กลุ่ม C — บัญชีผู้ใช้** (`accounts.sql` · ⚠️ ยังไม่ได้รันบนฐานจริง — ลำดับและเหตุผลใน `docs/reports/accounts_round1.md`)

| ตาราง / ฟังก์ชัน | |
|---|---|
| `house_members` | `house_id` · `user_id` → `auth.users` · `role` (`owner` / `caregiver`) |
| `house_invites` | `code` (6 ตัว ไม่มี I O 0 1) · `house_id` · อายุ 15 นาที · ใช้ได้ครั้งเดียว (`used_by` / `used_at`) |
| `create_house(p_name)` | สร้างบ้าน + ตั้งคนเรียกเป็น owner · เพดาน 5 บ้านต่อคน (นับทุกบ้านที่เป็นสมาชิก) — แอป insert `houses` ตรงไม่ได้แล้ว |
| `create_house_invite(p_house_id)` / `join_house(p_code)` | owner สร้างรหัส · คนถูกเชิญเข้าเป็น caregiver · เพดาน 6 คนต่อบ้าน |
| `house_member_list()` | สมาชิกของทุกบ้านที่คนเรียกอยู่ด้วย พร้อมชื่อ + เบอร์จาก `auth.users` (แอปอ่านตรงไม่ได้) — ใช้กับหน้าสมาชิก |
| `push_tokens.user_id` | เครื่องนี้ login เป็นใคร — Express ส่ง push ของบ้านเฉพาะเครื่องสมาชิก |
| `audit_logs` | ประวัติการเปลี่ยนแปลง — trigger `audit_row` บันทึกเอง (ใครทำ · บ้านไหน · ค่าเก่า/ใหม่) · เจ้าของบ้านอ่านของบ้านตัวเอง · ไม่มีใครแก้/ลบ log ได้ · ยังไม่มีหน้าในแอป |

RLS เปิดทุกตารางกลุ่ม B + C · `fall_events` / `push_tokens` / `ml_models` เปิด RLS แบบไม่มี policy = เข้าได้เฉพาะ service_role
→ **Express ต้องใช้ service_role key** ไม่งั้นเขียนเหตุการณ์ไม่ได้แบบไม่มี error ชัด (`check_live_setup.js` เช็คให้)
`emergency_contacts` ได้คอลัมน์ `created_by` เพิ่ม (คนสร้างต้องเห็นแถวของตัวเองก่อนผูกกับบ้าน)

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

> ⚠️ ทั้งหมดนี้ต้องรัน `schema.sql` บนฐานข้อมูลจริงก่อน (ยังไม่ได้รัน ณ 2026-11-12) —
> ถ้าต่อ Express เข้า Supabase โดยไม่รัน การสร้างแถว `alerts` จะล้มทุกครั้ง (log `❌ [ALERT]`)
> และกดรับทราบจากแอปต้องส่ง `alerts.fall_event_id` ไม่ใช่ `alerts.id` (บั๊กที่แก้ 2026-11-12)

### 🔲 ยังต้องตัดสินใจ

1. **`devices.status` กับ online/offline ของ admin เป็นสองแหล่งความจริง**
   `status` ('connected'/'disconnected') ฝั่งแอปตั้งเอง · admin คำนวณจาก `last_seen_at` ตาม NFR-09
   ควรตัดสินใจว่าจะเลิกใช้ `status` แล้วอนุมานจาก `last_seen_at` อย่างเดียวไหม

### เส้นทางข้อมูลของแอป

```
data/*.ts hooks  ──Supabase client ตรง (anon key + session ของคนที่ login)──►  houses · devices · alerts · contacts
  useAlerts ดึงตาราง alerts ซ้ำทุก 10 วิ                 (แถวจริงเขียนโดย Express · ที่เหลือเป็น seed)
  หลังรัน accounts.sql: RLS กรองให้เห็นเฉพาะบ้านที่เป็นสมาชิก · เปลี่ยนบัญชีแล้ว Alerts/Devices ดึงใหม่เอง

contexts/AuthContext ──► Supabase Auth (เบอร์โทร + รหัสผ่าน · session เก็บใน AsyncStorage)
lib/api.ts  ──► Express API  /alert/ack/:event_id · /push/register · /health
```

กดรับทราบ (`contexts/AlertsContext.tsx` → `acknowledgeAlert`): alert ที่มี `fallEventId` → ส่ง Express
เพื่อยกเลิกการโทร · ข้อมูลตัวอย่างที่ไม่มี → แก้แถว `alerts` ตรง · ส่งไม่สำเร็จจะย้อนสถานะ
และขึ้นข้อความบนหน้า home (เดิมเงียบ) · ถือผลการกดไว้ 30 วิ กันรายการเด้งกลับระหว่างรอฐานข้อมูลตามทัน
