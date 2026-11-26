"""เก็บภาพป๊อปอัปทุกอันในแอปไว้ตรวจ UI ทีเดียวจบ

ทำอะไร
  เปิดหน้า /dev-popups ในแอป (Expo Go บน emulator) แล้วไล่กดทีละรายการ
  ถ่ายหน้าจอเก็บไว้ที่ docs/ui-popups/ แล้วปิดป๊อปอัปไปอันถัดไป

ต้องมีก่อน
  - emulator เปิดอยู่ + Metro รันอยู่ (npx expo start --offline --port 8081)
  - adb reverse tcp:8081 tcp:8081

ใช้ยังไง
    python scripts/shoot_popups.py              # เก็บทุกอัน
    python scripts/shoot_popups.py leave-house  # เก็บเฉพาะที่ชื่อขึ้นต้นตามนี้
    python scripts/shoot_popups.py --list       # ดูว่ามีอะไรบ้าง ไม่ถ่าย

ไฟล์ภาพตั้งชื่อตาม key ในหน้า dev-popups เช่น docs/ui-popups/01-leave-house.png
"""

import os
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "docs", "ui-popups")
ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
APP = "host.exp.exponent"
DEEP_LINK = "exp://127.0.0.1:8081/--/dev-popups"

# ปุ่มที่ใช้ปิดป๊อปอัป ไล่ตามลำดับนี้
CLOSE_LABELS = ["ยกเลิก", "ปิด", "ตกลง", "พิมพ์รหัสเอง"]

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def adb(*args, binary=False, timeout=60):
    r = subprocess.run([ADB, *args], capture_output=True, timeout=timeout)
    return r.stdout if binary else r.stdout.decode("utf-8", "replace")


def dump():
    """อ่านผังหน้าจอปัจจุบัน — คืน list ของ (desc, text, (x, y), clickable)"""
    for _ in range(4):
        out = adb("shell", "uiautomator dump /sdcard/u.xml >/dev/null 2>&1; cat /sdcard/u.xml; rm /sdcard/u.xml")
        i = out.find("<?xml")
        if i >= 0:
            nodes = []
            for e in ET.fromstring(out[i:].strip().encode()).iter("node"):
                b = list(map(int, re.findall(r"\d+", e.get("bounds", "[0,0][0,0]"))))
                center = ((b[0] + b[2]) // 2, (b[1] + b[3]) // 2)
                nodes.append((e.get("content-desc", ""), e.get("text", ""), center, e.get("clickable") == "true"))
            return nodes
        time.sleep(1)
    raise SystemExit("อ่านหน้าจอไม่ได้ — emulator เปิดอยู่ไหม")


def tap(point):
    adb("shell", f"input tap {point[0]} {point[1]}")
    time.sleep(1.2)


def open_gallery():
    adb("shell", "am", "start", "-a", "android.intent.action.VIEW", "-d", DEEP_LINK, APP)
    for _ in range(20):
        time.sleep(2)
        nodes = dump()
        if any(d.startswith("popup:") for d, *_ in nodes):
            return
        # มีป๊อปอัปค้างจากรอบก่อน (deep link ไม่ปิดให้) — ปิดก่อนแล้วค่อยดูใหม่
        if any((t or d) in CLOSE_LABELS for d, t, *_ in nodes):
            close_popup()
    raise SystemExit("เปิดหน้า /dev-popups ไม่ได้ — ตรวจว่า Metro รันอยู่และ adb reverse แล้ว")


def popup_rows():
    """รายการในหน้า dev-popups — key กับจุดที่ต้องกด"""
    rows = []
    for desc, _text, point, _click in dump():
        if desc.startswith("popup:"):
            rows.append((desc[len("popup:"):], point))
    return rows


def close_popup():
    for desc, text, point, click in dump():
        label = text or desc
        if click and label in CLOSE_LABELS:
            tap(point)
            return True
    # ไม่เจอปุ่ม — กดปุ่มย้อนกลับของเครื่องแทน
    adb("shell", "input keyevent 4")
    time.sleep(1)
    return False


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    only = args[0] if args else None

    os.makedirs(OUT_DIR, exist_ok=True)
    open_gallery()

    if "--list" in sys.argv:
        for key, _ in popup_rows():
            print(key)
        print("(เลื่อนหน้าจอลงถ้ายังมีมากกว่านี้)")
        return

    done: list[str] = []
    stuck = 0
    while stuck < 3:
        time.sleep(0.8)  # รอหน้าจอนิ่งก่อนอ่านผัง (ป๊อปอัปเพิ่งปิดไป)
        rows = popup_rows()
        if not rows:
            # ยังมีป๊อปอัปค้างอยู่ ปิดก่อน
            if close_popup():
                continue
        todo = [(k, p) for k, p in rows if k not in done]
        if not todo:
            # เลื่อนหารายการที่ยังไม่ได้ถ่าย
            adb("shell", "input swipe 540 1700 540 800 300")
            time.sleep(1.2)
            stuck += 1
            continue
        stuck = 0
        for key, point in todo:
            done.append(key)
            if only and not key.startswith(only):
                continue
            tap(point)
            time.sleep(0.8)
            path = os.path.join(OUT_DIR, f"{len(done):02d}-{key}.png")
            with open(path, "wb") as f:
                f.write(adb("exec-out", "screencap", "-p", binary=True))
            print(f"เก็บแล้ว {os.path.relpath(path, ROOT)}")
            close_popup()

    print()
    print(f"รวม {len(done)} ป๊อปอัป ภาพอยู่ใน {os.path.relpath(OUT_DIR, ROOT)}")


if __name__ == "__main__":
    main()
