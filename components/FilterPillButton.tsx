import { useRef } from "react";
import { Dimensions, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

/** ตำแหน่งของปุ่มบนจอ — เมนูเอาไปวางต่อใต้ปุ่มพอดี ไม่ใช่ระยะคงที่ */
export interface DropdownAnchor {
  /** ขอบบนของเมนู (ใต้ปุ่มเล็กน้อย) */
  top: number;
  /** ระยะจากขอบขวาของจอถึงขอบขวาของปุ่ม */
  right: number;
}

interface FilterPillButtonProps {
  label: string;
  onPress: (anchor?: DropdownAnchor) => void;
}

export default function FilterPillButton({ label, onPress }: FilterPillButtonProps) {
  const ref = useRef<View>(null);

  const handlePress = () => {
    const node = ref.current as (View & { measureInWindow?: Function }) | null;
    if (!node?.measureInWindow) {
      onPress();
      return;
    }
    node.measureInWindow((x: number, y: number, w: number, h: number) => {
      const right = Math.max(8, Dimensions.get("window").width - (x + w));
      onPress({ top: y + h + 6, right });
    });
    // เผื่อ measureInWindow ไม่เรียก callback (บางแพลตฟอร์ม) — เปิดเมนูไว้ก่อนด้วยตำแหน่งเดิม
  };

  return (
    <TouchableOpacity ref={ref} className="flex-row items-center" onPress={handlePress}>
      <Text className="text-sm text-ink">{label}</Text>
      <Ionicons name="chevron-down" size={14} color={C.ink} style={{ marginLeft: 4 }} />
    </TouchableOpacity>
  );
}
