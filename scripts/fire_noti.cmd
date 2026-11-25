@echo off
rem ยิงแจ้งเตือนเข้าแอปด้วยมือ (ล้ม / อุปกรณ์หลุด) — ดับเบิลคลิกไฟล์นี้ได้เลย
rem แบบ "ล้ม" ต้องเปิด Express ไว้ก่อน: cd fall_detection_backend\express_api && npm start
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0.."
python scripts\fire_noti.py %*
echo.
pause
