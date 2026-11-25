import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, TouchableWithoutFeedback } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

interface HouseDropdownProps {
  houses: string[];
  selected: string;
  onSelect: (house: string) => void;
  /** "chip" = ปุ่มแคปซูลมีไอคอนบ้าน ใช้ใต้หัวหน้าจอดีไซน์ v2 */
  variant?: "text" | "chip";
}

export default function HouseDropdown({ houses, selected, onSelect, variant = "text" }: HouseDropdownProps) {
  const chip = variant === "chip";
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const showAll = houses.length > 1;
  const options = showAll ? ["ทั้งหมด", ...houses] : houses;

  return (
    <View>
      {chip ? (
        <TouchableOpacity
          className="flex-row items-center self-start bg-[#F2F3F5] rounded-full pl-3 pr-2.5 py-1.5"
          onPress={() => setOpen(!open)}
          accessibilityRole="button"
          accessibilityLabel={`เลือกบ้าน ตอนนี้: ${selected === "ทั้งหมด" ? "ทุกบ้าน" : selected}`}
        >
          <Ionicons name="home-outline" size={14} color={C.ink} />
          <Text className="text-sm font-semibold text-ink ml-1.5" numberOfLines={1}>
            {selected === "ทั้งหมด" ? "ทุกบ้าน" : selected}
          </Text>
          <Ionicons name="chevron-down" size={14} color={C.sub} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity className="flex-row items-center" onPress={() => setOpen(!open)}>
          <Text className="text-base font-semibold text-ink">{selected}</Text>
          <Ionicons name="chevron-down" size={16} color={C.ink} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      )}

      {open && (
        <Modal transparent animationType="none" visible={open}>
          <TouchableWithoutFeedback onPress={() => setOpen(false)}>
            <View className="flex-1">
              <View className={`absolute left-5 ${chip ? "top-[150px]" : "top-[108px]"} bg-white rounded-xl border border-[#E8E8E8] py-1 w-48 shadow-lg z-50`}>
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
                        selected === house ? "text-brand font-medium" : "text-ink"
                      }`}
                    >
                      {house}
                    </Text>
                    {selected === house && (
                      <Ionicons name="checkmark" size={18} color={C.brand} />
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
                  <Ionicons name="settings-outline" size={14} color={C.sub} />
                  <Text className="text-sm text-sub ml-2">จัดการบ้าน</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </View>
  );
}
