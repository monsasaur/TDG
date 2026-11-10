"""udp_rate_check.py — วัดอัตรา CSI ที่ #1 ได้รับจาก #2 ทาง UDP ก่อนเริ่มเก็บข้อมูล
ใช้ timestamp ของ ESP32 (field[18]) ไม่ใช่นาฬิกา Python

  python data_collection/udp_rate_check.py 60 site hello

ผ่าน = rate ≈ 100 · per_sec_stdev < 3 · gaps_over_50ms ≈ 0 · at_#1 qdrop/fail = 0
ผลต่อท้ายใน data/sessions/udp_rate_checks.jsonl

python udp_rate_check.py [วินาที=60] [ชื่อรอบ] [hello]
  hello = ส่ง HELLO ไปที่ #1 (192.168.4.1:5501) ทุก 2 วิ → #1 เปลี่ยนเป็น unicast
บรรทัด STAT จาก #1 (firmware ใหม่) บอกว่า #1 วัด CSI ได้กี่ตัว/ส่งออกกี่ตัว — เทียบกับที่คอมรับได้
"""
import socket, sys, time, statistics, json, os
DUR  = float(sys.argv[1]) if len(sys.argv) > 1 else 60
TAG  = sys.argv[2] if len(sys.argv) > 2 else "run"
HELLO = len(sys.argv) > 3 and sys.argv[3] == "hello"
import re
MAC2 = "1c:c3:ab:b9:78:cc"
s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
s.bind(("0.0.0.0", 5500)); s.settimeout(1.0)
ts, other, t0 = [], {}, time.time()
stats, last_hello = [], 0.0
print(f"[{TAG}] ฟัง UDP :5500 {DUR:.0f} วิ ...", flush=True)
while time.time() - t0 < DUR:
    if HELLO and time.time() - last_hello > 2:
        s.sendto(b"HELLO", ("192.168.4.1", 5501)); last_hello = time.time()
    try: d, _ = s.recvfrom(4096)
    except socket.timeout: continue
    txt = d.decode("utf-8", "ignore")
    if txt.startswith("STAT,"):
        kv = dict(re.findall(r"(\w+)=(\w+)", txt))
        f = txt.split(",")
        stats.append((int(f[2]) / 1000, {k: (int(v) if v.isdigit() else v) for k, v in kv.items()}))
        continue
    p = txt.split(",", 20)
    if len(p) < 19 or not p[0].startswith("CSI_DATA"): continue
    if p[2].lower() != MAC2: other[p[2]] = other.get(p[2], 0) + 1; continue
    try: ts.append(int(p[18]) / 1e6)
    except ValueError: pass
if len(ts) < 50:
    print(f"❌ ได้แค่ {len(ts)} pkt จาก #2 — แมคเกาะ myssid ไหม / #2 มีไฟไหม · MAC อื่น: {other}"); sys.exit(1)
# timestamp ของ ESP32 เป็น uint32 µs วนกลับทุก 71.6 นาที — unwrap ก่อนใช้
WRAP = 2 ** 32 / 1e6
acc, unwrapped = 0.0, [ts[0]]
for a, b in zip(ts, ts[1:]):
    acc += (b - a) % WRAP
    unwrapped.append(ts[0] + acc)
ts = unwrapped
span = ts[-1] - ts[0]
rate = (len(ts) - 1) / span
# อัตรารายวินาที (ตาม ESP32 clock)
bins = {}
for t in ts: bins[int(t - ts[0])] = bins.get(int(t - ts[0]), 0) + 1
per_s = [bins.get(i, 0) for i in range(int(span))]
gaps = [b - a for a, b in zip(ts, ts[1:])]
big = sum(1 for g in gaps if g > 0.05)
res = {"tag": TAG, "pkts": len(ts), "span_s": round(span, 1), "rate": round(rate, 1),
       "per_sec_min": min(per_s), "per_sec_p10": sorted(per_s)[len(per_s)//10],
       "per_sec_median": statistics.median(per_s), "per_sec_max": max(per_s),
       "per_sec_stdev": round(statistics.pstdev(per_s), 1),
       "gaps_over_50ms": big, "other_macs": other}
if len(stats) >= 2:
    (ta, a), (tb, b) = stats[0], stats[-1]
    dt = tb - ta
    res["at_#1_per_s"] = {k: round((b[k] - a[k]) / dt, 1) for k in ("cb", "skip", "qdrop", "sent", "fail") if k in a}
    res["at_#1_dest"] = b.get("dest")
    res["stat_lines"] = len(stats)
    # สัดส่วนที่หายกลางอากาศ ≈ 1 - (คอมรับได้ทุก MAC) / (ที่ #1 ส่งสำเร็จ)
    got_all = len(ts) + sum(other.values())
    sent = (b["sent"] - a["sent"]) * span / dt if dt else 0
    res["air_loss_pct"] = round(100 * (1 - got_all / sent), 1) if sent else None
print(json.dumps(res, ensure_ascii=False, indent=1))
res["at"] = time.strftime("%Y-%m-%dT%H:%M:%S")
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sessions")
os.makedirs(out, exist_ok=True)
with open(os.path.join(out, "udp_rate_checks.jsonl"), "a") as f:
    f.write(json.dumps(res, ensure_ascii=False) + "\n")
