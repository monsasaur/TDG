"""
event_features.py (app) — feature แบบ "เหตุการณ์" ที่ใช้ร่วมกันทั้งตอนเทรนและตอนใช้งานจริง
==========================================================================================

ใครใช้:
- experiments/event_features.py · streaming_eval.py · train_rf_v2.py  (เทรน/ประเมิน)
- data_collection/fall_monitor.py                                     (ตรวจจับสดจาก ESP32)
- app/predict.py เมื่อ FALL_MODEL=rf_v2_event                         (รับเวกเตอร์ตามที่โมเดลเทรนมา)
- experiments/eval_event_v2.py                                        (ตัวเลขแบบรู้จังหวะของรุ่น 2)

รุ่นที่ใช้ตอนนี้ (2026-11-17): feature_vector_v2 = 39 ค่า กรอบ 492 packet (ท้ายไฟล์)
รุ่นก่อน: stream_feature_vector (28 ค่า · 472) · feature_vector (18 ค่า · 410)

**แก้สูตรที่นี่ที่เดียว** ถ้าแก้ฝั่งเทรนแต่ไม่แก้ฝั่งใช้งาน (หรือกลับกัน) โมเดลจะได้ค่าที่ไม่เคยเห็นตอนเทรน
โดยไม่มี error บอก

กรอบ 1 กรอบ = 410 packet (4.1 วิที่ 100 pkt/s): 342 ก่อนจุดอ้างอิง m · 68 หลัง
- ตอนเทรน m = จุดมาร์ค (ตัวถึงพื้น) · ตอนใช้งานจริง m = packet ล่าสุด − 68 (รู้ผลช้ากว่าเหตุการณ์ 0.68 วิ)
"""

import numpy as np

VALID_SC = list(range(6, 32)) + list(range(33, 59))   # subcarrier ที่มีข้อมูลจริงของ LLTF 64 ตัว
PRE, POST = 342, 68
WINDOW = PRE + POST
BASE_WIN, AFTER_WIN = slice(0, 192), slice(PRE + 25, PRE + POST)
FEATURE_KEYS = ["posture_z", "level_db", "rssi_chg", "across_z",
                "mot10_base", "mot10_max", "mot10_mean", "mot10_ratio", "mot10_peak_t", "mot10_width",
                "mot30_base", "mot30_max", "mot30_mean", "mot30_ratio", "mot30_peak_t", "mot30_width",
                "pc1_ratio", "pc1_frac"]


def parse_csi_line(raw):
    """บรรทัด CSI_DATA ดิบ → (แอมพลิจูดหาร gain, แอมพลิจูดดิบ, RSSI) หรือ None
    ทิ้ง: บรรทัดเสียจากสาย USB (ซ้อน/ขาดกลาง) · เฟรม legacy sig_mode 0 · แอมพลิจูดเป็นศูนย์"""
    if raw.count("CSI_DATA") != 1:
        return None
    head, _, arr = raw.partition("[")
    p = head.split(",")
    v = arr.rstrip("] \r\n").split()
    if len(p) != 26 or len(v) != 128 or p[5] == "0":
        return None
    try:
        v = np.asarray(v, float)
        rssi = int(p[3])
    except ValueError:
        return None
    a = np.hypot(v[0::2], v[1::2])[VALID_SC]
    mean = a.mean()
    if mean <= 0:
        return None
    return a / mean, a, rssi


def _ma(x, w):
    c = np.cumsum(np.vstack([np.zeros((1, x.shape[1])), x]), 0)
    return (c[w:] - c[:-w]) / w


def _rms(x, axis=-1):
    return np.sqrt((x ** 2).mean(axis))


def features(An, Ar, R, m):
    """feature ของกรอบรอบจุด m (index packet) — คืน dict ตามลำดับ FEATURE_KEYS
    ต้องมี An[m-342 : m+68] ครบ · ทุกค่าหารด้วย noise ต่อ packet ของกรอบนั้นเอง"""
    seg, raw, rs = An[m - PRE:m + POST], Ar[m - PRE:m + POST], R[m - PRE:m + POST]
    sigma = np.median(_rms(np.diff(seg[BASE_WIN], axis=0))) / np.sqrt(2)      # noise ต่อ packet
    nb, na = BASE_WIN.stop - BASE_WIN.start, AFTER_WIN.stop - AFTER_WIN.start
    d = seg[AFTER_WIN].mean(0) - seg[BASE_WIN].mean(0)
    f = {"posture_z": _rms(d) / (sigma * np.sqrt(1 / na + 1 / nb)),
         "level_db": 20 * np.log10(raw[AFTER_WIN].mean() / raw[BASE_WIN].mean()),
         "rssi_chg": float(np.median(rs[AFTER_WIN]) - np.median(rs[BASE_WIN]))}
    pre, post = seg[PRE - 60:PRE - 20].mean(0), seg[PRE + 5:PRE + 45].mean(0)
    f["across_z"] = _rms(post - pre) / (sigma * np.sqrt(2 / 40))
    sm = _ma(seg, 10)
    for L in (10, 30):
        mot = _rms(sm[L:] - sm[:-L]) / sigma
        c = np.arange(len(mot)) + (L + 10) // 2
        ev = (c >= 192) & (c < PRE + 20)
        b, e = mot[(c >= 10) & (c < 192)], mot[ev]
        f[f"mot{L}_base"] = np.median(b)
        f[f"mot{L}_max"] = e.max()
        f[f"mot{L}_mean"] = e.mean()
        f[f"mot{L}_ratio"] = e.max() / max(np.median(b), 1e-9)
        f[f"mot{L}_peak_t"] = (c[ev][e.argmax()] - PRE) / 100
        f[f"mot{L}_width"] = (e > (e.max() + np.median(b)) / 2).mean()
    X = seg - seg.mean(0)
    _, S, Vt = np.linalg.svd(X, full_matrices=False)
    pc = _ma(X @ Vt[:3].T, 10)
    f["pc1_ratio"] = pc[192:PRE + 10, 0].std() / max(pc[0:182, 0].std(), 1e-9)
    f["pc1_frac"] = S[0] ** 2 / (S ** 2).sum()
    return f


def feature_vector(An, Ar, R, m):
    f = features(An, Ar, R, m)
    return np.array([f[k] for k in FEATURE_KEYS], dtype=float)


# ---------------------------------------------------------------- แบบดูต่อเนื่อง (rf_v2_event)
# กรอบยาวขึ้น 472 packet: ช่วง "หลัง" = 0.7–1.3 วิหลังจุดอ้างอิง (คนล้มแล้วยังอยู่ที่พื้น) ทำให้การเดินผ่าน
# ที่เปลี่ยนสัญญาณแค่ชั่วคราวโดนแจ้งน้อยลง (streaming_eval.py) · รู้ผลช้ากว่าเหตุการณ์ 1.3 วิ + ยืนยัน K กรอบ
STREAM_POST, STREAM_AFTER = 130, 60
STREAM_WINDOW = PRE + STREAM_POST
STREAM_KEYS = ["posture_z", "level_db", "rssi_chg", "across_z",
               "mot10_base", "mot10_max", "mot10_mean", "mot10_ratio", "mot10_peak_t", "mot10_width",
               "mot30_base", "mot30_max", "mot30_mean", "mot30_ratio", "mot30_peak_t", "mot30_width",
               "pc1_ratio", "pc1_frac", "level_db_early", "rssi_chg_early",
               # หลังเหตุการณ์ยังขยับอยู่ไหม — ล้มแล้วนิ่งอยู่ที่พื้น ต่างจากเดินที่ยังขยับต่อ (2026-11-12)
               "post_std", "base_tail_std", "post_std_ratio", "post_mot10", "post_mot30", "post_drift",
               "rssi_std_post", "rssi_std_base"]


def stream_feature_vector(An, Ar, R, m):
    """feature 20 ค่าของกรอบ m-342 .. m+130 · ท่าทาง/ระดับ/RSSI เทียบช่วง 0.7–1.3 วิหลัง m กับช่วงก่อนทำท่า
    การขยับและ PCA ใช้ช่วงเดิม (ถึง m+68) · สองค่าท้าย = ระดับ/RSSI ช่วงต้นหลัง m แบบ feature เดิม"""
    seg, raw, rs = An[m - PRE:m + STREAM_POST], Ar[m - PRE:m + STREAM_POST], R[m - PRE:m + STREAM_POST]
    B, A = BASE_WIN, slice(STREAM_WINDOW - STREAM_AFTER, STREAM_WINDOW)
    sigma = np.median(_rms(np.diff(seg[B], axis=0))) / np.sqrt(2)
    d = seg[A].mean(0) - seg[B].mean(0)
    f = [_rms(d) / (sigma * np.sqrt(1 / STREAM_AFTER + 1 / (B.stop - B.start))),
         20 * np.log10(raw[A].mean() / raw[B].mean()),
         float(np.median(rs[A]) - np.median(rs[B]))]
    pre, post = seg[PRE - 60:PRE - 20].mean(0), seg[PRE + 5:PRE + 45].mean(0)
    f.append(_rms(post - pre) / (sigma * np.sqrt(2 / 40)))
    sm = _ma(seg[:PRE + POST], 10)
    for L in (10, 30):
        mot = _rms(sm[L:] - sm[:-L]) / sigma
        c = np.arange(len(mot)) + (L + 10) // 2
        ev = (c >= 192) & (c < PRE + 20)
        b, e = mot[(c >= 10) & (c < 192)], mot[ev]
        f += [np.median(b), e.max(), e.mean(), e.max() / max(np.median(b), 1e-9),
              (c[ev][e.argmax()] - PRE) / 100, (e > (e.max() + np.median(b)) / 2).mean()]
    X = seg[:PRE + POST] - seg[:PRE + POST].mean(0)
    _, S, Vt = np.linalg.svd(X, full_matrices=False)
    pc = _ma(X @ Vt[:3].T, 10)
    f += [pc[192:PRE + 10, 0].std() / max(pc[0:182, 0].std(), 1e-9), S[0] ** 2 / (S ** 2).sum()]
    f += [20 * np.log10(raw[AFTER_WIN].mean() / raw[B].mean()), float(np.median(rs[AFTER_WIN]) - np.median(rs[B]))]
    # ── หลังเหตุการณ์ยังขยับอยู่ไหม (ช่วง A = 0.7–1.3 วิหลัง m เทียบท้ายช่วงก่อนทำท่า 0.6 วิ) ──
    a0, a1 = A.start, A.stop
    smf = _ma(seg, 10)                                          # smf[i] = เฉลี่ย seg[i:i+10]
    post_std = smf[a0:a1 - 9].std(0).mean() / sigma
    base_std = smf[B.stop - STREAM_AFTER:B.stop - 9].std(0).mean() / sigma
    f += [post_std, base_std, post_std / max(base_std, 1e-9)]
    for L in (10, 30):
        mot = _rms(smf[L:] - smf[:-L]) / sigma
        c = np.arange(len(mot)) + (L + 10) // 2
        sel = (c >= a0 + (L + 10) // 2) & (c < a1 - (L + 10) // 2)
        f.append(mot[sel].mean())
    half = STREAM_AFTER // 2
    f.append(_rms(seg[a0:a0 + half].mean(0) - seg[a0 + half:a1].mean(0)) / (sigma * np.sqrt(2 / half)))
    f += [float(np.std(rs[a0:a1])), float(np.std(rs[B]))]
    return np.array(f, dtype=float)


# ---------------------------------------------------------------- รุ่น 2 (2026-11-17): เหตุการณ์ + Doppler + หลังเหตุการณ์
# 39 ค่า = feature เหตุการณ์ 18 (features) + Doppler 11 + หลังเหตุการณ์ 10 · กรอบ 492 packet (342 ก่อน m · 150 หลัง)
# ตอนใช้งานจริง m = packet ล่าสุด − 150 → รู้ผลช้ากว่าเหตุการณ์ 1.5 วิ (ระบบรอกดรับทราบ 60 วิอยู่แล้ว)
# ผลแบบรู้จังหวะ (unseen · experiments/eval_event_v2.py): แจ้งเมื่อล้ม ~81% · แจ้งเมื่อล้มหรือนอนบนพื้น ~87%
POST_V2 = 150
WINDOW_V2 = PRE + POST_V2
LATE_WIN = slice(PRE + 80, PRE + POST_V2)          # 0.8–1.5 วิหลัง m: ล้มแล้วยังอยู่ที่พื้น vs สะดุดแล้วลุก
DOP_HP, DOP_NFFT, DOP_HOP = 50, 64, 8               # high-pass 0.5 วิ · STFT 0.64 วิ เลื่อนทีละ 0.08 วิ
DOP_PCS = slice(1, 6)                               # PC2–PC6 — PC1 ส่วนใหญ่เป็น noise ของลิงก์ (ใส่ PC1 แล้วไม่ได้อะไร)
DOP_BANDS = ((2, 6), (6, 12), (12, 25), (25, 50))   # Hz ที่ 100 pkt/s · แถบสูง = ขยับเร็ว
DOPPLER_KEYS = [f"dop_{lo}_{hi}hz_{s}" for lo, hi in DOP_BANDS for s in ("max", "mean")] + \
    ["dop_f80_max", "dop_f80_mean", "dop_fast_t"]
LATE_KEYS = ["late_posture_z", "late_vs_early_z", "late_keep_ratio", "late_level_db", "late_rssi_chg",
             "late_rssi_vs_early", "late_still", "late_still_ratio", "late_mot10", "late_rssi_std"]
KEYS_V2 = FEATURE_KEYS + DOPPLER_KEYS + LATE_KEYS


def _stft_power(x, win, hop):
    """พลังงาน STFT รวมทุกคอลัมน์ของ x → (จำนวนกรอบ, win/2+1) + ตำแหน่งกึ่งกลางกรอบ"""
    w = np.hanning(win)
    n = (len(x) - win) // hop + 1
    frames = np.stack([x[i * hop:i * hop + win] * w[:, None] for i in range(n)])
    return (np.abs(np.fft.rfft(frames, axis=1)) ** 2).sum(2), np.arange(n) * hop + win // 2


def doppler_features(An, m):
    """11 ค่า: สัญญาณสั่นเร็วแค่ไหนตอนเหตุการณ์ เทียบช่วงก่อนทำท่า (แนวเดียวกับ CARM) · ใช้ An[m-342 : m+68]
    ลบค่าเฉลี่ยเคลื่อนที่ 0.5 วิ → PCA → STFT ของ PC2–6 → พลังงานแต่ละแถบความถี่ + ความถี่ที่ครอบ 80% ของพลังงาน"""
    seg = np.asarray(An[m - PRE:m + POST], dtype=float)
    k = DOP_HP
    ma = _ma(seg, k)
    hp = seg[k // 2:k // 2 + len(ma)] - ma
    hp = hp - hp.mean(0)
    _, _, Vt = np.linalg.svd(hp, full_matrices=False)
    P, cen = _stft_power(hp @ Vt[DOP_PCS].T, DOP_NFFT, DOP_HOP)
    cen = cen + k // 2
    freqs = np.fft.rfftfreq(DOP_NFFT, 1 / 100)
    base, ev = cen < BASE_WIN.stop, (cen >= BASE_WIN.stop) & (cen < PRE + 20)
    out = []
    for lo, hi in DOP_BANDS:
        e = P[:, (freqs >= lo) & (freqs < hi)].sum(1)
        bm = max(np.median(e[base]), 1e-12)
        out += [np.log(e[ev].max() / bm), np.log(e[ev].mean() / bm)]
    tot = P[:, freqs >= 2]
    f2 = freqs[freqs >= 2]
    cum = np.cumsum(tot, 1) / np.maximum(tot.sum(1, keepdims=True), 1e-12)
    f80 = f2[(cum < 0.8).sum(1).clip(max=len(f2) - 1)]
    out += [f80[ev].max() - np.median(f80[base]), f80[ev].mean() - np.median(f80[base])]
    fast = P[:, freqs >= 12].sum(1)
    out.append((cen[ev][fast[ev].argmax()] - PRE) / 100)
    return np.nan_to_num(np.array(out, dtype=float))


def late_features(An, Ar, R, m):
    """10 ค่า: ช่วง 0.8–1.5 วิหลัง m ยังต่างจากก่อนทำท่าไหม · เปลี่ยนต่อจากช่วงต้นหลังเหตุการณ์ไหม (ลุก) · นิ่งไหม
    ใช้ An[m-342 : m+150]"""
    seg = np.asarray(An[m - PRE:m + POST_V2], dtype=float)
    raw = np.asarray(Ar[m - PRE:m + POST_V2], dtype=float)
    rs = np.asarray(R[m - PRE:m + POST_V2], dtype=float)
    B, E1, L = BASE_WIN, AFTER_WIN, LATE_WIN
    sigma = np.median(_rms(np.diff(seg[B], axis=0))) / np.sqrt(2)
    nb, ne, nl = B.stop - B.start, E1.stop - E1.start, L.stop - L.start
    base, early, late = seg[B].mean(0), seg[E1].mean(0), seg[L].mean(0)
    sm = _ma(seg, 10)
    post_std = sm[L.start:L.stop - 9].std(0).mean() / sigma
    base_std = sm[B.stop - nl:B.stop - 9].std(0).mean() / sigma
    mot = _rms(sm[10:] - sm[:-10]) / sigma
    return np.nan_to_num(np.array([
        _rms(late - base) / (sigma * np.sqrt(1 / nl + 1 / nb)),
        _rms(late - early) / (sigma * np.sqrt(1 / nl + 1 / ne)),
        _rms(late - base) / max(_rms(early - base), 1e-9),          # ≈1 = ยังอยู่ท่าใหม่ · ≈0 = กลับท่าเดิม
        20 * np.log10(raw[L].mean() / raw[B].mean()),
        float(np.median(rs[L]) - np.median(rs[B])),
        float(np.median(rs[L]) - np.median(rs[E1])),
        post_std, post_std / max(base_std, 1e-9),
        mot[L.start:L.stop - 10].mean(),
        float(np.std(rs[L])),
    ], dtype=float))


def feature_vector_v2(An, Ar, R, m):
    """39 ค่าตามลำดับ KEYS_V2 ของกรอบ m-342 .. m+150 — ตัวเดียวที่ทั้งเทรนและ fall_monitor ใช้"""
    f = features(An, Ar, R, m)
    v = np.concatenate([[f[k] for k in FEATURE_KEYS], doppler_features(An, m), late_features(An, Ar, R, m)])
    return np.nan_to_num(v.astype(float))
