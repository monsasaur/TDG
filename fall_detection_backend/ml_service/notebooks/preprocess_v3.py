"""
preprocess_v3.py
================
อ่าน raw CSV ที่มีคอลัมน์ `mark` (จุดที่ล้มถึงพื้น) แล้วออก **สอง dataset จากไฟล์เดียวกัน**

    python notebooks/preprocess_v3.py

    data/processed_v3_framed/      ← dataset A : per-window รอบจุดล้ม (แทน processed_v2)
    data/processed_v3_continuous/  ← dataset B : ทุก window ตลอดคลิป สำหรับ real-time

ทำไมต้องมีไฟล์นี้ — อย่ารัน preprocess_v2.py กับข้อมูลใหม่
------------------------------------------------------------
preprocess_v2 ตัด `amplitudes[:300]` = เอา 300 packet แรกของคลิป
โปรโตคอลเก่าคือกด Enter แล้วล้มทันที การล้มจึงอยู่ใน 300 packet แรกพอดี

โปรโตคอลใหม่ให้ยืนปกติ 3-4 วิ ก่อนล้ม (เพื่อให้มีช่วง "ปกติ" ติดมาในคลิป)
→ 300 packet แรกกลายเป็นช่วง **ยืนนิ่ง** ไม่ใช่ช่วงล้ม
→ ถ้ารัน v2 กับข้อมูลใหม่จะได้ dataset ที่ label ว่า fall แต่เนื้อในคือคนยืนเฉย ๆ

ไฟล์นี้ใช้คอลัมน์ `mark` หาตำแหน่งล้มจริงแทนการเดาจากตำแหน่งในไฟล์

อัตรา packet
------------
วัดจาก field[18] (local_timestamp µs) ของ ESP32 เอง cross-check กับ field[23]
ได้ **73 pkt/s** ไม่ใช่ 100 ตามที่คอมเมนต์ทั่วโปรเจกต์เขียนไว้
ค่าคงที่ด้านล่างจึงคิดจาก 73 ทั้งหมด
"""

import csv
import glob
import json
import os
import re
import sys

import numpy as np
import pandas as pd
from scipy import stats
from scipy.signal import savgol_filter

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_DIR    = os.path.join(BASE_DIR, "data", "raw")
SESSION_DIR = os.path.join(BASE_DIR, "data", "sessions")
OUT_FRAMED = os.path.join(BASE_DIR, "data", "processed_v3_framed")
OUT_CONT   = os.path.join(BASE_DIR, "data", "processed_v3_continuous")

# =================== Config ===================
PKT_PER_SEC   = 73.2          # วัดจริงจาก ESP32 timestamp

N_SUBCARRIERS = 52
N_FEATURES    = N_SUBCARRIERS * 8      # 416
WINDOW_SIZE   = 200                    # 2.7 วิ — คงไว้ให้ feature เข้ากับ rf_v1 ได้
STRIDE        = 50                     # 0.68 วิ

LABEL_MAP     = {"fall": 0, "non_fall": 1}

# --- dataset A: กรอบรอบจุดล้ม ---
# การล้มเกิด "ก่อน" จุดมาร์ค (mark = ตอนถึงพื้น) จึงกินช่วงซ้ายมากกว่าขวา
FRAMED_BEFORE = 250           # 3.4 วิ ก่อนถึงพื้น
FRAMED_AFTER  =  50           # 0.7 วิ หลังถึงพื้น
# รวม 300 pkt → (300-200)/50+1 = 3 window ต่อไฟล์ เท่ากับ processed_v2 เป๊ะ

# --- dataset B: label ต่อเนื่องตามโซน (วัดที่ "จุดกึ่งกลาง window") ---
FALL_BEFORE   = 110           # 1.5 วิ ก่อนถึงพื้น = ช่วงกำลังล้ม
FALL_AFTER    =  22           # 0.3 วิ หลังถึงพื้น
DROP_AFTER    = FALL_AFTER    # เลยจากนี้ = นอนอยู่บนพื้น → ทิ้ง ไม่ label

# ทำไมทิ้งช่วงหลังล้ม: "นอนนิ่งบนพื้นหลังล้ม" กับท่า "นอนลงบนพื้น" (non_fall)
# แยกกันไม่ออกด้วย CSI — ชุด v1 เคย label ช่วงนี้เป็น fall แล้วได้ 29,958 window
# ที่ผิดครึ่งค่อนชุด (ดู docs/reports/data_quality_audit_2026-09.md)


# =================== Parse ===================
def parse_csi_line(raw_line: str):
    try:
        start  = raw_line.index("[")
        end    = raw_line.index("]")
        values = list(map(int, raw_line[start + 1:end].strip().split()))
        if len(values) >= N_SUBCARRIERS * 2:
            I = np.array(values[0::2][:N_SUBCARRIERS], dtype=float)
            Q = np.array(values[1::2][:N_SUBCARRIERS], dtype=float)
            return np.sqrt(I ** 2 + Q ** 2)
        return np.array(values[:N_SUBCARRIERS], dtype=float)
    except Exception:
        return None


def parse_session(filename):
    """คืน session_id จาก prefix s<id>_<seq>_ — ไฟล์เก่าที่ไม่มี prefix ได้ 'legacy'"""
    m = re.match(r"^s(\d{8}_\d{4})_\d+_", filename)
    return m.group(1) if m else "legacy"


def smooth_signal(amp_seq):
    if len(amp_seq) < 11:
        return amp_seq
    return savgol_filter(amp_seq, window_length=11, polyorder=3, axis=0)


def extract_features(window):
    feats = []
    for sub in range(N_SUBCARRIERS):
        col  = window[:, sub]
        mean = np.mean(col)
        std  = np.std(col)
        if std < 1e-10:
            skew_val = kurt_val = 0.0
        else:
            skew_val = float(stats.skew(col))
            kurt_val = float(stats.kurtosis(col))
        feats.extend([
            mean, np.min(col), np.max(col), std,
            np.mean(np.abs(col - mean)),
            float(np.percentile(col, 75) - np.percentile(col, 25)),
            skew_val, kurt_val,
        ])
    return np.nan_to_num(np.array(feats, dtype=np.float32),
                         nan=0.0, posinf=0.0, neginf=0.0)


# =================== Read one file ===================
def read_clip(path):
    """คืน (amp_seq, label, mark) — mark = -1 ถ้าไม่มี · None ถ้าอ่านไม่ได้"""
    df = pd.read_csv(path)
    label = str(df["label"].iloc[0])
    if label not in LABEL_MAP:
        return None

    amps, mark = [], -1
    marks = (df["mark"].to_numpy() if "mark" in df.columns
             else np.zeros(len(df), dtype=int))
    for i, raw in enumerate(df["raw"]):
        # เช็คมาร์ค **ก่อน** parse — ถ้าบรรทัดที่มาร์คไว้ parse ไม่ผ่าน
        # แล้วข้ามไป mark จะหายทั้งไฟล์ · ให้ผูกกับ window ถัดไปแทน
        if int(marks[i]) == 1:
            mark = len(amps)          # index ใน amps ไม่ใช่ index ในไฟล์
        amp = parse_csi_line(str(raw))
        if amp is None:
            continue
        amps.append(amp)

    if len(amps) < WINDOW_SIZE:
        return None
    return smooth_signal(np.array(amps)), label, mark


def windows_from(amp_seq, lo, hi):
    """คืน (features, center_index) ของทุก window ที่อยู่ในช่วง [lo, hi)"""
    lo = max(lo, 0)
    hi = min(hi, len(amp_seq))
    out = []
    for start in range(lo, hi - WINDOW_SIZE + 1, STRIDE):
        w = amp_seq[start:start + WINDOW_SIZE]
        out.append((extract_features(w), start + WINDOW_SIZE // 2))
    return out


# =================== Dataset A — framed ===================
def build_framed(amp_seq, label, mark):
    """3 window รอบจุดล้ม — เทียบเท่า processed_v2 แต่หาตำแหน่งจาก mark"""
    if label == "fall":
        if mark < 0:
            return []                       # ไม่มีมาร์ค = ไม่รู้ว่าล้มตอนไหน → ข้าม
        lo, hi = mark - FRAMED_BEFORE, mark + FRAMED_AFTER
    else:
        lo, hi = 0, FRAMED_BEFORE + FRAMED_AFTER
    return [f for f, _ in windows_from(amp_seq, lo, hi)]


# =================== Dataset B — continuous ===================
def build_continuous(amp_seq, label, mark):
    """ทุก window ตลอดคลิป label ตามระยะห่างจากจุดล้ม

    non_fall : ทุก window = non_fall
    fall     : ก่อนล้ม = non_fall · กำลังล้ม = fall · หลังถึงพื้น = ทิ้ง
    """
    if label == "non_fall":
        return [(f, LABEL_MAP["non_fall"]) for f, _ in windows_from(amp_seq, 0, len(amp_seq))]

    if mark < 0:
        return []

    out = []
    for f, center in windows_from(amp_seq, 0, len(amp_seq)):
        if center < mark - FALL_BEFORE:
            out.append((f, LABEL_MAP["non_fall"]))       # ยังไม่ล้ม = ปกติ
        elif center <= mark + FALL_AFTER:
            out.append((f, LABEL_MAP["fall"]))           # กำลังล้ม
        # else: นอนอยู่บนพื้น → ทิ้ง
    return out


# =================== Save ===================
def save(out_dir, X, y, file_ids, session_ids, extra):
    os.makedirs(out_dir, exist_ok=True)
    X = np.array(X, dtype=np.float32)
    y = np.array(y, dtype=np.int32)
    np.save(os.path.join(out_dir, "X.npy"), X)
    np.save(os.path.join(out_dir, "y.npy"), y)
    np.save(os.path.join(out_dir, "file_ids.npy"), np.array(file_ids, dtype=np.int32))
    np.save(os.path.join(out_dir, "session_ids.npy"), np.array(session_ids, dtype=np.int32))
    meta = {
        "n_samples":    int(len(X)),
        "n_features":   int(X.shape[1]) if len(X) else N_FEATURES,
        "n_classes":    2,
        "window_size":  WINDOW_SIZE,
        "stride":       STRIDE,
        "pkt_per_sec":  PKT_PER_SEC,
        "label_map":    LABEL_MAP,
        "counts":       {k: int((y == v).sum()) for k, v in LABEL_MAP.items()},
        **extra,
    }
    with open(os.path.join(out_dir, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    return meta


# =================== Main ===================
def main():
    files = sorted(f for f in glob.glob(os.path.join(RAW_DIR, "*.csv"))
                   if "progress" not in f)
    if not files:
        print(f"❌ ไม่พบ CSV ใน {RAW_DIR}")
        return 1

    print("=" * 64)
    print("  preprocess_v3 — ออกสอง dataset จาก raw ชุดเดียว")
    print(f"  {len(files)} ไฟล์ · window {WINDOW_SIZE} ({WINDOW_SIZE/PKT_PER_SEC:.1f} วิ) "
          f"· stride {STRIDE} ({STRIDE/PKT_PER_SEC:.2f} วิ)")
    print("=" * 64 + "\n")

    A = {"X": [], "y": [], "fid": [], "sid": []}
    B = {"X": [], "y": [], "fid": [], "sid": []}
    sess_index, skipped, unmarked = {}, 0, 0
    mark_pos = []

    for fid, path in enumerate(files):
        fname = os.path.basename(path)
        clip  = read_clip(path)
        if clip is None:
            print(f"  ⚠️  ข้าม {fname} (สั้นไป / label ไม่รู้จัก)")
            skipped += 1
            continue
        amp, label, mark = clip

        if label == "fall" and mark < 0:
            print(f"  ⚠️  ข้าม {fname} — ไฟล์ fall ที่ไม่มีจุดมาร์ค")
            unmarked += 1
            continue

        sname = parse_session(fname)
        sid   = sess_index.setdefault(sname, len(sess_index))
        lab   = LABEL_MAP[label]

        fa = build_framed(amp, label, mark)
        if label == "fall":
            mark_pos.append(mark)
            if len(fa) < 3:
                print(f"  ⚠️  {fname[:52]:54s} มาร์คที่ pkt {mark} "
                      f"({mark/PKT_PER_SEC:.1f} วิ) เร็วไป → ได้แค่ {len(fa)} window "
                      f"(ต้องการมาร์ค ≥ {FRAMED_BEFORE})")
        A["X"].extend(fa); A["y"].extend([lab] * len(fa))
        A["fid"].extend([fid] * len(fa)); A["sid"].extend([sid] * len(fa))

        fb = build_continuous(amp, label, mark)
        B["X"].extend(f for f, _ in fb); B["y"].extend(l for _, l in fb)
        B["fid"].extend([fid] * len(fb)); B["sid"].extend([sid] * len(fb))

        print(f"  ✅ {fname[:52]:54s} {label:9s} A={len(fa):2d}  B={len(fb):3d}")

    if not A["X"]:
        print("\n❌ ไม่มีข้อมูลที่ใช้ได้")
        return 1

    common = {"n_files": len(files) - skipped - unmarked,
              "n_sessions": len(sess_index),
              "sessions": list(sess_index)}
    mA = save(OUT_FRAMED, A["X"], A["y"], A["fid"], A["sid"],
              {"variant": "framed", "framed_before": FRAMED_BEFORE,
               "framed_after": FRAMED_AFTER, **common})
    mB = save(OUT_CONT, B["X"], B["y"], B["fid"], B["sid"],
              {"variant": "continuous", "fall_before": FALL_BEFORE,
               "fall_after": FALL_AFTER, **common})

    print("\n" + "=" * 64)
    for name, m, d in [("A framed", mA, OUT_FRAMED), ("B continuous", mB, OUT_CONT)]:
        c = m["counts"]
        tot = m["n_samples"]
        pct = (c["fall"] / tot * 100) if tot else 0
        print(f"  {name:14s} {tot:6d} window  ·  fall {c['fall']:5d} ({pct:.1f}%) "
              f"· non_fall {c['non_fall']:5d}  →  {os.path.relpath(d, BASE_DIR)}")
    print(f"  session {len(sess_index)} · ข้าม {skipped} ไฟล์ · fall ไม่มีมาร์ค {unmarked} ไฟล์")
    if mark_pos:
        mp = sorted(mark_pos)
        early = sum(1 for x in mp if x < FRAMED_BEFORE)
        print(f"  ตำแหน่งมาร์ค: min {mp[0]} · median {mp[len(mp)//2]} · max {mp[-1]} pkt "
              f"({mp[len(mp)//2]/PKT_PER_SEC:.1f} วิ)")
        if early:
            print(f"  ⚠️  {early}/{len(mp)} ไฟล์ล้มเร็วเกินไป (มาร์ค < {FRAMED_BEFORE} pkt) "
                  "— ได้ window ไม่ครบ")
    if len(sess_index) < 2:
        print("\n  ⚠️  มี session เดียว — แบ่ง test ตาม session ยังทำไม่ได้")
    print("=" * 64 + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
