"""
ESP32 CSI Connection Checker (USB Serial)
==========================================
เช็คก่อนเก็บ data ว่า:
  0. หา serial port ของ ESP32 ได้ไหม
  1. รับ CSI_DATA ผ่าน serial ได้ไหม
  2. CSI data ไหลมาไหม
  3. packet rate เท่าไหร่ (เป้า 100 pkt/s)
  4. format ถูกต้องไหม + เช็คว่า source MAC = ESP32 #2

วิธีใช้:
  pip install pyserial
  python esp_checker.py
"""

import serial
import serial.tools.list_ports
import time
import os
import glob
from collections import Counter

# =================== ตั้งค่า ===================
SERIAL_PORT  = None    # None = auto-detect; หรือ "/dev/cu.usbserial-0001"
BAUDRATE     = 921600  # ต้องตรงกับ firmware (sdkconfig CONFIG_ESP_CONSOLE_UART_BAUDRATE)
READ_TIMEOUT = 1.0

CHECK_SECS   = 5
MIN_RATE     = 50
TARGET_RATE  = 100
WAIT_FIRST   = 15      # รอ CSI_DATA แรก (วิ)
# ================================================

def clear():
    os.system("cls" if os.name == "nt" else "clear")

def print_header():
    print("=" * 55)
    print("     🔍  ESP32 CSI Connection Checker (Serial)")
    print("=" * 55)

def status(ok, msg):
    icon = "✅" if ok else "❌"
    print(f"  {icon}  {msg}")

def warn(msg):
    print(f"  ⚠️   {msg}")


# =================== Step 0: Find Port ===================
def find_serial_port():
    print("\n  🔌 Step 0 — หา USB serial port ของ ESP32\n")

    if SERIAL_PORT:
        if os.path.exists(SERIAL_PORT):
            status(True, f"ใช้ port ที่ตั้งค่าไว้: {SERIAL_PORT}")
            return SERIAL_PORT
        else:
            status(False, f"ไม่พบ port: {SERIAL_PORT}")
            return None

    candidates = sorted(
        glob.glob("/dev/cu.usbserial-*")
        + glob.glob("/dev/cu.SLAB_*")
        + glob.glob("/dev/cu.wchusbserial*")
    )

    if not candidates:
        status(False, "ไม่พบ USB serial port")
        print("\n  💡 ลอง:")
        print("     1. เสียบสาย USB ของ ESP32 #1 เข้า Mac")
        print("     2. เช็คด้วย: ls /dev/cu.usbserial-*")
        print("     3. ถ้าใช้ ESP32 ที่ใช้ CH340/CP210x ลง driver จาก SiLabs/WCH")
        return None

    port = candidates[0]
    status(True, f"เจอ {len(candidates)} port: {port}")
    if len(candidates) > 1:
        print(f"     (มีหลาย port เลือกตัวแรก — ตั้ง SERIAL_PORT ใน script ได้)")
        for p in candidates:
            print(f"     • {p}")
    return port


# =================== Step 1: Open Serial + Wait First CSI ===================
def check_connection(port):
    print(f"\n   Step 1 — เปิด serial และรอ CSI_DATA (timeout {WAIT_FIRST} วิ)\n")
    print(f"     port: {port} @ {BAUDRATE} baud")

    try:
        ser = serial.Serial(port, BAUDRATE, timeout=READ_TIMEOUT)
    except serial.SerialException as e:
        status(False, f"เปิด serial ไม่ได้: {e}")
        print("\n  💡 อาจมี process อื่นถือ port อยู่ — ปิด idf.py monitor ก่อน")
        return None

    start = time.time()
    while time.time() - start < WAIT_FIRST:
        try:
            line = ser.readline().decode("utf-8", errors="ignore").strip()
        except Exception:
            continue
        if "CSI_DATA" in line:
            status(True, f"ได้รับ CSI_DATA จาก ESP32 ({int(time.time() - start)} วิ)")
            return ser

    status(False, f"Timeout — ไม่มี CSI_DATA ใน {WAIT_FIRST} วิ")
    print("\n  💡 เช็ค:")
    print("     1. ESP32 #1 flash firmware version USB Serial หรือยัง?")
    print("        (active_ap ต้องเป็น AP-only mode + outprintf)")
    print("     2. ESP32 #2 จ่ายไฟอยู่ไหม?")
    print("     3. baudrate ถูกไหม? (sdkconfig: 921600)")
    ser.close()
    return None


# =================== Step 2: Data Flow ===================
def check_data_flow(ser):
    print("\n  📶 Step 2 — เช็คว่า CSI data ไหลมาต่อเนื่องไหม\n")
    print("     รอรับข้อมูล 3 วินาที...")

    packets = []
    start   = time.time()

    while time.time() - start < 3:
        try:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" in line:
                packets.append(line)
        except Exception as e:
            status(False, f"Error: {e}")
            return packets

    if len(packets) == 0:
        status(False, "ไม่มีข้อมูลเข้ามาเลย — เช็ค ESP32 #2 ส่ง packet อยู่ไหม")
    else:
        status(True, f"ได้รับข้อมูล {len(packets)} packets ใน 3 วินาที")

    return packets


# =================== Step 3: Packet Rate ===================
def check_packet_rate(ser):
    print(f"\n  ⚡ Step 3 — วัด Packet Rate ({CHECK_SECS} วินาที)\n")
    print("     กำลังวัด", end="", flush=True)

    count  = 0
    start  = time.time()

    while time.time() - start < CHECK_SECS:
        try:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" in line:
                count += 1
                if count % 50 == 0:
                    print(".", end="", flush=True)
        except Exception:
            break

    print()
    elapsed = time.time() - start
    rate    = count / elapsed if elapsed > 0 else 0

    print(f"\n     📊 ผลการวัด:")
    print(f"        packets รับได้ : {count}")
    print(f"        เวลาที่วัด     : {elapsed:.1f} วินาที")
    print(f"        packet rate    : {rate:.1f} pkt/s")

    if rate >= TARGET_RATE:
        status(True, f"Packet rate {rate:.0f} pkt/s ✅ (target: {TARGET_RATE})")
    elif rate >= MIN_RATE:
        warn(f"Packet rate {rate:.0f} pkt/s ต่ำกว่า target ({TARGET_RATE}) แต่ใช้ได้")
    else:
        status(False, f"Packet rate {rate:.0f} pkt/s ต่ำเกินไป (min: {MIN_RATE})")
        print("\n  💡 สาเหตุที่อาจเป็น:")
        print("     - ESP32 #2 หลุด/ไม่ได้จ่ายไฟ")
        print("     - baudrate ไม่ตรง (sdkconfig active_ap = 921600?)")
        print("     - PACKET_RATE ใน active_sta ต่ำ (default = 100)")

    return rate


# =================== Step 4: Format + MAC Check ===================
ESP32_STA_MAC_HINT = "1C:C3:AB"   # prefix MAC ของ Espressif (ESP32 #2)

def check_format(packets):
    print("\n  🔬 Step 4 — เช็ค Format + Source MAC\n")

    if not packets:
        status(False, "ไม่มีข้อมูลให้เช็ค")
        return False

    csi_line = next((p for p in packets if "CSI_DATA" in p), None)
    if not csi_line:
        status(False, "ไม่พบ CSI_DATA")
        return False

    parts = csi_line.split(",")
    print(f"     ตัวอย่าง raw line:")
    print(f"     {csi_line[:80]}{'...' if len(csi_line) > 80 else ''}\n")
    print(f"     จำนวน fields : {len(parts)}")

    ok = True
    if len(parts) < 10:
        status(False, f"Fields น้อยเกินไป ({len(parts)})")
        ok = False
    else:
        status(True, f"Fields ครบ ({len(parts)} fields)")

    has_bracket = "[" in csi_line and "]" in csi_line
    if has_bracket:
        status(True, "มี CSI subcarrier data [ ... ]")
    else:
        warn("ไม่พบ [ ... ] — อาจยังไม่มี CSI data")
        ok = False

    # MAC distribution
    mac_counter = Counter()
    for line in packets:
        p = line.split(",")
        if len(p) >= 3:
            mac_counter[p[2]] += 1

    print("\n     📡 Source MAC distribution:")
    for mac, cnt in mac_counter.most_common():
        is_esp = mac.upper().startswith(ESP32_STA_MAC_HINT)
        tag = "✅ ESP32" if is_esp else "⚠️  อื่น (อาจเป็น beacon ภายนอก)"
        pct = cnt * 100 / len(packets)
        print(f"        {mac:<20} {cnt:4d} pkts ({pct:.0f}%)  {tag}")

    esp_count = sum(c for m, c in mac_counter.items() if m.upper().startswith(ESP32_STA_MAC_HINT))
    esp_pct   = esp_count * 100 / len(packets) if packets else 0
    if esp_pct >= 90:
        status(True, f"CSI {esp_pct:.0f}% มาจาก ESP32 ✅")
    elif esp_pct > 0:
        warn(f"CSI แค่ {esp_pct:.0f}% มาจาก ESP32 — ที่เหลือเป็น beacon ภายนอก")
    else:
        status(False, "CSI 0% มาจาก ESP32 — เช็คว่า ESP32 #2 ส่ง packet ถึง #1 ไหม")
        ok = False

    return ok


# =================== Summary ===================
def print_summary(port_ok, connected, has_data, rate, format_ok):
    print("\n" + "=" * 55)
    print("  📋 สรุปผลการเช็ค")
    print("=" * 55)
    status(port_ok,         "เจอ USB serial port")
    status(connected,       "รับ CSI_DATA ผ่าน serial")
    status(has_data,        "CSI data ไหลต่อเนื่อง")
    status(rate >= MIN_RATE, f"Packet rate ({rate:.0f} pkt/s)")
    status(format_ok,       "Format ถูกต้อง + MAC ตรง")
    print()

    all_ok = port_ok and connected and has_data and rate >= MIN_RATE and format_ok
    if all_ok:
        print("  🎉 พร้อมเก็บ data แล้ว! รัน csi_collector_serial.py ได้เลย")
    else:
        print("  ⚠️  แก้ปัญหาด้านบนก่อนแล้วค่อยเก็บ data")

    if rate > 0 and rate < TARGET_RATE:
        print(f"\n  💡 Tip: เช็ค active_sta/sdkconfig — PACKET_RATE ต้อง = {TARGET_RATE}")

    print("=" * 55 + "\n")


# =================== Main ===================
def main():
    clear()
    print_header()

    port = find_serial_port()
    if port is None:
        print_summary(False, False, False, 0, False)
        return

    ser = check_connection(port)
    if ser is None:
        print_summary(True, False, False, 0, False)
        return

    try:
        packets  = check_data_flow(ser)
        has_data = len(packets) > 0

        rate = 0
        if has_data:
            rate = check_packet_rate(ser)

        # รวม packets จาก step 3 ด้วย
        all_packets = list(packets)
        if has_data:
            extra_start = time.time()
            while time.time() - extra_start < 0.5:
                try:
                    raw = ser.readline()
                    if not raw:
                        break
                    line = raw.decode("utf-8", errors="ignore").strip()
                    if "CSI_DATA" in line:
                        all_packets.append(line)
                except Exception:
                    break

        format_ok = False
        if all_packets:
            format_ok = check_format(all_packets)
    finally:
        ser.close()

    print_summary(True, True, has_data, rate, format_ok)


if __name__ == "__main__":
    main()
