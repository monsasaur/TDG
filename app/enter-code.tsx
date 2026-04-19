import { useState } from "react";
import { View } from "react-native";
import { useRouter, Stack } from "expo-router";
import PageHeader from "../components/PageHeader";
import LabeledTextField from "../components/LabeledTextField";
import PrimaryButton from "../components/PrimaryButton";
import ConfirmModal from "../components/ConfirmModal";

export default function EnterCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [errorModal, setErrorModal] = useState(false);

  const canSubmit = code.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setErrorModal(true);
  };

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="กรอกรหัสบ้าน" onBack={() => router.back()} />

      <View className="flex-1">
        <LabeledTextField
          label="คำเชิญรหัสบ้าน"
          value={code}
          onChangeText={setCode}
          autoFocus
          autoCapitalize="characters"
        />
      </View>

      <View className="px-5 pb-8">
        <PrimaryButton
          label="ส่ง"
          onPress={handleSubmit}
          disabled={!canSubmit}
        />
      </View>

      <ConfirmModal
        visible={errorModal}
        onClose={() => setErrorModal(false)}
        title="เข้าร่วมบ้านไม่ได้"
        message="รหัสบ้านไม่ถูกต้อง ลองใช้รหัสบ้านอื่นหรือเพิ่มด้วยวิธีอื่น"
      />
    </View>
  );
}
