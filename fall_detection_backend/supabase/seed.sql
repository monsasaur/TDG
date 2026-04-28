-- Mockup data สำหรับ showcase / demo
-- รันใน Supabase SQL Editor ทุกครั้งที่ข้อมูล demo หาย
-- ปลอดภัย: ลบข้อมูลเก่าก่อน insert ใหม่ — รันซ้ำได้
--
-- ลำดับการลบ/ใส่ตาม foreign key:
--   ลบ:  alerts → house_contacts → devices → emergency_contacts → houses
--   ใส่: houses → emergency_contacts → devices → house_contacts → alerts

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
-- 2. HOUSES — 3 บ้าน
-- ======================================================
INSERT INTO houses (id, name, created_at) VALUES
  ('h1', 'บ้านแม่',  NOW() - INTERVAL '30 days'),
  ('h2', 'บ้านพ่อ',  NOW() - INTERVAL '20 days'),
  ('h3', 'บ้านยาย',  NOW() - INTERVAL '10 days');

-- ======================================================
-- 3. EMERGENCY CONTACTS
-- ======================================================
INSERT INTO emergency_contacts (id, name, phone, contact_type) VALUES
  ('c1', 'ฉัน',        '+66812345678', 'self'),
  ('c2', 'น้อม',       '+66898765432', 'member'),
  ('c3', 'พ่อ',         '+66866554433', 'member'),
  ('c4', 'รพ.ใกล้บ้าน', '+6621234567',  'external'),
  ('c5', '1669',        '1669',         'external');

-- ======================================================
-- 4. DEVICES — กระจายตามบ้าน + มี disconnected 1 ตัว (จะโผล่ใน system alerts)
-- ======================================================
INSERT INTO devices (id, name, code, wifi_ssid, status, house_id) VALUES
  ('d1', 'อุปกรณ์ห้องน้ำแม่',     'TDG-0001', 'MyHome_2.4G',     'connected',    'h1'),
  ('d2', 'อุปกรณ์ห้องนอนแม่',     'TDG-0002', 'MyHome_2.4G',     'connected',    'h1'),
  ('d3', 'อุปกรณ์ห้องนอนพ่อ',     'TDG-0003', 'NeighborWifi_5G', 'disconnected', 'h2'),
  ('d4', 'อุปกรณ์ห้องนั่งเล่นพ่อ', 'TDG-0004', 'NeighborWifi_5G', 'connected',    'h2'),
  ('d5', 'อุปกรณ์ห้องครัวยาย',    'TDG-0005', 'TrueNet-ABCD',    'connected',    'h3');

-- ======================================================
-- 5. HOUSE_CONTACTS — เชื่อม contact กับบ้านที่ดูแล
-- ======================================================
INSERT INTO house_contacts (house_id, contact_id) VALUES
  -- บ้านแม่: ฉัน, น้อม, รพ., 1669
  ('h1', 'c1'),
  ('h1', 'c2'),
  ('h1', 'c4'),
  ('h1', 'c5'),
  -- บ้านพ่อ: ฉัน, พ่อ, 1669
  ('h2', 'c1'),
  ('h2', 'c3'),
  ('h2', 'c5'),
  -- บ้านยาย: ฉัน, น้อม, 1669
  ('h3', 'c1'),
  ('h3', 'c2'),
  ('h3', 'c5');

-- ======================================================
-- 6. ALERTS — ครอบทุก status (active, completed, no_response)
-- ======================================================
INSERT INTO alerts (id, house_id, title, description, location, status, answered_by, countdown, timeline, created_at) VALUES

-- a1: active — กำลังนับถอยหลัง (ของชุดเดิม)
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
 NOW() - INTERVAL '15 days'),

-- a6: completed — บ้านยาย พ่อรับสาย
('a6', 'h3', 'Emergency',
 'ตรวจพบการล้มที่ บ้านยาย บริเวณ ห้องครัว กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว',
 'บ้านยาย - ห้องครัว', 'completed', 'ฉัน', NULL,
 '[{"label": "ตรวจพบการล้ม", "detail": "ไม่มีการตรวจสอบ", "status": "error"},
   {"label": "โทรหาเบอร์ติดต่อฉุกเฉิน", "detail": "รับสายโดย : ฉัน", "status": "success"}]',
 NOW() - INTERVAL '1 day'),

-- a7: completed — บ้านพ่อ ห้องนั่งเล่น (เพิ่มความหลากหลายของ location)
('a7', 'h2', 'Emergency',
 'ตรวจพบการล้มที่ บ้านพ่อ บริเวณ ห้องนั่งเล่น กรุณาไปตรวจสอบที่พื้นที่ดังกล่าว',
 'บ้านพ่อ - ห้องนั่งเล่น', 'completed', 'พ่อ', NULL,
 '[{"label": "ตรวจพบการล้ม", "detail": "ไม่มีการตรวจสอบ", "status": "error"},
   {"label": "โทรหาเบอร์ติดต่อฉุกเฉิน", "detail": "รับสายโดย : พ่อ", "status": "success"}]',
 NOW() - INTERVAL '3 days');

COMMIT;

-- ======================================================
-- ตรวจผล
-- ======================================================
SELECT 'houses'              AS table_name, COUNT(*) FROM houses
UNION ALL SELECT 'devices',            COUNT(*) FROM devices
UNION ALL SELECT 'emergency_contacts', COUNT(*) FROM emergency_contacts
UNION ALL SELECT 'house_contacts',     COUNT(*) FROM house_contacts
UNION ALL SELECT 'alerts',             COUNT(*) FROM alerts;
