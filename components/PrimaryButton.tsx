import { TouchableOpacity, Text } from "react-native";
import { BTN } from "./buttonTheme";

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
        enabled ? BTN.solid : BTN.solidSoft
      } ${className}`}
    >
      <Text
        className={`text-base font-semibold ${
          enabled ? "text-white" : BTN.textOnSoft
        }`}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
