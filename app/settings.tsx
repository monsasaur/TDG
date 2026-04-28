import { View, Text, Pressable } from "react-native";
import { useRouter, Stack } from "expo-router";
import SettingItem from "../components/SettingItem";
import PageHeader from "../components/PageHeader";

export default function SettingsScreen() {
  const router = useRouter();

  const handleClearAll = () => {
    router.push("/clear-alerts" as any);
  };

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="ตั้งค่า" onBack={() => router.back()} centered />

      {/* Clear all pill */}
      <Pressable
        onPress={handleClearAll}
        className="rounded-full bg-white mx-5 mt-5 py-3"
        style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
      >
        <Text className="text-sm font-semibold text-[#1A1A1A] text-center">
          ลบการแจ้งเตือนทั้งหมด
        </Text>
      </Pressable>

      {/* Menu */}
      <View className="mt-4">
        <SettingItem
          icon="call-outline"
          label="เบอร์โทรฉุกเฉิน"
          onPress={() => router.push("/emergency-contacts" as any)}
        />
        <SettingItem
          icon="notifications-outline"
          label="การแจ้งเตือน"
          onPress={() => router.push("/notifications" as any)}
        />
        <SettingItem
          icon="add-circle-outline"
          label="จัดการบ้าน"
          onPress={() => router.push("/manage-home" as any)}
        />
      </View>
    </View>
  );
}
