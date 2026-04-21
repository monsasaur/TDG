#!/bin/bash
# ทดสอบ API — ใช้: ./test.sh [health|predict|ack EVENT_ID|cooldown]

API="http://localhost:3000"
KEY="dev-secret-key-123"

case "$1" in
  health)
    curl -s "$API/health" | jq .
    ;;

  predict)
    curl -s -X POST "$API/api/v1/predict" \
      -H "x-api-key: $KEY" \
      -H "Content-Type: application/json" \
      -d '{"device_id":"TEST01","location":"ห้องนอน","features":[[0]]}' | jq .
    ;;

  ack)
    if [ -z "$2" ]; then
      echo "Usage: ./test.sh ack <event_id>"
      exit 1
    fi
    curl -s -X POST "$API/api/v1/alert/ack/$2" \
      -H "x-api-key: $KEY" \
      -H "Content-Type: application/json" \
      -d '{"acknowledged_by":"caregiver_001"}' | jq .
    ;;

  cooldown)
    echo "→ predict ครั้งที่ 1"
    curl -s -X POST "$API/api/v1/predict" \
      -H "x-api-key: $KEY" \
      -H "Content-Type: application/json" \
      -d '{"device_id":"COOL01","features":[[0]]}' | jq .
    echo ""
    echo "→ predict ครั้งที่ 2 (ควรเป็น cooldown)"
    curl -s -X POST "$API/api/v1/predict" \
      -H "x-api-key: $KEY" \
      -H "Content-Type: application/json" \
      -d '{"device_id":"COOL01","features":[[0]]}' | jq .
    ;;

  test-alert)
    curl -s -X POST "$API/api/v1/alert/test" \
      -H "x-api-key: $KEY" | jq .
    ;;

  *)
    echo "Usage:"
    echo "  ./test.sh health              # เช็คว่า server รัน"
    echo "  ./test.sh predict             # ยิง fall alert (ได้ event_id)"
    echo "  ./test.sh ack EVENT_ID        # กด ack ยกเลิก escalation"
    echo "  ./test.sh cooldown            # ทดสอบ cooldown"
    echo "  ./test.sh test-alert          # ทดสอบ Twilio ตรง ๆ"
    ;;
esac
