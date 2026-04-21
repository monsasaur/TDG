import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FilterPillButtonProps {
  label: string;
  onPress: () => void;
}

export default function FilterPillButton({ label, onPress }: FilterPillButtonProps) {
  return (
    <TouchableOpacity
      className="flex-row items-center"
      onPress={onPress}
    >
      <Text className="text-sm text-[#1A1A1A]">{label}</Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color="#1A1A1A"
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  );
}
