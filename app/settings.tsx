import { View, Text, Pressable, TouchableOpacity } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SettingItem from "../components/SettingItem";

export default function SettingsScreen() {
  const router = useRouter();

  const handleClearAll = () => {
    router.push("/clear-alerts" as any);
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center justify-center relative h-7">
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={20}
            className="absolute left-0 top-0 bottom-0 justify-center"
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-[#1A1A1A]">
            ตั้งค่า
          </Text>
        </View>
      </View>

      {/* Clear all pill */}
      <Pressable
        onPress={handleClearAll}
        className="rounded-full border border-[#E8E8E8] mx-5 mt-5 py-3"
        style={({ pressed }) => ({
          backgroundColor: pressed ? "#EDEDED" : "#FFFFFF",
        })}
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
