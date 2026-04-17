import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { mockContacts, MAX_EXTERNAL_PER_HOUSE } from "../data/mockContacts";

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

export default function AddExternalContactScreen() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [house, setHouse] = useState<string | null>(null);
  const [limitModal, setLimitModal] = useState<string | null>(null);

  const canSubmit =
    name.trim().length > 0 && phone.trim().length > 0 && house !== null;

  const externalCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const h of HOUSES) {
      map[h] = mockContacts.filter(
        (c) => c.type === "external" && c.houses.includes(h)
      ).length;
    }
    return map;
  }, []);

  const handleSubmit = () => {
    if (!canSubmit || !house) return;
    if (externalCounts[house] >= MAX_EXTERNAL_PER_HOUSE) {
      setLimitModal(house);
      return;
    }
    router.replace("/emergency-contacts" as never);
  };

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
            เพิ่มผู้ติดต่อฉุกเฉินภายนอก
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

          {/* House group */}
          <View className="px-5 mt-4">
            <Text className="text-sm text-[#1A1A1A] mb-2">กลุ่มบ้านที่ดูแล</Text>
            <View className="flex-row flex-wrap">
              {HOUSES.map((h) => {
                const selected = house === h;
                return (
                  <TouchableOpacity
                    key={h}
                    activeOpacity={0.7}
                    onPress={() => setHouse(h)}
                    className={`flex-row items-center border rounded-full px-3 py-2 mr-2 mb-2 ${
                      selected
                        ? "border-[#FF3055] bg-[#FFE5E8]"
                        : "border-[#E8E8E8] bg-white"
                    }`}
                  >
                    <View
                      className={`w-4 h-4 rounded-full border mr-2 items-center justify-center ${
                        selected ? "border-[#FF3055]" : "border-[#BBBBBB]"
                      }`}
                    >
                      {selected && (
                        <View className="w-2 h-2 rounded-full bg-[#FF3055]" />
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

        {/* Submit button */}
        <View className="px-5 pb-8">
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleSubmit}
            disabled={!canSubmit}
            className={`rounded-full py-4 items-center ${
              canSubmit ? "bg-[#FF3055]" : "bg-[#FFD4DC]"
            }`}
          >
            <Text
              className={`text-base font-semibold ${
                canSubmit ? "text-white" : "text-[#FFF6F8]"
              }`}
            >
              เพิ่มผู้ติดต่อ
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Limit modal */}
      <Modal
        transparent
        animationType="fade"
        visible={limitModal !== null}
        onRequestClose={() => setLimitModal(null)}
      >
        <TouchableWithoutFeedback onPress={() => setLimitModal(null)}>
          <View className="flex-1 bg-black/40 items-center justify-center px-10">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-2xl px-6 py-5 w-full">
                <Text className="text-base font-semibold text-[#1A1A1A] text-center mb-2">
                  มีเบอร์ติดต่อเยอะเกินไป
                </Text>
                <Text className="text-sm text-[#555] text-center leading-5">
                  {limitModal} มีจำนวนเบอร์ติดต่อฉุกเฉินครบจำนวนสูงสุดที่อนุญาตแล้ว
                  หากคุณต้องการเพิ่มเบอร์สมาชิกอื่น ให้นำเบอร์ติดต่อฉุกเฉินอื่นออกก่อน
                </Text>
                <TouchableOpacity
                  onPress={() => setLimitModal(null)}
                  className="mt-4 items-center"
                >
                  <Text className="text-sm font-semibold text-[#FF3055]">ปิด</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
