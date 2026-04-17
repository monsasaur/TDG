import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mockContacts } from "../data/mockContacts";

const HOUSES = ["บ้านแม่", "บ้านพ่อ"];
const NAME_MAX = 20;
const PHONE_MAX = 20;

const sanitizeName = (raw: string) =>
  raw
    .replace(/[\p{Extended_Pictographic}\u200d]/gu, "")
    .replace(/[\/*]/g, "")
    .slice(0, NAME_MAX);

const sanitizePhone = (raw: string) =>
  raw.replace(/[^0-9]/g, "").slice(0, PHONE_MAX);

export default function EditContactScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const contact = useMemo(
    () => mockContacts.find((c) => c.id === id),
    [id]
  );

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [houses, setHouses] = useState<string[]>([]);

  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setPhone(contact.phone);
      setHouses(contact.houses);
    }
  }, [contact]);

  const canSave =
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    houses.length > 0;

  const toggleHouse = (h: string) =>
    setHouses((prev) =>
      prev.includes(h) ? prev.filter((x) => x !== h) : [...prev, h]
    );

  const goBack = () => router.replace("/emergency-contacts" as never);

  if (!contact) {
    return (
      <View className="flex-1 bg-[#F5F5F5] items-center justify-center px-8">
        <Text className="text-sm text-[#888]">ไม่พบผู้ติดต่อ</Text>
        <TouchableOpacity onPress={goBack} className="mt-4">
          <Text className="text-sm font-semibold text-[#FF3055]">กลับ</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      {/* Header */}
      <View className="bg-white px-5 pt-16 pb-4">
        <View className="flex-row items-center h-7">
          <TouchableOpacity onPress={goBack} hitSlop={20}>
            <Ionicons name="chevron-back" size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold text-[#1A1A1A] ml-2">
            แก้ไขผู้ติดต่อ
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <View className="px-5 mt-5">
            <Text className="text-sm text-[#1A1A1A] mb-2">ชื่อผู้ติดต่อ</Text>
            <TextInput
              value={name}
              onChangeText={(t) => setName(sanitizeName(t))}
              maxLength={NAME_MAX}
              className="bg-white rounded-xl px-4 py-3 text-sm text-[#1A1A1A] border border-[#E8E8E8]"
            />
          </View>

          {/* Phone */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-[#1A1A1A] mb-2">เบอร์โทรศัพท์</Text>
            <TextInput
              value={phone}
              onChangeText={(t) => setPhone(sanitizePhone(t))}
              keyboardType="number-pad"
              maxLength={PHONE_MAX}
              className="bg-white rounded-xl px-4 py-3 text-sm text-[#1A1A1A] border border-[#E8E8E8]"
            />
          </View>

          {/* House group (multi-select) */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-[#1A1A1A] mb-2">กลุ่มบ้านที่ดูแล</Text>
            <View className="flex-row flex-wrap">
              {HOUSES.map((h) => {
                const selected = houses.includes(h);
                return (
                  <TouchableOpacity
                    key={h}
                    activeOpacity={0.7}
                    onPress={() => toggleHouse(h)}
                    className={`flex-row items-center border rounded-full px-3 py-2 mr-2 mb-2 ${
                      selected
                        ? "border-[#FF3055] bg-[#FFE5E8]"
                        : "border-[#E8E8E8] bg-white"
                    }`}
                  >
                    <View
                      className={`w-4 h-4 rounded-sm mr-2 items-center justify-center ${
                        selected
                          ? "bg-[#FF3055]"
                          : "border border-[#BBBBBB] bg-white"
                      }`}
                    >
                      {selected && (
                        <Ionicons name="checkmark" size={12} color="#FFFFFF" />
                      )}
                    </View>
                    <Text className="text-sm text-[#1A1A1A]">{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text className="text-xs text-[#888] mt-1">
              เลือกกลุ่มบ้านที่ใช้อยากให้คนนี้ได้รับการแจ้งเตือนเมื่อตรวจพบการล้ม
            </Text>
          </View>
        </ScrollView>

        {/* Bottom buttons */}
        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goBack}
            disabled={!canSave}
            className={`rounded-full py-4 items-center ${
              canSave ? "bg-[#FF3055]" : "bg-[#C56E76]"
            }`}
          >
            <Text className="text-base font-semibold text-white">บันทึก</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={goBack}
            className="rounded-full py-4 items-center mt-3 bg-white border border-[#FF3055]"
          >
            <Text className="text-base font-semibold text-[#FF3055]">ลบ</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}
