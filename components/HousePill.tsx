import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

interface HousePillProps {
  label: string;
  /** ข้อความเล็กต่อท้ายชื่อ เช่นบทบาทในบ้าน */
  caption?: string;
  onRemove: () => void;
  highlighted?: boolean;
}

export default function HousePill({
  label,
  caption,
  onRemove,
  highlighted,
}: HousePillProps) {
  return (
    <View
      className={`rounded-full px-4 py-3 mb-3 flex-row items-center justify-between border ${
        highlighted
          ? "bg-brand-tint border-brand-tint-line"
          : "bg-white border-[#E8E8E8]"
      }`}
    >
      <Text className="text-sm text-ink flex-1 mr-2" numberOfLines={1}>
        {label}
        {caption ? <Text className="text-xs text-sub">{`  ${caption}`}</Text> : null}
      </Text>
      <TouchableOpacity onPress={onRemove} hitSlop={12}>
        <Ionicons name="close" size={18} color={C.sub} />
      </TouchableOpacity>
    </View>
  );
}
