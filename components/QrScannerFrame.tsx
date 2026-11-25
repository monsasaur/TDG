import { View } from "react-native";
import { V2 } from "./designVersion";
import { C } from "./theme";

interface QrScannerFrameProps {
  size?: number;
  color?: string;
}

const SCAN_GREEN = "#22C55E";
/** ความยาวที่เส้นสแกนยื่นเลยกรอบออกไปด้านบนและล่าง */
const OVERSHOOT = 16;

/**
 * กรอบสแกน QR — มุมสี่ด้าน + เส้นสีเขียวแนวตั้งกลางกรอบ ยาวเลยกรอบเล็กน้อย (นิ่ง ไม่กะพริบ)
 * วางบนภาพกล้องพื้นดำ: v2 ใช้มุมสีขาว (สี Charcoal จะมองไม่เห็นบนพื้นดำ)
 */
export default function QrScannerFrame({ size = 240, color = V2 ? "#FFFFFF" : C.brand }: QrScannerFrameProps) {
  const bracket = "absolute w-8 h-8";
  return (
    <View style={{ width: size, height: size }} accessibilityLabel="กรอบสแกน QR Code วาง QR ให้อยู่ในกรอบ">
      <View className={`${bracket} top-0 left-0 border-t-2 border-l-2 rounded-tl-md`} style={{ borderColor: color }} />
      <View className={`${bracket} top-0 right-0 border-t-2 border-r-2 rounded-tr-md`} style={{ borderColor: color }} />
      <View className={`${bracket} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-md`} style={{ borderColor: color }} />
      <View className={`${bracket} bottom-0 right-0 border-b-2 border-r-2 rounded-br-md`} style={{ borderColor: color }} />

      {/* เส้นสแกนสีเขียวแนวตั้งกลางกรอบ ยาวเลยมุมบน-ล่างออกไปนิดหนึ่ง */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -OVERSHOOT,
          bottom: -OVERSHOOT,
          left: size / 2 - 1,
          width: 2,
          borderRadius: 1,
          backgroundColor: SCAN_GREEN,
          shadowColor: SCAN_GREEN,
          shadowOpacity: 0.9,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 0 },
          elevation: 4,
        }}
      />
    </View>
  );
}
