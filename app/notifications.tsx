import { useCallback, useEffect, useState } from "react";
import { View, Text, Switch, Linking, Platform, AppState, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import PageHeader from "../components/PageHeader";
import BottomTabBar from "../components/BottomTabBar";
import EmptyState from "../components/EmptyState";
import SystemAlertCard from "../components/SystemAlertCard";
import TabHeader from "../components/TabHeader";
import { V2, V2C } from "../components/designVersion";
import { useAlerts } from "../contexts/AlertsContext";
import ConfirmModal from "../components/ConfirmModal";
import {
  getNotificationPermissions,
  requestNotificationPermissions,
} from "../lib/notifications";
import { C } from "../components/theme";

type Permission = "undetermined" | "granted" | "denied";

export default function NotificationsScreen() {
  const router = useRouter();
  const { systemAlerts } = useAlerts();

  const [permission, setPermission] = useState<Permission>("undetermined");
  const [settingsPrompt, setSettingsPrompt] = useState(false);
  const [offPrompt, setOffPrompt] = useState(false);

  // สวิตช์ = สิทธิ์แจ้งเตือนของเครื่องจริง ไม่ใช่ค่าในแอป
  // (เดิมกดปิดแล้วเปลี่ยนแค่บนจอ push ยังเด้ง และเปิดหน้าใหม่ก็กลับมาเปิด)
  const refresh = useCallback(() => {
    if (Platform.OS === "web") return;
    getNotificationPermissions().then(({ status }) => {
      setPermission(status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined");
    });
  }, []);

  // กลับมาจากหน้าตั้งค่าของเครื่อง → อ่านสิทธิ์ใหม่
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  const handleToggle = async () => {
    if (Platform.OS === "web") {
      setSettingsPrompt(true);
      return;
    }

    if (permission === "granted") {
      // แอปปิดสิทธิ์ของเครื่องเองไม่ได้ — บอกผลให้ชัด แล้วพาไปปิดที่ตั้งค่าของเครื่อง
      setOffPrompt(true);
      return;
    }
    if (permission === "undetermined") {
      const { status, canAskAgain } = await requestNotificationPermissions();
      if (status === "granted") {
        setPermission("granted");
      } else {
        setPermission("denied");
        if (!canAskAgain) setSettingsPrompt(true);
      }
      return;
    }
    setSettingsPrompt(true);
  };

  const handleOpenSettings = () => {
    setSettingsPrompt(false);
    setOffPrompt(false);
    if (Platform.OS !== "web") Linking.openSettings();
  };

  const modals = (
    <>
      <ConfirmModal
        visible={offPrompt}
        onClose={() => setOffPrompt(false)}
        onConfirm={handleOpenSettings}
        confirmLabel="ไปที่การตั้งค่า"
        title="ปิดการแจ้งเตือน"
        titleAlign="left"
        messageAlign="left"
        message={
          "ปิดได้ที่การตั้งค่าของเครื่อง\n\n" +
          "ถ้าปิด เครื่องนี้จะไม่เด้งเตือนเมื่อตรวจพบการล้ม — ระบบยังโทรหาเบอร์ติดต่อฉุกเฉินเมื่อไม่มีใครกดรับทราบในเวลาที่กำหนด"
        }
      />

      <ConfirmModal
        visible={settingsPrompt}
        onClose={() => setSettingsPrompt(false)}
        onConfirm={handleOpenSettings}
        confirmLabel="ไปที่การตั้งค่า"
        titleAlign="left"
        messageAlign="left"
      >
        <Text className="text-sm text-ink leading-5">
          หากต้องการใช้คุณสมบัตินี้ คุณต้องให้การอนุญาติต่อไปในการตั้งค่า
        </Text>
        <View className="mt-3">
          <Text className="text-sm text-ink">• การแจ้งเตือน</Text>
          <Text className="text-xs text-sub ml-3 mt-0.5">
            ใช้เพื่อรับการแจ้งเตือนของแอปพลิเคชัน
          </Text>
        </View>
        <Text className="text-sm text-ink mt-4 leading-5">
          หากต้องการใช้คุณสมบัติต่อ ให้เปิดการตั้งค่า
          จากนั้นเลือกให้สิทธิ์ในการใช้งาน
        </Text>
      </ConfirmModal>
    </>
  );

  // ดีไซน์ v2 — แท็บล่าง "แจ้งเตือนระบบ": สถานะอุปกรณ์ · สวิตช์แจ้งเตือนของเครื่องย้ายไปหน้าตั้งค่า (PushPermissionCard)
  if (V2) {
    return (
      <View className={`flex-1 ${V2C.page}`}>
        <Stack.Screen options={{ animation: "none" }} />
        <TabHeader title="แจ้งเตือนระบบ" />
        <ScrollView className="flex-1" contentContainerStyle={{ paddingVertical: 20 }}>
          <Text className="text-sm text-[#858891] mb-1 mx-6">สถานะอุปกรณ์</Text>
          {systemAlerts.length === 0 ? (
            <EmptyState compact icon="hardware-chip-outline" title="อุปกรณ์ทำงานปกติ" description="ถ้าอุปกรณ์ขาดการเชื่อมต่อ จะแจ้งที่นี่" />
          ) : (
            systemAlerts.map((a) => <SystemAlertCard key={a.id} alert={a} />)
          )}
        </ScrollView>
        <BottomTabBar active="notifications" badge={{ notifications: systemAlerts.length }} />
        {modals}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="การแจ้งเตือน" onBack={() => router.back()} />

      <View className="bg-white mx-5 mt-5 rounded-2xl px-4 py-3 flex-row items-center justify-between">
        <Text className="text-sm text-ink">การแจ้งเตือนทั้งหมด</Text>
        <Switch
          value={permission === "granted"}
          onValueChange={handleToggle}
          trackColor={{ false: "#E8E8E8", true: C.brand }}
          thumbColor="#FFFFFF"
        />
      </View>

      {modals}
    </View>
  );
}
