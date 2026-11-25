import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
}

export default function SettingItem({ icon, label, onPress }: SettingItemProps) {
  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl bg-white mx-5 mt-3 px-5 py-4"
      style={({ pressed }) => (pressed ? { opacity: 0.85 } : undefined)}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name={icon} size={18} color={C.ink} />
          <Text className="text-sm font-semibold text-ink ml-3">
            {label}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={C.sub} />
      </View>
    </Pressable>
  );
}
