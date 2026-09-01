"""
csi_collector_serial.py
========================
เก็บ CSI Data จาก ESP32 ผ่าน USB Serial (ไม่ใช่ UDP)
พร้อม interactive menu, progress bar และหยุดอัตโนมัติ

วิธีใช้:
  pip install pyserial
  python data_collection/csi_collector_serial.py

ESP32 ต้อง flash firmware version ที่ส่ง CSI ออก serial (active_ap AP-only)
"""

import serial
import serial.tools.list_ports
import csv
import json
import random
import time
import os
import threading
import glob
from datetime import datetime

# =================== Config ===================
SERIAL_PORT  = None    # None = auto-detect; หรือ "/dev/cu.usbserial-0001"
BAUDRATE     = 921600  # ต้องตรงกับ firmware (sdkconfig CONFIG_ESP_CONSOLE_UART_BAUDRATE)
                       # active_ap/sdkconfig:1630 = 921600 · esp_checker.py ก็ใช้ค่านี้
READ_TIMEOUT = 1.0

PACKETS_PER_SAMPLE = 400
COUNTDOWN          = 2

# =================== เมนู ===================
ACTIVITIES = [
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
BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR      = os.path.join(BASE_DIR, "data", "raw")
SESSION_DIR  = os.path.join(BASE_DIR, "data", "sessions")
os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(SESSION_DIR, exist_ok=True)


# =================== Helpers ===================
def countdown(seconds):
    for i in range(seconds, 0, -1):
        print(f"\r  ⏳ เริ่มใน {i} วิ...  ", end="", flush=True)
        time.sleep(1)
    print(f"\r  🔴 กำลังบันทึก...      ", flush=True)


def auto_detect_port():
    candidates = sorted(glob.glob("/dev/cu.usbserial-*") + glob.glob("/dev/cu.SLAB_*") + glob.glob("/dev/cu.wchusbserial*"))
    if candidates:
        return candidates[0]
    return None


# =================== Connect ===================
def connect_esp32():
    port = SERIAL_PORT or auto_detect_port()
    if port is None:
        print("  ❌ ไม่พบ USB serial port")
        print("     ลอง: ls /dev/cu.usbserial-*")
        return None

    print(f"\n  📡 เปิด serial: {port} @ {BAUDRATE} baud")
    try:
        ser = serial.Serial(port, BAUDRATE, timeout=READ_TIMEOUT)
    except serial.SerialException as e:
        print(f"  ❌ เปิด serial ไม่ได้: {e}")
        return None

    # รอ CSI_DATA แรก
    print("  ⏳ รอ CSI_DATA จาก ESP32...")
    start = time.time()
    while time.time() - start < 15:
        try:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
        except Exception:
            continue
        if "CSI_DATA" in line:
            print(f"  ✅ CSI ไหลแล้ว ({port})\n")
            return ser

    print("  ❌ ไม่ได้รับ CSI_DATA ใน 15 วิ")
    print("     เช็ค: 1) ESP32 #1 flash firmware ใหม่หรือยัง")
    print("           2) ESP32 #2 จ่ายไฟอยู่ไหม")
    print("           3) idf.py monitor เปิดอยู่ค้างไหม (ปิดก่อน)")
    ser.close()
    return None


# =================== Collect One Sample ===================
def collect_sample(ser, label, activity_name, sample_num, prefix=None):
    """เก็บ 1 sample — คืนชื่อไฟล์ที่บันทึก หรือ False ถ้าไม่ได้บันทึก"""
    target = PACKETS_PER_SAMPLE

    print(f"\n  📍 [{activity_name}]  Sample {sample_num}  (เป้า {target} pkts)")
    input("  กด Enter เพื่อเริ่มบันทึก...")
    countdown(COUNTDOWN)
    print("  กด Enter เพื่อหยุด")

    packets    = []
    start_time = time.time()
    stop_flag  = threading.Event()

    # ล้าง buffer ค้าง
    ser.reset_input_buffer()

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
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" not in line:
                continue
            packets.append({
                "timestamp": datetime.now().isoformat(),
                "label":     label,
                "raw":       line,
            })
        except Exception:
            continue

    stop_flag.set()
    print(f"\n  รับมา {len(packets)} pkts")

    confirm = input("  บันทึก sample นี้ไหม? (y/n): ").strip().lower()
    if confirm != "y":
        print("  ⏭️  ข้ามไป — ไม่บันทึก")
        return False

    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = activity_name.replace(" ", "_")
    # prefix มีเฉพาะโหมด session — ทำให้เรียงชื่อไฟล์แล้วได้ลำดับการเก็บจริง
    head      = f"{prefix}_" if prefix else ""
    filename  = f"{head}{label}_{safe_name}_{ts}_{sample_num:03d}.csv"
    filepath  = os.path.join(RAW_DIR, filename)

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "label", "raw"])
        writer.writeheader()
        writer.writerows(packets)

    print(f"  ✅ บันทึก → {filename}")
    return filename


# =================== Count Existing Samples ===================
def count_samples(activity_name):
    safe_name = activity_name.replace(" ", "_")
    return len([f for f in os.listdir(RAW_DIR) if safe_name in f and f.endswith(".csv")])


# =================== Show Menu ===================
def show_menu():
    print("\n" + "=" * 60)
    print("  🎯  เลือกท่าที่ต้องการเก็บ (เว้นวรรคคั่น เช่น 1 2 3)")
    print("  's' = โหมด session สลับคลาส ⭐ แนะนำ  |  'all' = ทั้งหมด  |  'q' = ออก")
    print("=" * 60)

    print("  ── 🔴 Fall ──")
    for i, (label, name, default) in enumerate(ACTIVITIES, 1):
        if label == "fall":
            have = count_samples(name)
            bar  = "█" * min(have * 20 // default, 20)
            print(f"  {i:2d}. {name:<22} {have:3d}/{default}  [{bar:<20}]")

    print("  ── 🟢 Non-fall ──")
    for i, (label, name, default) in enumerate(ACTIVITIES, 1):
        if label == "non_fall":
            have = count_samples(name)
            bar  = "█" * min(have * 20 // default, 20)
            print(f"  {i:2d}. {name:<22} {have:3d}/{default}  [{bar:<20}]")

    print("  ⚠️  เมนูนี้เก็บทีละท่ารวดเดียว ทำให้คลาสกับเวลาผูกกัน — ใช้ 's' แทนถ้าเก็บชุดใหม่")
    print("=" * 60)


# =================== โหมด Session สลับคลาส ===================
"""
ทำไมต้องมีโหมดนี้
-----------------
เมนูปกติให้เลือกท่าทีละอย่างแล้วเก็บรวดเดียว N ครั้ง — เก็บ "ล้มไปข้างหน้า" 100 ไฟล์ติด
แล้วค่อยเปลี่ยนไปเก็บ "เดิน" อีก 100 ไฟล์ติด ผลคือได้ข้อมูลที่ fall กับ non_fall
อยู่คนละช่วงเวลากันสนิท

ปัญหาที่ตามมา (ตรวจพบในชุดข้อมูลแรก — ดู docs/reports/data_quality_audit_2026-09.md):
ทุกอย่างที่เปลี่ยนไประหว่างสองช่วงเวลานั้น — ตำแหน่ง ESP32 ขยับ เฟอร์นิเจอร์ย้าย
คนในห้อง gain หลัง reboot — กลายเป็นตัวทำนายคลาสที่แม่นกว่าตัวการล้มเอง
โมเดลได้ accuracy 95.6% จากการแยก "session ไหน" ไม่ใช่ "ล้มหรือไม่ล้ม"
และไม่มีวิธีวิเคราะห์ใดแก้ย้อนหลังได้

โหมดนี้บังคับให้สลับคลาสทีละ sample สภาพห้องจึงกระจายเท่า ๆ กันทั้งสองคลาส
และหักล้างกันเองตอนเทรน — เก็บถูกโดยโครงสร้าง ไม่ต้องอาศัยวินัยคนเก็บ
"""


def build_interleaved_plan(rounds, seed=None):
    """
    สร้างลำดับการเก็บที่สลับ fall / non_fall

    1 รอบ = 1 fall + 1 non_fall โดยสุ่มว่ารอบนั้นเริ่มด้วยคลาสไหน
    (ถ้าสลับตายตัว fall จะตามหลัง non_fall เสมอ ผลข้างเคียงจากท่าก่อนหน้า
     เช่นยังลุกไม่เสร็จ จะเข้าคลาสเดียวเสมอกลายเป็น confound ตัวใหม่)

    ท่าภายในแต่ละคลาสหมุนจนครบทุกท่าก่อนวนใหม่ — ได้จำนวนเท่ากันทุกท่า
    """
    falls    = [a for a in ACTIVITIES if a[0] == "fall"]
    nonfalls = [a for a in ACTIVITIES if a[0] == "non_fall"]
    rng = random.Random(seed)

    plan, fall_pool, non_pool = [], [], []
    for r in range(rounds):
        if not fall_pool:
            fall_pool = falls[:]
            rng.shuffle(fall_pool)
        if not non_pool:
            non_pool = nonfalls[:]
            rng.shuffle(non_pool)

        pair = [fall_pool.pop(), non_pool.pop()]
        if r % 2:
            pair.reverse()
        plan.extend(pair)

    return plan


def ask_session_info():
    """ข้อมูลกำกับ session — ไว้ตรวจย้อนหลังว่าอะไรเปลี่ยนไประหว่างชุดข้อมูล"""
    print("\n  ── ข้อมูล session (Enter = ข้าม) ──")
    return {
        "room":        input("  ห้อง/สถานที่        : ").strip() or None,
        "esp32_setup": input("  ตำแหน่ง ESP32       : ").strip() or None,
        "actor":       input("  คนแสดงท่า           : ").strip() or None,
        "notes":       input("  หมายเหตุ            : ").strip() or None,
    }


def save_manifest(session_id, info, plan, records, started_at):
    """เขียนทับทุกครั้งที่เก็บได้ 1 sample — กด Ctrl-C แล้วข้อมูลไม่หาย"""
    path = os.path.join(SESSION_DIR, f"session_{session_id}.json")
    fall_n = sum(1 for r in records if r["label"] == "fall")

    with open(path, "w", encoding="utf-8") as f:
        json.dump({
            "session_id":   session_id,
            "started_at":   started_at,
            "updated_at":   datetime.now().isoformat(),
            "collection":   "interleaved",
            "planned":      len(plan),
            "collected":    len(records),
            "fall":         fall_n,
            "non_fall":     len(records) - fall_n,
            "info":         info,
            "samples":      records,
        }, f, indent=2, ensure_ascii=False)
    return path


def run_session(ser):
    print("\n" + "=" * 60)
    print("  🔀  โหมด Session สลับคลาส")
    print("=" * 60)
    print("  สคริปต์จะสั่งเองว่าตาต่อไปเก็บท่าอะไร สลับ fall / non_fall ให้อัตโนมัติ")
    print("  ⚠️  ห้าม reboot ESP32 · ห้ามขยับอุปกรณ์ · ห้ามย้ายของในห้อง ตลอด session")

    try:
        rounds = int(input("\n  จะเก็บกี่รอบ (1 รอบ = 1 fall + 1 non_fall): ").strip())
    except ValueError:
        print("  ❌ กรุณากรอกตัวเลข")
        return
    if rounds < 1:
        return

    info = ask_session_info()
    plan = build_interleaved_plan(rounds)

    session_id = datetime.now().strftime("%Y%m%d_%H%M")
    started_at = datetime.now().isoformat()

    print("\n  📋 ลำดับที่จะเก็บ (" + str(len(plan)) + " sample)")
    preview = "  " + " ".join("🔴" if lbl == "fall" else "🟢" for lbl, _, _ in plan[:40])
    print(preview + ("  ..." if len(plan) > 40 else ""))
    print(f"\n  session_id = {session_id}")

    if input("\n  เริ่มเลยไหม? (y/n): ").strip().lower() != "y":
        return

    records = []
    try:
        for idx, (label, name, _) in enumerate(plan, 1):
            tag = "🔴 FALL" if label == "fall" else "🟢 NON-FALL"
            print("\n" + "─" * 60)
            print(f"  [{idx}/{len(plan)}]  {tag}")
            print(f"  ➡️  ตาต่อไป: {name}")
            print("─" * 60)

            filename = collect_sample(
                ser, label, name, idx, prefix=f"s{session_id}_{idx:03d}"
            )
            if not filename:
                print("  ⏭️  ข้าม — จะเก็บท่าเดิมนี้ซ้ำในตาถัดไป")
                plan.append((label, name, None))   # ต่อท้ายไว้ ไม่ให้คลาสเสียสมดุล
                continue

            records.append({
                "seq":      idx,
                "label":    label,
                "activity": name,
                "file":     filename,
                "at":       datetime.now().isoformat(),
            })
            save_manifest(session_id, info, plan, records, started_at)

            fall_n = sum(1 for r in records if r["label"] == "fall")
            print(f"  📊 เก็บแล้ว {len(records)}/{len(plan)}  "
                  f"(fall {fall_n} · non_fall {len(records)-fall_n})")

    except KeyboardInterrupt:
        print("\n  ⛔ หยุดกลางคัน")

    path = save_manifest(session_id, info, plan, records, started_at)
    fall_n = sum(1 for r in records if r["label"] == "fall")
    print("\n" + "=" * 60)
    print(f"  ✅ session {session_id} — เก็บได้ {len(records)} sample "
          f"(fall {fall_n} · non_fall {len(records)-fall_n})")
    print(f"  📄 manifest → {os.path.relpath(path, BASE_DIR)}")
    if fall_n != len(records) - fall_n:
        print("  ⚠️  จำนวนสองคลาสไม่เท่ากัน — เก็บเพิ่มให้สมดุลใน session ถัดไป")
    print("=" * 60)


# =================== Main ===================
def main():
    print("=" * 60)
    print("  📡  CSI Data Collector (USB Serial)")
    print(f"  Baudrate : {BAUDRATE}")
    print(f"  Per sample: {PACKETS_PER_SAMPLE} pkts")
    print(f"  Output    : {RAW_DIR}")
    print("=" * 60)

    ser = connect_esp32()
    if ser is None:
        return

    try:
        while True:
            show_menu()
            choice = input("\n  เลือก: ").strip().lower()

            if choice in ("q", "quit", "exit"):
                break
            elif choice == "s":
                run_session(ser)
                continue
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

            custom_counts = {}
            for i in selected:
                label, name, default = ACTIVITIES[i]
                try:
                    n = input(f"  จำนวน samples '{name}' (Enter = {default}): ").strip()
                    custom_counts[i] = int(n) if n else default
                except ValueError:
                    custom_counts[i] = default

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

            back_to_menu = False
            for i in selected:
                if back_to_menu:
                    break
                label, name, _ = ACTIVITIES[i]
                saved = 0
                s = 1

                print(f"\n  ━━━ {name} ━━━")

                try:
                    while True:
                        ok = collect_sample(ser, label, name, s)
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

    finally:
        ser.close()
        print("\n  👋 ปิดโปรแกรมแล้ว\n")


if __name__ == "__main__":
    main()
