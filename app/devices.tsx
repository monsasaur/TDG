import { useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Device, mockDevices } from "../data/mockDevices";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function DevicesScreen() {
  const router = useRouter();

  const showAll = HOUSES.length > 1;
  const defaultLabel = showAll ? "ทั้งหมด" : "ทุกบ้าน";
  const [selectedHouse, setSelectedHouse] = useState(defaultLabel);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isAll = selectedHouse === "ทั้งหมด" || !showAll;
  const housesToShow = isAll ? HOUSES : [selectedHouse];

  const devicesByHouse = useMemo(() => {
    const map: Record<string, Device[]> = {};
    for (const h of housesToShow) {
      map[h] = mockDevices.filter((d) => d.house === h);
    }
    return map;
  }, [housesToShow]);

  const dropdownOptions = showAll ? ["ทั้งหมด", ...HOUSES] : [defaultLabel];

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
            อุปกรณ์
          </Text>
        </View>
      </View>

      {/* House filter */}
      <View className="bg-white px-5 pb-4 flex-row justify-end">
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

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {housesToShow.map((h) => {
          const list = devicesByHouse[h] ?? [];
          return (
            <View key={h}>
              <Text className="text-xs font-semibold text-[#1A1A1A] px-5 mt-4 mb-2">
                {h}
              </Text>
              {list.length === 0 ? (
                <Text className="text-xs text-[#888] px-5">
                  ไม่มีการอุปกรณ์ในบ้าน
                </Text>
              ) : (
                list.map((d) => <DeviceRow key={d.id} device={d} />)
              )}
            </View>
          );
        })}

        <AddDeviceButton
          onPress={() => router.push("/select-house" as never)}
        />
      </ScrollView>

      {/* House dropdown */}
      {dropdownOpen && (
        <Modal transparent animationType="none" visible={dropdownOpen}>
          <TouchableWithoutFeedback onPress={() => setDropdownOpen(false)}>
            <View className="flex-1">
              <View className="absolute right-5 top-[108px] bg-white rounded-xl border border-[#E8E8E8] py-1 w-40 shadow-lg">
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
    </View>
  );
}

function DeviceRow({ device }: { device: Device }) {
  const router = useRouter();
  const isConnected = device.status === "connected";
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        router.push(`/device-details?id=${device.id}` as never)
      }
      className="bg-white mx-5 mb-2 rounded-2xl px-4 py-3 flex-row items-center"
    >
      <View className="flex-1">
        <Text className="text-sm font-semibold text-[#1A1A1A]">
          {device.name}
        </Text>
        <Text className="text-xs text-[#888] mt-0.5">{device.code}</Text>
        <Text
          className={`text-xs mt-0.5 ${
            isConnected ? "text-[#FF3055]" : "text-[#888]"
          }`}
        >
          {isConnected ? "เชื่อมต่อ" : "ขาดการเชื่อมต่อ"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#AAAAAA" />
    </TouchableOpacity>
  );
}

function AddDeviceButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="bg-[#FFE5E8] border border-[#FFB3BC] rounded-2xl mx-5 mt-2 py-3 flex-row items-center justify-center"
    >
      <Ionicons name="add" size={18} color="#34A853" />
      <Text className="text-sm text-[#1A1A1A] ml-1">เพิ่มอุปกรณ์ใหม่</Text>
    </TouchableOpacity>
  );
}
