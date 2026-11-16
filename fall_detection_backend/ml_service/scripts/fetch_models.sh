#!/bin/sh
# ดาวน์โหลดไฟล์โมเดลที่ยังไม่มีใน models/ ตาม models/MANIFEST แล้วตรวจ sha256
#
# ใช้ตอน docker build — Render build จาก git ซึ่งไม่มี models/*.pkl (gitignore)
# ไฟล์ที่มีอยู่แล้วจะไม่ถูกแตะ (build ในเครื่องใช้ไฟล์ของเครื่อง) · ไฟล์ที่โหลดมาต้อง sha256 ตรง ไม่งั้น build ล้ม
#   sh scripts/fetch_models.sh            # จากโฟลเดอร์ ml_service
set -eu
cd "$(dirname "$0")/.."

if command -v sha256sum >/dev/null 2>&1; then sha() { sha256sum "$1" | cut -d' ' -f1; }
else sha() { shasum -a 256 "$1" | cut -d' ' -f1; }; fi

grep -v '^[[:space:]]*\(#\|$\)' models/MANIFEST | while read -r want name url; do
  f="models/$name"
  if [ -f "$f" ]; then
    echo "✓ $name มีอยู่แล้ว — ใช้ไฟล์เดิม"
    continue
  fi
  echo "↓ $name"
  curl -fsSL --retry 3 -o "$f.part" "$url"
  got=$(sha "$f.part")
  if [ "$got" != "$want" ]; then
    rm -f "$f.part"
    echo "❌ sha256 ของ $name ไม่ตรง (ได้ $got ต้องเป็น $want) — ไฟล์บน release ถูกเปลี่ยนหรือ MANIFEST ไม่ตรง" >&2
    exit 1
  fi
  mv "$f.part" "$f"
done
