"""
csi_wall_test.py
================
เก็บ CSI Data เปรียบเทียบ สภาพแวดล้อมปกติ vs มีกำแพงกั้น
ไม่ต้องล้ม — วัดแค่ static CSI เพื่อดูว่ากำแพงทำให้สัญญาณเปลี่ยนไปยังไง

วิธีใช้:
  python data_collection/csi_wall_test.py
"""

import socket
import csv
import time
import os
import numpy as np
import re
from datetime import datetime
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.gridspec import GridSpec
from scipy.stats import ks_2samp, skew, kurtosis
from scipy.signal import savgol_filter

# =================== Config ===================
UDP_HOST   = "0.0.0.0"
UDP_PORT   = 5500
BUFFER_SIZE = 4096

PACKET_RATE    = 100          # packets ต่อวินาที
DURATION       = 100           # เก็บ 100 วินาที ต่อ condition
PACKETS        = PACKET_RATE * DURATION
COUNTDOWN      = 3
N_SUBCARRIERS  = 52
WINDOW_SIZE    = 200          # ตรงกับ training config
FEATURE_NAMES  = ["Mean", "Min", "Max", "Std", "MAD", "IQR", "Skewness", "Kurtosis"]

# =================== Path ===================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR  = os.path.join(BASE_DIR, "data", "wall_test")
os.makedirs(OUT_DIR, exist_ok=True)

CONDITIONS = [
    ("no_wall",  "ไม่มีกำแพง (baseline)"),
    ("wall",     "มีกำแพงกั้น"),
]


# =================== Helpers ===================
def progress_bar(current, total, width=40):
    pct  = current / total
    done = int(pct * width)
    bar  = "█" * done + "░" * (width - done)
    print(f"\r  [{bar}] {current}/{total} pkts", end="", flush=True)


def countdown_timer(seconds):
    for i in range(seconds, 0, -1):
        print(f"\r  ⏳ เริ่มใน {i} วิ...  ", end="", flush=True)
        time.sleep(1)
    print(f"\r  🔴 กำลังบันทึก...      ", flush=True)


def parse_csi_amplitudes(raw_line):
    """ดึง CSI amplitude จาก raw line"""
    match = re.search(r'\[([-\d,\s]+)\]', raw_line)
    if not match:
        return None
    raw = match.group(1).replace(",", " ")
    values = [int(x) for x in raw.split() if x.lstrip("-").isdigit()]
    # CSI data = [real, imag, real, imag, ...] → amplitude = sqrt(r^2 + i^2)
    if len(values) < 2:
        return None
    amps = []
    for i in range(0, len(values) - 1, 2):
        r, im = values[i], values[i + 1]
        amps.append(np.sqrt(r**2 + im**2))
    return amps


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


# =================== Collect ===================
def collect_condition(sock, condition_id, condition_name):
    """เก็บ CSI data สำหรับ 1 condition"""
    print(f"\n  {'='*50}")
    print(f"  📍 Condition: {condition_name}")
    print(f"  📦 เก็บ {PACKETS} packets ({DURATION} วินาที)")
    print(f"  {'='*50}")

    input(f"  กด Enter เมื่อพร้อม...")
    countdown_timer(COUNTDOWN)

    packets = []
    start_time = time.time()

    while len(packets) < PACKETS:
        try:
            data, _ = sock.recvfrom(BUFFER_SIZE)
            line = data.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" not in line:
                continue
            packets.append({
                "timestamp": datetime.now().isoformat(),
                "condition": condition_id,
                "raw":       line,
            })
            progress_bar(len(packets), PACKETS)
        except socket.timeout:
            if time.time() - start_time > DURATION + 10:
                print(f"\n  ⚠️  Timeout — ได้ {len(packets)}/{PACKETS} packets")
                break

    print()

    # บันทึก CSV
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"csi_{condition_id}_{ts}.csv"
    filepath = os.path.join(OUT_DIR, filename)

    with open(filepath, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "condition", "raw"])
        writer.writeheader()
        writer.writerows(packets)

    print(f"  ✅ บันทึก → {filename} ({len(packets)} packets)")
    return filepath


# =================== Load Helper ===================
def load_amplitudes(filepath):
    """โหลด CSI amplitude จาก CSV → numpy array (N, subcarriers)"""
    amps_all = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            amps = parse_csi_amplitudes(row["raw"])
            if amps:
                amps_all.append(amps)
    if not amps_all:
        return np.array([])
    min_len = min(len(a) for a in amps_all)
    return np.array([a[:min_len] for a in amps_all])


def extract_8_features(amp_data):
    """
    คำนวณ 8 features ต่อ subcarrier (ตรงกับ training pipeline)
    Input:  amp_data shape (N_packets, N_subcarriers)
    Output: dict { feature_name: array(N_subcarriers) }
    """
    feats = {}
    feats["Mean"]     = np.mean(amp_data, axis=0)
    feats["Min"]      = np.min(amp_data, axis=0)
    feats["Max"]      = np.max(amp_data, axis=0)
    feats["Std"]      = np.std(amp_data, axis=0)
    mean_expanded      = feats["Mean"][np.newaxis, :]
    feats["MAD"]      = np.mean(np.abs(amp_data - mean_expanded), axis=0)
    feats["IQR"]      = np.percentile(amp_data, 75, axis=0) - np.percentile(amp_data, 25, axis=0)
    feats["Skewness"] = skew(amp_data, axis=0, nan_policy="omit")
    feats["Kurtosis"] = kurtosis(amp_data, axis=0, nan_policy="omit")
    return feats


# =================== Analyze ===================
def analyze(file_a, file_b):
    """เทียบ CSI ระหว่าง 2 condition ครบ 8 features + สร้างกราฟ"""
    print(f"\n  {'='*50}")
    print(f"  📊 วิเคราะห์ผล (8 Features × {N_SUBCARRIERS} Subcarriers)")
    print(f"  {'='*50}")

    amp_a = load_amplitudes(file_a)
    amp_b = load_amplitudes(file_b)

    if amp_a.size == 0 or amp_b.size == 0:
        print("  ❌ parse CSI ไม่ได้ — ตรวจ format ใน CSV")
        return

    n_sub = min(amp_a.shape[1], amp_b.shape[1])
    amp_a = amp_a[:, :n_sub]
    amp_b = amp_b[:, :n_sub]

    # Smooth เหมือน training pipeline
    if amp_a.shape[0] >= 11:
        amp_a_smooth = savgol_filter(amp_a, window_length=11, polyorder=3, axis=0)
    else:
        amp_a_smooth = amp_a
    if amp_b.shape[0] >= 11:
        amp_b_smooth = savgol_filter(amp_b, window_length=11, polyorder=3, axis=0)
    else:
        amp_b_smooth = amp_b

    # คำนวณ 8 features ทั้ง 2 condition
    feats_a = extract_8_features(amp_a_smooth)
    feats_b = extract_8_features(amp_b_smooth)

    # % change ต่อ feature ต่อ subcarrier
    pct_change = {}
    for fname in FEATURE_NAMES:
        denom = np.abs(feats_a[fname]) + 1e-9
        pct_change[fname] = (feats_b[fname] - feats_a[fname]) / denom * 100

    # KS test บน raw amplitude
    ks_stat, ks_p = ks_2samp(amp_a.flatten(), amp_b.flatten())
    correlation = np.corrcoef(feats_a["Mean"], feats_b["Mean"])[0, 1]
    snr_a = (feats_a["Mean"] / (feats_a["Std"] + 1e-9)).mean()
    snr_b = (feats_b["Mean"] / (feats_b["Std"] + 1e-9)).mean()

    overall_pct = (feats_b["Mean"].mean() - feats_a["Mean"].mean()) / (feats_a["Mean"].mean() + 1e-9) * 100

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    # ============================================================
    #  Terminal: Metric Summary Table (8 features)
    # ============================================================
    print(f"\n  📈 Feature Comparison (averaged across {n_sub} subcarriers):")
    print(f"  ┌────────────┬────────────┬────────────┬───────────┐")
    print(f"  │  Feature   │  No Wall   │   Wall     │  Change % │")
    print(f"  ├────────────┼────────────┼────────────┼───────────┤")
    for fname in FEATURE_NAMES:
        va = feats_a[fname].mean()
        vb = feats_b[fname].mean()
        pc = pct_change[fname].mean()
        print(f"  │  {fname:<9s} │  {va:>8.2f}  │  {vb:>8.2f}  │  {pc:>+6.1f}%  │")
    print(f"  ├────────────┼────────────┼────────────┼───────────┤")
    print(f"  │  KS Stat   │         {ks_stat:>8.4f}          │           │")
    print(f"  │  KS p-val  │         {ks_p:>8.2e}          │           │")
    print(f"  │  Corr (r)  │         {correlation:>8.4f}          │           │")
    print(f"  │  SNR       │  {snr_a:>8.2f}  │  {snr_b:>8.2f}  │           │")
    print(f"  └────────────┴────────────┴────────────┴───────────┘")

    # ============================================================
    #  Plot 1 — 8 Features Comparison (2×4 grid)
    # ============================================================
    fig, axes = plt.subplots(2, 4, figsize=(20, 8))
    fig.suptitle("CSI Wall Effect — All 8 Features per Subcarrier", fontsize=16, fontweight="bold")

    x = np.arange(n_sub)
    for idx, fname in enumerate(FEATURE_NAMES):
        ax = axes[idx // 4, idx % 4]
        ax.plot(x, feats_a[fname], label="No Wall", color="#2196F3", linewidth=1.2)
        ax.plot(x, feats_b[fname], label="Wall", color="#F44336", linewidth=1.2)
        avg_pct = pct_change[fname].mean()
        ax.set_title(f"{fname}  ({avg_pct:+.1f}%)", fontsize=11)
        ax.set_xlabel("Subcarrier")
        ax.legend(fontsize=8)
        ax.grid(True, alpha=0.3)

    plt.tight_layout()
    fig1_path = os.path.join(OUT_DIR, f"wall_8features_{ts}.png")
    plt.savefig(fig1_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"\n  📊 8-Feature Comparison → {fig1_path}")

    # ============================================================
    #  Plot 2 — % Change Heatmap (features × subcarriers)
    # ============================================================
    fig2, ax2 = plt.subplots(figsize=(14, 4))
    pct_matrix = np.array([pct_change[f] for f in FEATURE_NAMES])  # (8, n_sub)
    im = ax2.imshow(pct_matrix, aspect="auto", cmap="RdBu_r", vmin=-100, vmax=100)
    ax2.set_yticks(range(len(FEATURE_NAMES)))
    ax2.set_yticklabels(FEATURE_NAMES)
    ax2.set_xlabel("Subcarrier Index")
    ax2.set_title("% Change per Feature per Subcarrier (Wall vs No Wall)", fontsize=13, fontweight="bold")
    fig2.colorbar(im, ax=ax2, label="% Change", shrink=0.8)
    plt.tight_layout()
    fig2_path = os.path.join(OUT_DIR, f"wall_pct_heatmap_{ts}.png")
    plt.savefig(fig2_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  🗺️  % Change Heatmap → {fig2_path}")

    # ============================================================
    #  Plot 3 — Dashboard summary (amplitude + distribution + heatmap + metrics)
    # ============================================================
    fig3 = plt.figure(figsize=(16, 10))
    gs = GridSpec(2, 3, figure=fig3)
    fig3.suptitle("CSI Wall Effect — Dashboard", fontsize=16, fontweight="bold")

    # 3a) Amplitude comparison with std band
    ax = fig3.add_subplot(gs[0, 0])
    ax.plot(x, feats_a["Mean"], label="No Wall", color="#2196F3", linewidth=1.5)
    ax.fill_between(x, feats_a["Mean"] - feats_a["Std"], feats_a["Mean"] + feats_a["Std"],
                    alpha=0.2, color="#2196F3")
    ax.plot(x, feats_b["Mean"], label="Wall", color="#F44336", linewidth=1.5)
    ax.fill_between(x, feats_b["Mean"] - feats_b["Std"], feats_b["Mean"] + feats_b["Std"],
                    alpha=0.2, color="#F44336")
    ax.set_title("Mean Amplitude ± Std")
    ax.set_xlabel("Subcarrier")
    ax.legend()
    ax.grid(True, alpha=0.3)

    # 3b) % Change bar
    ax = fig3.add_subplot(gs[0, 1])
    colors = ["#F44336" if v < 0 else "#4CAF50" for v in pct_change["Mean"]]
    ax.bar(x, pct_change["Mean"], color=colors, alpha=0.8, width=1.0)
    ax.axhline(0, color="black", linewidth=0.8)
    ax.axhline(overall_pct, color="#FF9800", linestyle="--", label=f"Overall: {overall_pct:+.1f}%")
    ax.set_title("Mean Amplitude % Change")
    ax.set_xlabel("Subcarrier")
    ax.set_ylabel("%")
    ax.legend()
    ax.grid(True, alpha=0.3)

    # 3c) Distribution
    ax = fig3.add_subplot(gs[0, 2])
    ax.hist(amp_a.flatten(), bins=60, alpha=0.6, color="#2196F3", label="No Wall", density=True)
    ax.hist(amp_b.flatten(), bins=60, alpha=0.6, color="#F44336", label="Wall", density=True)
    ax.set_title(f"Distribution (KS={ks_stat:.3f})")
    ax.set_xlabel("Amplitude")
    ax.legend()
    ax.grid(True, alpha=0.3)

    # 3d) Heatmap: no wall
    max_pkts = min(200, amp_a.shape[0], amp_b.shape[0])
    vmin = min(amp_a[:max_pkts].min(), amp_b[:max_pkts].min())
    vmax = max(amp_a[:max_pkts].max(), amp_b[:max_pkts].max())

    ax = fig3.add_subplot(gs[1, 0])
    ax.imshow(amp_a[:max_pkts], aspect="auto", cmap="viridis", vmin=vmin, vmax=vmax)
    ax.set_title("Heatmap — No Wall")
    ax.set_xlabel("Subcarrier")
    ax.set_ylabel("Packet #")

    # 3e) Heatmap: wall
    ax = fig3.add_subplot(gs[1, 1])
    im = ax.imshow(amp_b[:max_pkts], aspect="auto", cmap="viridis", vmin=vmin, vmax=vmax)
    ax.set_title("Heatmap — Wall")
    ax.set_xlabel("Subcarrier")
    ax.set_ylabel("Packet #")

    # 3f) Metrics table
    ax = fig3.add_subplot(gs[1, 2])
    ax.axis("off")
    rows = [
        ["Overall Amp Change", f"{overall_pct:+.1f}%"],
        ["Mean (No Wall)", f"{feats_a['Mean'].mean():.2f}"],
        ["Mean (Wall)", f"{feats_b['Mean'].mean():.2f}"],
        ["Std Change", f"{pct_change['Std'].mean():+.1f}%"],
        ["MAD Change", f"{pct_change['MAD'].mean():+.1f}%"],
        ["IQR Change", f"{pct_change['IQR'].mean():+.1f}%"],
        ["Skewness Change", f"{pct_change['Skewness'].mean():+.1f}%"],
        ["Kurtosis Change", f"{pct_change['Kurtosis'].mean():+.1f}%"],
        ["SNR (No Wall)", f"{snr_a:.2f}"],
        ["SNR (Wall)", f"{snr_b:.2f}"],
        ["KS Statistic", f"{ks_stat:.4f}"],
        ["Correlation (r)", f"{correlation:.4f}"],
    ]
    tbl = ax.table(cellText=rows, colLabels=["Metric", "Value"],
                   cellLoc="center", loc="center", colWidths=[0.55, 0.35])
    tbl.auto_set_font_size(False)
    tbl.set_fontsize(9)
    tbl.scale(1, 1.4)
    for j in range(2):
        tbl[0, j].set_facecolor("#333333")
        tbl[0, j].set_text_props(color="white", fontweight="bold")
    for i in range(1, len(rows) + 1):
        c = "#f5f5f5" if i % 2 == 0 else "white"
        for j in range(2):
            tbl[i, j].set_facecolor(c)
    ax.set_title("All Metrics", fontsize=11, fontweight="bold", pad=15)

    plt.tight_layout()
    fig3_path = os.path.join(OUT_DIR, f"wall_dashboard_{ts}.png")
    plt.savefig(fig3_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  📊 Dashboard → {fig3_path}")

    # ============================================================
    #  CSV Report — ครบ 8 features ต่อ subcarrier
    # ============================================================
    report_path = os.path.join(OUT_DIR, f"wall_report_{ts}.csv")
    with open(report_path, "w", newline="") as f:
        writer = csv.writer(f)
        header = ["subcarrier"]
        for fname in FEATURE_NAMES:
            header.extend([f"{fname}_no_wall", f"{fname}_wall", f"{fname}_pct_change"])
        writer.writerow(header)
        for i in range(n_sub):
            row = [i]
            for fname in FEATURE_NAMES:
                row.extend([
                    f"{feats_a[fname][i]:.4f}",
                    f"{feats_b[fname][i]:.4f}",
                    f"{pct_change[fname][i]:.2f}",
                ])
            writer.writerow(row)
    print(f"  📄 CSV Report (8 features × {n_sub} subcarriers) → {report_path}")

    # ============================================================
    #  สรุป
    # ============================================================
    print(f"\n  💡 สรุป:")
    if ks_p > 0.05:
        print(f"  KS test: distribution ไม่ต่างกันนัยสำคัญ (p={ks_p:.3f}) — กำแพงมีผลน้อย")
    else:
        print(f"  KS test: distribution ต่างกันอย่างมีนัยสำคัญ (p={ks_p:.2e})")

    if abs(overall_pct) < 15:
        print(f"  Amplitude drop {overall_pct:+.1f}% → ผลน้อย — model น่าจะยังใช้ได้")
    elif abs(overall_pct) < 35:
        print(f"  Amplitude drop {overall_pct:+.1f}% → ผลปานกลาง — ควร fine-tune model")
    else:
        print(f"  Amplitude drop {overall_pct:+.1f}% → ผลมาก — ควรย้าย ESP32 หรือเพิ่ม AP")

    if correlation > 0.9:
        print(f"  Correlation r={correlation:.3f} → subcarrier pattern ยังคล้ายเดิม (ดี)")
    elif correlation > 0.7:
        print(f"  Correlation r={correlation:.3f} → pattern เปลี่ยนปานกลาง")
    else:
        print(f"  Correlation r={correlation:.3f} → pattern เปลี่ยนมาก (อันตราย)")

    # สรุป feature ที่เปลี่ยนมากสุด
    print(f"\n  📊 Feature ที่เปลี่ยนมากสุด:")
    ranked = sorted(FEATURE_NAMES, key=lambda f: abs(pct_change[f].mean()), reverse=True)
    for fname in ranked[:3]:
        print(f"     {fname}: {pct_change[fname].mean():+.1f}%")


# =================== Main ===================
def select_conditions():
    """ให้ผู้ใช้เลือกว่าจะเก็บ condition ไหน"""
    print("\n  เลือก mode:")
    print("    1) เก็บทั้ง 2 condition (ไม่มีกำแพง → มีกำแพง)")
    print("    2) เก็บเฉพาะ ไม่มีกำแพง (baseline)")
    print("    3) เก็บเฉพาะ มีกำแพงกั้น")
    print("    4) วิเคราะห์จากไฟล์ที่มีอยู่แล้ว")

    choice = input("\n  เลือก (1-4): ").strip()

    if choice == "1":
        return CONDITIONS, False
    elif choice == "2":
        return [CONDITIONS[0]], False
    elif choice == "3":
        return [CONDITIONS[1]], False
    elif choice == "4":
        return [], True
    else:
        print("  ❌ เลือกไม่ถูก — ใช้ mode 1")
        return CONDITIONS, False


def select_existing_files():
    """ให้เลือกไฟล์ที่มีอยู่แล้วเพื่อวิเคราะห์"""
    csvs = sorted([f for f in os.listdir(OUT_DIR) if f.endswith(".csv")])
    if len(csvs) < 2:
        print(f"  ❌ ต้องมีไฟล์อย่างน้อย 2 ไฟล์ใน {OUT_DIR}")
        return None, None

    print(f"\n  ไฟล์ที่มี ({OUT_DIR}):")
    for i, f in enumerate(csvs, 1):
        print(f"    {i}) {f}")

    try:
        a = int(input("\n  เลือกไฟล์ no_wall (เลข): ").strip()) - 1
        b = int(input("  เลือกไฟล์ wall (เลข): ").strip()) - 1
        return os.path.join(OUT_DIR, csvs[a]), os.path.join(OUT_DIR, csvs[b])
    except (ValueError, IndexError):
        print("  ❌ เลือกไม่ถูก")
        return None, None


def main():
    print("=" * 55)
    print("  🧱  CSI Wall Effect Tester")
    print(f"  เก็บ {DURATION} วิ/condition  ({PACKETS} packets)")
    print(f"  Output: {OUT_DIR}")
    print("=" * 55)
    print("  ⚠️  วางห้องว่าง ไม่มีคนเดินผ่าน ระหว่างเก็บ data")

    selected, analyze_only = select_conditions()

    if analyze_only:
        f1, f2 = select_existing_files()
        if f1 and f2:
            analyze(f1, f2)
        return

    sock = connect_esp32()
    if sock is None:
        return

    try:
        files = []
        for cond_id, cond_name in selected:
            filepath = collect_condition(sock, cond_id, cond_name)
            files.append(filepath)

            if cond_id == "no_wall" and len(selected) > 1:
                print(f"\n  🧱 ย้าย ESP32 ให้มีกำแพงกั้น แล้วกด Enter")

        # วิเคราะห์ถ้าเก็บครบ 2 condition
        if len(files) == 2:
            analyze(files[0], files[1])

    except KeyboardInterrupt:
        print(f"\n  ⛔ หยุดโดยผู้ใช้")
    finally:
        sock.close()
        print(f"\n  👋 เสร็จแล้ว\n")


if __name__ == "__main__":
    main()
