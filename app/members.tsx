import { useMemo, useState } from "react";
import { View, Text, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { EmergencyContact, mockContacts } from "../data/mockContacts";
import PageHeader from "../components/PageHeader";
import FilterPillButton from "../components/FilterPillButton";
import HouseFilterDropdown from "../components/HouseFilterDropdown";
import AddActionPill from "../components/AddActionPill";
import ContactCard from "../components/ContactCard";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function MembersScreen() {
  const router = useRouter();

  const showAll = HOUSES.length > 1;
  const defaultLabel = showAll ? "ทั้งหมด" : HOUSES[0];
  const [selectedHouse, setSelectedHouse] = useState(defaultLabel);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isAll = selectedHouse === "ทั้งหมด" || !showAll;

  const sortByName = (arr: EmergencyContact[]) =>
    [...arr].sort((a, b) => a.name.localeCompare(b.name, "th"));

  const members = useMemo(() => {
    const filtered = mockContacts.filter(
      (c) => c.type === "self" || c.type === "member"
    );
    const inScope = isAll
      ? filtered
      : filtered.filter((c) => c.houses.includes(selectedHouse));
    const self = inScope.filter((c) => c.type === "self");
    const others = sortByName(inScope.filter((c) => c.type === "member"));
    return [...self, ...others];
  }, [selectedHouse, isAll]);

  const tagsFor = (contact: EmergencyContact) =>
    contact.houses.map((h) => ({
      label: h,
      active: isAll || h === selectedHouse,
    }));

  const dropdownOptions = showAll ? ["ทั้งหมด", ...HOUSES] : [defaultLabel];

  return (
    <View className="flex-1 bg-[#F5F5F5]">
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

        {members.map((m) => (
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
        ))}

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
