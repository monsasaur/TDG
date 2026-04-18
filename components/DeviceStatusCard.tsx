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
    <View className="bg-[#FFE5E8] rounded-xl px-4 py-3">
      <Text className="text-xs text-[#888]">{label}</Text>
      <Text className="text-sm font-semibold text-[#FF3055] mt-1">{status}</Text>
    </View>
  );
}
