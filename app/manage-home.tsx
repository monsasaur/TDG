import { Stack, useRouter } from "expo-router";
import { View } from "react-native";
import PageHeader from "../components/PageHeader";
import SettingItem from "../components/SettingItem";

export default function ManageHomeScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="จัดการบ้าน" onBack={() => router.back()} />

      <View className="mt-2">
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
          onPress={() => router.push("/houses" as never)}
        />
      </View>
    </View>
  );
}
