import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  EmergencyContact,
  mockContacts,
  MAX_EXTERNAL_PER_HOUSE,
} from "../data/mockContacts";
import PageHeader from "../components/PageHeader";
import FilterPillButton from "../components/FilterPillButton";
import HouseFilterDropdown from "../components/HouseFilterDropdown";
import AddActionPill from "../components/AddActionPill";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];

export default function EmergencyContactsScreen() {
  const router = useRouter();

  const showAll = HOUSES.length > 1;
  const defaultLabel = showAll ? "ทั้งหมด" : "บ้านของฉัน";
  const [selectedHouse, setSelectedHouse] = useState(defaultLabel);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isAll = selectedHouse === "ทั้งหมด" || !showAll;

  const sortByName = (arr: EmergencyContact[]) =>
    [...arr].sort((a, b) => a.name.localeCompare(b.name, "th"));

  const filtered = useMemo(
    () =>
      isAll
        ? mockContacts
        : mockContacts.filter((c) => c.houses.includes(selectedHouse)),
    [selectedHouse, isAll]
  );

  const selfContacts = filtered.filter((c) => c.type === "self");
  const memberContacts = sortByName(filtered.filter((c) => c.type === "member"));
  const externalContacts = sortByName(
    filtered.filter((c) => c.type === "external")
  );

  const tagsFor = (contact: EmergencyContact) =>
    contact.houses.map((h) => ({
      label: h,
      active: isAll || h === selectedHouse,
    }));

  const externalCountForHouse = !isAll
    ? mockContacts.filter(
        (c) => c.type === "external" && c.houses.includes(selectedHouse)
      ).length
    : 0;
  const externalLimitReached =
    !isAll && externalCountForHouse >= MAX_EXTERNAL_PER_HOUSE;

  const dropdownOptions = showAll ? ["ทั้งหมด", ...HOUSES] : [defaultLabel];

  const onContactPress = (c: EmergencyContact) =>
    c.type === "self"
      ? undefined
      : () => router.push(`/edit-contact?id=${c.id}` as never);

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="เบอร์โทรฉุกเฉิน" onBack={() => router.back()} />

      {/* House filter */}
      <View className="bg-white px-5 pb-4 flex-row justify-end">
        <FilterPillButton
          label={selectedHouse}
          onPress={() => setDropdownOpen(true)}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <SectionTitle title="เบอร์โทรของฉัน" />
        {selfContacts.map((c) => (
          <ContactRow
            key={c.id}
            contact={c}
            tags={tagsFor(c)}
            onPress={onContactPress(c)}
          />
        ))}

        {memberContacts.length > 0 && (
          <>
            <SectionTitle title="ผู้ติดต่อฉุกเฉิน - สมาชิกภายในบ้าน" />
            {memberContacts.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                tags={tagsFor(c)}
                onPress={onContactPress(c)}
              />
            ))}
          </>
        )}

        {externalContacts.length > 0 && (
          <SectionTitle title="ผู้ติดต่อฉุกเฉิน - เบอร์ภายนอก" />
        )}
        {externalContacts.map((c) => (
          <ContactRow
            key={c.id}
            contact={c}
            tags={tagsFor(c)}
            onPress={onContactPress(c)}
          />
        ))}
        <AddActionPill
          label="เพิ่มผู้ติดต่อฉุกเฉินภายนอก"
          onPress={() => router.push("/add-external-contact" as never)}
          disabled={externalLimitReached}
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

function SectionTitle({ title }: { title: string }) {
  return (
    <Text className="text-xs text-[#888] px-5 mt-5 mb-2">{title}</Text>
  );
}

function ContactRow({
  contact,
  tags,
  onPress,
}: {
  contact: EmergencyContact;
  tags: { label: string; active: boolean }[];
  onPress?: () => void;
}) {
  const initial = contact.name.trim().charAt(0);
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      className="bg-white mx-5 mb-2 rounded-2xl px-4 py-3 flex-row items-center"
    >
      <View className="w-10 h-10 rounded-full bg-[#FFE0E3] items-center justify-center mr-3">
        <Text className="text-base font-semibold text-[#C45A66]">{initial}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-[#1A1A1A]">
          {contact.name}
        </Text>
        <Text className="text-xs text-[#888] mb-1">{contact.phone}</Text>
        <View className="flex-row">
          {tags.map((t) => (
            <View
              key={t.label}
              className={`rounded-md px-2 py-0.5 mr-1 ${
                t.active ? "bg-[#FFE5E8]" : "bg-[#EEEEEE]"
              }`}
            >
              <Text
                className={`text-[10px] ${
                  t.active ? "text-[#C45A66]" : "text-[#888]"
                }`}
              >
                {t.label}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#AAAAAA" />
    </TouchableOpacity>
  );
}
