#!/bin/sh
# ปลุก Express + ML service บน Render แผนฟรีก่อน demo
# (แผนฟรีหลับหลังไม่มีคนเรียก 15 นาที · ตื่นราว 1 นาที — ถ้าไม่ปลุก การล้มครั้งแรกต้องรอนาน)
#
#   sh scripts/warm_render.sh https://<tdg-express-api>.onrender.com https://<tdg-ml-service>.onrender.com
#
# เรียกแค่ GET /health ของทั้งสองตัวพร้อมกัน รอจนตอบ (สูงสุด 4 นาที) · ไม่สร้างเหตุการณ์ ไม่ส่งแจ้งเตือน
# ML ต้องตอบ model_version rf_v2_event-r2-fall · n_features 39
set -u
EXPRESS=${1:?"ใส่ URL ของ tdg-express-api เป็นค่าแรก"}
ML=${2:?"ใส่ URL ของ tdg-ml-service เป็นค่าที่สอง"}

wait_up() {
  name=$1
  url="${2%/}/health"
  t0=$(date +%s)
  while :; do
    if body=$(curl -fsS --max-time 30 "$url" 2>/dev/null); then
      echo "✅ $name ตื่นแล้ว ($(( $(date +%s) - t0 )) วิ) · $body"
      return 0
    fi
    if [ $(( $(date +%s) - t0 )) -ge 240 ]; then
      echo "❌ $name ไม่ตอบใน 4 นาที ($url) — ดู log ใน Render dashboard"
      return 1
    fi
    sleep 5
  done
}

echo "ปลุก $ML กับ $EXPRESS ..."
wait_up "ML service" "$ML" & p1=$!
wait_up "Express" "$EXPRESS" & p2=$!
wait $p1; r1=$?
wait $p2; r2=$?
if [ $r1 -eq 0 ] && [ $r2 -eq 0 ]; then
  echo "พร้อม demo · จะหลับอีกครั้งถ้าไม่มีคนเรียก 15 นาที"
else
  exit 1
fi
