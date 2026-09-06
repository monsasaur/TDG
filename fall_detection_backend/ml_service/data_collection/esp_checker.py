"""
ESP32 CSI Connection Checker — Serial หรือ UDP
==============================================
เช็คก่อนเก็บ data ว่า:
  0. ต่อกับ ESP32 ได้ไหม (serial port หรือ UDP)
  1. รับ CSI_DATA ได้ไหม
  2. CSI data ไหลมาต่อเนื่องไหม
  3. packet rate เท่าไหร่
  4. format ถูกต้องไหม + source MAC = ESP32 #2 ตัวเดียวไหม

วิธีใช้:
  python data_collection/esp_checker.py                    # serial
  CSI_TRANSPORT=udp python data_collection/esp_checker.py  # udp

ใช้การเชื่อมต่อร่วมกับ csi_collector_serial.py — แก้ที่เดียวมีผลทั้งคู่
"""

import importlib.util
import os
import sys
import time
from collections import Counter

_HERE = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location(
    "csi_collector", os.path.join(_HERE, "csi_collector_serial.py"))
cc = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(cc)

# =================== ตั้งค่า ===================
CHECK_SECS   = 5

# ⚠️ อัตราจริงคือ ~73 pkt/s ไม่ใช่ 100 ที่เคยเขียนไว้
#    วัดจาก field[18] local_timestamp ของ ESP32 เอง (cross-check field[23])
#    median 73.2 pkt/s จาก 50 ไฟล์ในชุดข้อมูลเดิม
#
#    เกณฑ์ล่างมาจาก p5 ของชุดเดิม = 41 pkt/s — ต่ำกว่านี้คือหลุดจากช่วง
#    ที่ข้อมูลเทรนครอบคลุม โมเดลอาจเพี้ยนโดยไม่มีสัญญาณเตือน
TARGET_RATE  = 73
MIN_RATE     = 41
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


# =================== Step 0+1: เชื่อมต่อ ===================
def connect():
    mode = "UDP" if cc.TRANSPORT == "udp" else "USB Serial"
    print(f"\n  🔌 Step 0-1 — เชื่อมต่อ ESP32 ({mode})\n")
    reader = cc.connect_esp32()
    if reader is None:
        status(False, "เชื่อมต่อไม่ได้")
        return None
    status(True, f"เชื่อมต่อได้: {reader.desc}")
    if getattr(reader, "mac", None):
        status(True, f"ล็อก MAC ต้นทาง: {reader.mac}")
    return reader


# =================== Step 2: Data Flow ===================
def check_data_flow(reader):
    print("\n  📶 Step 2 — เช็คว่า CSI data ไหลมาต่อเนื่องไหม\n")
    print("     รอรับข้อมูล 3 วินาที...")

    packets = []
    start   = time.time()

    while time.time() - start < 3:
        try:
            raw = reader.readline()
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
def check_packet_rate(reader):
    print(f"\n  ⚡ Step 3 — วัด Packet Rate ({CHECK_SECS} วินาที)\n")
    print("     กำลังวัด", end="", flush=True)

    count  = 0
    stamps = []
    start  = time.time()

    while time.time() - start < CHECK_SECS:
        try:
            raw = reader.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" in line:
                count += 1
                t = cc.csi_timestamp(line)
                if t is not None:
                    stamps.append(t)
                if count % 50 == 0:
                    print(".", end="", flush=True)
        except Exception:
            break

    print()
    elapsed = time.time() - start

    # ⚠️ อย่าใช้ time.time() คิดอัตรา — serial/UDP buffer ทำให้อ่านเป็นชุด
    #    แล้วได้ค่าปลอมสูงกว่าจริงราว 3 เท่า (วัดได้ 220 ทั้งที่จริง 73)
    #    ต้องใช้ local_timestamp ที่ ESP32 ประทับมาเอง
    rate_wall = count / elapsed if elapsed > 0 else 0
    rate = rate_wall
    if len(stamps) >= 2 and stamps[-1] > stamps[0]:
        rate = (len(stamps) - 1) / (stamps[-1] - stamps[0])

    print(f"\n     📊 ผลการวัด:")
    print(f"        packets รับได้ : {count}")
    print(f"        เวลาที่วัด     : {elapsed:.1f} วินาที (นาฬิกาเครื่องนี้)")
    print(f"        packet rate    : {rate:.1f} pkt/s  (จาก timestamp ของ ESP32)")
    if abs(rate_wall - rate) > 5:
        print(f"        (นาฬิกาเครื่องนี้จะได้ {rate_wall:.0f} pkt/s ซึ่งเป็นค่าปลอมจาก buffer)")

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
        if cc.TRANSPORT == "udp":
            print("     - โหมด UDP: มีอะไรแย่งช่องสัญญาณ — ลองย้ายคอมให้ห่าง")
            print("       หรือปิดอุปกรณ์อื่นที่เกาะ AP ของ ESP32")

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
    udp = cc.TRANSPORT == "udp"
    status(port_ok,   "รับ CSI ทาง UDP :5500" if udp else "เจอ USB serial port")
    status(connected, "ล็อก MAC ต้นทางได้" if udp else "รับ CSI_DATA ผ่าน serial")
    status(has_data,        "CSI data ไหลต่อเนื่อง")
    status(rate >= MIN_RATE, f"Packet rate ({rate:.0f} pkt/s)")
    status(format_ok,       "Format ถูกต้อง + MAC ตรง")
    print()

    all_ok = port_ok and connected and has_data and rate >= MIN_RATE and format_ok
    if all_ok:
        cmd = ("CSI_TRANSPORT=udp python data_collection/csi_collector_serial.py"
               if udp else "python data_collection/csi_collector_serial.py")
        print(f"  🎉 พร้อมเก็บ data แล้ว!  รัน:\n     {cmd}")
    else:
        print("  ⚠️  แก้ปัญหาด้านบนก่อนแล้วค่อยเก็บ data")

    if 0 < rate < MIN_RATE:
        print(f"\n  🔴 อัตราต่ำกว่า {MIN_RATE} pkt/s = หลุดจากช่วงที่ชุดข้อมูลเดิมครอบคลุม")
        print("     เก็บต่อได้แต่โมเดลอาจเพี้ยน — แก้ก่อนดีกว่า")
        if udp:
            print("     โหมด UDP: ย้ายคอมให้ห่าง ESP32 · ปิดอุปกรณ์อื่นที่เกาะ AP")
    elif rate > 0 and rate < TARGET_RATE * 0.85:
        print(f"\n  💡 อัตรา {rate:.0f} ต่ำกว่าปกติ (~{TARGET_RATE}) แต่ยังอยู่ในช่วงที่ใช้ได้")

    print("=" * 55 + "\n")


# =================== Main ===================
def main():
    clear()
    print_header()

    reader = connect()
    if reader is None:
        print_summary(False, False, False, 0, False)
        return

    try:
        packets  = check_data_flow(reader)
        has_data = len(packets) > 0

        rate = 0
        if has_data:
            rate = check_packet_rate(reader)

        # รวม packets จาก step 3 ด้วย
        all_packets = list(packets)
        if has_data:
            extra_start = time.time()
            while time.time() - extra_start < 0.5:
                try:
                    raw = reader.readline()
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
        reader.close()

    print_summary(True, True, has_data, rate, format_ok)


if __name__ == "__main__":
    main()
