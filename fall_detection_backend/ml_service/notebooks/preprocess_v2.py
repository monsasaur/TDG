"""
CSI Feature Extractor v5 (Binary + Trimmed)
=============================================
8 Statistical Features × 52 Subcarriers = 416 features per window

2 Classes (Binary):
  fall     (0) ← รวม fall_A + fall_B + fall_C (ตัดที่ FALL_TRIM_SAMPLES)
  non_fall (1) ← กิจกรรมปกติ (ตัดที่ NON_FALL_TRIM_SAMPLES)

ระดับความรุนแรง (A/B/C) ถูกกำหนดโดย Rule-based ใน predict.py
โดยใช้ FallStateTracker + RESET_REQUIRED_NON_FALL=20

การตัด samples:
  - fall: ตัดเหลือ FALL_TRIM_SAMPLES (800 = 8 วิ)
    → ช่วงแรก ~3 วิ = falling motion (CSI spike)
    → ช่วงถัดมา ~5 วิ = นอนบนพื้น → โมเดลเรียนรู้ว่ายังเป็น fall
  - non_fall: ตัดเหลือ NON_FALL_TRIM_SAMPLES (1500 = 15 วิ)
    → ลด imbalance ระหว่าง fall กับ non_fall

Features:
  1. Mean        ค่าเฉลี่ย
  2. Min         ค่าน้อยสุด
  3. Max         ค่ามากสุด
  4. S.D.        ส่วนเบี่ยงเบนมาตรฐาน
  5. MAD         ค่าความผิดพลาดสัมบูรณ์เฉลี่ย
  6. IQR         พิสัยระหว่างควอร์ไทล์
  7. Skewness    การวัดค่าเบ้
  8. Kurtosis    การวัดความโด่ง

Input  : data/raw/*.csv
Output : data/processed/X.npy, y.npy, file_ids.npy, metadata.json

วิธีใช้:
  pip install numpy pandas scipy scikit-learn
  python preprocess.py
"""

import os
import glob
import re
import json
import numpy as np
import pandas as pd
from scipy import stats
from scipy.signal import savgol_filter

# =================== Path ===================
BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR       = os.path.join(BASE_DIR, "data", "raw")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed_v2")
SESSION_DIR   = os.path.join(BASE_DIR, "data", "sessions")

# =================== ตั้งค่า ===================
WINDOW_SIZE       = 200   # samples ต่อ window (2 วิ ที่ 100 pkt/s)
STRIDE            = 50    # overlap 75%
N_SUBCARRIERS     = 52    # ESP32 LLTF subcarriers
N_FEATURES        = N_SUBCARRIERS * 8  # 52 × 8 = 416

# ตัด fall samples ให้เหลือแค่ช่วงล้ม + นอนบนพื้นช่วงสั้นๆ
# 800 packets ≈ 8 วินาที ที่ 100 pkt/s
#   - ช่วงแรก ~2-3 วิ = falling motion (CSI spike)
#   - ช่วงถัดมา ~5 วิ  = นอนบนพื้น → ให้ model รู้ว่านี่ยังเป็น fall
FALL_TRIM_SAMPLES     = 300   # 3 วิ — จับแค่ช่วง falling motion
NON_FALL_TRIM_SAMPLES = 300   # เท่ากับ fall → windows/ไฟล์เท่ากัน

# Binary label map: fall_A/B/C ทุกประเภท → 0 (fall), non_fall → 1
LABEL_MAP = {
    "fall":     0,
    "fall_A":   0,
    "fall_B":   0,
    "fall_C":   0,
    "non_fall": 1,
}

# ชื่อ class สำหรับแสดงผล
BINARY_NAMES = {0: "fall", 1: "non_fall"}

os.makedirs(PROCESSED_DIR, exist_ok=True)


# =================== Parser ===================
def parse_csi_line(raw_line: str):
    """
    Parse raw CSI line จาก ESP32
    Format: CSI_DATA,AP,mac,rssi,...,[I0 Q0 I1 Q1 ...]
    Return: amplitude array (N_SUBCARRIERS,) หรือ None
    """
    try:
        start = raw_line.index("[")
        end   = raw_line.index("]")
        data  = raw_line[start+1:end].strip()
        values = list(map(int, data.split()))

        if len(values) >= N_SUBCARRIERS * 2:
            I = np.array(values[0::2][:N_SUBCARRIERS], dtype=float)
            Q = np.array(values[1::2][:N_SUBCARRIERS], dtype=float)
            amplitude = np.sqrt(I**2 + Q**2)
        else:
            amplitude = np.array(values[:N_SUBCARRIERS], dtype=float)

        return amplitude
    except Exception:
        return None


# =================== Smooth ===================
def smooth_signal(amp_seq: np.ndarray) -> np.ndarray:
    """Savitzky-Golay filter ลด noise"""
    if len(amp_seq) < 11:
        return amp_seq
    return savgol_filter(amp_seq, window_length=11, polyorder=3, axis=0)


# =================== Feature Extraction ===================
def extract_features(window: np.ndarray) -> np.ndarray:
    """
    Input  : window shape (WINDOW_SIZE, N_SUBCARRIERS)
    Output : feature vector shape (N_SUBCARRIERS × 8,) = (416,)
    """
    features = []
    for sub in range(N_SUBCARRIERS):
        col      = window[:, sub]
        mean     = np.mean(col)
        minimum  = np.min(col)
        maximum  = np.max(col)
        std      = np.std(col)
        mad      = np.mean(np.abs(col - mean))
        iqr      = float(np.percentile(col, 75) - np.percentile(col, 25))
        skewness = float(stats.skew(col))
        kurtosis = float(stats.kurtosis(col))
        features.extend([mean, minimum, maximum, std, mad, iqr, skewness, kurtosis])

    feat = np.array(features, dtype=np.float32)
    feat = np.nan_to_num(feat, nan=0.0, posinf=0.0, neginf=0.0)
    return feat  # (416,)


# =================== Sliding Window ===================
# =================== Session (สำหรับตรวจ confound) ===================
"""
csi_collector_serial.py โหมด session จะตั้งชื่อไฟล์เป็น
    s<session_id>_<seq>_<label>_<ท่า>_<เวลา>_<n>.csv
เช่น  s20260901_1630_007_fall_ล้มไปข้างหน้า_20260901_163412_007.csv

session_id จำเป็นสำหรับ:
  - แบ่ง test set ตาม session (test ต้องเป็น session ที่โมเดลไม่เคยเห็น ไม่ใช่แค่ไฟล์)
  - ตรวจ confound อัตโนมัติด้วย experiments/audit_data.py

ไฟล์เก่าที่เก็บก่อนมีโหมด session จะไม่มี prefix — จัดเป็น session "legacy" ก้อนเดียว
ซึ่งตรงกับความจริงว่ามันเป็นการเก็บชุดเดียวที่แยก session ย่อยไม่ได้แล้ว
"""

SESSION_PATTERN = re.compile(r"^s(\d{8}_\d{4})_(\d+)_")
LEGACY_SESSION  = "legacy"


def parse_session(filename):
    """คืน (session_id, seq) — ไฟล์เก่าที่ไม่มี prefix ได้ ("legacy", None)"""
    match = SESSION_PATTERN.match(filename)
    if not match:
        return LEGACY_SESSION, None
    return match.group(1), int(match.group(2))


def load_session_manifests():
    """อ่าน metadata ที่ collector เขียนไว้ (ห้อง/ตำแหน่ง ESP32/คนแสดง)"""
    info = {}
    for path in sorted(glob.glob(os.path.join(SESSION_DIR, "session_*.json"))):
        try:
            with open(path, encoding="utf-8") as f:
                manifest = json.load(f)
            info[manifest["session_id"]] = {
                "collection": manifest.get("collection"),
                "started_at": manifest.get("started_at"),
                "collected":  manifest.get("collected"),
                **(manifest.get("info") or {}),
            }
        except (json.JSONDecodeError, KeyError, OSError) as err:
            print(f"  ⚠️  อ่าน manifest ไม่ได้: {os.path.basename(path)} ({err})")
    return info


def sliding_window_extract(amp_seq: np.ndarray, label_int: int):
    """
    Input  : amp_seq (T, N_SUBCARRIERS)
    Output : X list of feature vectors, y list of labels
    """
    X, y = [], []
    T = len(amp_seq)
    for start in range(0, T - WINDOW_SIZE + 1, STRIDE):
        window = amp_seq[start : start + WINDOW_SIZE]
        X.append(extract_features(window))
        y.append(label_int)
    return X, y


# =================== Process One CSV ===================
def process_csv(csv_path: str):
    df    = pd.read_csv(csv_path)
    label = df["label"].iloc[0]

    if label not in LABEL_MAP:
        print(f"⚠️  ไม่รู้จัก label '{label}' — ข้าม")
        return [], [], None

    label_int  = LABEL_MAP[label]
    amplitudes = []

    for raw in df["raw"]:
        amp = parse_csi_line(str(raw))
        if amp is not None:
            amplitudes.append(amp)

    if len(amplitudes) < WINDOW_SIZE:
        print(f"⚠️  ข้อมูลน้อยเกินไป ({len(amplitudes)} rows) — ข้าม")
        return [], [], None

    # ตัด fall samples เหลือแค่ช่วงล้มจริง (FALL_TRIM_SAMPLES แรก)
    is_fall = label_int == 0
    if is_fall and len(amplitudes) > FALL_TRIM_SAMPLES:
        amplitudes = amplitudes[:FALL_TRIM_SAMPLES]

    # ตัด non_fall เหลือแค่ NON_FALL_TRIM_SAMPLES (15 วิ) เพื่อลด imbalance
    if not is_fall and len(amplitudes) > NON_FALL_TRIM_SAMPLES:
        amplitudes = amplitudes[:NON_FALL_TRIM_SAMPLES]

    amp_seq = np.array(amplitudes)    # (T, N_SUBCARRIERS)
    amp_seq = smooth_signal(amp_seq)  # denoise

    X, y = sliding_window_extract(amp_seq, label_int)
    return X, y, label


# =================== Main ===================
def main():
    print("=" * 62)
    print("  🔬  CSI Feature Extractor v5 (Binary + Trimmed)")
    print(f"  📂  Input   : {RAW_DIR}")
    print(f"  📂  Output  : {PROCESSED_DIR}")
    print(f"  📐  Features: {N_SUBCARRIERS} subcarriers × 8 = {N_FEATURES}")
    print(f"  ✂️   Fall trim    : {FALL_TRIM_SAMPLES} samples ({FALL_TRIM_SAMPLES/100:.1f} วิ)")
    print(f"  ✂️   Non-fall trim: {NON_FALL_TRIM_SAMPLES} samples ({NON_FALL_TRIM_SAMPLES/100:.1f} วิ)")
    print("=" * 62)
    print()
    print("  Label mapping:")
    print("    fall_A, fall_B, fall_C  →  fall     (0)")
    print("    non_fall                →  non_fall (1)")
    print()

    csv_files = sorted(glob.glob(os.path.join(RAW_DIR, "*.csv")))
    csv_files = [f for f in csv_files if "progress" not in f]

    if not csv_files:
        print(f"❌ ไม่พบ CSV ใน {RAW_DIR}")
        return

    print(f"  พบ {len(csv_files)} ไฟล์\n")
    print(f"  {'ไฟล์':<42} {'raw_label':>10} {'windows':>8} {'trimmed':>8}")
    print(f"  {'─'*70}")

    all_X, all_y, all_file_ids, all_session_ids = [], [], [], []
    binary_counts = {0: 0, 1: 0}  # fall=0, non_fall=1
    raw_counts    = {}             # ติดตาม fall_A/B/C แยกกัน

    # session_id เป็นข้อความ → แปลงเป็นเลขเรียงตามลำดับที่เจอ
    session_index = {}
    session_files = {}

    for file_id, path in enumerate(csv_files):
        fname        = os.path.basename(path)
        X, y, label  = process_csv(path)

        if X:
            session_name, _ = parse_session(fname)
            if session_name not in session_index:
                session_index[session_name] = len(session_index)
            session_files.setdefault(session_name, []).append(label)

            all_X.extend(X)
            all_y.extend(y)
            all_file_ids.extend([file_id] * len(X))
            all_session_ids.extend([session_index[session_name]] * len(X))
            label_int = y[0]
            binary_counts[label_int] += len(X)
            raw_counts[label] = raw_counts.get(label, 0) + len(X)

            is_trimmed = True  # ทั้ง fall และ non_fall ถูก trim แล้ว
            trimmed_tag = "✂️  ตัด"
            print(f"  ✅ {fname:<40} {label:>10} {len(X):>8} {trimmed_tag:>8}")
        else:
            print(f"  ⚠️  {fname:<40} {'ข้าม':>10}")

    if not all_X:
        print("\n❌ ไม่มีข้อมูลที่ใช้ได้")
        return

    X_arr           = np.array(all_X,           dtype=np.float32)
    y_arr           = np.array(all_y,           dtype=np.int32)
    file_ids_arr    = np.array(all_file_ids,    dtype=np.int32)
    session_ids_arr = np.array(all_session_ids, dtype=np.int32)

    X_path           = os.path.join(PROCESSED_DIR, "X.npy")
    y_path           = os.path.join(PROCESSED_DIR, "y.npy")
    file_ids_path    = os.path.join(PROCESSED_DIR, "file_ids.npy")
    session_ids_path = os.path.join(PROCESSED_DIR, "session_ids.npy")
    meta_path        = os.path.join(PROCESSED_DIR, "metadata.json")

    np.save(X_path, X_arr)
    np.save(y_path, y_arr)
    np.save(file_ids_path, file_ids_arr)
    np.save(session_ids_path, session_ids_arr)
    print(f"\n  💾 file_ids.npy → {file_ids_path}  ({len(np.unique(file_ids_arr))} files)")

    # สรุปแต่ละ session พร้อมสัดส่วนคลาส — ดูตรงนี้ก็รู้แล้วว่าเก็บสลับคลาสจริงไหม
    manifests = load_session_manifests()
    session_summary = {}
    print(f"\n  📦 Session ({len(session_index)} ชุด)")
    for name, idx in sorted(session_index.items(), key=lambda kv: kv[1]):
        labels    = session_files[name]
        n_fall    = sum(1 for l in labels if l != "non_fall")
        n_normal  = len(labels) - n_fall
        balance   = min(n_fall, n_normal) / max(n_fall, n_normal) if max(n_fall, n_normal) else 0
        flag      = "✅" if balance >= 0.8 else "⚠️ "
        print(f"    {flag} [{idx}] {name:<18} ไฟล์ {len(labels):4d}  "
              f"fall {n_fall:4d} · non_fall {n_normal:4d}")
        session_summary[name] = {
            "index": idx, "files": len(labels),
            "fall": n_fall, "non_fall": n_normal,
            **manifests.get(name, {}),
        }

    if len(session_index) == 1:
        print("    ⚠️  มี session เดียว — แบ่ง test set ตาม session ไม่ได้")
        print("       เก็บเพิ่มอีกอย่างน้อย 1 session (คนละวัน/ห้อง) ก่อนเทรนจริง")

    meta = {
        "version":              "v5_binary_trimmed",
        "n_samples":            int(len(X_arr)),
        "n_features":           int(X_arr.shape[1]),
        "n_classes":            2,
        "window_size":          WINDOW_SIZE,
        "stride":               STRIDE,
        "n_subcarriers":        N_SUBCARRIERS,
        "fall_trim_samples":    FALL_TRIM_SAMPLES,
        "non_fall_trim_samples": NON_FALL_TRIM_SAMPLES,
        "features":             ["mean", "min", "max", "std", "mad", "iqr", "skewness", "kurtosis"],
        "label_map":            {"fall": 0, "non_fall": 1},
        "binary_counts":        {BINARY_NAMES[k]: int(v) for k, v in binary_counts.items()},
        "raw_label_counts":     raw_counts,
        "n_sessions":           len(session_index),
        "sessions":             session_summary,
        "created_at":           pd.Timestamp.now().isoformat(),
    }
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)

    # สรุป
    total = sum(binary_counts.values())
    print(f"\n{'='*62}")
    print(f"  ✅ เสร็จแล้ว!")
    print(f"  📊 X shape  : {X_arr.shape}  (windows × features)")
    print(f"  📊 y shape  : {y_arr.shape}")
    print(f"\n  Binary class distribution:")
    for label_int, count in binary_counts.items():
        name = BINARY_NAMES[label_int]
        pct  = count / total * 100 if total > 0 else 0
        bar  = "█" * int(pct / 2)
        print(f"    {name:10s} ({label_int}) : {count:5d} windows ({pct:.1f}%)  {bar}")
    print(f"\n  Raw label breakdown (fall only):")
    for raw_lbl in ["fall_A", "fall_B", "fall_C"]:
        n = raw_counts.get(raw_lbl, 0)
        print(f"    {raw_lbl:10s} : {n:5d} windows")
    print(f"\n  💾 X.npy         → {X_path}")
    print(f"  💾 y.npy         → {y_path}")
    print(f"  💾 file_ids.npy  → {file_ids_path}")
    print(f"  💾 session_ids.npy → {session_ids_path}  ({len(session_index)} sessions)")
    print(f"  💾 metadata.json → {meta_path}")
    print(f"{'='*62}\n")


if __name__ == "__main__":
    main()
