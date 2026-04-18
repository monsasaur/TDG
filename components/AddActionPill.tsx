import { TouchableOpacity, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
      className={`bg-[#FFE5E8] border border-[#FFB3BC] ${rounded} ${className} py-3 flex-row items-center justify-center`}
    >
      <Ionicons name="add" size={18} color="#34A853" />
      <Text className="text-sm text-[#1A1A1A] ml-1">{label}</Text>
    </TouchableOpacity>
  );
}
