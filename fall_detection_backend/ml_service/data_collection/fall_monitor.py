"""
fall_monitor.py — ตรวจจับการล้มสดจาก ESP32 ด้วย rf_v2_event แล้วส่งเข้า Express API (แจ้งเตือนจริง)
====================================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate

    # 1) ML service ต้องโหลด rf_v2_event (Express จะถามมันซ้ำตอนบันทึกเหตุการณ์)
    FALL_MODEL=rf_v2_event uvicorn app.main:app --port 8000
    # 2) Express API (อีก terminal) · cd ../express_api && npm run dev
    # 3) ตัวนี้ (ปิด collect_web.py ก่อน — พอร์ต USB ใช้ได้ทีละโปรแกรม)
    python data_collection/fall_monitor.py --env-file ../express_api/.env
    python data_collection/fall_monitor.py --dry-run                     # ไม่ส่งแจ้งเตือน ดูคะแนนอย่างเดียว
    python data_collection/fall_monitor.py --replay data/raw/s2026...csv # ทดสอบกับไฟล์ที่เก็บไว้ ไม่ต้องมีบอร์ด

ทำงานยังไง
- อ่าน CSI ทาง USB Serial (921600) · ล็อก MAC ตัวส่ง (#2) จาก 200 บรรทัดแรก หรือ --mac
- ทุก 25 packet (0.25 วิ) คิด feature ของกรอบ 472 packet ล่าสุด (app/event_features.stream_feature_vector
  ตัวเดียวกับตอนเทรน) → คะแนนจากโมเดลในเครื่อง (models/rf_v2_event.pkl)
- คะแนน ≥ threshold ติดกัน --confirm กรอบ = ล้ม → POST /api/v1/predict ที่ Express (มี x-api-key)
- --stay-still 3 = ล้มแล้วต้องนิ่งอยู่ที่พื้นอีก 3 วิก่อนแจ้ง (นิ่ง ≥ 80% ของช่วง) · ขยับต่อ/ลุก = ไม่แจ้ง
  ตัดการแจ้งผิดตอนเดิน แต่แจ้งช้าลงตามจำนวนวินาที · log บันทึก PENDING (= จุดที่ถ้าไม่ใช้กฎนี้จะแจ้ง)
  แล้วตามด้วย FALL หรือ CANCEL รอบเดียวจึงเทียบได้ทั้งแบบมีและไม่มีกฎ
  Express ถาม ML service ซ้ำ → บันทึก fall_events → push → นับถอยหลังโทร (กันแจ้งซ้ำ 300 วิต่ออุปกรณ์อยู่ที่ Express)
- รู้ผลช้ากว่าตัวถึงพื้นราว 1.3 วิ + (confirm-1)×0.25 วิ
- บันทึกคะแนนทุกกรอบลง data/realtime/monitor_<เวลา>.csv ไว้ดูย้อนหลัง

⚠️ ประเมินแบบ unseen ไว้ราว: จับล้ม 43% · แจ้งผิด ~4/ชม. ตอนกิจวัตร (ส่วนใหญ่ตอนเดิน) ที่ threshold 0.4 ยืนยัน 5 กรอบ
   (models/report_rf_v2_event.json) — ประเมินจากไฟล์สั้น ๆ ต้องยืนยันด้วยการทดสอบสด
"""

import argparse
import collections
import csv
import glob
import json
import os
import pickle
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime

import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from app import event_features as AF   # noqa: E402

MODEL_PATH = os.path.join(BASE, "models", "rf_v2_event.pkl")
LOG_DIR = os.path.join(BASE, "data", "realtime")


def load_env_file(path):
    """อ่าน KEY=VALUE จากไฟล์ .env (ไม่พิมพ์ค่าออกมา)"""
    out = {}
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip().strip('"').strip("'")
    return out


class Monitor:
    def __init__(self, bundle, threshold, confirm, sender, log_path, quiet=False,
                 stay_still=0.0, still_threshold=0.43, still_fraction=0.8):
        self.model = bundle["model"]
        self.fall_class = list(self.model.classes_).index(1)
        self.threshold, self.confirm = threshold, confirm
        self.sender, self.quiet = sender, quiet
        self.buf = collections.deque(maxlen=AF.STREAM_WINDOW)
        self.since = 0
        self.run = 0
        self.n_windows = 0
        self.detections = []
        self.hold_until = 0.0
        self.stay_still, self.still_threshold, self.still_fraction = stay_still, still_threshold, still_fraction
        self.pending = None
        self.cancelled = []
        self.log = None
        if log_path:
            os.makedirs(os.path.dirname(log_path), exist_ok=True)
            self.log = open(log_path, "w", newline="", encoding="utf-8")
            self.logw = csv.writer(self.log)
            self.logw.writerow(["time", "packet", "fall_prob", "run", "event"])

    def reset(self):
        self.buf.clear()
        self.since = self.run = 0
        self.pending = None
        self.hold_until = 0.0                       # replay: ไฟล์ใหม่ = เวลาเริ่มใหม่ ห้ามติดช่วงกันซ้ำจากไฟล์ก่อน

    def _fire(self, x, prob, now, packet_no, note=""):
        self.detections.append((now, packet_no, prob))
        self.hold_until = now + 10.0                # กันส่งซ้ำจากการล้มครั้งเดียวกัน (Express กันซ้ำอีกชั้น)
        result = self.sender(x, prob) if self.sender else "ไม่ได้ส่ง (dry-run)"
        print(f"\n🚨 {datetime.fromtimestamp(now):%H:%M:%S} ล้ม! คะแนน {prob:.2f} · ยืนยัน {self.confirm} กรอบ{note} → {result}",
              flush=True)
        return "FALL"

    def _check_still(self, An, now, packet_no):
        """ระหว่างรอ: การขยับใน 0.6 วิล่าสุดเทียบ noise ของช่วงก่อนล้ม · ครบเวลาแล้วนิ่งพอ = แจ้ง"""
        p = self.pending
        sm = AF._ma(An[-AF.STREAM_AFTER:], 10)
        motion = sm.std(0).mean() / p["sigma"]
        p["checks"] += 1
        p["still"] += motion <= self.still_threshold
        if now - p["start"] < self.stay_still:
            return "PENDING"
        self.pending = None
        frac = p["still"] / p["checks"]
        if frac >= self.still_fraction:
            return self._fire(p["x"], p["prob"], now, packet_no,
                              note=f" · นิ่งต่อ {self.stay_still:g} วิ ({frac * 100:.0f}% ของช่วง)")
        self.cancelled.append((now, packet_no, frac))
        print(f"\n↩️  {datetime.fromtimestamp(now):%H:%M:%S} ไม่แจ้ง: ยังขยับต่อ (นิ่งแค่ {frac * 100:.0f}% ของ {self.stay_still:g} วิ)",
              flush=True)
        return "CANCEL"

    def add(self, parsed, now, packet_no):
        self.buf.append(parsed)
        self.since += 1
        if len(self.buf) < AF.STREAM_WINDOW or self.since < 25:
            return None
        self.since = 0
        An = np.array([p[0] for p in self.buf])
        Ar = np.array([p[1] for p in self.buf])
        R = np.array([p[2] for p in self.buf])
        x = AF.stream_feature_vector(An, Ar, R, AF.PRE)
        prob = float(self.model.predict_proba(x.reshape(1, -1))[0][self.fall_class])
        self.n_windows += 1
        self.run = self.run + 1 if prob >= self.threshold else 0
        event = ""
        if self.pending is not None:
            event = self._check_still(An, now, packet_no)
        elif self.run == self.confirm and now >= self.hold_until:
            if self.stay_still > 0:
                base = An[:AF.BASE_WIN.stop]
                sigma = np.median(AF._rms(np.diff(base, axis=0))) / np.sqrt(2)
                self.pending = {"start": now, "sigma": sigma, "x": x, "prob": prob, "checks": 0, "still": 0}
                event = "PENDING"
                print(f"\n⏳ {datetime.fromtimestamp(now):%H:%M:%S} ตรวจพบการล้ม (คะแนน {prob:.2f}) — รอดูว่านิ่งอยู่ที่พื้น "
                      f"{self.stay_still:g} วิ", flush=True)
            else:
                event = self._fire(x, prob, now, packet_no)
        if self.log:
            self.logw.writerow([f"{now:.2f}", packet_no, f"{prob:.4f}", self.run, event])
        if not self.quiet:
            bar = "█" * int(prob * 20) + "·" * (20 - int(prob * 20))
            print(f"\r  คะแนนล้ม {prob:4.2f} [{bar}] ติดกัน {self.run}/{self.confirm}   ", end="", flush=True)
        return prob

    def close(self):
        if self.log:
            self.log.close()


def make_sender(api_url, api_key, device_id, location):
    def send(x, prob):
        body = json.dumps({"device_id": device_id, "timestamp": int(time.time() * 1000), "location": location,
                           "features": [x.tolist()]}).encode("utf-8")
        req = urllib.request.Request(f"{api_url}/api/v1/predict", data=body,
                                     headers={"Content-Type": "application/json", "x-api-key": api_key})
        try:
            with urllib.request.urlopen(req, timeout=8) as r:
                res = json.loads(r.read().decode())
            return f"Express: {res.get('action')} (is_fall={res.get('is_fall')})"
        except urllib.error.HTTPError as e:
            return f"Express ตอบ {e.code}: {e.read().decode(errors='replace')[:120]}"
        except Exception as e:                      # noqa: BLE001 — แสดงแล้วตรวจต่อ ห้ามหยุด
            return f"ส่งไม่สำเร็จ: {e}"
    return send


def find_port():
    ports = sorted(glob.glob("/dev/cu.usbserial-*") + glob.glob("/dev/cu.SLAB_USBtoUART*") + glob.glob("/dev/ttyUSB*"))
    return ports[0] if ports else None


def run_serial(mon, port, mac):
    import serial
    print(f"📡 เปิด {port} @ 921600 (บอร์ด #1 จะรีบูตตอนเปิดพอร์ต — รอ CSI ไหลสักครู่)")
    ser = serial.Serial(port, 921600, timeout=1)
    macs = collections.Counter()
    locked = mac.upper() if mac else None
    n, t0, last_rate = 0, time.time(), time.time()
    try:
        while True:
            raw = ser.readline().decode("utf-8", errors="ignore")
            if "CSI_DATA" not in raw:
                continue
            parts = raw.split(",")
            src = parts[2].upper() if len(parts) > 2 else ""
            if locked is None:
                macs[src] += 1
                if sum(macs.values()) >= 200:
                    locked, cnt = macs.most_common(1)[0]
                    print(f"🔒 ล็อก MAC ตัวส่ง {locked} ({cnt}/200)")
                continue
            if src != locked:
                continue
            parsed = AF.parse_csi_line(raw)
            if parsed is None:
                continue
            n += 1
            now = time.time()
            mon.add(parsed, now, n)
            if now - last_rate >= 30:
                print(f"\n  ℹ️ {n / (now - t0):.1f} pkt/s เฉลี่ย · ตรวจแล้ว {mon.n_windows} กรอบ · ล้ม {len(mon.detections)} ครั้ง", flush=True)
                last_rate = now
    except KeyboardInterrupt:
        pass
    finally:
        ser.close()


def run_replay(mon, files):
    for path in files:
        mon.reset()
        rows = list(csv.DictReader(open(path, newline="", encoding="utf-8")))
        mark = next((i for i, r in enumerate(rows) if r.get("mark") == "1"), None)
        probs, n, mark_pkt = [], 0, None
        before = len(mon.detections)
        for i, r in enumerate(rows):
            if i == mark:
                mark_pkt = n
            parsed = AF.parse_csi_line(r["raw"])
            if parsed is None:
                continue
            n += 1
            p = mon.add(parsed, float(n) / 100, n)
            if p is not None:
                probs.append(p)
        if mon.pending is not None:
            print(f"\n  (ไฟล์จบก่อนครบเวลารอดูนิ่ง {mon.stay_still:g} วิ — ไฟล์สั้นเกินจะตัดสิน)")
        hits = mon.detections[before:]
        when = ", ".join(f"{(pk - mark_pkt) / 100:+.2f} วิจากมาร์ค" if mark_pkt is not None else f"packet {pk}" for _, pk, _ in hits)
        print(f"\n{os.path.basename(path)} · {len(probs)} กรอบ · คะแนนสูงสุด {max(probs) if probs else 0:.2f} · "
              f"แจ้ง {len(hits)} ครั้ง{(' (' + when + ')') if hits else ''}")


def main():
    ap = argparse.ArgumentParser(description="ตรวจจับการล้มสดด้วย rf_v2_event")
    ap.add_argument("--port", help="พอร์ต serial (ค่าเริ่มต้น: หา /dev/cu.usbserial-* เอง)")
    ap.add_argument("--mac", default=os.getenv("CSI_MAC"), help="MAC ตัวส่ง (#2) ถ้าไม่ใส่จะล็อกตัวที่เจอบ่อยสุด")
    ap.add_argument("--threshold", type=float, help="ค่าเริ่มต้นจากโมเดล (0.5)")
    ap.add_argument("--confirm", type=int, help="จำนวนกรอบติดกัน · ค่าเริ่มต้นจากโมเดล (4)")
    ap.add_argument("--api", default=os.getenv("EXPRESS_URL", "http://localhost:3000"))
    ap.add_argument("--env-file", help="อ่าน DEVICE_API_KEY (หรือ API_KEY) จากไฟล์ .env ของ Express")
    ap.add_argument("--device-id", default=os.getenv("DEVICE_ID", "ESP-B96AB8"))
    ap.add_argument("--location", default=os.getenv("DEVICE_LOCATION", "ห้องทดสอบ"))
    ap.add_argument("--dry-run", action="store_true", help="ไม่ส่งเข้า Express")
    ap.add_argument("--replay", nargs="+", help="ไฟล์ CSV ที่เก็บไว้ (ทดสอบโดยไม่ต้องมีบอร์ด · ไม่ส่งแจ้งเตือน)")
    ap.add_argument("--stay-still", type=float, default=0.0, help="ล้มแล้วต้องนิ่งกี่วินาทีก่อนแจ้ง (0 = ปิด · แนะนำ 3)")
    ap.add_argument("--still-threshold", type=float, help="เกณฑ์นิ่ง · ค่าเริ่มต้นจากโมเดล")
    ap.add_argument("--still-fraction", type=float, default=0.8, help="สัดส่วนของช่วงรอที่ต้องนิ่ง")
    ap.add_argument("--no-log", action="store_true")
    args = ap.parse_args()

    bundle = pickle.load(open(MODEL_PATH, "rb"))
    threshold = args.threshold if args.threshold is not None else bundle["threshold"]
    confirm = args.confirm if args.confirm is not None else bundle["confirm"]
    still_thr = args.still_threshold if args.still_threshold is not None else bundle.get("still_threshold", 0.43)
    delay = 1.3 + (confirm - 1) * 0.25 + args.stay_still
    print(f"🧠 {bundle['version']} · threshold {threshold} · ยืนยัน {confirm} กรอบ"
          + (f" · ล้มแล้วนิ่ง {args.stay_still:g} วิ (เกณฑ์ {still_thr:.2f} · {args.still_fraction * 100:.0f}%)" if args.stay_still else "")
          + f" · แจ้งราว {delay:.1f} วิหลังตัวถึงพื้น")

    sender = None
    if not args.dry_run and not args.replay:
        env = dict(os.environ)
        if args.env_file:
            env.update(load_env_file(args.env_file))
        key = env.get("DEVICE_API_KEY") or env.get("API_KEY")
        if key:
            sender = make_sender(args.api.rstrip("/"), key, args.device_id, args.location)
            print(f"📨 ล้มแล้วส่งเข้า {args.api} · device {args.device_id}")
        else:
            print("⚠️ ไม่พบ DEVICE_API_KEY / API_KEY — ดูคะแนนอย่างเดียว ไม่ส่งแจ้งเตือน (ใส่ --env-file ../express_api/.env)")

    log_path = None if args.no_log or args.replay else os.path.join(LOG_DIR, f"monitor_{datetime.now():%Y%m%d_%H%M%S}.csv")
    mon = Monitor(bundle, threshold, confirm, sender, log_path, quiet=bool(args.replay),
                  stay_still=args.stay_still, still_threshold=still_thr, still_fraction=args.still_fraction)
    try:
        if args.replay:
            run_replay(mon, args.replay)
        else:
            port = args.port or find_port()
            if not port:
                sys.exit("❌ ไม่เจอพอร์ต USB ของ ESP32 #1 — เสียบสายหรือใส่ --port")
            run_serial(mon, port, args.mac)
    finally:
        mon.close()
    print(f"\nสรุป: ตรวจ {mon.n_windows} กรอบ · ล้ม {len(mon.detections)} ครั้ง"
          + (f" · ไม่แจ้งเพราะขยับต่อ {len(mon.cancelled)} ครั้ง" if args.stay_still else "")
          + (f" · log {log_path}" if log_path else ""))


if __name__ == "__main__":
    main()
