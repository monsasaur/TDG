"""
csi_streamer.py
===============
รับ CSI UDP จาก ESP32 → แปลงเป็น features → ส่งไป ML Service → Express API

Flow:
  ESP32 → UDP:5500 → CSIBuffer → HTTP POST → ML Service:8000/predict
                                            → Express API:3000/api/v1/predict

วิธีใช้:
  source venv/bin/activate
  python data_collection/csi_streamer.py
"""

import socket
import json
import time
import threading
import urllib.request
import urllib.error
import os
import sys

# เพิ่ม path สำหรับ import app.preprocess
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.preprocess import CSIBuffer

# =================== Config ===================
UDP_HOST        = "0.0.0.0"
UDP_PORT        = 5500
BUFFER_SIZE     = 4096

ML_SERVICE_URL  = os.getenv("ML_SERVICE_URL",  "http://localhost:8000")
EXPRESS_URL     = os.getenv("EXPRESS_URL",      "http://localhost:3000")
EXPRESS_API_KEY = os.getenv("API_KEY",          "dev-secret-key-123")

DEVICE_ID       = os.getenv("DEVICE_ID",        "esp32-01")
LOCATION        = os.getenv("LOCATION",         "ห้องนอน")

PREDICT_INTERVAL = 0.5  # วิ — predict ทุกกี่วินาที
MIN_CONFIDENCE   = 0.60  # ต่ำกว่านี้ไม่ส่ง alert

LEVEL_THAI = {
    "A":  "🟡 Level A — แจ้งเตือนเบา",
    "B":  "🟠 Level B — แจ้ง Caregiver",
    "C":  "🔴 Level C — ฉุกเฉิน!",
    None: "🟢 ปกติ",
}


# =================== HTTP helpers ===================
def post_json(url, data: dict, headers: dict = None) -> dict:
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req  = urllib.request.Request(url, data=body,
                                   headers={"Content-Type": "application/json",
                                            **(headers or {})})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode())


def predict_ml(features: list) -> dict:
    """ส่ง features ไป ML Service โดยตรง"""
    return post_json(f"{ML_SERVICE_URL}/predict", {"features": features})


def send_to_express(features: list) -> dict:
    """ส่งผ่าน Express API (บันทึก DB + Alert)"""
    return post_json(
        f"{EXPRESS_URL}/api/v1/predict",
        {
            "device_id": DEVICE_ID,
            "location":  LOCATION,
            "features":  features,
            "timestamp": int(time.time() * 1000),
        },
        headers={"x-api-key": EXPRESS_API_KEY},
    )


# =================== Streamer ===================
class CSIStreamer:
    def __init__(self):
        self.buf         = CSIBuffer()
        self._sock       = None
        self._running    = False
        self._last_pred  = 0
        self._lock       = threading.Lock()
        self._pkt_count  = 0
        self._pred_count = 0

    def connect(self) -> bool:
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind((UDP_HOST, UDP_PORT))
        self._sock.settimeout(10.0)
        print(f"📡 รอ UDP จาก ESP32 ที่ port {UDP_PORT}...")
        try:
            data, addr = self._sock.recvfrom(BUFFER_SIZE)
            print(f"✅ ESP32 IP: {addr[0]}")
            line = data.decode("utf-8", errors="ignore").strip()
            self.buf.add_packet(line)
            return True
        except socket.timeout:
            print("❌ Timeout — ไม่มีข้อมูลจาก ESP32")
            return False

    def run(self):
        self._running = True
        self._sock.settimeout(1.0)
        print(f"\n🚀 Streaming เริ่มแล้ว")
        print(f"   ML Service : {ML_SERVICE_URL}")
        print(f"   Express    : {EXPRESS_URL}")
        print(f"   Device     : {DEVICE_ID} @ {LOCATION}")
        print(f"   Predict ทุก {PREDICT_INTERVAL} วิ\n")

        while self._running:
            try:
                data, _ = self._sock.recvfrom(BUFFER_SIZE)
                line = data.decode("utf-8", errors="ignore").strip()

                if "CSI_DATA" not in line:
                    continue

                with self._lock:
                    self.buf.add_packet(line)
                    self._pkt_count += 1

                # แสดง progress ทุก 100 packets
                if self._pkt_count % 100 == 0:
                    needed = 200 + (10 - 1) * 50  # 650
                    pct    = min(self.buf.size() / needed * 100, 100)
                    bar    = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
                    print(f"\r  📦 {self._pkt_count} pkts  Buffer |{bar}| {pct:.0f}%", end="", flush=True)

                # Predict ทุก PREDICT_INTERVAL วิ
                now = time.time()
                if now - self._last_pred >= PREDICT_INTERVAL:
                    with self._lock:
                        ready = self.buf.ready()
                        if ready:
                            features = self.buf.get_features()

                    if ready:
                        self._last_pred = now
                        self._do_predict(features)

            except socket.timeout:
                continue
            except KeyboardInterrupt:
                break
            except Exception as e:
                print(f"\n⚠️  Error: {e}")

    def _do_predict(self, features: list):
        """predict แล้วส่งไป Express (บันทึก DB + Alert อัตโนมัติ)"""
        try:
            result = send_to_express(features)

            is_fall          = result.get("is_fall", False)
            fall_level       = result.get("fall_level")
            conf             = result.get("confidence", 0)
            risk             = result.get("risk_score", 0)
            duration         = result.get("duration_on_floor", 0)
            self._pred_count += 1

            label = LEVEL_THAI.get(fall_level if is_fall else None,
                                   "🟢 ปกติ")
            dur_str = f"  ⏱️ {duration}s" if is_fall else ""
            print(f"\n  [{self._pred_count}] {label}  conf={conf:.0%}  risk={risk:.2f}{dur_str}")

            if is_fall and conf >= MIN_CONFIDENCE:
                alert = result.get("alert", "")
                print(f"       ⚡ {alert}")

        except urllib.error.HTTPError as e:
            body = e.read().decode()
            print(f"\n  ❌ HTTP {e.code}: {body}")
        except Exception as e:
            print(f"\n  ❌ Predict error: {e}")

    def stop(self):
        self._running = False
        if self._sock:
            self._sock.close()


# =================== Main ===================
def main():
    print("=" * 55)
    print("  📡  CSI Real-time Streamer")
    print("=" * 55)

    streamer = CSIStreamer()

    if not streamer.connect():
        print("\n❌ ไม่สามารถเชื่อมต่อ ESP32 ได้")
        return

    # ตรวจสอบ ML Service
    try:
        resp = post_json(f"{ML_SERVICE_URL}/health", {})
        # health ไม่ใช่ POST แต่ใช้ GET
    except Exception:
        pass

    try:
        req  = urllib.request.Request(f"{ML_SERVICE_URL}/health")
        with urllib.request.urlopen(req, timeout=3) as r:
            health = json.loads(r.read())
            print(f"✅ ML Service: {health}")
    except Exception as e:
        print(f"⚠️  ML Service ไม่ตอบสนอง: {e}")
        print("   ตรวจสอบว่ารัน uvicorn อยู่ไหม")
        return

    try:
        streamer.run()
    except KeyboardInterrupt:
        pass
    finally:
        streamer.stop()
        print(f"\n\n📊 สรุป:")
        print(f"   Packets รับ : {streamer._pkt_count}")
        print(f"   Predictions : {streamer._pred_count}")
        print("👋 หยุดแล้ว\n")


if __name__ == "__main__":
    main()
