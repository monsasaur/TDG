import type { useRouter } from "expo-router";

type AppRouter = ReturnType<typeof useRouter>;

/**
 * ย้อนกลับแบบปลอดภัย — ไม่มีหน้าก่อนหน้า (รีเฟรชบนเว็บ · เปิดลิงก์ตรง · มาจากแท็บล่างที่ใช้ replace)
 * จะไปหน้า fallback แทน แทนที่จะกดแล้วไม่เกิดอะไร (คำเตือน "GO_BACK was not handled by any navigator")
 */
export function safeBack(router: AppRouter, fallback: string = "/home") {
  if (router.canGoBack()) router.back();
  else router.replace(fallback as never);
}
