"""
make_figures.py — กราฟ PNG สำหรับสไลด์ จาก numbers.json (สร้างด้วย presentation_numbers.py)
============================================================================================

    python3 fall_detection_backend/ml_service/experiments/make_figures.py
    # ต้องมี matplotlib — venv ของ ml_service ไม่มี ใช้ python3 ของเครื่องได้ (ไม่ต้องใช้ sklearn)

→ docs/reports/figures/dataset_2026_11/fig*.png · 2000×1125 px (16:9) พื้นขาว
ฟอนต์ Arial Unicode MS — ฟอนต์ไทยตัวอื่นในเครื่อง (Thonburi / Tahoma) วางวรรณยุกต์ผิดใน matplotlib
สี: ชุด categorical อ้างอิงของ skill dataviz (ผ่านตัวตรวจ CVD บนพื้นขาว) · ข้อความใช้สีหมึก ไม่ใช้สีเส้น
"""

import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt            # noqa: E402
import numpy as np                         # noqa: E402
from matplotlib.lines import Line2D        # noqa: E402
from matplotlib.patches import PathPatch   # noqa: E402
from matplotlib.path import Path           # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
DIR = os.path.join(REPO, "docs", "reports", "figures", "dataset_2026_11")
N = json.load(open(os.path.join(DIR, "numbers.json"), encoding="utf-8"))
NAMES = {int(k): v for k, v in N["names"].items()}

DPI = 200
PX = DPI / 96                 # 1 CSS px → device px (ออกแบบที่ 960×540 แล้ววาดที่ ~2×)
PT = 0.75                     # 1 CSS px → pt
W, H = 10, 5.625
FONT = "Arial Unicode MS"
C = {"surface": "#ffffff", "ink": "#0b0b0b", "ink2": "#52514e", "muted": "#898781",
     "grid": "#e1e0d9", "axis": "#c3c2b7", "context": "#c3c2b7",
     "s1": "#2a78d6", "s2": "#eb6834", "s3": "#1baf7a", "s4": "#eda100"}
FS = {"title": 24 * PT, "sub": 15 * PT, "body": 15 * PT, "tick": 14 * PT, "small": 13 * PT}
LW, LW_HAIR = 2 * PT, 1 * PT
plt.rcParams.update({"font.family": FONT, "font.size": FS["body"], "axes.unicode_minus": False,
                     "savefig.facecolor": C["surface"]})


def pct(v, d=1):
    return f"{v * 100:.{d}f}%"


def frame(title, subtitle):
    fig = plt.figure(figsize=(W, H), dpi=DPI, facecolor=C["surface"])
    fig.text(0.045, 0.915, title, fontsize=FS["title"], color=C["ink"])
    fig.text(0.045, 0.862, subtitle, fontsize=FS["sub"], color=C["ink2"])
    return fig


def style(ax, grid_axis="x"):
    ax.set_facecolor(C["surface"])
    for s in ("top", "right", "left", "bottom"):
        ax.spines[s].set_visible(False)
    ax.tick_params(colors=C["muted"], labelcolor=C["ink2"], labelsize=FS["tick"], length=0, pad=6)
    if grid_axis:
        ax.grid(axis=grid_axis, color=C["grid"], linewidth=LW_HAIR, linestyle="-")
        ax.set_axisbelow(True)


def legend_row(fig, items, x=0.045, y=0.80, kind="swatch"):
    """legend แนวนอนใต้หัวเรื่อง — items = [(ชื่อ, สี)] · kind: swatch / line / dot"""
    lax = fig.add_axes([0, 0, 1, 1], facecolor="none")
    lax.set_axis_off()
    lax.set_xlim(0, 1)
    lax.set_ylim(0, 1)
    r = fig.canvas.get_renderer()
    for name, col in items:
        if kind == "line":
            lax.plot([x, x + 0.022], [y, y], color=col, linewidth=LW, solid_capstyle="round")
            tx = x + 0.03
        elif kind == "dot":
            lax.plot([x + 0.006], [y], "o", color=col, markersize=8 * PT, markeredgecolor=C["surface"],
                     markeredgewidth=2 * PT)
            tx = x + 0.018
        else:
            lax.add_patch(plt.Rectangle((x, y - 0.012), 0.012, 0.024, color=col, linewidth=0))
            tx = x + 0.019
        t = lax.text(tx, y, name, fontsize=FS["body"], color=C["ink2"], va="center")
        bb = t.get_window_extent(renderer=r)
        x = tx + bb.width / (W * DPI) + 0.03
    return lax


def bar_path(x0, x1, yc, h, rx, ry):
    """แท่งแนวนอน: ปลายข้อมูลมน (รัศมี rx/ry หน่วยข้อมูล) โคนที่ baseline เหลี่ยม"""
    rx, ry = min(rx, abs(x1 - x0) / 2), min(ry, h / 2)
    y0, y1, k = yc - h / 2, yc + h / 2, 0.5523
    v = [(x0, y0), (x1 - rx, y0), (x1 - rx + k * rx, y0), (x1, y0 + ry - k * ry), (x1, y0 + ry),
         (x1, y1 - ry), (x1, y1 - ry + k * ry), (x1 - rx + k * rx, y1), (x1 - rx, y1), (x0, y1), (x0, y0)]
    c = [Path.MOVETO, Path.LINETO, Path.CURVE4, Path.CURVE4, Path.CURVE4, Path.LINETO,
         Path.CURVE4, Path.CURVE4, Path.CURVE4, Path.LINETO, Path.CLOSEPOLY]
    return Path(v, c)


def hbars(ax, ys, vals, colors, thick_px=18):
    """วาดแท่งหลังตั้ง xlim/ylim แล้ว — ความหนาคงที่ ≤ 24px · มุมมน 4px ที่ปลาย"""
    fig = ax.figure
    fig.canvas.draw()
    (ax0, ay0), (ax1, ay1) = ax.transData.transform([(0, 0), (1, 1)])
    sx, sy = abs(ax1 - ax0), abs(ay1 - ay0)                     # device px ต่อหน่วยข้อมูล
    h = thick_px * PX / sy
    for yv, v, col in zip(ys, vals, colors):
        ax.add_patch(PathPatch(bar_path(0, v, yv, h, 4 * PX / sx, 4 * PX / sy), facecolor=col, linewidth=0))
    return h


def save(fig, name):
    path = os.path.join(DIR, name)
    fig.savefig(path, dpi=DPI)
    plt.close(fig)
    print("→", path)


# ---------------------------------------------------------------- 0. dataset
def fig_dataset():
    d = N["dataset"]
    by, lab = d["by_activity"], d["labels"]
    falls = [a for a in ["ล้มไปข้างหน้า", "ล้มไปข้างหลัง", "ล้มไปข้างๆ", "สดุดล้ม"] if a in by]
    nons = sorted([a for a in by if lab[a] == "non_fall"], key=lambda a: -by[a])
    rows = falls + nons
    ys = list(range(len(falls))) + [len(falls) + 0.6 + i for i in range(len(nons))]
    per_actor = sorted(d["by_actor"].values())
    fig = frame(f"Dataset ใหม่ · {d['files']} ไฟล์ จากคนแสดง {len(d['by_actor'])} คน",
                f"คนละ {per_actor[0]}–{per_actor[-1]} ไฟล์ · {d['sessions']} session · บันทึก CSI รวม "
                f"{d['minutes']:.0f} นาที ({d['packets'] / 1e3:.0f}K packet · 100 pkt/s)")
    legend_row(fig, [(f"ล้ม · {d['fall']} ครั้ง", C["s1"]), (f"ไม่ล้ม · {d['non_fall']} ครั้ง", C["s2"])])
    ax = fig.add_axes([0.2, 0.13, 0.72, 0.61])
    style(ax)
    ax.set_xlim(0, max(by.values()) * 1.1)
    ax.set_ylim(ys[-1] + 0.6, -0.6)
    ax.set_yticks(ys, rows)
    ax.set_xticks([0, 25, 50, 75, 100])
    hbars(ax, ys, [by[a] for a in rows], [C["s1"]] * len(falls) + [C["s2"]] * len(nons))
    for yv, a in zip(ys, rows):
        ax.text(by[a] + 1.2, yv, f"{by[a]}", va="center", fontsize=FS["body"], color=C["ink"])
    ax.set_xlabel("จำนวนไฟล์ (1 ไฟล์ = ทำท่า 1 ครั้ง)", fontsize=FS["body"], color=C["ink2"], labelpad=8)
    save(fig, "fig0_dataset.png")


# ---------------------------------------------------------------- 1. RSSI เฉลี่ยรอบเหตุการณ์
def fig_signal():
    t = np.array(N["signal"]["t"], float)
    G = N["signal"]["groups"]
    arr = lambda g, k: np.array([np.nan if v is None else v for v in G[g][k]], float)  # noqa: E731
    main, others = "ล้ม หน้า/หลัง/สดุด", "ยืนนิ่ง · เดิน · สะดุดแต่ไม่ล้ม"
    series = [(main, C["s1"]), ("นอนลงบนพื้น", C["s2"]), ("ล้มไปข้างๆ", C["s3"]), ("ก้มเก็บของ", C["s4"])]
    at = lambda g, x: arr(g, "mean")[np.argmin(abs(t - x))]  # noqa: E731
    fig = frame(f"หลังล้ม RSSI สูงขึ้นราว {at(main, 1.0):.0f} dB — สัญญาณที่โมเดลใช้มากที่สุด",
                f"เฉลี่ยทุกครั้งของแต่ละท่า เทียบกับช่วงก่อนทำท่า · นอนลงบนพื้นขึ้นใกล้เคียงกันแต่ค่อย ๆ ขึ้น · "
                f"ล้มไปข้างๆ ขึ้นแค่ {at('ล้มไปข้างๆ', 1.0):.1f} dB")
    legend_row(fig, [(f"{g} ({G[g]['n']})", col) for g, col in series]
               + [(f"ยืน · เดิน · สะดุดไม่ล้ม ({G[others]['n']})", C["muted"])], kind="line")
    ax = fig.add_axes([0.085, 0.13, 0.73, 0.6])
    style(ax, grid_axis="y")
    lo, hi = arr(main, "p25"), arr(main, "p75")
    ax.fill_between(t, lo, hi, color=C["s1"], alpha=0.10, linewidth=0)
    ax.plot(t, arr(others, "mean"), color=C["muted"], linewidth=LW, solid_capstyle="round")
    for g, col in reversed(series):
        ax.plot(t, arr(g, "mean"), color=col, linewidth=LW, solid_capstyle="round", solid_joinstyle="round")
    vals = np.concatenate([arr(g, "mean") for g, _ in series] + [arr(others, "mean"), lo, hi])
    ymin, ymax = np.floor(np.nanmin(vals)) - 0.5, np.ceil(np.nanmax(vals)) + 0.5
    ax.set_ylim(ymin, ymax)
    ax.set_xlim(t[0], t[-1] + 0.02)
    ax.axhline(0, color=C["axis"], linewidth=LW_HAIR)
    ax.axvline(0, color=C["axis"], linewidth=LW_HAIR)
    ax.text(-0.04, ymax - 0.2, "จุดมาร์ค (ตัวถึงพื้น)", fontsize=FS["small"], color=C["ink2"], va="top", ha="right")
    ax.text(t[0] + 0.05, ymax - 0.2, "แถบฟ้า = ครึ่งกลางของการล้ม (25–75%)",
            fontsize=FS["small"], color=C["muted"], va="top")
    ax.set_xlabel("เวลาเทียบกับจุดมาร์ค (วินาที)", fontsize=FS["body"], color=C["ink2"], labelpad=6)
    ax.set_ylabel("RSSI เทียบก่อนทำท่า (dB)", fontsize=FS["body"], color=C["ink2"], labelpad=8)
    ends = []
    for g, col in series + [(others, C["muted"])]:
        m = arr(g, "mean")
        i = np.where(~np.isnan(m))[0][-1]
        ends.append([m[i], t[i], g.split(" (")[0] if g != others else "ท่าอื่น"])
    ends.sort(key=lambda e: e[0])
    gap = (ymax - ymin) * 0.065
    placed = []
    for v, tx, lbl in ends:
        yv = max(v, placed[-1] + gap) if placed else v
        placed.append(yv)
        ax.annotate(lbl, xy=(tx, v), xytext=(t[-1] + 0.12, yv), fontsize=FS["small"], color=C["ink2"],
                    va="center", annotation_clip=False,
                    arrowprops=dict(arrowstyle="-", color=C["axis"], linewidth=LW_HAIR, shrinkA=0, shrinkB=2))
    save(fig, "fig1_signal.png")


# ---------------------------------------------------------------- 2. ideal ของชุดแรก เทียบชุดใหม่
def ref_line(ax, x, y_top, label):
    ax.axvline(x, color=C["axis"], linewidth=LW_HAIR, zorder=0)
    ax.text(x + 0.6, y_top, label, fontsize=FS["small"], color=C["muted"], va="bottom")


def fig_ideal():
    rows = [("ชุดแรก · ideal", N["first_dataset"]["rf_grouped"], C["context"]),
            ("ชุดใหม่ · unseen", N["main"]["mean"]["bal"], C["s1"])]
    fig = frame("เทียบกับ ideal ของชุดแรก",
                "ชุดแรกวัดเป็น accuracy · ชุดใหม่วัดเป็น balanced accuracy (ทั้งสองชุดมีท่าล้มกับไม่ล้มเกือบเท่ากัน)")
    ax = fig.add_axes([0.24, 0.2, 0.68, 0.5])
    style(ax)
    ys = [0, 1]
    ax.set_xlim(0, 100)
    ax.set_ylim(1.6, -0.9)
    ax.set_yticks(ys, [r[0] for r in rows])
    ax.set_xticks([0, 25, 50, 75, 100], ["0%", "25%", "50%", "75%", "100%"])
    ref_line(ax, 50, -0.75, "เดาสุ่ม 50%")
    hbars(ax, ys, [r[1] * 100 for r in rows], [r[2] for r in rows], thick_px=24)
    for yv, (name, v, col) in zip(ys, rows):
        ax.text(v * 100 + 1.2, yv, pct(v), va="center", fontsize=FS["body"] * 1.15,
                color=C["ink"] if col == C["s1"] else C["ink2"])
    for lbl in ax.get_yticklabels():
        if lbl.get_text().endswith("unseen"):
            lbl.set_color(C["ink"])
    save(fig, "fig2_ideal_vs_unseen.png")


# ---------------------------------------------------------------- 3. รายคน
def fig_person():
    main = N["main"]
    people = sorted(NAMES, key=lambda a: -main["per_person"][str(a)]["bal"])
    rows = [(NAMES[a], main["per_person"][str(a)]["bal"]) for a in people] + [("เฉลี่ย 5 คน", main["mean"]["bal"])]
    fig = frame("ทดสอบทีละคนแบบ unseen",
                "แต่ละแถว: เทรนด้วยอีก 4 คน แล้วทดสอบกับคนนี้ · balanced accuracy")
    ax = fig.add_axes([0.17, 0.1, 0.75, 0.67])
    style(ax)
    ys = list(range(len(rows) - 1)) + [len(rows) - 1 + 0.5]
    ax.set_xlim(0, 100)
    ax.set_ylim(ys[-1] + 0.6, -0.9)
    ax.set_yticks(ys, [r[0] for r in rows])
    ax.set_xticks([0, 25, 50, 75, 100], ["0%", "25%", "50%", "75%", "100%"])
    ref_line(ax, 50, -0.75, "เดาสุ่ม 50%")
    hbars(ax, ys, [r[1] * 100 for r in rows], [C["s1"]] * len(rows))
    for yv, (_, v) in zip(ys, rows):
        ax.text(v * 100 + 1.2, yv, pct(v), va="center", fontsize=FS["body"], color=C["ink"])
    ax.get_yticklabels()[-1].set_color(C["ink"])
    save(fig, "fig3_per_person.png")


# ---------------------------------------------------------------- 4. รายท่า
def fig_activity():
    pa = N["per_activity"]
    falls = sorted([a for a in pa if pa[a]["label"] == "fall"], key=lambda a: -pa[a]["rate"])
    nons = sorted([a for a in pa if pa[a]["label"] == "non_fall"], key=lambda a: pa[a]["rate"])
    rows = falls + nons
    ys = list(range(len(falls))) + [len(falls) + 0.6 + i for i in range(len(nons))]
    m = N["main"]["mean"]
    fig = frame("โมเดลทายว่า “ล้ม” กี่ % ในแต่ละท่า (unseen)",
                f"ท่าล้ม: ยิ่งสูงยิ่งดี (จับล้มได้เฉลี่ย {pct(m['recall'], 0)}) · ท่าไม่ล้ม: ยิ่งต่ำยิ่งดี "
                f"(แจ้งผิดเฉลี่ย {pct(m['false_alarm'], 0)}) · threshold 0.5")
    legend_row(fig, [("ท่าล้ม", C["s1"]), ("ท่าไม่ล้ม", C["s2"])])
    ax = fig.add_axes([0.2, 0.06, 0.72, 0.68])
    style(ax)
    ax.set_xlim(0, 100)
    ax.set_ylim(ys[-1] + 0.6, -0.6)
    ax.set_yticks(ys, [f"{a}" for a in rows])
    ax.set_xticks([0, 25, 50, 75, 100], ["0%", "25%", "50%", "75%", "100%"])
    hbars(ax, ys, [pa[a]["rate"] * 100 for a in rows], [C["s1"]] * len(falls) + [C["s2"]] * len(nons))
    for yv, a in zip(ys, rows):
        ax.text(pa[a]["rate"] * 100 + 1.2, yv, f"{pa[a]['rate'] * 100:.0f}%", va="center", fontsize=FS["body"],
                color=C["ink"])
        ax.text(99.5, yv, f"n={pa[a]['n']}", va="center", ha="right", fontsize=FS["small"], color=C["muted"])
    save(fig, "fig4_per_activity.png")


# ---------------------------------------------------------------- 5. ROC
def fig_roc():
    roc = N["roc"]
    fig = frame("ROC — แลกระหว่างจับล้มได้ กับแจ้งผิด",
                "ทดสอบแบบ unseen · เส้นเทา = รายคน · เส้นน้ำเงิน = รวมทุกคน")
    ax_h = 0.7
    ax_w = ax_h * H / W
    ax = fig.add_axes([0.085, 0.1, ax_w, ax_h])
    style(ax, grid_axis="both")
    ax.plot([0, 1], [0, 1], color=C["axis"], linewidth=LW_HAIR)
    for a, cur in roc["per_person"].items():
        ax.plot(cur["fpr"], cur["tpr"], color=C["context"], linewidth=1.5 * PT, drawstyle="steps-post")
    ax.plot(roc["fpr"], roc["tpr"], color=C["s1"], linewidth=LW, drawstyle="steps-post")
    ax.plot([roc["op_fpr"]], [roc["op_tpr"]], "o", color=C["s1"], markersize=9 * PT, markeredgecolor=C["surface"],
            markeredgewidth=2 * PT, zorder=5)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1.0)
    ticks = [0, 0.25, 0.5, 0.75, 1]
    ax.set_xticks(ticks, [f"{v:.0%}" for v in ticks])
    ax.set_yticks(ticks, [f"{v:.0%}" for v in ticks])
    ax.set_xlabel("แจ้งผิด (ท่าไม่ล้มที่ถูกทายว่าล้ม)", fontsize=FS["body"], color=C["ink2"], labelpad=6)
    ax.set_ylabel("จับล้มได้", fontsize=FS["body"], color=C["ink2"], labelpad=6)
    ax.annotate("threshold 0.5",
                xy=(roc["op_fpr"], roc["op_tpr"]), xytext=(roc["op_fpr"] + 0.1, roc["op_tpr"] - 0.12),
                fontsize=FS["small"], color=C["ink2"], zorder=6,
                bbox=dict(facecolor=C["surface"], edgecolor="none", pad=2),
                arrowprops=dict(arrowstyle="-", color=C["axis"], linewidth=LW_HAIR, shrinkA=2, shrinkB=4))
    ax.text(0.78, 0.73, "เดาสุ่ม", fontsize=FS["small"], color=C["muted"], ha="center", va="bottom", rotation=45,
            rotation_mode="anchor")
    fpr, tpr = np.array(roc["fpr"]), np.array(roc["tpr"])
    tpr_at10 = tpr[fpr <= 0.10].max()
    fpr_at90 = fpr[tpr >= 0.90].min()
    x0 = 0.085 + ax_w + 0.08
    fig.text(x0, 0.6, f"{N['main']['mean']['auc']:.2f}", fontsize=48 * PT, color=C["ink"])
    fig.text(x0, 0.545, "AUC แบบ unseen เฉลี่ย 5 คน (เดาสุ่ม = 0.50)", fontsize=FS["body"], color=C["ink2"])
    rows = [(f"ยอมแจ้งผิด 10%", f"จับล้มได้ {tpr_at10 * 100:.0f}%"),
            (f"อยากจับล้มได้ 90%", f"แจ้งผิด {fpr_at90 * 100:.0f}%"),
            ("threshold 0.5 (ที่รายงาน)", f"จับล้ม {roc['op_tpr'] * 100:.0f}% · แจ้งผิด {roc['op_fpr'] * 100:.0f}%")]
    yy = 0.43
    for k, v in rows:
        fig.text(x0, yy, k, fontsize=FS["body"], color=C["ink2"])
        fig.text(x0, yy - 0.05, v, fontsize=FS["body"] * 1.15, color=C["ink"])
        yy -= 0.12
    save(fig, "fig5_roc.png")


# ---------------------------------------------------------------- 6. learning curve
def fig_learning():
    lc = N["learning_curve"]
    ks = sorted(int(k) for k in lc)
    m = np.array([lc[str(k)]["mean"] for k in ks]) * 100
    sd = np.array([lc[str(k)]["sd"] for k in ks]) * 100
    fig = frame("เทรนจากหลายคนขึ้น ผล unseen ดีขึ้น (เพิ่มช้าลงหลัง 2 คน)",
                "ทดสอบแบบ unseen เสมอ · เฉลี่ยทุกแบบของการเลือกคนมาเทรน · แถบ = ±1 SD")
    ax = fig.add_axes([0.1, 0.14, 0.82, 0.62])
    style(ax, grid_axis="y")
    ax.fill_between(ks, m - sd, m + sd, color=C["s1"], alpha=0.10, linewidth=0)
    ax.plot(ks, m, color=C["s1"], linewidth=LW, solid_capstyle="round", solid_joinstyle="round")
    ax.plot(ks, m, "o", color=C["s1"], markersize=9 * PT, markeredgecolor=C["surface"], markeredgewidth=2 * PT)
    for k, v in zip(ks, m):
        ax.text(k, v + 2.0, f"{v:.1f}%", ha="center", va="bottom", fontsize=FS["body"], color=C["ink"])
    ax.axhline(50, color=C["axis"], linewidth=LW_HAIR)
    ax.text(ks[-1] + 0.25, 50.6, "เดาสุ่ม 50%", fontsize=FS["small"], color=C["muted"], ha="right", va="bottom")
    ax.set_xlim(ks[0] - 0.3, ks[-1] + 0.3)
    ax.set_ylim(48, 82)
    ax.set_xticks(ks, [f"{k} คน" for k in ks])
    ax.set_yticks(range(50, 81, 10), [f"{v}%" for v in range(50, 81, 10)])
    ax.set_xlabel("จำนวนคนที่ใช้เทรน", fontsize=FS["body"], color=C["ink2"], labelpad=6)
    ax.set_ylabel("balanced accuracy", fontsize=FS["body"], color=C["ink2"], labelpad=8)
    save(fig, "fig6_learning_curve.png")


if __name__ == "__main__":
    for fn in (fig_dataset, fig_signal, fig_ideal, fig_person, fig_activity, fig_roc, fig_learning):
        fn()
