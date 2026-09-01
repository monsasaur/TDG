# Fall Detection API — คู่มือ API

> ⚠️ **ไฟล์นี้สร้างอัตโนมัติ ห้ามแก้มือ**
> แก้ที่ `fall_detection_backend/express_api/src/docs/openapi.js` แล้วรัน `npm run docs`
>
> เวอร์ชันกดยิงได้: รันเซิร์ฟเวอร์แล้วเปิด `http://localhost:3000/docs`

เวอร์ชัน `1.0.0`

ระบบตรวจจับการล้มด้วย WiFi CSI — API ฝั่ง cloud

### การยืนยันตัวตน — คีย์แยกตามผู้เรียก

| scope | header | เรียกอะไรได้ |
|---|---|---|
| device | `x-api-key: DEVICE_API_KEY` | `POST /predict` |
| app | `x-api-key: APP_API_KEY` | `/events`, `/alert/ack`, `/push/register`, `/push/tokens` |
| demo | `x-api-key: DEMO_API_KEY` | `/demo/fire`, `/alert/test`, `/push/test` |
| admin | `Authorization: Bearer <token>` | `/admin/*` (ขอ token จาก `POST /admin/login`) |

scope ไหนไม่ได้ตั้งคีย์เฉพาะไว้ จะถอยไปใช้ `API_KEY` ตัวเดิม

**กด Authorize มุมขวาบนเพื่อใส่คีย์ก่อนลองยิง** — วิธีใช้หน้านี้แบบละเอียดอยู่ที่ `docs/SWAGGER_GUIDE.md`

### หมายเหตุ
- `POST /demo/fire` **สั่งให้ระบบโทรออกจริง** ถ้า `TWILIO_MODE=real` — เช็คก่อนกด
- `/predict` ที่ไม่พบการล้ม จะไม่บันทึกลง DB เพื่อไม่ให้ตารางบวม
- อุปกรณ์เดิมที่เพิ่ง escalate ไปจะติด cooldown (`COOLDOWN_SECONDS`)

---

## สารบัญ

**Detection**

- [`POST /api/v1/predict`](#post-api-v1-predict) — ESP32 ส่ง CSI features เข้ามาให้ทำนาย

**Events**

- [`GET /api/v1/events`](#get-api-v1-events) — ดู event ทั้งหมด
- [`GET /api/v1/events/falls`](#get-api-v1-events-falls) — ดูเฉพาะเหตุการณ์ล้ม
- [`POST /api/v1/alert/ack/{event_id}`](#post-api-v1-alert-ack-event-id) — ผู้ดูแลกดรับทราบ — ยกเลิกการโทรฉุกเฉิน

**Push**

- [`POST /api/v1/push/register`](#post-api-v1-push-register) — ลงทะเบียน Expo push token
- [`GET /api/v1/push/tokens`](#get-api-v1-push-tokens) — ดู token ที่ลงทะเบียนไว้ (debug)

**Demo**

- [`POST /api/v1/alert/test`](#post-api-v1-alert-test) — ⚠️ ทดสอบ Twilio — ส่ง SMS และโทรออกจริงถ้า TWILIO_MODE=real
- [`POST /api/v1/push/test`](#post-api-v1-push-test) — ยิง push ทดสอบไปทุก token
- [`POST /api/v1/demo/fire`](#post-api-v1-demo-fire) — ⚠️ จำลองการล้ม — ข้าม ML ไปสร้าง event จริง

**Admin**

- [`POST /api/v1/admin/login`](#post-api-v1-admin-login) — เข้าสู่ระบบ admin
- [`POST /api/v1/admin/logout`](#post-api-v1-admin-logout) — ออกจากระบบ
- [`GET /api/v1/admin/summary`](#get-api-v1-admin-summary) — ตัวเลขสรุปของ Dashboard
- [`GET /api/v1/admin/events`](#get-api-v1-admin-events) — event ทุกอุปกรณ์ พร้อมตัวกรองและแบ่งหน้า
- [`GET /api/v1/admin/events/{id}`](#get-api-v1-admin-events-id) — รายละเอียด event พร้อมไทม์ไลน์
- [`GET /api/v1/admin/devices`](#get-api-v1-admin-devices) — รายการอุปกรณ์พร้อมสถานะ online/offline

**System**

- [`GET /health`](#get-health) — เช็คว่าเซิร์ฟเวอร์ยังทำงานอยู่

---

## Detection

_ESP32 ส่งข้อมูลเข้ามา_

### `POST /api/v1/predict`

**ESP32 ส่ง CSI features เข้ามาให้ทำนาย**

ใช้ **DEVICE_API_KEY** · ถ้าเป็นการล้มจะบันทึก event, เริ่มจับเวลารอ acknowledge, สร้าง alert ให้แอป และยิง push · ถ้าไม่ล้มจะไม่บันทึกลง DB

**สิทธิ์:** `x-api-key` — ใช้ `DEVICE_API_KEY`

**Request body** (JSON) — จำเป็น

| field | ชนิด | จำเป็น | คำอธิบาย |
|---|---|:---:|---|
| `device_id` | `string` | ✔ | เช่น `ESP-0001A` |
| `timestamp` | `integer` |  | ไม่ส่งมาก็ใช้เวลาปัจจุบัน |
| `location` | `string` |  | ค่าเริ่มต้น `unknown` · เช่น `ห้องนอน` |
| `features` | `array` | ✔ | array ของ array — (sequence_len, 416) |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ทำนายเสร็จ — action บอกว่าเกิดอะไรต่อ |
| `400` | device_id หรือ features ไม่ถูกต้อง |
| `401` | คีย์ผิด หรือใช้คีย์ผิด scope |
| `500` | ทำนายไม่สำเร็จ |

<details><summary>ตัวอย่าง — ไม่ล้ม</summary>

```json
{
  "is_fall": false,
  "confidence": 0.12,
  "action": "monitoring",
  "timestamp": "2026-09-02T04:00:00.000Z"
}
```

</details>

<details><summary>ตัวอย่าง — ล้ม</summary>

```json
{
  "event_id": "e6b1…",
  "is_fall": true,
  "confidence": 0.97,
  "action": "awaiting_acknowledge",
  "ack_timeout_seconds": 60,
  "timestamp": "2026-09-02T04:00:00.000Z"
}
```

</details>

<details><summary>ตัวอย่าง — ติดcooldown</summary>

```json
{
  "is_fall": true,
  "confidence": 0.95,
  "action": "cooldown",
  "timestamp": "2026-09-02T04:00:00.000Z"
}
```

</details>

---

## Events

_ดูเหตุการณ์และกดรับทราบ_

### `GET /api/v1/events`

**ดู event ทั้งหมด**

**สิทธิ์:** `x-api-key` — ใช้ `APP_API_KEY`

**Query / Path parameters**

| ชื่อ | อยู่ที่ | ชนิด | จำเป็น | คำอธิบาย |
|---|---|---|:---:|---|
| `device_id` | query | `string` |  |  |
| `limit` | query | `integer` |  |  (ค่าเริ่มต้น `50`) |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | รายการ event |
| `401` | ไม่ได้รับอนุญาต |

---

### `GET /api/v1/events/falls`

**ดูเฉพาะเหตุการณ์ล้ม**

**สิทธิ์:** `x-api-key` — ใช้ `APP_API_KEY`

**Query / Path parameters**

| ชื่อ | อยู่ที่ | ชนิด | จำเป็น | คำอธิบาย |
|---|---|---|:---:|---|
| `device_id` | query | `string` |  |  |
| `limit` | query | `integer` |  |  (ค่าเริ่มต้น `50`) |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | รายการเหตุการณ์ล้ม |
| `401` | ไม่ได้รับอนุญาต |

---

### `POST /api/v1/alert/ack/{event_id}`

**ผู้ดูแลกดรับทราบ — ยกเลิกการโทรฉุกเฉิน**

ยกเลิก escalation timer และอัปเดต alert ที่แอปแสดงเป็น completed

**สิทธิ์:** `x-api-key` — ใช้ `APP_API_KEY`

**Query / Path parameters**

| ชื่อ | อยู่ที่ | ชนิด | จำเป็น | คำอธิบาย |
|---|---|---|:---:|---|
| `event_id` | path | `string` | ✔ |  |

**Request body** (JSON)

| field | ชนิด | จำเป็น | คำอธิบาย |
|---|---|:---:|---|
| `acknowledged_by` | `string` |  | เช่น `ตังเม` |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | รับทราบแล้ว |
| `401` | ไม่ได้รับอนุญาต |
| `404` | ไม่พบ event |
| `409` | หมดเวลาไปแล้ว ระบบ escalate ไปเรียบร้อย — กดรับทราบไม่ได้อีก |

<details><summary>ตัวอย่าง response</summary>

```json
{
  "event_id": "e6b1…",
  "acknowledged": true,
  "acknowledged_at": "2026-09-02T04:00:20.000Z",
  "acknowledged_by": "ตังเม",
  "escalation_cancelled": true
}
```

</details>

---

## Push

_Push notification_

### `POST /api/v1/push/register`

**ลงทะเบียน Expo push token**

**สิทธิ์:** `x-api-key` — ใช้ `APP_API_KEY`

**Request body** (JSON) — จำเป็น

| field | ชนิด | จำเป็น | คำอธิบาย |
|---|---|:---:|---|
| `token` | `string` | ✔ | เช่น `ExponentPushToken[xxxxxxxx]` |
| `device_id` | `string` |  |  |
| `platform` | `ios` \| `android` |  |  |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ลงทะเบียนแล้ว |
| `400` | ไม่มี token |
| `401` | ไม่ได้รับอนุญาต |

---

### `GET /api/v1/push/tokens`

**ดู token ที่ลงทะเบียนไว้ (debug)**

**สิทธิ์:** `x-api-key` — ใช้ `APP_API_KEY`

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | รายการ token |
| `401` | ไม่ได้รับอนุญาต |

---

## Demo

_⚠️ ใช้สาธิต — สั่งให้ระบบโทรออกจริงได้_

### `POST /api/v1/alert/test`

**⚠️ ทดสอบ Twilio — ส่ง SMS และโทรออกจริงถ้า TWILIO_MODE=real**

ใช้ **DEMO_API_KEY**

**สิทธิ์:** `x-api-key` — ใช้ `DEMO_API_KEY`

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ยิงแล้ว — ดูผลใน sms/call |
| `401` | ต้องใช้ DEMO_API_KEY |

---

### `POST /api/v1/push/test`

**ยิง push ทดสอบไปทุก token**

ใช้ **DEMO_API_KEY**

**สิทธิ์:** `x-api-key` — ใช้ `DEMO_API_KEY`

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ยิงแล้ว |
| `401` | ต้องใช้ DEMO_API_KEY |

---

### `POST /api/v1/demo/fire`

**⚠️ จำลองการล้ม — ข้าม ML ไปสร้าง event จริง**

ใช้ **DEMO_API_KEY** · สร้าง fall event, เริ่มจับเวลา, สร้าง alert ให้แอป, ยิง push · ถ้าไม่มีใครกดรับทราบภายใน 60 วินาที **ระบบจะโทรออกจริง** (เมื่อ TWILIO_MODE=real)

**สิทธิ์:** `x-api-key` — ใช้ `DEMO_API_KEY`

**Request body** (JSON)

| field | ชนิด | จำเป็น | คำอธิบาย |
|---|---|:---:|---|
| `device_id` | `string` |  | ต้องตรงกับ devices.code ที่ผูกกับบ้านแล้ว ไม่งั้น alert จะไม่โผล่ในแอป · ค่าเริ่มต้น `esp32-demo-01` |
| `location` | `string` |  | ค่าเริ่มต้น `ห้องนอนผู้สูงอายุ` |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | สร้าง event แล้ว หรือติด cooldown |
| `401` | ต้องใช้ DEMO_API_KEY |

<details><summary>ตัวอย่าง — สร้างแล้ว</summary>

```json
{
  "event_id": "e6b1…",
  "is_fall": true,
  "confidence": 0.973,
  "action": "awaiting_acknowledge",
  "ack_timeout_seconds": 60,
  "timestamp": "2026-09-02T04:00:00.000Z"
}
```

</details>

<details><summary>ตัวอย่าง — ติดcooldown</summary>

```json
{
  "is_fall": true,
  "action": "cooldown",
  "message": "device อยู่ใน cooldown — ไม่สร้าง event ใหม่"
}
```

</details>

---

## Admin

_หน้าเว็บ admin (ใช้ Bearer token คนละชั้นกับ x-api-key)_

### `POST /api/v1/admin/login`

**เข้าสู่ระบบ admin**

**สิทธิ์:** ไม่ต้องยืนยันตัวตน

**Request body** (JSON) — จำเป็น

| field | ชนิด | จำเป็น | คำอธิบาย |
|---|---|:---:|---|
| `username` | `string` | ✔ |  |
| `password` | `string` | ✔ |  |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ได้ token — เอาไปกด Authorize |
| `401` | username หรือ password ไม่ถูกต้อง |
| `429` | ลองผิดเกินกำหนด รอสักครู่ |
| `503` | ยังไม่ได้ตั้ง ADMIN_USERNAME / ADMIN_PASSWORD_HASH |

<details><summary>ตัวอย่าง response</summary>

```json
{
  "token": "a766d6…",
  "expires_at": "2026-09-02T12:00:00.000Z",
  "username": "admin"
}
```

</details>

---

### `POST /api/v1/admin/logout`

**ออกจากระบบ**

**สิทธิ์:** `Authorization: Bearer` — token จาก `POST /api/v1/admin/login`

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ออกแล้ว |
| `401` | token ไม่ถูกต้องหรือหมดอายุ |

---

### `GET /api/v1/admin/summary`

**ตัวเลขสรุปของ Dashboard**

คำนวณฝั่งเซิร์ฟเวอร์ทั้งหมด · "สัปดาห์นี้" = ย้อนหลัง 7 วันเต็ม · เวลาไทย UTC+7

**สิทธิ์:** `Authorization: Bearer` — token จาก `POST /api/v1/admin/login`

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ตัวเลขสรุป — has_data แยก "ไม่มีข้อมูล" ออกจาก "มีแต่เป็นศูนย์" |
| `401` | token ไม่ถูกต้องหรือหมดอายุ |

<details><summary>ตัวอย่าง response</summary>

```json
{
  "devices": {
    "total": 2,
    "online": 2,
    "offline": 0,
    "has_data": true,
    "offline_after_minutes": 15
  },
  "falls": {
    "today": 2,
    "week": 2,
    "has_data": true
  },
  "escalation": {
    "escalated_week": 0,
    "falls_week": 2,
    "rate": 0,
    "has_data": true
  },
  "window": {
    "today_from": "2026-09-01T17:00:00.000Z",
    "week_from": "2026-08-26T04:00:00.000Z",
    "week_definition": "rolling_7_days",
    "timezone": "UTC+7"
  },
  "calculated_at": "2026-09-02T04:00:00.000Z",
  "truncated": false
}
```

</details>

---

### `GET /api/v1/admin/events`

**event ทุกอุปกรณ์ พร้อมตัวกรองและแบ่งหน้า**

**สิทธิ์:** `Authorization: Bearer` — token จาก `POST /api/v1/admin/login`

**Query / Path parameters**

| ชื่อ | อยู่ที่ | ชนิด | จำเป็น | คำอธิบาย |
|---|---|---|:---:|---|
| `from` | query | `string` |  | เทียบกับ created_at |
| `to` | query | `string` |  |  |
| `device_id` | query | `string` |  |  |
| `status` | query | `pending` \| `acknowledged` \| `escalated` \| `fall` |  |  |
| `limit` | query | `integer` |  |  (ค่าเริ่มต้น `50`) |
| `offset` | query | `integer` |  |  (ค่าเริ่มต้น `0`) |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | รายการ event |
| `400` | status ไม่ถูกต้อง |
| `401` | token ไม่ถูกต้องหรือหมดอายุ |

---

### `GET /api/v1/admin/events/{id}`

**รายละเอียด event พร้อมไทม์ไลน์**

**สิทธิ์:** `Authorization: Bearer` — token จาก `POST /api/v1/admin/login`

**Query / Path parameters**

| ชื่อ | อยู่ที่ | ชนิด | จำเป็น | คำอธิบาย |
|---|---|---|:---:|---|
| `id` | path | `string` | ✔ |  |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | event + timeline |
| `401` | token ไม่ถูกต้องหรือหมดอายุ |
| `404` | ไม่พบ event |

<details><summary>ตัวอย่าง response</summary>

```json
{
  "id": "e6b1…",
  "device_id": "ESP-0001A",
  "status": "acknowledged",
  "ack_latency_seconds": 12,
  "timeline": [
    {
      "step": "detected",
      "at": "2026-09-02T04:00:00.000Z",
      "detail": {
        "confidence": 0.97
      }
    },
    {
      "step": "acknowledged",
      "at": "2026-09-02T04:00:12.000Z",
      "detail": {
        "by": "ตังเม",
        "latency_seconds": 12
      }
    }
  ]
}
```

</details>

---

### `GET /api/v1/admin/devices`

**รายการอุปกรณ์พร้อมสถานะ online/offline**

online/offline คำนวณจาก last_seen_at ฝั่งเซิร์ฟเวอร์ · อุปกรณ์ที่ไม่เคยส่งข้อมูลเลยก็ยังปรากฏ

**สิทธิ์:** `Authorization: Bearer` — token จาก `POST /api/v1/admin/login`

**Query / Path parameters**

| ชื่อ | อยู่ที่ | ชนิด | จำเป็น | คำอธิบาย |
|---|---|---|:---:|---|
| `status` | query | `online` \| `offline` |  |  |
| `include_inactive` | query | `boolean` |  | รวมอุปกรณ์ที่ปลดการติดตั้งแล้ว (ค่าเริ่มต้น `false`) |

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | รายการอุปกรณ์ |
| `400` | status ต้องเป็น online หรือ offline |
| `401` | token ไม่ถูกต้องหรือหมดอายุ |

<details><summary>ตัวอย่าง response</summary>

```json
{
  "devices": [
    {
      "device_id": "ESP-0001A",
      "label": "Esp32 - ห้องนอน",
      "owner_name": "บ้านแม่",
      "location": null,
      "last_seen_at": "2026-09-02T03:59:00.000Z",
      "is_active": true,
      "installed_at": null,
      "status": "online",
      "events": {
        "total": 3,
        "falls": 3,
        "escalated": 1,
        "last_fall_at": "2026-09-02T03:00:00.000Z"
      }
    }
  ],
  "offline_after_minutes": 15,
  "has_data": true,
  "calculated_at": "2026-09-02T04:00:00.000Z"
}
```

</details>

---

## System

### `GET /health`

**เช็คว่าเซิร์ฟเวอร์ยังทำงานอยู่**

**สิทธิ์:** ไม่ต้องยืนยันตัวตน

**Responses**

| รหัส | ความหมาย |
|---|---|
| `200` | ปกติ |

<details><summary>ตัวอย่าง response</summary>

```json
{
  "status": "ok",
  "timestamp": "2026-09-02T04:00:00.000Z"
}
```

</details>

---

<sub>สร้างจาก `src/docs/openapi.js` ด้วย `npm run docs`</sub>
