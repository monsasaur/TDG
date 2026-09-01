-- Fall Detection — Binary + Acknowledge System
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS fall_events (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id         TEXT NOT NULL,
  timestamp         BIGINT NOT NULL,
  location          TEXT DEFAULT 'unknown',

  -- ML output (binary)
  is_fall           BOOLEAN NOT NULL,
  confidence        FLOAT NOT NULL,

  -- Acknowledge tracking
  acknowledged      BOOLEAN DEFAULT FALSE,
  acknowledged_at   TIMESTAMPTZ,
  acknowledged_by   TEXT,

  -- Escalation tracking (เมื่อหมดเวลา ack)
  escalated         BOOLEAN DEFAULT FALSE,
  escalated_at      TIMESTAMPTZ,
  sms_sent          BOOLEAN DEFAULT FALSE,
  call_made         BOOLEAN DEFAULT FALSE,

  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_id    ON fall_events(device_id);
CREATE INDEX IF NOT EXISTS idx_is_fall      ON fall_events(is_fall);
CREATE INDEX IF NOT EXISTS idx_acknowledged ON fall_events(acknowledged);
CREATE INDEX IF NOT EXISTS idx_created_at   ON fall_events(created_at DESC);

-- Expo Push tokens (ลงทะเบียนจากแอปตอนเปิดครั้งแรก/อัพเดต)
CREATE TABLE IF NOT EXISTS push_tokens (
  token       TEXT PRIMARY KEY,
  device_id   TEXT,
  platform    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_device_id ON push_tokens(device_id);

-- ต่อยอดตาราง `devices` ของแอปมือถือให้หน้า Admin Client ใช้ได้
-- ตาม TDG_BA.pdf ข้อ 12.2 จุดที่ 2 — รองรับ FR-16 ถึง FR-21, REP-01 ถึง REP-03
--
-- `devices` มีอยู่แล้วใน Supabase (สร้างจากฝั่งแอป ไม่มี CREATE TABLE ในรีโป):
--     id (PK, 'd1') · house_id → houses · name · code ('ESP-0001A') · wifi_ssid · status
--
-- ตัดสินใจแล้ว 2026-09-01:
--   fall_events.device_id  ↔  devices.code
--
-- ทำไมใช้ code ไม่ใช่ id: `id` เป็น surrogate key ที่ต้องเปลี่ยนได้อิสระ (เช่นย้ายไป UUID)
-- ถ้าเอา firmware ไปผูกกับมัน อุปกรณ์ที่ flash ไปแล้วจะพังทั้งหมดตอน migrate
-- ส่วน `code` คือรหัสที่พิมพ์อยู่บนตัวเครื่อง ซึ่ง BLE provisioning เขียนลง NVS
-- และผู้ใช้สแกน QR ได้อยู่แล้ว — log กับหน้า admin ก็อ่านรู้เรื่องด้วย

ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_active    BOOLEAN DEFAULT TRUE;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ DEFAULT NOW();

-- ค้นด้วย code ตอน ESP32 ส่งข้อมูลเข้ามา — ต้อง unique เพราะเป็นตัวระบุอุปกรณ์จริง
CREATE UNIQUE INDEX IF NOT EXISTS idx_devices_code      ON devices(code);
CREATE INDEX        IF NOT EXISTS idx_devices_is_active ON devices(is_active);
CREATE INDEX        IF NOT EXISTS idx_devices_last_seen ON devices(last_seen_at DESC);

-- 🔲 หมายเหตุ: `devices.status` ('connected'/'disconnected') เป็นค่าที่ฝั่งแอปตั้งเอง
--    ส่วนหน้า admin คำนวณ online/offline จาก last_seen_at ตาม NFR-09 (คำนวณฝั่งเซิร์ฟเวอร์)
--    ตอนนี้เป็นสองแหล่งความจริง — ควรตัดสินใจว่าจะให้ `status` เลิกใช้แล้วอนุมานจาก
--    last_seen_at อย่างเดียวไหม

-- ผูกตาราง `alerts` ของแอปเข้ากับ `fall_events` ของ CSI pipeline
--
-- เดิมสองตารางนี้ไม่รู้จักกันเลย — `alerts` ที่แอปแสดงมาจาก seed.sql ล้วน
-- ส่วนการล้มจริงอยู่ใน `fall_events` แอปเห็นได้ทางเดียวคือ poll API มา merge
-- ทำให้ประวัติการแจ้งเตือนในแอปเป็นข้อมูลปลอม
--
-- ตอนนี้ Express API เขียนแถวใน `alerts` ให้ทุกครั้งที่ตรวจพบการล้ม
-- โดยหา house จากอุปกรณ์: fall_events.device_id → devices.code → devices.house_id
-- (ทำได้เพราะตัดสินใจเรื่อง device_id ↔ code ไปแล้ว)
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS fall_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_fall_event_id
  ON alerts(fall_event_id) WHERE fall_event_id IS NOT NULL;
