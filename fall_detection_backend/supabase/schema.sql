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
