import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SystemAlert } from "../types/alert";
import { useReadState } from "../contexts/ReadStateContext";
import { C } from "./theme";

interface SystemAlertCardProps {
  alert: SystemAlert;
}

/**
 * การ์ดแจ้งเตือนระบบ (อุปกรณ์หลุด)
 * กดดูแล้วถือว่าอ่านแล้ว — จุดแดงบนแท็บลดลง และการ์ดเปลี่ยนเป็นสีจางกว่าเดิม
 */
export default function SystemAlertCard({ alert }: SystemAlertCardProps) {
  const router = useRouter();
  const { isRead, markRead } = useReadState();
  const read = isRead(alert.id);

  return (
    <Pressable
      onPress={() => {
        markRead(alert.id);
        router.push("/devices" as never);
      }}
      accessibilityRole="button"
      accessibilityLabel={`${read ? "อ่านแล้ว" : "ยังไม่อ่าน"} ${alert.title} ${alert.deviceName}`}
      className={`rounded-xl mx-5 mt-3 p-4 ${read ? "bg-[#F7F7F8] border border-[#E5E6E9]" : "bg-white"}`}
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      {/* Header */}
      <View className="flex-row items-center">
        <View
          className={`w-9 h-9 rounded-lg items-center justify-center mr-3 ${read ? "bg-[#EDEDEF]" : "bg-[#EFEFEF]"}`}
        >
          <Ionicons name="warning" size={18} color={read ? C.sub : C.ink} />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center">
            {!read && <View className="w-2 h-2 rounded-full bg-[#DC2626] mr-2" />}
            <Text className={`text-sm flex-1 ${read ? "font-medium text-sub" : "font-bold text-ink"}`}>
              {alert.title}
            </Text>
          </View>
          <Text className="text-xs text-sub mt-0.5">ชื่ออุปกรณ์ : {alert.deviceName}</Text>
        </View>
      </View>

      {/* Divider */}
      <View className="h-px bg-[#E8E8E8] my-3" />

      {/* House info */}
      <Text className="text-xs text-[#555]">อุปกรณ์เชื่อมต่อของ {alert.houseName}</Text>
    </Pressable>
  );
}
