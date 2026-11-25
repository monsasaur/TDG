import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";
import { V2 } from "./designVersion";

interface AddActionPillProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  rounded?: "rounded-2xl" | "rounded-full";
  className?: string;
}

export default function AddActionPill({
  label,
  onPress,
  disabled,
  rounded = "rounded-2xl",
  className = "mx-5 mt-2",
}: AddActionPillProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      style={{ opacity: disabled ? 0.5 : 1 }}
      className={`${V2 ? "bg-white" : "bg-brand-soft"} border border-brand-line ${rounded} ${className} py-3 flex-row items-center justify-center`}
    >
      <Ionicons name="add" size={18} color={V2 ? C.brand : "#34A853"} />
      <Text className={`text-sm text-ink ml-1 ${V2 ? "font-semibold" : ""}`}>{label}</Text>
    </TouchableOpacity>
  );
}
