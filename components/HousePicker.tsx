import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AddActionPill from "./AddActionPill";

interface HousePickerProps {
  houses: string[];
  selected: string;
  onSelect: (house: string) => void;
  onAddHouse: () => void;
  addLabel?: string;
  className?: string;
}

export default function HousePicker({
  houses,
  selected,
  onSelect,
  onAddHouse,
  addLabel = "เพิ่มบ้าน",
  className = "px-5 mt-5",
}: HousePickerProps) {
  return (
    <View className={className}>
      {houses.map((h) => {
        const isSelected = selected === h;
        return (
          <TouchableOpacity
            key={h}
            activeOpacity={0.7}
            onPress={() => onSelect(h)}
            className={`rounded-full px-4 py-3 mb-2 flex-row items-center justify-between ${
              isSelected ? "bg-[#FFE5E8]" : "bg-white border border-[#E8E8E8]"
            }`}
          >
            <View className="flex-row items-center">
              <Ionicons name="home-outline" size={18} color="#1A1A1A" />
              <Text className="text-sm text-[#1A1A1A] ml-3">{h}</Text>
            </View>
            <View
              className={`w-5 h-5 rounded-full border items-center justify-center ${
                isSelected ? "border-[#FF3055]" : "border-[#BBBBBB]"
              }`}
            >
              {isSelected && (
                <View className="w-2.5 h-2.5 rounded-full bg-[#FF3055]" />
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <AddActionPill
        label={addLabel}
        onPress={onAddHouse}
        rounded="rounded-full"
        className="mt-1"
      />
    </View>
  );
}
