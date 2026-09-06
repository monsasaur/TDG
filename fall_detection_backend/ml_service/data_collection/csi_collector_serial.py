"""
csi_collector_serial.py
========================
เก็บ CSI Data จาก ESP32 — รองรับสองทางรับ **ตรรกะการเก็บเหมือนกันทุกอย่าง**

    USB Serial (ค่าเริ่มต้น)   ESP32 เสียบสาย USB กับคอม
    UDP                        ESP32 ยิงผ่าน WiFi — คอมเกาะ "myssid" ที่ ESP32 ปล่อยเอง

วิธีใช้:
  pip install pyserial                       # เฉพาะโหมด serial
  python data_collection/csi_collector_serial.py            # serial
  CSI_TRANSPORT=udp python data_collection/csi_collector_serial.py   # udp

โหมด UDP ต้อง flash firmware ที่เปิด CONFIG_SEND_CSI_TO_UDP
(menuconfig → ESP32 CSI Tool Config → Send CSI data over UDP)
ช่องสัญญาณยังคงที่ตาม WIFI_CHANNEL เพราะคอมเกาะ AP ของ ESP32 เอง
ไม่ได้ให้ ESP32 ไปเกาะเราเตอร์ — ต่างจากเซ็ตอัป UDP เก่าที่ช่องหลุดตาม hotspot

⚠️ โหมด UDP: คอมจะไม่มีอินเทอร์เน็ตระหว่างเก็บ และคอมกลายเป็นแหล่งสัญญาณ
   เพิ่มบนช่องเดียวกัน — วางให้ห่างจากบริเวณทำท่า และห้ามขยับตลอด session
"""

import csv
import glob
import json
import os
import random
import socket
import threading
import time
from datetime import datetime

# =================== Config ===================
# ทางรับข้อมูล — "serial" หรือ "udp" (ตั้งผ่าน env CSI_TRANSPORT)
TRANSPORT    = os.environ.get("CSI_TRANSPORT", "serial").strip().lower()

# กรอง CSI ตาม MAC ต้นทาง — None = ตรวจอัตโนมัติตอนเชื่อมต่อ (เลือก MAC ที่มากที่สุด)
#
# ทำไมต้องมี: ESP32 #1 วัด CSI จาก **ทุก packet ที่มันรับได้** ไม่ใช่เฉพาะจาก ESP32 #2
# โหมด serial ชุดเดิมมี MAC แปลกปลอมปนมา 0.1% (มือถือแถวนั้น probe เข้ามา)
# โหมด UDP คอมต้องเกาะ AP ของ ESP32 → เฟรมของคอมเองจะถูกวัด CSI ด้วย
# ถ้าไม่กรอง จะมีสัญญาณจากคอมปนเข้าไปใน feature โดยไม่รู้ตัว
MAC_FILTER   = None

UDP_HOST     = "0.0.0.0"
UDP_PORT     = 5500    # ต้องตรงกับ UDP_TARGET_PORT ใน csi_component.h
UDP_BUFSIZE  = 4096

SERIAL_PORT  = None    # None = auto-detect; หรือ "/dev/cu.usbserial-0001"
BAUDRATE     = 921600  # ต้องตรงกับ firmware (sdkconfig CONFIG_ESP_CONSOLE_UART_BAUDRATE)
                       # active_ap/sdkconfig:1630 = 921600 · esp_checker.py ก็ใช้ค่านี้
READ_TIMEOUT = 1.0

# เป้าความยาวคลิป — แค่แถบ progress ไม่ใช่ลิมิต (หยุดเมื่อกด Enter)
#
# ⚠️ อัตรา CSI จริงคือ ~73 pkt/s ไม่ใช่ 100 ตามที่คอมเมนต์เก่าทั่วโปรเจกต์เขียนไว้
#    วัดจาก field[18] local_timestamp (µs) ของ ESP32 เอง cross-check กับ field[23]
#    ได้ค่าตรงกัน median 73.2 pkt/s จาก 50 ไฟล์ในชุดเดิม
#    (timestamp ที่ Python เขียนเชื่อไม่ได้ — serial buffer ทำให้อ่านเป็นชุด)
#
# 900 pkt ≈ 12.3 วิ — เท่ากับความยาวคลิปของชุดเดิม (median 865 pkt) โดยบังเอิญ
# ของเดิมก็ยาว 12 วิอยู่แล้ว สิ่งที่ทำให้มันใช้กับ real-time ไม่ได้คือ *การ trim*
# ตอน preprocess (เอา 300 pkt แรก) ไม่ใช่ความยาวคลิป
PACKETS_PER_SAMPLE = 900
COUNTDOWN          = 2
WINDOW_SIZE_MIN    = 200   # ต้องมีอย่างน้อยเท่านี้ถึงจะทำ 1 window ได้ (ตรงกับ preprocess)

# อัตรา CSI จริง วัดจาก field[18] local_timestamp ของ ESP32 (cross-check field[23])
# median 73.2 pkt/s จาก 50 ไฟล์ — ไม่ใช่ 100 ตามที่คอมเมนต์เก่าทั่วโปรเจกต์เขียนไว้
PKT_PER_SEC        = 73.2

# ต้องมี packet ก่อนจุดมาร์คอย่างน้อยเท่านี้ preprocess_v3 ถึงจะตัด window ครบ 3 อัน
# (FRAMED_BEFORE=250 ใน preprocess_v3.py) → ยืนนิ่งก่อนล้มอย่างน้อย ~3.4 วิ
MARK_MIN_PKT       = 250

# เกณฑ์เตือนเรื่องอัตรา — วัดจากชุดข้อมูลเดิม p5 = 41 pkt/s
# ต่ำกว่า RATE_FAIL = หลุดจากช่วงที่ข้อมูลเดิมครอบคลุม โมเดลอาจเพี้ยน
RATE_WARN          = 55.0
RATE_FAIL          = 40.0

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
    # ห้องว่าง = ไม่มีคนอยู่ในห้องเลย — คลาสที่ชุดข้อมูลแรกไม่มี
    # ทำให้ตอน real-time โมเดลไม่เคยเห็นสภาพ "ไม่มีใคร" มาก่อน
    ("non_fall",    "ห้องว่าง",              80),
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


def csi_timestamp(line: str):
    """local_timestamp (µs) ของ ESP32 — field ที่ 19 (index 18)

    ใช้ตัวนี้วัดอัตรา ไม่ใช่เวลาที่ Python รับ เพราะ buffer ทำให้ Python
    อ่านเป็นชุด แล้วได้อัตราปลอมสูงกว่าจริง 3 เท่า
    """
    parts = line.split(",", 20)
    try:
        return int(parts[18]) / 1e6
    except (IndexError, ValueError):
        return None


def csi_mac(line: str):
    """MAC ต้นทางของบรรทัด CSI — field ที่ 3 (index 2)"""
    parts = line.split(",", 4)
    return parts[2] if len(parts) > 2 else None


def detect_source_mac(reader, n_probe=200, timeout=10.0):
    """ฟังสักพักแล้วเลือก MAC ที่ส่งมามากที่สุด = ESP32 #2

    ทำครั้งเดียวตอนเชื่อมต่อ ไม่ได้ทำทุก sample
    """
    counts, start = {}, time.time()
    while sum(counts.values()) < n_probe and time.time() - start < timeout:
        raw = reader.readline()
        if not raw:
            continue
        line = raw.decode("utf-8", errors="ignore").strip()
        if "CSI_DATA" not in line:
            continue
        mac = csi_mac(line)
        if mac:
            counts[mac] = counts.get(mac, 0) + 1

    if not counts:
        return None, counts
    best = max(counts, key=counts.get)
    return best, counts


# =================== Reader — ห่อสองทางรับให้หน้าตาเหมือนกัน ===================
class SerialReader:
    """อ่าน CSI จาก USB serial"""
    kind = "serial"

    def __init__(self, ser, port):
        self._ser = ser
        self.desc = f"{port} @ {BAUDRATE} baud"

    def readline(self):
        return self._ser.readline()

    def reset(self):
        self._ser.reset_input_buffer()

    def close(self):
        self._ser.close()


class UdpReader:
    """อ่าน CSI จาก UDP — 1 datagram = 1 บรรทัด CSI_DATA

    firmware ยิง broadcast มาที่ port 5500 บนซับเน็ตของ softAP
    จึงไม่ต้องรู้ IP ของเครื่องนี้ล่วงหน้า
    """
    kind = "udp"

    def __init__(self, sock, peer):
        self._sock = sock
        self.desc = f"UDP :{UDP_PORT} ← {peer}"

    def readline(self):
        try:
            data, _ = self._sock.recvfrom(UDP_BUFSIZE)
            return data
        except socket.timeout:
            return b""

    def reset(self):
        """ทิ้ง datagram ที่ค้างใน buffer ให้หมดก่อนเริ่มบันทึก

        เทียบเท่า reset_input_buffer() ของ serial — ถ้าไม่ทำ packet เก่า
        จากช่วงก่อนกดเริ่มจะถูกนับเป็นของ sample นี้ และทำให้ index ของ
        จุดมาร์คเลื่อน
        """
        self._sock.settimeout(0.0)
        try:
            while True:
                self._sock.recvfrom(UDP_BUFSIZE)
        except (BlockingIOError, socket.timeout, OSError):
            pass
        finally:
            self._sock.settimeout(READ_TIMEOUT)

    def close(self):
        self._sock.close()


def auto_detect_port():
    candidates = sorted(glob.glob("/dev/cu.usbserial-*")
                        + glob.glob("/dev/cu.SLAB_*")
                        + glob.glob("/dev/cu.wchusbserial*"))
    return candidates[0] if candidates else None


def connect_serial():
    try:
        import serial
    except ImportError:
        print("  ❌ ไม่มี pyserial — รัน: pip install pyserial")
        return None

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

    print("  ⏳ รอ CSI_DATA จาก ESP32...")
    start = time.time()
    while time.time() - start < 15:
        try:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
        except Exception:
            continue
        if "CSI_DATA" in line:
            print(f"  ✅ CSI ไหลแล้ว ({port})\n")
            return SerialReader(ser, port)

    print("  ❌ ไม่ได้รับ CSI_DATA ใน 15 วิ")
    print("     เช็ค: 1) ESP32 #1 flash firmware ใหม่หรือยัง")
    print("           2) ESP32 #2 จ่ายไฟอยู่ไหม")
    print("           3) idf.py monitor เปิดอยู่ค้างไหม (ปิดก่อน)")
    ser.close()
    return None


def connect_udp():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try:
        sock.bind((UDP_HOST, UDP_PORT))
    except OSError as e:
        print(f"  ❌ bind UDP :{UDP_PORT} ไม่ได้: {e}")
        print("     มีโปรแกรมอื่นใช้ port นี้อยู่ไหม (csi_streamer.py?)")
        return None

    sock.settimeout(15.0)
    print(f"\n  📡 รอ CSI ทาง UDP :{UDP_PORT}")
    print("     คอมต้องเกาะ WiFi ที่ ESP32 ปล่อย (SSID ตาม CONFIG_ESP_WIFI_SSID)")
    try:
        data, addr = sock.recvfrom(UDP_BUFSIZE)
    except socket.timeout:
        print("  ❌ ไม่ได้รับอะไรใน 15 วิ")
        print("     เช็ค: 1) คอมเกาะ WiFi ของ ESP32 แล้วหรือยัง (ไม่ใช่ WiFi บ้าน)")
        print("           2) firmware เปิด CONFIG_SEND_CSI_TO_UDP แล้วหรือยัง")
        print("           3) firewall ของ macOS บล็อก UDP ขาเข้าอยู่ไหม")
        sock.close()
        return None

    if b"CSI_DATA" not in data:
        print(f"  ⚠️  ได้ข้อมูลจาก {addr[0]} แต่ไม่ใช่ CSI_DATA — เช็ค firmware")
    else:
        print(f"  ✅ CSI ไหลแล้ว จาก {addr[0]}\n")
    sock.settimeout(READ_TIMEOUT)
    return UdpReader(sock, addr[0])


def connect_esp32():
    if TRANSPORT == "udp":
        reader = connect_udp()
    elif TRANSPORT == "serial":
        reader = connect_serial()
    else:
        print(f"  ❌ CSI_TRANSPORT ต้องเป็น 'serial' หรือ 'udp' — ได้ '{TRANSPORT}'")
        return None
    if reader is None:
        return None

    # ล็อก MAC ต้นทาง เพื่อให้ข้อมูลจาก serial กับ udp เทียบกันได้
    reader.mac = MAC_FILTER
    if reader.mac is None:
        print("  🔍 ตรวจ MAC ต้นทาง...")
        best, counts = detect_source_mac(reader)
        reader.mac = best
        if best is None:
            print("     ⚠️  ตรวจไม่ได้ — จะเก็บทุก MAC")
        else:
            tot = sum(counts.values())
            print(f"     ✅ ล็อกที่ {best}  ({counts[best]}/{tot} = "
                  f"{counts[best]/tot*100:.1f}%)")
            others = {k: v for k, v in counts.items() if k != best}
            if others:
                print(f"     ℹ️  กรองทิ้ง MAC อื่น {len(others)} ตัว "
                      f"({sum(others.values())} pkt) — เฟรมจากคอม/มือถือแถวนั้น")
    else:
        print(f"  🔒 ใช้ MAC ที่ตั้งไว้: {reader.mac}")
    print()
    return reader


# =================== Collect One Sample ===================
def collect_sample(reader, label, activity_name, sample_num, prefix=None):
    """เก็บ 1 sample — คืน (ชื่อไฟล์, mark_index, อัตรา pkt/s) · (False, None, None) ถ้าไม่บันทึก

    ท่า fall ต้องกด Enter สองครั้ง:
        ครั้งที่ 1 = ตอนล้มถึงพื้น → มาร์คตำแหน่ง packet ไว้
        ครั้งที่ 2 = หยุดบันทึก

    ท่า non_fall กด Enter ครั้งเดียวเพื่อหยุด (ไม่มีจุดมาร์ค)

    mark_index คือลำดับ packet ที่ล้ม ใช้ตอน preprocess เพื่อ:
      - ตัด window รอบจุดมาร์ค      → dataset แบบเดิม (per-window)
      - label ทุก window ตามระยะห่าง → dataset ต่อเนื่องสำหรับ real-time
    ถ้าไม่มีมาร์ค (ลืมกด) จะได้ -1 และ preprocess จะข้ามไฟล์นั้นตอนทำ dataset แบบ framed
    """
    target    = PACKETS_PER_SAMPLE
    is_fall   = label == "fall"

    print(f"\n  📍 [{activity_name}]  Sample {sample_num}  (เป้า {target} pkts)")
    input("  กด Enter เพื่อเริ่มบันทึก...")
    countdown(COUNTDOWN)
    if is_fall:
        print("  ⚡ กด Enter ตอน 'ล้มถึงพื้น'  →  แล้วกด Enter อีกครั้งเพื่อหยุด")
    else:
        print("  กด Enter เพื่อหยุด")

    packets    = []
    dropped    = [0]           # เฟรมที่ MAC ไม่ตรง
    mark_idx   = [-1]          # list เพื่อให้ thread เขียนได้
    start_time = time.time()
    stop_flag  = threading.Event()

    # ล้าง buffer ค้าง — สำคัญมาก ถ้าไม่ล้าง packet เก่าจะทำให้ index มาร์คเลื่อน
    reader.reset()

    def wait_for_enter():
        if is_fall:
            input()                       # ครั้งที่ 1 — มาร์คจุดล้ม
            mark_idx[0] = len(packets)
        input()                           # ครั้งสุดท้าย — หยุด
        stop_flag.set()

    def timer_display():
        while not stop_flag.is_set():
            elapsed = int(time.time() - start_time)
            pct  = min(len(packets) / target, 1.0)
            done = int(pct * 30)
            bar  = "█" * done + "░" * (30 - done)
            if is_fall:
                tag = f"📍มาร์ค@{mark_idx[0]}" if mark_idx[0] >= 0 else "รอมาร์ค..."
            else:
                tag = ""
            print(f"\r  🔴 {elapsed} วิ   [{bar}] {len(packets):4d} pkts  {tag:16s}",
                  end="", flush=True)
            time.sleep(0.1)

    threading.Thread(target=wait_for_enter, daemon=True).start()
    threading.Thread(target=timer_display, daemon=True).start()

    while not stop_flag.is_set():
        try:
            raw = reader.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" not in line:
                continue
            # ทิ้งเฟรมที่ไม่ได้มาจาก ESP32 #2 — ไม่งั้นสัญญาณจากคอม/มือถือ
            # ที่อยู่ช่องเดียวกันจะปนเข้าไปใน feature
            if reader.mac and csi_mac(line) != reader.mac:
                dropped[0] += 1
                continue
            packets.append({
                "timestamp": datetime.now().isoformat(),
                "label":     label,
                "raw":       line,
            })
        except Exception:
            continue

    stop_flag.set()
    mark = mark_idx[0]
    rate = None
    if len(packets) >= 50:
        t0 = csi_timestamp(packets[0]["raw"])
        t1 = csi_timestamp(packets[-1]["raw"])
        if t0 is not None and t1 is not None and t1 > t0:
            rate = (len(packets) - 1) / (t1 - t0)

    print(f"\n  รับมา {len(packets)} pkts", end="")
    if rate:
        print(f" · {rate:.0f} pkt/s", end="")
    if dropped[0]:
        print(f" (กรอง MAC อื่นทิ้ง {dropped[0]})", end="")
    if is_fall:
        if mark < 0:
            print("   ⚠️  ไม่มีจุดมาร์ค (ลืมกด Enter ตอนล้ม)")
        else:
            print(f"   📍 มาร์คที่ pkt {mark} ({mark/PKT_PER_SEC:.1f} วิ)")
            if mark < MARK_MIN_PKT:
                print(f"      ⚠️  ล้มเร็วไป — ต้องมีอย่างน้อย {MARK_MIN_PKT} pkt "
                      f"({MARK_MIN_PKT/PKT_PER_SEC:.1f} วิ) ก่อนล้ม ไม่งั้นตัด window ไม่ครบ")
    else:
        print()

    if rate and rate < RATE_WARN:
        print(f"  ⚠️  อัตราต่ำ ({rate:.0f} pkt/s · ปกติ ~{PKT_PER_SEC:.0f}) "
              "— มีอะไรแย่งช่องสัญญาณอยู่")
        if rate < RATE_FAIL:
            print(f"     🔴 ต่ำกว่า {RATE_FAIL} pkt/s = หลุดจากช่วงที่ชุดข้อมูลเดิมครอบคลุม")
            print("        โหมด UDP: ลองย้ายคอมให้ห่าง/ปิด WiFi อื่น หรือกลับไปใช้ serial")

    if len(packets) < WINDOW_SIZE_MIN:
        print(f"  ⚠️  สั้นเกินไป (<{WINDOW_SIZE_MIN} pkts) — ใช้ทำ window ไม่ได้")

    confirm = input("  บันทึก sample นี้ไหม? (y/n): ").strip().lower()
    if confirm != "y":
        print("  ⏭️  ข้ามไป — ไม่บันทึก")
        return False, None, None

    # ท่า fall ที่ลืมมาร์ค — ให้โอกาสทิ้งก่อน เพราะเอาไปทำ dataset framed ไม่ได้
    if is_fall and mark < 0:
        keep = input("  ไม่มีจุดมาร์ค เก็บไว้ไหม? (y = เก็บ / n = ทิ้ง): ").strip().lower()
        if keep != "y":
            print("  ⏭️  ทิ้ง — จะเก็บท่านี้ซ้ำในตาถัดไป")
            return False, None, None

    ts        = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = activity_name.replace(" ", "_")
    # prefix มีเฉพาะโหมด session — ทำให้เรียงชื่อไฟล์แล้วได้ลำดับการเก็บจริง
    head      = f"{prefix}_" if prefix else ""
    filename  = f"{head}{label}_{safe_name}_{ts}_{sample_num:03d}.csv"
    filepath  = os.path.join(RAW_DIR, filename)

    # คอลัมน์ mark: 1 ที่แถวจุดล้ม · 0 ที่เหลือ
    # เพิ่มท้ายตาราง — preprocess_v2.py เดิมอ่านผ่าน pd.read_csv จึงไม่กระทบ
    for i, pkt in enumerate(packets):
        pkt["mark"] = 1 if i == mark else 0

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "label", "raw", "mark"])
        writer.writeheader()
        writer.writerows(packets)

    print(f"  ✅ บันทึก → {filename}")
    return filename, mark, rate


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
    fall_n    = sum(1 for r in records if r["label"] == "fall")
    # ไฟล์ fall ที่ไม่มีจุดมาร์ค = ทำ dataset แบบ framed ไม่ได้ ต้องรู้ตัวเลขนี้
    unmarked  = sum(1 for r in records
                    if r["label"] == "fall" and r.get("mark", -1) < 0)

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
            "fall_unmarked": unmarked,
            "info":         info,
            "samples":      records,
        }, f, indent=2, ensure_ascii=False)
    return path


def run_session(reader):
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

            filename, mark, rate = collect_sample(
                reader, label, name, idx, prefix=f"s{session_id}_{idx:03d}"
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
                "mark":     mark,          # -1 = ไม่มีจุดมาร์ค (non_fall หรือลืมกด)
                "rate":     round(rate, 1) if rate else None,
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
    rr = [r["rate"] for r in records if r.get("rate")]
    if rr:
        rr_sorted = sorted(rr)
        med = rr_sorted[len(rr_sorted) // 2]
        low = sum(1 for x in rr if x < RATE_FAIL)
        print(f"  📶 อัตรา packet: min {rr_sorted[0]:.0f} · median {med:.0f} "
              f"· max {rr_sorted[-1]:.0f} pkt/s")
        if low:
            print(f"  🔴 {low}/{len(rr)} sample อัตราต่ำกว่า {RATE_FAIL} — "
                  "ตรวจว่ามีอะไรแย่งช่องสัญญาณ")
    unmarked = sum(1 for r in records
                   if r["label"] == "fall" and r.get("mark", -1) < 0)
    if unmarked:
        print(f"  ⚠️  ไฟล์ fall ที่ไม่มีจุดมาร์ค {unmarked} ไฟล์ "
              "— ใช้ทำ dataset แบบ framed ไม่ได้")
    print(f"  ✅ session {session_id} — เก็บได้ {len(records)} sample "
          f"(fall {fall_n} · non_fall {len(records)-fall_n})")
    print(f"  📄 manifest → {os.path.relpath(path, BASE_DIR)}")
    if fall_n != len(records) - fall_n:
        print("  ⚠️  จำนวนสองคลาสไม่เท่ากัน — เก็บเพิ่มให้สมดุลใน session ถัดไป")
    print("=" * 60)


# =================== Main ===================
def main():
    print("=" * 60)
    print(f"  📡  CSI Data Collector ({'UDP' if TRANSPORT == 'udp' else 'USB Serial'})")
    if TRANSPORT == "udp":
        print(f"  Listen    : UDP :{UDP_PORT}")
    else:
        print(f"  Baudrate  : {BAUDRATE}")
    print(f"  Per sample: {PACKETS_PER_SAMPLE} pkts")
    print(f"  Output    : {RAW_DIR}")
    print("=" * 60)

    reader = connect_esp32()
    if reader is None:
        return

    try:
        while True:
            show_menu()
            choice = input("\n  เลือก: ").strip().lower()

            if choice in ("q", "quit", "exit"):
                break
            elif choice == "s":
                run_session(reader)
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
                        ok, _, _ = collect_sample(reader, label, name, s)
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
        reader.close()
        print("\n  👋 ปิดโปรแกรมแล้ว\n")


if __name__ == "__main__":
    main()
