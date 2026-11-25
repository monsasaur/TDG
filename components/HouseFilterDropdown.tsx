import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

interface HouseFilterDropdownProps {
  visible: boolean;
  onClose: () => void;
  options: string[];
  selected: string;
  onSelect: (option: string) => void;
  topOffset?: number;
}

export default function HouseFilterDropdown({
  visible,
  onClose,
  options,
  selected,
  onSelect,
  topOffset = 108,
}: HouseFilterDropdownProps) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1">
          <View
            className="absolute right-5 bg-white rounded-xl border border-[#E8E8E8] py-1 w-40 shadow-lg"
            style={{ top: topOffset }}
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
