import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import AddActionPill from "../components/AddActionPill";
import FilterPillButton from "../components/FilterPillButton";
import HouseFilterDropdown from "../components/HouseFilterDropdown";
import PageHeader from "../components/PageHeader";
import { useDevices } from "../contexts/DevicesContext";
import { Device } from "../data/useDevices";
import { useHouses } from "../data/useHouses"; // Import เพิ่ม

export default function DevicesScreen() {
  const router = useRouter();
  const { devices } = useDevices();
  const { houses: dbHouses } = useHouses(); // ดึงบ้านจาก DB

  const HOUSES = useMemo(() => dbHouses.map((h) => h.name), [dbHouses]);
  const showAll = HOUSES.length > 1;
  const defaultLabel = showAll ? "ทั้งหมด" : "ทุกบ้าน";

  const [selectedHouse, setSelectedHouse] = useState(defaultLabel);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  useEffect(() => {
    if (HOUSES.length > 0) {
      setSelectedHouse(showAll ? "ทั้งหมด" : HOUSES[0]);
    }
  }, [dbHouses]);

  const isAll = selectedHouse === "ทั้งหมด" || !showAll;
  const housesToShow = isAll ? HOUSES : [selectedHouse];

  const devicesByHouse = useMemo(() => {
    const map: Record<string, Device[]> = {};
    for (const h of housesToShow) {
      map[h] = devices.filter((d) => d.houseName === h); // เปลี่ยน d.house เป็น d.houseName
    }
    return map;
  }, [housesToShow, devices]);

  const dropdownOptions = showAll ? ["ทั้งหมด", ...HOUSES] : [defaultLabel];

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="อุปกรณ์" onBack={() => router.back()} />

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
      onPress={() => router.push(`/device-details?id=${device.id}` as never)}
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
