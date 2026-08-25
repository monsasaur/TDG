#!/bin/bash
# fake_csi_stream.sh
# ส่ง fake CSI packet ไป UDP port 5500 ให้ดูเหมือน ESP32 กำลังสตรีม
# ใช้สำหรับ demo เมื่อ ESP32 จริงไม่ได้รัน
#
# Usage:
#   ./fake_csi_stream.sh [target_ip] [target_port]
#   default: 127.0.0.1 5500

TARGET="${1:-127.0.0.1}"
PORT="${2:-5500}"
RATE_HZ=100
SLEEP_SEC=$(echo "scale=4; 1/$RATE_HZ" | bc)

echo "📡 Fake CSI streaming → $TARGET:$PORT @ ${RATE_HZ}Hz"
echo "   (Ctrl+C to stop)"
echo

PKT=0
while true; do
  # สร้าง CSI line: timestamp,rssi,52 subcarriers (random)
  TS=$(date +%s%N | cut -c1-13)
  RSSI=$((-50 - RANDOM % 30))

  CSI=""
  for i in {1..52}; do
    CSI="${CSI}$((180 + RANDOM % 50)),"
  done

  LINE="CSI_DATA,${PKT},${TS},${RSSI},${CSI%,}"

  echo "$LINE" | nc -u -w0 "$TARGET" "$PORT"
  echo "$LINE"

  PKT=$((PKT + 1))
  sleep "$SLEEP_SEC"
done
