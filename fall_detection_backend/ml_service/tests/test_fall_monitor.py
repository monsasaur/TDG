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
