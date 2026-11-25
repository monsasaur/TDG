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
                ? "border-brand bg-brand-soft"
                : "border-[#E8E8E8] bg-white"
            }`}
          >
            {multi ? (
              <View
                className={`w-4 h-4 rounded-sm mr-2 items-center justify-center ${
                  active ? "bg-brand" : "border border-[#BBBBBB] bg-white"
                }`}
              >
                {active && (
                  <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                )}
              </View>
            ) : (
              <View
                className={`w-4 h-4 rounded-full border mr-2 items-center justify-center ${
                  active ? "border-brand" : "border-[#BBBBBB]"
                }`}
              >
                {active && (
                  <View className="w-2 h-2 rounded-full bg-brand" />
                )}
              </View>
            )}
            <Text className="text-sm text-ink">{h}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
