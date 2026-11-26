/**
 * pushNotifications.ts
 * ขอ permission + ลงทะเบียน Expo Push Token กับ backend
 *
 * ใช้กับ EAS dev build เท่านั้น (Expo Go ตั้งแต่ SDK 53 ไม่รองรับ remote push)
 */

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { registerPushToken, unregisterPushToken } from "./api";
import { readItem, writeItem } from "./deviceStorage";

/**
 * ผู้ใช้เปิด/ปิดการแจ้งเตือนของเครื่องนี้เอง (คนละเรื่องกับสิทธิ์ของระบบปฏิบัติการ)
 *
 * แอปปิดสิทธิ์ของเครื่องแทนผู้ใช้ไม่ได้ แต่ "ไม่รับ push" ทำได้ด้วยการถอน token ออกจากฐาน
 * เดิมกดปิดแล้วเด้งให้ไปปิดที่ตั้งค่าของเครื่อง ซึ่งเกินจำเป็นเมื่ออนุญาตไว้แล้ว
 */
const PREF_KEY = "middle.pushEnabled";

export async function isPushEnabled(): Promise<boolean> {
  return (await readItem(PREF_KEY)) !== "off"; // ไม่เคยตั้ง = เปิด
}

export async function setPushEnabled(on: boolean): Promise<void> {
  await writeItem(PREF_KEY, on ? "on" : "off");
}

/** ถอนเครื่องนี้ออกจากรายชื่อผู้รับ push (ยังเก็บสิทธิ์ของเครื่องไว้เหมือนเดิม) */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? (Constants as any)?.easConfig?.projectId;
    if (!projectId || projectId === "REPLACE_AFTER_EAS_INIT") return;
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    await unregisterPushToken(tokenData.data);
  } catch (err: any) {
    // ไม่มี token อยู่แล้ว (Expo Go / ยังไม่เคยลงทะเบียน) ก็ถือว่าปิดสำเร็จ
    console.warn("[push] unregister skipped:", err?.message || err);
  }
}

export async function setupAndroidChannel() {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("fall_alert", {
    name: "การแจ้งเตือนการล้ม",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF3055",
    sound: "default",
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * เรียกตอนแอป mount — ขอ permission, ดึง Expo push token, ส่งให้ backend
 * คืน token (หรือ null ถ้า fail / simulator iOS / ผู้ใช้ปฏิเสธ)
 */
export async function registerForPushNotifications(opts?: {
  device_id?: string;
  /** true = ลงทะเบียนแม้ผู้ใช้เคยปิดไว้ (ใช้ตอนกดเปิดสวิตช์เอง) */
  force?: boolean;
}): Promise<string | null> {
  // Push notification ทำงานบนเครื่องจริง / Android emulator (Google Play) เท่านั้น
  // iOS Simulator: getExpoPushTokenAsync จะ throw — return null เงียบๆ
  if (!Device.isDevice && Platform.OS === "ios") {
    console.log("[push] iOS simulator — skip token registration");
    return null;
  }

  // ผู้ใช้ปิดแจ้งเตือนของเครื่องนี้ไว้ — อย่าแอบลงทะเบียนกลับให้ตอนเปิดแอป
  if (!opts?.force && !(await isPushEnabled())) {
    console.log("[push] ปิดไว้ในแอป — ข้ามการลงทะเบียน");
    return null;
  }

  await setupAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") {
    console.log("[push] permission denied");
    return null;
  }

  // ต้องมี EAS projectId (อยู่ใน app.json → extra.eas.projectId)
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  if (!projectId || projectId === "REPLACE_AFTER_EAS_INIT") {
    console.warn(
      "[push] EAS projectId not set — run `eas init` then update app.json"
    );
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log("[push] got Expo token:", token.slice(0, 32) + "...");

    await registerPushToken({
      token,
      device_id: opts?.device_id ?? null,
      platform: Platform.OS,
    }).catch((err) => {
      console.warn("[push] backend register failed:", err.message);
    });

    return token;
  } catch (err: any) {
    console.warn("[push] getExpoPushTokenAsync failed:", err?.message || err);
    return null;
  }
}
