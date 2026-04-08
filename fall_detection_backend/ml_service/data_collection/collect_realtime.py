"""
collect_realtime.py
===================
เก็บ raw CSI packets จาก real-time stream พร้อม label + sub-label (ท่า)
สำหรับ train ทั้ง RF, One-Class, และ LSTM จาก data ชุดเดียว

วิธีใช้:[p]
  python data_collection/collect_realtime.py

Flow (Fall):
  1. เลือกท่า fall (กด 1-5)
  2. กด Enter → เริ่มเก็บ 650 pkts
  3. ทำท่าล้ม แล้ว กด Enter อีกครั้งตอนล้ม → mark ตำแหน่ง
  4. รอเก็บครบ → RF ใช้ 200 pkts รอบจุด mark

Flow (Non-fall):
  1. เลือกท่า non-fall (กด 6-0, a)
  2. กด Enter → เก็บ 650 pkts อัตโนมัติ
  3. RF ใช้ window ที่มี motion มากสุด

Output files:
  data/realtime/
    raw_rt.npy, y_rt.npy, poses_rt.npy, marks_rt.npy
    X_rt.npy (N, 416)            — RF/One-Class
    X_rt_seq.npy (M, 10, 416)    — LSTM
    y_rt_seq.npy (M,)
"""

import socket
import time
import os
import sys
import threading
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app.preprocess import extract_features, parse_csi_line
from scipy.signal import savgol_filter

# =================== Config ===================
UDP_HOST    = "0.0.0.0"
UDP_PORT    = 5500
BUFFER_SIZE = 4096
WINDOW_SIZE = 200
STRIDE      = 50
SEQUENCE_LEN = 10
TOTAL_NEEDED = WINDOW_SIZE + (SEQUENCE_LEN - 1) * STRIDE  # 650

POSE_ID = {"1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
           "6": 6, "7": 7, "8": 8, "9": 9, "0": 0, "a": 10}
 
POSES = {
    "1": {"name": "ล้มหน้า",       "label": 0, "target": 60},
    "2": {"name": "ล้มหลัง",       "label": 0, "target": 60},
    "3": {"name": "ล้มข้าง",       "label": 0, "target": 60},
    "4": {"name": "ล้มทรุดตัว",     "label": 0, "target": 60},
    "5": {"name": "ล้มสะดุด",      "label": 0, "target": 60},
    "6": {"name": "ยืนนิ่ง",       "label": 1, "target": 40},
    "7": {"name": "เดิน",         "label": 1, "target": 70},
    "8": {"name": "นั่ง-ลุก",      "label": 1, "target": 70},
    "9": {"name": "ก้มหยิบของ",    "label": 1, "target": 70},
    "0": {"name": "ห้องว่าง",      "label": 1, "target": 30},
    "a": {"name": "เดินเร็ว-วิ่ง",  "label": 1, "target": 50},
}

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR  = os.path.join(BASE_DIR, "data", "realtime")
os.makedirs(OUT_DIR, exist_ok=True)

RAW_PATH    = os.path.join(OUT_DIR, "raw_rt.npy")
Y_PATH      = os.path.join(OUT_DIR, "y_rt.npy")
POSES_PATH  = os.path.join(OUT_DIR, "poses_rt.npy")
MARKS_PATH  = os.path.join(OUT_DIR, "marks_rt.npy")
X_RF_PATH   = os.path.join(OUT_DIR, "X_rt.npy")
X_SEQ_PATH  = os.path.join(OUT_DIR, "X_rt_seq.npy")
Y_SEQ_PATH  = os.path.join(OUT_DIR, "y_rt_seq.npy")


def apply_filter(arr):
    if len(arr) >= 11:
        return savgol_filter(arr, window_length=11, polyorder=3, axis=0)
    return arr


def get_rf_window(raw_filtered, mark_idx):
    """เลือก RF window (200 pkts)
    - mark_idx >= 0: center window รอบจุด mark
    - mark_idx == -1: window ที่มี motion มากสุด (non-fall)
    """
    total = len(raw_filtered)

    if mark_idx >= 0:
        start = mark_idx - WINDOW_SIZE // 2
        start = max(0, min(start, total - WINDOW_SIZE))
    else:
        start = total - WINDOW_SIZE
        best_std = -1
        for s in range(0, total - WINDOW_SIZE + 1, 10):
            w_std = np.mean(np.std(raw_filtered[s:s + WINDOW_SIZE], axis=0))
            if w_std > best_std:
                best_std = w_std
                start = s

    return start, raw_filtered[start:start + WINDOW_SIZE]


def show_timeline(raw_filtered, mark_idx, rf_start):
    """แสดง motion timeline + mark + RF window"""
    total = len(raw_filtered)
    n_bins = 10
    bin_size = max(1, total // n_bins)

    stds = []
    for i in range(n_bins):
        chunk = raw_filtered[i * bin_size:(i + 1) * bin_size]
        stds.append(np.mean(np.std(chunk, axis=0)) if len(chunk) > 1 else 0)
    max_std = max(stds) if max(stds) > 0 else 1

    # Motion bar
    bars = []
    for s in stds:
        level = int(s / max_std * 4)
        bars.append(["░", "▒", "▓", "█", "█"][level])

    # Mark position overlay
    mark_line = list(" " * n_bins)
    if mark_idx >= 0:
        mb = min(mark_idx // bin_size, n_bins - 1)
        bars[mb] = "X"
        mark_line[mb] = "↑"

    # RF window bracket
    rf_line = list(" " * n_bins)
    rb_start = min(rf_start // bin_size, n_bins - 1)
    rb_end = min((rf_start + WINDOW_SIZE) // bin_size, n_bins - 1)
    for i in range(rb_start, rb_end + 1):
        rf_line[i] = "="
    rf_line[rb_start] = "["
    rf_line[rb_end] = "]"

    print(f"    Motion:    [{(''.join(bars))}]  (0s → {total / 100:.0f}s)")
    if mark_idx >= 0:
        print(f"    Mark:       {''.join(mark_line)}   ({mark_idx / 100:.1f}s)")
    print(f"    RF window:  {''.join(rf_line)}   ({rf_start / 100:.1f}s - {(rf_start + WINDOW_SIZE) / 100:.1f}s)")


def process_and_save(raw_all, y_all, pose_all, marks_all):
    """Process raw packets → RF features + LSTM sequences"""
    X_rf, y_rf = [], []
    X_seq, y_seq = [], []

    for raw, label, mark in zip(raw_all, y_all, marks_all):
        raw_filtered = apply_filter(np.array(raw))

        # RF / One-Class
        _, window = get_rf_window(raw_filtered, mark)
        X_rf.append(extract_features(window))
        y_rf.append(label)

        # LSTM
        if len(raw_filtered) >= TOTAL_NEEDED:
            windows = []
            for i in range(SEQUENCE_LEN):
                s = i * STRIDE
                windows.append(extract_features(raw_filtered[s:s + WINDOW_SIZE]))
            X_seq.append(windows)
            y_seq.append(label)

    np.save(RAW_PATH, np.array(raw_all, dtype=object), allow_pickle=True)
    np.save(Y_PATH, np.array(y_all, dtype=np.int32))
    np.save(POSES_PATH, np.array(pose_all, dtype=np.int32))
    np.save(MARKS_PATH, np.array(marks_all, dtype=np.int32))
    np.save(X_RF_PATH, np.array(X_rf, dtype=np.float32))

    n_seq = 0
    if X_seq:
        np.save(X_SEQ_PATH, np.array(X_seq, dtype=np.float32))
        np.save(Y_SEQ_PATH, np.array(y_seq, dtype=np.int32))
        n_seq = len(X_seq)

    return len(X_rf), n_seq


def main():
    print("=" * 55)
    print("  Real-time Collector (RF + One-Class + LSTM)")
    print("=" * 55)
    print(f"  WINDOW={WINDOW_SIZE} STRIDE={STRIDE} SEQ_LEN={SEQUENCE_LEN}")
    print(f"  Packets per sample: {TOTAL_NEEDED} (~{TOTAL_NEEDED / 100:.0f}s)")
    print()

    # ── Connect + Quick Check ──
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((UDP_HOST, UDP_PORT))
    sock.settimeout(10.0)
    print(f"  Waiting for ESP32 on port {UDP_PORT}...")

    try:
        data, addr = sock.recvfrom(BUFFER_SIZE)
        print(f"  ESP32 connected: {addr[0]}")
    except socket.timeout:
        print("  Timeout — ESP32 not found")
        return

    # Quick packet rate check (2 วินาที)
    sock.settimeout(1.0)
    pkt_count = 0
    csi_count = 0
    t_start = time.time()
    while time.time() - t_start < 2.0:
        try:
            d, _ = sock.recvfrom(BUFFER_SIZE)
            pkt_count += 1
            line = d.decode("utf-8", errors="ignore").strip()
            if "CSI_DATA" in line:
                amp = parse_csi_line(line)
                if amp is not None:
                    csi_count += 1
        except socket.timeout:
            continue
    elapsed = time.time() - t_start
    rate = csi_count / elapsed if elapsed > 0 else 0

    print(f"  Packet rate: {rate:.0f} pkt/s ({csi_count} CSI packets in {elapsed:.1f}s)")
    if rate < 50:
        print(f"  WARNING: rate too low ({rate:.0f} pkt/s) — check ESP32 config")
        confirm = input("  Continue anyway? (y/n): ").strip().lower()
        if confirm != "y":
            sock.close()
            return
    elif rate < 80:
        print(f"  Rate slightly low but OK")
    else:
        print(f"  Rate OK!")

    sock.settimeout(0.5)

    # ── Load existing ──
    if (os.path.exists(RAW_PATH) and os.path.exists(Y_PATH)
            and os.path.exists(POSES_PATH) and os.path.exists(MARKS_PATH)):
        raw_all   = list(np.load(RAW_PATH, allow_pickle=True))
        y_all     = list(np.load(Y_PATH))
        pose_all  = list(np.load(POSES_PATH))
        marks_all = list(np.load(MARKS_PATH))
        print(f"  Loaded existing: {len(raw_all)} samples")
    else:
        raw_all, y_all, pose_all, marks_all = [], [], [], []

    pose_counts = {key: 0 for key in POSES}
    for p in pose_all:
        for key, pid in POSE_ID.items():
            if p == pid:
                pose_counts[key] += 1

    # ── Shared state ──
    temp_buf = []           # shared packet buffer (accessible from both threads)
    temp_lock = threading.Lock()
    collecting = False
    collect_done = threading.Event()
    running = True
    # Motion tracking: std ของ 50 packets ล่าสุด เพื่อแสดง spike
    motion_history = []     # list of (pkt_idx, std_value)

    def calc_motion(buf, last_n=50):
        """คำนวณ motion level จาก n packets ล่าสุด"""
        if len(buf) < last_n:
            return 0.0
        chunk = np.array(buf[-last_n:])
        return float(np.mean(np.std(chunk, axis=0)))

    def motion_bar(std_val, max_val, width=20):
        """สร้าง bar แสดง motion level"""
        if max_val <= 0:
            max_val = 1
        ratio = min(std_val / max_val, 1.0)
        filled = int(ratio * width)
        bar = "█" * filled + "░" * (width - filled)
        return bar

    def recv_loop():
        while running:
            try:
                data, _ = sock.recvfrom(BUFFER_SIZE)
                line = data.decode("utf-8", errors="ignore").strip()
                if "CSI_DATA" in line:
                    amp = parse_csi_line(line)
                    if amp is not None:
                        if collecting:
                            with temp_lock:
                                temp_buf.append(amp)
                                # คำนวณ motion ทุก 10 packets
                                if len(temp_buf) % 10 == 0 and len(temp_buf) >= 50:
                                    m = calc_motion(temp_buf)
                                    motion_history.append((len(temp_buf), m))
                                if len(temp_buf) >= TOTAL_NEEDED:
                                    collect_done.set()
            except socket.timeout:
                continue

    thread = threading.Thread(target=recv_loop, daemon=True)
    thread.start()
    print("  Ready!\n")

    # ── Helpers ──
    def progress_bar(current, target, width=20):
        filled = int(width * min(current, target) / target)
        bar = "█" * filled + "░" * (width - filled)
        pct = min(current / target * 100, 100)
        check = " ✅" if current >= target else ""
        return f"|{bar}| {current}/{target} ({pct:.0f}%){check}"

    def show_progress():
        n_fall = sum(pose_counts[k] for k in POSES if POSES[k]["label"] == 0)
        n_nf   = sum(pose_counts[k] for k in POSES if POSES[k]["label"] == 1)
        t_fall = sum(POSES[k]["target"] for k in POSES if POSES[k]["label"] == 0)
        t_nf   = sum(POSES[k]["target"] for k in POSES if POSES[k]["label"] == 1)

        print(f"\n  {'─' * 50}")
        print(f"  FALL ({n_fall}/{t_fall})")
        for key in POSES:
            if POSES[key]["label"] == 0:
                pp = POSES[key]
                print(f"    [{key}] {pp['name']:10s} {progress_bar(pose_counts[key], pp['target'])}")
        print(f"\n  NON_FALL ({n_nf}/{t_nf})")
        for key in POSES:
            if POSES[key]["label"] == 1:
                pp = POSES[key]
                print(f"    [{key}] {pp['name']:10s} {progress_bar(pose_counts[key], pp['target'])}")
        print(f"  {'─' * 50}")
        print(f"  Total: {n_fall + n_nf}/{t_fall + t_nf}")
        if n_fall >= t_fall and n_nf >= t_nf:
            print("  All targets reached! Press 's' to save")
        print()

    show_progress()
    print("  [0-9,a] select pose | Enter collect | s save | u undo | p progress | q quit")

    current_pose = None

    while True:
        pose_name = POSES[current_pose]["name"] if current_pose else "-"
        cmd = input(f"  [pose: {pose_name}] > ").strip().lower()

        if cmd == "q":
            print("  Exiting without saving")
            break

        if cmd == "s":
            if raw_all:
                n_rf, n_seq = process_and_save(raw_all, y_all, pose_all, marks_all)
                n_fall = sum(1 for y in y_all if y == 0)
                n_nf   = sum(1 for y in y_all if y == 1)
                n_marked = sum(1 for m in marks_all if m >= 0)
                print(f"\n  Saved {len(raw_all)} samples -> {OUT_DIR}")
                print(f"    fall: {n_fall}, non_fall: {n_nf}, marked: {n_marked}")
                print(f"    RF/One-Class: X_rt.npy ({n_rf}, 416)")
                print(f"    LSTM:         X_rt_seq.npy ({n_seq}, {SEQUENCE_LEN}, 416)")
            else:
                print("  No data to save")
            break

        if cmd == "u":
            if raw_all:
                removed_pose_id = pose_all[-1]
                removed_label = y_all[-1]
                raw_all.pop()
                y_all.pop()
                pose_all.pop()
                marks_all.pop()
                # ลด pose count
                for key, pid in POSE_ID.items():
                    if removed_pose_id == pid:
                        pose_counts[key] = max(0, pose_counts[key] - 1)
                        icon = "FALL" if POSES[key]["label"] == 0 else "NON_FALL"
                        print(f"    Undo: removed last sample [{icon}] {POSES[key]['name']} (remaining: {len(raw_all)})")
                        break
            else:
                print("    Nothing to undo")
            continue

        if cmd == "p":
            show_progress()
            continue

        if cmd in POSES:
            current_pose = cmd
            p = POSES[cmd]
            is_fall = (p["label"] == 0)
            icon = "FALL" if is_fall else "NON_FALL"
            print(f"    [{icon}] {p['name']} ({pose_counts[cmd]}/{p['target']})")
            if is_fall:
                print(f"    Enter → start collecting → Enter again when you FALL")
            else:
                print(f"    Enter → auto collect {TOTAL_NEEDED} pkts (~{TOTAL_NEEDED / 100:.0f}s)")
            continue

        # ── Collect ──
        if cmd == "" and current_pose is not None:
            p = POSES[current_pose]
            is_fall = (p["label"] == 0)
            mark_idx = -1

            # Clear buffer and start
            with temp_lock:
                temp_buf.clear()
            collecting = True
            collect_done.clear()

            # Clear motion history
            motion_history.clear()

            if is_fall:
                # ═══ FALL: รอ Enter เพื่อ mark ═══
                print(f"    Collecting... do your pose then press Enter when you FALL!")
                print(f"    Motion: [░░░░░░░░░░░░░░░░░░░░]  ← spike = fall detected")

                # Progress thread (แสดง progress + motion bar)
                stop_progress = threading.Event()

                def show_collect_progress():
                    while not stop_progress.is_set():
                        with temp_lock:
                            n = len(temp_buf)
                            if len(temp_buf) >= 50:
                                cur_motion = calc_motion(temp_buf)
                            else:
                                cur_motion = 0
                        # หา max motion จาก history
                        max_m = max((m for _, m in motion_history), default=1) * 1.2
                        if max_m < 1:
                            max_m = 5  # default scale
                        bar = motion_bar(cur_motion, max_m)
                        pct = n / TOTAL_NEEDED * 100
                        sec = n / 100
                        print(f"\r    [{sec:.1f}s] {n}/{TOTAL_NEEDED} ({pct:.0f}%) Motion:[{bar}] {cur_motion:.1f}  ", end="", flush=True)
                        if collect_done.is_set():
                            break
                        time.sleep(0.2)

                prog_thread = threading.Thread(target=show_collect_progress, daemon=True)
                prog_thread.start()

                # Block จนกด Enter = mark
                input()
                with temp_lock:
                    mark_idx = len(temp_buf)
                mark_sec = mark_idx / 100

                stop_progress.set()
                print(f"\r    Marked at packet {mark_idx} ({mark_sec:.1f}s)                                                      ")

                # รอเก็บครบ (ถ้ายังไม่ครบ)
                if not collect_done.is_set():
                    print(f"    Collecting remaining packets...")
                    collect_done.wait(timeout=15)

            else:
                # ═══ NON-FALL: รอเก็บครบ + แสดง motion ═══
                while not collect_done.is_set():
                    with temp_lock:
                        n = len(temp_buf)
                        if len(temp_buf) >= 50:
                            cur_motion = calc_motion(temp_buf)
                        else:
                            cur_motion = 0
                    max_m = max((m for _, m in motion_history), default=1) * 1.2
                    if max_m < 1:
                        max_m = 5
                    bar = motion_bar(cur_motion, max_m)
                    pct = n / TOTAL_NEEDED * 100
                    sec = n / 100
                    print(f"\r    [{sec:.1f}s] {n}/{TOTAL_NEEDED} ({pct:.0f}%) Motion:[{bar}] {cur_motion:.1f}  ", end="", flush=True)
                    time.sleep(0.2)
                print()

            collecting = False

            # ── ดึง data ──
            with temp_lock:
                raw_data = temp_buf.copy()

            if len(raw_data) < WINDOW_SIZE:
                print("    Collection failed — not enough packets")
                continue

            raw_arr = np.array(raw_data)
            raw_filtered = apply_filter(raw_arr)

            # ── RF window ──
            rf_start, rf_window = get_rf_window(raw_filtered, mark_idx)
            feat = extract_features(rf_window)

            # ── แสดง timeline ──
            print()
            show_timeline(raw_filtered, mark_idx, rf_start)

            # ── ถามก่อน save ──
            icon = "FALL" if is_fall else "NON_FALL"
            marked = f" [marked {mark_idx / 100:.1f}s]" if mark_idx >= 0 else ""
            has_seq = " +LSTM" if len(raw_arr) >= TOTAL_NEEDED else ""
            print(f"    [{icon}] {p['name']}  (mean={feat.mean():.2f}){has_seq}{marked}")

            confirm = input("    Save this sample? (Enter=yes / n=discard): ").strip().lower()
            if confirm == "n":
                print("    Discarded.")
                continue

            raw_all.append(raw_data)
            y_all.append(p["label"])
            pose_all.append(POSE_ID[current_pose])
            marks_all.append(mark_idx)
            pose_counts[current_pose] += 1

            cnt = pose_counts[current_pose]
            print(f"    Saved #{cnt}  {progress_bar(cnt, p['target'])}")

            if cnt >= p["target"]:
                print(f"    {p['name']} target reached!")

        elif cmd == "":
            print("    Select a pose first (press 0-9 or a)")
        else:
            print("    [0-9,a] select pose | Enter collect | s save | p progress | q quit")

    running = False
    sock.close()


if __name__ == "__main__":
    main()
