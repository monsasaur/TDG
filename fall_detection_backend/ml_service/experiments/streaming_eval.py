"""
streaming_eval.py — ทดสอบแบบเลื่อนกรอบ (เหมือนใช้งานจริงที่ไม่มีมาร์ค) บนไฟล์ที่เก็บไว้
=====================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    python experiments/streaming_eval.py                  # รุ่น 2: 39 ค่า กรอบ 492 · แจ้งเฉพาะการล้ม (ตัวใน app)
    python experiments/streaming_eval.py --target floor   # รุ่น 2 แจ้งเมื่อล้มหรือนอนบนพื้น
    python experiments/streaming_eval.py --features stream --target fall   # รุ่นก่อน (28 ค่า · ผล 43% ~4/ชม.)
    python experiments/streaming_eval.py --features v1 --target fall       # feature แบบเดียวกับผล 72.9% (กรอบ 410)

⚠️ รุ่น 2 ดูหลังเหตุการณ์ 1.5 วิ แต่ไฟล์จบราว 2.2 วิหลังมาร์ค → กรอบที่ "จับได้" มีให้ตัดสินแค่ราว 5 กรอบต่อไฟล์
   ยืนยันหลายกรอบ (K สูง) จึงถูกประเมินต่ำกว่าจริง · ต้องมีไฟล์ที่อัดต่อหลังเหตุการณ์ ≥5 วิ ถึงจะวัดได้ตรง

ทำไมต้องมี
----------
ผล 72.9% (event_features.py) วัดที่กรอบตรงจุดมาร์คพอดี แต่ตอนใช้งานจริงไม่มีมาร์ค ระบบต้องตัดสิน
ทุก 0.25 วิ — กรอบที่ไม่ตรงเหตุการณ์ (ยืนรอ · เดิน · ห้องว่าง · ก่อนล้ม) ก็โดนตัดสินด้วย ซึ่งตอนเทรนไม่เคยเห็น

วิธี (เทรน 4 คน ทดสอบคนที่ 5 วนครบ · ทุกไฟล์รวมห้องว่าง)
- เลื่อนกรอบ 410 packet ทุก 25 packet (0.25 วิ) ตลอดไฟล์ → คะแนนต่อกรอบ
- ล้ม: จับได้ถ้ามีกรอบที่ m อยู่ในช่วง -0.5 .. +1.0 วิจากจุดตัวถึงพื้น ได้คะแนน ≥ threshold
- กิจวัตร (ยืนนิ่ง · เดิน · ห้องว่าง · ช่วงยืนก่อนล้ม ≥1.5 วิ): นับครั้งที่แจ้ง (กรอบเกินติดกันนับเป็น 1 ครั้ง) ต่อชั่วโมง
  ⚠️ (2026-11-17) การแจ้งผิดตัวนี้ส่วนใหญ่มาจากกรอบที่จบก่อนตัวถึงพื้น 0.2–1 วิ = คนกำลังล้ม ไม่ใช่กิจวัตร
  → ดู routine_only_* (เฉพาะไฟล์ยืนนิ่ง/เดิน/ห้องว่าง ~8.5 นาที) คู่กันเสมอ
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
FEATURE_SETS = {"v1": (AF.feature_vector, AF.POST), "stream": (AF.stream_feature_vector, AF.STREAM_POST),
                "v2": (AF.feature_vector_v2, AF.POST_V2)}
FLOOR_ACTS = {"นอนลงบนพื้น"}           # target "floor" = แจ้งเมื่อล้มหรือลงไปนอนบนพื้น (87.1% บนหน้าอาจารย์ · ไม่ได้ใช้ใน app)
OUT_DIR = os.path.join(BASE, "data", "processed_event")


def label_of(r, target="fall"):
    """1 = ต้องแจ้ง · fall: ล้มเท่านั้น · floor: ล้มหรือนอนลงบนพื้น"""
    return int(r["y"] == 1 or (target == "floor" and r["act"] in FLOOR_ACTS))


def prefall_max(post):
    """กรอบที่จบก่อนเหตุการณ์อย่างน้อย 0.2 วิ = ยังปกติ (กรอบยาวขึ้นต้องถอยมากขึ้น · v1/stream คงค่าเดิม -150)"""
    return min(PREFALL_MAX, -(post + 20))


def smooth(scores, n):
    """เฉลี่ยคะแนน n กรอบล่าสุด (ย้อนหลังอย่างเดียว เหมือนตอนใช้งานจริง) · n=1 = ไม่เฉลี่ย"""
    if n <= 1:
        return scores
    c = np.cumsum(np.concatenate([[0.0], scores]))
    i = np.arange(1, len(scores) + 1)
    lo = np.maximum(i - n, 0)
    return (c[i] - c[lo]) / (i - lo)


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


def training_set(rows, idx, strategy, target="fall", post=AF.STREAM_POST):
    X, y = [], []
    for i in idx:
        r = rows[i]
        lab = label_of(r, target)
        if r["act"] != "ห้องว่าง":                       # A ไม่รวมห้องว่าง (แบบที่รายงาน)
            for v in r["aligned"].values():
                X.append(v); y.append(lab)
        if strategy == "B":
            if lab == 0:
                X.extend(r["Xs"]); y.extend([0] * len(r["Xs"]))
            else:
                keep = r["pos"] - r["mark"] <= prefall_max(post)
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


def evaluate(rows, scores, thr, k, target="fall", post=AF.STREAM_POST):
    """fall_recall = % ของเหตุการณ์ที่ต้องแจ้งที่จับได้ (target floor รวมนอนลงบนพื้น)"""
    fall_hit, fall_n = 0, 0
    look = collections.Counter()
    routine_alarms, routine_sec = 0, 0.0
    only_alarms, only_sec = 0, 0.0          # เฉพาะไฟล์กิจวัตรจริง — ช่วงก่อนเหตุการณ์ส่วนใหญ่คือ "กำลังล้ม" ไม่ใช่กิจวัตร
    for r, s in zip(rows, scores):
        if label_of(r, target) == 1:
            rel = r["pos"] - r["mark"]
            fall_n += 1
            fall_hit += detected(s, (rel >= DETECT_LO) & (rel <= DETECT_HI), thr, k)
            pre = rel <= prefall_max(post)
            routine_alarms += alarms(s[pre], thr, k)
            routine_sec += pre.sum() * STEP / 100
        elif r["act"] in ROUTINE:
            a = alarms(s, thr, k)
            routine_alarms += a
            routine_sec += len(s) * STEP / 100
            only_alarms += a
            only_sec += len(s) * STEP / 100
        else:
            look["n"] += 1
            look["hit"] += alarms(s, thr, k) > 0
            look[r["act"] + "_n"] += 1
            look[r["act"] + "_hit"] += alarms(s, thr, k) > 0
    return {"fall_recall": fall_hit / max(fall_n, 1),
            "routine_alarms_per_hour": routine_alarms / max(routine_sec, 1e-9) * 3600,
            "routine_hours": routine_sec / 3600,
            "routine_only_alarms": only_alarms, "routine_only_hours": only_sec / 3600,
            "routine_only_alarms_per_hour": only_alarms / max(only_sec, 1e-9) * 3600,
            "lookalike_alarm_rate": look["hit"] / max(look["n"], 1),
            "per_lookalike": {a: look[a + "_hit"] / look[a + "_n"] for a in sorted(LOOKALIKE) if look[a + "_n"]}}


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
    ap.add_argument("--features", choices=sorted(FEATURE_SETS), default="v2")
    ap.add_argument("--target", choices=("fall", "floor"), default="fall",
                    help="fall = ล้มเท่านั้น (ค่าเริ่มต้น · ตัวใน app) · floor = แจ้งเมื่อล้มหรือนอนลงบนพื้น")
    args = ap.parse_args()
    kind, target = args.features, args.target
    post = FEATURE_SETS[kind][1]
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
            X, y = training_set(rows, tr, strategy, target, post)
            m = make_model(strategy).fit(X, y)
            for i in np.where(actor == a)[0]:
                scores[i] = m.predict_proba(rows[i]["Xs"])[:, 1]
        out[strategy] = {}
        print(f"\n=== แบบ {strategy} ({'กรอบที่มาร์ค' if strategy == 'A' else '+ ตัวอย่างไม่ล้มจากการเลื่อนกรอบ'}) · "
              f"เป้าหมาย {target} ===")
        print("  K  threshold   จับได้    แจ้งผิด/ชม. (รวมช่วงก่อนเหตุการณ์ · กิจวัตรจริงอย่างเดียว)   ท่าคล้ายโดนแจ้ง (ต่อท่า)")
        for k in (1, 2, 3, 4):
            for thr in THRESHOLDS:
                e = evaluate(rows, scores, thr, k, target, post)
                out[strategy][f"k{k}_t{thr}"] = e
                pl = " · ".join(f"{a} {v*100:.0f}" for a, v in e["per_lookalike"].items())
                print(f"  {k}    {thr:.1f}       {e['fall_recall']*100:5.1f}%    {e['routine_alarms_per_hour']:6.1f} · "
                      f"{e['routine_only_alarms_per_hour']:5.1f} ({e['routine_only_alarms']} ครั้ง)"
                      f"     {e['lookalike_alarm_rate']*100:5.1f}%  ({pl})", flush=True)
        out[strategy]["routine_hours"] = e["routine_hours"]
    path = os.path.join(OUT_DIR, f"streaming_eval_{kind}_{target}.json")
    json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\nเวลากิจวัตรที่ใช้ประมาณ: {out['A']['routine_hours']:.2f} ชม. → {path}")


if __name__ == "__main__":
    main()
