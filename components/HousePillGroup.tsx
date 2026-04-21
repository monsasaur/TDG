import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface HousePillGroupProps {
  houses: string[];
  selected: string | string[] | null;
  onSelect: (house: string) => void;
  multi?: boolean;
}

export default function HousePillGroup({
  houses,
  selected,
  onSelect,
  multi,
}: HousePillGroupProps) {
  const isSelected = (h: string) =>
    multi
      ? Array.isArray(selected) && selected.includes(h)
      : selected === h;

  return (
    <View className="flex-row flex-wrap">
      {houses.map((h) => {
        const active = isSelected(h);
        return (
          <TouchableOpacity
            key={h}
            activeOpacity={0.7}
            onPress={() => onSelect(h)}
            className={`flex-row items-center border rounded-full px-3 py-2 mr-2 mb-2 ${
              active
                ? "border-[#FF3055] bg-[#FFE5E8]"
                : "border-[#E8E8E8] bg-white"
            }`}
          >
            {multi ? (
              <View
                className={`w-4 h-4 rounded-sm mr-2 items-center justify-center ${
                  active ? "bg-[#FF3055]" : "border border-[#BBBBBB] bg-white"
                }`}
              >
                {active && (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                )}
              </View>
            ) : (
              <View
                className={`w-4 h-4 rounded-full border mr-2 items-center justify-center ${
                  active ? "border-[#FF3055]" : "border-[#BBBBBB]"
                }`}
              >
                {active && (
                  <View className="w-2 h-2 rounded-full bg-[#FF3055]" />
                )}
              </View>
            )}
            <Text className="text-sm text-[#1A1A1A]">{h}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
