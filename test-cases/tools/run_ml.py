"""เทส ML service ด้วยโมเดลจริง + Express ต่อ ML จริง (ไม่ต่อ Supabase)
กรอบข้อมูลเป็นค่าจำลองที่หาให้โมเดลตอบล้ม/ไม่ล้ม ใช้ตรวจกลไกเท่านั้น ไม่ใช่ความแม่น
ผลเก็บใน evidence/_queue_ml.json ยังไม่เขียน Excel"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.error, urllib.request
sys.path.insert(0, os.path.dirname(__file__))
import run_api as R
sys.stdout.reconfigure(encoding='utf-8')
R.PORT = 3905; R.BASE = 'http://127.0.0.1:3905'
ML = os.path.join(R.ROOT, 'fall_detection_backend', 'ml_service'); PY = os.path.join(ML, '.venv', 'Scripts', 'python.exe')
MP = 8905; MU = f'http://127.0.0.1:{MP}'
res = {}; proc = None; log = []


def ml(model='rf_v2_event', **extra):
    global proc
    stop(); env = {**os.environ, 'FALL_MODEL': model, 'PYTHONIOENCODING': 'utf-8', **extra}
    if 'FALL_THRESHOLD' not in extra: env.pop('FALL_THRESHOLD', None)
    proc = subprocess.Popen([PY, '-m', 'uvicorn', 'app.main:app', '--port', str(MP)], cwd=ML, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(120):
        try: return hit('GET', '/health')[1]
        except Exception: time.sleep(.5)
    raise RuntimeError('ML ไม่ขึ้น')


def stop():
    global proc
    if proc: proc.terminate(); proc.wait(15); proc = None


def hit(m, p, body=None):
    d = None if body is None else json.dumps(body).encode()
    try: r = urllib.request.urlopen(urllib.request.Request(MU + p, d, {'Content-Type': 'application/json'}, method=m), timeout=20); s, t = r.status, r.read().decode()
    except urllib.error.HTTPError as e: s, t = e.code, e.read().decode()
    log.append(f'{m} {p} -> {s} {t[:400]}')
    try: return s, json.loads(t)
    except ValueError: return s, t


def put(cid, st, note, chk):
    f = os.path.join(R.EVID, cid + '.txt'); open(f, 'w', encoding='utf-8').write(R.mask('\n'.join(log)) + '\n'); log.clear()
    bad = [w for ok, w in chk if not ok]
    if bad: st = 'CHECK'
    res[cid] = dict(status=st, note=note, bad=bad); json.dump(res, open(os.path.join(R.EVID, '_queue_ml.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(cid, st, note, bad, flush=True)


FIND = r'''
import pickle,random,json,numpy as np
b=pickle.load(open('models/rf_v2_event.pkl','rb')); m=b['model']; n=len(b['keys']); c=list(m.classes_).index(1)
th=[[] for _ in range(n)]
for e in m.estimators_:
    t=e.tree_
    for f,x in zip(t.feature,t.threshold):
        if f>=0: th[f].append(x)
rng=np.random.default_rng(1); out={}
x=np.array([np.median(a) if a else 0. for a in th]); P=lambda v:m.predict_proba([v])[0][c]
def climb(sign,stop):
    v=x.copy(); p=P(v)
    for _ in range(4000):
        if stop(p): return v.tolist(),float(p)
        i=rng.integers(n)
        if not th[i]: continue
        w=v.copy(); w[i]=rng.choice(th[i])+rng.normal()*1e-6; q=P(w)
        if (q-p)*sign>=0: v,p=w,q
    raise SystemExit('not found %s'%p)
out['fall']=climb(1,lambda p:.60<=p<=.80); out['no']=climb(-1,lambda p:p<=.2)
print(json.dumps(out))
'''


def main():
    out = subprocess.run([PY, '-c', FIND], cwd=ML, capture_output=True, text=True)
    if out.returncode: raise SystemExit(out.stdout + out.stderr)
    j = json.loads(out.stdout.strip().splitlines()[-1]); F, N = j['fall'][0], j['no'][0]; print('กรอบจำลอง fall', j['fall'][1], 'no', j['no'][1])
    V = 'ใช้กรอบจำลอง ไม่ใช่ CSI จริง'
    h = ml(); ok = h == dict(status='ok', model_version='rf_v2_event-r2-fall', n_features=39, threshold=.5)
    put('MID-API-020', 'Passed', f'200 {h}', [(h['status'] == 'ok', 'status ok')])
    hit('GET', '/health'); put('MID-MLS-001', 'Passed', str(h), [(ok, 'ครบตามคาด')])
    sf, rf = hit('POST', '/predict', {'features': [F]}); sn, rn = hit('POST', '/predict', {'features': [N]})
    put('MID-API-021', 'Pending', f'{rf} ({V}) รอคำถามข้อ 50, 62', [(sf == 200 and 'prediction' in rf and 0 <= rf['confidence'] <= 1, 'รูปแบบ')])
    for _ in range(2): hit('POST', '/predict', {'features': [F]})
    trip = [hit('POST', '/predict', {'features': [F]})[1] for _ in range(3)]
    put('MID-API-025', 'Passed', f'3 ครั้งได้ {trip[0]["prediction"]} {trip[0]["confidence"]} เท่ากัน ({V})', [(trip[0] == trip[1] == trip[2], 'เท่ากัน')])
    a, ta = hit('POST', '/predict', {'features': []}); b, tb = hit('POST', '/predict', {'features': [F[:-1]]})
    put('MID-API-022', 'Pending', f'ไม่มีแถว (0 แถว) ได้ {a} {str(ta)[:60]} · ขาด 1 ค่า ได้ {b} {tb} · โมเดลนี้ใช้ 1 กรอบ จึงทดสอบ "สั้นกว่า 1 แถว" ด้วย 0 แถว', [])
    c1, c2 = rf['confidence'] * 100 - rf['risk_score'], rn['confidence'] * 100 - (100 - rn['risk_score'])
    log.append(f'fall {rf}\nno {rn}')
    put('MID-MLS-005', 'Pending', f'ล้ม: confidence {rf["confidence"]} risk {rf["risk_score"]} · ไม่ล้ม: {rn["confidence"]} risk {rn["risk_score"]} ตรงสมมติฐาน={abs(c1) <= 1 and abs(c2) <= 1} ({V}) รอคำถามข้อ 62, 102', [])
    m1, m2 = hit('POST', '/predict', {'features': [N, F]})[1], hit('POST', '/predict', {'features': [F, N]})[1]
    put('MID-MLS-006', 'Pending', f'ใช้กรอบสุดท้าย={m1 == rf and m2 == rn} ({V}) รอคำถามข้อ 102', [])
    h9 = ml(FALL_THRESHOLD='0.9'); r9 = hit('POST', '/predict', {'features': [F]})[1]
    put('MID-MLS-004', 'Passed', f'threshold 0.5 = {rf["prediction"]} · 0.9 = {r9["prediction"]} risk {rf["risk_score"]}→{r9["risk_score"]} ({V})', [(rf['prediction'] == 'fall' and h9['threshold'] == .9 and r9['prediction'] == 'no_fall' and r9['risk_score'] == rf['risk_score'], 'ตามคาด')])
    h1 = ml('rf_v1'); put('MID-MLS-002', 'Passed', str(h1), [(h1['n_features'] == 416 and h1['threshold'] == .55, '416 / 0.55')])
    # MLS-007 ในโฟลเดอร์สำเนา
    t = tempfile.mkdtemp(); os.makedirs(t + '/models'); shutil.copytree(ML + '/scripts', t + '/scripts'); shutil.copy(ML + '/models/MANIFEST', t + '/models')
    bash = r'C:\Program Files\Git\bin\bash.exe'; run = lambda: subprocess.run([bash, 'scripts/fetch_models.sh'], cwd=t, capture_output=True, text=True, encoding='utf-8', errors='replace')
    x = run(); log.append(f'exit {x.returncode}\n{x.stdout}{x.stderr}'); got = sorted(f for f in os.listdir(t + '/models') if f.endswith('.pkl'))
    s = open(t + '/models/MANIFEST', encoding='utf-8').read(); open(t + '/models/MANIFEST', 'w', encoding='utf-8', newline='\n').write(s.replace('eb5426', 'fb5426')); os.remove(t + '/models/rf_v2_event.pkl')
    y = run(); log.append(f'exit {y.returncode}\n{y.stdout}{y.stderr}'); left = os.listdir(t + '/models'); z = y.returncode != 0 and 'sha256' in y.stderr
    put('MID-MLS-007', 'Passed', f'โหลดใหม่ได้ {got} exit {x.returncode} · sha256 ผิด exit {y.returncode} ไม่เหลือไฟล์เสีย={not any("v2" in f for f in left)} · ทำในโฟลเดอร์สำเนา และลบ rf_v2_event.pkl ก่อนรอบ 2 (ถ้าไฟล์มีอยู่แล้วสคริปต์ข้ามไม่ตรวจ)', [(x.returncode == 0 and len(got) == 3, 'โหลดครบ'), (z, 'หยุดเมื่อ sha ผิด')]); shutil.rmtree(t)
    # Express + ML จริง
    ml(); R.S.start(force=True, USE_MOCK_ML='false', ML_SERVICE_URL=MU); R.log.clear()
    go = lambda dev, f: R.call('POST', '/api/v1/predict', {'device_id': dev, 'location': 'bathroom', 'features': [f]}, key='device')
    p1 = go('QA_F39', N); p2 = go('QA_F416', [.1] * 416); log.extend(R.log)
    put('MID-API-077', 'Pending', f'39 ค่าได้ {p1[0]} {p1[1]} · 416 ค่าได้ {p2[0]} {p2[1]} สมมติฐานคือ 400 (คำถามข้อ 94) ({V})', [(p1[0] == 200 and 'is_fall' in p1[1], '39 ค่า 200')])
    R.log.clear(); hv = hit('GET', '/health')[1]['model_version']; p = go('QA_MODELVER', F); ad = R.admin(); ev = R.call('GET', '/api/v1/admin/events/' + p[1]['event_id'], bearer=ad)[1]; R.wait(64); e2 = R.of('QA_MODELVER')[0]; log.extend(R.log)
    put('MID-API-087', 'Pending', f'health = {hv} · เหตุการณ์ = {ev.get("model_version")} · escalated = {e2.get("escalated")} ({V}) ยังไม่ได้ดูคอลัมน์จริงใน Supabase', [(ev.get('model_version') == hv, 'เวอร์ชันตรง')])
    ms = []; bad = 0
    for i in range(300):
        t0 = time.time(); q = R.call('POST', '/api/v1/predict', {'device_id': 'QA_LOAD', 'features': [N]}, key='device', quiet=True); ms.append(q[3]); bad += q[0] != 200; time.sleep(max(0, 1 - (time.time() - t0)))
    ms.sort(); log.append(f'n=300 bad={bad} avg={sum(ms)/300:.1f} p95={ms[284]} max={ms[-1]}')
    put('MID-API-013', 'Pending', f'300 ครั้ง ไม่ได้ 200 = {bad} เฉลี่ย {sum(ms)/300:.0f} ms p95 {ms[284]} ms สูงสุด {ms[-1]} ms (เครื่องเดียวกัน · {V}) รอคำถามข้อ 42', [(bad == 0, '200 ทุกครั้ง')])


if __name__ == '__main__':
    try: main()
    finally: R.S.stop(); stop()
