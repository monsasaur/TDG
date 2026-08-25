import Constants from "expo-constants";
import * as Notifications from "expo-notifications";

const isExpoGo = Constants.executionEnvironment === "storeClient";

type PermStatus = { status: "granted" | "denied" | "undetermined"; canAskAgain: boolean };

const denied: PermStatus = { status: "denied", canAskAgain: false };

export async function getNotificationPermissions(): Promise<PermStatus> {
  if (isExpoGo) return denied;
  try {
    const r = await Notifications.getPermissionsAsync();
    return { status: r.status, canAskAgain: r.canAskAgain };
  } catch {
    return denied;
  }
}

export async function requestNotificationPermissions(): Promise<PermStatus> {
  if (isExpoGo) return denied;
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
  if (isExpoGo) return;
  try {
    await Notifications.scheduleNotificationAsync({ content, trigger: null });
  } catch {}
}
