# 📄 TODO — รายงานโครงงาน บทที่ 3

> ระบบตรวจจับการล้มของผู้สูงอายุด้วย WiFi CSI + LSTM
> Template: `ReportTemplate-ตัวอย่างรูปเล่มสมบูรณ์-2568`
> Font: **TH Saraban NEW** · A4 · Line spacing 1

---

## บทที่ 3 — การวิเคราะห์และออกแบบระบบ

| # | หัวข้อ | Diagram ที่ต้องทำ | เครื่องมือ | Priority | Done |
|---|---|---|---|---|:---:|
| 3.1 | ขั้นตอนการพัฒนาระบบ | Flowchart 5 phase (ศึกษา→วิเคราะห์→ออกแบบ→พัฒนา→ทดสอบ) | draw.io | ⭐⭐ | ☐ |
| 3.2 | สถาปัตยกรรมระบบ (System Architecture) | Diagram ภาพรวม Hardware + Cloud + Client | draw.io / Mermaid | ⭐⭐⭐ | ☐ |
| 3.3 | แผนผังระบบงาน (Context Diagram + DFD Lv1) | Context Diagram (Lv0) + DFD Level 1 | draw.io | ⭐⭐⭐ | ☐ |
| 3.4 | แผนผังเครือข่าย (Network Topology) | ESP32 × 2 + WiFi CSI-Net + Hotspot + Cloud | draw.io | ⭐⭐⭐ | ☐ |
| 3.5 | การออกแบบโมเดล LSTM | Architecture LSTM 128→64→32 + Input/Output | **Netron** (auto from .h5) | ⭐⭐⭐ | ☐ |
| 3.6 | Data Pipeline | CSI→CSV→preprocess→train→model | draw.io | ⭐⭐ | ☐ |
| 3.7 | Sequence Diagram — การแจ้งเตือน | ESP32→API→ML→DB→Twilio→App flow | PlantUML / mermaid | ⭐⭐⭐ | ☐ |
| 3.8 | Use Case Diagram | Actor: ผู้สูงอายุ, ผู้ดูแล, Admin | draw.io / PlantUML | ⭐⭐ | ☐ |
| 3.9 | โครงสร้างฐานข้อมูล (ER Diagram) | Table `fall_events` + ความสัมพันธ์ | **dbdiagram.io** | ⭐⭐⭐ | ☐ |
| 3.10 | พจนานุกรมข้อมูล (Data Dictionary) | ตาราง field description (type, format, PK/FK) | Word table | ⭐⭐⭐ | ☐ |
| 3.11 | การออกแบบ UI (Wireframe) | หน้าจอแอป + screen flow | **Figma** | ⭐⭐ | ☐ |

---

## 📝 รายละเอียดแต่ละ Diagram

### 3.1 ขั้นตอนการพัฒนาระบบ
- **รูปแบบ:** ลิสต์ bullet + Gantt chart (ใช้ `ตารางที่ 1.1` ที่มีอยู่แล้วได้)
- **เนื้อหา:** 5 phase + ระยะเวลาแต่ละ phase

### 3.2 สถาปัตยกรรมระบบ ⭐ **ขอดู Mermaid code ใน chat**
- **Layer:** Hardware → Network → Application → Data → Client
- **Highlight:** privacy-first (ไม่มีกล้อง/wearable), edge+cloud hybrid, multi-level alert

### 3.3 Context Diagram + DFD
- **Context (Lv0):** ระบบตรงกลาง + external entities (ผู้สูงอายุ, Caregiver, Twilio, Supabase)
- **DFD Lv1:** แตก process (CSI Collection → ML Inference → Alert Decision → Notification → Event Log)

### 3.4 Network Topology ⭐ เฉพาะโปรเจคนี้
- ESP32 #1 (Dual AP+STA) ←→ ESP32 #2 ผ่าน "CSI-Net"
- ESP32 #1 STA ←→ Hotspot "View" → UDP :5500 → Mac/Cloud
- อ้างอิง: `CLAUDE.md` หัวข้อ "ESP32 Hardware Setup & Network Topology"

### 3.5 ML Architecture ⭐
- LSTM(128) → Dropout → LSTM(64) → Dropout → LSTM(32) → Dense → Sigmoid
- Input: (seq_len=10, features=416) — 8 stats × 52 subcarriers
- **Tip:** ใช้ Netron เปิด `fall_detection_backend/ml_service/models/lstm_v3.h5` → export PNG อัตโนมัติ

### 3.6 Data Pipeline
```
ESP32 UDP (100 pkt/s)
  → csi_collector.py → raw CSV (400 pkts/file) → data/raw/
  → preprocess_v2.py → X.npy (N, 416), y.npy → data/processed_v2/
  → train_v3.ipynb   → lstm_v3.h5, scaler_v3.pkl → models/
```

### 3.7 Sequence Diagram — Fall Alert
- ESP32 → Express API → ML Service → Supabase → Twilio (SMS/Call) → Mobile App
- แยก 2 scenario: **Level C (โทร+SMS)** vs **Level B (SMS เท่านั้น)**
- รวม Acknowledge flow (caregiver กดยืนยัน → หยุดแจ้งเตือน)

### 3.8 Use Case Diagram
- **Actor:** ผู้สูงอายุ (passive), ผู้ดูแล, Admin
- **Use Case:** ติดตั้งอุปกรณ์, ดูสถานะ, รับแจ้งเตือน, ยืนยันรับทราบ, ดูประวัติ, จัดการ contact

### 3.9 ER Diagram
- อ้างอิงจาก `fall_detection_backend/supabase/schema.sql`
- Table: `fall_events` (id, device_id, timestamp, location, prediction, confidence, risk_score, alerted, created_at)
- ถ้าจะเพิ่ม: `devices`, `caregivers`, `acknowledgments`

### 3.10 Data Dictionary
- ตารางรูปแบบ: `TABLE NAME | ATTRIBUTE | DESCRIPTION | TYPE | FORMAT | REQUIRED | PK/FK`
- ตัวอย่างใน template หน้า 7-8

### 3.11 UI Wireframe
- หน้าจอหลัก: Splash, Welcome, Home, Devices, Add Device, Scan QR, Notifications, Emergency Contacts
- ไฟล์จริงอยู่ใน `/app/*.tsx` → screenshot + flow arrow

---

## 🛠 เครื่องมือแนะนำ

| Tool | ใช้ทำ | URL |
|---|---|---|
| **draw.io** | Architecture, Network, DFD, Use Case | https://app.diagrams.net |
| **Mermaid** | Sequence, Flowchart (เขียน code) | https://mermaid.live |
| **dbdiagram.io** | ER Diagram จาก SQL | https://dbdiagram.io |
| **Netron** | LSTM Architecture auto-generate | https://netron.app |
| **Figma** | UI Wireframe | https://figma.com |
| **PlantUML** | Use Case, Sequence | https://plantuml.com |

---

## ⚠️ ตามรูปแบบ template

- [ ] Font: **TH Saraban NEW** (ป้องกันลิขสิทธิ์)
- [ ] รูปภาพใส่**กรอบ** + ภาพต้อง**ชัด ไม่เบลอ**
- [ ] **ชื่อรูป (caption) อยู่ล่างภาพ** — format: `ภาพที่ 3.X <ชื่อ>`
- [ ] **ชื่อตาราง (caption) อยู่บนตาราง** — format: `ตารางที่ 3.X <ชื่อ>`
- [ ] อ้างอิงแบบ **APA Style 6.0** (ดู https://library.bu.ac.th/wp-content/uploads/2022/10/apa-_thai.pdf)
- [ ] **ห้าม**อ้างอิงจาก Wikipedia / Weblog
- [ ] Paragraph: Line spacing 1, Spacing 0
- [ ] Header/Footer = 0
- [ ] เว็บลิงก์ให้ลบ hyperlink สีน้ำเงินออก

---

## 📋 ลำดับการทำแนะนำ

```
สัปดาห์ 1: 3.2 Architecture → 3.4 Network (ภาพรวมก่อน)
สัปดาห์ 2: 3.5 LSTM → 3.6 Data Pipeline (หัวใจของโปรเจค)
สัปดาห์ 3: 3.3 Context+DFD → 3.7 Sequence → 3.8 Use Case
สัปดาห์ 4: 3.9 ER → 3.10 Data Dictionary → 3.11 UI Wireframe
สัปดาห์ 5: 3.1 ขั้นตอนการพัฒนา (เขียนทีหลังเพราะต้อง summarize ทุกอย่าง)
```

## ✅ เช็คก่อนส่ง

- [ ] ทุก diagram มี caption ครบ
- [ ] ทุก diagram อ้างอิงใน text ก่อน (เช่น "ดังภาพที่ 3.2")
- [ ] สารบัญภาพ / สารบัญตาราง อัพเดตเลขหน้าแล้ว
- [ ] ไม่มีข้อความสีแดง/คำแนะนำจาก template เหลือค้าง
- [ ] Export เป็น PDF เช็คอีกครั้งว่า layout ไม่เพี้ยน
