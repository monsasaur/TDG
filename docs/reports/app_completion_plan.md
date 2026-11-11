# แผนปิดงานฝั่งแอป (Mobile Application)

**วันที่สำรวจ:** 13 ต.ค. 2026 · **วิธี:** อ่านไฟล์จริงทั้ง 29 หน้าจอ + `data/` + `lib/` + `contexts/`
ไม่ได้อ้างจาก CLAUDE.md หรือเอกสารเก่า

> **อัปเดต 12 พ.ย. 2026 — ตรวจกับโค้ดจริงอีกรอบ**
>
> | ข้อ | สถานะ |
> |---|---|
> | A1 · A2 · B1–B3 (รอบ 1) | ✅ ทำแล้วใน working tree ตั้งแต่ 13 ต.ค. — **ยังไม่ commit** |
> | A3 หน้า PoP | ❌ ยังไม่มีใน branch ไหน — ใบงานอยู่กับทีมฟรอนต์ (`frontend_req_device_pairing_code.md`) |
> | A4 | ❌ และ**ขัดกับใบงาน** ที่ห้ามใช้ `scan-qr`/`enter-code` (เป็นหน้าเชิญเข้าบ้าน) → ยึดใบงาน ทำหน้าใหม่แทน |
> | C1 | ❌ หนักกว่าที่เขียนไว้: รายการที่ลบกลับมาเองภายใน 10 วิ (AlertsContext เขียนทับทุกรอบดึง) |
> | D · E1–E3 · F3 | ❌ ยังไม่มี |
>
> **พบเพิ่มแล้วแก้แล้ว:** ปุ่มรับทราบส่ง `alerts.id` แทน id ของ fall_events ตั้งแต่ 2 ก.ย. (ได้ 404 แบบเงียบ กดแล้วระบบยังโทร)
> · `device-setup` เติมค่าปลอม `ESP-BT001`/`MyHome_2.4G` · แถว "เครือข่ายปัจจุบัน" ใน `device-details` ไปหน้าจับคู่โดยไม่ส่งชื่อเครื่อง
> · เปลี่ยน WiFi ของอุปกรณ์เดิมแล้วไม่บันทึก `wifi_ssid`
>
> **พบเพิ่ม ต้องให้คนทำ:** ฐานข้อมูลจริงยังไม่ได้รัน `schema.sql` และ Express ยังไม่ต่อ Supabase
> → แอปไม่เคยเห็นเหตุการณ์จริงเลย (วิธีแก้: `live_test_rf_v2.md` หัวข้อ "ให้เหตุการณ์ขึ้นในแอป")

---

## 1. สภาพจริงตอนนี้ — อะไรใช้ของจริงแล้ว

**ข้อค้นพบสำคัญ: การเขียนข้อมูลอยู่ใน "หน้าจอ" ไม่ใช่ใน `data/` hooks**

`data/*.ts` ทั้ง 6 ไฟล์ **อ่านอย่างเดียว** — `grep` หา `.insert(` `.update(` `.delete(` `.upsert(`
ได้ **0 ครั้งทุกไฟล์** ส่วนการเขียนกระจายอยู่ในหน้าจอที่ import `supabaseClient` เอง

| ตาราง | อ่าน | เขียน | เขียนจากไหน |
|---|---|---|---|
| `houses` | `useHouses` | ✅ | `add-house.tsx:44` insert |
| `emergency_contacts` | `useContacts` | ✅ | `add-external-contact.tsx:94` · `edit-contact.tsx:79` |
| `house_contacts` | `useContacts` | ✅ | `add-external-contact.tsx:106` · `edit-contact.tsx:89,100` |
| `devices` | `useDevices` | ❌ **ไม่มีที่ไหนเลย** | — |
| `alerts` | `useAlerts` | ❌ | — |
| system alerts | `useSystemAlerts` | ❌ | — |

**หน้าจอที่คุย Express API:** `home.tsx` ที่เดียว (`fetchFallEvents`, `acknowledgeEvent`)
**push token:** ลงทะเบียนแล้วจริง — `lib/pushNotifications.ts:71` → `lib/api.ts:75`

`lib/api.ts` มีแค่ 4 ฟังก์ชัน: `fetchFallEvents` · `acknowledgeEvent` · `registerPushToken` · `healthCheck`

---

## 2. สิ่งที่ขาด เรียงตาม dependency

### 🔴 A. เส้นทางลงทะเบียนอุปกรณ์ — บล็อก ESP32 ทั้งเส้น

ทำ 4 ข้อนี้ก่อนอย่างอื่น เพราะทุกอย่างปลายน้ำรอมันอยู่:
อุปกรณ์เข้า DB → `fall_events.device_id` จับคู่ `devices.code` ได้ → หา `house_id` ได้ →
`appAlertService` สร้างแถวใน `alerts` ได้ → การแจ้งเตือนโผล่ในแอป

| # | งาน | ไฟล์ | ขนาด |
|---|---|---|---|
| A1 | `select-house` ดึงบ้านจริงแทน hardcode + ส่ง `house_id` ผ่าน router params | `app/select-house.tsx:8` | เล็ก |
| A2 | **`device-setup` insert เข้า `devices`** | `app/device-setup.tsx:39` | เล็ก |
| A3 | หน้าจอกรอก PoP + ส่งเข้า `connect-device` | ใหม่ | กลาง |
| A4 | `scan-qr` / `enter-code` ส่ง `pop` + device code เข้า flow | `app/scan-qr.tsx` · `enter-code.tsx` | กลาง |

**A2 คือจุดที่พังชัดที่สุด** — `handleSave()` สำหรับอุปกรณ์ใหม่ทำแค่ `router.dismiss(4)`
ไม่มี insert ที่ไหน ตั้งค่า BLE เสร็จแล้วอุปกรณ์หายไปเฉย ๆ
ต้อง insert `{ id, house_id, name, code, wifi_ssid, status }` โดย `house_id` เป็น FK บังคับ
จึง **ทำ A1 ก่อน A2 ไม่ได้ข้าม**

**A3/A4 สำคัญเพราะ** `connect-device.tsx:19` อ่าน `pop` จาก `useLocalSearchParams()`
แต่ `grep -rn "pop" app/scan-qr.tsx app/enter-code.tsx app/scan-devices.tsx` ได้ **0 ครั้ง**
→ `pop` เป็น `undefined` ตลอด → `device.connect(undefined)` จับคู่ไม่ผ่านกับ Security 1
**และไม่มี error ที่บอกสาเหตุ** (ยืนยันจากการทดสอบ 13 ต.ค. — ต้องใช้แอป Espressif แทน)

### 🟡 B. ข้อมูล hardcode ที่เหลือ

| # | ไฟล์ | บรรทัด |
|---|---|---|
| B1 | `app/invite-select-house.tsx` | `10: const INITIAL_HOUSES = ["บ้านแม่", "บ้านพ่อ"]` |
| B2 | `app/device-details.tsx` | `19: const HOUSES = [...]` |
| B3 | `app/clear-alerts.tsx` | `11: const HOUSES = [...]` |

`members.tsx` ทำถูกแล้ว (`houses.map(h => h.name)` จาก `useHouses`) — ใช้เป็นแบบได้

### 🟡 C. การลบที่ไม่ persist

**C1 — `clearAlerts` ลบแค่ใน memory** `contexts/AlertsContext.tsx:55` ทำแค่ `setAlerts(...)`
ผู้ใช้กดลบแล้วเหมือนหาย แต่ refresh กลับมาใหม่หมด **เป็นการโกหกผู้ใช้ในเรื่องที่เขาเพิ่งสั่ง**

ต้องตัดสินใจก่อนว่า "ลบ" หมายถึงอะไร — ลบแถวจริง หรือ mark `status` เป็นอ่านแล้ว/ซ่อน
แนะนำอย่างหลัง เพราะ `alerts` ผูกกับ `fall_events` ซึ่งเป็นบันทึกเหตุการณ์ที่ไม่ควรลบ

### 🟠 D. ระบบเชิญสมาชิก — ไม่มี backend เลย

`invite-code` · `invite-qr` · `invite-send` · `enter-code` · `scan-qr`
ทั้ง 5 หน้า `grep supabase` = 0 และ `grep lib/api` = 0 → **เป็น UI เปล่าทั้งชุด**

ต้องมี: ตารางเก็บรหัสเชิญ (รหัส · house_id · อายุ · ใช้แล้วหรือยัง · ใครใช้) +
flow รับรหัสแล้วผูกคนเข้าบ้าน — **แต่ข้อนี้ทำไม่ได้จริงถ้าไม่มี E1** เพราะไม่มี "ผู้ใช้" ให้ผูก

### 🔴 E. บัญชีผู้ใช้ + สิทธิ์ — รากของปัญหาหลายข้อ

**E1 — ไม่มีระบบบัญชีผู้ใช้เลย** แอปคุย Supabase ด้วย anon key ไม่มีตาราง users ไม่มี login
**ผลคือใครเปิดแอปก็เห็นทุกบ้าน** ข้อห้าม "เข้าถึงบ้านอื่นไม่ได้" บังคับไม่ได้จริง
(รายละเอียดใน `role_permission_matrix_0.2.md` ข้อ 2.1)

แนะนำ Supabase Auth + Row Level Security + ตาราง `house_members (house_id, user_id, role)`
ไม่ต้องเขียน auth เอง

**E2 — `audit_logs`** ยังไม่มีตารางและไม่มีการเขียน log ที่ไหน
เอกสารสิทธิ์อ้างถึงมันแต่ระบบไม่มี — ควรมีตั้งแต่ต้นสำหรับ: แก้เบอร์ฉุกเฉิน · กดรับทราบ ·
เปลี่ยน role · ลบข้อมูล

**E3 — การกดรับทราบยังผูกกับตัวตนจริงไม่ได้** `home.tsx:118` ส่ง
`acknowledgeEvent(id, "caregiver")` เป็นสตริงคงที่ ใครกดก็ขึ้นว่า "caregiver"
ตอนนี้ปลอมได้ และบอกไม่ได้ว่าใครรับเรื่องจริง

### 🟠 F. เรื่องสถาปัตยกรรมที่ควรเคาะ

**F1 — การเขียนข้อมูลทั้งหมดข้าม Express API** หน้าจอ insert/update เข้า Supabase ตรง
ด้วย anon key ผลคือ: ไม่มี validation ฝั่งเซิร์ฟเวอร์ · ไม่มีที่แทรก audit log ·
กฎธุรกิจอยู่ในแอป ซึ่งผู้ใช้แก้ APK ได้

ไม่ต้องย้ายทั้งหมดทันที แต่ควรตัดสินใจว่าเส้นไหนต้องผ่าน API
**แนะนำให้ย้ายเฉพาะที่อ่อนไหว:** ผู้ติดต่อฉุกเฉิน · การกดรับทราบ · การลงทะเบียนอุปกรณ์
ที่เหลือ (บ้าน, ชื่ออุปกรณ์) ปล่อยไว้ก่อนได้

**F2 — `devices.status` กับ online/offline ของ admin เป็นสองแหล่งความจริง**
(ค้างมาจาก CLAUDE.md) `status` ฝั่งแอปตั้งเอง · admin คำนวณจาก `last_seen_at`
ควรเลิกใช้ `status` แล้วอนุมานจาก `last_seen_at` อย่างเดียว

**F3 — schema กลุ่ม B ไม่มี `CREATE TABLE` ในรีโป** `houses` · `devices` ·
`emergency_contacts` · `house_contacts` · `alerts` รู้โครงสร้างได้จาก `seed.sql` กับโค้ดเท่านั้น
ถ้าต้องสร้างโปรเจกต์ Supabase ใหม่จะทำไม่ได้ — ควรเขียน `CREATE TABLE` ให้ครบ

---

## 3. ลำดับที่แนะนำ

```
รอบ 1 — ปลดล็อก ESP32 (ทำได้เลย ไม่ต้องรออะไร)
  A1 select-house ดึงบ้านจริง + ส่ง house_id
  A2 device-setup insert เข้า devices        ← จุดที่พังชัดสุด
  B1 B2 B3 เลิก hardcode HOUSES ที่เหลือ
  → ผลที่ได้: ตั้งค่าอุปกรณ์ผ่าน BLE แล้วอุปกรณ์โผล่ในแอป
             และการแจ้งเตือนจาก ESP32 จะผูกกับบ้านได้

รอบ 2 — ปิด flow จับคู่ด้วยแอปเราเอง
  A3 หน้าจอกรอก PoP
  A4 scan-qr / enter-code ส่ง pop เข้า flow
  → ผลที่ได้: เลิกต้องใช้แอป Espressif ทดสอบ

รอบ 3 — ความซื่อสัตย์ของ UI
  C1 clearAlerts ให้ persist จริง (หรือเปลี่ยนเป็น mark-as-read)
  F3 เขียน CREATE TABLE ให้ครบ

รอบ 4 — บัญชีผู้ใช้ (ก้อนใหญ่ ควรเคาะขอบเขตก่อนเริ่ม)
  E1 Supabase Auth + house_members + RLS
  E3 ack ผูกกับตัวตนจริง
  E2 audit_logs
  D  ระบบเชิญสมาชิก  ← ต้องมี E1 ก่อน

รอบ 5 — เก็บงาน
  F1 ย้ายเส้นอ่อนไหวไปผ่าน Express API
  F2 เคาะเรื่อง devices.status
```

**เหตุผลที่จัดลำดับแบบนี้** รอบ 1 ใช้แรงน้อยที่สุดแต่ปลดล็อกงานฮาร์ดแวร์ที่ลงทุนไปแล้วเยอะ
(firmware build/flash/BLE ผ่านหมดแล้ว ติดอยู่ที่แอปไม่ insert อุปกรณ์เท่านั้น)
ส่วนรอบ 4 เป็นก้อนที่ใหญ่สุดและเปลี่ยนโครงหลายที่ ไม่ควรเริ่มก่อนที่ของพื้นฐานจะนิ่ง

---

## 4. ที่ยังไม่ได้ตรวจในรอบนี้

- ไม่มีเทสต์ฝั่งแอปเลยหรือไม่ (ยังไม่ได้ดู)
- `components/` 31 ตัว ยังไม่ได้ไล่ว่ามีอันไหนรับ prop เป็นข้อมูลปลอม
- หน้าที่เป็นแค่ navigation hub (`manage-home` 33 บรรทัด · `settings` 50 บรรทัด)
  ตรวจแล้วว่าเป็น hub ปกติ ไม่ใช่ stub ที่ค้างงาน
