import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

/**
 * Expo Go ตั้งแต่ SDK 53 ตัด **push จากเซิร์ฟเวอร์** (remote notification) บน Android ออก
 * แต่สิทธิ์แจ้งเตือนของเครื่องและการแจ้งเตือนในเครื่อง (local) ยังใช้ได้ปกติ
 *
 * เดิมไฟล์นี้ตอบ "denied" ทิ้งไปเลยเมื่ออยู่ใน Expo Go ทำให้สวิตช์ในหน้าตั้งค่าปิดค้าง
 * ทั้งที่ผู้ใช้กดอนุญาตบนเครื่องแล้ว — ตอนนี้อ่านสถานะจริงเสมอ แล้วให้หน้าจอบอกข้อจำกัดแทน
 */
export const REMOTE_PUSH_UNSUPPORTED = Constants.executionEnvironment === "storeClient";

type PermStatus = { status: "granted" | "denied" | "undetermined"; canAskAgain: boolean };

const denied: PermStatus = { status: "denied", canAskAgain: false };

export async function getNotificationPermissions(): Promise<PermStatus> {
  try {
    const r = await Notifications.getPermissionsAsync();
    return { status: r.status, canAskAgain: r.canAskAgain };
  } catch {
    // อ่านไม่ได้ (เว็บ / โมดูลไม่มี) — ถือว่ายังไม่ได้สิทธิ์ ดีกว่าบอกว่าเปิดอยู่ทั้งที่ไม่เด้ง
    return denied;
  }
}

export async function requestNotificationPermissions(): Promise<PermStatus> {
  try {
    const r = await Notifications.requestPermissionsAsync();
    return { status: r.status, canAskAgain: r.canAskAgain };
  } catch {
    return denied;
  }
}

export async function scheduleLocalNotification(
  content: Notifications.NotificationContentInput,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  } catch {
    // แจ้งเตือนในเครื่องไม่ขึ้นไม่ใช่เรื่องที่ต้องทำให้แอปพัง
  }
}
