"""
collect_data.py
===============
เก็บ CSI Data จาก ESP32 พร้อม interactive menu, progress bar และหยุดอัตโนมัติ

วิธีใช้:
  python data_collection/collect_data.py
"""

import socket
import csv
import time
import os
import threading
from datetime import datetime

# =================== Config ===================
UDP_HOST           = "0.0.0.0"
UDP_PORT           = 5500
BUFFER_SIZE        = 4096

PACKETS_PER_SAMPLE = 400   # pkts ต่อ sample (ทุกท่าเท่ากัน)
COUNTDOWN          = 2     # นับถอยหลังก่อนเริ่มเก็บ

# =================== เมนู ===================
ACTIVITIES = [
    # (label,       ชื่อแสดงผล,           default samples)
    ("fall",        "ล้มไปข้างหน้า",        100),
    ("fall",        "ล้มไปข้างหลัง",        100),
    ("fall",        "ล้มไปข้างๆ",           100),
    ("fall",        "สดุดล้ม",         100),
    ("non_fall",    "ยืนนิ่ง",               80),
    ("non_fall",    "เดิน",                  80),
    ("non_fall",    "ก้มเก็บของ",            80),
    ("non_fall",    "นอนลงบนพื้น",           80),
    ("non_fall",    "สะดุดแต่ไม่ล้ม",        80),
]

# =================== Path ===================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR  = os.path.join(BASE_DIR, "data", "raw")
os.makedirs(RAW_DIR, exist_ok=True)


# =================== Helpers ===================
def progress_bar(current, total, width=40):
    pct  = current / total
    done = int(pct * width)
    bar  = "█" * done + "░" * (width - done)
    print(f"\r  [{bar}] {current}/{total} pkts", end="", flush=True)


def countdown(seconds):
    for i in range(seconds, 0, -1):
        print(f"\r  ⏳ เริ่มใน {i} วิ...  ", end="", flush=True)
        time.sleep(1)
    print(f"\r  🔴 กำลังบันทึก...      ", flush=True)


# =================== Connect ===================
def connect_esp32():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_HOST, UDP_PORT))
    sock.settimeout(2.0)

    print(f"\n  📡 รอ ESP32 ที่ port {UDP_PORT}...")
    for _ in range(15):
        try:
            _, addr = sock.recvfrom(BUFFER_SIZE)
            print(f"  ✅ ESP32 IP: {addr[0]}\n")
            return sock
        except socket.timeout:
            print("  ⏳ รอ...", end="\r")

    print("  ❌ ไม่พบ ESP32")
    sock.close()
    return None


# =================== Collect One Sample ===================
def collect_sample(sock, label, activity_name, sample_num, total):
    target = PACKETS_PER_SAMPLE

    print(f"\n  📍 [{activity_name}]  Sample {sample_num}/{total}  (ตัดเหลือ {target} pkts)")
    input("  กด Enter เพื่อเริ่มบันทึก...")
    countdown(COUNTDOWN)
    print("  กด Enter เพื่อหยุด")

    packets    = []
    start_time = time.time()
    stop_flag  = threading.Event()

    def wait_for_enter():
        input()
        stop_flag.set()

    def timer_display():
        while not stop_flag.is_set():
            elapsed = int(time.time() - start_time)
            pct  = min(len(packets) / target, 1.0)
            done = int(pct * 30)
            bar  = "█" * done + "░" * (30 - done)
            print(f"\r  🔴 {elapsed} วิ   [{bar}] {len(packets):3d} pkts", end="", flush=True)
            time.sleep(0.1)

    threading.Thread(target=wait_for_enter, daemon=True).start()
    threading.Thread(target=timer_display, daemon=True).start()

    while not stop_flag.is_set():
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            line    = data.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" not in line:
                continue
            packets.append({
                "timestamp": datetime.now().isoformat(),
                "label":     label,
                "raw":       line,
            })
        except socket.timeout:
            pass

    stop_flag.set()
    print(f"\n  รับมา {len(packets)} pkts")

    confirm = input("  บันทึก sample นี้ไหม? (y/n): ").strip().lower()
    if confirm != "y":
        print("  ⏭️  ข้ามไป — ไม่บันทึก")
        return False

    # บันทึก CSV
    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = activity_name.replace(" ", "_")
    filename  = f"{label}_{safe_name}_{ts}_{sample_num:03d}.csv"
    filepath  = os.path.join(RAW_DIR, filename)

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "label", "raw"])
        writer.writeheader()
        writer.writerows(packets)

    print(f"  ✅ บันทึก → {filename}")
    return True


# =================== Count Existing Samples ===================
def count_samples(activity_name):
    safe_name = activity_name.replace(" ", "_")
    return len([f for f in os.listdir(RAW_DIR) if safe_name in f and f.endswith(".csv")])


# =================== Show Menu ===================
def show_menu():
    print("\n" + "=" * 60)
    print("  🎯  เลือกท่าที่ต้องการเก็บ (เว้นวรรคคั่น เช่น 1 2 3)")
    print("  'all' = เก็บทั้งหมด  |  'q' = ออก")
    print("=" * 60)

    print("  ── 🔴 Fall (เป้า 500 samples) ──")
    for i, (label, name, default) in enumerate(ACTIVITIES, 1):
        if label == "fall":
            have = count_samples(name)
            bar  = "█" * min(have * 20 // default, 20)
            print(f"  {i:2d}. {name:<22} {have:3d}/{default}  [{bar:<20}]")

    print("  ── 🟢 Non-fall (เป้า 500 samples) ──")
    for i, (label, name, default) in enumerate(ACTIVITIES, 1):
        if label == "non_fall":
            have = count_samples(name)
            bar  = "█" * min(have * 20 // default, 20)
            print(f"  {i:2d}. {name:<22} {have:3d}/{default}  [{bar:<20}]")

    print("=" * 60)


# =================== Main ===================
def main():
    print("=" * 60)
    print("  📡  CSI Data Collector")
    print(f"  ทุกท่า   : {PACKETS_PER_SAMPLE} pkts/sample")
    print(f"  Output   : {RAW_DIR}")
    print("=" * 60)

    sock = connect_esp32()
    if sock is None:
        return

    while True:
        show_menu()
        choice = input("\n  เลือก: ").strip().lower()

        if choice in ("q", "quit", "exit"):
            break
        elif choice == "all":
            selected = list(range(len(ACTIVITIES)))
        else:
            try:
                selected = [int(x) - 1 for x in choice.split()]
                if any(i < 0 or i >= len(ACTIVITIES) for i in selected):
                    print("  ❌ เลขไม่ถูกต้อง")
                    continue
            except ValueError:
                print("  ❌ กรุณากรอกตัวเลข")
                continue

        # ถามจำนวน samples แต่ละท่า
        custom_counts = {}
        for i in selected:
            label, name, default = ACTIVITIES[i]
            try:
                n = input(f"  จำนวน samples '{name}' (Enter = {default}): ").strip()
                custom_counts[i] = int(n) if n else default
            except ValueError:
                custom_counts[i] = default

        # สรุปก่อนเริ่ม
        print("\n" + "=" * 60)
        print("  📋 สรุปการเก็บ:")
        total_samples = 0
        for i in selected:
            label, name, _ = ACTIVITIES[i]
            n   = custom_counts[i]
            tag = "🔴" if label == "fall" else "🟢"
            total_samples += n
            print(f"    {tag} {name:<22} {n} samples")
        est_min = total_samples * COUNTDOWN / 60
        print(f"\n  รวม {total_samples} samples  (~{est_min:.0f} นาที)")
        print("=" * 60)

        confirm = input("  เริ่มเลยไหม? (y/n): ").strip().lower()
        if confirm != "y":
            continue

        # เริ่มเก็บ
        back_to_menu = False
        for i in selected:
            if back_to_menu:
                break
            label, name, _ = ACTIVITIES[i]
            n_samples = custom_counts[i]
            saved = 0
            s = 1

            print(f"\n  ━━━ {name} ━━━")

            try:
                while True:
                    ok = collect_sample(sock, label, name, s, total="?")
                    if ok:
                        saved += 1
                        s += 1

                    print(f"\n  ได้ {saved} samples แล้ว")
                    print("  [c] เก็บต่อ  |  [m] กลับเมนู")
                    nxt = input("  เลือก: ").strip().lower()
                    if nxt == "m":
                        back_to_menu = True
                        break
            except KeyboardInterrupt:
                print(f"\n  ⛔ หยุด — ได้ {saved} samples")
                back_to_menu = True

            print(f"  ✅ '{name}' ได้ {saved} samples")

        print("\n  🎉 เสร็จแล้ว!")

    sock.close()
    print("\n  👋 ปิดโปรแกรมแล้ว\n")


if __name__ == "__main__":
    main()