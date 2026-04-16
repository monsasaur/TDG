import { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAlerts } from "../contexts/AlertsContext";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function ClearAlertsScreen() {
  const router = useRouter();
  const { alerts, systemAlerts, clearAlerts } = useAlerts();

  const showAll = HOUSES.length > 1;
  const defaultHouse = showAll ? "ทั้งหมด" : HOUSES[0];
  const [selectedHouse, setSelectedHouse] = useState(defaultHouse);
  const [clearFall, setClearFall] = useState(true);
  const [clearSystem, setClearSystem] = useState(true);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isAll = selectedHouse === "ทั้งหมด";

  const fallCount = useMemo(
    () =>
      isAll
        ? alerts.length
        : alerts.filter((a) => a.houseName === selectedHouse).length,
    [alerts, selectedHouse, isAll]
  );
  const systemCount = useMemo(
    () =>
      isAll
        ? systemAlerts.length
        : systemAlerts.filter((a) => a.houseName === selectedHouse).length,
    [systemAlerts, selectedHouse, isAll]
  );

  const totalToClear =
    (clearFall ? fallCount : 0) + (clearSystem ? systemCount : 0);
  const canDelete = totalToClear > 0;

  const handleConfirmDelete = () => {
    clearAlerts({
      house: isAll ? undefined : selectedHouse,
      clearFall,
      clearSystem,
    });
    setConfirmOpen(false);
  };

  const confirmBody = isAll
    ? "คุณต้องการลบข้อมูลทั้งหมดใช่ไหม"
    : `คุณต้องการลบข้อมูล ${selectedHouse} ใช่ไหม`;

  const dropdownOptions = showAll ? ["ทั้งหมด", ...HOUSES] : HOUSES;

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center h-7">
          <TouchableOpacity onPress={() => router.back()} hitSlop={20}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-[#1A1A1A] ml-2">
            ลบการแจ้งเตือน
          </Text>
        </View>
      </View>

      {/* House selector row */}
      <View className="bg-white px-5 py-4 flex-row items-center justify-between">
        <Text className="text-sm text-[#1A1A1A]">บ้าน</Text>
        <TouchableOpacity
          className="flex-row items-center"
          onPress={() => setDropdownOpen(true)}
        >
          <Text className="text-sm text-[#1A1A1A]">{selectedHouse}</Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color="#1A1A1A"
            style={{ marginLeft: 4 }}
          />
        </TouchableOpacity>
      </View>

      {/* Checkbox rows */}
      <View className="bg-white mt-2 px-5">
        <CheckRow
          label="ข้อความแจ้งเตือน"
          sublabel={`${fallCount} การแจ้งเตือน จาก ข้อความแจ้งเตือน`}
          checked={clearFall}
          onToggle={() => setClearFall((v) => !v)}
        />
        <CheckRow
          label="ข้อความแจ้งเตือนระบบ"
          sublabel={`${systemCount} การแจ้งเตือน จาก ข้อความแจ้งเตือนระบบ`}
          checked={clearSystem}
          onToggle={() => setClearSystem((v) => !v)}
          last
        />
      </View>

      {/* Delete button */}
      <View className="absolute bottom-10 right-5">
        <Pressable
          disabled={!canDelete}
          onPress={() => setConfirmOpen(true)}
          className="rounded-full px-8 py-3"
          style={({ pressed }) => ({
            backgroundColor: pressed ? "#D92647" : "#FF3055",
            opacity: canDelete ? 1 : 0.5,
          })}
        >
          <Text className="text-white font-semibold text-sm">ลบข้อมูล</Text>
        </Pressable>
      </View>

      {/* House dropdown modal */}
      {dropdownOpen && (
        <Modal transparent animationType="none" visible={dropdownOpen}>
          <TouchableWithoutFeedback onPress={() => setDropdownOpen(false)}>
            <View className="flex-1">
              <View className="absolute right-5 top-[148px] bg-white rounded-xl border border-[#E8E8E8] py-1 w-40 shadow-lg">
                {dropdownOptions.map((house) => (
                  <TouchableOpacity
                    key={house}
                    className="flex-row items-center justify-between px-4 py-3"
                    onPress={() => {
                      setSelectedHouse(house);
                      setDropdownOpen(false);
                    }}
                  >
                    <Text
                      className={`text-sm ${
                        selectedHouse === house
                          ? "text-[#FF3055] font-medium"
                          : "text-[#1A1A1A]"
                      }`}
                    >
                      {house}
                    </Text>
                    {selectedHouse === house && (
                      <Ionicons name="checkmark" size={18} color="#FF3055" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}

      {/* Confirm modal */}
      <Modal visible={confirmOpen} transparent animationType="fade">
        <View className="flex-1 bg-black/40 justify-center items-center px-10">
          <View className="bg-white rounded-2xl w-full pt-5 pb-0">
            <Text className="text-base font-semibold text-[#1A1A1A] text-center mb-2 px-5">
              ยืนยันลบการแจ้งเตือนใช่ไหม
            </Text>
            <Text className="text-sm text-[#888] text-center mb-4 px-5">
              {confirmBody}
            </Text>
            <View className="flex-row border-t border-[#E8E8E8]">
              <TouchableOpacity
                onPress={() => setConfirmOpen(false)}
                className="flex-1 py-3 items-center border-r border-[#E8E8E8]"
              >
                <Text className="text-[#FF3055] font-medium text-sm">
                  ยกเลิก
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmDelete}
                className="flex-1 py-3 items-center"
              >
                <Text className="text-[#FF3055] font-medium text-sm">
                  ตกลง
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function CheckRow({
  label,
  sublabel,
  checked,
  onToggle,
  last,
}: {
  label: string;
  sublabel: string;
  checked: boolean;
  onToggle: () => void;
  last?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      className={`flex-row items-center justify-between py-4 ${
        last ? "" : "border-b border-[#F0F0F0]"
      }`}
    >
      <View className="flex-1 pr-4">
        <Text className="text-sm font-semibold text-[#1A1A1A] mb-1">
          {label}
        </Text>
        <Text className="text-xs text-[#888]">{sublabel}</Text>
      </View>
      <View
        className="w-6 h-6 rounded items-center justify-center"
        style={{
          backgroundColor: checked ? "#FF3055" : "#FFFFFF",
          borderWidth: checked ? 0 : 1.5,
          borderColor: "#CCCCCC",
        }}
      >
        {checked && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
      </View>
    </TouchableOpacity>
  );
}
