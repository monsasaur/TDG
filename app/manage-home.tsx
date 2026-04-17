import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import SettingItem from "../components/SettingItem";

export default function ManageHomeScreen() {
  const router = useRouter();

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
            จัดการบ้าน
          </Text>
        </View>
      </View>

      <View className="mt-4">
        <SettingItem
          icon="add-circle-outline"
          label="อุปกรณ์"
          onPress={() => router.push("/devices" as never)}
        />
        <SettingItem
          icon="person-add-outline"
          label="สมาชิก"
          onPress={() => {}}
        />
        <SettingItem
          icon="home-outline"
          label="บ้าน"
          onPress={() => {}}
        />
      </View>
    </View>
  );
}
