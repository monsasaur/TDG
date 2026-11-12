/**
 * timestamptz จาก PostgREST มีเศษวินาทีถึง 6 หลัก (…:00.123456+00:00)
 * ตัดเหลือ 3 หลักก่อน parse — ไม่ต้องพึ่งว่า JS engine บนมือถือ (Hermes) รับรูปแบบยาวได้
 * @returns milliseconds · parse ไม่ได้คืน NaN
 */
export function parseTimestamp(value: string): number {
  return Date.parse(value.replace(/(\.\d{3})\d+/, "$1"));
}
