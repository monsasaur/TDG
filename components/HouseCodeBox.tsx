import { View, Text } from "react-native";

interface HouseCodeBoxProps {
  code: string;
  expired?: boolean;
}

export default function HouseCodeBox({ code, expired }: HouseCodeBoxProps) {
  return (
    <View
      className={`rounded-2xl border py-4 items-center ${
        expired ? "border-[#DDDDDD] bg-[#F0F0F0]" : "border-[#FF3055] bg-white"
      }`}
    >
      <Text
        className={`text-lg font-semibold tracking-widest ${
          expired ? "text-[#AAAAAA]" : "text-[#1A1A1A]"
        }`}
      >
        {code}
      </Text>
    </View>
  );
}
