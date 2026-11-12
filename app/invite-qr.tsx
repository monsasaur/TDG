import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import PageHeader from "../components/PageHeader";
import CountdownTimer from "../components/CountdownTimer";
import InlineError from "../components/InlineError";
import { INVITE_QR_PREFIX, useHouseInvite } from "../data/houseInvites";

const QR_SIZE = 220;

/**
 * เจ้าของบ้านเปิด QR ให้อีกฝ่ายสแกนด้วยหน้า scan-qr — ใช้รหัสเชิญตัวเดียวกับหน้า invite-code
 * ใน QR คือ "MIDDLE-HOUSE:<รหัส>" (ดู parseInviteQr ใน data/houseInvites.ts)
 */
export default function InviteQrScreen() {
  const router = useRouter();
  const { houseId, house } = useLocalSearchParams<{ houseId?: string; house?: string }>();
  const { invite, error, loading, version, refresh } = useHouseInvite(houseId || undefined);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setExpired(false);
  }, [version]);
  const handleExpire = useCallback(() => setExpired(true), []);

  const minutes = invite ? Math.max(1, Math.round(invite.seconds / 60)) : null;
  // หมดอายุแล้วซ่อน QR ไปเลย กันคนสแกนรหัสที่ใช้ไม่ได้แล้ว
  const qrValue = invite && !loading && !expired ? `${INVITE_QR_PREFIX}${invite.code}` : null;

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ใช้ QR Code" onBack={() => router.back()} />

      <View className="items-center mt-10 px-8">
        {error ? (
          <View className="self-stretch">
            <InlineError message={error} onRetry={refresh} />
          </View>
        ) : (
          <>
            <Text className="text-sm text-[#1A1A1A] text-center leading-5">
              {minutes ? `รหัส QR นี้ใช้ได้ ${minutes} นาที และใช้ได้ครั้งเดียว` : "กำลังสร้างรหัส..."}
              {"\n"}สแกนด้วยแอป Middle เพื่อเข้าร่วม{house ? `บ้าน ${house}` : "บ้าน"}
            </Text>

            <View
              style={{ width: QR_SIZE + 24, height: QR_SIZE + 24 }}
              className={`mt-8 rounded-md items-center justify-center ${qrValue ? "bg-white" : "bg-[#E5E5E5]"}`}
            >
              {qrValue ? (
                <QRCode value={qrValue} size={QR_SIZE} />
              ) : loading ? (
                <ActivityIndicator color="#1A1A1A" />
              ) : (
                <Text className="text-sm text-[#888888]">หมดอายุแล้ว กดรีเฟรชเพื่อสร้างใหม่</Text>
              )}
            </View>

            {invite && !loading ? (
              <>
                <Text className="text-xs text-[#888888] mt-4">
                  สแกนไม่ได้? ให้กรอกรหัส{" "}
                  <Text className="font-semibold text-[#1A1A1A] tracking-widest">{invite.code}</Text>
                </Text>
                <View className="mt-4">
                  <CountdownTimer
                    seconds={invite.seconds}
                    resetKey={version}
                    onRefresh={refresh}
                    onExpire={handleExpire}
                  />
                </View>
              </>
            ) : null}
          </>
        )}
      </View>
    </View>
  );
}
