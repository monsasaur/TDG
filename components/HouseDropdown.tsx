import { useRef, useState } from "react";
import { Dimensions, Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
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

/** ความกว้างของเมนู — ใช้คำนวณไม่ให้ล้นขอบจอขวา */
const MENU_WIDTH = 200;
const SCREEN_PADDING = 16;

export default function HouseDropdown({ houses, selected, onSelect, variant = "text" }: HouseDropdownProps) {
  const chip = variant === "chip";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  /** ตำแหน่งปุ่มบนจอ — เมนูจะโผล่ใต้ปุ่มพอดี ไม่ใช่ค่า top คงที่เหมือนเดิม */
  const [anchor, setAnchor] = useState({ left: SCREEN_PADDING, top: 120 });
  const trigger = useRef<View>(null);

  const showAll = houses.length > 1;
  const options = showAll ? ["ทั้งหมด", ...houses] : houses;

  const openMenu = () => {
    const node = trigger.current as (View & { measureInWindow?: Function }) | null;
    node?.measureInWindow?.((x: number, y: number, _w: number, h: number) => {
      const maxLeft = Dimensions.get("window").width - MENU_WIDTH - SCREEN_PADDING;
      setAnchor({ left: Math.max(SCREEN_PADDING, Math.min(x, maxLeft)), top: y + h + 6 });
    });
    setOpen(true);
  };

  return (
    <View ref={trigger} collapsable={false} className={chip ? "self-start" : undefined}>
      {chip ? (
        <TouchableOpacity
          className="flex-row items-center self-start bg-[#F2F3F5] rounded-full pl-3 pr-2.5 py-1.5"
          onPress={openMenu}
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
        <TouchableOpacity className="flex-row items-center" onPress={openMenu}>
          <Text className="text-base font-semibold text-ink">{selected}</Text>
          <Ionicons name="chevron-down" size={16} color={C.ink} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      )}

      <Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}>
        {/* พื้นหลังหรี่ลง ให้เห็นว่าเมนูเปิดอยู่ และกดที่ไหนก็ปิด */}
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View className="flex-1 bg-black/25">
            <View
              className="absolute bg-white rounded-2xl py-1 shadow-lg"
              style={{
                left: anchor.left,
                top: anchor.top,
                width: MENU_WIDTH,
                elevation: 8,
                shadowColor: "#000",
                shadowOpacity: 0.18,
                shadowRadius: 16,
                shadowOffset: { width: 0, height: 6 },
              }}
            >
              {options.map((house, i) => (
                <TouchableOpacity
                  key={house}
                  className={`flex-row items-center justify-between px-4 py-3 ${
                    i === options.length - 1 ? "" : "border-b border-[#F0F0F0]"
                  }`}
                  onPress={() => {
                    onSelect(house);
                    setOpen(false);
                  }}
                >
                  <Text
                    className={`text-sm ${selected === house ? "text-brand font-medium" : "text-ink"}`}
                    numberOfLines={1}
                  >
                    {house}
                  </Text>
                  {selected === house && <Ionicons name="checkmark" size={18} color={C.brand} />}
                </TouchableOpacity>
              ))}
              {/* จัดการบ้าน */}
              <TouchableOpacity
                className="flex-row items-center px-4 py-3 border-t border-[#F0F0F0]"
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
    </View>
  );
}
