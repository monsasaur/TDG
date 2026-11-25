"""บันทึกผลชีต 1 จาก _queue_onb.json, บั๊กที่ยืนยันแล้ว และเหตุผลของเคสที่ยังเทสไม่ได้"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
import openpyxl
from rec import rec, add_bug, XLSX, _find, _save
sys.stdout.reconfigure(encoding='utf-8')
EV = os.path.join(os.path.dirname(__file__), '..', 'evidence')
D = '23 พ.ย. · emulator Pixel 7a Android 17 · Expo Go · ปิดเน็ต · commit 49fc17a'
q = json.load(open(os.path.join(EV, '_queue_onb.json'), encoding='utf-8'))
for k, v in q.items(): print(k, 'ERR' if v['err'] else ('BAD' if v['bad'] else 'ok'), v['note'][:150], v['err'] or '')
if '--show' in sys.argv: raise SystemExit
FE, BE = ('Frontend (แอป)', 'Dev Frontend'), ('Backend (API)', 'Dev Backend')
bug = {}

# ---- บั๊กฝั่งแอป ----
b = add_bug('MID-ONB-009', *FE, 'เบอร์ขึ้นต้นผิดแสดงข้อความผิด หรือพิมพ์ไม่ติดโดยไม่บอกเหตุผล',
            '1. เปิดแอปถึงหน้ายินดีต้อนรับ\n2. พิมพ์ 0212345678 และรหัสผ่าน แล้วกด "เข้าสู่ระบบ"\n3. ลบแล้วพิมพ์ 112345678\n4. ทำซ้ำข้อ 2 ในหน้า "สมัครใช้งาน"',
            'แสดง "เบอร์มือถือไม่ถูกต้อง" ใต้ช่อง (US-01 AC2 ยืนยัน 22 พ.ย.)',
            'ข้อ 2 และ 4 แสดง "เบอร์โทรศัพท์ไม่ถูกต้อง" · ข้อ 3 พิมพ์หลักแรก 1 2 3 4 5 7 ไม่ติด ช่องว่างเฉยๆ ไม่มีข้อความ\nแก้: แยกข้อความใน app/welcome.tsx และ app/register.tsx (ตอน toE164TH คืน null) และ lib/phone.ts sanitizePhoneInput ไม่ควรทิ้งเลขเงียบๆ · ถ้าตั้งใจเปลี่ยนพฤติกรรม ให้แก้ US-01 AC2 แทน (คำถามข้อ 109)',
            'Medium', 'evidence/MID-ONB-009_1.png, MID-ONB-030_1.png, MID-ONB-036.png')
for c in ('009', '029', '030', '031', '036'): bug['MID-ONB-' + c] = b
bug['MID-ONB-007'] = add_bug('MID-ONB-007', *FE, 'เว้นช่องเบอร์ว่างแล้วไม่แสดง error', '1. เปิดหน้ายินดีต้อนรับ\n2. กดช่อง "เบอร์โทรของฉัน" แล้วกดพื้นที่ว่างนอกช่อง',
                             'แสดง "กรุณากรอกเบอร์โทรศัพท์" สีแดงใต้ช่อง (US-01 AC4)', 'ไม่มีข้อความใด · โค้ดหน้าใหม่ไม่ได้ส่ง onBlur ให้ PhoneInput (app/welcome.tsx)\nแก้: ส่ง onBlur ที่ตั้ง error เมื่อช่องว่าง หรือแก้ AC4 ถ้าไม่ใช้แล้ว (คำถามข้อ 109)', 'Low', 'evidence/MID-ONB-007.png')
bug['MID-ONB-053'] = add_bug('MID-ONB-053', *FE, 'ไม่มีเน็ตแล้วไม่แสดง popup', '1. เปิด Airplane mode\n2. กรอกเบอร์และรหัสผ่าน แล้วกด "เข้าสู่ระบบ"',
                             'แสดง popup "ไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้" ทุกครั้งที่กด (US-08 AC1)', 'แสดงเป็นข้อความสีแดงในหน้า "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่" ไม่มี popup · ค้นโค้ดทั้งแอปแล้วไม่พบ popup นี้ จึงน่าจะกระทบ GEN-001, 002, 007 ด้วย (ยังไม่ได้เทสสด)\nแก้: เพิ่ม popup กลาง หรือแก้ US-08 AC1 ถ้ายอมรับแบบข้อความ', 'Medium', 'evidence/MID-ONB-053.png')
bug['MID-ONB-001'] = add_bug('MID-ONB-001', *FE, 'ขอสิทธิ์แจ้งเตือนตั้งแต่ก่อนเข้าสู่ระบบ', '1. ล้างข้อมูลแอป\n2. เปิดแอป (ยังไม่ login)',
                             'ขอสิทธิ์หลังเข้าสู่ระบบครั้งแรกที่หน้าแรก ลำดับ ตำแหน่ง → อุปกรณ์ใกล้เคียง → แจ้งเตือน (US-02 AC1 · APX-ONB-029)', 'popup ขอสิทธิ์แจ้งเตือนเด้งทับหน้ายินดีต้อนรับทันที · app/_layout.tsx PushSetup เรียก registerForPushNotifications แม้ยังไม่มี user\nแก้: เรียกเมื่อมี userId แล้วเท่านั้น', 'Medium', 'evidence/MID-ONB-001.png')

bug['MID-ONB-006'] = add_bug('MID-ONB-006', *FE, 'วางเบอร์ที่มีขีดหรือเว้นวรรคแล้วเลขท้ายหาย', '1. คัดลอก 081-234 5678\n2. วางในช่อง "เบอร์โทรของฉัน"',
                             'ช่องแสดง 0812345678 และกดเข้าสู่ระบบได้', 'ช่องแสดง 08123456 (เลขท้าย 2 ตัวหาย) แล้วขึ้น "เบอร์โทรศัพท์ไม่ถูกต้อง" · maxLength={10} ใน components/PhoneInput.tsx ตัดข้อความก่อนตัดขีดออก\nแก้: เอา maxLength ออก เพราะ sanitizePhoneInput ตัดความยาวให้อยู่แล้ว', 'Medium', 'evidence/MID-ONB-006.png')
bug['MID-ONB-034'] = add_bug('MID-ONB-034', *FE, 'วางหรือพิมพ์เบอร์ที่มี +66 / 66 นำหน้า กลายเป็นเบอร์อื่นโดยไม่มี error', '1. วาง +66812345678 ในช่องเบอร์ (หรือพิมพ์ 66812345678)\n2. กรอกรหัสผ่าน แล้วกด "เข้าสู่ระบบ"',
                             'ตัด 66 ออกเหลือ 812345678 หรือแสดง error (คำถามข้อ 76, 78)', 'ช่องกลายเป็น 668123456 ซึ่งถือว่าเป็นเบอร์ถูกรูปแบบ ไม่มี error ใต้ช่อง เสี่ยงสมัครหรือเข้าด้วยเบอร์ของคนอื่น\nแก้: ใน lib/phone.ts sanitizePhoneInput ตัด 66 นำหน้าเมื่อยาวเกิน 9 หลัก ก่อนตัดความยาว', 'Medium', 'evidence/MID-ONB-034.png')
bug['MID-ONB-035'] = add_bug('MID-ONB-035', *FE, 'ลบหลักแรกของเบอร์ไม่ได้ ถ้าหลักถัดไปไม่ใช่ 0 6 8 9', '1. พิมพ์ 0212345678\n2. เลื่อนเคอร์เซอร์ไปหลัง 0 ตัวแรก แล้วกดลบ',
                             'ลบได้ แล้วพิมพ์ 08 ให้เป็น 0812345678 ได้', 'กดลบแล้วช่องยังเป็น 0212345678 ต้องลบทั้งเบอร์จากท้าย · เบอร์ 0812345678 ลบหลักแรกได้ปกติ · sanitizePhoneInput คืนค่าเดิมเมื่อหลักแรกใหม่ไม่ผ่าน\nแก้: ยอมให้ลบได้เสมอ แล้วค่อยแสดง error ตอนกดปุ่ม', 'Low', 'evidence/MID-ONB-035.png')
bug['MID-ONB-041'] = add_bug('MID-ONB-041', *FE, 'แป้นพิมพ์บังปุ่ม "เข้าสู่ระบบ" และเลื่อนจอไม่ได้', '1. กดช่องเบอร์ แล้วพิมพ์เบอร์\n2. กดช่องรหัสผ่าน แล้วพิมพ์รหัสผ่าน\n3. เลื่อนจอขึ้นโดยไม่ปิดแป้น',
                             'เลื่อนจนเห็นและกด "เข้าสู่ระบบ" ได้', 'ปุ่มอยู่ใต้แป้น (ขอบล่างปุ่ม 1542 / ขอบบนแป้น 1428) เลื่อนแล้วไม่ขยับ ต้องปิดแป้นก่อน หรือกดลูกศรบนแป้นแทน · เห็นใน Expo Go Android 17 ยังไม่ได้ลองบน dev build\nแก้: KeyboardAvoidingView ตั้ง behavior เฉพาะ iOS ใน app/welcome.tsx ให้ Android ใช้ด้วย', 'Medium', 'evidence/MID-ONB-041_2.png')
bug['MID-API-077'] = add_bug('MID-API-077', *BE, 'ส่งจำนวนค่าไม่ตรงกับโมเดล ได้ 500 "Prediction failed" ไม่บอกสาเหตุ', '1. ML service ตั้ง FALL_MODEL=rf_v2_event\n2. POST /api/v1/predict ด้วย features 416 ค่าต่อกรอบ (ตาม API_REFERENCE)',
                             '400 พร้อมบอกจำนวนค่าที่ต้องส่ง (คำถามข้อ 94)', 'Express ตอบ 500 ทั้งที่ ML service ตอบ 400 "ต้องการ 39 ค่าต่อ window แต่ได้ 416" อยู่แล้ว · คู่มือยังเขียน 416\nแก้: services/mlService.js ส่งต่อ status 400 และข้อความจาก ML และแก้ API_REFERENCE', 'Medium', 'evidence/MID-API-077.txt')
bug['MID-API-022'] = add_bug('MID-API-022', 'ML service', 'Dev ML', 'ML service /predict ส่ง features ว่าง ได้ 500', '1. POST /predict ของ ML service ด้วย {"features": []}',
                             '400 หรือ 422 พร้อมข้อความ (คำถามข้อ 94)', '500 Internal Server Error · ขาด 1 ค่าต่อแถวได้ 400 ถูกต้อง\nแก้: เช็ก features ว่างใน app/predict.py run_model แล้ว raise ValueError', 'Low', 'evidence/MID-API-022.txt')
# ---- บั๊กฝั่งหลังบ้าน ----
bug['MID-ESC-021'] = add_bug('MID-ESC-021', *BE, 'ชื่อบริเวณที่มี & < > ทำให้ข้อความในสายโทรเป็น XML ที่ผิด', '1. ส่ง demo/fire ด้วย location = "ห้องนอน & ห้องน้ำ <ชั้น 2>"\n2. ไม่กดรับทราบ รอ 60 วินาที (TWILIO_MODE=real)',
                             'โทรออกและพูดข้อความได้', 'ดักค่าที่โค้ดจะส่งให้ Twilio แล้วตรวจ XML: not well-formed (line 2, column 110) · ชื่อปกติ "ห้องน้ำ" ถูก · โหมด fake มองไม่เห็นปัญหานี้ และยังบันทึก call_made = true (ยังไม่ได้ลองโทรจริง)\nแก้: escape ข้อความใน services/alertService.js makeCall ก่อนใส่ TwiML หรือใช้ twilio.twiml.VoiceResponse', 'High', 'evidence/MID-ESC-021.txt')
bug['MID-API-076'] = add_bug('MID-API-076', *BE, 'กดรับทราบการแจ้งผิดแล้ว ถ้าล้มจริงภายใน 5 นาที ระบบไม่แจ้ง (รอตัดสินใจ)', '1. ตั้ง COOLDOWN_SECONDS=300\n2. ส่ง predict ล้ม แล้วกดรับทราบ\n3. ส่ง predict ล้มจากอุปกรณ์เดิมอีกครั้งภายใน 5 นาที',
                             'ยังไม่ชัด: ควรได้การ์ดใหม่และโทรตามเวลา (คำถามข้อ 64, 100 · MID-E2E-018)', 'ได้ action = cooldown ไม่มีเหตุการณ์ใหม่ ไม่มีการ์ด ไม่มีการโทร · cooldown นับตั้งแต่เกิดเหตุ (escalationService.schedule) ต่างจาก API_REFERENCE ที่เขียนว่าหลัง escalate\nแก้ถ้าทีมเห็นว่าควรแจ้ง: ล้าง cooldown ของอุปกรณ์ตอน ack และแก้คู่มือให้ตรง', 'High', 'evidence/MID-API-076.txt, MID-API-046.txt, MID-API-050.txt')

for cid in ('MID-API-046', 'MID-API-050', 'MID-API-076'):   # ใส่เลขบั๊กให้เคสที่เกี่ยวกัน ผลยังเป็น Pending
    wb = openpyxl.load_workbook(XLSX); ws, r = _find(wb, cid); ws.cell(r, 14).value = bug['MID-API-076']; _save(wb)
rec('MID-ESC-021', 'Failed', f'โหมด fake โทรผ่าน แต่ TwiML ที่โค้ดโหมด real จะส่งให้ Twilio เป็น XML ที่ผิด (ไม่ได้ต่อ Twilio จริง)\nหลักฐาน: evidence/MID-ESC-021.txt (23 พ.ย.)', bug['MID-ESC-021'])

# ---- คำตอบที่โค้ดเขียนไว้ชัด (ทีมแก้ทับได้) ----
CODE = 'จากโค้ด (commit 49fc17a)'
ANS = {91: 'ล็อก 15 นาทีนับจากครั้งแรกที่ผิด ระหว่างล็อกใส่รหัสถูกก็ได้ 429 · อยู่ในหน่วยความจำ รีสตาร์ตแล้วหาย (adminAuthService.js)', 95: 'ปิดเป็น escalated โดย sms_sent / call_made = false (escalationService.js) · ยังไม่มีการแจ้งใครว่าโทรไม่ได้',
       101: 'fake ตั้ง true เมื่อจำลองสำเร็จทุกเบอร์ · true = ส่งคำสั่งโทรสำเร็จ ไม่ได้แปลว่ามีคนรับ (alertService.js, escalationService.js)', 103: 'ใช่ ต้องเป็น x.y.z (modelRegistryService.js VERSION_RE)', 102: 'FALL_MODEL ผิดชื่อเปิดไม่ขึ้น (predict.py) · ส่วนที่เหลือของคำถามยังไม่ตอบ'}
wb = openpyxl.load_workbook(XLSX); s = wb['คำถามถึงทีม']
for r in range(2, 113):
    n = s.cell(r, 1).value
    if n in ANS and not s.cell(r, 3).value: s.cell(r, 3).value = ANS[int(n)]; s.cell(r, 4).value = CODE
for d in s.data_validations.dataValidation:
    d.showErrorMessage = False
_save(wb)
for cid, n in (('MID-API-005', 101), ('MID-API-011', 101), ('MID-API-056', 91), ('MID-API-071', 103), ('MID-ESC-014', 95)):
    wb = openpyxl.load_workbook(XLSX); ws, r = _find(wb, cid); v = ws.cell(r, 13).value
    assert 'ไม่ตรงสมมติฐาน' not in v
    ws.cell(r, 12).value = 'Passed'; ws.cell(r, 13).value = re.sub(r'ข้อที่ยืนยันแล้วผ่านครบ รอทีมตอบคำถามข้อ [^\n]*', f'ส่วนที่เป็นสมมติฐานตรงกับที่โค้ดเขียนไว้ (คำถามข้อ {n})', v); _save(wb)
# ML จาก _queue_ml.json (กรอบจำลอง)
ml = json.load(open(os.path.join(EV, '_queue_ml.json'), encoding='utf-8'))
wb = openpyxl.load_workbook(XLSX); ws, r = _find(wb, 'MID-MLS-007')
ws.cell(r, 9).value = ws.cell(r, 9).value.replace('2. แก้ sha256', '2. ลบ rf_v2_event.pkl แล้วแก้ sha256'); ws.cell(r, 13).value = '[แก้ 23 พ.ย.] เพิ่มการลบไฟล์ก่อนขั้น 2 เพราะสคริปต์ตั้งใจข้ามไฟล์ที่มีอยู่แล้ว (เขียนไว้ใน fetch_models.sh)'; _save(wb)
for cid, v in ml.items():
    st, note = v['status'], v['note']
    if cid == 'MID-MLS-007': st, note = 'Passed', 'ขั้น 1 โหลดครบ 3 ไฟล์ exit 0 · ขั้น 2 ลบ rf_v2_event.pkl แล้วแก้ sha256 ได้ exit 1 พร้อมข้อความ sha256 ไม่ตรง (ทำในโฟลเดอร์สำเนา) · สังเกต: ถ้าไม่ลบไฟล์ สคริปต์ข้ามไม่ตรวจ sha256 ตามที่เขียนไว้'
    if cid == 'MID-API-077': st = 'Pending'
    rec(cid, st, f'{note}\nหลักฐาน: evidence/{cid}.txt (23 พ.ย. · ML จริง rf_v2_event · Express ไม่ต่อ Supabase)', bug.get(cid))
rec('MID-MLS-003', 'Passed', "เปิดไม่ขึ้น ได้ RuntimeError: FALL_MODEL='rf_v9' ไม่รู้จัก ใช้ rf_v1 หรือ rf_v2_event · ตรงกับที่โค้ดเขียนไว้ (คำถามข้อ 102)\nหลักฐาน: evidence/MID-MLS-003.txt (23 พ.ย.)")

# ---- ผลชีต 1 ----
for cid, v in q.items():
    if v['err']: continue
    ex = ('\n' + ' · '.join(v['extra'])) if v['extra'] else ''
    ev = f'\nหลักฐาน: evidence/{cid}.png ({D})'
    if v['bad']:
        assert cid in bug, (cid, v['bad'])
        rec(cid, 'Failed', v['note'] + ex + ev, bug[cid])
    elif v['asm'] or v['extra']:
        qs = ', '.join(dict.fromkeys(str(a[2]) for a in v['asm'])); miss = [a[1] for a in v['asm'] if not a[0]]
        t = (f'\nรอทีมตอบคำถามข้อ {qs}' if qs else '\nยังทำไม่ครบทุกขั้น') + (f' · ยังไม่ตรง/ยังไม่ได้ดู: {"; ".join(miss)}' if miss else '')
        rec(cid, 'Pending', v['note'] + ex + t + ev, bug.get(cid))
    else: rec(cid, 'Passed', v['note'] + ev)

# ---- ยังเทสไม่ได้ ----
LOGIN = 'ยังเทสไม่ได้: ต้องสมัครหรือ login บัญชีจริง ซึ่งเขียนลงฐานข้อมูลจริง รอเจ้าของโปรเจคทำเอง หรือใช้ Supabase โปรเจกต์ทดสอบแยก'
APP = LOGIN + ' และต้องมีข้อมูลทดสอบ (qa_base.sql / TD-xx) ซึ่งไม่มีในเครื่อง'
THAI = 'ยังเทสไม่ได้: ต้องพิมพ์/วางภาษาไทย emoji หรืออักขระพิเศษด้วยมือ (adb พิมพ์ไม่ได้)'
TB = 'ยังเทสไม่ได้: ต้องฟังเสียง TalkBack ด้วยตัวเอง'
MODEL = 'ยังเทสไม่ได้: ไม่มีไฟล์โมเดลในเครื่อง ต้องโหลดจาก GitHub Release ด้วย scripts/fetch_models.sh'
HW = 'ยังเทสไม่ได้: ต้องมี ESP32 จริง'
why = {}
for n in (11, 12, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24, 47, 50, 52, 54, 55, 56, 58, 59, 62, 63, 64): why[f'MID-ONB-{n:03d}'] = LOGIN
for n in (28, 45, 48, 49, 57): why[f'MID-ONB-{n:03d}'] = THAI
for n in (44, 66): why[f'MID-ONB-{n:03d}'] = TB
why['MID-ONB-001'] = 'ไปหน้ายินดีต้อนรับเองโดยไม่ต้องกด แต่มี popup ขอสิทธิ์แจ้งเตือนทับ (ดูบั๊ก) · ยังเทียบ splash 3 หน้าไม่ได้ เพราะไม่มีภาพ splash_0 / 1 / 3 จาก Figma'
why['MID-MLS-008'] = 'ยังเทสไม่ได้: ไม่มีข้อมูล data/raw 801 ไฟล์ในเครื่อง'
for n in (9, 10): why[f'MID-MLS-{n:03d}'] = 'ยังเทสไม่ได้: ต้องมีชุดข้อมูล CSI ของ QA (D8) ที่ไม่ได้ใช้เทรน'
wb = openpyxl.load_workbook(XLSX); cnt = 0
for ws in wb:
    m = re.match(r'(\d+)-', ws.title)
    if not m: continue
    for r in range(2, ws.max_row + 1):
        cid = ws.cell(r, 1).value
        if not cid or ws.cell(r, 12).value != 'Not Start': continue
        w = why.get(cid)
        if not w and int(m[1]) in (2, 3, 4, 5, 6, 7): w = APP
        if not w and int(m[1]) == 10: w = HW
        if not w and int(m[1]) in (11, 12): w = HW + (' และแอป dev build' if int(m[1]) == 11 else ' แอป dev build และเบอร์โทรทดสอบ')
        if not w: print('เหลือ Not Start', cid); continue
        tags = ' '.join(re.findall(r'\[(?:แก้|เพิ่ม|ย้าย)[^\]]*\][^\[\n]*', ws.cell(r, 13).value or '')).strip()
        ws.cell(r, 12).value = 'Blocked'; ws.cell(r, 13).value = w + ('\n' + tags if tags else ''); cnt += 1
        if cid in bug: ws.cell(r, 14).value = bug[cid]
_save(wb); print('blocked', cnt, bug)
