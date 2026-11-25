import palette from "./palette.json";
import { V2 } from "./designVersion";

/**
 * สีกลางของทั้งแอป — สลับตาม DESIGN ใน designVersion.ts
 * ใช้ในโค้ดที่ต้องการสีเป็นค่า JS (เช่น color ของ Ionicons, ActivityIndicator, Switch)
 * ส่วน className ใช้ชื่อเดียวกันผ่าน tailwind.config.js: text-brand · bg-brand-soft · border-danger · text-ink · bg-page ...
 *
 * brand = สีเน้น (v1 ชมพู · v2 Charcoal) · danger = ผิดพลาด/ลบ/เหตุฉุกเฉิน (แดงทั้งสองแบบ)
 */
const p = V2 ? palette.v2 : palette.v1;

export const C = {
  brand: p.brand,
  brandSoft: p["brand-soft"],
  brandLine: p["brand-line"],
  brandStrong: p["brand-strong"],
  brandTint: p["brand-tint"],
  danger: p.danger,
  ink: p.ink,
  sub: p.sub,
  page: p.page,
  line: p.line,
} as const;
