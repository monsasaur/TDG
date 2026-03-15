"""
ESP32 CSI Connection Checker (UDP)
====================================
เช็คก่อนเก็บ data ว่า:
  0. UDP_TARGET_IP ใน csi_component.h ตรงกับ IP Mac ไหม
  1. รับ UDP packets ได้ไหม
  2. CSI data ไหลมาไหม
  3. packet rate เท่าไหร่
  4. format ถูกต้องไหม

วิธีใช้:
  python esp_checker.py
"""

import socket
import time
import os
import re
import subprocess
from datetime import datetime
from collections import deque

# =================== ตั้งค่า ===================
HOST         = "0.0.0.0"
PORT         = 5500
BUFFER_SIZE  = 4096
CHECK_SECS   = 5
MIN_RATE     = 50
TARGET_RATE  = 100

# path ไปยัง csi_component.h (relative จาก script นี้)
CSI_HEADER   = os.path.join(
    os.path.dirname(__file__),
    "../../ESP32-CSI-Tool/_components/csi_component.h"
)
# ================================================

def clear():
    os.system("cls" if os.name == "nt" else "clear")

def print_header():
    print("=" * 55)
    print("     🔍  ESP32 CSI Connection Checker (UDP)")
    print("=" * 55)

def status(ok, msg):
    icon = "✅" if ok else "❌"
    print(f"  {icon}  {msg}")

def warn(msg):
    print(f"  ⚠️   {msg}")


# =================== Step 0: IP Check ===================
def get_mac_ip():
    """ดึง IP จริงของ Mac (WiFi interface)"""
    try:
        result = subprocess.run(
            ["ipconfig", "getifaddr", "en0"],
            capture_output=True, text=True, timeout=3
        )
        ip = result.stdout.strip()
        if ip:
            return ip
    except Exception:
        pass
    # fallback: ใช้ socket เชื่อม 8.8.8.8 เพื่อหา outbound IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return None


def get_firmware_ip():
    """อ่าน UDP_TARGET_IP จาก csi_component.h"""
    header = os.path.abspath(CSI_HEADER)
    if not os.path.exists(header):
        return None, f"ไม่พบไฟล์ {header}"
    try:
        with open(header, "r") as f:
            content = f.read()
        m = re.search(r'#define\s+UDP_TARGET_IP\s+"([^"]+)"', content)
        if m:
            return m.group(1), None
        return None, "ไม่พบ UDP_TARGET_IP ใน csi_component.h"
    except Exception as e:
        return None, str(e)


def check_ip_match():
    print("\n  🌐 Step 0 — เช็ค IP ใน Firmware vs IP จริงของ Mac\n")

    mac_ip = get_mac_ip()
    fw_ip, err = get_firmware_ip()

    if mac_ip:
        print(f"     IP ของ Mac (en0) : {mac_ip}")
    else:
        print("     IP ของ Mac        : ❓ หาไม่ได้")

    if fw_ip:
        print(f"     UDP_TARGET_IP     : {fw_ip}  (csi_component.h)")
    else:
        print(f"     UDP_TARGET_IP     : ❓ {err}")

    print()

    if mac_ip and fw_ip:
        if mac_ip == fw_ip:
            status(True, f"IP ตรงกัน ({fw_ip}) — ไม่ต้องแก้ firmware")
            return True
        else:
            status(False, f"IP ไม่ตรง! firmware={fw_ip}  mac={mac_ip}")
            print(f"\n  💡 แก้ไข: เปลี่ยน UDP_TARGET_IP ใน")
            print(f"     {os.path.abspath(CSI_HEADER)}")
            print(f'     จาก "{fw_ip}"  →  "{mac_ip}"')
            print(f"     แล้ว flash ESP32 ใหม่\n")
            return False
    else:
        warn("เช็ค IP ไม่ได้ครบ — ข้ามขั้นตอนนี้")
        return True  # ไม่บล็อก step ถัดไป


# =================== Step 1: UDP Receive ===================
def check_connection():
    print("\n  📡 Step 1 — รอรับ UDP จาก ESP32\n")
    print(f"     รอที่ port {PORT} ... (timeout 15 วิ)")

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((HOST, PORT))
    sock.settimeout(15)

    try:
        data, addr = sock.recvfrom(BUFFER_SIZE)
        status(True, f"รับข้อมูลจาก ESP32 IP: {addr[0]}:{addr[1]}")
        return sock, addr
    except socket.timeout:
        status(False, "Timeout — ไม่มีข้อมูลเข้ามา")
        sock.close()
        return None, None


# =================== Step 2: Data Flow ===================
def check_data_flow(sock):
    print("\n  📶 Step 2 — เช็คว่า CSI data ไหลมาไหม\n")
    print("     รอรับข้อมูล 3 วินาที...")

    packets = []
    start   = time.time()
    sock.settimeout(1.0)

    while time.time() - start < 3:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            line = data.decode("utf-8", errors="ignore").strip()
            if line:
                packets.append((datetime.now().isoformat(), line))
        except socket.timeout:
            continue
        except Exception as e:
            status(False, f"Error: {e}")
            return packets

    if len(packets) == 0:
        status(False, "ไม่มีข้อมูลเข้ามาเลย — เช็ค UDP_TARGET_IP ใน csi_component.h")
    else:
        status(True, f"ได้รับข้อมูล {len(packets)} packets ใน 3 วินาที")

    return packets


# =================== Step 3: Packet Rate ===================
def check_packet_rate(sock):
    print(f"\n  ⚡ Step 3 — วัด Packet Rate ({CHECK_SECS} วินาที)\n")
    print("     กำลังวัด", end="", flush=True)

    count  = 0
    start  = time.time()
    sock.settimeout(0.5)

    while time.time() - start < CHECK_SECS:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            if data:
                count += 1
                if count % 10 == 0:
                    print(".", end="", flush=True)
        except socket.timeout:
            continue
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

    return rate


# =================== Step 4: Format Check ===================
def check_format(packets):
    print("\n  🔬 Step 4 — เช็ค Format ของ CSI data\n")

    if not packets:
        status(False, "ไม่มีข้อมูลให้เช็ค")
        return False

    # หา line ที่มี CSI_DATA
    csi_line = None
    for _, line in packets:
        if "CSI_DATA" in line:
            csi_line = line
            break

    if not csi_line:
        status(False, "ไม่พบ CSI_DATA ใน packets — เช็ค SHOULD_COLLECT_CSI=1")
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
        status(True, "มี CSI subcarrier data [ ... ] ✅")
    else:
        warn("ไม่พบ [ ... ] — อาจยังไม่มี CSI data")

    return ok


# =================== Summary ===================
def print_summary(ip_ok, connected, has_data, rate, format_ok):
    print("\n" + "=" * 55)
    print("  📋 สรุปผลการเช็ค")
    print("=" * 55)
    status(ip_ok,           "IP firmware ตรงกับ Mac")
    status(connected,       "รับ UDP จาก ESP32")
    status(has_data,        "CSI data ไหลมา")
    status(rate >= MIN_RATE, f"Packet rate ({rate:.0f} pkt/s)")
    status(format_ok,       "Format ถูกต้อง")
    print()

    all_ok = ip_ok and connected and has_data and rate >= MIN_RATE and format_ok
    if all_ok:
        print("  🎉 พร้อมเก็บ data แล้ว! รัน csi_collector.py ได้เลย")
    else:
        print("  ⚠️  แก้ปัญหาด้านบนก่อนแล้วค่อยเก็บ data")

    if rate > 0 and rate < TARGET_RATE:
        print(f"\n  💡 Tip: แก้ PACKET_RATE={TARGET_RATE} ใน menuconfig")

    print("=" * 55 + "\n")


# =================== Main ===================
def main():
    clear()
    print_header()

    ip_ok = check_ip_match()

    sock, _ = check_connection()
    if sock is None:
        print_summary(ip_ok, False, False, 0, False)
        return

    packets  = check_data_flow(sock)
    has_data = len(packets) > 0

    rate = 0
    if has_data:
        rate = check_packet_rate(sock)

    format_ok = False
    if packets:
        format_ok = check_format(packets)

    sock.close()
    print_summary(ip_ok, True, has_data, rate, format_ok)


if __name__ == "__main__":
    main()