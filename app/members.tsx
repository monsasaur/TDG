import { Stack, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, View, ActivityIndicator } from "react-native";
import AddActionPill from "../components/AddActionPill";
import ContactCard from "../components/ContactCard";
import FilterPillButton from "../components/FilterPillButton";
import HouseFilterDropdown from "../components/HouseFilterDropdown";
import PageHeader from "../components/PageHeader";

// 1. เปลี่ยนมา Import Hooks แทน mock data
import { EmergencyContact, useContacts } from "../data/useContacts";
import { useHouses } from "../data/useHouses";

export default function MembersScreen() {
  const router = useRouter();

  // 2. ดึงข้อมูลจากฐานข้อมูล
  const { contacts, isLoading: loadingContacts } = useContacts();
  const { houses, isLoading: loadingHouses } = useHouses();

  // 3. สร้างรายชื่อบ้านแบบไดนามิกจากฐานข้อมูล
  const HOUSES = houses.map((h) => h.name);
  const showAll = HOUSES.length > 1;
  const defaultLabel = showAll ? "ทั้งหมด" : HOUSES[0] || "ทั้งหมด";

  const [selectedHouse, setSelectedHouse] = useState(defaultLabel);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // อัปเดต selectedHouse เมื่อโหลดข้อมูลบ้านเสร็จ
  useEffect(() => {
    if (!loadingHouses && HOUSES.length > 0) {
      setSelectedHouse(showAll ? "ทั้งหมด" : HOUSES[0]);
    }
  }, [loadingHouses]);

  const isAll = selectedHouse === "ทั้งหมด" || !showAll;

  const sortByName = (arr: EmergencyContact[]) =>
    [...arr].sort((a, b) => a.name.localeCompare(b.name, "th"));

  // 4. แก้ปัญหา filter of undefined โดยดัก contacts || []
  const members = useMemo(() => {
    if (!contacts) return []; // ถ้ายังโหลดไม่เสร็จ หรือไม่มีค่า ให้ส่ง array ว่างกลับไปก่อน

    const filtered = contacts.filter(
      (c) => c.type === "self" || c.type === "member",
    );
    const inScope = isAll
      ? filtered
      : filtered.filter((c) => c.houses.includes(selectedHouse));
    const self = inScope.filter((c) => c.type === "self");
    const others = sortByName(inScope.filter((c) => c.type === "member"));
    return [...self, ...others];
  }, [selectedHouse, isAll, contacts]); // เพิ่ม contacts เข้าไปใน dependency

  const tagsFor = (contact: EmergencyContact) =>
    contact.houses.map((h) => ({
      label: h,
      active: isAll || h === selectedHouse,
    }));

  const dropdownOptions = showAll ? ["ทั้งหมด", ...HOUSES] : [defaultLabel];

  const isLoading = loadingContacts || loadingHouses;

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="สมาชิก" onBack={() => router.back()} />

      <View className="bg-white px-5 pb-4 flex-row justify-end">
        <FilterPillButton
          label={selectedHouse}
          onPress={() => setDropdownOpen(true)}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xs text-[#888] px-5 mt-5 mb-2">สมาชิกในบ้าน</Text>

        {/* แสดงตัวโหลดข้อมูล */}
        {isLoading ? (
          <ActivityIndicator className="my-10" color="#000" />
        ) : members.length === 0 ? (
          <Text className="px-5 text-center text-gray-400 my-4">ไม่มีข้อมูลสมาชิก</Text>
        ) : (
          members.map((m) => (
            <ContactCard
              key={m.id}
              name={m.name}
              phone={m.phone}
              tags={tagsFor(m)}
              showChevron={m.type !== "self"}
              onPress={
                m.type === "self"
                  ? undefined
                  : () => router.push(`/member-detail?id=${m.id}` as never)
              }
            />
          ))
        )}

        <AddActionPill
          label="เพิ่มสมาชิก"
          onPress={() => router.push("/invite-select-house" as never)}
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