import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { DropdownAnchor } from "./FilterPillButton";
import { C } from "./theme";

interface HouseFilterDropdownProps {
  visible: boolean;
  onClose: () => void;
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
  /** ตำแหน่งปุ่มที่วัดมาจาก FilterPillButton — ไม่ส่งมาจะใช้ topOffset แบบเดิม */
  anchor?: DropdownAnchor;
  topOffset?: number;
}

export default function HouseFilterDropdown({
  visible,
  onClose,
  options,
  selected,
  onSelect,
  anchor,
  topOffset = 108,
}: HouseFilterDropdownProps) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        {/* พื้นหลังหรี่ลงเหมือนเมนูเลือกบ้านหน้าหลัก */}
        <View className="flex-1 bg-black/25">
          <View
            className="absolute bg-white rounded-2xl py-1 w-40 shadow-lg"
            style={{
              top: anchor?.top ?? topOffset,
              right: anchor?.right ?? 20,
              elevation: 8,
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
            }}
          >
            {options.map((option) => (
              <TouchableOpacity
                key={option}
                className="flex-row items-center justify-between px-4 py-3"
                onPress={() => {
                  onSelect(option);
                  onClose();
                }}
              >
                <Text
                  className={`text-sm ${
                    selected === option
                      ? "text-brand font-medium"
                      : "text-ink"
                  }`}
                >
                  {option}
                </Text>
                {selected === option && (
                  <Ionicons name="checkmark" size={18} color={C.brand} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
