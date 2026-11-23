import { Redirect } from "expo-router";

/**
 * หน้าเข้าสู่ระบบย้ายไปรวมกับหน้า welcome แล้ว (เบอร์ + รหัสผ่านในหน้าเดียว)
 * เก็บ route นี้ไว้ให้ลิงก์เดิม /login ยังใช้ได้ — ส่งต่อไปหน้า welcome
 */
export default function LoginRedirect() {
  return <Redirect href={"/welcome" as any} />;
}
