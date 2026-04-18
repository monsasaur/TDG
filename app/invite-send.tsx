import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PageHeader from "../components/PageHeader";
import ConfirmModal from "../components/ConfirmModal";

export default function InviteSendScreen() {
  const router = useRouter();
  const { house } = useLocalSearchParams<{ house?: string }>();

  const [modal, setModal] = useState<"qr" | "code" | null>(null);

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ส่งคำเชิญ" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 mt-5">
          <InviteOption label="QR Code" onPress={() => setModal("qr")} />
          <InviteOption label="รหัสบ้าน" onPress={() => setModal("code")} />
        </View>
      </ScrollView>

      <ConfirmModal
        visible={modal === "qr"}
        onClose={() => setModal(null)}
        title="QR Code"
        message={`เชิญเข้า${house ?? "บ้าน"} ผ่าน QR Code`}
      />
      <ConfirmModal
        visible={modal === "code"}
        onClose={() => setModal(null)}
        title="รหัสบ้าน"
        message={`เชิญเข้า${house ?? "บ้าน"} ด้วยรหัสบ้าน`}
      />
    </View>
  );
}

function InviteOption({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      className="bg-white rounded-2xl px-4 py-4 mb-3 flex-row items-center justify-between"
    >
      <Text className="text-sm text-[#1A1A1A]">{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#AAAAAA" />
    </TouchableOpacity>
  );
}
