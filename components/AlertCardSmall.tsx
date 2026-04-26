import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "../types/alert";

interface AlertCardSmallProps {
  alert: Alert;
  onPress?: (id: string) => void;
}

export default function AlertCardSmall({ alert, onPress }: AlertCardSmallProps) {
  const summaryText =
    alert.status === "no_response"
      ? "ไม่มีการยืนยันการตรวจสอบและตอบรับ"
      : alert.answeredBy
      ? `ยืนยันการตรวจสอบโดย : ${alert.answeredBy}`
      : "";

  return (
    <TouchableOpacity
      className="rounded-xl bg-white mx-5 mt-3 p-4"
      onPress={() => onPress?.(alert.id)}
      activeOpacity={0.7}
    >
      {/* Header row */}
      <View className="flex-row items-start">
        <View className="w-7 h-7 rounded bg-[#FFF0F0] items-center justify-center mr-2 mt-0.5">
          <Ionicons name="warning" size={16} color="#FF3055" />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-[#1A1A1A]">
            {alert.title} - {alert.houseName}
          </Text>
          <Text className="text-sm text-[#AAAAAA] mt-0.5">
            {alert.date} - {alert.time}
          </Text>
        </View>
      </View>

      {/* Summary */}
      {summaryText ? (
        <Text className="text-sm text-[#16A34A] mt-2">{summaryText}</Text>
      ) : null}
    </TouchableOpacity>
  );
}
