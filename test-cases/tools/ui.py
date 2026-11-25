"""ตัวช่วยกดหน้าจอแอปบน emulator (adb + uiautomator)"""
import os, re, subprocess, sys, time
import xml.etree.ElementTree as ET
sys.stdout.reconfigure(encoding='utf-8')
ADB = os.path.expandvars(r'%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe')
EVID = os.path.join(os.path.dirname(__file__), '..', 'evidence')


def adb(*a, binary=False, timeout=40):
    r = subprocess.run([ADB, *a], capture_output=True, timeout=timeout)
    return r.stdout if binary else r.stdout.decode('utf-8', 'replace')


def sh(cmd, **k): return adb('shell', cmd, **k)


class Node:
    def __init__(s, e):
        s.text = e.get('text', ''); s.desc = e.get('content-desc', ''); s.cls = e.get('class', '').split('.')[-1]
        s.enabled = e.get('enabled') == 'true'; s.focused = e.get('focused') == 'true'; s.pw = e.get('password') == 'true'; s.click = e.get('clickable') == 'true'
        s.b = list(map(int, re.findall(r'\d+', e.get('bounds', '[0,0][0,0]')))); s.hint = e.get('hint', '')
    @property
    def xy(s): return (s.b[0] + s.b[2]) // 2, (s.b[1] + s.b[3]) // 2


def dump():
    for _ in range(4):
        out = sh('uiautomator dump /sdcard/u.xml >/dev/null 2>&1; cat /sdcard/u.xml; rm /sdcard/u.xml')
        i = out.find('<?xml')
        if i >= 0:
            return [Node(e) for e in ET.fromstring(out[i:].strip().encode()).iter('node')]
        time.sleep(1)
    raise RuntimeError('dump ไม่ได้: ' + out[:150])


def texts(nodes=None): return [n.text or n.desc for n in (nodes or dump()) if n.text or n.desc]
def has(t, nodes=None): return any(t in x for x in texts(nodes))
def find(t, nodes=None, exact=True):
    for n in nodes or dump():
        if (n.text == t or n.desc == t) if exact else (t in n.text or t in n.desc): return n
def tap(x, y=None):
    if y is None:
        n = find(x) if isinstance(x, str) else x
        assert n, f'ไม่เจอ {x}'
        x, y = n.xy
    sh(f'input tap {x} {y}'); time.sleep(.6)
def edits(nodes=None): return [n for n in (nodes or dump()) if n.cls == 'EditText']
def type_(s):
    sh("input text '%s'" % s.replace(' ', '%s').replace("'", "'\\''")); time.sleep(.5)
def key(*codes): sh('input keyevent ' + ' '.join(map(str, codes))); time.sleep(.3)
def clear(n=45): key('KEYCODE_MOVE_END'); sh('input keyevent ' + ' '.join(['67'] * n)); time.sleep(.3)
def fill(i, s):
    for _ in range(4):
        tap(edits()[i]); time.sleep(.4)
        e = edits()
        if len(e) > i and e[i].focused: break
        hide(); time.sleep(.6)
    else: raise RuntimeError(f'เลือกช่องที่ {i} ไม่ได้')
    if edits()[i].text: clear()
    if s: type_(s)
    e = edits()
    if s and len(e) > i and not e[i].pw and e[i].text != s: print(f'      (พิมพ์ "{s}" ช่องแสดง "{e[i].text}")')
    if s and len(e) > i and e[i].pw and len(e[i].text) != len(s): raise RuntimeError(f'ช่องรหัสผ่านยาว {len(e[i].text)} ไม่ตรง {len(s)}')
def kb(): return 'mInputShown=true' in sh('dumpsys input_method')
def input_type():
    m = re.search(r'inputType=0x([0-9a-f]+)', sh('dumpsys input_method')); return int(m[1], 16) if m else None
def hide():
    if not kb(): return
    key(4)
    for _ in range(12):
        time.sleep(.25)
        if not kb(): break
    time.sleep(.4)
def shot(name):
    os.makedirs(EVID, exist_ok=True); p = os.path.join(EVID, name + '.png')
    open(p, 'wb').write(adb('exec-out', 'screencap', '-p', binary=True)); return f'evidence/{name}.png'
def relaunch(wipe=False):
    sh('am force-stop host.exp.exponent')
    if wipe: sh('pm clear host.exp.exponent')
    sh('pm grant host.exp.exponent android.permission.POST_NOTIFICATIONS'); time.sleep(1)
    sh('am start -a android.intent.action.VIEW -d "exp://127.0.0.1:8081?disableOnboarding=1" host.exp.exponent')
    t = time.time()
    while time.time() - t < 90:
        time.sleep(1.5)
        try: n = dump()
        except Exception: continue
        if find('Don’t allow', n): tap(find('Don’t allow', n)); continue
        if find('ALLOW', n): tap(find('ALLOW', n)); continue
        if find('Continue', n): tap(find('Continue', n)); continue
        if has('ยินดีต้อนรับสู่ Middle', n): time.sleep(4); unblock(); return dump()
    raise RuntimeError('แอปไม่ขึ้นหน้ายินดีต้อนรับ ' + str(texts()))


def unblock():
    """ปิดเมนูของ Expo Go ที่ค้างทับจอ (ไม่ใช่ของแอป)"""
    for _ in range(3):
        n = dump()
        if not any(x.click and x.b == [0, 0, 1080, 2400] for x in n): return
        key(82); time.sleep(1.5)
