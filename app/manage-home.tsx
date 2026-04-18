import { View } from "react-native";
import { useRouter, Stack } from "expo-router";
import SettingItem from "../components/SettingItem";
import PageHeader from "../components/PageHeader";

export default function ManageHomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />

      <PageHeader title="จัดการบ้าน" onBack={() => router.back()} />

      <View className="mt-4">
        <SettingItem
          icon="add-circle-outline"
          label="อุปกรณ์"
          onPress={() => router.push("/devices" as never)}
        />
        <SettingItem
          icon="person-add-outline"
          label="สมาชิก"
          onPress={() => router.push("/members" as never)}
        />
        <SettingItem
          icon="home-outline"
          label="บ้าน"
          onPress={() => {}}
        />
      </View>
    </View>
  );
}
