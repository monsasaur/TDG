"""
streaming_eval.py — ทดสอบแบบเลื่อนกรอบ (เหมือนใช้งานจริงที่ไม่มีมาร์ค) บนไฟล์ที่เก็บไว้
=====================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    python experiments/streaming_eval.py                  # feature แบบดูต่อเนื่อง (rf_v2_event) ~2 นาที
    python experiments/streaming_eval.py --features v1    # feature แบบเดียวกับผล 72.9% (กรอบ 410 packet)

ทำไมต้องมี
----------
ผล 72.9% (event_features.py) วัดที่กรอบตรงจุดมาร์คพอดี แต่ตอนใช้งานจริงไม่มีมาร์ค ระบบต้องตัดสิน
ทุก 0.25 วิ — กรอบที่ไม่ตรงเหตุการณ์ (ยืนรอ · เดิน · ห้องว่าง · ก่อนล้ม) ก็โดนตัดสินด้วย ซึ่งตอนเทรนไม่เคยเห็น

วิธี (เทรน 4 คน ทดสอบคนที่ 5 วนครบ · ทุกไฟล์รวมห้องว่าง)
- เลื่อนกรอบ 410 packet ทุก 25 packet (0.25 วิ) ตลอดไฟล์ → คะแนนต่อกรอบ
- ล้ม: จับได้ถ้ามีกรอบที่ m อยู่ในช่วง -0.5 .. +1.0 วิจากจุดตัวถึงพื้น ได้คะแนน ≥ threshold
- กิจวัตร (ยืนนิ่ง · เดิน · ห้องว่าง · ช่วงยืนก่อนล้ม ≥1.5 วิ): นับครั้งที่แจ้ง (กรอบเกินติดกันนับเป็น 1 ครั้ง) ต่อชั่วโมง
- ท่าคล้ายล้ม (ก้มเก็บของ · นอนลงบนพื้น · สะดุดแต่ไม่ล้ม): % ของครั้งที่ทำแล้วโดนแจ้ง
- ยืนยันด้วย K กรอบติดกัน: K=1 แจ้งทันที · K=2 ต้องเกินติดกัน 0.5 วิ (ช้าลง 0.25 วิ)

เทรน 2 แบบ
- A = แบบที่รายงาน 72.9% (กรอบที่มาร์ค ± เลื่อนกรอบ ไม่รวมห้องว่าง)
- B = A + ตัวอย่างไม่ล้มจากการเลื่อนกรอบ (ทุกกรอบของไฟล์ไม่ล้มรวมห้องว่าง + ช่วงยืนก่อนล้ม) · class_weight balanced

ผล 2026-11-11 (ประมาณจากกิจวัตร ~16 นาที · เทรนแบบ B):
- v1 (กรอบ 410): K=3 thr 0.5 จับล้ม 36% แจ้งผิด ~11/ชม. · K=4 thr 0.4 จับล้ม 44% ~22/ชม.
- stream (กรอบ 472 · ดู 0.7–1.3 วิหลัง): K=4 thr 0.5 จับล้ม 37% ~4/ชม. · K=3 thr 0.5 จับล้ม 42% ~16/ชม.
- stream + นิ่งหลังเหตุการณ์ (28 ค่า · 2026-11-12): K=5 thr 0.4 จับล้ม 43% ~4/ชม. · ยอม ~24/ชม. ได้ 58%
- ยืนนิ่ง/ห้องว่างแทบไม่แจ้ง · แจ้งผิดเกือบทั้งหมดมาจากตอนเดิน · นอนลงบนพื้นโดนแจ้ง ~35–45%

⚠️ ไฟล์ยาวแค่ ~7–9 วิ ตัวเลขต่อชั่วโมงเป็นค่าประมาณคร่าว ๆ จากช่วงเวลารวมราว 1 ชั่วโมง ไม่ใช่การทดสอบต่อเนื่องจริง
"""

import collections
import importlib.util
import json
import os
import pickle
import sys
import warnings

import numpy as np

warnings.filterwarnings("ignore")
from sklearn.ensemble import RandomForestClassifier   # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE)
from app import event_features as AF                  # noqa: E402

_spec = importlib.util.spec_from_file_location("event_features_exp", os.path.join(BASE, "experiments", "event_features.py"))
EF = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(EF)
P3 = EF.P3

STEP = 25
SHIFTS = EF.SHIFTS
DETECT_LO, DETECT_HI = -50, 140        # ช่วงที่ถือว่าจับการล้มได้ (packet จากจุดตัวถึงพื้น · ไฟล์จบราว 2 วิหลังมาร์ค)
PREFALL_MAX = -150                     # กรอบที่จบก่อนล้มอย่างน้อย 1.5 วิ = ยืนปกติ
ROUTINE = {"ยืนนิ่ง", "เดิน", "ห้องว่าง"}
LOOKALIKE = {"ก้มเก็บของ", "นอนลงบนพื้น", "สะดุดแต่ไม่ล้ม"}
THRESHOLDS = [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
FEATURE_SETS = {"v1": (AF.feature_vector, AF.POST), "stream": (AF.stream_feature_vector, AF.STREAM_POST)}
OUT_DIR = os.path.join(BASE, "data", "processed_event")


def parse_file(path):
    import csv
    An, Ar, R, mark = [], [], [], -1
    with open(path, newline="", encoding="utf-8") as f:
        for r in csv.DictReader(f):
            if r.get("mark") == "1":
                mark = len(An)
            got = AF.parse_csi_line(r["raw"])
            if got is None:
                continue
            An.append(got[0]); Ar.append(got[1]); R.append(got[2])
    return np.asarray(An), np.asarray(Ar), np.asarray(R), mark


def build(kind="stream"):
    """ต่อไฟล์: feature ทุกกรอบเลื่อน + กรอบที่มาร์ค ± เลื่อน (ไว้เทรน)"""
    fv, post = FEATURE_SETS[kind]
    s2a = EF.actor_of_sessions()
    rows = []
    for fname in sorted(os.listdir(P3.RAW_DIR)):
        mm = EF.NAME_RE.match(fname)
        if not mm or mm.group(1) not in s2a:
            continue
        sid, label, act = mm.groups()
        An, Ar, R, mark = parse_file(os.path.join(P3.RAW_DIR, fname))
        if len(An) < AF.PRE + post:
            continue
        marked = P3.needs_mark(label, fname)
        if marked and mark < 0:
            continue
        m0 = mark if marked else P3.NO_EVENT_MARK
        pos = list(range(AF.PRE, len(An) - post + 1, STEP))
        Xs = np.array([fv(An, Ar, R, m) for m in pos])
        aligned = {s: fv(An, Ar, R, m0 + s) for s in SHIFTS
                   if m0 + s >= AF.PRE and len(An) >= m0 + s + post}
        rows.append({"file": fname, "actor": s2a[sid][0], "name": s2a[sid][1], "y": int(label == "fall"),
                     "act": act, "mark": mark if marked else None, "pos": np.array(pos), "Xs": Xs, "aligned": aligned})
    return rows


def training_set(rows, idx, strategy):
    X, y = [], []
    for i in idx:
        r = rows[i]
        if r["act"] != "ห้องว่าง":                       # A ไม่รวมห้องว่าง (แบบที่รายงาน)
            for v in r["aligned"].values():
                X.append(v); y.append(r["y"])
        if strategy == "B":
            if r["y"] == 0:
                X.extend(r["Xs"]); y.extend([0] * len(r["Xs"]))
            else:
                keep = r["pos"] - r["mark"] <= PREFALL_MAX
                X.extend(r["Xs"][keep]); y.extend([0] * int(keep.sum()))
    return np.array(X), np.array(y)


def make_model(strategy):
    return RandomForestClassifier(n_estimators=400, min_samples_leaf=2, random_state=0, n_jobs=-1,
                                  class_weight="balanced" if strategy == "B" else None)


def alarms(scores, thr, k):
    """จำนวนครั้งที่แจ้ง: กรอบเกิน threshold ติดกันอย่างน้อย k กรอบ = 1 ครั้ง (ช่วงยาวนับครั้งเดียว)"""
    above = scores >= thr
    n, run = 0, 0
    for a in above:
        run = run + 1 if a else 0
        if run == k:
            n += 1
    return n


def detected(scores, ok, thr, k):
    """ในช่วงจับได้ (ok) มีกรอบเกินติดกันครบ k ไหม — นับต่อจากกรอบก่อนหน้าได้ เหมือนระบบจริง"""
    above = scores >= thr
    run = 0
    for a, inside in zip(above, ok):
        run = run + 1 if a else 0
        if inside and run >= k:
            return True
    return False


def evaluate(rows, scores, thr, k):
    fall_hit, fall_n = 0, 0
    look = collections.Counter()
    routine_alarms, routine_sec = 0, 0.0
    for r, s in zip(rows, scores):
        if r["y"] == 1:
            rel = r["pos"] - r["mark"]
            fall_n += 1
            fall_hit += detected(s, (rel >= DETECT_LO) & (rel <= DETECT_HI), thr, k)
            pre = rel <= PREFALL_MAX
            routine_alarms += alarms(s[pre], thr, k)
            routine_sec += pre.sum() * STEP / 100
        elif r["act"] in ROUTINE:
            routine_alarms += alarms(s, thr, k)
            routine_sec += len(s) * STEP / 100
        else:
            look["n"] += 1
            look["hit"] += alarms(s, thr, k) > 0
            look[r["act"] + "_n"] += 1
            look[r["act"] + "_hit"] += alarms(s, thr, k) > 0
    return {"fall_recall": fall_hit / max(fall_n, 1),
            "routine_alarms_per_hour": routine_alarms / max(routine_sec, 1e-9) * 3600,
            "routine_hours": routine_sec / 3600,
            "lookalike_alarm_rate": look["hit"] / max(look["n"], 1),
            "per_lookalike": {a: look[a + "_hit"] / max(look[a + "_n"], 1) for a in LOOKALIKE}}


def load_rows(kind="stream"):
    os.makedirs(OUT_DIR, exist_ok=True)
    cache = os.path.join(OUT_DIR, f"streaming_cache_{kind}.pkl")
    if os.path.exists(cache):
        return pickle.load(open(cache, "rb"))
    rows = build(kind)
    pickle.dump(rows, open(cache, "wb"))
    return rows


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--features", choices=sorted(FEATURE_SETS), default="stream")
    kind = ap.parse_args().features
    rows = load_rows(kind)
    actor = np.array([r["actor"] for r in rows])
    people = sorted(set(actor))
    print(f"{len(rows)} ไฟล์ · {sum(len(r['pos']) for r in rows)} กรอบเลื่อน · "
          f"ล้ม {sum(r['y'] for r in rows)} · กิจวัตร {sum(r['act'] in ROUTINE for r in rows)} · "
          f"ท่าคล้ายล้ม {sum(r['act'] in LOOKALIKE for r in rows)}", flush=True)

    out = {}
    for strategy in ("A", "B"):
        scores = [None] * len(rows)
        for a in people:
            tr = np.where(actor != a)[0]
            X, y = training_set(rows, tr, strategy)
            m = make_model(strategy).fit(X, y)
            for i in np.where(actor == a)[0]:
                scores[i] = m.predict_proba(rows[i]["Xs"])[:, 1]
        out[strategy] = {}
        print(f"\n=== แบบ {strategy} ({'กรอบที่มาร์ค' if strategy == 'A' else '+ ตัวอย่างไม่ล้มจากการเลื่อนกรอบ'}) ===")
        print("  K  threshold   จับล้มได้   แจ้งผิดตอนกิจวัตร/ชม.   ท่าคล้ายล้มโดนแจ้ง   (ก้ม · นอนลง · สะดุด)")
        for k in (1, 2, 3, 4):
            for thr in THRESHOLDS:
                e = evaluate(rows, scores, thr, k)
                out[strategy][f"k{k}_t{thr}"] = e
                pl = e["per_lookalike"]
                print(f"  {k}    {thr:.1f}       {e['fall_recall']*100:5.1f}%          {e['routine_alarms_per_hour']:6.1f}"
                      f"              {e['lookalike_alarm_rate']*100:5.1f}%     ({pl['ก้มเก็บของ']*100:.0f} · "
                      f"{pl['นอนลงบนพื้น']*100:.0f} · {pl['สะดุดแต่ไม่ล้ม']*100:.0f})", flush=True)
        out[strategy]["routine_hours"] = e["routine_hours"]
    path = os.path.join(OUT_DIR, f"streaming_eval_{kind}.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nเวลากิจวัตรที่ใช้ประมาณ: {out['A']['routine_hours']:.2f} ชม. → {path}")


if __name__ == "__main__":
    main()
