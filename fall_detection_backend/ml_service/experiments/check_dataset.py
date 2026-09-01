"""
check_dataset.py
================
รันหลังเก็บข้อมูลเสร็จ **ก่อนเทรน** — บอกว่าชุดนี้ใช้ได้หรือไม่ พร้อมเหตุผล

    python experiments/check_dataset.py
    echo $?     # 0 = ผ่าน · 1 = ไม่ผ่าน

ทำไมต้องมี
----------
ชุดข้อมูลแรกได้ accuracy 95.6% ซึ่งดูดีมาก แต่ตรวจแล้วพบว่ามาจากการแยก session
ที่บันทึก ไม่ใช่การจับการล้ม (ดู docs/reports/data_quality_audit_2026-09.md)
กว่าจะรู้ก็หลังเทรนไปแล้วหลายรอบ

ไฟล์นี้ย้ายการตรวจนั้นมาไว้ก่อนเทรน — รู้ตั้งแต่ต้นว่าข้อมูลใช้ได้ไหม
ไม่ต้องเทรนเสร็จแล้วมาเดาว่าตัวเลขที่ได้จริงหรือหลอก

audit_data.py เป็นตัวขยายผล อธิบายว่าทำไมถึงไม่ผ่าน — ไฟล์นี้ตอบแค่ผ่าน/ไม่ผ่าน
"""

import os
import sys
import warnings

import numpy as np

sys.path.insert(0, os.path.dirname(__file__))
warnings.filterwarnings("ignore")

import eval_harness as h                                # noqa: E402
from sklearn.ensemble import RandomForestClassifier     # noqa: E402
from sklearn.metrics import accuracy_score, recall_score  # noqa: E402
from sklearn.preprocessing import StandardScaler        # noqa: E402
from sklearn.tree import DecisionTreeClassifier         # noqa: E402

SEED = h.SEED
LEVEL_STATS  = [0, 1, 2]      # mean/min/max   = ระดับสัญญาณ (สภาพห้อง)
SPREAD_STATS = [3, 4, 5, 6, 7]  # std/mad/iqr/skew/kurt = ความแปรปรวน (การเคลื่อนไหว)

PASS, WARN, FAIL = "PASS", "WARN", "FAIL"
MARK = {PASS: "✅", WARN: "⚠️ ", FAIL: "❌"}

results = []


def record(status, name, detail, advice=None):
    results.append((status, name, detail, advice))
    print(f"  {MARK[status]} {name}")
    print(f"      {detail}")
    if advice and status != PASS:
        print(f"      → {advice}")


def quick_model(X, y, splits):
    """RandomForest เบา ๆ พอให้รู้ผล ไม่ต้องแม่นที่สุด"""
    acc, rec = [], []
    for tr, te in splits:
        scaler = StandardScaler().fit(X[tr])
        model = RandomForestClassifier(n_estimators=120, random_state=SEED, n_jobs=-1)
        model.fit(scaler.transform(X[tr]), y[tr])
        pred = model.predict(scaler.transform(X[te]))
        acc.append(accuracy_score(y[te], pred))
        rec.append(recall_score(y[te], pred, pos_label=h.FALL, zero_division=0))
    return float(np.mean(acc)), float(np.mean(rec))


# ---------- การตรวจแต่ละข้อ ----------

def check_integrity(X):
    bad = int(np.isnan(X).sum() + np.isinf(X).sum())
    dupes = len(X) - len(np.unique(X, axis=0))
    const = int(np.sum(X.std(axis=0) < 1e-12))

    if bad:
        record(FAIL, "ความสมบูรณ์ของข้อมูล", f"พบ NaN/Inf {bad} ค่า",
               "เช็ค parse_csi_line ใน preprocess — น่าจะมี packet เสียปนมา")
    elif dupes:
        record(WARN, "ความสมบูรณ์ของข้อมูล", f"มีแถวซ้ำกันเป๊ะ {dupes} แถว",
               "อาจเก็บไฟล์เดิมซ้ำ หรือ ESP32 ส่ง packet ค้าง")
    else:
        record(PASS, "ความสมบูรณ์ของข้อมูล",
               f"ไม่มี NaN/Inf · ไม่มีแถวซ้ำ · feature คงที่ {const}/{X.shape[1]} (guard band ปกติ)")


def check_sessions(sessions):
    if sessions is None:
        record(WARN, "จำนวน session", "ไม่มี session_ids.npy — เป็นข้อมูลที่ preprocess ก่อนมีระบบ session",
               "รัน preprocess_v2.py ใหม่ ถ้าไฟล์ raw เก็บด้วยโหมด session")
        return 0

    n = len(np.unique(sessions))
    if n < 2:
        record(FAIL, "จำนวน session", f"มี {n} session",
               "แบ่ง test ตาม session ไม่ได้ — ต้องเก็บเพิ่มอีกอย่างน้อย 1 session คนละวัน/ห้อง")
    elif n < 3:
        record(WARN, "จำนวน session", f"มี {n} session",
               "พอแบ่งได้แต่เปราะ — 3 session ขึ้นไปจะเชื่อถือได้มากกว่า")
    else:
        record(PASS, "จำนวน session", f"มี {n} session — แบ่ง test แบบกัน session ออกทั้งชุดได้")
    return n


def check_interleaving(y, groups, sessions):
    """เก็บสลับคลาสจริงไหม และคลาสสัมพันธ์กับเวลาแค่ไหน"""
    file_label = {int(f): int(y[groups == f][0]) for f in np.unique(groups)}
    order = sorted(file_label)
    seq = [file_label[f] for f in order]
    switches = sum(1 for i in range(1, len(seq)) if seq[i] != seq[i - 1])
    switch_rate = switches / max(len(seq) - 1, 1)

    corr = abs(np.corrcoef(np.array(seq), np.arange(len(seq)))[0, 1]) if len(set(seq)) > 1 else 0.0

    detail = f"สลับคลาส {switches}/{len(seq)-1} ครั้ง ({switch_rate*100:.0f}%) · สหสัมพันธ์คลาสกับเวลา {corr:.3f}"

    if switch_rate < 0.20 or corr > 0.30:
        record(FAIL, "การสลับคลาสตอนเก็บ", detail,
               "เก็บเป็นบล็อก — สภาพห้องกับคลาสทับกันสนิท แก้ย้อนหลังไม่ได้ "
               "ต้องเก็บใหม่ด้วยโหมด session (กด 's' ใน csi_collector_serial.py)")
    elif switch_rate < 0.60 or corr > 0.15:
        record(WARN, "การสลับคลาสตอนเก็บ", detail, "สลับไม่ทั่วพอ — ควรสลับทุก sample")
    else:
        record(PASS, "การสลับคลาสตอนเก็บ", detail)


def check_drift(X, y, groups, sessions=None):
    """
    ภายในคลาสเดียวกัน แยก 'เก็บช่วงต้น' ออกจาก 'ช่วงท้าย' ได้แม่นแค่ไหน

    ตรวจแยกทีละ session — ความต่างระหว่าง session เป็นเรื่องปกติและมี
    check_cross_session ดูให้อยู่แล้ว ที่อันตรายคือสภาพห้องเลื่อน "ระหว่าง" การเก็บ
    ชุดเดียว เพราะจะไปทับกับลำดับที่เก็บแต่ละคลาส
    """
    if sessions is None:
        sessions = np.zeros(len(y), dtype=int)

    worst, worst_name = 0.0, ""
    for sess in np.unique(sessions):
        for cls, name in [(h.FALL, "fall"), (h.NON_FALL, "non_fall")]:
            mask = (y == cls) & (sessions == sess)
            if mask.sum() < 40:
                continue
            Xc, gc = X[mask], groups[mask]
            files = np.unique(gc)
            if len(files) < 4:
                continue
            early_late = (gc >= files[len(files) // 2]).astype(int)
            if len(np.unique(early_late)) < 2:
                continue
            acc, _ = quick_model(Xc, early_late, h.folds(early_late, gc))
            if acc > worst:
                worst, worst_name = acc, f"{name} (session {sess})"

    if not worst_name:
        record(WARN, "ความเสถียรของสภาพห้อง", "ไฟล์ต่อคลาสน้อยเกินกว่าจะตรวจ drift ได้",
               "เก็บเพิ่มให้แต่ละคลาสมีอย่างน้อย ~10 ไฟล์ต่อ session")
        return

    detail = f"แยกต้น-ท้าย ภายใน {worst_name} ได้ {worst*100:.1f}%"
    if worst > 0.85:
        record(FAIL, "ความเสถียรของสภาพห้อง", detail,
               "สภาพ RF เลื่อนแรงมากระหว่างเก็บ — เช็คว่าขยับ ESP32 / reboot / มีคนเดินผ่านไหม")
    elif worst > 0.75:
        record(WARN, "ความเสถียรของสภาพห้อง", detail, "มี drift พอสมควร ระวังตอนแปลผล")
    else:
        record(PASS, "ความเสถียรของสภาพห้อง", detail)


def check_feature_source(X, y, groups):
    """โมเดลใช้ระดับสัญญาณ (สภาพห้อง) หรือความแปรปรวน (การเคลื่อนไหว)"""
    stat_of = np.arange(X.shape[1]) % 8
    splits = h.folds(y, groups)

    level_acc, _  = quick_model(X[:, np.isin(stat_of, LEVEL_STATS)],  y, splits)
    spread_acc, _ = quick_model(X[:, np.isin(stat_of, SPREAD_STATS)], y, splits)
    gap = level_acc - spread_acc

    detail = (f"ใช้เฉพาะระดับสัญญาณ {level_acc*100:.1f}% · "
              f"เฉพาะความแปรปรวน {spread_acc*100:.1f}% · ต่างกัน {gap*100:+.1f} จุด")

    if gap > 0.10:
        record(FAIL, "โมเดลจับอะไรอยู่", detail,
               "แยกคลาสได้เพราะระดับสัญญาณ ไม่ใช่การเคลื่อนไหว — เป็นลายเซ็นของสภาพห้อง "
               "ไม่ใช่ของการล้ม")
    elif gap > 0.05:
        record(WARN, "โมเดลจับอะไรอยู่", detail, "ระดับสัญญาณยังมีน้ำหนักเกินควร")
    else:
        record(PASS, "โมเดลจับอะไรอยู่", detail)


def check_trivial_feature(X, y, groups):
    """
    feature "ระดับสัญญาณ" เดียวกับเกณฑ์ตัดเดียว แยกคลาสได้แม่นแค่ไหน

    ดูเฉพาะ mean/min/max — ค่าเฉลี่ยความแรงของ subcarrier เดียวที่แยกคลาสได้แม่น
    คือลายเซ็นของสภาพห้อง ไม่ใช่ของการล้ม

    ไม่รวม std/mad/iqr/skew/kurt เพราะถ้าการเคลื่อนไหวต่างกันจริง feature กลุ่มนี้
    "ควร" แยกได้ดี — เอามาเป็นเกณฑ์เตือนจะกลายเป็นลงโทษข้อมูลที่ดี
    """
    files = np.unique(groups)
    rng = np.random.RandomState(SEED)
    rng.shuffle(files)
    train_files = set(files[:len(files) // 2].tolist())
    tr = np.array([i for i in range(len(groups)) if groups[i] in train_files])
    te = np.setdiff1d(np.arange(len(groups)), tr)

    stat_of = np.arange(X.shape[1]) % 8
    stats = ["mean", "min", "max", "std", "mad", "iqr", "skew", "kurt"]

    def best_of(columns):
        best, best_j = 0.0, -1
        for j in columns:
            if X[:, j].std() < 1e-12:
                continue
            stump = DecisionTreeClassifier(max_depth=1, random_state=SEED).fit(X[tr, j:j+1], y[tr])
            acc = accuracy_score(y[te], stump.predict(X[te, j:j+1]))
            if acc > best:
                best, best_j = acc, j
        return best, best_j

    level_best, level_j   = best_of(np.flatnonzero(np.isin(stat_of, LEVEL_STATS)))
    spread_best, spread_j = best_of(np.flatnonzero(np.isin(stat_of, SPREAD_STATS)))

    detail = (f"ระดับสัญญาณเดี่ยวเก่งสุด {level_best*100:.1f}% "
              f"(subcarrier {level_j//8}, {stats[level_j%8]}) · "
              f"ความแปรปรวนเดี่ยว {spread_best*100:.1f}%")

    if level_best > 0.80:
        record(FAIL, "feature ระดับสัญญาณเดี่ยว", detail,
               "ความแรงสัญญาณเฉลี่ยของ subcarrier เดียวแยกคลาสได้แม่นขนาดนี้ "
               "แปลว่าสองคลาสอยู่คนละสภาพแวดล้อมตั้งแต่ต้น ไม่ใช่ต่างกันที่การเคลื่อนไหว")
    elif level_best > 0.70:
        record(WARN, "feature ระดับสัญญาณเดี่ยว", detail,
               "สูงกว่าที่ควร — รัน audit_data.py ดูรายละเอียด")
    else:
        record(PASS, "feature ระดับสัญญาณเดี่ยว", detail)


def check_permutation(X, y, groups):
    """สลับ label สุ่ม — ต้องได้ราว 50% ไม่งั้นวิธีวัดมีปัญหา"""
    labels = {int(f): int(y[groups == f][0]) for f in np.unique(groups)}
    shuffled = list(labels.values())
    np.random.RandomState(SEED).shuffle(shuffled)
    mapping = dict(zip(sorted(labels), shuffled))
    y_random = np.array([mapping[int(f)] for f in groups])

    acc, _ = quick_model(X, y_random, h.folds(y_random, groups))
    detail = f"สลับ label แล้วได้ {acc*100:.1f}% (ควรใกล้ 50%)"

    if acc > 0.60:
        record(FAIL, "ความถูกต้องของวิธีวัด", detail,
               "ยังมีข้อมูลรั่วอยู่ในวิธีแบ่ง — เช็ค groups ที่ส่งเข้า fold")
    else:
        record(PASS, "ความถูกต้องของวิธีวัด", detail)


def check_cross_session(X, y, sessions, groups):
    """ตัวเลขที่สำคัญที่สุด — กัน session ออกทั้งชุดแล้วยังทำงานไหม"""
    if sessions is None or len(np.unique(sessions)) < 2:
        print("  ⏭️  ข้าม cross-session (ต้องมีอย่างน้อย 2 session)")
        return None

    by_file, _    = quick_model(X, y, h.folds(y, groups))
    by_session, recall = quick_model(X, y, h.session_folds(y, sessions))
    drop = by_file - by_session

    detail = (f"แบ่งตามไฟล์ {by_file*100:.1f}% → แบ่งตาม session {by_session*100:.1f}% "
              f"(fall recall {recall*100:.1f}%) · ตกลง {drop*100:.1f} จุด")

    if drop > 0.15:
        record(FAIL, "ข้าม session แล้วยังทำงานไหม", detail,
               "ตกแรงมาก — โมเดลเรียนสภาพห้องของแต่ละ session ไม่ได้เรียนการล้ม "
               "ต้องเก็บหลายห้อง/หลายวันเพิ่ม")
    elif drop > 0.07:
        record(WARN, "ข้าม session แล้วยังทำงานไหม", detail,
               "ตกพอสมควร — ยังพึ่งลักษณะเฉพาะของ session อยู่บ้าง")
    else:
        record(PASS, "ข้าม session แล้วยังทำงานไหม", detail)
    return by_session


def main():
    X, y, groups = h.load_windows()
    sessions = h.load_session_ids()

    print("\n" + "=" * 66)
    print("  🔍  ตรวจชุดข้อมูลก่อนเทรน")
    print(f"  {X.shape[0]:,} window · {len(np.unique(groups))} ไฟล์ · "
          f"fall {int((y==h.FALL).sum())} · non_fall {int((y==h.NON_FALL).sum())}")
    print("=" * 66 + "\n")

    check_integrity(X)
    check_sessions(sessions)
    check_interleaving(y, groups, sessions)
    check_drift(X, y, groups, sessions)
    check_feature_source(X, y, groups)
    check_trivial_feature(X, y, groups)
    check_permutation(X, y, groups)
    honest = check_cross_session(X, y, sessions, groups)

    fails = [r for r in results if r[0] == FAIL]
    warns = [r for r in results if r[0] == WARN]

    print("\n" + "=" * 66)
    if fails:
        print(f"  ❌ ไม่ผ่าน — มีปัญหา {len(fails)} ข้อ")
        for _, name, _, advice in fails:
            print(f"     · {name}: {advice}")
        print("\n  อย่าเพิ่งเทรน — ตัวเลขที่ได้จะไม่สะท้อนความสามารถจริง")
        print("  รัน experiments/audit_data.py เพื่อดูรายละเอียดว่าทำไม")
    elif warns:
        print(f"  ⚠️  ผ่านแบบมีข้อสังเกต {len(warns)} ข้อ — เทรนได้แต่ระวังตอนแปลผล")
    else:
        print("  ✅ ผ่านทุกข้อ — เทรนได้")

    if honest is not None:
        print(f"\n  ตัวเลขที่ควรใช้รายงาน: {honest*100:.1f}% (แบ่ง test ตาม session)")
    print("=" * 66 + "\n")

    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
