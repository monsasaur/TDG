import { useCallback, useEffect, useState } from "react";
import { View, Text, Switch, Linking, Platform, AppState } from "react-native";
import { useRouter, Stack } from "expo-router";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import {
  getNotificationPermissions,
  requestNotificationPermissions,
} from "../lib/notifications";

type Permission = "undetermined" | "granted" | "denied";

export default function NotificationsScreen() {
  const router = useRouter();

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

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="การแจ้งเตือน" onBack={() => router.back()} />

      <View className="bg-white mx-5 mt-5 rounded-2xl px-4 py-3 flex-row items-center justify-between">
        <Text className="text-sm text-[#1A1A1A]">การแจ้งเตือนทั้งหมด</Text>
        <Switch
          value={permission === "granted"}
          onValueChange={handleToggle}
          trackColor={{ false: "#E8E8E8", true: "#FF3055" }}
          thumbColor="#FFFFFF"
        />
      </View>

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
        <Text className="text-sm text-[#1A1A1A] leading-5">
          หากต้องการใช้คุณสมบัตินี้ คุณต้องให้การอนุญาติต่อไปในการตั้งค่า
        </Text>
        <View className="mt-3">
          <Text className="text-sm text-[#1A1A1A]">• การแจ้งเตือน</Text>
          <Text className="text-xs text-[#888] ml-3 mt-0.5">
            ใช้เพื่อรับการแจ้งเตือนของแอปพลิเคชัน
          </Text>
        </View>
        <Text className="text-sm text-[#1A1A1A] mt-4 leading-5">
          หากต้องการใช้คุณสมบัติต่อ ให้เปิดการตั้งค่า
          จากนั้นเลือกให้สิทธิ์ในการใช้งาน
        </Text>
      </ConfirmModal>
    </View>
  );
}
