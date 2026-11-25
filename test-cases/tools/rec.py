"""บันทึกผลทีละเคสลง test-cases-MIDDLE-v2.xlsx
ใช้จากสคริปต์อื่น: rec(case, status, note, bug) และ add_bug(...)
"""
import os, re, time
import openpyxl

XLSX = os.path.join(os.path.dirname(__file__), '..', 'test-cases-MIDDLE-v2.xlsx')
STATUSES = {'Not Start', 'Passed', 'Failed', 'Blocked', 'Pending', 'N/A'}
DEV = 'อันเชิญ Dev'


def _save(wb):
    for i in range(5):
        try:
            wb.save(XLSX)
            return
        except PermissionError:
            if i == 4:
                raise SystemExit('บันทึกไม่ได้: ไฟล์เปิดอยู่ใน Excel ปิดก่อนแล้วรันใหม่')
            time.sleep(2)


def _find(wb, case):
    for ws in wb:
        if re.match(r'\d+-', ws.title):
            for r in range(2, ws.max_row + 1):
                if ws.cell(r, 1).value == case:
                    return ws, r
    raise KeyError(case)


def rec(case, status, note, bug=None):
    assert status in STATUSES, status
    wb = openpyxl.load_workbook(XLSX)
    ws, r = _find(wb, case)
    ws.cell(r, 12).value = status
    old = ws.cell(r, 13).value or ''
    tags = ' '.join(re.findall(r'\[(?:แก้|เพิ่ม|ย้าย)[^\]]*\][^\[\n]*', old)).strip()
    ws.cell(r, 13).value = note + ('\n' + tags if tags else '')
    ws.cell(r, 14).value = bug
    _save(wb)


def add_bug(case, part, dev, short, steps, expected, actual, severity, evidence):
    """คืนเลขบั๊ก ถ้าเคสนี้มีบั๊กเรื่องเดียวกันแล้วคืนเลขเดิม"""
    wb = openpyxl.load_workbook(XLSX)
    ws = wb[DEV]
    for r in range(2, 52):
        if ws.cell(r, 2).value == case and ws.cell(r, 5).value == short:
            return ws.cell(r, 1).value
        if not ws.cell(r, 2).value:
            for c, v in zip(range(2, 12), (case, part, dev, short, steps, expected, actual, severity, 'To Do', evidence)):
                ws.cell(r, c).value = v
            ws.cell(r, 12).value = 'ยังไม่แก้'
            ws.cell(r, 15).value = 'ยังไม่เทสซ้ำ'
            _save(wb)
            return ws.cell(r, 1).value
    raise SystemExit('ชีต Dev เต็ม 50 แถว')
