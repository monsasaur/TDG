import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert, StepStatus } from "../types/alert";
import { C } from "./theme";
import { V2 } from "./designVersion";
import { lookFor, STEP_DOT } from "./alertStatusStyle";

interface AlertCardExpandedProps {
  alert: Alert;
}

function dotColor(status: StepStatus) {
  if (status === "success") return "bg-[#34A853]";
  if (status === "error") return "bg-danger";
  return "bg-[#CCCCCC]";
}

function lineColor(status: StepStatus) {
  if (status === "pending") return "bg-[#E8E8E8]";
  return "bg-sub";
}

export default function AlertCardExpanded({ alert }: AlertCardExpandedProps) {
  // ดีไซน์ v2 — เหตุการณ์ที่จบแล้ว: หัวข้อสี Charcoal + ป้ายสถานะ · สีหม่นตามสถานะ (เด่นสดเฉพาะการ์ดที่ยังรอรับทราบ)
  if (V2) {
    const st = lookFor(alert);
    return (
      <View className="bg-white rounded-2xl border border-[#E5E6E9] mx-5 my-3 p-4">
        <View className="flex-row items-start">
          <Text className="flex-1 text-base font-bold text-[#292A32] mr-2">
            {alert.title} - {alert.houseName}
          </Text>
          <View style={{ backgroundColor: st.bg }} className="flex-row items-center rounded-full px-2.5 py-1">
            <Ionicons name={st.icon} size={12} color={st.fg} />
            <Text style={{ color: st.fg }} className="text-[11px] font-semibold ml-1">
              {st.label}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-[#858891] leading-[18px] mt-1 mb-3">{alert.description}</Text>
        <View className="flex-row items-center mb-3 pb-3 border-b border-[#E5E6E9]">
          <Ionicons name="location-outline" size={14} color="#858891" />
          <Text className="text-xs text-[#292A32] ml-1">
            {alert.location} - {alert.time}
          </Text>
        </View>
        <Text className="text-xs font-semibold text-[#292A32] mb-2">รายละเอียด</Text>
        {alert.timeline.map((step, index) => (
          <View key={index} className="flex-row">
            <View className="items-center mr-3 mt-1.5">
              <View style={{ backgroundColor: STEP_DOT[step.status] }} className="w-2.5 h-2.5 rounded-full" />
              {index < alert.timeline.length - 1 && <View className="w-0.5 flex-1 bg-[#E5E6E9] mt-1" />}
            </View>
            <View className="flex-1 pb-3">
              <Text className="text-xs font-bold text-[#292A32]">{step.label}</Text>
              {step.detail ? <Text className="text-xs text-[#858891] mt-0.5">{step.detail}</Text> : null}
            </View>
          </View>
        ))}
      </View>
    );
  }

  return (
    <View className="bg-white rounded-xl border border-[#E8E8E8] mx-5 mt-3 p-4">
      {/* Title */}
      <Text className="text-base font-bold text-danger mb-1">
        {alert.title} - {alert.houseName}
      </Text>

      {/* Description */}
      <Text className="text-xs text-[#555] leading-[18px] mb-3">{alert.description}</Text>

      {/* Location */}
      <View className="flex-row items-center mb-3 pb-3 border-b border-[#E8E8E8]">
        <Ionicons name="location-sharp" size={14} color={C.danger} />
        <Text className="text-xs text-ink ml-1">
          {alert.location} - {alert.time}
        </Text>
      </View>

      {/* Timeline */}
      <Text className="text-xs font-semibold text-ink mb-2">รายละเอียด</Text>
      {alert.timeline.map((step, index) => (
        <View key={index} className="flex-row">
          <View className="items-center mr-3 mt-1.5">
            <View className={`w-2.5 h-2.5 rounded-full ${dotColor(step.status)}`} />
            {index < alert.timeline.length - 1 && (
              <View className={`w-0.5 flex-1 ${lineColor(step.status)} mt-1`} />
            )}
          </View>
          <View className="flex-1 pb-3">
            <Text className="text-xs font-bold text-ink">{step.label}</Text>
            {step.detail ? (
              <Text className="text-xs text-sub mt-0.5">{step.detail}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
