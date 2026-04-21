import { TouchableOpacity, Text } from "react-native";

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  className?: string;
}

export default function PrimaryButton({
  label,
  onPress,
  disabled,
  className = "",
}: PrimaryButtonProps) {
  const enabled = !disabled;
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      disabled={disabled}
      className={`rounded-full py-4 items-center ${
        enabled ? "bg-[#FF3055]" : "bg-[#FFD4DC]"
      } ${className}`}
    >
      <Text
        className={`text-base font-semibold ${
          enabled ? "text-white" : "text-[#FFF6F8]"
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
