#!/bin/bash
# Register a fake token and trigger test push
set -e

API="http://localhost:3000/api/v1"
KEY="dev-secret-key-123"

echo "1) Registering fake token..."
curl -s -X POST "$API/push/register" \
  -H "x-api-key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{"token":"ExponentPushToken[FAKE_DEMO_TOKEN]","device_id":"DEMO","platform":"android"}'
echo

echo "2) Triggering test push..."
curl -s -X POST "$API/push/test" -H "x-api-key: $KEY"
echo
