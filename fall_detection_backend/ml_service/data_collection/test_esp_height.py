
"""
test_esp_height.py
==================
ทดสอบตำแหน่งสูง-ต่ำของ ESP32 ว่าระดับไหนรับ CSI signal ได้ดีที่สุด

วิธีใช้:
  1. วาง ESP32 ที่ระดับความสูงที่ต้องการ
  2. รัน: python data_collection/test_esp_height.py
  3. เก็บ 5 วิ (ห้องว่างๆ ไม่ต้องมีคน)
  4. ย้าย ESP32 ไประดับอื่น → ทำซ้ำ
  5. กด r เพื่อดูผลเปรียบเทียบ

เก็บจากห้องว่างๆ เหมือนตอนเทสทะลุกำแพง
— วัดว่า signal quality ต่างกันแค่ไหนในแต่ละระดับ
"""

import socket
import time
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.preprocess import parse_csi_line

# =================== Config ===================
UDP_HOST      = "0.0.0.0"
UDP_PORT      = 5500
BUFFER_SIZE   = 4096
COLLECT_PKTS  = 500          # 5 วินาที (100 pkt/s)
N_SUBCARRIERS = 52


def collect_packets(sock, n_pkts):
    """เก็บ n packets จาก ESP32"""
    packets = []
    while len(packets) < n_pkts:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            line = data.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" in line:
                amp = parse_csi_line(line)
                if amp is not None:
                    packets.append(amp)
                    if len(packets) % 100 == 0:
                        print(f"\r    {len(packets)}/{n_pkts}", end="", flush=True)
        except socket.timeout:
            continue
    print()
    return np.array(packets)


def analyze(data):
    """วิเคราะห์คุณภาพ signal"""
    # Mean amplitude per subcarrier
    mean_amp = np.mean(data, axis=0)
    # Std per subcarrier (ยิ่งนิ่ง = ยิ่ง stable)
    std_amp = np.std(data, axis=0)
    # SNR estimate: mean / std (ยิ่งสูง = signal ดี noise น้อย)
    snr = np.where(std_amp > 0, mean_amp / std_amp, 0)

    # Dynamic range per subcarrier
    dyn_range = np.max(data, axis=0) - np.min(data, axis=0)

    # Variance across time (sensitivity ต่อการเปลี่ยนแปลง)
    temporal_var = np.var(data, axis=0)

    return {
        "mean_amp":      float(np.mean(mean_amp)),
        "std_amp":       float(np.mean(std_amp)),
        "snr":           float(np.mean(snr)),
        "dyn_range":     float(np.mean(dyn_range)),
        "temporal_var":  float(np.mean(temporal_var)),
        "active_subs":   int(np.sum(mean_amp > 1.0)),     # subcarriers ที่มี signal จริง
        "stable_subs":   int(np.sum(std_amp < 2.0)),      # subcarriers ที่ stable
        "amp_per_sub":   mean_amp,
    }


def print_result(name, stats):
    """แสดงผลระดับเดียว"""
    print(f"\n  {'─' * 50}")
    print(f"  {name}")
    print(f"  {'─' * 50}")
    print(f"    Mean Amplitude  : {stats['mean_amp']:.2f}")
    print(f"    Std (stability) : {stats['std_amp']:.2f}  (ต่ำ = stable)")
    print(f"    SNR (signal/noise): {stats['snr']:.2f}  (สูง = ดี)")
    print(f"    Dynamic Range   : {stats['dyn_range']:.2f}")
    print(f"    Active subs     : {stats['active_subs']}/{N_SUBCARRIERS}")
    print(f"    Stable subs     : {stats['stable_subs']}/{N_SUBCARRIERS}")

    # Mini amplitude chart (per subcarrier)
    amp = stats["amp_per_sub"]
    max_a = max(amp) if max(amp) > 0 else 1
    bar = ""
    for a in amp:
        level = int(a / max_a * 4)
        bar += ["░", "▒", "▓", "█", "█"][level]
    print(f"    Subcarriers     : [{bar}]")


def print_comparison(results):
    """เปรียบเทียบทุกระดับ"""
    if len(results) < 2:
        print("\n  ต้องเก็บอย่างน้อย 2 ระดับถึงจะเปรียบเทียบได้")
        return

    print(f"\n  {'=' * 60}")
    print(f"  COMPARISON")
    print(f"  {'=' * 60}")

    # Header
    names = [r["name"] for r in results]
    header = f"  {'Metric':<20}"
    for n in names:
        header += f" {n:>12}"
    print(header)
    print(f"  {'─' * (20 + 13 * len(names))}")

    metrics = [
        ("Mean Amplitude",  "mean_amp",     False),
        ("Stability (std)", "std_amp",      True),   # lower is better
        ("SNR",             "snr",          False),  # higher is better
        ("Dynamic Range",   "dyn_range",    False),
        ("Active subs",     "active_subs",  False),
        ("Stable subs",     "stable_subs",  False),
    ]

    scores = {r["name"]: 0 for r in results}

    for label, key, lower_better in metrics:
        values = [r["stats"][key] for r in results]
        row = f"  {label:<20}"

        if lower_better:
            best_val = min(values)
        else:
            best_val = max(values)

        for i, v in enumerate(values):
            is_best = (v == best_val)
            marker = " <--" if is_best else ""
            if is_best:
                scores[results[i]["name"]] += 1
            if isinstance(v, int):
                row += f" {v:>8}{marker}"
            else:
                row += f" {v:>8.2f}{marker}"
        print(row)

    # Winner
    print(f"\n  {'─' * 40}")
    best_name = max(scores, key=scores.get)
    print(f"  Score:")
    for name, score in sorted(scores.items(), key=lambda x: -x[1]):
        star = " *** BEST" if name == best_name else ""
        print(f"    {name}: {score}/{len(metrics)}{star}")

    print(f"\n  Recommendation: {best_name}")


def main():
    print("=" * 55)
    print("  ESP32 Height / Position Tester")
    print("=" * 55)
    print(f"  Collect {COLLECT_PKTS} pkts (~{COLLECT_PKTS // 100}s) per test")
    print(f"  Room should be EMPTY (no people)")
    print()

    # Connect
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_HOST, UDP_PORT))
    sock.settimeout(10.0)
    print(f"  Waiting for ESP32 on port {UDP_PORT}...")

    try:
        data, addr = sock.recvfrom(BUFFER_SIZE)
        print(f"  ESP32 connected: {addr[0]}\n")
    except socket.timeout:
        print("  Timeout — ESP32 not found")
        return

    sock.settimeout(1.0)

    results = []

    print("  Commands:")
    print("    Enter = collect at current height")
    print("    r     = show comparison results")
    print("    q     = quit\n")

    while True:
        cmd = input(f"  [{len(results)} tests done] Enter height name (e.g. 'พื้น', '50cm', '1m', 'โต๊ะ'): ").strip()

        if cmd.lower() == "q":
            break

        if cmd.lower() == "r":
            print_comparison(results)
            continue

        if cmd == "":
            print("    Enter a name for this height position")
            continue

        name = cmd
        print(f"    Collecting at '{name}'... keep room empty!")
        data = collect_packets(sock, COLLECT_PKTS)
        stats = analyze(data)
        print_result(name, stats)

        results.append({"name": name, "stats": stats})
        print(f"\n    Done! Move ESP32 to next height and test again.")
        print(f"    Press 'r' to compare all results so far.\n")

    # Auto show comparison on quit
    if len(results) >= 2:
        print_comparison(results)

    sock.close()


if __name__ == "__main__":
    main()
