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
      className="rounded-xl border border-[#E8E8E8] bg-white mx-5 mt-3 overflow-hidden"
      onPress={() => onPress?.(alert.id)}
      activeOpacity={0.7}
    >
      <View className="flex-row">
        <View
          className={`w-1 rounded-l-xl ${
            alert.status === "no_response" ? "bg-[#FF3055]" : "bg-[#E8E8E8]"
          }`}
        />
        <View className="flex-1 p-4">
          {/* Header row */}
          <View className="flex-row items-start">
            <View className="w-6 h-6 rounded bg-[#FFF0F0] items-center justify-center mr-2 mt-0.5">
              <Ionicons name="warning" size={14} color="#FF3055" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-sm font-bold text-[#1A1A1A]">
                  {alert.title} - {alert.houseName}
                </Text>
              </View>
              <Text className="text-xs text-[#AAAAAA] mt-0.5">
                {alert.date} - {alert.time}
              </Text>
            </View>
          </View>

          {/* Summary */}
          {summaryText ? (
            <Text className="text-xs text-[#888] mt-2">{summaryText}</Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}
