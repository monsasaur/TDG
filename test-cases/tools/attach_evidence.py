"""แนบหลักฐานเฉพาะบั๊กที่มีเคส Failed ลงช่องหลักฐานของชีต Dev (ลิงก์ไปไฟล์ในโฟลเดอร์เดียวกัน)"""
import collections, glob, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import openpyxl
from openpyxl.styles import Font
from rec import rec, add_bug, XLSX, _find, _save
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
try: from PIL import Image
except ImportError: Image = None
# MLS-007 คืนขั้นตอนเดิมและผลที่เทสตามขั้นตอนเดิม
wb = openpyxl.load_workbook(XLSX); ws, r = _find(wb, 'MID-MLS-007')
ws.cell(r, 9).value = ws.cell(r, 9).value.replace('2. ลบ rf_v2_event.pkl แล้วแก้ sha256', '2. แก้ sha256'); ws.cell(r, 13).value = '[เพิ่ม 22 พ.ย. หลังบ้าน]'; _save(wb)
b = add_bug('MID-MLS-007', 'ML service', 'Dev ML', 'fetch_models.sh ไม่ตรวจ sha256 ของไฟล์โมเดลที่มีอยู่แล้ว', '1. มี rf_v2_event.pkl อยู่แล้ว\n2. แก้ sha256 ใน models/MANIFEST 1 ตัว\n3. รัน sh scripts/fetch_models.sh',
            'หยุดพร้อม error ว่า sha256 ไม่ตรง (exit ไม่ใช่ 0)', 'ขึ้น "มีอยู่แล้ว ใช้ไฟล์เดิม" exit 0 · ถ้าลบไฟล์ก่อนแล้วโหลดใหม่ ตรวจเจอและ exit 1 ถูกต้อง\nคอมเมนต์ในสคริปต์บอกว่าตั้งใจไม่แตะไฟล์เดิม ถ้าตั้งใจจริงให้ใส่ "ไม่แก้" แล้วแก้ขั้นตอนเคส\nแก้: ตรวจ sha256 ของไฟล์เดิมก่อนข้าม', 'Low', 'evidence/MID-MLS-007.txt')
rec('MID-MLS-007', 'Failed', 'ขั้น 1 โหลดครบ 3 ไฟล์ exit 0 · ขั้น 2 ไฟล์ .pkl ยังอยู่ แก้ sha256 ใน MANIFEST แล้วได้ exit 0 ไม่ตรวจไฟล์เดิม (ถ้าลบไฟล์ก่อน ได้ exit 1 ตามคาด)\nหลักฐาน: evidence/MID-MLS-007.txt (23 พ.ย. · ทำในโฟลเดอร์สำเนา)', b)
# เหตุผล Blocked: มีโมเดลแล้ว เหลือแค่ D8
wb = openpyxl.load_workbook(XLSX); fixed = []
for cid in ('MID-API-023', 'MID-API-024', 'MID-API-026', 'MID-API-027'):
    ws, r = _find(wb, cid); assert ws.cell(r, 12).value == 'Blocked'
    tags = ' '.join(re.findall(r'\[(?:แก้|เพิ่ม|ย้าย)[^\]]*\][^\[\n]*', ws.cell(r, 13).value)).strip()
    ws.cell(r, 13).value = 'ยังเทสไม่ได้: ต้องมีชุดข้อมูล CSI ของ QA (D8) ที่ไม่ได้ใช้เทรน' + (' และโมเดลเวอร์ชันใหม่' if cid[-1] in '67' else '') + '\n' + tags; fixed.append(cid)
fails = collections.defaultdict(list)
for ws in wb:
    if re.match(r'\d+-', ws.title):
        for r in range(2, ws.max_row + 1):
            if ws.cell(r, 12).value == 'Failed': fails[ws.cell(r, 14).value].append(ws.cell(r, 1).value)
            if ws.cell(r, 13).value and 'ไม่มีไฟล์โมเดล' in ws.cell(r, 13).value: print('ยังเขียนว่าไม่มีโมเดล', ws.cell(r, 1).value)
d = wb['อันเชิญ Dev']; os.makedirs('evidence/bugs', exist_ok=True)
for r in range(2, 52):
    n = d.cell(r, 1).value
    if n not in fails: continue
    imgs = []
    for c in fails[n]:
        imgs += sorted(x for x in glob.glob(f'evidence/{c}_*.png')) or glob.glob(f'evidence/{c}.png')
    imgs = [x.replace(os.sep, '/') for x in imgs]
    if imgs and (len(imgs) == 1 or not Image): t = imgs[0]
    elif imgs:
        ims = [Image.open(x).convert('RGB').resize((432, 960)) for x in imgs]; cols = min(5, len(ims)); rows = -(-len(ims) // cols)
        m = Image.new('RGB', (cols * 442, rows * 970), 'white')
        for i, x in enumerate(ims): m.paste(x, ((i % cols) * 442, (i // cols) * 970))
        t = f'evidence/bugs/{n}.png'; m.save(t)
    else: t = f'evidence/{fails[n][0]}.txt'
    c = d.cell(r, 11); c.value = t; c.hyperlink = t; c.font = Font(name=c.font.name, sz=c.font.sz, color='FF0563C1', u='single')
    print(n, fails[n], len(imgs), '->', t, os.path.exists(t))
_save(wb); print('แก้เหตุผล', fixed)
