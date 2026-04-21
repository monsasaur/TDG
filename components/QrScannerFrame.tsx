import { View } from "react-native";

interface QrScannerFrameProps {
  size?: number;
  color?: string;
}

export default function QrScannerFrame({
  size = 240,
  color = "#FF3055",
}: QrScannerFrameProps) {
  const bracket = "absolute w-8 h-8 border-[#FF3055]";
  return (
    <View style={{ width: size, height: size }}>
      <View
        className={`${bracket} top-0 left-0 border-t-2 border-l-2 rounded-tl-md`}
        style={{ borderColor: color }}
      />
      <View
        className={`${bracket} top-0 right-0 border-t-2 border-r-2 rounded-tr-md`}
        style={{ borderColor: color }}
      />
      <View
        className={`${bracket} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md`}
        style={{ borderColor: color }}
      />
      <View
        className={`${bracket} bottom-0 right-0 border-b-2 border-r-2 rounded-br-md`}
        style={{ borderColor: color }}
      />
    </View>
  );
}
