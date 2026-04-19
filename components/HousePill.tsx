import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface HousePillProps {
  label: string;
  onRemove: () => void;
  highlighted?: boolean;
}

export default function HousePill({
  label,
  onRemove,
  highlighted,
}: HousePillProps) {
  return (
    <View
      className={`rounded-full px-4 py-3 mb-3 flex-row items-center justify-between border ${
        highlighted
          ? "bg-[#FFF0F3] border-[#FFD4DC]"
          : "bg-white border-[#E8E8E8]"
      }`}
    >
      <Text className="text-sm text-[#1A1A1A]">{label}</Text>
      <TouchableOpacity onPress={onRemove} hitSlop={12}>
        <Ionicons name="close" size={18} color="#888" />
      </TouchableOpacity>
    </View>
  );
}
