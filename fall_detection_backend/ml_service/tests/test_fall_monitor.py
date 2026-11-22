"""กฎ "ล้มแล้วนิ่ง" ของ data_collection/fall_monitor.py — ใช้โมเดลปลอมกับสัญญาณสังเคราะห์ ทดสอบเฉพาะตรรกะ ไม่ใช่ความแม่น"""
import importlib.util
import os

import numpy as np

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("fall_monitor", os.path.join(BASE, "data_collection", "fall_monitor.py"))
FM = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(FM)


class FakeModel:
    """คะแนนล้มสูงตลอด — ให้ทุกกรอบผ่าน threshold เพื่อทดสอบช่วงหลังตรวจพบ"""
    classes_ = np.array([0, 1])

    def predict_proba(self, X):
        return np.tile([0.1, 0.9], (len(X), 1))


def _run(moving_after, stay_still=1.0, seconds=9.0):
    rng = np.random.default_rng(0)
    sent = []
    mon = FM.Monitor({"model": FakeModel()}, threshold=0.4, confirm=2,
                     sender=lambda x, p: sent.append(p) or "ok", log_path=None, quiet=True,
                     stay_still=stay_still, still_threshold=0.43, still_fraction=0.8)
    n = int(seconds * 100)
    for i in range(1, n + 1):
        an = 1.0 + 0.01 * rng.standard_normal(52)
        if moving_after and i > 500:                     # ช่วงหลัง "ตรวจพบ" ยังขยับต่อ (เหมือนเดิน)
            an = an + 0.08 * np.sin(2 * np.pi * i / 100 + np.arange(52))
        mon.add((an, an * 20, -45), i / 100, i)
    return mon, sent


def test_still_after_detection_fires_once():
    mon, sent = _run(moving_after=False)
    assert len(sent) == 1
    assert len(mon.detections) == 1 and not mon.cancelled


def test_moving_after_detection_is_cancelled():
    mon, sent = _run(moving_after=True)
    assert sent == []
    assert mon.detections == [] and len(mon.cancelled) >= 1


def test_without_rule_fires_immediately():
    mon, sent = _run(moving_after=True, stay_still=0.0)
    assert len(sent) == 1 and not mon.cancelled


class SequenceModel:
    """คะแนนล้มตามลำดับที่กำหนด ทีละกรอบ"""
    classes_ = np.array([0, 1])

    def __init__(self, probs):
        self.probs = list(probs)

    def predict_proba(self, X):
        p = self.probs.pop(0)
        return np.array([[1 - p, p]])


def _feed(mon, packets, seed=0):
    rng = np.random.default_rng(seed)
    for i in range(1, packets + 1):
        an = 1.0 + 0.01 * rng.standard_normal(52)
        mon.add((an, an * 20, -45), i / 100, i)


def test_window_and_features_follow_the_model_bundle():
    """โมเดลรุ่น 2 (ค่าเริ่มต้น) ใช้กรอบ 492 · โมเดลเก่าที่เก็บชื่อเต็ม app.event_features.stream_feature_vector ยังใช้ได้"""
    new = FM.Monitor({"model": FakeModel()}, 0.4, 2, None, None, quiet=True)
    assert new.window == FM.AF.WINDOW_V2 == 492 and new.fv is FM.AF.feature_vector_v2
    old = FM.Monitor({"model": FakeModel(), "feature_fn": "app.event_features.stream_feature_vector", "window": 472},
                     0.4, 2, None, None, quiet=True)
    assert old.window == 472 and old.fv is FM.AF.stream_feature_vector
    _feed(old, 600)
    assert old.n_windows > 0


def test_smoothing_sends_the_window_with_the_highest_raw_score():
    """เฉลี่ย 3 กรอบผ่าน threshold แต่กรอบล่าสุดไม่ผ่าน → ต้องส่งกรอบที่คะแนนดิบสูงสุด ไม่ใช่กรอบล่าสุด"""
    sent = []
    probs = [0.1] * 20 + [0.9, 0.6, 0.2] + [0.1] * 40
    mon = FM.Monitor({"model": SequenceModel(probs)}, threshold=0.5, confirm=2,
                     sender=lambda x, p: sent.append(x.copy()) or "ok", log_path=None, quiet=True, smooth=3)
    seen = []
    orig = mon.fv
    mon.fv = lambda *a: seen.append(orig(*a)) or seen[-1]
    _feed(mon, mon.window + 25 * (len(probs) - 1), seed=1)       # ครบทุกคะแนนพอดี กรอบละ 25 packet
    assert len(sent) == 1
    # เฉลี่ยของ (0.9, 0.6, 0.2) = 0.57 ≥ 0.5 ที่กรอบของ 0.2 → ส่งกรอบของ 0.9 (ลำดับที่ 21)
    assert np.allclose(sent[0], seen[20])


def test_feature_vector_v2_shape_and_prefix():
    rng = np.random.default_rng(2)
    n = FM.AF.WINDOW_V2
    An = 1.0 + 0.02 * rng.standard_normal((n, 52))
    Ar = An * 20
    R = rng.integers(-46, -40, n)
    v = FM.AF.feature_vector_v2(An, Ar, R, FM.AF.PRE)
    assert v.shape == (len(FM.AF.KEYS_V2),) == (39,) and np.all(np.isfinite(v))
    assert np.allclose(v[:18], FM.AF.feature_vector(An, Ar, R, FM.AF.PRE))


def test_sender_posts_in_background_without_blocking():
    """ส่งเข้า Express ในเธรดเบื้องหลัง — server ตอบช้า (เหมือน Render แผนฟรีกำลังตื่น) ตัวตรวจต้องไม่ค้าง"""
    import http.server
    import json
    import threading
    import time

    got = {}
    done = threading.Event()

    class Slow(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            got["key"] = self.headers.get("x-api-key")
            got["body"] = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            time.sleep(0.5)
            out = json.dumps({"action": "awaiting_acknowledge", "is_fall": True}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(out)))
            self.end_headers()
            self.wfile.write(out)
            done.set()

        def log_message(self, *a):
            pass

    srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Slow)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    try:
        send = FM.make_sender(f"http://127.0.0.1:{srv.server_address[1]}", "k123", "ESP-TEST", "ห้อง", timeout=5)
        t0 = time.time()
        msg = send(np.arange(39, dtype=float), 0.9)
        assert time.time() - t0 < 0.3 and "กำลังส่ง" in msg
        assert done.wait(5)
        assert got["key"] == "k123" and got["body"]["device_id"] == "ESP-TEST"
        assert len(got["body"]["features"][0]) == 39
    finally:
        srv.shutdown()
