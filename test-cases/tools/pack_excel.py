"""รวมทุกอย่างเข้า test-cases-MIDDLE-v2.xlsx: ชีต รูปบั๊ก / log หลักฐาน / ทำต่อรอบหน้า (รันซ้ำได้)"""
import glob, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import openpyxl
from openpyxl.drawing.image import Image as XI
from openpyxl.styles import Alignment, Font, PatternFill
from rec import XLSX, _save
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
wb = openpyxl.load_workbook(XLSX); dev = wb['อันเชิญ Dev']
H = PatternFill('solid', fgColor='FF1F4E78'); T = 'Tahoma'
S_IMG, S_LOG, S_NEXT = 'รูปบั๊ก', 'log หลักฐาน', 'ทำต่อรอบหน้า'
for n in (S_IMG, S_LOG, S_NEXT):
    if n in wb.sheetnames: del wb[n]


def head(ws, names, widths):
    for i, (n, w) in enumerate(zip(names, widths), 1):
        c = ws.cell(1, i, n); c.font = Font(name=T, sz=10, bold=True, color='FFFFFFFF'); c.fill = H
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = w
    ws.freeze_panes = 'A2'


def put(ws, r, c, v, **f):
    x = ws.cell(r, c, v); x.font = Font(name=T, sz=10, **f); x.alignment = Alignment(wrap_text=True, vertical='top'); x.data_type = 's' if isinstance(v, str) else x.data_type
    return x


status = {}
for ws in wb:
    if re.match(r'\d+-', ws.title):
        for r in range(2, ws.max_row + 1):
            if ws.cell(r, 1).value: status[ws.cell(r, 1).value] = (ws.cell(r, 12).value, ws.cell(r, 14).value)

# log ทุกเคสที่มีไฟล์ .txt
log = wb.create_sheet(S_LOG); head(log, ['รหัสเคส', 'ผล', 'ไฟล์', 'log'], [14, 10, 30, 140]); lrow = {}
for i, p in enumerate(sorted(glob.glob('evidence/MID-*.txt')), 2):
    cid = os.path.basename(p)[:-4]; t = open(p, encoding='utf-8', errors='replace').read()
    t = re.sub(r'\x1b\[[0-9;]*m', '', t); t = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f]', '', t)
    if len(t) > 32000: t = t[:32000] + '\n... (ตัดให้พอดีเซลล์ ดูต่อในไฟล์)'
    put(log, i, 1, cid); put(log, i, 2, status.get(cid, ('',))[0]); put(log, i, 3, p.replace(os.sep, '/')); put(log, i, 4, t); log.row_dimensions[i].height = 120; lrow[cid] = i

# รูปของบั๊กที่มีเคส Failed
img = wb.create_sheet(S_IMG); head(img, ['เลขบั๊ก', 'เคส Failed', 'ปัญหา', 'รูป'], [10, 16, 40, 130]); r = 2
for d in range(2, 52):
    b = dev.cell(d, 1).value; cases = [k for k, v in status.items() if v[1] == b and v[0] == 'Failed']
    if not cases: continue
    k = dev.cell(d, 11); src = k.value
    if str(src).startswith(f"{S_IMG}") or str(src).startswith(S_LOG): src = None
    cand = [f'evidence/bugs/{b}.png'] + sorted(glob.glob(f'evidence/{cases[0]}.png'))
    pic = next((x for x in cand if os.path.exists(x)), None)
    if pic:
        put(img, r, 1, b, bold=True); put(img, r, 2, '\n'.join(cases)); put(img, r, 3, dev.cell(d, 5).value)
        x = XI(pic); w = 900 if 'bugs/' in pic else 270
        x.height = int(x.height * w / x.width); x.width = w
        if x.height > 540: x.width = int(x.width * 540 / x.height); x.height = 540
        img.add_image(x, f'D{r}'); img.row_dimensions[r].height = min(409, x.height * .75 + 4)
        k.value = f'{S_IMG} แถว {r}'; k.hyperlink = f"#'{S_IMG}'!A{r}"; r += 1
    else:
        n = lrow[cases[0]]; k.value = f'{S_LOG} แถว {n}'; k.hyperlink = f"#'{S_LOG}'!A{n}"
    k.font = Font(name=T, sz=10, color='FF0563C1', u='single')

# ทำต่อรอบหน้า จากไฟล์ md
nx = wb.create_sheet(S_NEXT); nx.column_dimensions['A'].width = 34
for c, w in zip('BCD', (20, 34, 70)): nx.column_dimensions[c].width = w
r = 1
for line in open('ทำต่อรอบหน้า.md', encoding='utf-8').read().splitlines():
    if re.match(r'^\|[-: |]+\|$', line) or line.startswith('```'): continue
    clean = line.replace('**', '').replace('`', '')
    if line.startswith('|'):
        for c, v in enumerate(x.strip() for x in clean.strip('|').split('|')): put(nx, r, c + 1, v)
    else:
        m = re.match(r'^(#+) (.*)', clean)
        x = put(nx, r, 1, m[2] if m else clean, bold=bool(m)); x.alignment = Alignment(wrap_text=False, vertical='top')
    r += 1

# อ่านก่อน + สรุป
a = wb['อ่านก่อน']
if S_IMG not in str(a['A50'].value): a['A50'] = f'{S_IMG} / {S_LOG} / {S_NEXT}'; a['B50'] = 'รูปของบั๊กที่ Failed · log ของเคสที่รันแล้ว · สรุปสถานะและวิธีทำต่อ'
s = wb['สรุป']; s['A20'] = '="เทสจริง (Passed + Failed + Pending ไม่นับ Blocked) = "&(F17+G17+I17)&" จาก "&C17&" เคส ("&TEXT((F17+G17+I17)/C17,"0%")&")"'; s['A20'].font = Font(name=T, sz=10, bold=True)
_save(wb); print('รูป', len(img._images), 'log', len(lrow), 'sheets', wb.sheetnames[-4:])
