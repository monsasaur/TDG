import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import PageHeader from "../components/PageHeader";
import HouseCodeBox from "../components/HouseCodeBox";
import CountdownTimer from "../components/CountdownTimer";
import InlineError from "../components/InlineError";
import { useHouseInvite } from "../data/houseInvites";

/** เจ้าของบ้านสร้างรหัสเชิญ 6 ตัว — อีกฝ่ายกรอกที่หน้า enter-code */
export default function InviteCodeScreen() {
  const router = useRouter();
  const { houseId, house } = useLocalSearchParams<{ houseId?: string; house?: string }>();
  const { invite, error, loading, version, refresh } = useHouseInvite(houseId || undefined);
  const [expired, setExpired] = useState(false);

  // ได้รหัสใหม่ → ยังไม่หมดอายุ
  useEffect(() => {
    setExpired(false);
  }, [version]);
  const handleExpire = useCallback(() => setExpired(true), []);

  const minutes = invite ? Math.max(1, Math.round(invite.seconds / 60)) : null;

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="รหัสบ้าน" onBack={() => router.back()} />

      <View className="px-5 mt-8">
        {error ? (
          <InlineError message={error} onRetry={refresh} />
        ) : (
          <>
            <Text className="text-sm text-[#1A1A1A] leading-5">
              {minutes ? `รหัสบ้านนี้ใช้ได้ ${minutes} นาที และใช้ได้ครั้งเดียว` : "กำลังสร้างรหัส..."}
              {"\n"}กรอกรหัสด้วยแอป Middle เพื่อเข้าร่วม{house ? `บ้าน ${house}` : "บ้าน"} รหัสในการเชิญคือ:
            </Text>

            <View className="mt-6">
              <HouseCodeBox code={invite?.code ?? "• • • • • •"} expired={expired || loading} />
            </View>

            <View className="mt-4 items-center">
              {loading || !invite ? (
                <ActivityIndicator color="#1A1A1A" />
              ) : (
                <CountdownTimer
                  seconds={invite.seconds}
                  resetKey={version}
                  onRefresh={refresh}
                  onExpire={handleExpire}
                />
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
}
