import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Alert } from "../types/alert";
import { lookFor } from "./alertStatusStyle";

/**
 * แถวประวัติการแจ้งเตือน — ดีไซน์ใหม่ (HOME_DESIGN = "v2" ใน app/home.tsx)
 * ไอคอนบอกสถานะ · หัวข้อ · วันเวลา · ลูกศร · กดแล้วกางรายละเอียด (AlertCardExpanded เดิม)
 */
interface Props {
  alert: Alert;
  onPress?: (id: string) => void;
  first?: boolean;
  last?: boolean;
}

function look(alert: Alert): { icon: keyof typeof Ionicons.glyphMap; bg: string; color: string; title: string } {
  const st = lookFor(alert);
  const title =
    alert.status === "completed" && alert.answeredBy ? `${st.label} · ${alert.answeredBy}` : st.label;
  return { icon: st.icon, bg: st.bg, color: st.fg, title };
}

export default function AlertHistoryRow({ alert, onPress, first, last }: Props) {
  const l = look(alert);
  return (
    <TouchableOpacity
      onPress={() => onPress?.(alert.id)}
      activeOpacity={0.7}
      className={`bg-white mx-5 px-4 py-3.5 flex-row items-center ${first ? "rounded-t-2xl" : ""} ${
        last ? "rounded-b-2xl" : "border-b border-[#F2F3F5]"
      }`}
    >
      <View style={{ backgroundColor: l.bg }} className="w-9 h-9 rounded-full items-center justify-center" accessibilityLabel={l.title}>
        <Ionicons name={l.icon} size={18} color={l.color} />
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-sm font-semibold text-[#292A32]" numberOfLines={1}>
          {l.title}
        </Text>
        <Text className="text-xs text-[#858891] mt-0.5" numberOfLines={1}>
          {alert.houseName} · {alert.date} เวลา {alert.time}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
    </TouchableOpacity>
  );
}
