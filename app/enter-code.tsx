import { useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";
import { V2, V2C } from "../components/designVersion";
import { useAlerts } from "../contexts/AlertsContext";
import { useDevices } from "../contexts/DevicesContext";
import { joinHouse, normalizeInviteCode } from "../data/houseInvites";
import { notifyHousesChanged } from "../data/useHouses";
import { safeBack } from "../lib/navigation";

/** รหัสเชิญมี 6 ตัว และ create_house_invite() ไม่ใช้ I O 0 1 (กันอ่านผิด) */
const CODE_LENGTH = 6;
const ALLOWED = /[^A-HJ-NP-Z2-9]/g;

/**
 * เข้าร่วมบ้านด้วยรหัสเชิญ 6 ตัวที่เจ้าของบ้านสร้างจากหน้า invite-code
 * หน้าตาแนวเดียวกับหน้ายืนยัน OTP — ช่องแยกทีละตัว แต่เป็นกรอบสี่เหลี่ยมและรับตัวอักษรด้วย
 */
export default function EnterCodeScreen() {
  const router = useRouter();
  const { refresh: refreshAlerts } = useAlerts();
  const { refresh: refreshDevices } = useDevices();
  const inputRef = useRef<TextInput>(null);

  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  /** ชื่อบ้านที่เพิ่งเข้าร่วม · "" = เข้าร่วมแล้วแต่อ่านชื่อไม่ได้ · null = ยังไม่ได้เข้าร่วม */
  const [joined, setJoined] = useState<string | null>(null);

  const filled = code.length === CODE_LENGTH;

  const onChange = (t: string) => {
    setCode(normalizeInviteCode(t).replace(ALLOWED, "").slice(0, CODE_LENGTH));
    if (error) setError("");
  };

  const handleSubmit = async () => {
    if (busy) return;
    if (!filled) {
      setError(`กรอกรหัสให้ครบ ${CODE_LENGTH} ตัว`);
      return;
    }
    setBusy(true);
    const res = await joinHouse(code);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      return;
    }
    // บ้านที่มองเห็นเปลี่ยน (บัญชีเดิม) — ดึงรายการบ้าน อุปกรณ์ และการแจ้งเตือนใหม่ทันที
    notifyHousesChanged();
    void refreshDevices();
    void refreshAlerts();
    setJoined(res.houseName ?? "");
  };

  const closeJoined = () => {
    setJoined(null);
    safeBack(router);
  };

  const textMain = V2 ? "text-[#292A32]" : "text-ink";
  const textSub = V2 ? "text-[#858891]" : "text-sub";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className={`flex-1 ${V2 ? V2C.page : "bg-page"}`}
    >
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="กรอกรหัสบ้าน" onBack={() => safeBack(router)} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        <Text className={`text-base ${textSub} leading-6`}>กรอกรหัสเชิญ {CODE_LENGTH} ตัวจากเจ้าของบ้าน</Text>
        <Text className={`text-sm ${textSub} mt-2`}>รหัสใช้ได้ครั้งเดียว และหมดอายุใน 15 นาที</Text>

        {/* ช่องกรอกจริงซ่อนอยู่ใต้กรอบ — แตะตรงไหนของแถวก็พิมพ์ได้ */}
        <Pressable onPress={() => inputRef.current?.focus()} className="mt-8">
          <View className="flex-row justify-center">
            {Array.from({ length: CODE_LENGTH }).map((_, i) => {
              const active = i === Math.min(code.length, CODE_LENGTH - 1);
              return (
                <View
                  key={i}
                  className={`w-12 h-14 mx-1 rounded-xl items-center justify-center border ${
                    error
                      ? "border-[#DC2626] bg-white"
                      : active
                        ? "border-[#292A32] bg-white"
                        : "border-[#E5E6E9] bg-white"
                  }`}
                >
                  <Text className={`text-xl font-semibold ${textMain}`}>{code[i] ?? " "}</Text>
                </View>
              );
            })}
          </View>

          <TextInput
            ref={inputRef}
            value={code}
            onChangeText={onChange}
            autoCapitalize="characters"
            autoCorrect={false}
            autoFocus
            caretHidden
            maxLength={CODE_LENGTH}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
            accessibilityLabel={`รหัสบ้าน ${CODE_LENGTH} ตัว`}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: 0 }}
          />
        </Pressable>

        {error ? (
          <Text className="text-sm text-[#DC2626] text-center mt-4 leading-5" accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}

        <TouchableOpacity
          className={`h-[54px] rounded-2xl justify-center items-center mt-8 ${
            busy || !filled ? V2C.darkDisabled : V2C.dark
          }`}
          onPress={handleSubmit}
          disabled={busy}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Text className="text-base font-semibold text-white">{busy ? "กำลังตรวจรหัส..." : "เข้าร่วมบ้าน"}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="flex-row items-center justify-center mt-6"
          onPress={() => router.replace("/scan-qr" as never)}
          hitSlop={10}
          disabled={busy}
        >
          <Ionicons name="qr-code-outline" size={16} color={V2 ? "#292A32" : "#292A32"} />
          <Text className={`text-sm font-semibold ${textMain} underline ml-2`}>สแกน QR Code แทน</Text>
        </TouchableOpacity>
      </ScrollView>

      <ConfirmModal
        visible={joined !== null}
        onClose={closeJoined}
        title="เข้าร่วมบ้านแล้ว"
        message={
          joined
            ? `ตอนนี้คุณเห็นการแจ้งเตือนและอุปกรณ์ของบ้าน ${joined} แล้ว`
            : "ตอนนี้คุณเห็นการแจ้งเตือนและอุปกรณ์ของบ้านนี้แล้ว"
        }
      />
    </KeyboardAvoidingView>
  );
}
