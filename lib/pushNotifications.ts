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
import { registerPushToken } from "./api";

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
}): Promise<string | null> {
  // Push notification ทำงานบนเครื่องจริง / Android emulator (Google Play) เท่านั้น
  // iOS Simulator: getExpoPushTokenAsync จะ throw — return null เงียบๆ
  if (!Device.isDevice && Platform.OS === "ios") {
    console.log("[push] iOS simulator — skip token registration");
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
