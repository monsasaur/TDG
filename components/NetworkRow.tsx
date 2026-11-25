import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

interface NetworkRowProps {
  ssid: string;
  onPress: () => void;
  showDivider?: boolean;
}

export default function NetworkRow({ ssid, onPress, showDivider }: NetworkRowProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`px-4 py-3 flex-row items-center ${
        showDivider ? "border-t border-[#F0F0F0]" : ""
      }`}
    >
      <Ionicons name="wifi" size={18} color={C.ink} />
      <Text className="text-sm text-ink ml-3">{ssid}</Text>
    </TouchableOpacity>
  );
}
