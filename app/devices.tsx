import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Device, mockDevices } from "../data/mockDevices";
import PageHeader from "../components/PageHeader";
import FilterPillButton from "../components/FilterPillButton";
import HouseFilterDropdown from "../components/HouseFilterDropdown";
import AddActionPill from "../components/AddActionPill";

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

      <PageHeader title="อุปกรณ์" onBack={() => router.back()} />

      {/* House filter */}
      <View className="bg-white px-5 pb-4 flex-row justify-end">
        <FilterPillButton
          label={selectedHouse}
          onPress={() => setDropdownOpen(true)}
        />
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

        <AddActionPill
          label="เพิ่มอุปกรณ์ใหม่"
          onPress={() => router.push("/select-house" as never)}
        />
      </ScrollView>

      <HouseFilterDropdown
        visible={dropdownOpen}
        onClose={() => setDropdownOpen(false)}
        options={dropdownOptions}
        selected={selectedHouse}
        onSelect={setSelectedHouse}
      />
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
