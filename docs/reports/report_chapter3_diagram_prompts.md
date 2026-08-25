# Prompts สำหรับสร้าง Diagram บทที่ 3

ใช้ prompts เหล่านี้กับ draw.io AI, Whimsical, Mermaid, PlantUML, Figma AI หรือเครื่องมือสร้าง diagram อื่น ๆ ได้เลย หลังสร้างภาพแล้วให้ export เป็น PNG ความละเอียดสูง ใส่กรอบภาพ และนำไปวางในบทที่ 3 ตาม caption ที่กำหนดไว้

## Style กลางสำหรับทุกภาพ

Prompt:

สร้างแผนภาพเชิงวิชาการสำหรับรายงานโครงงาน ภาษาไทยทั้งหมด พื้นหลังสีขาว เส้นคมชัด อ่านง่าย ใช้สีแบบเรียบ เช่น น้ำเงิน เทา เขียว และแดงเฉพาะส่วนแจ้งเตือน หลีกเลี่ยงไอคอนตกแต่งมากเกินไป จัดวางแบบเป็นระเบียบ ใช้กล่องสี่เหลี่ยมมุมมนเล็กน้อยและลูกศรแสดงทิศทางข้อมูล ขนาดเหมาะกับเอกสาร A4 แนวนอน ความละเอียดสูง 300 dpi

## ภาพที่ 3.1 ขั้นตอนในการดำเนินงานของระบบ

Prompt:

สร้าง Flowchart ภาษาไทยแสดงขั้นตอนการพัฒนาระบบตรวจจับการล้มของผู้สูงอายุด้วย WiFi CSI และแอปพลิเคชัน Middle เรียงจากซ้ายไปขวา มี 9 ขั้นตอน ได้แก่ 1 ศึกษาปัญหาและรวบรวมข้อมูล 2 วิเคราะห์ความต้องการของระบบ 3 ออกแบบสถาปัตยกรรมระบบ 4 ออกแบบและเตรียม ESP32 WiFi CSI 5 เตรียมข้อมูลและ feature 416 ค่า 6 พัฒนาโมเดล Random Forest 7 พัฒนา Express API และ FastAPI ML Service 8 พัฒนาแอปพลิเคชัน Middle และระบบแจ้งเตือน 9 ทดสอบ End-to-End และปรับปรุงระบบ ใช้ลูกศรเชื่อมทุกขั้นตอน และเน้นขั้นตอนทดสอบเป็นวงจรวนกลับไปปรับปรุงระบบ

## ภาพที่ 3.2 สถาปัตยกรรมโดยรวมของระบบตรวจจับการล้ม

Prompt:

สร้าง System Architecture Diagram ภาษาไทยของระบบตรวจจับการล้มของผู้สูงอายุ แบ่งเป็น 5 ชั้นจากซ้ายไปขวา ได้แก่ Hardware Layer, Data Processing Layer, Backend Layer, Data and Notification Layer และ Caregiver App Layer องค์ประกอบต้องมี ESP32 Sender, ESP32 CSI Receiver, USB Serial 921600 baud, CSI Feature Extraction 416 features, Express API, FastAPI ML Service, Random Forest Model rf_v1.pkl, Supabase tables fall_events และ push_tokens, Expo Push Notification, Twilio Voice Call, Mobile App Middle ลูกศรแสดง flow: ESP32 -> feature -> Express API -> ML Service -> Supabase -> Push Notification -> Mobile App และกรณีไม่มีการตอบรับให้ Express API -> Twilio Voice Call

## ภาพที่ 3.3 Context Diagram ของระบบตรวจจับการล้ม

Prompt:

สร้าง Context Diagram ภาษาไทย โดยวางระบบกลางชื่อ "ระบบตรวจจับการล้มด้วย WiFi CSI และแอป Middle" ไว้ตรงกลาง ภายนอกระบบมี entity ได้แก่ ผู้สูงอายุ, ผู้ดูแล, ผู้ดูแลระบบ, Supabase, Expo Push Service, Twilio Voice API และ ESP32 CSI Device แสดงข้อมูลเข้าออกดังนี้ ผู้สูงอายุ -> การเคลื่อนไหวในพื้นที่ -> ESP32 CSI Device -> ข้อมูล CSI/features -> ระบบ, ระบบ -> แจ้งเตือนการล้ม -> ผู้ดูแล, ผู้ดูแล -> ยืนยันรับทราบ -> ระบบ, ผู้ดูแลระบบ -> จัดการ/ทดสอบระบบ -> ระบบ, ระบบ <-> Supabase ข้อมูลเหตุการณ์และ push token, ระบบ -> Expo Push Service -> ผู้ดูแล, ระบบ -> Twilio Voice API -> โทรฉุกเฉิน

## ภาพที่ 3.4 DFD Level 1 ของระบบตรวจจับการล้ม

Prompt:

สร้าง DFD Level 1 ภาษาไทยของระบบตรวจจับการล้ม มี external entities คือ ESP32 CSI Device, ผู้ดูแล, ผู้ดูแลระบบ, Expo Push Service, Twilio Voice API มีกระบวนการ 6 กระบวนการ ได้แก่ 1.0 รับข้อมูล CSI/features, 2.0 เตรียมข้อมูลและตรวจรูปแบบ, 3.0 ประมวลผลด้วย ML Service, 4.0 ตัดสินใจเหตุการณ์การล้ม, 5.0 บันทึกเหตุการณ์และจัดการสถานะ, 6.0 ส่งแจ้งเตือนและรับการยืนยัน มี data stores D1 fall_events และ D2 push_tokens แสดง flow สำคัญ: features -> ML prediction -> fall/no_fall -> save event -> push alert -> ack -> update event -> no ack timeout -> voice call

## ภาพที่ 3.5 แผนผังเครือข่ายของระบบตรวจจับการล้มด้วย ESP32 WiFi CSI

Prompt:

สร้าง Network Topology Diagram ภาษาไทยสำหรับต้นแบบระบบ ESP32 WiFi CSI แสดง ESP32 #1 เป็น "ESP32 Receiver / Active AP / CSI Collector" สร้างเครือข่าย WiFi CSI-Net หรือ myssid แสดง ESP32 #2 เป็น "ESP32 Sender / Active STA" เชื่อมต่อเข้าหา ESP32 #1 และส่ง WiFi packets 100 packets/sec ให้ ESP32 #1 วัด CSI จากนั้น ESP32 #1 ส่งข้อมูล CSI ผ่าน USB Serial 921600 baud ไปยัง Computer / Mac ที่รัน csi_collector_serial.py จากคอมพิวเตอร์ส่งข้อมูลต่อไปยัง Express API และ FastAPI ML Service แสดง Supabase, Expo Push, Twilio และ Mobile App Middle ทางด้าน Cloud/Client ใช้ลูกศรแสดงทิศทางข้อมูลชัดเจน

## ภาพที่ 3.6 การออกแบบกระบวนการประมวลผลของโมเดล Random Forest

Prompt:

สร้าง ML Model Processing Diagram ภาษาไทย แสดง pipeline ของโมเดล Random Forest สำหรับตรวจจับการล้ม เริ่มจาก Input: CSI feature window ล่าสุด จำนวน 416 features จาก 52 subcarriers x 8 statistical features ไปยัง Scaler scaler_rf_v1.pkl ต่อไปยัง Random Forest Model rf_v1.pkl ต่อไปยัง Predict Probability ได้แก่ fall_prob และ non_fall_prob ต่อไปยัง Threshold fall_prob >= 0.55 ต่อไปยัง Output JSON: prediction, confidence, is_fall แสดงผลลัพธ์แยกเป็นสองแขนง ถ้า is_fall=false -> monitoring ไม่บันทึก DB ถ้า is_fall=true -> create fall event และ alert caregiver

## ภาพที่ 3.7 Data Pipeline ของระบบตรวจจับการล้ม

Prompt:

สร้าง Data Pipeline Diagram ภาษาไทย แสดงลำดับข้อมูลแบบส่งขึ้น Cloud แทน USB Serial ตั้งแต่ ESP32 Sender -> ESP32 Receiver reads WiFi CSI -> ESP32 Receiver packages CSI window -> ส่งข้อมูลผ่าน WiFi/Internet ด้วย HTTPS หรือ MQTT -> Cloud Ingestion API / Express API -> raw CSI/CSV storage บน Cloud -> preprocess -> extract 52 subcarriers -> calculate 8 statistics each -> 416 feature vector -> scaler -> Random Forest model -> prediction fall/no_fall -> Alert Decision API -> Supabase fall_events -> Expo Push Notification -> Middle App ใส่กล่องแยก phase เป็น Data Collection, Cloud Upload, Preprocessing, Inference, Alert and Storage และห้ามแสดง USB Serial, csi_collector_serial.py หรือ local Mac ในภาพ

## ภาพที่ 3.8 Sequence Diagram ของกระบวนการแจ้งเตือนการล้ม

Prompt:

สร้าง Sequence Diagram ภาษาไทย มี participants ได้แก่ ESP32/Simulator, Express API, FastAPI ML Service, Supabase, Expo Push Service, Middle App, Caregiver, Twilio Voice API ลำดับการทำงาน: ESP32 ส่ง POST /api/v1/predict พร้อม device_id, timestamp, location, features ไป Express API; Express API ส่ง features ไป FastAPI /predict; ML Service ตอบ is_fall และ confidence; ถ้า no_fall ให้ Express API ตอบ monitoring; ถ้า fall ให้ Express API บันทึก fall_events ที่ Supabase; Express API schedule ack timer; Express API ส่ง push ผ่าน Expo; Middle App แสดง alert ให้ Caregiver; กรณี Caregiver กด confirm ให้ Middle App เรียก POST /api/v1/alert/ack/:event_id แล้ว Express API update acknowledged และ cancel timer; กรณี timeout ไม่มี ack ให้ Express API เรียก Twilio Voice API แล้ว update escalated

## ภาพที่ 3.9 Use Case Diagram ของระบบตรวจจับการล้ม

Prompt:

สร้าง Use Case Diagram ภาษาไทยของระบบตรวจจับการล้ม มี actors คือ ผู้สูงอายุ, ผู้ดูแล, ผู้ดูแลระบบ และบริการภายนอก แยก services เป็น Expo Push Service และ Twilio Voice API ภายใน system boundary ชื่อ "ระบบ Middle Fall Detection" มี use cases ได้แก่ ตรวจจับการเคลื่อนไหวด้วย WiFi CSI, ประมวลผลการล้ม, รับแจ้งเตือนการล้ม, ดูรายละเอียดเหตุการณ์, ยืนยันรับทราบ, ดูประวัติแจ้งเตือน, จัดการบ้าน, จัดการอุปกรณ์, จัดการผู้ติดต่อฉุกเฉิน, ทดสอบการแจ้งเตือน, โทรแจ้งเตือนเมื่อไม่มีการตอบรับ เชื่อม actor ผู้สูงอายุกับตรวจจับการเคลื่อนไหวแบบ passive ผู้ดูแลกับ use cases บนแอป และผู้ดูแลระบบกับการจัดการ/ทดสอบระบบ

## ภาพที่ 3.10 ER Diagram ของฐานข้อมูลระบบตรวจจับการล้ม

Prompt:

สร้าง ER Diagram ภาษาไทย/อังกฤษผสมสำหรับฐานข้อมูล Supabase มี 2 tables คือ fall_events และ push_tokens ตาราง fall_events มี fields: id UUID PK, device_id TEXT, timestamp BIGINT, location TEXT, is_fall BOOLEAN, confidence FLOAT, acknowledged BOOLEAN, acknowledged_at TIMESTAMPTZ, acknowledged_by TEXT, escalated BOOLEAN, escalated_at TIMESTAMPTZ, sms_sent BOOLEAN, call_made BOOLEAN, created_at TIMESTAMPTZ ตาราง push_tokens มี fields: token TEXT PK, device_id TEXT, platform TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ แสดง relationship แบบ logical relation ผ่าน device_id เป็น dashed line ไม่ใช่ foreign key จริง ใส่ note ว่า schema ปัจจุบันยังไม่กำหนด FK โดยตรง

## ภาพที่ 3.11 Screen Flow ของแอปพลิเคชัน Middle

Prompt:

สร้าง Mobile App Screen Flow ภาษาไทยของแอป Middle สำหรับผู้ดูแล แสดงหน้าจอเป็นกล่องมือถือเรียงตาม flow: Splash -> Welcome -> Home -> Alert Detail/Confirm -> Notifications และจาก Home แตกไป Settings, Devices, Device Setup, Scan QR, Houses/Manage Home, Emergency Contacts แสดง action สำคัญคือ Home รับ fall alert, Caregiver กด Confirm, app เรียก acknowledge API และกลับไปแสดงสถานะ completed ใช้ดีไซน์เรียบแบบ mobile app สีหลักขาว เทา และแดงสำหรับ emergency alert
