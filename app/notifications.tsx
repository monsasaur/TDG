import { useEffect, useState } from "react";
import { View, Text, Switch, Linking, Platform } from "react-native";
import { useRouter, Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";

type Permission = "undetermined" | "granted" | "denied";

export default function NotificationsScreen() {
  const router = useRouter();

  const [permission, setPermission] = useState<Permission>("undetermined");
  const [enabled, setEnabled] = useState(false);
  const [settingsPrompt, setSettingsPrompt] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      if (status === "granted") {
        setPermission("granted");
        setEnabled(true);
      } else if (status === "denied") {
        setPermission("denied");
      }
    });
  }, []);

  const handleToggle = async () => {
    if (permission === "granted") {
      setEnabled((v) => !v);
      return;
    }
    if (permission === "undetermined") {
      const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
      if (status === "granted") {
        setPermission("granted");
        setEnabled(true);
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
    if (Platform.OS !== "web") Linking.openSettings();
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="การแจ้งเตือน" onBack={() => router.back()} />

      <View className="bg-white mx-5 mt-5 rounded-2xl px-4 py-3 flex-row items-center justify-between">
        <Text className="text-sm text-[#1A1A1A]">การแจ้งเตือนทั้งหมด</Text>
        <Switch
          value={permission === "granted" && enabled}
          onValueChange={handleToggle}
          trackColor={{ false: "#E8E8E8", true: "#FF3055" }}
          thumbColor="#FFFFFF"
        />
      </View>

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
