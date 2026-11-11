"""
presentation_numbers.py — ตัวเลขทั้งหมดสำหรับสไลด์ dataset 2026-11 → docs/reports/figures/dataset_2026_11/numbers.json
==============================================================================================================

    cd fall_detection_backend/ml_service && source venv/bin/activate
    python experiments/presentation_numbers.py            # ~6 นาที (รวมสลับ label 20 ครั้ง)
    python experiments/presentation_numbers.py --perm 0   # ข้ามการสลับ label (~3 นาที)
    python3 experiments/make_figures.py                   # วาด PNG จาก numbers.json (python ที่มี matplotlib)
    # dashboard_data.json = ตารางเดียวกันในหน่วยที่แสดง สำหรับหน้า artifact

ตัวเลขหลักทุกตัวมาจากการทดสอบกับคนที่โมเดลไม่เคยเห็น: เทรน 4 คน ทดสอบคนที่ 5 วนจนครบทุกคน
(balanced accuracy ที่ threshold 0.5 · เฉลี่ยรายคน) · ไม่รวมห้องว่าง (ง่ายเกินจริง)
- วิธีเดิม  = feature ต่อ window ของ preprocess_v3 (8 สถิติ × subcarrier) + RF แบบ pilot_check
- วิธีใหม่  = feature เหตุการณ์ (event_features.py) + RF · "+ เลื่อนกรอบ" = ตัวหลักที่นำเสนอ
- เทียบวิธีใช้ชุดไฟล์เดียวกันทุกวิธี (ไฟล์ที่ทั้งสองแบบอ่านได้)

⚠️ วัดแบบรู้จังหวะเหตุการณ์ (กรอบอยู่ที่มาร์ค) — ยังไม่ใช่ผลของการใช้งานจริงที่ต้องเลื่อนกรอบไปเรื่อย ๆ
"""

import argparse
import collections
import importlib.util
import itertools
import json
import os
import warnings
from datetime import datetime

import numpy as np

warnings.filterwarnings("ignore")
from sklearn.ensemble import RandomForestClassifier      # noqa: E402
from sklearn.metrics import roc_auc_score, roc_curve    # noqa: E402
from sklearn.model_selection import StratifiedKFold      # noqa: E402

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(BASE))
OUT_DIR = os.path.join(REPO, "docs", "reports", "figures", "dataset_2026_11")


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


EF = _load("event_features", os.path.join(BASE, "experiments", "event_features.py"))
PC = _load("pilot_check", os.path.join(BASE, "experiments", "pilot_check.py"))
P3 = EF.P3
RF = EF.MODELS["RF"]
FALLS = EF.ORDER[:4]
ROUTINE = ["ยืนนิ่ง", "เดิน", "ก้มเก็บของ"]
LOOKALIKE = ["นอนลงบนพื้น", "สะดุดแต่ไม่ล้ม"]
T_GRID = np.round(np.arange(-3.0, 1.5001, 0.05), 2)
# ชุดแรก (Data_2.zip · คนแสดงคนเดียว · เก็บล้มทั้งหมดก่อนแล้วค่อยเก็บไม่ล้ม) — ตัวเลข ideal ที่เคยรายงาน
# ที่มา: docs/reports/data_quality_audit_2026-09.md (accuracy · ข้อมูลสมดุล 400:404 จึงใกล้ balanced accuracy)
FIRST_DATASET = {"lstm_leaky": 0.997,      # แบ่งข้อมูลแบบรั่ว (window ของการล้มครั้งเดียวกันอยู่ทั้งสองฝั่ง)
                 "rf_grouped": 0.956,      # แบ่งตามไฟล์ แต่โมเดลแยกช่วงเวลาเก็บ (session) ได้
                 "rf_motion_only": 0.726}  # เฉพาะ feature ความแปรปรวน = ใกล้ความสามารถจับการเคลื่อนไหวจริง
DESIGN = (1, 2)              # ไซม่อน + ออม — 2 คนที่ใช้ออกแบบ feature เหตุการณ์


def metrics(yt, p):
    pr = p >= 0.5
    rec, fa = float(pr[yt == 1].mean()), float(pr[yt == 0].mean())
    return {"bal": (rec + 1 - fa) / 2, "recall": rec, "false_alarm": fa, "auc": float(roc_auc_score(yt, p))}


def per_person(y, actor, p, people, mask=None):
    m = np.ones(len(y), bool) if mask is None else mask
    out = {int(a): metrics(y[m & (actor == a)], p[m & (actor == a)]) for a in people}
    mean = {k: float(np.mean([v[k] for v in out.values()])) for k in ("bal", "recall", "false_alarm", "auc")}
    return {"per_person": out, "mean": mean}


def old_method_probs(files, actor):
    """วิธีเดิม: window framed ของ preprocess_v3 → RF (แบบ pilot_check) · P(fall) ระดับไฟล์ = เฉลี่ย window"""
    sids = sorted({EF.NAME_RE.match(f).group(1) for f in files})
    data, info, _ = PC.load(sids, with_empty=False)
    Xw, yw, gw = data["ปัจจุบัน"]
    pos = {f: i for i, f in enumerate(files)}
    old_files = [r["file"] for r in info]
    keep = np.array([f in pos for f in old_files])[gw]
    Xw, yw, gw = Xw[keep], (yw[keep] == PC.FALL).astype(int), gw[keep]
    row = np.array([pos[old_files[g]] for g in gw])            # window → แถวใน dataset เหตุการณ์
    aw = actor[row]
    p = np.full(len(files), np.nan)
    for a in np.unique(aw):
        te = aw == a
        m = RandomForestClassifier(n_estimators=200, random_state=42, n_jobs=-1).fit(Xw[~te], yw[~te])
        pw = m.predict_proba(Xw[te])[:, 1]
        for r in np.unique(row[te]):
            p[r] = pw[row[te] == r].mean()
    return p


SIGNAL_GROUPS = {"ล้ม หน้า/หลัง/สดุด": ["ล้มไปข้างหน้า", "ล้มไปข้างหลัง", "สดุดล้ม"],
                 "ล้มไปข้างๆ": ["ล้มไปข้างๆ"],
                 "นอนลงบนพื้น": ["นอนลงบนพื้น"],
                 "ก้มเก็บของ": ["ก้มเก็บของ"],
                 "ยืนนิ่ง · เดิน · สะดุดแต่ไม่ล้ม": ["ยืนนิ่ง", "เดิน", "สะดุดแต่ไม่ล้ม"]}


def signal_curves(files, w=25):
    """RSSI รอบมาร์คเทียบก่อนทำท่า (dB) ต่อไฟล์ → สถิติต่อกลุ่มท่า
    ทำไมเป็น RSSI: เป็น feature ที่ RF ให้น้ำหนักมากสุด (แยกล้ม/ไม่ล้มได้เดี่ยว ๆ AUC ~0.74) และเฉลี่ยข้ามไฟล์ได้
    เพราะทิศของมันเหมือนกันทุกไฟล์ (ตัวลงไปอยู่ต่ำกว่าแนวสัญญาณ → บังน้อยลง → RSSI สูงขึ้น)
    ช่วงอ้างอิง = ก่อนมาร์ค 3.42–1.5 วิ (BASE_WIN เดียวกับ feature) · เฉลี่ยเคลื่อนที่ 0.25 วิ"""
    by_act = collections.defaultdict(list)
    for f in files:
        _, label, act = EF.NAME_RE.match(f).groups()
        _, _, R, mark = EF.parse(os.path.join(P3.RAW_DIR, f))
        m = mark if P3.needs_mark(label, f) else P3.NO_EVENT_MARK
        s, e = m - EF.PRE, min(len(R), m + 200)
        rs = EF._ma(R[s:e, None].astype(float), w)[:, 0]
        t = (np.arange(len(rs)) + w // 2 + s - m) / 100.0
        rel = rs - R[s:s + EF.BASE_WIN.stop].mean()        # เทียบค่าเฉลี่ยช่วงก่อนทำท่า → เส้นเริ่มที่ 0
        by_act[act].append(np.interp(T_GRID, t, rel, left=np.nan, right=np.nan))
    groups = {**SIGNAL_GROUPS, **{a: [a] for a in by_act}}
    out = {}
    for g, acts in groups.items():
        Cm = np.vstack([c for a in acts for c in by_act.get(a, [])])
        ok = np.sum(~np.isnan(Cm), 0) >= max(10, 0.5 * len(Cm))     # ช่วงที่มีไฟล์ครอบคลุมอย่างน้อยครึ่ง
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            stats = {k: np.where(ok, fn(Cm), np.nan) for k, fn in (
                ("mean", lambda x: np.nanmean(x, 0)),
                ("p25", lambda x: np.nanpercentile(x, 25, axis=0)),
                ("p75", lambda x: np.nanpercentile(x, 75, axis=0)))}
        out[g] = {"n": len(Cm), "acts": acts, **stats}
    return out


def dataset_counts():
    """นับไฟล์ดิบทุก session ที่มี manifest (รวมห้องว่าง) + จำนวน packet ทั้งหมด"""
    s2a = EF.actor_of_sessions()
    by_act, by_actor, rows, sessions = collections.Counter(), collections.Counter(), 0, set()
    labels = {}
    for f in os.listdir(P3.RAW_DIR):
        mm = EF.NAME_RE.match(f)
        if not mm or mm.group(1) not in s2a:
            continue
        sid, label, act = mm.groups()
        sessions.add(sid)
        by_act[act] += 1
        labels[act] = label
        by_actor[s2a[sid][1]] += 1
        with open(os.path.join(P3.RAW_DIR, f), encoding="utf-8") as fh:
            rows += sum(1 for _ in fh) - 1
    return {"files": sum(by_act.values()), "sessions": len(sessions), "packets": rows,
            "minutes": rows / 100 / 60, "by_activity": dict(by_act), "labels": labels, "by_actor": dict(by_actor),
            "fall": sum(v for a, v in by_act.items() if labels[a] == "fall"),
            "non_fall": sum(v for a, v in by_act.items() if labels[a] == "non_fall")}


RSSI_KEYS = {"ล้ม หน้า/หลัง/สดุด": "falls_main", "นอนลงบนพื้น": "lying", "ล้มไปข้างๆ": "sideways",
             "ก้มเก็บของ": "bending", "ยืนนิ่ง · เดิน · สะดุดแต่ไม่ล้ม": "others"}


def dashboard_tables(N):
    """numbers.json → ตารางแถวสำหรับหน้าเว็บ (dashboard_data.json) · % ปัด 1 ตำแหน่ง · AUC 2 ตำแหน่ง · RSSI เป็น dB
    เฉพาะโมเดลที่นำเสนอ (เหตุการณ์ + เลื่อนกรอบ) — ผลวิธีเดิมอยู่ใน numbers.json อย่างเดียว ไม่ขึ้นหน้าเว็บ"""
    pc = lambda v: None if v is None else round(v * 100, 1)                     # noqa: E731
    names = {int(k): v for k, v in N["names"].items()}
    cmpd, m = N["compare"], N["main"]["mean"]
    d = N["dataset"]
    ct = N.get("clean_test", {})
    summary = {
        "files_total": d["files"], "people": len(names), "sessions": d["sessions"], "minutes": round(d["minutes"]),
        "packets": d["packets"], "falls": d["fall"], "non_falls": d["non_fall"],
        "eval_files": N["n_files_used"], "eval_falls": sum(v["n"] for v in N["per_activity"].values() if v["label"] == "fall"),
        "eval_non_falls": sum(v["n"] for v in N["per_activity"].values() if v["label"] == "non_fall"),
        "bal": pc(m["bal"]), "auc": round(m["auc"], 2), "recall": pc(m["recall"]), "false_alarm": pc(m["false_alarm"]),
        "op_tpr": pc(N["roc"]["op_tpr"]), "op_fpr": pc(N["roc"]["op_fpr"]),
        "perm_n": N.get("permutation", {}).get("n"), "perm_mean": pc(N.get("permutation", {}).get("mean")),
        "perm_max": pc(N.get("permutation", {}).get("max")),
        "clean_test_bal": pc(ct.get("aug", {}).get("mean", {}).get("bal")),
        "routine_bal": pc(N["views"]["falls_vs_routine"]["bal"]), "routine_auc": round(N["views"]["falls_vs_routine"]["auc"], 2),
        "lookalike_bal": pc(N["views"]["falls_vs_lookalike"]["bal"]),
        "lookalike_auc": round(N["views"]["falls_vs_lookalike"]["auc"], 2)}
    f = N["first_dataset"]
    ideal = [{"key": "first_reported", "dataset": "ชุดแรก", "test": "ideal", "value": pc(f["rf_grouped"]), "metric": "accuracy"},
             {"key": "new_unseen", "dataset": "ชุดใหม่", "test": "unseen", "value": summary["bal"], "metric": "balanced accuracy"}]
    people = [{"person": names[a], "actor_id": a,
               "bal": pc(N["main"]["per_person"][str(a)]["bal"]),
               "recall": pc(N["main"]["per_person"][str(a)]["recall"]),
               "false_alarm": pc(N["main"]["per_person"][str(a)]["false_alarm"]),
               "auc": round(N["main"]["per_person"][str(a)]["auc"], 2)} for a in sorted(names)]
    activities = [{"activity": a, "label": "ล้ม" if v["label"] == "fall" else "ไม่ล้ม", "n": v["n"],
                   "pred_fall_pct": pc(v["rate"])} for a, v in N["per_activity"].items()]
    learning = [{"train_people": int(k), "mean": pc(v["mean"]), "sd": pc(v["sd"]), "min": pc(v["min"]),
                 "max": pc(v["max"]), "combos": v["n"]} for k, v in sorted(N["learning_curve"].items())]
    roc = [{"curve": "รวม 5 คน", "fpr": round(f * 100, 2), "tpr": round(t * 100, 2)}
           for f, t in zip(N["roc"]["fpr"], N["roc"]["tpr"])]
    for a, cur in N["roc"]["per_person"].items():
        roc += [{"curve": names[int(a)], "fpr": round(f * 100, 2), "tpr": round(t * 100, 2)}
                for f, t in zip(cur["fpr"], cur["tpr"])]
    t = N["signal"]["t"]
    G = N["signal"]["groups"]
    rssi, rise = [], []
    for g, key in RSSI_KEYS.items():
        for i, tv in enumerate(t):
            if G[g]["mean"][i] is None:
                continue
            rssi.append({"key": key, "group": g, "t": tv, "mean": round(G[g]["mean"][i], 2),
                         "p25": None if G[g]["p25"][i] is None else round(G[g]["p25"][i], 2),
                         "p75": None if G[g]["p75"][i] is None else round(G[g]["p75"][i], 2)})
        i1 = min(range(len(t)), key=lambda i: abs(t[i] - 1.0))
        rise.append({"key": key, "group": g, "n": G[g]["n"], "rise_db": round(G[g]["mean"][i1], 1)})
    dataset = [{"activity": a, "label": "ล้ม" if d["labels"][a] == "fall" else "ไม่ล้ม", "files": n}
               for a, n in d["by_activity"].items()]
    return {"summary": [summary], "ideal": ideal, "people": people, "activities": activities,
            "learning": learning, "roc": roc, "rssi": rssi, "rssi_rise": rise, "dataset": dataset}


def jsonable(o):
    if isinstance(o, dict):
        return {str(k): jsonable(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [jsonable(v) for v in o]
    if isinstance(o, np.ndarray):
        return [jsonable(v) for v in o.tolist()]
    if isinstance(o, (float, np.floating)):
        return None if np.isnan(o) else round(float(o), 5)
    if isinstance(o, np.integer):
        return int(o)
    return o


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--perm", type=int, default=20, help="สลับ label กี่ครั้ง (0 = ข้าม)")
    args = ap.parse_args()

    D = EF.load_dataset(shifts=EF.SHIFTS)
    y, actor, act, names, files = D["y"], D["actor"], D["act"], D["names"], D["files"]
    people = sorted(names)
    print(f"{len(y)} ไฟล์ (ไม่รวมห้องว่าง) · กำลังเทรน/ทดสอบ ...", flush=True)

    p_aug = EF.held_out_probs(D, y, RF, None, True)
    p_base = EF.held_out_probs(D, y, RF, None, False)
    p_old = old_method_probs(files, actor)
    common = ~np.isnan(p_old)
    print(f"วิธีเดิมอ่านได้ {common.sum()}/{len(y)} ไฟล์", flush=True)

    out = {"generated_at": datetime.now().isoformat(timespec="seconds"),
           "first_dataset": FIRST_DATASET,
           "names": {int(a): names[a] for a in people},
           "n_files_used": int(len(y)), "n_common": int(common.sum()),
           "shifts_sec": [s / 100 for s in EF.SHIFTS],
           "dataset": dataset_counts()}

    out["compare"] = {k: per_person(y, actor, p, people, common) for k, p in
                      (("old", p_old), ("event", p_base), ("event_aug", p_aug))}
    out["main"] = per_person(y, actor, p_aug, people)
    out["main_no_aug"] = per_person(y, actor, p_base, people)
    out["views"] = {
        "falls_vs_routine": per_person(y, actor, p_aug, people, (y == 1) | np.isin(act, ROUTINE))["mean"],
        "falls_vs_lookalike": per_person(y, actor, p_aug, people, (y == 1) | np.isin(act, LOOKALIKE))["mean"]}
    out["per_activity"] = {
        a: {"label": "fall" if a in FALLS else "non_fall", "n": int(np.sum(act == a)),
            "rate": float(np.mean(p_aug[act == a] >= 0.5)),
            "per_person": {int(b): float(np.mean(p_aug[(act == a) & (actor == b)] >= 0.5)) for b in people}}
        for a in EF.ORDER}

    fpr, tpr, _ = roc_curve(y, p_aug)
    keep = np.unique(np.linspace(0, len(fpr) - 1, 300).astype(int))
    out["roc"] = {"fpr": fpr[keep], "tpr": tpr[keep], "auc_pooled": float(roc_auc_score(y, p_aug)),
                  "op_fpr": float(np.mean(p_aug[y == 0] >= 0.5)), "op_tpr": float(np.mean(p_aug[y == 1] >= 0.5)),
                  "per_person": {}}
    for a in people:
        f_, t_, _ = roc_curve(y[actor == a], p_aug[actor == a])
        out["roc"]["per_person"][int(a)] = {"fpr": f_, "tpr": t_}

    # เทสต์สะอาด: feature เหตุการณ์ออกแบบหลังเห็นไซม่อน (1) + ออม (2) → เทรนแค่ 2 คนนี้ ทดสอบ 3 คนที่ไม่เคยเห็น
    out["clean_test"] = {}
    for k, aug in (("aug", True), ("no_aug", False)):
        p = EF.held_out_probs(D, y, RF, list(DESIGN), aug)
        rest = [a for a in people if a not in DESIGN]
        out["clean_test"][k] = per_person(y, actor, p, rest)

    print("learning curve ...", flush=True)
    lc = {}
    for k in range(1, len(people)):
        accs = []
        for sub in itertools.combinations(people, k):
            p = EF.held_out_probs(D, y, RF, list(sub), True)
            accs += [metrics(y[actor == a], p[actor == a])["bal"] for a in people if a not in sub]
        lc[k] = {"mean": float(np.mean(accs)), "sd": float(np.std(accs)), "min": float(np.min(accs)),
                 "max": float(np.max(accs)), "n": len(accs)}
        print(f"  เทรน {k} คน: {lc[k]['mean']*100:.1f}%", flush=True)
    out["learning_curve"] = lc

    print("คนเดิม (สุ่มแบ่งไฟล์ปนทุกคน) ...", flush=True)
    ia, Xa, X = D["aug_idx"], D["aug_X"], D["X"]
    seen = []
    for rep in range(3):
        p = np.zeros(len(y))
        for tr, te in StratifiedKFold(5, shuffle=True, random_state=rep).split(X, y * 10 + actor):
            trm = np.zeros(len(y), bool)
            trm[tr] = True
            rows = trm[ia]
            p[te] = RF().fit(Xa[rows], y[ia][rows]).predict_proba(X[te])[:, 1]
        seen.append(per_person(y, actor, p, people)["mean"]["bal"])
    out["seen_person_bal"] = float(np.mean(seen))

    # อธิบายโมเดล (เทรนทุกไฟล์ ไม่ใช่ผลทดสอบ): feature ไหนถูกใช้มาก · แต่ละตัวแยกล้ม/ไม่ล้มได้แค่ไหนเดี่ยว ๆ
    rf_all = RF().fit(Xa, y[ia])
    out["feature_importance"] = {k: {"importance": float(v),
                                     "auc_alone": float(max(roc_auc_score(y, X[:, i]), 1 - roc_auc_score(y, X[:, i])))}
                                 for i, (k, v) in enumerate(zip(D["keys"], rf_all.feature_importances_))}

    print("RSSI เฉลี่ยรอบมาร์ค ...", flush=True)
    out["signal"] = {"t": T_GRID, "kind": "rssi_change_db", "groups": signal_curves(files)}

    if args.perm:
        print(f"สลับ label {args.perm} ครั้ง ...", flush=True)
        rng = np.random.default_rng(0)
        null = []
        for _ in range(args.perm):
            yp = y.copy()
            for a in people:
                i = np.where(actor == a)[0]
                yp[i] = rng.permutation(y[i])
            pp = EF.held_out_probs(D, yp, RF, None, True)
            null.append(per_person(yp, actor, pp, people)["mean"]["bal"])
        out["permutation"] = {"n": args.perm, "mean": float(np.mean(null)), "max": float(np.max(null)),
                              "p": float((1 + np.sum(np.array(null) >= out["main"]["mean"]["bal"])) / (args.perm + 1))}

    os.makedirs(OUT_DIR, exist_ok=True)
    path = os.path.join(OUT_DIR, "numbers.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(jsonable(out), f, ensure_ascii=False, indent=1)
    with open(os.path.join(OUT_DIR, "dashboard_data.json"), "w", encoding="utf-8") as f:
        json.dump(dashboard_tables(jsonable(out)), f, ensure_ascii=False, separators=(",", ":"))
    c = out["compare"]
    print(f"\nเทียบวิธี ({common.sum()} ไฟล์): เดิม {c['old']['mean']['bal']*100:.1f}% · เหตุการณ์ "
          f"{c['event']['mean']['bal']*100:.1f}% · + เลื่อนกรอบ {c['event_aug']['mean']['bal']*100:.1f}%")
    print(f"ตัวหลัก ({len(y)} ไฟล์): {out['main']['mean']['bal']*100:.1f}% · AUC {out['main']['mean']['auc']:.3f} · "
          f"คนเดิม {out['seen_person_bal']*100:.1f}%")
    print(f"→ {path}")


if __name__ == "__main__":
    main()
