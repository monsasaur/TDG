import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

interface JoinOptionCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  onPress: () => void;
  highlighted?: boolean;
}

export default function JoinOptionCard({
  icon,
  title,
  description,
  onPress,
  highlighted,
}: JoinOptionCardProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className={`rounded-2xl px-4 py-4 mb-3 flex-row items-start ${
        highlighted ? "bg-brand-tint" : "bg-white"
      }`}
    >
      <View className="w-9 h-9 rounded-lg bg-[#F5F5F5] items-center justify-center mr-3 mt-0.5">
        <Ionicons name={icon} size={20} color={C.ink} />
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink mb-1">
          {title}
        </Text>
        <Text className="text-xs text-[#777] leading-4">{description}</Text>
      </View>
    </TouchableOpacity>
  );
}
