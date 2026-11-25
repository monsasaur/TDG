"""เทสชีต 8 (Express API) ในเครื่อง ทีละเคส แล้วบันทึกผลทันที

- เปิด Express จาก fall_detection_backend/express_api บนพอร์ต 3900 ไม่ต่อ Supabase (เก็บเหตุการณ์ในหน่วยความจำ)
- ML ใช้โหมดจำลองของ Express (USE_MOCK_ML) · Twilio และ push เป็น fake
- คีย์และรหัส admin สุ่มใหม่ทุกครั้ง ไม่เขียนลงไฟล์
- หลักฐานแต่ละเคสอยู่ใน test-cases/evidence/<รหัสเคส>.txt

python tools/run_api.py [รหัสเคส ...]     ไม่ใส่รหัส = ทุกเคส
"""
import datetime as dt, json, os, secrets, subprocess, sys, threading, time, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
from rec import rec
sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
API = os.path.join(ROOT, 'fall_detection_backend', 'express_api')
EVID = os.path.join(ROOT, 'test-cases', 'evidence')
PORT = 3900
BASE = f'http://127.0.0.1:{PORT}'
KEY = {k: f'qa-{k}-' + secrets.token_hex(8) for k in ('device', 'app', 'demo')}
ADMIN_PW = secrets.token_urlsafe(18)
ADMIN_HASH = subprocess.run(['node', '-e', "console.log(require('./src/services/adminAuthService').hashPassword(process.argv[1]))", ADMIN_PW],
                            cwd=API, capture_output=True, text=True).stdout.strip()
assert ADMIN_HASH.startswith('scrypt')
SECRETS = [*KEY.values(), ADMIN_PW, ADMIN_HASH]
DATE = '25 พ.ย.'
LOCAL = 'รันในเครื่อง ไม่ต่อ Supabase · ML จำลอง · Twilio fake'

F39 = [[0.1] * 39] * 2
log = []


def mask(s):
    for x in SECRETS:
        s = s.replace(x, '***')
    return s


def say(s):
    log.append(mask(str(s)))


class Server:
    def __init__(self):
        self.p = None; self.cfg = None; self.out = []

    def start(self, force=False, **cfg):
        if self.p and self.cfg == cfg and not force:
            return
        self.stop()
        env = {k: v for k, v in os.environ.items() if not k.startswith(('SUPABASE', 'TWILIO', 'ADMIN_', 'API_KEY'))}
        env.update(PORT=str(PORT), DEVICE_API_KEY=KEY['device'], APP_API_KEY=KEY['app'], DEMO_API_KEY=KEY['demo'],
                   USE_MOCK_ML='true', MOCK_IS_FALL='true', TWILIO_MODE='fake', PUSH_MODE='fake',
                   ALERT_PHONES='+66800000001,+66800000002', ACK_TIMEOUT_SECONDS='60', COOLDOWN_SECONDS='5',
                   ADMIN_USERNAME='qa-admin', ADMIN_PASSWORD_HASH=ADMIN_HASH, DEVICE_OFFLINE_AFTER_MINUTES='15')
        for k, v in cfg.items():
            if v is None: env.pop(k, None)
            else: env[k] = v
        self.out = []
        self.p = subprocess.Popen(['node', 'src/index.js'], cwd=API, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                  text=True, encoding='utf-8', errors='replace')
        threading.Thread(target=lambda o=self.out, s=self.p.stdout: [o.append(l.rstrip()) for l in s], daemon=True).start()
        for _ in range(60):
            try:
                urllib.request.urlopen(BASE + '/health', timeout=1); break
            except Exception:
                time.sleep(.25)
        else:
            raise SystemExit('Express ไม่ขึ้น: ' + '\n'.join(self.out[-10:]))
        self.cfg = cfg

    def stop(self):
        if self.p:
            self.p.terminate(); self.p.wait(10); self.p = None


S = Server()


def call(method, path, body=None, key=None, bearer=None, raw=None, ctype='application/json', quiet=False, timeout=40):
    h = {}
    data = None
    if raw is not None: data = raw.encode(); h['Content-Type'] = ctype
    elif body is not None: data = json.dumps(body).encode(); h['Content-Type'] = ctype
    if key: h['x-api-key'] = KEY.get(key, key)
    if bearer: h['Authorization'] = 'Bearer ' + bearer
    t = time.time()
    try:
        r = urllib.request.urlopen(urllib.request.Request(BASE + path, data, h, method=method), timeout=timeout)
        st, tx = r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        st, tx = e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        st, tx = 0, f'{type(e).__name__}: {e}'
    ms = int((time.time() - t) * 1000)
    try: js = json.loads(tx)
    except Exception: js = None
    if not quiet:
        b = raw if raw is not None else (json.dumps(body, ensure_ascii=False) if body is not None else '-')
        say(f'{dt.datetime.now():%H:%M:%S} {method} {path}  key={key or "-"} bearer={"มี" if bearer else "-"}\n  body: {b[:160]}\n  -> {st} ({ms} ms) {tx[:700]}')
    return st, js, tx, ms


def events():
    return call('GET', '/api/v1/events?limit=1000', key='demo', quiet=True)[1]['events']


def of(dev):
    return [e for e in events() if e.get('device_id') == dev]


def predict(dev, key='device', **kw):
    return call('POST', '/api/v1/predict', {'device_id': dev, 'timestamp': int(time.time() * 1000), 'location': 'bathroom', 'features': F39, **kw}, key=key)


def fire(dev):
    return call('POST', '/api/v1/demo/fire', {'device_id': dev}, key='demo')


def console(*words, since=0):
    return [l for l in S.out[since:] if any(w in l for w in words)]


def wait(sec, why=''):
    say(f'  (รอ {sec} วินาที {why})'); time.sleep(sec)


def admin():
    st, j, *_ = call('POST', '/api/v1/admin/login', {'username': 'qa-admin', 'password': ADMIN_PW})
    if j and j.get('token'): SECRETS.append(j['token'])
    return j['token']


class Check:
    def __init__(self): self.bad = []; self.asm = []
    def ok(self, cond, what):
        say(('  ✔ ' if cond else '  ✘ ') + what)
        if not cond: self.bad.append(what)
    def assume(self, cond, what, q):
        """ผลที่เป็น [สมมติฐาน] เก็บค่าจริงไว้ ยังไม่ตัดสินจนกว่าทีมตอบ"""
        say(('  ~ ตรงสมมติฐาน: ' if cond else '  ~ ไม่ตรงสมมติฐาน: ') + what + f' (คำถามข้อ {q})')
        self.asm.append((cond, what, q))


CASES = {}


def case(cid):
    def deco(f):
        CASES[cid] = f
        return f
    return deco


# ---------------- health / คีย์ ----------------
@case('MID-API-001')
def _(c):
    S.start()
    st, j, *_ = call('GET', '/health')
    c.ok(st == 200 and j.get('status') == 'ok', 'status 200 และ status = "ok"')
    try: dt.datetime.fromisoformat(j['timestamp'].replace('Z', '+00:00')); good = True
    except Exception: good = False
    c.ok(good, 'timestamp เป็นแบบ ISO')
    return f'ได้ 200 status = ok, timestamp = {j.get("timestamp")}'


def no_key(cid, key):
    @case(cid)
    def _(c):
        S.start(); n = len(events())
        st, *_ = predict('QA_NOKEY', key=key)
        c.ok(st == 401, 'status 401'); c.ok(len(events()) == n, 'ไม่มีแถวใหม่')
        return f'ได้ {st} จำนวนเหตุการณ์เท่าเดิม ({n})'


no_key('MID-API-002', None); no_key('MID-API-003', 'wrong-key-123')


@case('MID-API-004')
def _(c):
    S.start(); st, *_ = call('GET', '/health')
    c.ok(st == 200, 'status 200 โดยไม่มีคีย์'); return f'ได้ {st} โดยไม่ส่งคีย์'


@case('MID-API-005')
def _(c):
    S.start(); st, j, *_ = predict('QA_PREDICT')
    c.ok(st == 200, 'status 200'); c.ok(j.get('is_fall') is True and 0 <= j.get('confidence', -1) <= 1, 'is_fall = true และ confidence 0–1')
    c.ok(j.get('action') == 'awaiting_acknowledge' and j.get('event_id') and j.get('ack_timeout_seconds') == 60, 'action / event_id / ack_timeout_seconds = 60')
    c.ok('T' in str(j.get('timestamp')), 'timestamp แบบ ISO')
    wait(64, 'ให้หมดเวลา'); e = of('QA_PREDICT')[0]; say(json.dumps(e, ensure_ascii=False))
    c.ok(e.get('escalated') is True, 'escalated = true'); c.assume(e.get('call_made') is True, 'call_made = true ในโหมด fake', 101)
    return f'ได้ 200 action = {j["action"]}, confidence = {j["confidence"]} หลังหมดเวลา escalated = {e.get("escalated")}, call_made = {e.get("call_made")}'


@case('MID-API-006')
def _(c):
    S.start(MOCK_IS_FALL='false'); st, j, *_ = predict('QA_PREDICT')
    c.ok(st == 200 and j.get('is_fall') is False and j.get('action') == 'monitoring', '200 is_fall = false action = monitoring')
    c.ok(not of('QA_PREDICT'), 'ไม่มีแถวใหม่'); m = len(S.out); wait(70)
    c.ok(not of('QA_PREDICT') and not console('SMS', 'Calls', since=m), 'ครบ 70 วินาที ยังไม่มีแถวและไม่มีการโทร')
    return f'ได้ 200 action = {j.get("action")} ไม่มีแถวใหม่ รอ 70 วินาทีไม่มีการโทร'


def bad_body(cid, body, word, **kw):
    @case(cid)
    def _(c):
        S.start(); n = len(events())
        st, j, tx, _ms = call('POST', '/api/v1/predict', body, key='device', **kw)
        c.ok(st == 400, 'status 400')
        if word: c.ok(word in tx, f'ข้อความบอกว่าต้องส่ง {word}')
        c.ok(len(events()) == n, 'ไม่มีแถวใหม่')
        return f'ได้ {st} {(j or {}).get("error", tx[:60])}'


bad_body('MID-API-007', {'features': F39, 'location': 'bathroom'}, 'device_id')
bad_body('MID-API-008', {'device_id': 'ESP32_001'}, 'features')
bad_body('MID-API-009', {'device_id': 'ESP32_001', 'features': 'abc'}, None)


@case('MID-API-010')
def _(c):
    S.start()
    a, _j, ta, _m = call('POST', '/api/v1/predict', raw='hello', ctype='text/plain', key='device')
    b, _j, tb, _m = call('POST', '/api/v1/predict', raw='hello', ctype='application/json', key='device')
    h, *_ = call('GET', '/health')
    c.ok(a == 400, 'ส่งแบบ Text ได้ 400'); c.ok(b == 400, 'ส่งแบบ JSON ได้ 400'); c.ok(h == 200, '/health ยังตอบ 200')
    leak = 'node_modules' in tb or 'at JSON.parse' in tb
    say(f'  stack trace ใน response: {leak}')
    return f'แบบ Text ได้ {a}, แบบ JSON ได้ {b}, /health ยัง {h}' + (' · สังเกต: response แบบ JSON มี stack trace และ path ในเครื่องติดมา' if leak else '')


@case('MID-API-011')
def _(c):
    S.start(); t0 = time.time() * 1000
    st, j, *_ = call('POST', '/api/v1/predict', {'device_id': 'QA_DEFAULT', 'features': F39}, key='device'); t1 = time.time() * 1000
    e = of('QA_DEFAULT')[0]; say(json.dumps(e, ensure_ascii=False))
    c.ok(st == 200, 'status 200'); c.ok(e['location'] == 'unknown', 'location = unknown'); c.ok(t0 - 50 <= e['timestamp'] <= t1 + 50, 'timestamp เป็นเวลาที่ server ได้รับ')
    wait(64); e = of('QA_DEFAULT')[0]; c.ok(e.get('escalated') is True, 'escalated = true'); c.assume(e.get('call_made') is True, 'call_made = true ในโหมด fake', 101)
    return f'ได้ 200 location = {e["location"]} timestamp = เวลา server หลังหมดเวลา call_made = {e.get("call_made")}'


@case('MID-API-012')
def _(c):
    S.start(USE_MOCK_ML='false', ML_SERVICE_URL='http://127.0.0.1:8999')
    st, j, tx, ms = predict('QA_MLDOWN'); h, *_ = call('GET', '/health')
    c.ok(500 <= st < 600 and 'error' in (j or {}), '5xx พร้อม error'); c.ok(ms < 30000, 'ไม่เกิน 30 วินาที'); c.ok(h == 200, '/health ยังตอบ')
    return f'ได้ {st} {tx} ใน {ms} ms และ /health ยัง {h}'


@case('MID-API-031')
def _(c):
    S.start(); m = len(S.out); st, *_ = call('POST', '/api/v1/alert/test'); wait(5)
    c.ok(st == 401, 'status 401'); c.ok(not console('SMS', 'CALL', since=m), 'console ไม่มี SMS หรือการโทร')
    return f'ได้ {st} และไม่มี SMS/โทรใน console'


@case('MID-API-033')
def _(c):
    S.start(); m = len(S.out); n = len(events()); st, *_ = predict('QA_APPKEY', key='app'); wait(65)
    c.ok(st == 401, 'status 401'); c.ok(len(events()) == n, 'ไม่มีแถวใหม่')
    c.ok(not console('SMS', 'CALL', 'PUSH', 'push', since=m), 'ไม่มี push และไม่มีการโทร (รอ 65 วินาที)')
    return f'ได้ {st} ไม่มีแถวใหม่ ไม่มี push/โทร'


@case('MID-API-034')
def _(c):
    S.start(); st, j, tx, _m = call('GET', '/api/v1/events', key='app')
    c.ok(st == 401, 'status 401'); c.ok('events' not in (j or {}), 'ไม่มีรายการ event'); return f'ได้ {st} {tx}'


@case('MID-API-035')
def _(c):
    S.start(); m = len(S.out); st, *_ = call('POST', '/api/v1/alert/test', key='app'); wait(60)
    c.ok(st == 401, 'status 401'); c.ok(not console('SMS', 'CALL', since=m), 'รอ 1 นาที ไม่มี SMS หรือการโทร'); return f'ได้ {st} รอ 1 นาทีไม่มี SMS/โทร'


@case('MID-API-046')
def _(c):
    S.start(force=True, COOLDOWN_SECONDS='30'); m = len(S.out)
    st, j, *_ = predict('QA_COOLDOWN_A'); c.ok(j.get('action') == 'awaiting_acknowledge', 'ครั้งแรก action = awaiting_acknowledge'); wait(61)
    k = len(console('Calls (fake) made', since=m)); c.ok(k == 1, 'มีการโทร 1 รอบ (ดูจาก console)')
    st, j2, *_ = predict('QA_COOLDOWN_A'); wait(64); rows = of('QA_COOLDOWN_A'); k2 = len(console('Calls (fake) made', since=m))
    c.assume(j2.get('action') == 'cooldown', f'ครั้งที่ 2 action = {j2.get("action")}', 64)
    c.assume(len(rows) == 1 and k2 == 1, f'มี {len(rows)} แถว โทร {k2} รอบ', 64)
    c.ok(all(e.get('escalated') for e in rows), 'ทุกแถว escalated = true')
    return f'ครั้งที่ 2 (วินาทีที่ 61) ได้ action = {j2.get("action")} มี {len(rows)} แถว โทร {k2} รอบ (cooldown 30 วินาที)'


@case('MID-API-048')
def _(c):
    S.start(); st, j, tx, _m = call('POST', '/api/v1/push/register', {'platform': 'android'}, key='app')
    _s, t, *_ = call('GET', '/api/v1/push/tokens', key='demo')
    c.ok(st == 400, 'status 400'); c.ok('ExponentPushToken' not in json.dumps(t), 'ไม่มี token ใหม่'); return f'ได้ {st} {tx} ไม่มี token เพิ่ม'


@case('MID-API-049')
def _(c):
    S.start(); st, j, tx, _m = call('GET', '/api/v1/push/tokens', key='app')
    c.ok(st == 401 and 'tokens' not in (j or {}), '401 และไม่มี token ใน response'); return f'ได้ {st} {tx}'


@case('MID-API-050')
def _(c):
    S.start(COOLDOWN_SECONDS='300'); m = len(S.out)
    st, j, *_ = predict('QA_COOLDOWN_B'); c.ok(j.get('action') == 'awaiting_acknowledge', 'ครั้งแรก action = awaiting_acknowledge'); wait(10)
    st, j2, *_ = predict('QA_COOLDOWN_B'); rows = of('QA_COOLDOWN_B')
    c.assume(len(rows) == 1, f'ครั้งที่ 2 action = {j2.get("action")} มี {len(rows)} แถว', 64)
    wait(112); k = len(console('Calls (fake) made', since=m)); rows = of('QA_COOLDOWN_B')
    c.ok(all(e.get('escalated') for e in rows), 'แถวนี้ escalated = true')
    c.assume(k == 1, f'โทร {k} รอบ', 64)
    return f'ครั้งที่ 2 (ห่าง 10 วินาที) ได้ action = {j2.get("action")} มี {len(rows)} แถว ครบ 2 นาทีโทร {k} รอบ'


# ---------------- admin ----------------
@case('MID-API-054')
def _(c):
    S.start(force=True); st, j, *_ = call('POST', '/api/v1/admin/login', {'username': 'qa-admin', 'password': ADMIN_PW})
    if j and j.get('token'): SECRETS.append(j['token']); log[-1] = mask(log[-1])
    c.ok(st == 200, 'status 200'); c.ok(all((j or {}).get(k) for k in ('token', 'expires_at', 'username')), 'มี token, expires_at, username')
    return f'ได้ {st} มี token, expires_at = {j.get("expires_at")}, username = {j.get("username")}'


@case('MID-API-055')
def _(c):
    S.start(force=True)
    a, ja, *_ = call('POST', '/api/v1/admin/login', {'username': 'nobody', 'password': 'x'})
    b, jb, *_ = call('POST', '/api/v1/admin/login', {'username': 'qa-admin', 'password': 'wrong123'})
    c.ok(a == 401 and 'error' in ja, 'username ผิด 401 มี error'); c.ok(b == 401 and ja == jb, 'password ผิด 401 ข้อความเดียวกัน')
    c.ok(not any(w in json.dumps(ja) for w in ('username', 'password')), 'ไม่บอกว่าผิดช่องไหน')
    return f'ทั้งสองแบบได้ 401 ข้อความเดียวกัน "{ja["error"]}"'


@case('MID-API-056')
def _(c):
    S.start(force=True); L = lambda p: call('POST', '/api/v1/admin/login', {'username': 'qa-admin', 'password': p})
    five = [L('wrong123')[0] for _ in range(5)]; six, j6, *_ = L('wrong123'); seven, *_ = L(ADMIN_PW)
    c.ok(five == [401] * 5, f'5 ครั้งแรก {five}'); c.ok(six == 429 and 'error' in (j6 or {}), f'ครั้งที่ 6 ได้ {six}')
    c.assume(seven == 429, f'ครั้งที่ 7 รหัสถูก ได้ {seven}', 91)
    S.start(force=True); e, *_ = L(ADMIN_PW); c.assume(e == 200, f'หลังรีสตาร์ต รหัสถูก ได้ {e}', 91)
    return f'ครั้งที่ 1–5 = 401, ครั้งที่ 6 = {six}, ครั้งที่ 7 รหัสถูก = {seven}, หลังรีสตาร์ต = {e}'


@case('MID-API-057')
def _(c):
    S.start(ADMIN_USERNAME=None, ADMIN_PASSWORD_HASH=None)
    a, *_ = call('POST', '/api/v1/admin/login', {'username': 'a', 'password': 'b'}); b, *_ = call('GET', '/api/v1/admin/summary')
    c.ok(a == 503, 'login 503'); c.ok(b == 503, 'summary 503'); S.start()
    return f'login ได้ {a}, summary ได้ {b} แล้วตั้งค่ากลับ'


@case('MID-API-058')
def _(c):
    S.start(); t = admin(); a, *_ = call('POST', '/api/v1/admin/logout', bearer=t); b, j, *_ = call('GET', '/api/v1/admin/summary', bearer=t)
    c.ok(a == 200, 'logout 200'); c.ok(b == 401 and 'error' in j, 'token เดิม 401 มี error'); return f'logout {a} แล้ว token เดิมได้ {b}'


@case('MID-API-059')
def _(c):
    S.start(); t = admin(); x, *_ = call('GET', '/api/v1/admin/summary', bearer=t); S.start(force=True)
    b, *_ = call('GET', '/api/v1/admin/summary', bearer=t); c.ok(x == 200, 'ก่อนรีสตาร์ตใช้ได้ (200)'); c.ok(b == 401, 'หลังรีสตาร์ต 401')
    return f'ก่อนรีสตาร์ต {x} หลังรีสตาร์ต {b}'


@case('MID-API-060')
def _(c):
    S.start(); b, *_ = call('GET', '/api/v1/admin/summary', key='demo'); c.ok(b == 401, 'status 401'); return f'ได้ {b}'


@case('MID-API-062')
def _(c):
    S.start(force=True); t = admin(); st, j, *_ = call('GET', '/api/v1/admin/summary', bearer=t)
    c.ok(j['falls']['week'] == 0, 'falls.week = 0'); c.ok(j['escalation']['rate'] is None and j['escalation']['has_data'] is False, 'rate = null และ has_data = false')
    return f'falls.week = {j["falls"]["week"]}, rate = {j["escalation"]["rate"]}, has_data = {j["escalation"]["has_data"]}'


@case('MID-API-071')
def _(c):
    S.start(force=True); t = admin(); P = lambda v, n: call('POST', '/api/v1/admin/models', {'version': v, 'notes': n}, bearer=t)
    a, *_ = P('9.9.1', 'ทดสอบ QA'); b, *_ = P('9.9.1', 'ซ้ำ'); d, jd, *_ = P('9.9.2', 'ก' * 241); e, je, *_ = P('abc', 'ทดสอบ')
    c.ok(a == 201, f'เพิ่มใหม่ {a}'); c.ok(b == 409, f'ซ้ำ {b}'); c.ok(d == 400 and jd.get('error') == 'notesError', f'notes 241 ตัว {d} {jd}')
    c.assume(e == 400, f'version abc ได้ {e} {je}', 103); return f'201 / 409 / 400 notesError / version ผิดรูปแบบได้ {e} {je.get("error")}'.replace('201', str(a)).replace('409', str(b))


@case('MID-API-072')
def _(c):
    S.start(force=True); t = admin(); A = lambda v, w: call('POST', f'/api/v1/admin/models/{v}/{w}', {}, bearer=t)
    for v in ('9.9.0', '9.9.1'): call('POST', '/api/v1/admin/models', {'version': v, 'notes': 'ทดสอบ'}, bearer=t)
    A('9.9.0', 'test'); A('9.9.0', 'activate')
    a, *_ = A('9.9.1', 'activate'); b0, *_ = A('9.9.1', 'test'); b, jb, *_ = A('9.9.1', 'activate'); _s, lst, *_ = call('GET', '/api/v1/admin/models', bearer=t)
    act = [m['version'] for m in lst['models'] if m['status'] == 'active']; d, *_ = A('9.9.9', 'activate')
    prev = jb.get('previous_active'); prev = prev.get('version') if isinstance(prev, dict) else prev
    A(prev, 'test'); e, *_ = A(prev, 'activate'); _s, l2, *_ = call('GET', '/api/v1/admin/models', bearer=t); act2 = [m['version'] for m in l2['models'] if m['status'] == 'active']
    c.ok(a == 409, f'ยังไม่ทดสอบ {a}'); c.ok(b == 200 and prev, f'ทดสอบแล้ว {b} previous_active = {prev}'); c.ok(act == ['9.9.1'], f'active = {act}')
    c.ok(d == 404, f'ไม่มีเวอร์ชัน {d}'); c.ok(act2 == [prev], f'คืนค่าเดิม active = {act2}')
    return f'ก่อนทดสอบ {a}, หลังทดสอบ {b}, previous_active = {prev}, active ตัวเดียว {act}, เวอร์ชันไม่มี {d}, คืนค่าแล้ว active = {act2}'


@case('MID-API-073')
def _(c):
    S.start(); a, _j, ta, _m = call('GET', '/docs/', quiet=True); s, spec, *_ = call('GET', '/openapi.json', quiet=True)
    _x, _y, init, _z = call('GET', '/docs/swagger-ui-init.js', quiet=True)
    import re
    src = open(os.path.join(API, 'src', 'routes', 'admin.js'), encoding='utf-8').read() and ''
    n = sum(len(v) for v in spec['paths'].values()); sec = spec.get('components', {}).get('securitySchemes', {})
    say(f'/docs/ -> {a}, endpoint ใน spec {n} เส้น, securitySchemes {list(sec)}')
    c.ok(a == 200 and 'swagger-ui' in ta, 'หน้า Swagger เปิดได้'); c.ok(n >= 19 and all(p in init for p in spec['paths']), f'มี endpoint ครบ {n} เส้น'); c.ok(bool(sec), 'มีการตั้งค่า Authorize')
    S.start(ENABLE_API_DOCS='false'); b, *_ = call('GET', '/docs/'); S.start()
    c.assume(b == 404, f'ปิดแล้วเปิด /docs ได้ {b}', 93); return f'เปิดได้ {a} มี {n} endpoint และตั้งค่า Authorize · ปิดแล้วได้ {b}'


@case('MID-API-074')
def _(c):
    S.start(force=True)
    call('POST', '/api/v1/push/register', {'token': 'ExponentPushToken[qa-test-074]', 'platform': 'android'}, key='app'); m = len(S.out)
    a, ja, ta, _m = call('POST', '/api/v1/push/test', {}, key='demo'); b, jb, tb, _m = call('POST', '/api/v1/push/test', {}, key='app'); time.sleep(1)
    box = console('PUSH', 'Push', since=m); say('\n'.join(S.out[m:]))
    c.ok(a == 200, f'DEMO {a}'); c.ok(bool(box), 'console แสดง push ทดสอบ'); c.ok(b == 401 and 'error' in (jb or {}), f'APP {b}')
    return f'DEMO_API_KEY ได้ {a} และ console แสดง push · APP_API_KEY ได้ {b}'


@case('MID-API-076')
def _(c):
    S.start(force=True, COOLDOWN_SECONDS='300'); st, j, *_ = predict('QA_COOL'); ev = j.get('event_id')
    a, *_ = call('POST', f'/api/v1/alert/ack/{ev}', {'acknowledged_by': 'QA'}, key='app')
    c.ok(j.get('action') == 'awaiting_acknowledge' and ev, 'ครั้งแรก awaiting_acknowledge มี event_id'); c.ok(a == 200, f'กดรับทราบ {a}'); wait(10)
    s2, j2, *_ = predict('QA_COOL'); rows = of('QA_COOL')
    c.assume(s2 == 200 and j2.get('action') == 'cooldown' and 'event_id' not in j2, f'ครั้งที่ 2 ได้ {s2} action = {j2.get("action")}', '64, 100'); c.assume(len(rows) == 1, f'มี {len(rows)} แถว', 64)
    return f'กดรับทราบแล้วส่งล้มซ้ำ ได้ action = {j2.get("action")} มี {len(rows)} แถว (ล้มจริงซ้ำภายใน 5 นาทีหลังกดรับทราบจะไม่แจ้ง)'


@case('MID-API-081')
def _(c):
    S.start(force=True, ADMIN_SESSION_HOURS='0.02'); t = admin(); G = lambda: call('GET', '/api/v1/admin/summary', bearer=t)
    wait(40); a, *_ = G(); wait(40); b, *_ = G(); wait(80); d, jd, *_ = G()
    S.start(force=True, ADMIN_SESSION_HOURS='8'); t0 = time.time(); st, j, *_ = call('POST', '/api/v1/admin/login', {'username': 'qa-admin', 'password': ADMIN_PW}); SECRETS.append(j['token']); log[-1] = mask(log[-1])
    h = (dt.datetime.fromisoformat(j['expires_at'].replace('Z', '+00:00')).timestamp() - t0) / 3600
    c.ok(a == 200, f'วินาทีที่ 40 ได้ {a}'); c.ok(b == 200, f'วินาทีที่ 80 (ยังใช้งานอยู่) ได้ {b}'); c.ok(d == 401 and 'error' in jd, f'ไม่ใช้ 80 วินาที ได้ {d}')
    c.ok(abs(h - 8) < .01, f'expires_at ห่าง {h:.2f} ชั่วโมง'); return f'ใช้งานต่อเนื่อง {a}, {b} · ไม่ใช้ 80 วินาที (ตั้งหมดอายุ 72 วินาที) ได้ {d} · ค่าปกติหมดอายุ {h:.2f} ชั่วโมง'


@case('MID-API-083')
def _(c):
    S.start(force=True, COOLDOWN_SECONDS='300'); t = admin(); G = lambda: call('GET', '/api/v1/admin/summary', bearer=t)[1]['escalation']
    a = G(); s1, j1, *_ = fire('QA_RATE_1'); wait(65); e = of('QA_RATE_1')[0]; _s, j3, *_ = fire('QA_RATE_1'); fire('QA_RATE_2'); b = G()
    c.ok(e.get('escalated') is True, 'QA_RATE_1 escalated = true'); c.ok(j3.get('action') == 'cooldown' and 'event_id' not in j3, 'ยิงซ้ำได้ cooldown ไม่มี event_id')
    c.ok(b['escalated_week'] - a['escalated_week'] == 1 and b['falls_week'] - a['falls_week'] == 2, f'escalated {a["escalated_week"]}→{b["escalated_week"]}, falls {a["falls_week"]}→{b["falls_week"]}')
    c.ok(b['rate'] and abs(b['rate'] - b['escalated_week'] / b['falls_week']) <= .0001, f'rate = {b["rate"]}'); wait(64, 'ปิดเหตุการณ์')
    return f'escalated_week {a["escalated_week"]}→{b["escalated_week"]}, falls_week {a["falls_week"]}→{b["falls_week"]}, rate = {b["rate"]} ครั้งที่ติด cooldown ไม่ถูกนับ'


@case('MID-API-069')
def _(c):
    S.start(force=True, MOCK_IS_FALL='false'); t = admin(); st, *_ = predict('QA-0001')
    D = lambda: next((d for d in call('GET', '/api/v1/admin/devices', bearer=t)[1]['devices'] if d['device_id'] == 'QA-0001'), {})
    a = D(); age = time.time() - dt.datetime.fromisoformat(a['last_seen_at'].replace('Z', '+00:00')).timestamp()
    wait(16 * 60); st, j, *_ = call('GET', '/api/v1/admin/devices', bearer=t); b = next(d for d in j['devices'] if d['device_id'] == 'QA-0001')
    c.ok(a.get('status') == 'online' and age < 10, 'ทันที online และ last_seen_at เพิ่งอัปเดต (ข้อมูลไม่ล้ม)'); c.ok(b['status'] == 'offline' and j['offline_after_minutes'] == 15, f'ครบ 16 นาที {b["status"]} offline_after_minutes = {j["offline_after_minutes"]}')
    return f'ทันที = {a.get("status")} · ครบ 16 นาที = {b["status"]} (offline_after_minutes = {j["offline_after_minutes"]})'


def main():
    os.makedirs(EVID, exist_ok=True)
    want = sys.argv[1:] or sorted(CASES)
    try:
        for cid in want:
            log.clear(); c = Check(); say(f'{cid}  {dt.datetime.now():%d/%m/%Y %H:%M}  ({LOCAL})')
            try:
                note = CASES[cid](c); err = None
            except Exception as e:
                note, err = '', f'{type(e).__name__}: {e}'; say('สคริปต์หยุด: ' + err)
            with open(os.path.join(EVID, cid + '.txt'), 'w', encoding='utf-8') as f: f.write(mask('\n'.join(log)) + '\n')
            if err: print(cid, 'SCRIPT-ERROR', err, flush=True); continue
            if c.bad: print(cid, 'CHECK', c.bad, '|', note, flush=True); continue   # ไม่บันทึกเอง ต้องทำซ้ำยืนยันก่อน
            ev = f'หลักฐาน: evidence/{cid}.txt ({DATE} · {LOCAL})'
            if c.asm:
                q = ', '.join(dict.fromkeys(str(x[2]) for x in c.asm)); miss = [x[1] for x in c.asm if not x[0]]
                tail = f'ข้อที่ยืนยันแล้วผ่านครบ รอทีมตอบคำถามข้อ {q}' + (f' · ยังไม่ตรงสมมติฐาน: {"; ".join(miss)}' if miss else ' (ผลตรงกับสมมติฐาน)')
                rec(cid, 'Pending', f'{note}\n{tail}\n{ev}'); print(cid, 'Pending', note, flush=True)
            else:
                rec(cid, 'Passed', f'{note}\n{ev}'); print(cid, 'Passed', note, flush=True)
    finally:
        S.stop()


if __name__ == '__main__':
    main()
