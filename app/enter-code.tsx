import { useState } from "react";
import { View } from "react-native";
import { useRouter, Stack } from "expo-router";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import PrimaryButton from "../components/PrimaryButton";
import ConfirmModal from "../components/ConfirmModal";
import { useAlerts } from "../contexts/AlertsContext";
import { useDevices } from "../contexts/DevicesContext";
import { joinHouse, normalizeInviteCode } from "../data/houseInvites";

/** เข้าร่วมบ้านด้วยรหัสเชิญ 6 ตัวที่เจ้าของบ้านสร้างจากหน้า invite-code */
export default function EnterCodeScreen() {
  const router = useRouter();
  const { refresh: refreshAlerts } = useAlerts();
  const { refresh: refreshDevices } = useDevices();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  /** ชื่อบ้านที่เพิ่งเข้าร่วม · "" = เข้าร่วมแล้วแต่อ่านชื่อไม่ได้ · null = ยังไม่ได้เข้าร่วม */
  const [joined, setJoined] = useState<string | null>(null);

  const canSubmit = normalizeInviteCode(code).length > 0 && !busy;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    const res = await joinHouse(code);
    setBusy(false);
    if (!res.ok) {
      setErrorMessage(res.message);
      return;
    }
    // บ้านที่มองเห็นเปลี่ยน (บัญชีเดิม) — ดึงอุปกรณ์และการแจ้งเตือนใหม่ทันที
    void refreshDevices();
    void refreshAlerts();
    setJoined(res.houseName ?? "");
  };

  const closeJoined = () => {
    setJoined(null);
    router.back();
  };

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="กรอกรหัสบ้าน" onBack={() => router.back()} />

      <View className="flex-1">
        <LabeledTextField
          label="คำเชิญรหัสบ้าน"
          value={code}
          onChangeText={setCode}
          placeholder="รหัส 6 ตัว เช่น K7QX2M"
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={12}
          returnKeyType="go"
          onSubmitEditing={handleSubmit}
        />
      </View>

      <View className="px-5 pb-8">
        <PrimaryButton
          label={busy ? "กำลังตรวจรหัส..." : "ส่ง"}
          onPress={handleSubmit}
          disabled={!canSubmit}
        />
      </View>

      <ConfirmModal
        visible={errorMessage !== null}
        onClose={() => setErrorMessage(null)}
        title="เข้าร่วมบ้านไม่ได้"
        message={errorMessage ?? ""}
      />

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
    </View>
  );
}
