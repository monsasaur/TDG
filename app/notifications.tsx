import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  Linking,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";

type Permission = "undetermined" | "granted" | "denied";

export default function NotificationsScreen() {
  const router = useRouter();

  const [permission, setPermission] = useState<Permission>("undetermined");
  const [enabled, setEnabled] = useState(false);
  const [osPrompt, setOsPrompt] = useState(false);
  const [settingsPrompt, setSettingsPrompt] = useState(false);

  const handleToggle = () => {
    if (permission === "granted") {
      setEnabled((v) => !v);
      return;
    }
    if (permission === "undetermined") {
      setOsPrompt(true);
      return;
    }
    setSettingsPrompt(true);
  };

  const handleAllow = () => {
    setOsPrompt(false);
    setPermission("granted");
    setEnabled(true);
  };

  const handleDontAllow = () => {
    setOsPrompt(false);
    setPermission("denied");
  };

  const handleOpenSettings = () => {
    setSettingsPrompt(false);
    if (Platform.OS !== "web") Linking.openSettings();
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="การแจ้งเตือน" onBack={() => router.back()} />

      {/* Toggle row */}
      <View className="bg-white mx-5 mt-5 rounded-2xl px-4 py-3 flex-row items-center justify-between">
        <Text className="text-sm text-[#1A1A1A]">การแจ้งเตือนทั้งหมด</Text>
        <Switch
          value={permission === "granted" && enabled}
          onValueChange={handleToggle}
          trackColor={{ false: "#E8E8E8", true: "#FF3055" }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* OS-style permission prompt — styled differently (dark sheet) */}
      <Modal transparent animationType="fade" visible={osPrompt}>
        <View className="flex-1 bg-black/40 items-center justify-center px-8">
          <View className="bg-[#2C2C2E] rounded-2xl w-full max-w-[280px] overflow-hidden">
            <View className="items-center pt-5 pb-3 px-4">
              <View className="w-10 h-10 rounded-full bg-[#3A3A3C] items-center justify-center mb-2">
                <Ionicons name="notifications" size={20} color="#FFFFFF" />
              </View>
              <Text className="text-sm text-white text-center">
                Allow <Text className="font-semibold">Middle</Text> to send you
                notifications?
              </Text>
            </View>
            <View className="h-[1px] bg-[#3A3A3C]" />
            <TouchableOpacity onPress={handleAllow} className="py-3 items-center">
              <Text className="text-sm text-[#4C8BF5]">Allow</Text>
            </TouchableOpacity>
            <View className="h-[1px] bg-[#3A3A3C]" />
            <TouchableOpacity
              onPress={handleDontAllow}
              className="py-3 items-center"
            >
              <Text className="text-sm text-[#4C8BF5]">Don't Allow</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
