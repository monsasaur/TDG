import "../global.css";
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";
import { AlertsProvider } from "../contexts/AlertsContext";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { DevicesProvider } from "../contexts/DevicesContext";
import { HouseFilterProvider } from "../contexts/HouseFilterContext";
import { ReadStateProvider } from "../contexts/ReadStateContext";
import { NetworkProvider } from "../contexts/NetworkContext";
import OfflineGate from "../components/OfflineGate";
import { ensureDefaultHouse } from "../data/defaultHouse";
import { notifyHousesChanged, useHouses } from "../data/useHouses";

/**
 * Push notification — ตั้งค่าครั้งเดียวตอนเปิดแอป และลงทะเบียน token กับ backend ใหม่ทุกครั้งที่บัญชีเปลี่ยน
 * login → ผูกเครื่องนี้กับบัญชี · ออกจากระบบ → ปลดการผูก
 * (หลังรัน accounts.sql backend ส่ง push ของบ้านให้เฉพาะเครื่องของสมาชิกบ้านนั้น)
 */
function PushSetup() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (Platform.OS === "web") return;

    let sub: { remove: () => void } | undefined;

    const setupNotifications = async () => {
      const Notifications = await import("expo-notifications");

      // foreground behavior — ให้ banner เด้งแม้แอปเปิดอยู่
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // ผู้ใช้ tap noti → ไปหน้า home (alert list)
      sub = Notifications.addNotificationResponseReceivedListener(() => {
        router.push("/home" as any);
      });
    };

    setupNotifications().catch(() => {});
    return () => sub?.remove();
  }, [router]);

  // รออ่าน session ที่เก็บไว้ให้เสร็จก่อน — ไม่งั้นจะลงทะเบียนแบบไม่ผูกบัญชีแล้วค่อยผูกซ้ำ
  useEffect(() => {
    if (Platform.OS === "web" || loading) return;
    import("../lib/pushNotifications")
      .then(({ registerForPushNotifications }) => registerForPushNotifications())
      .catch(() => {});
  }, [userId, loading]);

  return null;
}

/**
 * บ้านพื้นฐาน — บัญชีที่ไม่มีบ้านสักหลัง (เพิ่งสมัคร หรือถูกนำออกจากบ้านสุดท้าย)
 * ระบบสร้างบ้านชื่อ "บ้าน" ให้เอง ผู้ใช้ไม่ต้องกดสร้างก่อนถึงจะใช้แอปได้
 */
function DefaultHouseSetup() {
  const { user, loading } = useAuth();
  const { houses, isLoading, refetch } = useHouses();

  useEffect(() => {
    if (loading || isLoading || !user || houses.length > 0) return;
    ensureDefaultHouse(user.id).then((created) => {
      if (!created) return;
      refetch();
      notifyHousesChanged();
    });
  }, [loading, isLoading, user, houses.length, refetch]);

  return null;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <PushSetup />
      <DefaultHouseSetup />
      <DevicesProvider>
        <AlertsProvider>
          <HouseFilterProvider>
            <ReadStateProvider>
              <NetworkProvider>
                <OfflineGate>
                  <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
                </OfflineGate>
              </NetworkProvider>
            </ReadStateProvider>
          </HouseFilterProvider>
        </AlertsProvider>
      </DevicesProvider>
    </AuthProvider>
  );
}
