import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  centered?: boolean;
}

export default function PageHeader({ title, onBack, centered }: PageHeaderProps) {
  if (centered) {
    return (
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center justify-center relative h-7">
          <TouchableOpacity
            onPress={onBack}
            hitSlop={20}
            className="absolute left-0 top-0 bottom-0 justify-center"
          >
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-base font-semibold text-[#1A1A1A]">{title}</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="bg-white px-5 pt-16 pb-4">
      <View className="flex-row items-center h-7">
        <TouchableOpacity onPress={onBack} hitSlop={20}>
          <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
        </TouchableOpacity>
        <Text className="text-lg font-semibold text-[#1A1A1A] ml-2">{title}</Text>
      </View>
    </View>
  );
}
