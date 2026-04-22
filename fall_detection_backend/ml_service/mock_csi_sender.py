"""
mock_csi_sender.py
==================
ส่ง CSI features ปลอมไปที่ Express API เพื่อทดสอบ flow end-to-end
โดยไม่ต้องใช้ ESP32 จริง

Usage:
    python mock_csi_sender.py              # ส่ง fall 1 ครั้ง
    python mock_csi_sender.py --no-fall    # ส่ง non-fall
    python mock_csi_sender.py --burst 5    # ส่ง fall 5 ครั้ง ห่างกัน 2 วิ
"""

import argparse
import json
import os
import sys
import time
import uuid
import numpy as np
import requests

API_URL   = os.getenv("API_URL", "http://localhost:3000/api/v1/predict")
API_KEY   = os.getenv("API_KEY", "dev-secret-key-123")
LOCATION  = os.getenv("LOCATION", "living_room")


def make_device_id() -> str:
    """สร้าง device_id ใหม่ทุกครั้ง เพื่อเลี่ยง cooldown ของ Express API
    รูปแบบ: esp32-mock-<8-char-hex>
    """
    return f"esp32-mock-{uuid.uuid4().hex[:8]}"

SEQ_LEN     = 10
N_FEATURES  = 416


def generate_fake_csi(is_fall: bool) -> list:
    """สร้าง CSI features ปลอม (seq_len, 416)
    - fall     : มี variance สูง (มีการเคลื่อนไหวแรง)
    - non_fall : variance ต่ำ (อยู่นิ่ง)
    """
    if is_fall:
        data = np.random.randn(SEQ_LEN, N_FEATURES) * 3.5 + 2.0
    else:
        data = np.random.randn(SEQ_LEN, N_FEATURES) * 0.3

    return data.astype(np.float32).tolist()


def send_event(is_fall: bool, index: int = 1, device_id: str = None):
    label = "FALL" if is_fall else "NON-FALL"
    device_id = device_id or make_device_id()

    print(f"\n{'=' * 60}")
    print(f"📡 [{index}] Sending mock {label} event...")
    print(f"{'=' * 60}")

    payload = {
        "device_id": device_id,
        "timestamp": int(time.time() * 1000),
        "location":  LOCATION,
        "features":  generate_fake_csi(is_fall),
    }

    print(f"  device_id : {payload['device_id']}")
    print(f"  location  : {payload['location']}")
    print(f"  features  : ({SEQ_LEN}, {N_FEATURES}) synthetic CSI")
    print(f"  → POST {API_URL}")

    try:
        r = requests.post(
            API_URL,
            json=payload,
            headers={"x-api-key": API_KEY, "Content-Type": "application/json"},
            timeout=10,
        )
    except requests.exceptions.ConnectionError:
        print(f"❌ Cannot reach {API_URL} — is Express API running?")
        sys.exit(1)

    print(f"\n  ← status  : {r.status_code}")
    try:
        body = r.json()
        print(f"  ← response:")
        print(json.dumps(body, indent=4, ensure_ascii=False))

        if body.get("is_fall"):
            print(f"\n🚨 FALL DETECTED — alert flow triggered")
        else:
            print(f"\n✅ Normal activity — monitoring")
    except ValueError:
        print(f"  ← body    : {r.text}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--no-fall", action="store_true", help="ส่ง non-fall แทน")
    p.add_argument("--burst",   type=int, default=1,  help="จำนวนครั้งที่ส่ง")
    p.add_argument("--delay",   type=float, default=2.0, help="หน่วงระหว่างครั้ง (วินาที)")
    p.add_argument("--device",  type=str, default=None,
                   help="ใช้ device_id คงที่ (ถ้าไม่ระบุจะสุ่มใหม่ทุกครั้ง เลี่ยง cooldown)")
    args = p.parse_args()

    is_fall = not args.no_fall

    print(f"🎯 Target   : {API_URL}")
    print(f"🎯 Device   : {args.device or '(auto-rotate per event)'}")
    print(f"🎯 Mode     : {'FALL' if is_fall else 'NON-FALL'} × {args.burst}")

    for i in range(1, args.burst + 1):
        send_event(is_fall, i, device_id=args.device)
        if i < args.burst:
            time.sleep(args.delay)

    print(f"\n{'=' * 60}")
    print(f"✨ Done — sent {args.burst} event(s)")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
