import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mockAvailableNetworks } from "../data/mockDevices";
import PageHeader from "../components/PageHeader";
import AddActionPill from "../components/AddActionPill";

const CURRENT_WIFI = "MeeNeeNetZa_5G";

export default function ConnectDeviceScreen() {
  const router = useRouter();

  const selectNetwork = (ssid: string) =>
    router.push(`/wifi-password?ssid=${encodeURIComponent(ssid)}` as never);

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เชื่อมต่ออุปกรณ์" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {/* Current network (display only) */}
        <View className="px-5 mt-5">
          <Text className="text-sm text-[#1A1A1A] mb-2">เครือข่ายปัจจุบัน</Text>
          <View className="bg-[#FFE5E8] rounded-xl px-4 py-3 flex-row items-center">
            <Ionicons name="wifi" size={18} color="#1A1A1A" />
            <View className="ml-3">
              <Text className="text-sm text-[#1A1A1A]">{CURRENT_WIFI}</Text>
              <Text className="text-xs text-[#FF3055] mt-0.5">เชื่อมต่อ</Text>
            </View>
          </View>
        </View>

        {/* Available networks */}
        <View className="px-5 mt-5">
          <Text className="text-sm text-[#1A1A1A] mb-2">
            เครือข่ายที่พร้อมใช้งาน
          </Text>
          <View className="bg-white rounded-xl overflow-hidden">
            {mockAvailableNetworks.map((ssid, i) => (
              <TouchableOpacity
                key={ssid}
                activeOpacity={0.7}
                onPress={() => selectNetwork(ssid)}
                className={`px-4 py-3 flex-row items-center ${
                  i > 0 ? "border-t border-[#F0F0F0]" : ""
                }`}
              >
                <Ionicons name="wifi" size={18} color="#1A1A1A" />
                <Text className="text-sm text-[#1A1A1A] ml-3">{ssid}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <AddActionPill
            label="เพิ่มเครือข่าย"
            onPress={() => selectNetwork("")}
            className="mt-3"
          />
        </View>
      </ScrollView>
    </View>
  );
}
