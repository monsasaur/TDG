import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SystemAlert } from "../types/alert";

interface SystemAlertCardProps {
  alert: SystemAlert;
}

export default function SystemAlertCard({ alert }: SystemAlertCardProps) {
  return (
    <Pressable
      className="rounded-xl border border-[#E8E8E8] mx-5 mt-3 p-4"
      style={({ pressed }) => ({
        backgroundColor: pressed ? "#E8E8E8" : "#FFFFFF",
      })}
    >
      {/* Header */}
      <View className="flex-row items-center">
        <View className="w-9 h-9 rounded-lg bg-[#EFEFEF] items-center justify-center mr-3">
          <Ionicons name="warning" size={18} color="#1A1A1A" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-[#1A1A1A]">
            {alert.title}
          </Text>
          <Text className="text-xs text-[#888] mt-0.5">
            ชื่ออุปกรณ์ : {alert.deviceName}
          </Text>
        </View>
      </View>

      {/* Divider */}
      <View className="h-px bg-[#E8E8E8] my-3" />

      {/* House info */}
      <Text className="text-xs text-[#555]">
        อุปกรณ์เชื่อมต่อของ {alert.houseName}
      </Text>
    </Pressable>
  );
}
