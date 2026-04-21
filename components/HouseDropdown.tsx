import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

interface HouseDropdownProps {
  houses: string[];
  selected: string;
  onSelect: (house: string) => void;
}

export default function HouseDropdown({ houses, selected, onSelect }: HouseDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const showAll = houses.length > 1;
  const options = showAll ? ["ทั้งหมด", ...houses] : houses;

  return (
    <View>
      <TouchableOpacity
        className="flex-row items-center"
        onPress={() => setOpen(!open)}
      >
        <Text className="text-base font-semibold text-[#1A1A1A]">{selected}</Text>
        <Ionicons name="chevron-down" size={16} color="#1A1A1A" style={{ marginLeft: 4 }} />
      </TouchableOpacity>

      {open && (
        <Modal transparent animationType="none" visible={open}>
          <TouchableWithoutFeedback onPress={() => setOpen(false)}>
            <View className="flex-1">
              <View className="absolute left-5 top-[108px] bg-white rounded-xl border border-[#E8E8E8] py-1 w-48 shadow-lg z-50">
                {options.map((house) => (
                  <TouchableOpacity
                    key={house}
                    className="flex-row items-center justify-between px-4 py-3 border-b border-[#F0F0F0]"
                    onPress={() => {
                      onSelect(house);
                      setOpen(false);
                    }}
                  >
                    <Text
                      className={`text-sm ${
                        selected === house ? "text-[#FF3055] font-medium" : "text-[#1A1A1A]"
                      }`}
                    >
                      {house}
                    </Text>
                    {selected === house && (
                      <Ionicons name="checkmark" size={18} color="#FF3055" />
                    )}
                  </TouchableOpacity>
                ))}
                {/* จัดการบ้าน */}
                <TouchableOpacity
                  className="flex-row items-center px-4 py-3"
                  onPress={() => {
                    setOpen(false);
                    router.push("/manage-home" as never);
                  }}
                >
                  <Ionicons name="settings-outline" size={14} color="#888" />
                  <Text className="text-sm text-[#888] ml-2">จัดการบ้าน</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}
