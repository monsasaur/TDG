"""
csi_streamer.py
===============
รับ CSI UDP จาก ESP32 → แปลงเป็น features → ส่งไป ML Service predict
พร้อม real-time graph แสดง fall probability

Flow:
  ESP32 → UDP:5500 → CSIBuffer → HTTP POST → ML Service:8000/predict

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
from collections import deque

# เพิ่ม path สำหรับ import app.preprocess
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.preprocess import CSIBuffer

import matplotlib
matplotlib.use("macosx")
import matplotlib.pyplot as plt
import matplotlib.animation as animation

# =================== Config ===================
UDP_HOST        = "0.0.0.0"
UDP_PORT        = 5500
BUFFER_SIZE     = 4096

ML_SERVICE_URL  = os.getenv("ML_SERVICE_URL",  "http://localhost:8000")
PREDICT_INTERVAL = 0.5  # วินาที

RT_STRIDE = 50   # ตรงกับ training

# Debounce
FALL_CONFIRM   = 5   # ต้อง FALL 5 ครั้งติด (~2.5 วิ) ถึงยืนยัน
NORMAL_CONFIRM = 5

# Graph
GRAPH_HISTORY  = 120  # แสดงผลล่าสุดกี่จุด (~60 วินาที ที่ 0.5 วิ/ครั้ง)


# =================== HTTP helpers ===================
def post_json(url, data: dict) -> dict:
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req  = urllib.request.Request(url, data=body,
                                   headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read().decode())


def predict_ml(features: list) -> dict:
    return post_json(f"{ML_SERVICE_URL}/predict", {"features": features})


# =================== Streamer ===================
class CSIStreamer:
    def __init__(self):
        self.buf            = CSIBuffer(stride=RT_STRIDE)
        self._sock          = None
        self._running       = False
        self._last_pred     = 0
        self._lock          = threading.Lock()
        self._pkt_count     = 0
        self._pred_count    = 0
        # Debounce state
        self._confirmed_fall = False
        self._fall_streak    = 0
        self._normal_streak  = 0
        # Graph data (thread-safe via _lock)
        self._timestamps     = deque(maxlen=GRAPH_HISTORY)
        self._fall_probs     = deque(maxlen=GRAPH_HISTORY)
        self._confirmed      = deque(maxlen=GRAPH_HISTORY)  # True/False
        self._start_time     = time.time()

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

    def _udp_loop(self):
        """Thread: รับ UDP + predict"""
        self._sock.settimeout(1.0)
        while self._running:
            try:
                data, _ = self._sock.recvfrom(BUFFER_SIZE)
                line = data.decode("utf-8", errors="ignore").strip()

                if "CSI_DATA" not in line:
                    continue

                with self._lock:
                    self.buf.add_packet(line)
                    self._pkt_count += 1

                # Predict
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
            except Exception as e:
                print(f"\n⚠️  Error: {e}")

    def _do_predict(self, features: list):
        try:
            result = predict_ml(features)

            raw_fall  = result.get("is_fall", False)
            conf      = result.get("confidence", 0)
            fall_prob = conf if raw_fall else (1.0 - conf)
            self._pred_count += 1

            # Debounce
            if raw_fall:
                self._fall_streak += 1
                self._normal_streak = 0
                if self._fall_streak >= FALL_CONFIRM:
                    self._confirmed_fall = True
            else:
                self._normal_streak += 1
                self._fall_streak = 0
                if self._normal_streak >= NORMAL_CONFIRM:
                    self._confirmed_fall = False

            # เก็บ data สำหรับ graph
            with self._lock:
                self._timestamps.append(time.time() - self._start_time)
                self._fall_probs.append(fall_prob)
                self._confirmed.append(self._confirmed_fall)

            # Terminal output
            status = "🔴 FALL" if self._confirmed_fall else "🟢 ปกติ"
            print(f"\r  [{self._pred_count}] {status}  fall_prob={fall_prob:.0%}  conf={conf:.0%}        ", end="", flush=True)

        except Exception as e:
            print(f"\n  ❌ Predict error: {e}")

    def get_graph_data(self):
        with self._lock:
            return (
                list(self._timestamps),
                list(self._fall_probs),
                list(self._confirmed),
            )

    def run_with_graph(self):
        """เริ่ม UDP thread + matplotlib graph บน main thread"""
        self._running    = True
        self._start_time = time.time()

        print(f"\n🚀 Streaming + Graph เริ่มแล้ว")
        print(f"   ML Service : {ML_SERVICE_URL}")
        print(f"   Stride     : {RT_STRIDE} (buffer {200 + 9 * RT_STRIDE} pkts)")
        print(f"   Debounce   : FALL={FALL_CONFIRM}x, ปกติ={NORMAL_CONFIRM}x\n")

        # เริ่ม UDP thread
        udp_thread = threading.Thread(target=self._udp_loop, daemon=True)
        udp_thread.start()

        # =================== Matplotlib ===================
        fig, ax = plt.subplots(figsize=(12, 4))
        fig.canvas.manager.set_window_title("CSI Fall Detection — Real-time")
        ax.set_ylim(-0.05, 1.05)
        ax.set_xlabel("Time (s)")
        ax.set_ylabel("Fall Probability")
        ax.set_title("Real-time Fall Detection")

        line_prob, = ax.plot([], [], "b-", linewidth=1.5, label="Fall prob")
        threshold_line = ax.axhline(y=0.55, color="orange", linestyle="--", alpha=0.7, label="Threshold (0.55)")
        fill_fall = None

        ax.legend(loc="upper right")
        ax.grid(True, alpha=0.3)

        def update(frame):
            nonlocal fill_fall
            ts, probs, confirmed = self.get_graph_data()
            if not ts:
                return (line_prob,)

            line_prob.set_data(ts, probs)
            ax.set_xlim(max(0, ts[-1] - 60), ts[-1] + 2)

            # แสดงพื้นหลังสีแดงตอน confirmed fall
            if fill_fall:
                fill_fall.remove()
                fill_fall = None

            # หา fall regions
            i = 0
            while i < len(confirmed):
                if confirmed[i]:
                    start = ts[i]
                    while i < len(confirmed) and confirmed[i]:
                        i += 1
                    end = ts[i - 1]
                    fill_fall = ax.axvspan(start, end, alpha=0.2, color="red", label="_")
                else:
                    i += 1

            fig.canvas.draw_idle()
            return (line_prob,)

        ani = animation.FuncAnimation(fig, update, interval=300, blit=False, cache_frame_data=False)

        try:
            plt.tight_layout()
            plt.show()
        except KeyboardInterrupt:
            pass
        finally:
            self._running = False
            udp_thread.join(timeout=2)

    def stop(self):
        self._running = False
        if self._sock:
            self._sock.close()


# =================== Main ===================
def main():
    print("=" * 55)
    print("  📡  CSI Real-time Streamer + Graph")
    print("=" * 55)

    streamer = CSIStreamer()

    if not streamer.connect():
        print("\n❌ ไม่สามารถเชื่อมต่อ ESP32 ได้")
        return

    # ตรวจสอบ ML Service
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
        streamer.run_with_graph()
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