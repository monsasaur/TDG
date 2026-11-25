"""เทสชีต 9 (โทรแจ้งเหตุและ AI) และบางเคสของชีต 13 ในเครื่อง ใช้ server ตัวเดียวกับ run_api.py
ผลเก็บใน evidence/_queue.json แล้วบันทึกลงไฟล์ด้วย  python tools/run_esc.py --flush
(แยกเพราะรันคู่กับ run_api.py ได้โดยไม่เขียนไฟล์ Excel ชนกัน)
"""
import json, os, re, subprocess, sys, time
sys.path.insert(0, os.path.dirname(__file__))
import run_api as R
from rec import rec
R.PORT = 3901; R.BASE = 'http://127.0.0.1:3901'
R.CASES.clear()
S, call, say, wait, of, fire, console = R.S, R.call, R.say, R.wait, R.of, R.fire, R.console
QUEUE = os.path.join(R.EVID, '_queue.json')
MSG = lambda loc: f'ตรวจพบเหตุการณ์ล้มในบริเวณ {loc} โปรดตรวจสอบความปลอดภัยและเข้าช่วยเหลือทันที'


def fire_at(dev, loc=None):
    b = {'device_id': dev}
    if loc is not None: b['location'] = loc
    return call('POST', '/api/v1/demo/fire', b, key='demo')


def ack(ev): return call('POST', f'/api/v1/alert/ack/{ev}', {'acknowledged_by': 'QA'}, key='app')


def until(text, since, limit):
    """รอจน console มีข้อความ คืนวินาทีที่เจอ (None = ไม่เจอ)"""
    t = time.time()
    while time.time() - t < limit:
        if any(text in l for l in S.out[since:]): return time.time()
        time.sleep(.1)


def dump(m): say('--- console ---\n' + '\n'.join(S.out[m:]))


case = R.case


@case('MID-ESC-001')
def _(c):
    S.start(force=True); m = len(S.out); t = time.time(); st, j, *_ = fire_at('QA-0002')
    at = until('Calls (fake) made', m, 70); time.sleep(.5); dump(m); e = of('QA-0002')[0]; say(json.dumps(e, ensure_ascii=False))
    c.ok(st == 200 and j['action'] == 'awaiting_acknowledge' and j['ack_timeout_seconds'] == 60, '200 awaiting_acknowledge 60 วินาที')
    c.ok(at and 58 <= at - t <= 63, f'โทรที่วินาทีที่ {at - t:.1f}' if at else 'ไม่มีการโทร'); c.ok(len(console('SMS (fake) sent 2/2', since=m)) == 1, 'SMS ครบ 2 เบอร์')
    c.ok(e['escalated'] and e['escalated_at'] and e['sms_sent'] and e['call_made'], 'escalated, sms_sent, call_made = true')
    return f'โทรและส่ง SMS ครบ 2 เบอร์ที่วินาทีที่ {at - t:.1f} escalated / sms_sent / call_made = true'


@case('MID-ESC-002')
def _(c):
    S.start(force=True); m = len(S.out); st, j, *_ = fire_at('QA-0002'); wait(55); a, ja, *_ = ack(j['event_id']); wait(35); dump(m); e = of('QA-0002')[0]; say(json.dumps(e, ensure_ascii=False))
    c.ok(a == 200 and ja['escalation_cancelled'] is True, f'ack {a} escalation_cancelled = {ja.get("escalation_cancelled")}')
    c.ok(not console('TWILIO', since=m), 'ไม่มีการโทรหรือ SMS ถึงวินาทีที่ 90'); c.ok(not e.get('escalated') and not e.get('call_made'), 'ไม่ escalated และไม่ call_made')
    return f'กดวินาทีที่ 55 ได้ {a} escalation_cancelled = {ja["escalation_cancelled"]} ถึงวินาทีที่ 90 ไม่มีการโทร'


@case('MID-ESC-003')
def _(c):
    S.start(force=True); st, j, *_ = fire_at('QA-0002'); wait(65); a, ja, *_ = ack(j['event_id']); c.ok(st == 200, 'demo/fire 200'); c.ok(a == 409 and 'error' in ja, f'ack {a} {ja}')
    return f'กดหลังหมดเวลาได้ {a} "{ja.get("error")}"'


@case('MID-ESC-004')
def _(c):
    S.start(force=True, ACK_TIMEOUT_SECONDS='30'); m = len(S.out); t = time.time(); st, j, *_ = fire_at('QA-0002'); at = until('Calls (fake) made', m, 40); dump(m); S.start()
    c.ok(j['ack_timeout_seconds'] == 30, 'ack_timeout_seconds = 30'); c.ok(at and at - t <= 35, 'โทรก่อนวินาทีที่ 35'); return f'ack_timeout_seconds = 30 โทรที่วินาทีที่ {at - t:.1f}'


@case('MID-ESC-011')
def _(c):
    S.start(force=True, ACK_TIMEOUT_SECONDS='5'); m = len(S.out); t = time.time(); st, j, *_ = fire_at('QA-0002'); time.sleep(max(0, t + 4 - time.time())); codes = []
    for _i in range(3): codes.append(ack(j['event_id'])[0]); time.sleep(.7)
    wait(6); dump(m); e = of('QA-0002')[0]; say(json.dumps(e, ensure_ascii=False)); calls = len(console('Calls (fake) made', since=m))
    c.ok(set(codes) <= {200, 409}, f'ได้ {codes}'); c.ok(not (e.get('acknowledged') and (e.get('escalated') or calls)), 'ไม่ทั้งรับทราบและโทร')
    c.ok((200 in codes and calls == 0) or (200 not in codes and calls == 1), f'โทร {calls} ครั้ง'); S.start()
    return f'กด 3 ครั้งได้ {codes} โทร {calls} ครั้ง escalated = {bool(e.get("escalated"))}'


@case('MID-ESC-012')
def _(c):
    S.start(force=True, COOLDOWN_SECONDS='300'); m = len(S.out); t = time.time(); fire_at('QA-0002'); at = until('Calls (fake) made', m, 70)
    time.sleep(max(0, t + 120 - time.time())); k = len(S.out); s2, j2, *_ = fire_at('QA-0002'); time.sleep(max(0, t + 370 - time.time())); extra = len(console('Calls (fake) made', since=k)); s3, j3, *_ = fire_at('QA-0002'); wait(64); dump(m)
    c.ok(bool(at), 'ครั้งแรกโทรหลัง 60 วินาที'); c.ok(j2['action'] == 'cooldown' and j2.get('message') == 'device อยู่ใน cooldown — ไม่สร้าง event ใหม่' and extra == 0, f'ครั้งที่ 2 {j2}')
    c.ok(j3['action'] == 'awaiting_acknowledge' and j3.get('event_id'), f'ครั้งที่ 3 {j3["action"]}')
    return f'ครั้งแรกโทรวินาทีที่ {at - t:.0f} · วินาทีที่ 120 ได้ cooldown ไม่มีการโทรเพิ่ม · วินาทีที่ 370 ได้ {j3["action"]}'


@case('MID-ESC-013')
def _(c):
    S.start(force=True, COOLDOWN_SECONDS='300'); a, ja, *_ = fire_at('QA-0002'); wait(5); b, jb, *_ = fire_at('QA-0001')
    c.ok(ja.get('event_id') and jb.get('event_id') and ja['event_id'] != jb['event_id'] and jb['action'] == 'awaiting_acknowledge', 'ได้ event_id ใหม่'); return f'QA-0002 และ QA-0001 ได้ event_id คนละตัว action = {jb["action"]}'


@case('MID-ESC-014')
def _(c):
    S.start(force=True, ALERT_PHONES=None); m = len(S.out); fire_at('QA-0002'); wait(65); dump(m); e = of('QA-0002')[0]; say(json.dumps(e, ensure_ascii=False)); h, *_ = call('GET', '/health')
    c.ok(console('ALERT_PHONES empty', since=m) and h == 200, 'console แจ้งว่าว่าง และ Express ไม่ล่ม')
    c.assume(e.get('escalated') is True and e.get('sms_sent') is False and e.get('call_made') is False, f'escalated = {e.get("escalated")}, sms_sent = {e.get("sms_sent")}, call_made = {e.get("call_made")}', 95); S.start()
    return f'console แจ้ง ALERT_PHONES empty, escalated = {e.get("escalated")}, sms_sent = {e.get("sms_sent")}, call_made = {e.get("call_made")}'


def ai(cid, limit=63, **cfg):
    @case(cid)
    def _(c):
        S.start(force=True, **cfg); m = len(S.out); t = time.time(); st, *_ = fire_at('QA-0002', 'ห้องน้ำ'); at = until('Calls (fake) made', m, 70); time.sleep(.5); dump(m); e = of('QA-0002')[0]; say(json.dumps(e, ensure_ascii=False))
        c.ok(st == 200 and at and at - t <= limit, f'โทรที่วินาทีที่ {at - t:.1f}' if at else 'ไม่มีการโทร'); c.ok(any(MSG('ห้องน้ำ') in l for l in S.out[m:]), 'ข้อความมาตรฐาน มีคำว่าห้องน้ำ'); c.ok(e.get('escalation_method') == 'fallback', f'escalation_method = {e.get("escalation_method")}')
        return f'โทรที่วินาทีที่ {at - t:.1f} ข้อความมาตรฐาน escalation_method = {e.get("escalation_method")}'


ai('MID-ESC-015'); ai('MID-ESC-017', AI_VOICE_ENABLED='true', TYPHOON_API_KEY=None)
ai('MID-ESC-018', AI_VOICE_ENABLED='true', TYPHOON_API_KEY='qa-dummy-key', AI_VOICE_TIMEOUT_MS='1')
ai('MID-ESC-019', AI_VOICE_ENABLED='true', TYPHOON_API_KEY='wrong-key')


@case('MID-ESC-021')
def _(c):
    """โหมด fake ไม่เจอปัญหานี้ จึงดักค่า TwiML ที่โค้ดโหมด real จะส่งให้ Twilio (ไม่ได้ต่อ Twilio จริง) แล้วตรวจว่าเป็น XML ถูกไหม"""
    import xml.dom.minidom as X
    loc = 'ห้องนอน & ห้องน้ำ <ชั้น 2>'
    S.start(force=True); m = len(S.out); fire_at('QA-0002', loc); wait(65); dump(m); e = of('QA-0002')[0]
    js = """const M=require('module'),o=M._load;M._load=(r,...a)=>r==='twilio'?()=>({calls:{create:async x=>{console.log('TWIML'+JSON.stringify(x.twiml));return{sid:'x'}}}}):o(r,...a);
const s=require('./src/services/alertService');(async()=>{for(const l of [process.argv[1],'ห้องน้ำ'])console.log(JSON.stringify(await s.makeCall({location:l,event_id:'qa'})))})()"""
    env = {**os.environ, 'TWILIO_MODE': 'real', 'TWILIO_ACCOUNT_SID': 'ACqa', 'TWILIO_AUTH_TOKEN': 'qa', 'TWILIO_PHONE': '+10000000000', 'ALERT_PHONES': '+66800000001'}
    out = subprocess.run(['node', '-e', js, loc], cwd=R.API, env=env, capture_output=True, text=True, encoding='utf-8').stdout; say(out)
    res = []
    for l in out.splitlines():
        if l.startswith('TWIML'):
            try: X.parseString(json.loads(l[5:]).strip().encode()); res.append('ถูก')
            except Exception as ex: res.append(f'ผิด: {ex}')
    say(f'ตรวจ XML: อักขระพิเศษ = {res[0]} · ชื่อปกติ = {res[1]}')
    c.ok(e.get('call_made') is True, 'โหมด fake call_made = true'); c.ok(res[1] == 'ถูก', 'ตัวเทียบ (ชื่อปกติ) TwiML ถูก'); c.ok(res[0] == 'ถูก', f'TwiML ที่มี & < > เป็น XML ที่ถูก ({res[0]})')
    return f'โหมด fake โทรผ่าน แต่ TwiML ที่โค้ดโหมด real จะส่งให้ Twilio: {res[0]}'


@case('MID-SEC-009')
def _(c):
    sec = {'TYPHOON_API_KEY': 'qa-typhoon-SECRET-1', 'TWILIO_AUTH_TOKEN': 'qa-twilio-SECRET-2', 'SUPABASE_KEY': 'qa-supabase-SECRET-3'}
    S.start(force=True, AI_VOICE_ENABLED='true', **sec); m = 0; fire_at('QA-0002'); wait(66); dump(m); txt = '\n'.join(S.out)
    c.ok('Calls (fake) made' in txt, 'โทรแล้วในโหมด fake'); hit = [k for k, v in sec.items() if v in txt]; c.ok(not hit, f'ไม่มีคีย์ใน log {hit}')
    return 'ใช้คีย์จำลอง 3 ตัว ไม่พบใน log ทั้งหมด (ยังไม่ได้ลองตอน Typhoon ตอบสำเร็จ เพราะไม่มีคีย์จริง)'


def flush():
    for cid, st, note in json.load(open(QUEUE, encoding='utf-8')): rec(cid, st, note); print('บันทึก', cid, st)


if __name__ == '__main__':
    if '--flush' in sys.argv: flush(); raise SystemExit
    q = []
    R.rec = lambda cid, st, note, bug=None: (q.append((cid, st, note)), json.dump(q, open(QUEUE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1))
    R.main()
