import "../global.css";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { AlertsProvider } from "../contexts/AlertsContext";
import { DevicesProvider } from "../contexts/DevicesContext";

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === "web") return;

    let sub: { remove: () => void } | undefined;

    const setupNotifications = async () => {
      const Notifications = await import("expo-notifications");
      const { registerForPushNotifications } = await import("../lib/pushNotifications");

      // foreground behavior — ให้ banner เด้งแม้แอปเปิดอยู่
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      registerForPushNotifications().catch(() => {});

      // ผู้ใช้ tap noti → ไปหน้า home (alert list)
      sub = Notifications.addNotificationResponseReceivedListener(() => {
        router.push("/home" as any);
      });
    };

    setupNotifications().catch(() => {});
    return () => sub?.remove();
  }, [router]);

  return (
    <DevicesProvider>
      <AlertsProvider>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </AlertsProvider>
    </DevicesProvider>
  );
}
