import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DeviceSuccessCardProps {
  title: string;
  subtitle?: string;
}

export default function DeviceSuccessCard({
  title,
  subtitle,
}: DeviceSuccessCardProps) {
  return (
    <View className="bg-brand-soft rounded-xl px-4 py-3 flex-row items-center">
      <View className="w-8 h-8 rounded-lg bg-brand items-center justify-center mr-3">
        <Ionicons name="checkmark" size={18} color="white" />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-brand">{title}</Text>
        {subtitle && (
          <Text className="text-xs text-sub mt-0.5">{subtitle}</Text>
        )}
      </View>
    </View>
  );
}
