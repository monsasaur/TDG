import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface NumericKeypadProps {
  onKey: (digit: string) => void;
  onBackspace: () => void;
}

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
];

export default function NumericKeypad({
  onKey,
  onBackspace,
}: NumericKeypadProps) {
  return (
    <View className="px-2">
      {ROWS.map((row) => (
        <View key={row[0]} className="flex-row justify-between mb-2">
          {row.map((d) => (
            <Key key={d} label={d} onPress={() => onKey(d)} />
          ))}
        </View>
      ))}
      <View className="flex-row justify-between">
        <View className="flex-1 mx-1" />
        <Key label="0" onPress={() => onKey("0")} />
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={onBackspace}
          className="flex-1 mx-1 h-12 items-center justify-center"
          hitSlop={8}
        >
          <Ionicons name="backspace-outline" size={22} color="#1A1A1A" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Key({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.6}
      onPress={onPress}
      className="flex-1 mx-1 h-12 rounded-xl bg-white items-center justify-center"
      style={{
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 2,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
      }}
    >
      <Text className="text-xl text-[#1A1A1A]">{label}</Text>
    </TouchableOpacity>
  );
}
