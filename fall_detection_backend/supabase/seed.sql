-- Mockup data สำหรับ showcase / demo
-- รันใน Supabase SQL Editor ทุกครั้งที่ข้อมูล demo หาย
-- ปลอดภัย: ลบของเก่าก่อน insert ใหม่ — รันซ้ำได้
--
-- ลำดับการลบ/ใส่ตาม foreign key:
--   ลบ:  alerts → house_contacts → devices → emergency_contacts → houses
--   ใส่: houses → emergency_contacts → devices → house_contacts → alerts
--
-- Snapshot ครั้งที่อ้างอิง: 2026-04-28 (ตรงกับ state ใน Supabase)

BEGIN;

-- ======================================================
-- 1. CLEAR existing data (เคารพ FK order)
-- ======================================================
DELETE FROM alerts;
DELETE FROM house_contacts;
DELETE FROM devices;
DELETE FROM emergency_contacts;
DELETE FROM houses;

-- ======================================================
-- 2. HOUSES (5 บ้าน)
-- ======================================================
INSERT INTO houses (id, name, created_at) VALUES
  ('h1',              'บ้านแม่',              NOW() - INTERVAL '36 days'),
  ('h2',              'บ้านพ่อ',              NOW() - INTERVAL '36 days'),
  ('h1776870383872',  'บ้านไซม่อนคุง',         NOW() - INTERVAL '6 days'),
  ('h1776870599070',  'บ้านกันกันเดอะกานต์',   NOW() - INTERVAL '6 days'),
  ('h1776872530513',  'บ้านนี้มีรัก',          NOW() - INTERVAL '6 days');

-- ======================================================
-- 3. EMERGENCY CONTACTS (9 คน)
-- ======================================================
INSERT INTO emergency_contacts (id, name, phone, contact_type, created_at) VALUES
  ('c1',              'คุณ (ฉัน)',  '0899559566',  'self',     NOW() - INTERVAL '36 days'),
  ('c2',              'ตังเม',      '0953445665',  'member',   NOW() - INTERVAL '36 days'),
  ('c3',              'พี่สาว',     '0834306657',  'member',   NOW() - INTERVAL '36 days'),
  ('c4',              'สมหญิง',     '0934565555',  'external', NOW() - INTERVAL '36 days'),
  ('c1776870617316',  'ไซม่อน',     '0959536657',  'external', NOW() - INTERVAL '6 days'),
  ('c1776870873316',  'พอร์ช',      '0656576777',  'external', NOW() - INTERVAL '6 days'),
  ('c1776872567812',  'วิว2',       '0844564777',  'external', NOW() - INTERVAL '6 days'),
  ('c1776873974556',  'ออม',        '0899999999',  'external', NOW() - INTERVAL '6 days'),
  ('c1776922367543',  'มามะ',       '06233333333', 'external', NOW() - INTERVAL '5 days');

-- ======================================================
-- 4. DEVICES (4 ตัว — มี disconnected 2 ตัว สำหรับ system alerts)
-- ======================================================
INSERT INTO devices (id, house_id, name, code, wifi_ssid, status) VALUES
  ('d1', 'h1', 'Esp32 - ห้องนอน', 'ESP-0001A', 'MeeNeeNetZa_5G', 'disconnected'),
  ('d2', 'h1', 'Esp32 - ห้องครัว', 'ESP-0002B', 'MeeNeeNetZa_5G', 'connected'),
  ('d3', 'h2', 'Esp32 - ห้องนอน', 'ESP-0003C', 'MeeNeeNetZa_5G', 'connected'),
  ('d4', 'h2', 'Esp32 - ห้องน้ำ',  'ESP-0004D', 'MeeNeeNetZa_5G', 'disconnected');

-- ======================================================
-- 5. HOUSE_CONTACTS — เชื่อม contact กับบ้านที่ดูแล (12 links)
-- ======================================================
INSERT INTO house_contacts (house_id, contact_id) VALUES
  -- บ้านแม่: คุณ, ตังเม, พี่สาว, สมหญิง, ออม
  ('h1', 'c1'),
  ('h1', 'c2'),
  ('h1', 'c3'),
  ('h1', 'c4'),
  ('h1', 'c1776873974556'),
  -- บ้านพ่อ: คุณ, ตังเม, พี่สาว
  ('h2', 'c1'),
  ('h2', 'c2'),
  ('h2', 'c3'),
  -- บ้านไซม่อนคุง: ไซม่อน
  ('h1776870383872', 'c1776870617316'),
  -- บ้านนี้มีรัก: พอร์ช, วิว2
  ('h1776872530513', 'c1776870873316'),
  ('h1776872530513', 'c1776872567812'),
  -- บ้านกันกันเดอะกานต์: มามะ
  ('h1776870599070', 'c1776922367543');

-- ======================================================
-- 6. ALERTS — ครอบทุก status (active, completed, no_response)
-- ======================================================
INSERT INTO alerts (id, house_id, title, description, location, status, answered_by, countdown, timeline, created_at) VALUES

-- a1: active — กำลังนับถอยหลัง
('a1', 'h1', 'Emergency',
 'ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว ภายในเวลา 60 วินาที',
 'บ้านแม่ - ห้องน้ำ', 'active', NULL, 60,
 '[{"label": "ตรวจพบการล้ม", "detail": "", "status": "error"},
   {"label": "ติดต่อเบอร์ฉุกเฉิน", "detail": "", "status": "pending"},
   {"label": "ติดต่อเบอร์ 1669", "detail": "", "status": "pending"}]',
 NOW()),

-- a2: completed — ฉันรับสาย
('a2', 'h1', 'Emergency',
 'ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว',
 'บ้านแม่ - ห้องน้ำ', 'completed', 'ฉัน', NULL,
 '[{"label": "ตรวจพบการล้ม", "detail": "ไม่มีการตรวจสอบ", "status": "error"},
   {"label": "โทรหาเบอร์ติดต่อฉุกเฉิน", "detail": "รับสายโดย : ฉัน", "status": "success"},
   {"label": "ติดต่อเบอร์ 1669", "detail": "", "status": "pending"}]',
 NOW() - INTERVAL '2 hours'),

-- a3: no_response — ไม่มีใครรับสาย
('a3', 'h1', 'Emergency',
 'ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว',
 'บ้านแม่ - ห้องน้ำ', 'no_response', NULL, NULL,
 '[{"label": "ตรวจพบการล้ม", "detail": "ไม่มีการตรวจสอบ", "status": "error"},
   {"label": "โทรหาเบอร์ติดต่อฉุกเฉิน", "detail": "ไม่มีการรับสายจากเบอร์ติดต่อฉุกเฉิน", "status": "error"},
   {"label": "ติดต่อเบอร์ 1669", "detail": "ไม่มีการรับสายจากเบอร์ 1669", "status": "error"}]',
 NOW() - INTERVAL '5 days'),

-- a4: completed — น้อมรับสาย (บ้านพ่อ)
('a4', 'h2', 'Emergency',
 'ตรวจพบการล้มที่ บ้านพ่อ บริเวณ ห้องนอน กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว',
 'บ้านพ่อ - ห้องนอน', 'completed', 'น้อม', NULL,
 '[{"label": "ตรวจพบการล้ม", "detail": "ไม่มีการตรวจสอบ", "status": "error"},
   {"label": "โทรหาเบอร์ติดต่อฉุกเฉิน", "detail": "รับสายโดย : น้อม", "status": "success"}]',
 NOW() - INTERVAL '7 days'),

-- a5: completed — 1669 รับสาย
('a5', 'h1', 'Emergency',
 'ตรวจพบการล้มที่ บ้านแม่ บริเวณ ห้องน้ำ กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว',
 'บ้านแม่ - ห้องน้ำ', 'completed', 'เบอร์ 1669', NULL,
 '[{"label": "ตรวจพบการล้ม", "detail": "ไม่มีการตรวจสอบ", "status": "error"},
   {"label": "โทรหาเบอร์ติดต่อฉุกเฉิน", "detail": "ไม่มีการรับสาย", "status": "error"},
   {"label": "ติดต่อเบอร์ 1669", "detail": "รับสายโดย : 1669", "status": "success"}]',
 NOW() - INTERVAL '15 days');

COMMIT;

-- ======================================================
-- ตรวจผล
-- ======================================================
SELECT 'houses'              AS table_name, COUNT(*) FROM houses
UNION ALL SELECT 'devices',            COUNT(*) FROM devices
UNION ALL SELECT 'emergency_contacts', COUNT(*) FROM emergency_contacts
UNION ALL SELECT 'house_contacts',     COUNT(*) FROM house_contacts
UNION ALL SELECT 'alerts',             COUNT(*) FROM alerts;
