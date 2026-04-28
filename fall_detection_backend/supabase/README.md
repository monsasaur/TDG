# คู่มือจัดการ Mockup Data บน Supabase

คู่มือนี้สำหรับสมาชิกในทีมที่ต้องการ **กู้คืนข้อมูล mockup** ในกรณีที่มีคนเผลอลบข้อมูลใน Supabase
(เช่น ลบบ้าน ลบ contact ลบ alert ระหว่าง demo) ทำตามขั้นตอนใน 2-3 นาทีก็ได้ข้อมูลกลับครบ

---

## สารบัญ

1. [ไฟล์ในโฟลเดอร์นี้](#1-ไฟล์ในโฟลเดอร์นี้)
2. [เมื่อไหร่ต้องรัน seed.sql](#2-เมื่อไหร่ต้องรัน-seedsql)
3. [คำเตือนก่อนรัน (สำคัญ!)](#3-คำเตือนก่อนรัน-สำคัญ)
4. [วิธีรัน — Supabase Dashboard (วิธีหลัก)](#4-วิธีรัน--supabase-dashboard-วิธีหลัก)
5. [ข้อมูลที่จะถูกใส่กลับเข้าไป](#5-ข้อมูลที่จะถูกใส่กลับเข้าไป)
6. [วิธีตรวจว่ารันสำเร็จ](#6-วิธีตรวจว่ารันสำเร็จ)
7. [แก้ไขข้อมูล mockup ในอนาคต](#7-แก้ไขข้อมูล-mockup-ในอนาคต)
8. [Troubleshooting](#8-troubleshooting)
9. [FAQ](#9-faq)

---

## 1. ไฟล์ในโฟลเดอร์นี้

```
fall_detection_backend/supabase/
├── schema.sql       ← schema ของตาราง fall_events (ผลตรวจจับจาก ML)
├── seed.sql         ← ข้อมูล mockup สำหรับ demo (5 ตาราง)
└── README.md        ← คู่มือนี้
```

| ไฟล์ | ใช้ตอนไหน |
|---|---|
| `schema.sql` | ครั้งแรกที่สร้าง Supabase project (สร้าง table) |
| `seed.sql` | กู้ข้อมูล mockup เมื่อข้อมูลหาย/เสียหาย |

---

## 2. เมื่อไหร่ต้องรัน seed.sql

รันเมื่อ:
- เผลอลบ row ใน Supabase Dashboard
- มีคน update field ผิดจน demo พัง
- ต้อง reset ข้อมูลกลับเป็นค่าเริ่มต้นก่อนนำเสนอ
- เพิ่งสร้าง Supabase project ใหม่ (ใช้คู่กับ `schema.sql`)

**ไม่ต้องรัน** ถ้า:
- ข้อมูลปกติดี ไม่มีอะไรเสีย
- ต้องการเพิ่มข้อมูลใหม่ (ให้ INSERT เพิ่มจาก Dashboard แทน — seed.sql จะลบของเก่าทิ้ง)

---

## 3. คำเตือนก่อนรัน (สำคัญ!)

> ⚠ **seed.sql จะลบข้อมูลทั้งหมดใน 5 ตารางก่อนใส่ใหม่**

ตารางที่จะถูก **ลบทั้งหมด** แล้วใส่ใหม่:

- `alerts`
- `house_contacts`
- `devices`
- `emergency_contacts`
- `houses`

ตารางที่ **ไม่ถูกแตะต้อง:**

- `fall_events` (ข้อมูลดิบจาก ML — ไม่เกี่ยวกับ mockup)
- ตารางอื่นๆ ที่ไม่ได้อยู่ในรายการข้างบน

ถ้ามีข้อมูลจริง (ไม่ใช่ mockup) อยู่ในตารางเหล่านี้ **ห้ามรัน** จนกว่าจะ backup ก่อน

---

## 4. วิธีรัน — Supabase Dashboard (วิธีหลัก)

### ขั้นตอน

1. **เปิด Supabase Dashboard**
   - ไปที่ https://supabase.com/dashboard
   - ล็อกอินด้วย account ที่ owner เพิ่มเข้ามา
   - เลือก project `uszsloljezycwqebultu` (หรือชื่อ project ที่ทีมตั้ง)

2. **เปิด SQL Editor**
   - ที่แถบเมนูซ้าย คลิกไอคอน `SQL Editor` (รูป `>_`)
   - กด `+ New query` มุมขวาบน

3. **Copy เนื้อหาไฟล์ `seed.sql`**
   - เปิดไฟล์ `fall_detection_backend/supabase/seed.sql` ในโปรเจกต์
   - เลือกทั้งหมด (`Cmd+A` / `Ctrl+A`) แล้ว copy

4. **Paste ลงใน SQL Editor**
   - คลิกใน editor → paste (`Cmd+V` / `Ctrl+V`)

5. **กด Run**
   - มุมขวาล่างของ editor จะมีปุ่ม `Run` (หรือกด `Cmd+Enter` / `Ctrl+Enter`)
   - รอประมาณ 1-2 วินาที

6. **ดูผลลัพธ์**
   - ที่แถบ Results ด้านล่าง จะเห็นตารางสรุปแบบนี้:

   ```
   table_name           count
   houses               5
   devices              4
   emergency_contacts   9
   house_contacts       12
   alerts               5
   ```

   ถ้าเห็นตัวเลขครบตามนี้ = สำเร็จ

---

## 5. ข้อมูลที่จะถูกใส่กลับเข้าไป

### 5 บ้าน (houses)
| ID | ชื่อ |
|---|---|
| h1 | บ้านแม่ |
| h2 | บ้านพ่อ |
| h1776870383872 | บ้านไซม่อนคุง |
| h1776870599070 | บ้านกันกันเดอะกานต์ |
| h1776872530513 | บ้านนี้มีรัก |

### 4 อุปกรณ์ (devices)
| Code | ชื่อ | บ้าน | สถานะ |
|---|---|---|---|
| ESP-0001A | Esp32 - ห้องนอน | บ้านแม่ | disconnected |
| ESP-0002B | Esp32 - ห้องครัว | บ้านแม่ | connected |
| ESP-0003C | Esp32 - ห้องนอน | บ้านพ่อ | connected |
| ESP-0004D | Esp32 - ห้องน้ำ | บ้านพ่อ | disconnected |

> หมายเหตุ: 2 ตัวที่เป็น `disconnected` จะแสดงใน System Alerts ของแอป

### 9 contacts (emergency_contacts)
| ชื่อ | เบอร์ | ประเภท |
|---|---|---|
| คุณ (ฉัน) | 0899559566 | self |
| ตังเม | 0953445665 | member |
| พี่สาว | 0834306657 | member |
| สมหญิง | 0934565555 | external |
| ไซม่อน | 0959536657 | external |
| พอร์ช | 0656576777 | external |
| วิว2 | 0844564777 | external |
| ออม | 0899999999 | external |
| มามะ | 06233333333 | external |

### 5 การแจ้งเตือน (alerts)
| ID | บ้าน | สถานะ | ผู้รับสาย | เวลา |
|---|---|---|---|---|
| a1 | บ้านแม่ | active | (กำลังนับถอยหลัง) | ตอนนี้ |
| a2 | บ้านแม่ | completed | ฉัน | 2 ชม.ที่แล้ว |
| a3 | บ้านแม่ | no_response | — | 5 วันที่แล้ว |
| a4 | บ้านพ่อ | completed | น้อม | 7 วันที่แล้ว |
| a5 | บ้านแม่ | completed | เบอร์ 1669 | 15 วันที่แล้ว |

> เวลาของ alerts ใช้ `NOW() - INTERVAL` ทุกครั้งที่รัน → จะ "สด" เสมอ ไม่ค้างที่วันเก่า

---

## 6. วิธีตรวจว่ารันสำเร็จ

### วิธีที่ 1: ดู count ใน SQL Editor
ที่ตอนท้ายของ seed.sql มี `SELECT COUNT(*)` ของแต่ละตารางอยู่แล้ว ถ้าตัวเลขครบตามที่ระบุในข้อ 4 ขั้นตอนที่ 6 = OK

### วิธีที่ 2: เปิดแอปทดสอบ
- หน้า Home ควรจะมี:
  - Alerts active 1 รายการ (กำลังนับถอยหลัง)
  - System alerts จากอุปกรณ์ disconnected 2 ตัว
  - รายการบ้าน 5 บ้าน
- หน้า History ควรจะมี alert 4 รายการที่ผ่านมา (a2, a3, a4, a5)
- หน้า Members ควรจะมี contact ครบ 9 คน

### วิธีที่ 3: ตรวจผ่าน Table Editor
- ใน Dashboard เมนู `Table Editor` → เลือกตารางที่อยากดู
- เลื่อนดู row ทั้งหมดได้

---

## 7. แก้ไขข้อมูล mockup ในอนาคต

ถ้าอยากเปลี่ยน/เพิ่ม mockup data ให้ทำในไฟล์ `seed.sql` แล้ว commit เข้า git:

1. เปิด `fall_detection_backend/supabase/seed.sql`
2. แก้ไข INSERT ของตารางที่ต้องการ (เพิ่ม row ใหม่ หรือแก้ค่าเดิม)
3. ทดลองรันใน Supabase Dashboard → SQL Editor → Run
4. ถ้าทำงานถูกต้อง → commit ไฟล์เข้า git

> ⚠ **อย่าลืม commit** — ถ้าแก้แค่ใน Dashboard อย่างเดียว เพื่อนคนอื่นจะไม่ได้ data version ใหม่

### ตัวอย่าง: เพิ่มบ้านที่ 6

แก้ส่วน `INSERT INTO houses` ใน `seed.sql`:

```sql
INSERT INTO houses (id, name, created_at) VALUES
  ('h1',              'บ้านแม่',              NOW() - INTERVAL '36 days'),
  ...
  ('h_new_001',       'บ้านน้อง',             NOW() - INTERVAL '1 day');  -- ← เพิ่มบรรทัดนี้
```

ถ้าจะมี contact ที่ดูแลบ้านใหม่ ก็แก้ `INSERT INTO house_contacts` เพิ่มด้วย

---

## 8. Troubleshooting

### Error: `relation "houses" does not exist`
- **สาเหตุ:** ยังไม่ได้สร้าง table ใน Supabase
- **แก้:** รัน DDL ของแต่ละ table ก่อน (มีอยู่ใน Supabase project)
  ปัจจุบันมีแค่ `schema.sql` สำหรับ `fall_events` — table อื่นๆ ถูกสร้างผ่าน Dashboard
  ถ้า project ใหม่ต้องสร้าง table เอง

### Error: `duplicate key value violates unique constraint`
- **สาเหตุ:** มี row ที่ id ซ้ำอยู่ก่อนแล้ว
- **แก้:** seed.sql มี `DELETE FROM ...` อยู่แล้ว ถ้ายัง error แสดงว่าอาจรันแค่ INSERT ไม่ได้รัน DELETE ก่อน — copy ทั้งไฟล์ใหม่อีกครั้ง

### Error: `violates foreign key constraint`
- **สาเหตุ:** ลำดับ DELETE/INSERT ไม่ถูกต้อง (มี row ที่อ้างถึง parent ที่หายไป)
- **แก้:** seed.sql เรียงลำดับไว้ให้แล้ว ถ้ายัง error แปลว่าอาจมีตารางอื่นที่ผูก FK กับตารางเหล่านี้ — ตรวจ Dashboard → Database → Tables → ดู FK ของแต่ละตาราง

### Run แล้วแอปยังไม่อัปเดต
- **สาเหตุ:** แอป cache ข้อมูลไว้
- **แก้:** ปิดแอปแล้วเปิดใหม่ หรือ pull-to-refresh ในหน้านั้น

### ลืม URL ของ Supabase project
- ดูที่ `data/supabaseClient.ts` ในโปรเจกต์ — มี `supabaseUrl` อยู่บรรทัดบนๆ
- หรือดูใน Supabase Dashboard → Settings → API

---

## 9. FAQ

**Q: ปลอดภัยไหมที่จะรัน seed.sql ใน production?**
A: **ไม่ปลอดภัย** ถ้า production มีข้อมูลจริง — เพราะ script จะลบทุก row ใน 5 ตารางก่อน
รันเฉพาะใน Supabase ของ dev/demo เท่านั้น

**Q: รันแล้วเสีย กู้กลับได้ไหม?**
A: ไม่ได้แบบ undo ตรงๆ — แต่ Supabase มี Database Backups (เมนู Settings → Database → Backups)
ถ้าจ่าย plan ที่มี Point-in-time recovery สามารถ restore กลับได้
สำหรับ free plan: ไม่มี backup อัตโนมัติ ต้อง backup เองก่อนรัน

**Q: รันใน Express API หรือ Mobile App ได้ไหม?**
A: ได้ในหลักการ แต่ไม่แนะนำ — เพราะ:
- Express API ใช้ anon key ที่อาจไม่มี DELETE permission ในอนาคต
- Mobile App ไม่ควรมี logic ลบข้อมูลแบบนี้
- รันใน SQL Editor ตรงๆ ดีที่สุด เห็นผล + ตรวจสอบง่าย

**Q: ทำไมถึงไม่ใช้ Supabase Migrations?**
A: Migrations เหมาะสำหรับ schema (โครงสร้าง table) ไม่เหมาะกับ seed data
seed data ต้องการความยืดหยุ่นในการรันซ้ำ + มีจุดประสงค์เฉพาะสำหรับ demo
ถ้าโปรเจกต์โตขึ้นจริงจัง ควรพิจารณา Supabase CLI + migration framework แยกต่างหาก

**Q: ใช้ที่อื่นได้ไหม เช่น staging environment?**
A: ได้ — แค่เปลี่ยน Supabase project ที่ login → SQL Editor ให้ตรงกับ env นั้น
แต่ระวัง URL ของ Supabase ใน `data/supabaseClient.ts` ของแอป ก็ต้องชี้ไป staging ด้วย

---

## ติดต่อ

ถ้าทำตามแล้วยังเจอปัญหา ทักใน group chat ของทีมได้เลย
หรือเปิด issue ใน repo: `gh issue create --title "seed.sql ใช้ไม่ได้"`
