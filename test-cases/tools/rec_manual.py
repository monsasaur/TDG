"""บันทึกผลที่ตรวจด้วยมือ และเหตุผลของเคสที่ยังเทสไม่ได้ (ชีต 8, 9, 13)"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import openpyxl
from rec import rec, add_bug, XLSX, _find, _save
sys.stdout.reconfigure(encoding='utf-8')
D = '23 พ.ย.'

# แก้ผลที่คาดหวังของ ESC-003 และเพิ่มคำถาม 111
wb = openpyxl.load_workbook(XLSX); ws, r = _find(wb, 'MID-ESC-003')
v = ws.cell(r, 11).value; old = 'status 409 ข้อความ "หมดเวลาไปแล้ว ระบบ escalate ไปเรียบร้อย — กดรับทราบไม่ได้อีก"'
if old in v:
    ws.cell(r, 11).value = v.replace(old, 'status 409 และมี error ใน body')
    ws.cell(r, 13).value = ((ws.cell(r, 13).value or '') + ' [แก้ 23 พ.ย.] ตรวจ status code แทนข้อความ (ข้อความเดิมมาจากคำอธิบายใน spec)').strip()
q = wb['คำถามถึงทีม']
if q.cell(112, 2).value is None:
    import copy
    for c in range(1, 5): q.cell(112, c)._style = copy.copy(q.cell(111, c)._style)
    q.cell(112, 1).value = 111; q.cell(112, 2).value = 'คีย์ dev-secret-key-123 ที่อยู่ในรีโป (app.config.js, lib/api.ts, test.sh) ตรงกับ API_KEY ที่ใช้บน server จริงไหม ถ้าตรงต้องเปลี่ยนคีย์'
_save(wb)

# ---- ตรวจด้วยมือ ----
rec('MID-SEC-001', 'Passed', f'ได้ 200 และ [] (0 แถว) ยิงแบบอ่านอย่างเดียวด้วย anon key ไม่ได้ login ({D})')
rec('MID-SEC-008', 'Pending', f'ไม่มีไฟล์ .env (มีแค่ .env.example 2 ไฟล์) ไม่พบค่าจริงของ service_role / Twilio / Typhoon · คีย์ Supabase ในแอปเป็น anon\nพบ dev-secret-key-123 ในโค้ดหลายไฟล์ รอทีมยืนยันว่าไม่ใช่คีย์จริง (คำถามข้อ 111)\nหลักฐาน: evidence/MID-SEC-008.txt ({D} · commit 49fc17a)')
rec('MID-SEC-010', 'Passed', f'Console ขึ้น "blocked by CORS policy" และไม่มีผลลัพธ์ · origin ที่อนุญาตได้ header ปกติ\nยิงจาก http://localhost:3902 ไป http://127.0.0.1:3902 แทน example.com เพราะเบราว์เซอร์ที่ใช้เทสบล็อกเองก่อนถึงขั้น CORS ({D})')
b = add_bug('MID-SEC-016', 'Backend (API)', 'Dev Backend', 'npm test ตกบน Windows เพราะเทียบท้ายบรรทัด CRLF',
            '1. clone บน Windows (core.autocrlf=true)\n2. cd fall_detection_backend/express_api\n3. npm test และ npm run docs:check', 'ผ่านทั้งหมด',
            'ผ่าน 199/200 ตกที่ openapi.test.js และ docs:check บอกว่าคู่มือไม่ตรงกับ spec · ลองกับไฟล์ LF ตามใน git ผ่าน 200/200 แปลว่าคู่มือไม่ได้ล้าสมัย\nแก้ง่ายสุด: ใน scripts/generate_api_docs.js ตอน --check แปลง \\r\\n เป็น \\n ก่อนเทียบ หรือเพิ่ม .gitattributes ให้ไฟล์นี้เป็น eol=lf', 'Low', 'evidence/MID-SEC-016.txt')
rec('MID-SEC-016', 'Failed', f'บน Windows ผ่าน 199/200 และ docs:check ไม่ผ่าน เพราะไฟล์ถูกแปลงเป็น CRLF · ใช้ไฟล์ LF ผ่าน 200/200 (Node 24)\nหลักฐาน: evidence/MID-SEC-016.txt ({D})', b)
b = add_bug('MID-API-088', 'Backend (API)', 'Dev Backend', 'ยังไม่มีการบันทึก login และการเปิดดูเหตุการณ์ของ admin',
            '1. ค้นคำว่า audit, login_failed, view_event ใน express_api/src\n2. ค้น admin_audit_log ใน supabase/*.sql', 'บันทึกทุกครั้งที่ admin login สำเร็จ / ไม่สำเร็จ และเปิดดูรายละเอียดเหตุการณ์ (TDG_BA AUD-01, AUD-02 ระดับบังคับ)',
            'ไม่พบโค้ดหรือตารางที่บันทึกเรื่องนี้ (มีแต่ audit_logs ของแอป)\nแก้: เพิ่มตาราง admin_audit_log ตาม BA 16.3 และบันทึกใน routes/admin.js ที่ /login และ /events/:id · รอทีมตอบคำถามข้อ 110', 'Medium', 'โค้ด commit 49fc17a')
rec('MID-API-088', 'Pending', f'ค้นโค้ดและ SQL แล้วไม่พบการบันทึกของ admin ยังไม่ได้เปิดตารางจริง รอทีมตอบคำถามข้อ 110 ({D})', b)

# ---- ยังเทสไม่ได้ ----
DB = 'ยังเทสไม่ได้: ต้องเขียน/อ่านฐานข้อมูลที่มีข้อมูลทดสอบ ตอนนี้มีแต่ฐานจริง ต่อ Express เข้าฐานจริงจะไปปิดเหตุการณ์จริงที่รอรับทราบ\nทำได้เมื่อ: มี Supabase โปรเจกต์ทดสอบแยก (รัน schema.sql + accounts.sql + ข้อมูล QA)'
ML = 'ยังเทสไม่ได้: ไม่มีไฟล์โมเดลในเครื่อง (models/*.pkl)\nทำได้เมื่อ: โหลดโมเดลด้วย scripts/fetch_models.sh'
D8 = ML + ' และมีชุดข้อมูล CSI ของ QA (D8)'
TW = 'ยังเทสไม่ได้: ต้องโทร/ส่ง SMS จริงผ่าน Twilio ไปเบอร์ทดสอบที่ยืนยันแล้ว (D9)'
TY = 'ยังเทสไม่ได้: ต้องมี TYPHOON_API_KEY จริง (D15)'
ACC = DB + ' และบัญชีผู้ใช้ทดสอบ A, B, D (D11)'
RD = 'ยังเทสไม่ได้: ยังไม่ได้ deploy ขึ้น Render'
A = lambda *n: [f'MID-API-{x:03d}' for x in n]
blocked = [
    (A(14, 15, 16, 17, 18, 19, 28, 61, 63, 64, 65, 66, 67, 68, 70, 75, 78, 79, 80, 82, 84, 85, 86), DB),
    (A(36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 47, 51, 52, 53), ACC),
    (A(13, 20, 22, 77), ML), (A(21, 23, 24, 25, 26, 27), D8), (A(87), ML + ' และมี Supabase โปรเจกต์ทดสอบ'), (A(30, 32), TW),
    ([f'MID-ESC-{x:03d}' for x in (5, 6, 7, 8, 9, 10)], DB), ([f'MID-ESC-{x:03d}' for x in (16, 20, 22, 23, 24)], TY), ([f'MID-ESC-{x:03d}' for x in (25, 26, 28)], TW), (['MID-ESC-027'], TW + ' และ ' + TY),
    ([f'MID-SEC-{x:03d}' for x in (2, 3, 4, 5, 17, 18, 19, 20, 21, 22)], ACC),
    (['MID-SEC-006'], 'ยังเทสไม่ได้: ต้องใช้ service_role key ซึ่งไม่มีในเครื่อง ให้ทีมรัน check_live_setup.js'),
    (['MID-SEC-007'], 'ยังเทสไม่ได้: ต้องได้ค่าคีย์ 4 ตัวและค่า EXPO_PUBLIC_API_KEY ที่ใช้ build จากทีม'),
    (['MID-SEC-011'], 'ยังเทสไม่ได้: ต้อง push branch และเปิด Draft PR ในรีโปของทีม รอทีมอนุญาต'),
    ([f'MID-SEC-{x:03d}' for x in (12, 13, 14, 15)], RD),
]
n = 0
wb = openpyxl.load_workbook(XLSX)
import re
for ids, why in blocked:
    for cid in ids:
        ws, r = _find(wb, cid)
        assert ws.cell(r, 12).value in ('Not Start', 'Blocked'), (cid, ws.cell(r, 12).value)
        tags = ' '.join(re.findall(r'\[(?:แก้|เพิ่ม|ย้าย)[^\]]*\][^\[\n]*', ws.cell(r, 13).value or '')).strip()
        ws.cell(r, 12).value = 'Blocked'; ws.cell(r, 13).value = why + ('\n' + tags if tags else ''); n += 1
_save(wb)
print('blocked', n)
