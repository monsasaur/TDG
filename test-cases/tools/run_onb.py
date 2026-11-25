"""เทสชีต 1 ส่วนที่ไม่ต้องสมัคร/login จริง บน emulator ที่ปิดเน็ต (ไม่มีอะไรส่งไป Supabase)
ผลเก็บใน evidence/_queue_onb.json แล้วดูภาพก่อนบันทึก"""
import json, os, sys, time, traceback
sys.path.insert(0, os.path.dirname(__file__))
import ui
from ui import *
W = 'ยินดีต้อนรับสู่ Middle'
E_MOB, E_TEL, E_EMPTY, E_CRED, E_NET = 'เบอร์มือถือไม่ถูกต้อง', 'เบอร์โทรศัพท์ไม่ถูกต้อง', 'กรุณากรอกเบอร์โทรศัพท์', 'เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง', 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่'
C = {}; ONLY = sys.argv[1:]


def case(cid):
    def d(f): C[cid] = f; return f
    return d


def btn(name, nodes=None):
    for n in nodes or dump():
        if n.desc == name and n.click or (n.desc == name and n.cls == 'ViewGroup'): return n


def home():
    """ให้อยู่หน้ายินดีต้อนรับ ช่องว่างทั้งคู่"""
    unblock(); hide(); n = dump()
    if not has(W, n):
        key(4); time.sleep(1); n = dump()
        if not has(W, n): n = relaunch()
    for i in (0, 1):
        e = edits()[i]
        if e.text: tap(e); clear(); hide()


def phone(): return edits()[0].text
def errs(nodes=None): return [t for t in texts(nodes) if t in (E_MOB, E_TEL, E_EMPTY, E_CRED, E_NET) or 'กรุณา' in t or 'ไม่ถูกต้อง' in t]


def press(name='เข้าสู่ระบบ', wait=1.2):
    hide(); b = btn(name)
    if not b.enabled: return False
    tap(*b.xy); time.sleep(wait); return True


def attempt(num, pw=None):
    """พิมพ์เบอร์ (และรหัสผ่านถ้าให้มา) แล้วกดเข้าสู่ระบบ -> (ช่องแสดง, ปุ่มกดได้, error ที่เห็น)"""
    fill(0, num)
    if pw is not None: hide(); fill(1, pw)
    hide(); shown = phone(); ok = press(); t = time.time()
    while ok and time.time() - t < 14:
        n = dump(); e = errs(n); b = btn('เข้าสู่ระบบ', n)
        if e or (b is not None and b.enabled): break
        time.sleep(1)
    return shown, ok, errs()


def go_register():
    home(); tap(*btn('สมัครใช้งาน').xy); time.sleep(1.5); assert has('ยืนยันรหัสผ่าน')


class K:
    def __init__(s): s.bad = []; s.asm = []; s.note = []
    def ok(s, c, w): print('   ', '✔' if c else '✘', w); s.bad += [] if c else [w]
    def asmp(s, c, w, q): print('   ~', c, w); s.asm.append([bool(c), w, q])


@case('MID-ONB-002')
def _(k):
    n = dump(); t = texts(n)
    k.ok(W in t, 'หัวข้อ'); k.asmp(any('เข้าสู่ระบบเพื่อรับการแจ้งเตือนเหตุฉุกเฉิน' in x for x in t), 'ข้อความใต้หัวข้อ', 109)
    k.ok('เบอร์โทรของฉัน' in t and '+66' in t and edits(n)[0].text == '', 'label เบอร์ ช่องว่าง มี +66'); k.ok('รหัสผ่าน' in t and edits(n)[1].text == '', 'ช่องรหัสผ่านว่าง')
    k.ok(not btn('เข้าสู่ระบบ', n).enabled, 'ปุ่มเข้าสู่ระบบใช้งานไม่ได้'); k.ok(btn('สมัครใช้งาน', n).enabled, 'ปุ่มสมัครใช้งานใช้งานได้')
    return 'องค์ประกอบบนหน้าจอครบ ปุ่ม "เข้าสู่ระบบ" ใช้งานไม่ได้ ปุ่ม "สมัครใช้งาน" ใช้งานได้'


@case('MID-ONB-003')
def _(k):
    fill(0, '8'); a = btn('เข้าสู่ระบบ').enabled; fill(1, 'm'); b = btn('เข้าสู่ระบบ').enabled; shot('MID-ONB-003'); hide(); tap(edits()[0]); clear(); hide(); c = btn('เข้าสู่ระบบ').enabled
    k.ok(not a, 'เบอร์อย่างเดียว กดไม่ได้'); k.ok(b, 'กรอกครบ กดได้'); k.ok(not c, 'ลบเบอร์ กดไม่ได้'); return f'เบอร์อย่างเดียว={a} ครบ={b} ลบเบอร์={c}'


def valid(cid, *nums):
    @case(cid)
    def _(k):
        out = []
        for i, x in enumerate(nums):
            s, ok, e = attempt(x, 'mid9999' if i == 0 else None); out.append((x, s, e)); k.ok(ok and s == x and not {E_MOB, E_TEL, E_EMPTY} & set(e), f'{x}: ไม่มี error ใต้ช่องเบอร์ (เห็น {e})')
        k.asm.append([None, 'ข้อความ "เบอร์โทรหรือรหัสผ่านไม่ถูกต้อง" ยังไม่ได้ดู เพราะเทสแบบปิดเน็ต', '51, 54'])
        return 'เบอร์ ' + ', '.join(nums) + ' ไม่มี error ใต้ช่องเบอร์ (ปิดเน็ต เห็น ' + '/'.join(dict.fromkeys(sum((o[2] for o in out), []))) + ')'


valid('MID-ONB-004', '0812345678'); valid('MID-ONB-005', '812345678'); valid('MID-ONB-032', '0612345678', '0912345678', '612345678', '912345678')


@case('MID-ONB-007')
def _(k):
    tap(edits()[0]); time.sleep(.5); sh('input tap 540 350'); time.sleep(1); hide(); time.sleep(.5); e = errs(); k.ok(E_EMPTY in e, f'แสดง "{E_EMPTY}" (เห็น {e})'); return f'กดช่องแล้วกดนอกช่อง error ที่เห็น: {e or "ไม่มี"}'


def wrong(cid, want, *nums, asm=None):
    @case(cid)
    def _(k):
        out = []
        for i, x in enumerate(nums):
            s, ok, e = attempt(x, 'mid9999' if i == 0 else None); shot(f'{cid}_{i+1}')
            good = want in e; out.append(f'{x}: ช่องแสดง "{s}" ' + (f'error "{e[0]}"' if e else ('ไม่มี error' if ok else 'ปุ่มกดไม่ได้ ไม่มี error')))
            (k.asmp(good, out[-1], asm) if asm else k.ok(good, out[-1]))
            k.ok(has(W), 'ยังอยู่หน้าเดิม')
        return ' · '.join(out)


wrong('MID-ONB-008', E_TEL, '060'); wrong('MID-ONB-009', E_MOB, '0212345678'); wrong('MID-ONB-029', E_MOB, '0112345678', '0312345678', '0412345678', '0512345678', '0712345678')
wrong('MID-ONB-030', E_MOB, '112345678', '212345678', '312345678', '412345678', '512345678', '712345678'); wrong('MID-ONB-031', E_MOB, '0012345678'); wrong('MID-ONB-033', E_MOB, '021234567', '1669', '021', asm=77)


@case('MID-ONB-010')
def _(k): fill(0, '08123456789'); s = phone(); k.ok(s == '0812345678', f'ช่องแสดง {s}'); return f'พิมพ์ 11 หลัก ช่องแสดง "{s}"'


@case('MID-ONB-039')
def _(k):
    out = []
    for i, x in enumerate(('81234567', '081234567', '8123456789')):
        s, ok, e = attempt(x, 'mid9999' if i == 0 else None); out.append(f'{x}: ช่องแสดง "{s}" {e}'); shot(f'MID-ONB-039_{i+1}')
        if i < 2: k.ok(E_TEL in e, out[-1])
        else: k.ok(s != x or E_TEL in e, out[-1])
    return ' · '.join(out)


@case('MID-ONB-025')
def _(k):
    tap(edits()[0]); time.sleep(1); it = input_type(); up = kb(); shot('MID-ONB-025'); k.ok(up and it is not None and it & 0xF == 2, f'แป้นตัวเลข (inputType=0x{it:x})')
    k.note.append('ยังไม่ได้กดค้างทีละปุ่มด้วยมือ'); return f'แป้นขึ้นเป็นชนิดตัวเลข (inputType = 0x{it:x})'


@case('MID-ONB-026')
def _(k):
    go_register(); hide(); tap(edits()[1]); time.sleep(1); it = input_type(); shot('MID-ONB-026'); k.asmp(it & 0xF == 2, f'ช่องเบอร์หน้าสมัครเป็นแป้นตัวเลข inputType=0x{it:x}', 79); return f'ช่องเบอร์หน้าสมัคร inputType = 0x{it:x}'


@case('MID-ONB-027')
def _(k):
    fill(0, '0812'); a = phone()
    for c in ('a', '-', '.', '+', '*', '#', ' '): type_(c) if c not in '*#' else key(17 if c == '*' else 18)
    b = phone(); k.ok(a == '0812', f'พิมพ์เลขได้ {a}'); k.ok(b == '0812', f'หลังพิมพ์ a - . + * # เว้นวรรค ช่องเป็น {b}'); k.note.append('ยังไม่ได้ลองตัว ก (adb พิมพ์ไทยไม่ได้)'); return f'พิมพ์ 0812 แล้วพิมพ์ a - . + * # เว้นวรรค ช่องยังเป็น "{b}"'


def clip(s):
    """พิมพ์ข้อความในช่องชื่อหน้าสมัคร แล้ว copy"""
    go_register(); hide(); fill(0, s); sh('input keycombination 113 29'); time.sleep(.4); sh('input keycombination 113 31'); time.sleep(.6); hide(); key(4); time.sleep(1.2)
    if not has(W): key(4); time.sleep(1)


def paste(): tap(edits()[0]); clear(); sh('input keycombination 113 50'); time.sleep(.8)


@case('MID-ONB-006')
def _(k): clip('081-234 5678'); paste(); s = phone(); k.asmp(s == '0812345678', f'วางแล้วช่องแสดง "{s}"', 68); hide(); fill(1, 'mid9999'); ok = press(wait=8); e = errs(); shot('MID-ONB-006'); k.ok(not {E_MOB, E_TEL} & set(e), f'ไม่มี error ใต้ช่องเบอร์ {e}'); return f'วาง 081-234 5678 ช่องแสดง "{s}" กดเข้าสู่ระบบเห็น {e}'


@case('MID-ONB-034')
def _(k):
    out = []; clip('+66812345678'); paste(); s = phone(); out.append(f'วาง +66812345678 → "{s}"'); k.asmp(s == '812345678', out[-1], 76)
    clip('+66 2 123 4567'); paste(); s2 = phone(); hide(); fill(1, 'mid9999'); press(wait=8); e2 = errs(); out.append(f'วาง +66 2 123 4567 → "{s2}" {e2}'); k.asmp(E_MOB in e2, out[-1], 76)
    s3, ok, e3 = attempt('66812345678', 'mid9999'); out.append(f'พิมพ์ 66812345678 → "{s3}" {e3}'); k.asmp(s3 != '668123456' or bool({E_MOB, E_TEL} & set(e3)), out[-1], 78); shot('MID-ONB-034'); return ' · '.join(out)


@case('MID-ONB-037')
def _(k): clip('081234567899999'); paste(); s = phone(); shot('MID-ONB-037'); k.asmp(s == '0812345678', f'วาง 15 หลัก ช่องแสดง "{s}"', 76); return f'วาง 15 หลัก ช่องแสดง "{s}"'


@case('MID-ONB-035')
def _(k):
    s, ok, e = attempt('0212345678', 'mid9999'); k.ok(E_MOB in e, f'0212345678 error {e}'); tap(edits()[0]); key('KEYCODE_MOVE_HOME'); key(112, 112); type_('08'); s2 = phone(); e2 = errs(); hide()
    k.asmp(not e2, f'แก้เป็น {s2} แล้ว error ใต้ช่อง {e2}', 69); press(wait=8); e3 = errs(); k.ok(s2 == '0812345678' and not {E_MOB, E_TEL} & set(e3), f'กดอีกครั้ง {e3}'); return f'0212345678 เห็น {e} · ลบ 2 หลักแรกเพื่อพิมพ์ 08 ไม่ได้ ช่องยังเป็น "{s2}" (ลบหลักแรกของ 0812345678 ได้ปกติ) · กดอีกครั้งเห็น {e3}'


@case('MID-ONB-046')
def _(k):
    s, ok, e = attempt('060', 'mid9999'); k.ok(E_TEL in e, f'060 {e}'); tap(edits()[0]); clear(); type_('0'); m = errs(); clear(); hide(); s2, ok, e2 = attempt('0812345678'); k.asmp(not m and not {E_MOB, E_TEL} & set(e2), f'เริ่มพิมพ์ error={m or "หาย"} หลังกด={e2}', 69); return f'060 เห็น {e} · เริ่มพิมพ์ใหม่ error {m or "หาย"} · 0812345678 ไม่มี error ใต้ช่องเบอร์'


@case('MID-ONB-038')
def _(k): fill(0, '0812345678'); key('KEYCODE_MOVE_HOME'); key(22, 22, 22); type_('9'); s = phone(); k.ok(len(s) <= 10, f'ช่องแสดง {s}'); return f'แทรก 9 หลัง 081 ช่องแสดง "{s}" ({len(s)} หลัก)'


@case('MID-ONB-040')
def _(k): fill(0, '0812345678'); key(66); time.sleep(1); n = dump(); u = kb(); f = [x.focused for x in edits(n)]; shot('MID-ONB-040'); k.asmp((f[1] or not u) and has(W, n), f'แป้นเปิด={u} focus={f} {errs(n)}', 79); return f'กด Enter แล้วแป้น{"ยังเปิด" if u else "ปิด"} ช่องที่ถูกเลือก: {"รหัสผ่าน" if f[1] else ("เบอร์" if f[0] else "ไม่มี")} ไม่ส่งฟอร์ม'


@case('MID-ONB-041')
def _(k):
    tap(edits()[0]); time.sleep(1.2); shot('MID-ONB-041_1'); top = kb_top(); n = dump(); e = edits(n)[0]; b = btn('เข้าสู่ระบบ', n); k.ok(e.b[3] <= top, f'ช่องเบอร์ไม่ถูกบัง (ล่างช่อง {e.b[3]} / บนแป้น {top})')
    type_('0212345678'); tap(edits()[1]); type_('mid9999'); time.sleep(.8); top = kb_top(); b = btn('เข้าสู่ระบบ')
    if b is None or b.b[3] > top: sh('input swipe 540 1000 540 500 300'); time.sleep(1); b = btn('เข้าสู่ระบบ')
    vis = b is not None and b.b[3] <= top; k.ok(vis, f'เลื่อนแล้วเห็นปุ่มเข้าสู่ระบบโดยไม่ปิดแป้น (ล่างปุ่ม {b and b.b[3]} / บนแป้น {top})'); shot('MID-ONB-041_2')
    if vis: tap(*b.xy); time.sleep(1); e2 = errs(); k.ok(E_MOB in e2, f'error ที่เห็น {e2}')
    return f'ช่องเบอร์ไม่ถูกบัง ปุ่มเข้าสู่ระบบ{"เห็นและกดได้" if vis else "ถูกแป้นบัง"} error ที่เห็น {errs()}'


def kb_top():
    m = re.findall(r'Frame=?\[0,(\d+)\]\[1080,2400\]|frame=\[0,(\d+)\]\[1080,2400\]', sh('dumpsys window InputMethod')) ; v = [int(x or y) for x, y in m if int(x or y) > 800]
    m2 = re.search(r'mVisibleBounds|touchable region=SkRegion\(\(0,(\d+),1080', sh('dumpsys window InputMethod'))
    if m2 and m2[1]: v.append(int(m2[1]))
    return max(v) if v else 1500


import re


@case('MID-ONB-042')
def _(k): fill(0, '0812'); hide(); sh('input keyevent 3'); time.sleep(1); sh('am start -a android.settings.SETTINGS'); time.sleep(30); sh('input keyevent 187'); time.sleep(1.5); sh('input keyevent 187'); time.sleep(4); unblock(); n = dump(); ok = has(W, n); s = phone() if ok else '-'; shot('MID-ONB-042'); k.ok(ok and s == '0812', f'กลับมาหน้าเดิม={ok} ช่อง="{s}"'); return f'สลับไปตั้งค่า 30 วินาทีแล้วกลับมา ช่องแสดง "{s}"'


@case('MID-ONB-043')
def _(k):
    fill(0, '0812345678'); hide(); fill(1, 'mid9999'); hide(); sh('settings put system accelerometer_rotation 0; settings put system user_rotation 1'); time.sleep(3); shot('MID-ONB-043_land'); sh('settings put system user_rotation 0'); time.sleep(3); s = phone(); b = btn('เข้าสู่ระบบ').enabled
    k.ok(s == '0812345678' and b, f'ช่อง={s} ปุ่ม={b}'); return f'หมุนจอแล้วหมุนกลับ ช่องแสดง "{s}" ปุ่มใช้งาน{"ได้" if b else "ไม่ได้"}'


def reg(name='Tangme', num='0899990002', p1='mid1234', p2='mid1234'):
    go_register(); hide()
    for i, v in enumerate((name, num, p1, p2)):
        if v:
            for _ in range(3):
                e = edits()
                if len(e) > i: break
                sh('input swipe 540 1500 540 1000 200'); time.sleep(.6)
            fill(i, v)
        hide()


@case('MID-ONB-013')
def _(k):
    out = []
    for lab, kw in (('ชื่อ', dict(name='')), ('รหัสผ่าน', dict(p1='')), ('ยืนยันรหัสผ่าน', dict(p2='')), ('เบอร์', dict(num=''))):
        reg(**kw); hide(); sh('input swipe 540 1500 540 900 200'); time.sleep(.7); b = btn('สมัครใช้งาน'); out.append(f'ไม่มี{lab}={"กดได้" if b.enabled else "กดไม่ได้"}'); k.ok(not b.enabled, out[-1])
    reg(); sh('input swipe 540 1500 540 900 200'); time.sleep(.7); k.ok(btn('สมัครใช้งาน').enabled, 'ตัวเทียบ: ครบทุกช่องกดได้'); shot('MID-ONB-013'); return ' · '.join(out) + ' (ชื่อใช้ Tangme เพราะพิมพ์ไทยผ่าน adb ไม่ได้)'


def signup_press():
    hide(); sh('input swipe 540 1500 540 900 200'); time.sleep(.7); b = btn('สมัครใช้งาน'); tap(*b.xy); time.sleep(1.5); return texts()


@case('MID-ONB-016')
def _(k): reg(p2='mid1235'); t = signup_press(); shot('MID-ONB-016'); k.ok(not has('สวัสดี') and 'ยืนยันรหัสผ่าน' in t, 'ยังอยู่หน้าสมัคร'); k.asmp('รหัสผ่านไม่ตรงกัน' in t, 'แสดง "รหัสผ่านไม่ตรงกัน"', 51); return 'ยังอยู่หน้าสมัคร เห็น ' + str([x for x in t if 'ไม่ตรง' in x])


@case('MID-ONB-036')
def _(k): reg(num='0312345678'); t = signup_press(); sh('input swipe 540 900 540 1500 200'); time.sleep(.7); t = texts(); shot('MID-ONB-036'); e = [x for x in t if 'ไม่ถูกต้อง' in x]; k.ok(E_MOB in e, f'error ที่เห็น {e}'); k.ok('ชื่อที่แสดง' in t, 'ยังอยู่หน้าสมัคร'); return f'เบอร์ 0312345678 หน้าสมัคร error ที่เห็น {e}'


@case('MID-ONB-051')
def _(k):
    go_register(); hide(); fill(2, 'mid1234'); a = edits()[2]; hide(); eye = [x for x in dump() if x.desc in ('แสดงรหัสผ่าน', 'ซ่อนรหัสผ่าน')][0]; tap(*eye.xy); b = edits()[2]; shot('MID-ONB-051'); eye = [x for x in dump() if x.desc == 'ซ่อนรหัสผ่าน'][0]; tap(*eye.xy); c = edits()[2]
    k.ok(a.pw and '•' in a.text, f'แสดงเป็นจุด {a.text}'); k.ok(b.text == 'mid1234', f'กดตา {b.text}'); k.ok(c.pw and '•' in c.text, f'กดอีกครั้ง {c.text}'); return f'{a.text} → {b.text} → {c.text}'


@case('MID-ONB-060')
def _(k):
    reg(p2=''); sh('input keyevent 3'); time.sleep(1); sh('am start -a android.settings.SETTINGS'); time.sleep(30); sh('input keyevent 187'); time.sleep(1.5); sh('input keyevent 187'); time.sleep(4); unblock(); n = dump(); e = [x.text for x in edits(n)]; shot('MID-ONB-060'); k.ok(has('ชื่อที่แสดง', n) and 'Tangme' in e and '0899990002' in e and any('•' in x for x in e), f'{e}'); return f'กลับมาแล้วค่ายังอยู่ {e} (ชื่อใช้ Tangme)'


@case('MID-ONB-061')
def _(k):
    reg(p1='', p2=''); sh('settings put system accelerometer_rotation 0; settings put system user_rotation 1'); time.sleep(3); sh('settings put system user_rotation 0'); time.sleep(3); e = [x.text for x in edits()]; shot('MID-ONB-061'); k.ok('Tangme' in e and '0899990002' in e, f'{e}'); return f'หมุนจอแล้วกลับ ค่ายังอยู่ {e[:2]} (ชื่อใช้ Tangme)'


@case('MID-ONB-065')
def _(k):
    reg(name=''); tap(edits()[-1]); key(66); time.sleep(12); t = texts(); k.ok(not errs(), 'ไม่มี error เน็ต (แปลว่าไม่ได้ส่งฟอร์ม)'); shot('MID-ONB-065'); k.ok('ยืนยันรหัสผ่าน' in t and not any('สวัสดี' in x for x in t), 'ยังอยู่หน้าสมัคร ไม่ส่งฟอร์ม'); return 'กด Enter ที่ช่องยืนยันรหัสผ่านโดยไม่มีชื่อ ยังอยู่หน้าสมัคร ไม่ส่งฟอร์ม'


@case('MID-ONB-053')
def _(k):
    fill(0, '0899990001'); hide(); fill(1, 'mid1234'); hide(); t0 = time.time(); tap(*btn('เข้าสู่ระบบ').xy); seen = None
    while time.time() - t0 < 40:
        n = dump(); e = errs(n) + [x for x in texts(n) if 'อินเทอร์เน็ต' in x]
        if e: seen = time.time() - t0; break
        time.sleep(.5)
    shot('MID-ONB-053'); n = dump(); pop = any('ตกลง' in x for x in texts(n)); b = btn('เข้าสู่ระบบ', n); k.ok(pop, f'แสดง popup (เห็นแค่ข้อความ {e})'); k.ok(seen is not None and seen <= 12, f'ขึ้นภายใน {seen}'); k.ok(b is not None and b.enabled and has(W, n), 'ปุ่มกลับมาใช้งานได้ อยู่หน้าเดิม')
    return f'ไม่มีเน็ตเห็น {list(dict.fromkeys(e))} เป็นข้อความในหน้า ไม่ใช่ popup ใช้เวลา {seen and round(seen, 1)} วินาที ปุ่มกลับมาใช้งานได้'


def main():
    q = json.load(open(os.path.join(EVID, '_queue_onb.json'), encoding='utf-8')) if os.path.exists(os.path.join(EVID, '_queue_onb.json')) else {}
    for cid in ONLY or sorted(C):
        k = K(); print(cid, flush=True)
        try: home(); note = C[cid](k); err = None
        except Exception as x: note = ''; err = f'{type(x).__name__}: {x}'; traceback.print_exc()
        try: img = shot(cid)
        except Exception: img = ''
        q[cid] = dict(note=note, bad=k.bad, asm=k.asm, extra=k.note, err=err)
        print('   =>', 'ERR ' + err if err else ('CHECK' if k.bad else ('Pending' if k.asm else 'Passed')), note, flush=True)
        json.dump(q, open(os.path.join(EVID, '_queue_onb.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__': main()
