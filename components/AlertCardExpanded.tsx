import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert, StepStatus } from "../types/alert";

interface AlertCardExpandedProps {
  alert: Alert;
}

function dotColor(status: StepStatus) {
  if (status === "success") return "bg-[#34A853]";
  if (status === "error") return "bg-[#FF3055]";
  return "bg-[#CCCCCC]";
}

function lineColor(status: StepStatus) {
  if (status === "pending") return "bg-[#E8E8E8]";
  return "bg-[#888]";
}

export default function AlertCardExpanded({ alert }: AlertCardExpandedProps) {
  return (
    <View className="bg-white rounded-xl border border-[#E8E8E8] mx-5 mt-3 overflow-hidden">
      <View className="flex-row">
        <View className="w-1 bg-[#FF3055] rounded-l-xl" />
        <View className="flex-1 p-4">
          {/* Title */}
          <Text className="text-base font-bold text-[#FF3055] mb-1">
            {alert.title} - {alert.houseName}
          </Text>

          {/* Description */}
          <Text className="text-xs text-[#555] leading-[18px] mb-3">{alert.description}</Text>

          {/* Location */}
          <View className="flex-row items-center mb-3 pb-3 border-b border-[#E8E8E8]">
            <Ionicons name="location-sharp" size={14} color="#FF3055" />
            <Text className="text-xs text-[#1A1A1A] ml-1">
              {alert.location} - {alert.time}
            </Text>
          </View>

          {/* Timeline */}
          <Text className="text-xs font-semibold text-[#1A1A1A] mb-2">รายละเอียด</Text>
          {alert.timeline.map((step, index) => (
            <View key={index} className="flex-row">
              <View className="items-center mr-3 mt-1.5">
                <View className={`w-2.5 h-2.5 rounded-full ${dotColor(step.status)}`} />
                {index < alert.timeline.length - 1 && (
                  <View className={`w-0.5 flex-1 ${lineColor(step.status)} mt-1`} />
                )}
              </View>
              <View className="flex-1 pb-3">
                <Text className="text-xs font-bold text-[#1A1A1A]">{step.label}</Text>
                {step.detail ? (
                  <Text className="text-xs text-[#888] mt-0.5">{step.detail}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
