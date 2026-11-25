import { Ionicons } from "@expo/vector-icons";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import AddActionPill from "../components/AddActionPill";
import FilterPillButton, { DropdownAnchor } from "../components/FilterPillButton";
import HouseFilterDropdown from "../components/HouseFilterDropdown";
import PageHeader from "../components/PageHeader";
import { useDevices } from "../contexts/DevicesContext";
import { SkeletonList } from "../components/Skeleton";
import { ALL_HOUSES, useHouseFilter } from "../contexts/HouseFilterContext";
import { Device } from "../data/useDevices";
import { useHouses } from "../data/useHouses"; // Import เพิ่ม
import { safeBack } from "../lib/navigation";

export default function DevicesScreen() {
  const router = useRouter();
  const { devices, refresh: refreshDevices, isLoading: devicesLoading } = useDevices();
  const { houses: dbHouses } = useHouses(); // ดึงบ้านจาก DB

  // เปิดหน้านี้เมื่อไรก็ดึงอุปกรณ์ใหม่ — เพิ่ม/ลบอุปกรณ์จากที่อื่นแล้วต้องเห็นทันที ไม่ใช่รอเปิดแอปใหม่
  useFocusEffect(
    useCallback(() => {
      void refreshDevices();
    }, [refreshDevices]),
  );

  const HOUSES = useMemo(() => dbHouses.map((h) => h.name), [dbHouses]);
  const showAll = HOUSES.length > 1;
  const defaultLabel = showAll ? "ทั้งหมด" : "ทุกบ้าน";

  // ตัวกรองบ้านตัวเดียวกับหน้าหลัก — เลือกไว้ที่ไหนก็ติดทั้งแอป (contexts/HouseFilterContext)
  const { selected: selectedHouse, setSelected: setSelectedHouse } = useHouseFilter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  // ตำแหน่งปุ่มกรอง — ให้เมนูโผล่ใต้ปุ่มพอดีทุกหน้า
  const [anchor, setAnchor] = useState<DropdownAnchor | undefined>(undefined);

  const isAll = selectedHouse === ALL_HOUSES || !showAll;
  const housesToShow = isAll ? HOUSES : [selectedHouse];

  const devicesByHouse = useMemo(() => {
    const map: Record<string, Device[]> = {};
    for (const h of housesToShow) {
      map[h] = devices.filter((d) => d.houseName === h); // เปลี่ยน d.house เป็น d.houseName
    }
    return map;
  }, [housesToShow, devices]);

  const dropdownOptions = showAll ? [ALL_HOUSES, ...HOUSES] : [defaultLabel];

  return (
    <View className="flex-1 bg-page">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="อุปกรณ์" onBack={() => safeBack(router)} />

      <View className="bg-white px-5 pb-4 flex-row justify-end">
        <FilterPillButton
          label={showAll ? selectedHouse : defaultLabel}
          onPress={(a) => {
            setAnchor(a);
            setDropdownOpen(true);
          }}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        {devicesLoading && devices.length === 0 ? <SkeletonList count={3} /> : null}
        {housesToShow.map((h) => {
          const list = devicesByHouse[h] ?? [];
          return (
            <View key={h}>
              <Text className="text-xs font-semibold text-ink px-5 mt-4 mb-2">
                {h}
              </Text>
              {list.length === 0 ? (
                <Text className="text-xs text-sub px-5">
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
        anchor={anchor}
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
        <Text className="text-sm font-semibold text-ink">
          {device.name}
        </Text>
        <Text className="text-xs text-sub mt-0.5">{device.code}</Text>
        <Text
          className={`text-xs mt-0.5 ${
            isConnected ? "text-brand" : "text-sub"
          }`}
        >
          {isConnected ? "เชื่อมต่อ" : "ขาดการเชื่อมต่อ"}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#AAAAAA" />
    </TouchableOpacity>
  );
}
