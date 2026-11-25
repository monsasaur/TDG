"""ยิงแจ้งเตือนเข้าแอปด้วยมือ — ใช้ตอน demo หรือเทสหน้าจอ โดยไม่ต้องมี ESP32

ยิงได้ 2 แบบ
  1) การล้ม      → POST /api/v1/demo/fire ของ Express (สร้าง fall_events + alerts + escalation)
  2) อุปกรณ์หลุด  → ตั้ง devices.status = 'disconnected' บน Supabase (แอปอ่านตรงจากตารางนี้)
     คืนสถานะด้วยแบบ 3 (connected)

ใช้ยังไง (ดับเบิลคลิก scripts/fire_noti.cmd ก็ได้ เป็นเมนูให้เลือก)
    python scripts/fire_noti.py                 # เมนู
    python scripts/fire_noti.py list            # ดูอุปกรณ์ทั้งหมด + สถานะ
    python scripts/fire_noti.py fall            # ล้ม (ใช้อุปกรณ์ตัวแรกที่ผูกกับบ้าน)
    python scripts/fire_noti.py fall --device ESP-HO-DEMO --location "ห้องนั่งเล่น"
    python scripts/fire_noti.py offline --device ESP-HO-DEMO
    python scripts/fire_noti.py online  --device ESP-HO-DEMO

ต้องมีอะไรก่อน
  - fall_detection_backend/express_api/.env ตั้ง SUPABASE_URL + SUPABASE_KEY (service_role)
    และคีย์ API (DEMO_API_KEY หรือ API_KEY) — สคริปต์อ่านไฟล์นี้เอง
  - แบบ "ล้ม" ต้องเปิด Express ไว้ก่อน:  cd fall_detection_backend/express_api && npm start

⚠️ ค่าใน .env ชี้ไปฐานข้อมูลไหน ก็ยิงเข้าฐานนั้นจริง ๆ (ตอนนี้คือฐานของทีม)
   เหตุการณ์ที่ยิงจะค้างอยู่ในประวัติจนกว่าจะลบออกเอง
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_FILE = os.path.join(ROOT, "fall_detection_backend", "express_api", ".env")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load_env() -> dict:
    """อ่าน .env ของ Express แบบง่าย ๆ (KEY=VALUE บรรทัดละตัว)"""
    if not os.path.exists(ENV_FILE):
        sys.exit(f"ไม่พบไฟล์ {ENV_FILE}\nสร้างก่อน แล้วใส่ SUPABASE_URL / SUPABASE_KEY / API_KEY")
    env = {}
    with open(ENV_FILE, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


ENV = load_env()
SUPABASE_URL = ENV.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = ENV.get("SUPABASE_KEY", "")
API_KEY = ENV.get("DEMO_API_KEY") or ENV.get("API_KEY") or ""
BASE = f"http://127.0.0.1:{ENV.get('PORT', '3000')}"


def request(method: str, url: str, headers: dict, body=None, timeout=30):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    if data is not None:
        headers = {**headers, "Content-Type": "application/json; charset=utf-8"}
    req = urllib.request.Request(url, data, headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            text = r.read().decode("utf-8", "replace")
            status = r.status
    except urllib.error.HTTPError as e:
        text, status = e.read().decode("utf-8", "replace"), e.code
    except Exception as e:  # ต่อไม่ติด
        return 0, f"{type(e).__name__}: {e}"
    try:
        return status, json.loads(text)
    except ValueError:
        return status, text


def sb(method: str, path: str, body=None, prefer: str = "return=representation"):
    if not SUPABASE_URL or not SUPABASE_KEY:
        sys.exit("ยังไม่ได้ตั้ง SUPABASE_URL / SUPABASE_KEY ใน express_api/.env")
    headers = {"apikey": SUPABASE_KEY, "Authorization": f"Bearer {SUPABASE_KEY}", "Prefer": prefer}
    return request(method, f"{SUPABASE_URL}/rest/v1/{path}", headers, body)


def devices() -> list:
    status, rows = sb("GET", "devices?select=code,name,status,house_id,houses(name)&order=code")
    if status != 200 or not isinstance(rows, list):
        sys.exit(f"อ่านรายการอุปกรณ์ไม่ได้ ({status}): {rows}")
    return rows


def show_devices(rows=None) -> list:
    rows = rows if rows is not None else devices()
    print(f"{'#':<3}{'รหัสอุปกรณ์':<16}{'สถานะ':<14}บ้าน · ชื่ออุปกรณ์")
    for i, d in enumerate(rows, 1):
        house = (d.get("houses") or {}).get("name") or "— ยังไม่ผูกบ้าน —"
        print(f"{i:<3}{d['code']:<16}{d.get('status') or '-':<14}{house} · {d.get('name') or '-'}")
    return rows


def pick(code: str | None, rows=None) -> dict:
    rows = rows if rows is not None else devices()
    if code:
        for d in rows:
            if d["code"].lower() == code.lower():
                return d
        sys.exit(f"ไม่มีอุปกรณ์รหัส {code} ในฐานข้อมูล (ดูรายการด้วย: python scripts/fire_noti.py list)")
    linked = [d for d in rows if d.get("house_id")]
    if not linked:
        sys.exit("ยังไม่มีอุปกรณ์ที่ผูกกับบ้าน — เพิ่มอุปกรณ์ในแอปก่อน ไม่งั้นแจ้งเตือนจะไม่ขึ้นในแอป")
    return linked[0]


def fire_fall(code: str | None, location: str):
    """แจ้งเตือนการล้ม — ผ่าน Express เพื่อให้ได้ครบทั้งการ์ด นับถอยหลัง และ escalation"""
    status, _ = request("GET", f"{BASE}/health", {}, timeout=5)
    if status != 200:
        sys.exit(f"ต่อ Express ที่ {BASE} ไม่ได้ — เปิดก่อนด้วย:\n"
                 "  cd fall_detection_backend/express_api && npm start")

    d = pick(code)
    house = (d.get("houses") or {}).get("name") or "— ยังไม่ผูกบ้าน —"
    status, res = request("POST", f"{BASE}/api/v1/demo/fire", {"x-api-key": API_KEY},
                          {"device_id": d["code"], "location": location})
    if status != 200:
        sys.exit(f"ยิงไม่สำเร็จ ({status}): {res}")
    if isinstance(res, dict) and res.get("action") == "cooldown":
        print(f"⏳ {d['code']} ติด cooldown อยู่ — รอให้ครบเวลาแล้วยิงใหม่ (ไม่มีเหตุการณ์ใหม่ถูกสร้าง)")
        return
    print(f"🚨 ยิงการล้มแล้ว — บ้าน {house} · อุปกรณ์ {d['code']} · บริเวณ {location}")
    print(f"   event_id = {res.get('event_id')} · รอรับทราบ {res.get('ack_timeout_seconds')} วินาที")
    print("   การ์ดจะขึ้นในแอปภายใน ~10 วินาที · ไม่กดรับทราบทันเวลาจะขึ้น 'โทรออกแล้ว'")


def set_status(code: str | None, value: str):
    """แจ้งเตือนอุปกรณ์ — แอปอ่าน devices.status ตรง ๆ (data/useSystemAlerts.ts)"""
    d = pick(code)
    house = (d.get("houses") or {}).get("name") or "— ยังไม่ผูกบ้าน —"
    status, res = sb("PATCH", f"devices?code=eq.{d['code']}", {"status": value})
    if status not in (200, 204):
        sys.exit(f"แก้สถานะไม่สำเร็จ ({status}): {res}")
    if value == "disconnected":
        print(f"📵 ตั้งให้ {d['code']} (บ้าน {house}) เป็น 'ขาดการเชื่อมต่อ' แล้ว")
        print("   ดูที่แท็บ 'แจ้งเตือนระบบ' ในแอป (เปิดแท็บใหม่อีกครั้งถ้ายังไม่ขึ้น)")
        print(f"   คืนสถานะ: python scripts/fire_noti.py online --device {d['code']}")
    else:
        print(f"✅ คืนสถานะ {d['code']} (บ้าน {house}) เป็น 'เชื่อมต่อแล้ว' — การแจ้งเตือนระบบจะหายไป")


def menu():
    rows = show_devices()
    print()
    print("1) ยิงแจ้งเตือน 'มีคนล้ม'")
    print("2) ยิงแจ้งเตือน 'อุปกรณ์ขาดการเชื่อมต่อ'")
    print("3) คืนสถานะอุปกรณ์เป็น 'เชื่อมต่อแล้ว'")
    print("0) ออก")
    choice = input("เลือก: ").strip()
    if choice == "0" or not choice:
        return
    if choice not in {"1", "2", "3"}:
        print("ไม่มีตัวเลือกนี้")
        return

    raw = input("เลือกอุปกรณ์ (เลขลำดับ หรือ Enter = ตัวแรกที่ผูกบ้าน): ").strip()
    code = None
    if raw:
        if raw.isdigit() and 1 <= int(raw) <= len(rows):
            code = rows[int(raw) - 1]["code"]
        else:
            code = raw

    if choice == "1":
        location = input("บริเวณที่ล้ม (Enter = ห้องนั่งเล่น): ").strip() or "ห้องนั่งเล่น"
        fire_fall(code, location)
    elif choice == "2":
        set_status(code, "disconnected")
    else:
        set_status(code, "connected")


def main():
    p = argparse.ArgumentParser(description="ยิงแจ้งเตือนเข้าแอปด้วยมือ (ล้ม / อุปกรณ์หลุด)")
    p.add_argument("action", nargs="?", choices=["fall", "offline", "online", "list"],
                   help="ไม่ใส่ = เปิดเมนู")
    p.add_argument("--device", help="รหัสอุปกรณ์ เช่น ESP-HO-DEMO (ไม่ใส่ = ตัวแรกที่ผูกกับบ้าน)")
    p.add_argument("--location", default="ห้องนั่งเล่น", help="บริเวณที่ล้ม (ใช้กับ fall)")
    args = p.parse_args()

    if args.action is None:
        menu()
    elif args.action == "list":
        show_devices()
    elif args.action == "fall":
        fire_fall(args.device, args.location)
    elif args.action == "offline":
        set_status(args.device, "disconnected")
    else:
        set_status(args.device, "connected")


if __name__ == "__main__":
    main()
