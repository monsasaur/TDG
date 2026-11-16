# syntax=docker/dockerfile:1
# ใช้ 3.12 ให้ตรงกับ venv ที่ pickle โมเดลไว้ — ลดความเสี่ยงเรื่อง unpickle ข้ามเวอร์ชัน
FROM python:3.12-slim AS runtime

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

# tini เป็น PID 1 ให้ SIGTERM ถึง uvicorn จริง (ดูเหตุผลใน express_api/Dockerfile)
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl \
 && rm -rf /var/lib/apt/lists/*

# ติดตั้ง dependency ก่อนคัดลอกโค้ด — layer นี้ cache ไว้ได้จนกว่า requirements จะเปลี่ยน
COPY requirements-serve.txt ./
RUN pip install --no-cache-dir -r requirements-serve.txt

COPY app ./app
COPY models ./models
COPY scripts/fetch_models.sh ./scripts/fetch_models.sh

# โมเดลถูก gitignore ไว้ (models/*.pkl) — build จาก git (Render) จะไม่มีไฟล์
# → ดาวน์โหลดจาก GitHub Release ตาม models/MANIFEST และตรวจ sha256 (ไฟล์ที่มีอยู่แล้วในเครื่องใช้ตามเดิม)
RUN sh scripts/fetch_models.sh

# เช็คอีกชั้นตอน build จะได้ fail พร้อมข้อความที่อ่านรู้เรื่อง แทนที่จะไป crash ตอน boot
# rf_v1 (+ scaler) และ rf_v2_event มีครบทั้งคู่ → สลับด้วย FALL_MODEL ได้โดยไม่ต้อง build ใหม่
RUN test -f models/rf_v1.pkl && test -f models/scaler_rf_v1.pkl && test -f models/rf_v2_event.pkl || ( \
      echo "" && \
      echo "❌ ไม่พบไฟล์โมเดลใน models/" && \
      echo "   ต้องมี: rf_v1.pkl · scaler_rf_v1.pkl · rf_v2_event.pkl" && \
      echo "   ดู models/MANIFEST และ scripts/fetch_models.sh" && \
      echo "" && exit 1 )

RUN useradd --create-home --uid 10001 app && chown -R app:app /app
USER app

ENV PORT=8000
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
# sh -c เพื่อให้ $PORT ถูกขยายตอน runtime (Render กำหนดค่ามาเอง)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
