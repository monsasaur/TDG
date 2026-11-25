import { View, Text } from "react-native";

interface DeviceStatusCardProps {
  label?: string;
  status: string;
}

export default function DeviceStatusCard({
  label = "สถานะปัจจุบัน",
  status,
}: DeviceStatusCardProps) {
  return (
    <View className="bg-brand-soft rounded-xl px-4 py-3">
      <Text className="text-xs text-sub">{label}</Text>
      <Text className="text-sm font-semibold text-brand mt-1">{status}</Text>
    </View>
  );
}
