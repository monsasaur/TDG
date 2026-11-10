"""
collect_web.py — หน้าเว็บเก็บ dataset (แทน CLI ของ csi_collector_serial.py)
============================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    CSI_TRANSPORT=udp python data_collection/collect_web.py      # ใช้งานจริง (UDP)
    python data_collection/collect_web.py                         # serial
    python data_collection/collect_web.py --demo                  # ซ้อมโดยไม่มีบอร์ด (ข้อมูลปลอม)

แล้วเปิด http://localhost:8765

ทำไมต้องรันบนเครื่องตัวเอง: ต้องรับ UDP/serial จาก ESP32 ตรง ๆ — หน้าเว็บที่อยู่บนเน็ตทำไม่ได้

ตรรกะทุกอย่างมาจาก csi_collector_serial.py — ไม่ได้เขียนใหม่:
  ลำดับสลับคลาส (build_interleaved_plan) · ชื่อไฟล์ + คอลัมน์ mark (write_sample_csv)
  manifest (save_manifest) · เกณฑ์เตือน (assess_sample) · โหมดของแต่ละท่า (ACTIVITY_MODE)
ไฟล์ที่ได้จึงเหมือนเก็บด้วย CLI ทุกประการ — preprocess_v3 อ่านได้เลย

ปุ่ม: Space = ปุ่มหลัก (เริ่ม / มาร์ค / หยุด) · Y = บันทึก · N = ทิ้งแล้วเก็บซ้ำ

⚠️ ปิดหน้าเว็บได้ (เปิดใหม่ก็กลับมาที่เดิม) แต่ **ห้ามปิดโปรแกรมนี้** ระหว่าง session
   ปิดแล้วเปิดใหม่ = คนละ session · manifest เซฟทุก sample ข้อมูลที่เก็บแล้วไม่หาย
"""

import collections
import json
import os
import random
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import csi_collector_serial as C  # noqa: E402

HOST = "127.0.0.1"
PORT = int(os.environ.get("COLLECT_WEB_PORT", "8765"))
HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "collect_web.html")
DEMO = "--demo" in sys.argv


# =================== ข้อมูลปลอมสำหรับซ้อม ===================
class DemoReader:
    """สร้างบรรทัด CSI_DATA ปลอม 100 pkt/s รูปแบบเดียวกับของจริง + บรรทัด STAT แบบ firmware ใหม่

    ไฟล์ที่ได้จาก --demo ลง data/raw เหมือนของจริง — ลบทิ้งก่อนเก็บจริง (หน้าเว็บเตือนให้)
    """
    kind = "demo"
    desc = "ข้อมูลปลอม (--demo)"
    mac = "1C:C3:AB:B9:78:CC"

    def __init__(self):
        self.i = 0
        self.t0 = time.time()
        self.next_stat = self.t0 + 1
        self.rng = random.Random(0)

    def readline(self):
        now = time.time()
        if now >= self.next_stat:
            self.next_stat += 1
            n = self.i
            return (f"STAT,AP,{int((now-self.t0)*1000)},cb={n},skip=0,qdrop=0,"
                    f"sent={n},fail=0,dest=unicast\n").encode()
        due = self.t0 + self.i / 100.0
        if due > now:
            time.sleep(due - now)
        self.i += 1
        vals = " ".join(str(self.rng.randint(-30, 30)) for _ in range(128))
        line = (f"CSI_DATA,AP,{self.mac},-40,11,1,7,1,1,0,1,0,0,0,-95,0,6,1,"
                f"{int(self.i * 1e4)},0,40,0,0,{self.i/100:.6f},384,[{vals} ]")
        return line.encode()

    def reset(self):
        pass

    def close(self):
        pass


# =================== สถานะทั้งหมด (ป้องกันด้วย lock ตัวเดียว) ===================
lock = threading.RLock()
S = {
    "phase": "connecting",        # connecting · setup · idle · countdown · recording · review · done · error
    "error": None,
    "transport": None,
    "mac": None,
    "session": None,              # dict ตอนเริ่ม session
    "plan": [],
    "pos": 0,                     # ตำแหน่งใน plan ของตาปัจจุบัน
    "records": [],
    "cur": None,                  # ตาปัจจุบัน
    "review": None,
    "events": [],                 # เสียง/ข้อความให้หน้าเว็บเล่น (beep / speak)
    "event_seq": 0,
}
packets = []                      # packet ของตาที่กำลังบันทึก (แยกจาก S เพราะใหญ่)
live_ts = collections.deque()     # (เวลาเครื่อง, ESP32 timestamp) — วัดอัตราสด 2 วิล่าสุด
live_drop = collections.deque()   # เวลาเครื่องของเฟรม MAC อื่น
stat_hist = collections.deque(maxlen=8)   # บรรทัด STAT ล่าสุดจาก #1
last_pkt_at = [0.0]
reader_ref = [None]


def push_event(kind, text=""):
    S["event_seq"] += 1
    S["events"].append({"seq": S["event_seq"], "kind": kind, "text": text})
    del S["events"][:-20]


def stop_ready(cur):
    """ข้อมูลพอแล้วหรือยัง — เลยจุดนี้ไปไม่ได้ข้อมูลที่ใช้เพิ่ม"""
    n = len(packets)
    if cur["mode"] == "mark":
        return cur["mark"] >= 0 and n - cur["mark"] >= C.STOP_AFTER_MARK_SEC * C.PKT_PER_SEC
    if cur["mode"] == "plain":
        return n >= C.PLAIN_STOP_SEC * C.PKT_PER_SEC
    return False


def bar_target(cur):
    """ความยาวเต็มแถบ progress — ตั้งตามท่า ไม่ใช่ 12 วิตายตัว"""
    r = C.PKT_PER_SEC
    if cur["mode"] == "mark":
        if cur["mark"] >= 0:
            return int(cur["mark"] + C.STOP_AFTER_MARK_SEC * r)
        return int((5.0 + C.STOP_AFTER_MARK_SEC) * r)   # ยืน 5 วิ + หลังมาร์ค 2 วิ
    if cur["mode"] == "plain":
        return int(C.PLAIN_STOP_SEC * r)
    return C.PACKETS_PER_SAMPLE


def mode_of(name, label):
    return C.ACTIVITY_MODE.get(name, "mark" if label == "fall" else "plain")


# =================== อ่านข้อมูลจาก ESP32 ตลอดเวลา ===================
def parse_stat(line):
    p = line.strip().split(",")
    d = {"t": int(p[2]) / 1000.0} if len(p) > 2 and p[2].isdigit() else {}
    for kv in p[3:]:
        if "=" in kv:
            k, v = kv.split("=", 1)
            d[k] = int(v) if v.isdigit() else v
    return d


def reader_loop():
    while True:
        reader = reader_ref[0]
        if reader is None:
            time.sleep(0.2)
            continue
        try:
            raw = reader.readline()
        except Exception as e:  # สายหลุด ฯลฯ
            with lock:
                S["phase"], S["error"] = "error", f"อ่านข้อมูลไม่ได้: {e}"
            time.sleep(1)
            continue
        now = time.time()
        if raw:
            line = raw.decode("utf-8", errors="ignore").strip()
            if line.startswith("STAT,"):
                with lock:
                    stat_hist.append((now, parse_stat(line)))
            elif "CSI_DATA" in line:
                if reader.mac and C.csi_mac(line) != reader.mac:
                    with lock:
                        live_drop.append(now)
                        if S["phase"] == "recording":
                            S["cur"]["dropped"] += 1
                else:
                    ts = C.csi_timestamp(line)
                    with lock:
                        last_pkt_at[0] = now
                        if ts is not None:
                            live_ts.append((now, ts))
                        if S["phase"] == "recording":
                            packets.append({"timestamp": datetime.now().isoformat(),
                                            "label": S["cur"]["label"], "raw": line})
        with lock:
            while live_ts and now - live_ts[0][0] > 2.0:
                live_ts.popleft()
            while live_drop and now - live_drop[0] > 2.0:
                live_drop.popleft()
            tick(now)


def tick(now):
    """เปลี่ยน phase ตามเวลา — เรียกจาก reader loop และจากทุก request (กันค้างถ้า packet ไม่มา)"""
    cur = S["cur"]
    if S["phase"] == "countdown" and now >= cur["countdown_end"]:
        packets.clear()
        cur["rec_start"] = now
        S["phase"] = "recording"
        push_event("beep", "start")
    elif (S["phase"] == "recording" and cur["mode"] == "mark" and cur["mark"] < 0
          and S["session"].get("action_cue")):
        # นับถอยหลังให้คนแสดง: ติ๊กที่ -3 -2 -1 วิ แล้วเสียงยาว + คำสั่งที่ 0
        # ใช้ beep เป็นจังหวะจริง (แม่นถึง ms) · เสียงพูดช้ากว่า ~0.3 วิ ใช้เป็นตัวช่วยเท่านั้น
        el = now - cur["rec_start"]
        due = sum(1 for t in (-3, -2, -1, 0) if el >= C.ACTION_CUE_SEC + t)
        while cur["cue_stage"] < due:
            cur["cue_stage"] += 1
            if cur["cue_stage"] < 4:
                push_event("beep", "tick")
            else:
                push_event("beep", "go")
                push_event("speak", C.ACTION_WORD.get(cur["name"], "ทำท่า"))
    elif S["phase"] == "recording" and cur["mode"] != "auto" and not cur["stop_cued"]:
        if stop_ready(cur):
            cur["stop_cued"] = True
            push_event("beep", "ready")          # บอกคนกดว่าหยุดได้แล้ว ไม่ต้องนับเอง
    elif S["phase"] == "recording" and cur["mode"] == "auto":
        if len(packets) >= C.PACKETS_PER_SAMPLE or now - cur["rec_start"] > C.AUTO_TIMEOUT:
            finish_recording()
            push_event("beep", "done")
            push_event("speak", "ครบแล้ว กลับเข้าห้องได้")


# =================== การเก็บแต่ละตา ===================
def start_session(rounds, info, activities, action_cue=True):
    plan = C.build_interleaved_plan(rounds, activities=activities)
    sid = datetime.now().strftime("%Y%m%d_%H%M")
    planned = collections.Counter(n for _, n, _ in plan)
    # เก็บท่าที่เลือกลง manifest ด้วย — ตรวจย้อนหลังได้ว่า session นี้ตั้งใจเก็บท่าไหน
    # บันทึกด้วยว่าใช้จังหวะบอกหรือไม่ — จังหวะที่คงที่อาจทำให้ท่าดูไม่เป็นธรรมชาติ ต้องตรวจย้อนหลังได้
    info = dict(info, activities=[n for _, n, _ in C.ACTIVITIES if n in planned],
                action_cue_sec=C.ACTION_CUE_SEC if action_cue else None)
    S["session"] = {"id": sid, "info": info, "rounds": rounds, "planned": dict(planned),
                    "action_cue": bool(action_cue),
                    "started_at": datetime.now().isoformat(), "target": len(plan)}
    S["plan"], S["pos"], S["records"] = plan, 0, []
    load_current()


def load_current():
    if S["pos"] >= len(S["plan"]):
        S["phase"], S["cur"] = "done", None
        push_event("speak", "จบ session แล้ว")
        return
    label, name, _ = S["plan"][S["pos"]]
    mode = mode_of(name, label)
    S["cur"] = {"label": label, "name": name, "mode": mode, "seq": S["pos"] + 1,
                "cue": C.MARK_CUE.get(name), "mark": -1, "dropped": 0, "stop_cued": False, "cue_stage": 0,
                "countdown_end": None, "rec_start": None, "rec_end": None}
    S["phase"], S["review"] = "idle", None
    push_event("speak", f"ตาต่อไป {name}")


def finish_recording():
    cur = S["cur"]
    cur["rec_end"] = time.time()
    n = len(packets)
    mark = cur["mark"]
    if mark >= n:                      # กดมาร์คแล้วหยุดทันทีจน packet ถัดไปยังไม่มา
        mark = n - 1
    cur["mark"] = mark
    rate = None
    if n >= 50:
        t0 = C.csi_timestamp(packets[0]["raw"])
        t1 = C.csi_timestamp(packets[-1]["raw"])
        if t0 is not None and t1 is not None and t1 > t0:
            rate = (n - 1) / (t1 - t0)
    issues = C.assess_sample(cur["mode"], n, mark, rate)
    S["review"] = {"n": n, "mark": mark, "rate": round(rate, 1) if rate else None,
                   "dropped": cur["dropped"],
                   "mark_sec": round(mark / C.PKT_PER_SEC, 2) if mark >= 0 else None,
                   "after_sec": round((n - mark) / C.PKT_PER_SEC, 2) if mark >= 0 else None,
                   "dur_sec": round(n / C.PKT_PER_SEC, 1),
                   "issues": [{"level": l, "text": t} for l, t in issues],
                   "ok": not any(l == "bad" for l, _ in issues)}
    S["phase"] = "review"


def action_primary():
    """Space / ปุ่มใหญ่ — ทำสิ่งที่สมเหตุสมผลตาม phase"""
    ph, cur = S["phase"], S["cur"]
    if ph == "idle":
        secs = C.AUTO_COUNTDOWN if cur["mode"] == "auto" else C.COUNTDOWN
        cur["countdown_end"] = time.time() + secs
        S["phase"] = "countdown"
        if cur["mode"] == "auto":
            push_event("speak", f"ทุกคนออกจากห้อง ภายใน {secs} วินาที")
    elif ph == "recording" and cur["mode"] == "mark" and cur["mark"] < 0:
        cur["mark"] = len(packets)
        push_event("beep", "mark")
    elif ph == "recording" and cur["mode"] != "auto":
        finish_recording()
    elif ph == "countdown":
        # กดระหว่างนับถอยหลัง = ยกเลิก กลับไปรอ
        S["phase"], cur["countdown_end"] = "idle", None


def action_save():
    if S["phase"] != "review":
        return
    cur, rv, sess = S["cur"], S["review"], S["session"]
    prefix = f"s{sess['id']}_{cur['seq']:03d}"
    fname = C.write_sample_csv(list(packets), cur["label"], cur["name"], cur["seq"],
                               prefix, cur["mark"] if cur["mode"] == "mark" else -1)
    S["records"].append({"seq": cur["seq"], "label": cur["label"], "activity": cur["name"],
                         "file": fname,
                         "mark": cur["mark"] if cur["mode"] == "mark" else -1,
                         "rate": rv["rate"], "at": datetime.now().isoformat()})
    C.save_manifest(sess["id"], sess["info"], S["plan"], S["records"], sess["started_at"])
    packets.clear()
    S["pos"] += 1
    load_current()


def action_discard():
    if S["phase"] != "review":
        return
    label, name, _ = S["plan"][S["pos"]]
    # เก็บท่าเดิมซ้ำทันทีในตาถัดไป — เหมือน CLI (ไม่ต่อท้าย plan)
    S["plan"].insert(S["pos"] + 1, (label, name, None))
    packets.clear()
    S["pos"] += 1
    load_current()


def action_end():
    if S["session"] and S["records"]:
        sess = S["session"]
        C.save_manifest(sess["id"], sess["info"], S["plan"], S["records"], sess["started_at"])
    packets.clear()
    S["phase"], S["cur"], S["review"] = "done", None, None


# =================== สถานะส่งให้หน้าเว็บ ===================
def live_rate():
    if len(live_ts) < 10:
        return None
    (_, a), (_, b) = live_ts[0], live_ts[-1]
    return round((len(live_ts) - 1) / (b - a), 1) if b > a else None


def stat_summary():
    if len(stat_hist) < 2:
        return stat_hist[-1][1] if stat_hist else None
    (_, a), (_, b) = stat_hist[0], stat_hist[-1]
    dt = b.get("t", 0) - a.get("t", 0)
    if dt <= 0:
        return b
    out = {k: round((b[k] - a[k]) / dt, 1) for k in ("cb", "skip", "qdrop", "sent", "fail")
           if isinstance(b.get(k), int) and isinstance(a.get(k), int)}
    out["dest"] = b.get("dest")
    out["age"] = round(time.time() - stat_hist[-1][0], 1)
    return out


def snapshot():
    now = time.time()
    tick(now)
    cur = S["cur"]
    rec = None
    if cur:
        rec = dict(cur)
        if S["phase"] == "countdown":
            rec["countdown_left"] = max(0.0, round(cur["countdown_end"] - now, 1))
        if S["phase"] == "recording":
            rec["n"] = len(packets)
            rec["elapsed"] = round(now - cur["rec_start"], 1)
            rec["mark_sec"] = round(cur["mark"] / C.PKT_PER_SEC, 1) if cur["mark"] >= 0 else None
            rec["ready_to_mark"] = len(packets) >= C.MARK_MIN_PKT
            if cur["mode"] == "mark" and S["session"].get("action_cue"):
                rec["cue_in"] = round(C.ACTION_CUE_SEC - (now - cur["rec_start"]), 1)
                rec["cue_word"] = C.ACTION_WORD.get(cur["name"], "ทำท่า")
            rec["stop_ready"] = stop_ready(cur)
            rec["bar_target"] = bar_target(cur)
            if cur["mode"] == "mark" and cur["mark"] >= 0:
                rec["after_sec"] = round((len(packets) - cur["mark"]) / C.PKT_PER_SEC, 1)
    recs = S["records"]
    tally = collections.Counter(r["activity"] for r in recs)
    upcoming = [{"label": l, "name": n} for l, n, _ in S["plan"][S["pos"] + 1:S["pos"] + 7]]
    raw_files = [f for f in os.listdir(C.RAW_DIR) if f.endswith(".csv")]
    return {
        "phase": S["phase"], "error": S["error"], "demo": DEMO,
        "transport": S["transport"], "mac": S["mac"],
        "signal": {"rate": live_rate(), "other_per_s": round(len(live_drop) / 2.0, 1),
                   "last_pkt_age": round(now - last_pkt_at[0], 1) if last_pkt_at[0] else None,
                   "esp": stat_summary()},
        "consts": {"pkt_per_sec": C.PKT_PER_SEC, "target_pkts": C.PACKETS_PER_SAMPLE,
                   "mark_min_sec": round(C.MARK_MIN_PKT / C.PKT_PER_SEC, 1),
                   "plain_min_sec": round(C.PLAIN_MIN_PKT / C.PKT_PER_SEC, 1),
                   "stop_after_mark_sec": C.STOP_AFTER_MARK_SEC, "plain_stop_sec": C.PLAIN_STOP_SEC,
                   "action_cue_sec": C.ACTION_CUE_SEC,
                   "rate_warn": C.RATE_WARN, "rate_fail": C.RATE_FAIL},
        "session": S["session"], "cur": rec, "review": S["review"],
        "progress": {"done": len(recs), "target": S["session"]["target"] if S["session"] else 0,
                     "fall": sum(1 for r in recs if r["label"] == "fall"),
                     "non_fall": sum(1 for r in recs if r["label"] != "fall"),
                     "retakes": len(S["plan"]) - (S["session"]["target"] if S["session"] else 0)},
        "tally": [{"label": l, "name": n, "done": tally.get(n, 0),
                   "goal": S["session"]["planned"].get(n, 0)}
                  for l, n, _ in C.ACTIVITIES
                  if S["session"] and S["session"]["planned"].get(n)],
        "activities": [{"label": l, "name": n, "mode": mode_of(n, l)} for l, n, _ in C.ACTIVITIES],
        "upcoming": upcoming,
        "raw_files_existing": len(raw_files),
        "events": S["events"],
    }


# =================== HTTP ===================
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype + "; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            with open(HTML_PATH, "rb") as f:
                return self._send(200, f.read(), "text/html")
        if self.path.startswith("/api/state"):
            with lock:
                return self._send(200, snapshot())
        self._send(404, {"error": "not found"})

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        try:
            body = json.loads(self.rfile.read(n) or b"{}")
        except json.JSONDecodeError:
            return self._send(400, {"error": "bad json"})
        with lock:
            ph = S["phase"]
            if self.path == "/api/session":
                if ph != "setup":
                    return self._send(409, {"error": f"เริ่ม session ตอนนี้ไม่ได้ ({ph})"})
                try:
                    rounds = int(body.get("rounds", 0))
                except (TypeError, ValueError):
                    rounds = 0
                if rounds < 1:
                    return self._send(400, {"error": "จำนวนรอบต้อง ≥ 1"})
                info = {k: (str(body.get(k) or "").strip() or None)
                        for k in ("room", "esp32_setup", "actor", "notes")}
                known = {n for _, n, _ in C.ACTIVITIES}
                acts = body.get("activities")
                acts = [a for a in acts if a in known] if isinstance(acts, list) else None
                try:
                    start_session(rounds, info, acts, bool(body.get("action_cue", True)))
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
            elif self.path == "/api/primary":
                if ph not in ("idle", "countdown", "recording"):
                    return self._send(409, {"error": f"ไม่มีอะไรให้กดตอนนี้ ({ph})"})
                action_primary()
            elif self.path == "/api/save":
                action_save()
            elif self.path == "/api/discard":
                action_discard()
            elif self.path == "/api/end":
                action_end()
            elif self.path == "/api/new":
                if ph != "done":
                    return self._send(409, {"error": "ต้องจบ session ก่อน"})
                S["session"], S["plan"], S["records"], S["phase"] = None, [], [], "setup"
            else:
                return self._send(404, {"error": "not found"})
            return self._send(200, snapshot())


# =================== main ===================
def connect():
    if DEMO:
        reader = DemoReader()
        S["transport"] = "demo"
    else:
        reader = C.connect_esp32()       # พิมพ์ขั้นตอนเชื่อมต่อลง terminal เหมือน CLI
        if reader is None:
            with lock:
                S["phase"], S["error"] = "error", "เชื่อมต่อ ESP32 ไม่ได้ — ดูข้อความใน terminal"
            return
        S["transport"] = reader.kind
    with lock:
        S["mac"] = reader.mac
        reader_ref[0] = reader
        S["phase"] = "setup"


def main():
    print("=" * 60)
    print("  📡  หน้าเว็บเก็บ dataset" + ("  (DEMO — ข้อมูลปลอม)" if DEMO else ""))
    print(f"  เปิด  http://localhost:{PORT}")
    print(f"  ไฟล์ → {C.RAW_DIR}")
    print("  ⚠️  ห้ามปิดโปรแกรมนี้ระหว่าง session (ปิดหน้าเว็บได้)")
    print("=" * 60)
    threading.Thread(target=reader_loop, daemon=True).start()
    threading.Thread(target=connect, daemon=True).start()
    srv = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        with lock:
            if S["session"] and S["records"]:
                sess = S["session"]
                path = C.save_manifest(sess["id"], sess["info"], S["plan"], S["records"],
                                       sess["started_at"])
                print(f"\n  📄 manifest → {os.path.relpath(path, C.BASE_DIR)} "
                      f"({len(S['records'])} sample)")
        if reader_ref[0]:
            reader_ref[0].close()
        print("  👋 ปิดแล้ว")


if __name__ == "__main__":
    main()
