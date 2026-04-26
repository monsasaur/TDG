import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import PageHeader from "../components/PageHeader";

export default function InviteSendScreen() {
  const router = useRouter();
  const { house } = useLocalSearchParams<{ house?: string }>();

  const go = (path: "/invite-qr" | "/invite-code") => {
    const query = house ? `?house=${encodeURIComponent(house)}` : "";
    router.push(`${path}${query}` as never);
  };

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ส่งคำเชิญ" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 mt-5">
          <InviteOption label="QR Code" onPress={() => go("/invite-qr")} />
          <InviteOption label="รหัสบ้าน" onPress={() => go("/invite-code")} />
        </View>
      </ScrollView>
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
