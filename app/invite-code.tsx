import { useCallback, useState } from "react";
import { View, Text } from "react-native";
import { useRouter, Stack } from "expo-router";
import PageHeader from "../components/PageHeader";
import HouseCodeBox from "../components/HouseCodeBox";
import CountdownTimer from "../components/CountdownTimer";

const EXPIRY_SECONDS = 180;

function generateCode() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `XXX${n}`;
}

export default function InviteCodeScreen() {
  const router = useRouter();
  const [resetKey, setResetKey] = useState(0);
  const [expired, setExpired] = useState(false);
  const [code, setCode] = useState(generateCode);

  const handleRefresh = useCallback(() => {
    setCode(generateCode());
    setExpired(false);
    setResetKey((k) => k + 1);
  }, []);

  const handleExpire = useCallback(() => setExpired(true), []);

  return (
    <View className="flex-1 bg-[#F5F5F5]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="รหัสบ้าน" onBack={() => router.back()} />

      <View className="px-5 mt-8">
        <Text className="text-sm text-[#1A1A1A] leading-5">
          รหัสบ้านนี้ใช้ได้ 3 นาที
          {"\n"}กรอกรหัสด้วยแอป Middle เพิ่มเข้าร่วมบ้าน รหัสในการเชิญคือ:
        </Text>

        <View className="mt-6">
          <HouseCodeBox code={code} expired={expired} />
        </View>

        <View className="mt-4 items-center">
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
