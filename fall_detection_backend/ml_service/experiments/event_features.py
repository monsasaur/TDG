"""
event_features.py — feature แบบ "เหตุการณ์" ที่ทน noise ของลิงก์ + ทดสอบกับคนที่โมเดลไม่เคยเห็น
=====================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    python experiments/event_features.py                       # เทรน 4 คน ทดสอบคนที่เหลือ (ทุกคนวนครบ)
    python experiments/event_features.py --train-actors 1,2    # เทรนเฉพาะคนที่ 1,2 → ทดสอบคนอื่นทั้งหมด
    python experiments/event_features.py --no-augment          # ไม่เลื่อนกรอบตอนเทรน (ผลแบบแรก 71%)
    python experiments/event_features.py --perm 20             # + สลับ label เทียบว่าดีกว่าเดาไหม

ทำไมต้องมี
----------
dataset รอบ 2026-11-11 (5 คน · 801 ไฟล์) เก็บด้วยลิงก์ที่ noise สูงตลอด (กระตุกต่อ packet 8–12%
เทียบชุดแรก 3.6%) · feature เดิม (8 สถิติ × subcarrier ต่อ window) ข้ามคนได้แค่ ~56% ≈ เดาสุ่ม
เพราะดูทีละ packet ซึ่ง noise กลบการเคลื่อนไหว

วิธี — 1 แถวต่อไฟล์ ในกรอบเดียวกับ framed ของ preprocess_v3 (มาร์ค-342 .. มาร์ค+68 · ท่าไม่มีมาร์คใช้ NO_EVENT_MARK)
- เฉลี่ยหลาย packet ก่อน แล้วค่อยดูรูปสัญญาณ (หาร gain ต่อ packet · subcarrier ที่มีข้อมูลจริง 52 ตัว)
- ท่าทาง : รูปสัญญาณหลังมาร์ค (เฉลี่ย 43 pkt) เทียบก่อนทำท่า (192 pkt) · ระดับสัญญาณรวม/RSSI ที่เปลี่ยน
- การขยับ : เฉลี่ย 10 pkt แล้ววัดการเปลี่ยนรูปที่ lag 0.1 / 0.3 วิ · ช่วงเหตุการณ์เทียบช่วงก่อน · PCA
- ทุกตัวหารด้วย noise ที่วัดได้ในไฟล์นั้นเอง → ใช้ข้าม session / ข้ามคนที่ noise ต่างกันได้
- ตอนเทรนตัดกรอบเลื่อนจากมาร์คเพิ่ม ±0.15 / 0.3 วิ (ตัวอย่างเทรน ×5) → โมเดลไม่ยึดติดกับจังหวะกดมาร์ค
  ที่คลาดเคลื่อน · ตอนทดสอบใช้กรอบที่มาร์คเท่านั้น (กรอบเลื่อนไม่เคยข้ามไปฝั่งทดสอบ)

ผล 2026-11-11 (771 ไฟล์ ไม่รวมห้องว่าง · balanced accuracy ที่ threshold 0.5)
- เทรน 4 คน ทดสอบคนที่ 5: RF 72.9% (AUC 0.78) · ไม่เลื่อนกรอบ 71.0% · feature เดิม 54.5% (AUC 0.58)
- เทรนเฉพาะ 2 คนที่ใช้ออกแบบ feature (ไซม่อน+ออม) → 3 คนที่ไม่เคยเห็น: 71.7% (ไม่เลื่อนกรอบ 67.1%)
- สลับ label 20 ครั้ง เฉลี่ย 50.9% สูงสุด 54.5% · ล้มข้างๆ จับได้ 60% · นอนลงบนพื้นแจ้งผิด 46%
- ตัวเลข + กราฟสำหรับสไลด์: experiments/presentation_numbers.py → make_figures.py

⚠️ ประเมินแบบ "รู้จังหวะเหตุการณ์แล้ว" (กรอบอยู่ที่มาร์ค) — ตอนใช้งานจริงไม่มีมาร์ค ต้องเลื่อนกรอบไปเรื่อย ๆ
ซึ่งเปิดโอกาสแจ้งผิดมากกว่านี้ · ต้องทดสอบแบบเลื่อนกรอบก่อนเอาไปใช้ serving
"""

import argparse
import csv
import glob
import importlib.util
import json
import os
import re
import warnings

import numpy as np

warnings.filterwarnings("ignore")
from sklearn.ensemble import RandomForestClassifier      # noqa: E402
from sklearn.linear_model import LogisticRegression     # noqa: E402
from sklearn.metrics import roc_auc_score               # noqa: E402
from sklearn.pipeline import make_pipeline              # noqa: E402
from sklearn.preprocessing import StandardScaler        # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("preprocess_v3", os.path.join(BASE, "notebooks", "preprocess_v3.py"))
P3 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(P3)

VALID_SC = list(range(6, 32)) + list(range(33, 59))
NAME_RE = re.compile(r"^s(\d{8}_\d{4})_\d+_(fall|non_fall)_(.+)_\d{8}_\d{6}_\d+\.csv$")
PRE, POST = 342, 68                      # กรอบเดียวกับ framed: 3.42 วิก่อนมาร์ค · 0.68 วิหลัง
BASE_WIN, AFTER_WIN = slice(0, 192), slice(PRE + 25, PRE + POST)
ORDER = ["ล้มไปข้างหน้า", "ล้มไปข้างหลัง", "ล้มไปข้างๆ", "สดุดล้ม",
         "ยืนนิ่ง", "เดิน", "ก้มเก็บของ", "นอนลงบนพื้น", "สะดุดแต่ไม่ล้ม"]
SHIFTS = (-30, -15, 0, 15, 30)           # เลื่อนกรอบตอนเทรน (packet) = ±0.15 / 0.3 วิ · ทดสอบใช้ 0 เสมอ


def parse(path):
    """แอมพลิจูดหาร gain ต่อ packet / แอมพลิจูดดิบ / RSSI / index มาร์ค — ข้ามแถวเสีย + เฟรม legacy (sig_mode 0)"""
    An, Ar, R, mark = [], [], [], -1
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            raw = r["raw"]
            if r.get("mark") == "1":
                mark = len(An)
            head, _, arr = raw.partition("[")
            p = head.split(",")
            v = arr.rstrip("] \r\n").split()
            if raw.count("CSI_DATA") != 1 or len(p) != 26 or len(v) != 128 or p[5] == "0":
                continue
            v = np.asarray(v, float)
            a = np.hypot(v[0::2], v[1::2])[VALID_SC]
            if a.mean() <= 0:
                continue
            An.append(a / a.mean())
            Ar.append(a)
            R.append(int(p[3]))
    return np.asarray(An), np.asarray(Ar), np.asarray(R), mark


def _ma(x, w):
    c = np.cumsum(np.vstack([np.zeros((1, x.shape[1])), x]), 0)
    return (c[w:] - c[:-w]) / w


def _rms(x, axis=-1):
    return np.sqrt((x ** 2).mean(axis))


def features(An, Ar, R, m):
    """feature ของเหตุการณ์ที่มาร์ค m (index packet) — คืน dict · noise ไม่ใช่ feature ใช้แค่หาร"""
    seg, raw, rs = An[m - PRE:m + POST], Ar[m - PRE:m + POST], R[m - PRE:m + POST]
    sigma = np.median(_rms(np.diff(seg[BASE_WIN], axis=0))) / np.sqrt(2)      # noise ต่อ packet ของไฟล์นี้
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


def actor_of_sessions():
    out = {}
    for p in glob.glob(os.path.join(P3.SESSION_DIR, "session_*.json")):
        d = json.load(open(p))
        out[d["session_id"]] = (d["info"].get("actor_id"), d["info"].get("actor", ""))
    return out


def load_dataset(with_empty=False, shifts=SHIFTS):
    """1 แถวต่อไฟล์ ทุก session ที่มี manifest — X = กรอบที่มาร์ค (ใช้ทดสอบ)
    aug_X / aug_idx = แถวเทรนจากกรอบเลื่อนทุกตัวที่อยู่ในไฟล์ได้ (รวมกรอบที่มาร์ค) · aug_idx ชี้กลับไปที่ไฟล์"""
    shifts = sorted(set(shifts) | {0})
    s2a = actor_of_sessions()
    rows = []
    for fname in sorted(os.listdir(P3.RAW_DIR)):
        mm = NAME_RE.match(fname)
        if not mm or mm.group(1) not in s2a or (mm.group(3) == "ห้องว่าง" and not with_empty):
            continue
        sid, label, act = mm.groups()
        An, Ar, R, mark = parse(os.path.join(P3.RAW_DIR, fname))
        m = mark if P3.needs_mark(label, fname) else P3.NO_EVENT_MARK
        if m < PRE or len(An) < m + POST:
            continue
        per = {s: features(An, Ar, R, m + s) for s in shifts if m + s >= PRE and len(An) >= m + s + POST}
        rows.append((fname, s2a[sid], label, act, per))
    keys = list(rows[0][4][0])
    return {"X": np.array([[r[4][0][k] for k in keys] for r in rows]),
            "aug_X": np.array([[f[k] for k in keys] for r in rows for f in r[4].values()]),
            "aug_idx": np.array([i for i, r in enumerate(rows) for _ in r[4]]),
            "y": np.array([1 if r[2] == "fall" else 0 for r in rows]),
            "actor": np.array([r[1][0] for r in rows]),
            "names": {r[1][0]: r[1][1] for r in rows},
            "act": np.array([r[3] for r in rows]),
            "files": [r[0] for r in rows], "keys": keys}


MODELS = {"RF": lambda: RandomForestClassifier(n_estimators=400, min_samples_leaf=2, random_state=0, n_jobs=-1),
          "LogReg": lambda: make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=3000))}


def metrics(y, p):
    pr = p >= 0.5
    rec, fa = pr[y == 1].mean(), pr[y == 0].mean()
    return (rec + 1 - fa) / 2, rec, fa, roc_auc_score(y, p)


def held_out_probs(D, y, mk, train_actors=None, augment=True):
    """P(fall) ของคนที่ถูกกันไว้ทดสอบ (กรอบที่มาร์ค) · augment = เทรนด้วยกรอบเลื่อนด้วย
    train_actors=None → วนกันทีละคน (leave-one-actor-out) · y แยกออกมาเพื่อให้สลับ label ได้"""
    X, actor = D["X"], D["actor"]
    Xa, ia = (D["aug_X"], D["aug_idx"]) if augment else (X, np.arange(len(X)))

    def fit(train_files):
        rows = train_files[ia]
        return mk().fit(Xa[rows], y[ia][rows])

    p = np.full(len(y), np.nan)
    if train_actors:
        tr = np.isin(actor, train_actors)
        p[~tr] = fit(tr).predict_proba(X[~tr])[:, 1]
        return p
    for a in np.unique(actor):
        te = actor == a
        p[te] = fit(~te).predict_proba(X[te])[:, 1]
    return p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-actors", help="เช่น 1,2 = เทรนเฉพาะคนเหล่านี้ ทดสอบคนที่เหลือ")
    ap.add_argument("--perm", type=int, default=0, help="สลับ label (ภายในแต่ละคน) กี่ครั้ง")
    ap.add_argument("--no-augment", action="store_true", help="ไม่เลื่อนกรอบตอนเทรน (ผลแบบแรก)")
    args = ap.parse_args()
    train_actors = [int(x) for x in args.train_actors.split(",")] if args.train_actors else None
    augment = not args.no_augment

    D = load_dataset(shifts=SHIFTS if augment else (0,))
    X, y, actor, act, names = D["X"], D["y"], D["actor"], D["act"], D["names"]
    tested = [a for a in sorted(names) if not train_actors or a not in train_actors]
    print(f"{len(y)} ไฟล์ (ไม่รวมห้องว่าง) · {len(D['keys'])} feature · " +
          " · ".join(f"{names[a]} {np.sum(actor == a)}" for a in sorted(names)))
    print("เทรน " + ("+".join(names[a] for a in train_actors) + " → ทดสอบคนที่เหลือ" if train_actors
                    else "4 คน ทดสอบคนที่เหลือ (วนครบทุกคน)") + " · balanced acc (จับล้ม / แจ้งผิด · AUC)")
    print(f"ตอนเทรน: {'เลื่อนกรอบ ' + ' '.join(f'{s/100:+.2f}' for s in SHIFTS) + ' วิ' if augment else 'กรอบที่มาร์คอย่างเดียว'}"
          f" ({len(D['aug_X']) if augment else len(y)} แถวเทรนรวม) · ทดสอบ: กรอบที่มาร์ค")

    probs = {}
    for name, mk in MODELS.items():
        p = held_out_probs(D, y, mk, train_actors, augment)
        probs[name] = p
        per = [metrics(y[actor == a], p[actor == a]) for a in tested]
        print(f"  {name:7s} เฉลี่ย {np.mean([m[0] for m in per])*100:5.1f}% · " + " · ".join(
            f"{names[a]} {m[0]*100:4.1f}% ({m[1]*100:.0f}/{m[2]*100:.0f} · {m[3]:.2f})" for a, m in zip(tested, per)))

    p = probs["RF"]
    print("\n% ที่ RF ทายว่า 'ล้ม' ต่อท่า (fall ควรสูง · non_fall ควรต่ำ)")
    print(" " * 16 + "".join(f"{names[a]:>8s}" for a in tested) + "     รวม")
    for ac in ORDER:
        cells = []
        for a in tested:
            i = (actor == a) & (act == ac)
            cells.append(f"{(p[i] >= 0.5).mean()*100:7.0f}%" if i.any() else "      -")
        i = (act == ac) & np.isin(actor, tested)
        print(f"{ac:16s}" + "".join(cells) + f"  {(p[i] >= 0.5).mean()*100:5.0f}%  (n{i.sum()})")

    if args.perm:
        rng = np.random.default_rng(0)
        for name, mk in MODELS.items():
            obs = np.mean([metrics(y[actor == a], probs[name][actor == a])[0] for a in tested])
            null = []
            for _ in range(args.perm):
                yp = y.copy()
                for a in np.unique(actor):
                    i = np.where(actor == a)[0]
                    yp[i] = rng.permutation(y[i])
                pp = held_out_probs(D, yp, mk, train_actors, augment)
                null.append(np.mean([metrics(yp[actor == a], pp[actor == a])[0] for a in tested]))
            null = np.array(null)
            print(f"\nสลับ label {args.perm} ครั้ง ({name}): จริง {obs*100:.1f}% · สลับเฉลี่ย {null.mean()*100:.1f}%"
                  f" สูงสุด {null.max()*100:.1f}% · p = {(1 + (null >= obs).sum()) / (args.perm + 1):.3f}")


if __name__ == "__main__":
    main()
