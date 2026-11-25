import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

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
      <Text className="text-sm text-ink">{label}</Text>
      <Ionicons
        name="chevron-down"
        size={14}
        color={C.ink}
        style={{ marginLeft: 4 }}
      />
    </TouchableOpacity>
  );
}
