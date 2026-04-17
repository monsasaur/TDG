import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Modal,
  TouchableWithoutFeedback,
  Linking,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

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

      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center h-7">
          <TouchableOpacity onPress={() => router.back()} hitSlop={20}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-[#1A1A1A] ml-2">
            การแจ้งเตือน
          </Text>
        </View>
      </View>

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

      {/* OS-style permission prompt */}
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

      {/* App modal — go to settings */}
      <Modal
        transparent
        animationType="fade"
        visible={settingsPrompt}
        onRequestClose={() => setSettingsPrompt(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSettingsPrompt(false)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-10">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-2xl px-5 py-5 w-full">
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
                <View className="flex-row justify-between mt-5">
                  <TouchableOpacity onPress={() => setSettingsPrompt(false)}>
                    <Text className="text-sm font-semibold text-[#FF3055]">
                      ยกเลิก
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleOpenSettings}>
                    <Text className="text-sm font-semibold text-[#FF3055]">
                      ไปที่การตั้งค่า
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
