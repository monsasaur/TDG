"""
pilot_check.py — ด่านนำร่อง: ตำแหน่ง ESP32 นี้ "เห็น" การล้มไหม (ตัดสินด้วยโมเดลจริงบนข้อมูลจริง)
============================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    python experiments/pilot_check.py                    # session ล่าสุด
    python experiments/pilot_check.py --actor 1          # ทุก session ของคนแสดงคนที่ 1
    python experiments/pilot_check.py --session 20261111_0415 [--session ...]
    python experiments/pilot_check.py --with-empty       # รวมห้องว่าง (ปกติไม่รวม)

รันหลังคนแรกเก็บ ~30 รอบ **ก่อน** เก็บต่ออีกหลายชั่วโมง · exit code 0 = ผ่าน · 1 = ไม่ผ่าน

ทำไมต้องมี
----------
udp_rate_check บอกได้แค่ว่า "ข้อมูลมาครบ" ไม่ได้บอกว่า "ข้อมูลเห็นคน" — ถ้าจุดทำท่าไม่อยู่ใน
แนวสัญญาณระหว่าง #1 กับ #2 ทุกไฟล์ดูปกติหมด อัตราดี มาร์คครบ แต่การล้มแทบไม่ทิ้งร่องรอย
ลองใช้ตัววัดการเคลื่อนไหวแบบง่ายแล้ว เชื่อถือไม่พอ (gain ของ ESP32 กระโดดเป็นขั้น) →
ใช้คำถามเดียวกับที่จะถามตอนเทรนจริงเลย: RandomForest แยก fall / non_fall ภายใน session นี้ได้ไหม

วิธี
----
- ตัด window แบบเดียวกับ preprocess_v3 (framed: 3 window รอบจุดมาร์ค)
- แบ่ง train/test ตามไฟล์ (window ของไฟล์เดียวกันไม่ข้ามฝั่ง) · ทำนายระดับไฟล์ = เฉลี่ย 3 window
- เทียบกับ "สลับ label สุ่ม" 20 ครั้ง → ได้ p-value ว่าดีกว่าเดาจริงไหม
- ไม่รวมห้องว่างเป็นค่าเริ่มต้น — ไม่มีคนเลยแยกง่ายเกิน จะดันตัวเลขให้ดูดีเกินจริง
- ลอง feature 2 แบบ:
    ปัจจุบัน  = preprocess_v3 ตามที่เป็นอยู่ (subcarrier index 0-51)
    ปรับปรุง  = subcarrier ที่มีข้อมูลจริง [6-31, 33-58] + หารแต่ละ packet ด้วยระดับของมันเอง
               (ห้องว่างในรอบซ้อมแกว่ง 50% ก่อนหาร · 10% หลังหาร = ส่วนใหญ่เป็น gain)
  ผ่านแบบใดแบบหนึ่ง = ตำแหน่งใช้ได้ (ถ้าผ่านแค่แบบปรับปรุง → ต้องแก้ preprocess ก่อนเทรน)

ข้อจำกัด: ~60 ไฟล์ให้ความแม่นราว ±12% — พอตอบ "เห็น / ไม่เห็น" ไม่พอใช้รายงานผล
"""

import argparse
import csv
import glob
import importlib.util
import json
import os
import re
import sys
import warnings
from datetime import datetime

import numpy as np

warnings.filterwarnings("ignore")
from sklearn.ensemble import RandomForestClassifier      # noqa: E402
from sklearn.model_selection import StratifiedGroupKFold  # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_spec = importlib.util.spec_from_file_location("preprocess_v3", os.path.join(BASE, "notebooks", "preprocess_v3.py"))
P3 = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(P3)

RAW_DIR = os.environ.get("PILOT_RAW_DIR") or P3.RAW_DIR
SESSION_DIR = os.environ.get("PILOT_SESSION_DIR") or P3.SESSION_DIR
OUT_FILE = os.path.join(SESSION_DIR, "pilot_checks.jsonl")

VALID_SC = list(range(6, 32)) + list(range(33, 59))
FALL, NON = P3.LABEL_MAP["fall"], P3.LABEL_MAP["non_fall"]
NAME_RE = re.compile(r"^s(\d{8}_\d{4})_\d+_(fall|non_fall)_(.+)_\d{8}_\d{6}_\d+\.csv$")
N_PERM = 20
SEED = 42
MIN_FILES_PER_CLASS = 8

# เกณฑ์ — balanced accuracy ระดับไฟล์ + p-value เทียบสลับ label
PASS_BAL, PASS_P = 0.70, 0.05
FAIL_BAL, FAIL_P = 0.60, 0.20


# =================== โหลดไฟล์ ===================
def manifests():
    out = {}
    for p in glob.glob(os.path.join(SESSION_DIR, "session_*.json")):
        try:
            with open(p, encoding="utf-8") as f:
                m = json.load(f)
            out[m["session_id"]] = m
        except (OSError, ValueError, KeyError):
            continue
    return out


def pick_sessions(args, mans):
    if args.session:
        return list(args.session)
    if args.actor:
        return sorted(s for s, m in mans.items() if (m.get("info") or {}).get("actor_id") == args.actor)
    files = [f for f in os.listdir(RAW_DIR) if NAME_RE.match(f)]
    sids = sorted({NAME_RE.match(f).group(1) for f in files})
    return sids[-1:]


def read_improved(path):
    """แอมพลิจูด 52 subcarrier ที่มีข้อมูลจริง · หารแต่ละ packet ด้วยระดับของมันเอง · smooth แบบเดียวกับ v3"""
    amps, mark = [], -1
    with open(path, encoding="utf-8") as f:
        for i, r in enumerate(csv.DictReader(f)):
            raw = r["raw"]
            if r.get("mark") == "1":
                mark = len(amps)
            v = P3.csi_values(raw)               # ทิ้งบรรทัดซ้อน + เฟรม legacy แบบเดียวกับ preprocess_v3
            if v is None or len(v) != 128:       # != (ไม่ใช่ <) — บรรทัดที่ข้อมูลหายกลางทางมีค่าไม่ครบ/เกิน
                continue
            a = np.asarray(v[0:128:2], float)
            b = np.asarray(v[1:128:2], float)
            amp = np.sqrt(a * a + b * b)[VALID_SC]
            amps.append(amp / max(amp.mean(), 1e-9))
    if len(amps) < P3.WINDOW_SIZE:
        return None, mark
    return P3.smooth_signal(np.asarray(amps)), mark


def load(sids, with_empty):
    """คืน {variant: (X, y, groups)} และข้อมูลไฟล์ — ตัด window แบบ framed ของ preprocess_v3"""
    files = sorted(f for f in os.listdir(RAW_DIR)
                   if NAME_RE.match(f) and NAME_RE.match(f).group(1) in sids)
    data = {"ปัจจุบัน": ([], [], []), "ปรับปรุง": ([], [], [])}
    info, skipped = [], 0
    for fname in files:
        m = NAME_RE.match(fname)
        label, act = m.group(2), m.group(3)
        if act == "ห้องว่าง" and not with_empty:
            continue
        path = os.path.join(RAW_DIR, fname)
        clip = P3.read_clip(path)
        if clip is None:
            skipped += 1
            continue
        amp_cur, _, mark = clip
        if P3.needs_mark(label, fname) and mark < 0:
            skipped += 1
            continue
        amp_imp, mark_imp = read_improved(path)      # mark ของตัวเอง — แถวที่ parse ไม่ผ่านอาจต่างกัน
        fa_cur = P3.build_framed(amp_cur, label, mark)
        fa_imp = P3.build_framed(amp_imp, label, mark_imp) if amp_imp is not None else []
        if not fa_cur or not fa_imp:
            skipped += 1
            continue
        fid = len(info)
        info.append({"file": fname, "label": label, "activity": act})
        for key, feats in (("ปัจจุบัน", fa_cur), ("ปรับปรุง", fa_imp)):
            X, y, g = data[key]
            X.extend(feats)
            y.extend([P3.LABEL_MAP[label]] * len(feats))
            g.extend([fid] * len(feats))
    out = {k: (np.asarray(X, np.float32), np.asarray(y), np.asarray(g)) for k, (X, y, g) in data.items()}
    return out, info, skipped


# =================== ประเมิน ===================
def file_probs(X, y, groups, n_files, seed=SEED):
    """P(fall) ระดับไฟล์ จาก cross-validation แบ่งตามไฟล์"""
    file_y = np.array([y[groups == f][0] for f in range(n_files)])
    n_min = int(min((file_y == FALL).sum(), (file_y == NON).sum()))
    cv = StratifiedGroupKFold(n_splits=min(5, n_min), shuffle=True, random_state=seed)
    prob = np.full(n_files, np.nan)
    fall_col = None
    for tr, te in cv.split(X, y, groups):
        model = RandomForestClassifier(n_estimators=200, random_state=seed, n_jobs=-1)
        model.fit(X[tr], y[tr])
        fall_col = list(model.classes_).index(FALL)
        p = model.predict_proba(X[te])[:, fall_col]
        for f in np.unique(groups[te]):
            prob[f] = p[groups[te] == f].mean()
    return prob, file_y


def balanced_acc(prob, file_y):
    pred_fall = prob >= 0.5
    rec_fall = pred_fall[file_y == FALL].mean()
    spec = (~pred_fall[file_y == NON]).mean()
    return float((rec_fall + spec) / 2), float(rec_fall), float(1 - spec)


def evaluate(X, y, groups, info):
    n = len(info)
    prob, file_y = file_probs(X, y, groups, n)
    bal, rec, fa = balanced_acc(prob, file_y)
    # สลับ label ระดับไฟล์ (คงจำนวนต่อคลาส) — ถ้าข้อมูลไม่มีสัญญาณ ตัวเลขจริงจะไม่ต่างจากนี้
    rng = np.random.RandomState(SEED)
    perm = []
    for i in range(N_PERM):
        shuffled = rng.permutation(file_y)
        y_perm = shuffled[groups]
        pp, fy = file_probs(X, y_perm, groups, n, seed=SEED + 1 + i)
        perm.append(balanced_acc(pp, fy)[0])
    perm = np.asarray(perm)
    p_value = float((1 + (perm >= bal).sum()) / (1 + N_PERM))
    per_act = {}
    for k, r in enumerate(info):
        per_act.setdefault((r["label"], r["activity"]), []).append(prob[k] >= 0.5)
    return {"bal_acc": bal, "fall_recall": rec, "false_alarm": fa, "perm_mean": float(perm.mean()),
            "perm_sd": float(perm.std()), "p_value": p_value,
            "per_activity": {f"{l}:{a}": float(np.mean(v)) for (l, a), v in per_act.items()},
            "status": ("PASS" if bal >= PASS_BAL and p_value <= PASS_P else
                       "FAIL" if bal < FAIL_BAL or p_value > FAIL_P else "WARN")}


# =================== main ===================
def main():
    ap = argparse.ArgumentParser(description="ด่านนำร่อง — ตำแหน่ง ESP32 นี้เห็นการล้มไหม")
    ap.add_argument("--session", action="append", help="session id (ใส่ซ้ำได้)")
    ap.add_argument("--actor", type=int, help="ทุก session ของคนแสดงคนนี้ (1-5)")
    ap.add_argument("--with-empty", action="store_true", help="รวมท่าห้องว่าง")
    args = ap.parse_args()

    mans = manifests()
    sids = pick_sessions(args, mans)
    if not sids:
        print("❌ ไม่พบ session — เก็บข้อมูลด้วย collect_web.py ก่อน")
        return 1
    data, info, skipped = load(set(sids), args.with_empty)
    n_fall = sum(1 for r in info if r["label"] == "fall")
    n_non = len(info) - n_fall

    print("=" * 66)
    print("  🚦  ด่านนำร่อง — ตำแหน่ง ESP32 นี้เห็นการล้มไหม")
    print(f"  session {', '.join(sids)}")
    print(f"  {len(info)} ไฟล์ (fall {n_fall} · non_fall {n_non}{'' if args.with_empty else ' · ไม่รวมห้องว่าง'})"
          f"{f' · ข้าม {skipped} ไฟล์' if skipped else ''}")
    print("=" * 66)
    if min(n_fall, n_non) < MIN_FILES_PER_CLASS:
        print(f"\n  ❌ ข้อมูลน้อยไป — ต้องมีอย่างน้อย {MIN_FILES_PER_CLASS} ไฟล์ต่อคลาส "
              f"(แนะนำ ~30 รอบ = 60 ไฟล์)")
        return 1

    results = {}
    for key in ("ปัจจุบัน", "ปรับปรุง"):
        X, y, g = data[key]
        r = evaluate(X, y, g, info)
        results[key] = r
        mark = {"PASS": "✅", "WARN": "⚠️ ", "FAIL": "❌"}[r["status"]]
        print(f"\n  {mark} feature แบบ{key}")
        print(f"      แยกได้ (balanced accuracy ระดับไฟล์) {r['bal_acc']*100:5.1f}%  · "
              f"สลับ label สุ่มได้ {r['perm_mean']*100:4.1f}% ±{r['perm_sd']*100:.1f}  · p = {r['p_value']:.3f}")
        print(f"      fall recall {r['fall_recall']*100:5.1f}%  · false alarm {r['false_alarm']*100:5.1f}%")
        for k, v in sorted(r["per_activity"].items()):
            label, act = k.split(":", 1)
            what = "ตรวจเจอว่าล้ม" if label == "fall" else "แจ้งผิดว่าล้ม"
            print(f"        {act:16s} {what} {v*100:5.1f}%")

    best = max(results.values(), key=lambda r: (r["status"] == "PASS", r["bal_acc"]))
    status = best["status"]
    print("\n" + "=" * 66)
    if status == "PASS":
        which = [k for k, r in results.items() if r["status"] == "PASS"]
        print(f"  ✅ ผ่าน — ตำแหน่งนี้เห็นความต่างระหว่าง fall กับ non_fall (feature แบบ{' และ '.join(which)})")
        if which == ["ปรับปรุง"]:
            print("     ⚠️  ผ่านเฉพาะแบบปรับปรุง → ก่อนเทรนจริงต้องแก้ preprocess_v3 ให้ใช้ subcarrier"
                  " [6-31, 33-58] + หารระดับต่อ packet")
        print("     เก็บต่อได้ · ตัวเลขนี้ยังไม่ใช่ผลที่ใช้รายงาน (ไฟล์น้อย + session เดียว)")
    elif status == "WARN":
        print("  ⚠️  ก้ำกึ่ง — ดีกว่าสุ่มแต่ไม่ชัด · เก็บเพิ่มอีก ~20 รอบแล้วรันใหม่ ถ้ายังก้ำกึ่ง ให้ขยับ ESP32")
    else:
        print("  ❌ ไม่ผ่าน — แยกไม่ได้ดีกว่าการเดา = ตำแหน่งนี้แทบไม่เห็นการล้มที่จุดทำท่า")
        print("     หยุดเก็บ · ย้าย ESP32 ให้จุดทำท่าอยู่กลางแนว #1↔#2 (ห่าง 2-4 ม. สูงราวเอว-อก ไม่มีของกั้น)")
        print("     แล้วนำร่องใหม่ · ไฟล์ชุดนี้ย้ายไปเก็บแยก อย่าปนกับชุดจริง")
    print("=" * 66 + "\n")

    os.makedirs(SESSION_DIR, exist_ok=True)
    with open(OUT_FILE, "a", encoding="utf-8") as fh:
        fh.write(json.dumps({"at": datetime.now().isoformat(timespec="seconds"), "sessions": sids,
                             "n_files": len(info), "with_empty": args.with_empty, "status": status,
                             "results": results}, ensure_ascii=False) + "\n")
    return 0 if status == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
