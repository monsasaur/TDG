# แบ่งส่วนงานโครงการ Fall Detection System

**วันที่:** 2026-09-05
**ที่มาของข้อมูล:** git history (`git shortlog`, `git log --name-only`) + โครงสร้างไฟล์จริงในรีโป ณ branch `feature/ml-service`

> เอกสารนี้เป็นไฟล์ทำงานภายใน ไม่ได้ตั้งใจ commit ขึ้น GitHub

---

## 1. คนในทีมตามที่ git บันทึกไว้

| ชื่อใน git | commits | ไฟล์ที่แตะเป็นหลัก | ตีความ |
|---|---:|---|---|
| `peerawoot` (peerawoot1767@gmail.com + pls2s) | 57 | `ml_service/`, `express_api/`, `ESP32-CSI-Tool/`, `docs/` | ML + Backend + Firmware + เอกสาร |
| `gunnnp` (Pachara Torchot) | 9 | `app/` 89 ครั้ง · `components/` 36 ครั้ง | Frontend UI ล้วน |
| `monsasaur` (Chaiwat Banluesak) | 12 | `app/` 15 · `data/` 11 · merge PR | Data layer (Supabase) + ดูแล repo / merge |
| `AomOrm` (Subhamas Ngiw) | 1 | `eslint.config.js` | ยังไม่มีงานในโค้ด |

---

## 2. แยกส่วนงานเป็น 8 ก้อน

| # | ส่วนงาน | ไฟล์ / โฟลเดอร์ | ขนาด (บรรทัด) | คนที่ทำจริง | สถานะ |
|---|---|---|---:|---|---|
| 1 | **Mobile UI** — 29 หน้าจอ + 31 component | `app/*.tsx`, `components/*.tsx` | ~5,200 | gunnnp | ✅ ครบ |
| 2 | **App data layer** — Supabase hooks, context | `data/*.ts`, `contexts/*.tsx` | ~500 | monsasaur | ✅ ยังใช้ seed data เป็นหลัก |
| 3 | **App ↔ Backend glue** — เรียก Express API, push, BLE | `lib/api.ts`, `lib/pushNotifications.ts`, `lib/provisioning.ts` | ~400 | peerawoot | ✅ |
| 4 | **Express API** — route / service / middleware / escalation | `fall_detection_backend/express_api/src/` | 2,891 (+ test 1,609 / 92 เคส) | peerawoot | ✅ |
| 5 | **ML service (serving)** — FastAPI, preprocess, predict | `fall_detection_backend/ml_service/app/` | 221 | peerawoot | ✅ |
| 6 | **ML research** — เก็บข้อมูล / preprocess / เทรน / audit | `ml_service/data_collection/`, `experiments/`, `notebooks/` | 4,150 | peerawoot | ⚠️ dataset มี session confound ต้องเก็บใหม่ |
| 7 | **ESP32 Firmware** — CSI + BLE provisioning | `fall_detection_backend/ESP32-CSI-Tool/` | 7,663 | peerawoot | ⚠️ เขียนครบ ยังไม่เคย build / flash |
| 8 | **Database + Deploy + Docs** | `supabase/*.sql`, `render.yaml`, `Dockerfile`, `docs/` | — | peerawoot | ⚠️ schema กลุ่ม B ยังไม่มี `CREATE TABLE` ในรีโป |

---

## 3. ข้อสังเกตจากตาราง

- งาน 6 ใน 8 ก้อน (ข้อ 3–8 รวมประมาณ 15,000 บรรทัด) เป็นของคนเดียว
- อีก 2 ก้อนคือ frontend ซึ่ง **เสร็จแล้ว**
- ถ้าจะแบ่งงานกันจริง ต้องแบ่งจาก **งานที่ยังค้าง** ไม่ใช่จากโค้ดที่มีอยู่แล้ว

---

## 4. งานค้าง — เสนอผู้รับผิดชอบ

| งาน | Priority | ต้องใช้ทักษะ | เสนอให้ | หมายเหตุ |
|---|---|---|---|---|
| เก็บ dataset ใหม่ (สลับคลาสภายใน session) | **High** | ไม่ต้องเขียนโค้ด แค่รัน script + ทำท่า | ทีม 2–3 คนช่วยกันเก็บ | กระจายงานได้ดีสุด + ได้ subject หลายคน = ข้อมูลสมจริงขึ้น · ข้อกำหนดใน `data_quality_audit_2026-09.md` |
| Unseen test scenario | **High** | ML | peerawoot | test set ต้องเป็น session ที่โมเดลไม่เคยเห็น |
| CSI uplink ในบ้านลูกค้า | **High** | firmware + backend | peerawoot | 🔴 ยังไม่มีอะไรส่ง CSI ขึ้น cloud เลย · `production_csi_uplink_decision.md` |
| Build / flash firmware BLE | Med | ต้องลง ESP-IDF | คนที่มีเครื่องว่าง | เครื่องที่เขียนโค้ดไม่มี ESP-IDF ติดตั้ง |
| หน้าจอกรอก PoP | Med | React Native | gunnnp | ใบงานพร้อมแล้วที่ `frontend_req_device_pairing_code.md` |
| Docker / Render deploy | Med | DevOps | AomOrm / monsasaur | มี Dockerfile + render.yaml แล้ว เหลือรันจริง |
| ต่อ `data/` hooks จาก seed → ข้อมูลจริง | Med | Supabase | monsasaur | ต่อยอดจากงานเดิมของตัวเอง |
| Threshold tuning | Med | ML | peerawoot | หาแล้วสำหรับ RandomForest (0.36) เหลือตัดสินใจว่าจะเปลี่ยน production model ไหม |
| Hybrid AI escalation call (Phase 2a) | Low | backend | peerawoot | สเปคพร้อม implement แล้ว `spec_hybrid_ai_escalation_phase2a.md` |
| รายงาน / สไลด์ / วิดีโอ demo | — | เขียน | แบ่งตามบท | ch.1–3 มี draft แล้วใน `docs/reports/` |

---

## 5. ช่องให้กรอกเอง

| ส่วนงาน | ผู้รับผิดชอบหลัก | ผู้ช่วย | กำหนดส่ง |
|---|---|---|---|
| Mobile UI | | | |
| App data layer | | | |
| App ↔ Backend glue | | | |
| Express API | | | |
| ML service (serving) | | | |
| ML research + เก็บ dataset | | | |
| ESP32 Firmware | | | |
| Database + Deploy + Docs | | | |
