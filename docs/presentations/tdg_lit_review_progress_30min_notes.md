# TDG Lit Review + Progress Presentation Notes

เวลาเป้าหมาย: พรี 24 นาที + ถามตอบ 6 นาที

## Slide 1: เปิดเรื่อง
- เวลา: 0:00 - 0:40
- พูดหลัก: เปิดด้วยโจทย์หลัก: ผู้สูงอายุล้มแล้วไม่มีใครรู้ทันที ระบบนี้พยายามตรวจจับแบบ passive โดยไม่ใช้กล้องและไม่ต้องใส่อุปกรณ์

## Slide 2: โครงเรื่องและเวลา
- เวลา: 0:40 - 1:10
- พูดหลัก: บอกกรรมการว่าจะไม่ลงลึกทุก implementation line แต่จะเชื่อม lit review กับการตัดสินใจทางระบบและสถานะที่ทำไปแล้ว

## Slide 3: ขนาดของปัญหา
- เวลา: 1:10 - 2:20
- พูดหลัก: ใช้ตัวเลขใหญ่เพื่อยืนยันว่า problem มีน้ำหนัก จากนั้นโยงกลับมาที่ pain point จริงของครอบครัว: รู้ช้าและช่วยช้า

## Slide 4: Requirement
- เวลา: 2:20 - 3:30
- พูดหลัก: พูดว่าข้อกำหนดเหล่านี้ทำให้ camera, wearable และ SOS button ไม่ใช่คำตอบเดียว จึงต้องดู literature ของ device-free sensing

## Slide 5: ภาพรวม existing solutions
- เวลา: 3:30 - 4:50
- พูดหลัก: อธิบาย taxonomy ไม่ต้องลง paper ทุกตัว เน้น trade-off ว่าระบบที่ใช้งานจริงต้อง balance privacy, compliance, false alarm และ coverage

## Slide 6: ข้อจำกัดของวิธีเดิม
- เวลา: 4:50 - 6:10
- พูดหลัก: โยงว่า pain point ไม่ใช่แค่ model accuracy แต่เป็น user adoption และ emergency workflow

## Slide 7: เหตุผลที่เลือก CSI
- เวลา: 6:10 - 7:20
- พูดหลัก: อธิบายแบบ intuition: ไม่ได้เห็นตัวคน แต่เห็น channel ที่เปลี่ยนเมื่อร่างกายทำให้สัญญาณ WiFi สะท้อนและดูดกลืนต่างไป

## Slide 8: Pipeline ของสัญญาณ
- เวลา: 7:20 - 8:30
- พูดหลัก: เน้นว่าเราไม่ส่ง raw ทุก packet เข้า model ตรง ๆ แต่สรุปเป็น window features เพื่อให้ inference เร็วและเบากว่า sequence หนัก ๆ

## Slide 9: Related work fall detection
- เวลา: 8:30 - 10:00
- พูดหลัก: สรุปว่ามี precedent เชิงวิชาการ แต่ต้องไม่ claim ว่าทุก environment จะใช้ได้ทันที เพราะ domain shift เป็นปัญหาหลัก

## Slide 10: Related work ESP32/ML
- เวลา: 10:00 - 11:20
- พูดหลัก: โยงว่างานของเราไม่ได้เริ่มจากศูนย์ แต่เลือกส่วนที่พิสูจน์แล้วมาทำ prototype end-to-end

## Slide 11: Gap และ contribution
- เวลา: 11:20 - 12:20
- พูดหลัก: บอกให้ชัดว่า contribution ไม่ได้อ้างว่าแก้ปัญหา CSI ทั้งโลก แต่ทำระบบ end-to-end ที่เห็น path ไปสู่ deployment

## Slide 12: Solution overview
- เวลา: 12:20 - 13:20
- พูดหลัก: เล่า flow หนึ่งรอบจากสัญญาณจนถึงการช่วยเหลือจริง เพื่อให้คนฟังเห็นระบบก่อนดู implementation

## Slide 13: Architecture
- เวลา: 13:20 - 14:40
- พูดหลัก: ย้ำว่าใช้ source code ปัจจุบัน: ML service active เป็น RF, API มี demo endpoint, app poll event และกด ack ได้

## Slide 14: Data pipeline
- เวลา: 14:40 - 15:50
- พูดหลัก: พูดเรื่องการตัดสินใจทางวิศวกรรม: USB serial ลด dependency ต่อ hotspot และ RF ใช้ window ล่าสุดเพื่อ response time

## Slide 15: Model journey
- เวลา: 15:50 - 17:00
- พูดหลัก: พูดตรง ๆ ว่าตัวเลข test split ดี แต่เราเรียนรู้ว่า real-time และ unseen environment สำคัญกว่า จึงต้องมี evaluation plan ใหม่

## Slide 16: Active inference
- เวลา: 17:00 - 18:00
- พูดหลัก: ย้ำว่า slide นี้คือ source of truth ปัจจุบัน ไม่ใช่ README เก่าที่พูดว่า LSTM active

## Slide 17: Alert workflow
- เวลา: 18:00 - 19:10
- พูดหลัก: อธิบายว่าระบบ safety ต้องมี feedback loop: detect, notify, acknowledge, escalate ไม่ใช่แค่มี model

## Slide 18: Mobile progress
- เวลา: 19:10 - 20:10
- พูดหลัก: พูดจากมุมผู้ใช้: caregiver เห็น alert, กดรับทราบ และรับ push ได้แล้ว แต่ยังไม่ใช่ production config

## Slide 19: Backend progress
- เวลา: 20:10 - 21:10
- พูดหลัก: สรุปว่า backend ใช้งานได้ครบสำหรับ demo แต่ต้องพูด limitation เรื่อง durability ของ timer

## Slide 20: Hardware progress
- เวลา: 21:10 - 22:10
- พูดหลัก: ถ้าจะ demo ให้บอกตรง ๆ ว่า live hardware demo คือโชว์ raw CSI response ไม่ใช่ model generalization

## Slide 21: Summary done
- เวลา: 22:10 - 23:00
- พูดหลัก: ใช้ slide นี้เป็น milestone summary ก่อนเข้าสู่ limitation เพื่อไม่ให้ presentation ดูเหมือนมีแต่ปัญหา

## Slide 22: Limitations
- เวลา: 23:00 - 23:40
- พูดหลัก: พูด limitation ก่อนกรรมการถาม เพื่อแสดงว่าเข้าใจทั้ง ML risk และ system risk

## Slide 23: Next steps
- เวลา: 23:40 - 24:00
- พูดหลัก: ปิดเนื้อหาด้วยแผนที่ตอบ gap โดยตรง แล้วเตรียมเข้าสู่ Q&A

## Slide 24: Q&A
- เวลา: 24:00 - 30:00
- พูดหลัก: เปิดให้ถามตอบ 6 นาที ถ้าถาม references หรือ implementation details ให้เปิด slide ถัดไปหรือชี้ไปที่ repo/source

## Slide 25: References
- เวลา: Backup
- พูดหลัก: ใช้เป็นสไลด์สำรองเมื่อถูกถามที่มาของตัวเลขหรือ related work

