import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useRouter, Stack } from "expo-router";
import PageHeader from "../components/PageHeader";
import QrCodePlaceholder from "../components/QrCodePlaceholder";
import CountdownTimer from "../components/CountdownTimer";

const EXPIRY_SECONDS = 180;

export default function InviteQrScreen() {
  const router = useRouter();
  const [resetKey, setResetKey] = useState(0);
  const [expired, setExpired] = useState(false);

  const handleRefresh = useCallback(() => {
    setExpired(false);
    setResetKey((k) => k + 1);
  }, []);

  const handleExpire = useCallback(() => setExpired(true), []);

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ใช้ QR Code" onBack={() => router.back()} />

      <View className="items-center mt-10 px-8">
        <Text className="text-sm text-[#1A1A1A] text-center leading-5">
          รหัส QR นี้ใช้ได้ 3 นาที
          {"\n"}สแกนด้วยแอป Middle เพิ่มเข้าร่วมบ้าน
        </Text>

        <View className="mt-8">
          <QrCodePlaceholder expired={expired} />
        </View>

        <View className="mt-6">
          <CountdownTimer
            seconds={EXPIRY_SECONDS}
            resetKey={resetKey}
            onRefresh={handleRefresh}
            onExpire={handleExpire}
          />
        </View>
      </View>
    </View>
  );
}
