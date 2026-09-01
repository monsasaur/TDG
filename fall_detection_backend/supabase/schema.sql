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

-- อุปกรณ์ ESP32 ที่ติดตั้งแล้ว
-- ตาม TDG_BA.pdf ข้อ 12.2 จุดที่ 2 — รองรับ FR-16 ถึง FR-21, REP-01 ถึง REP-03
--
-- ทำไมต้องมีตารางนี้: เดิม device_id เป็นแค่ข้อความใน fall_events
-- ถ้าสร้างรายการอุปกรณ์จากการอ่าน fall_events อุปกรณ์ที่ไม่เคยล้มเลยจะหายไปจากหน้าจอ (FR-21)
CREATE TABLE IF NOT EXISTS devices (
  device_id     TEXT PRIMARY KEY,
  label         TEXT,                          -- ชื่อที่คนอ่านเข้าใจ เช่น "บ้านคุณสมชาย ห้องนอน"
  owner_name    TEXT,
  location      TEXT,
  last_seen_at  TIMESTAMPTZ,                   -- อัปเดตทุกครั้งที่ ESP32 ส่งข้อมูล ไม่ใช่เฉพาะตอนล้ม
  is_active     BOOLEAN     DEFAULT TRUE,      -- BR-08: ปลดการติดตั้งแล้วตั้งเป็น false
  installed_at  TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_is_active    ON devices(is_active);
CREATE INDEX IF NOT EXISTS idx_devices_last_seen_at ON devices(last_seen_at DESC);
