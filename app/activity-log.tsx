import { useCallback, useMemo } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { describeAudit, useAuditLog } from "../data/useAuditLog";
import { useHouseMembers } from "../data/useHouseMembers";
import { useHouses } from "../data/useHouses";
import { parseTimestamp } from "../lib/time";

/** 13/11/2569 09:05 — พ.ศ. แบบที่ใช้ในแอป */
function formatWhen(iso: string): string {
  const d = new Date(parseTimestamp(iso));
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear() + 543} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * ประวัติการเปลี่ยนแปลง (audit log) — ใครทำอะไรเมื่อไร
 * เห็นสิ่งที่ตัวเองทำ + ทุกอย่างในบ้านที่ตัวเองเป็นเจ้าของ (RLS ใน supabase/accounts.sql)
 */
export default function ActivityLogScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { entries, unavailable, isLoading } = useAuditLog(user?.id);
  const { members } = useHouseMembers(user?.id);
  const { houses } = useHouses();

  const houseName = useMemo(() => new Map(houses.map((h) => [h.id, h.name])), [houses]);
  const nameOf = useCallback(
    (id: string) => {
      const m = members?.find((x) => x.userId === id);
      if (!m) return "สมาชิกเดิม";
      return m.isMe ? "คุณ" : m.name;
    },
    [members],
  );
  const rows = useMemo(
    () =>
      entries
        .map((e) => ({ e, text: describeAudit(e, nameOf) }))
        .filter((r): r is { e: (typeof entries)[number]; text: string } => !!r.text),
    [entries, nameOf],
  );

  return (
    <View className="flex-1 bg-[#F2F2F2]">
      <Stack.Screen options={{ animation: "slide_from_right" }} />
      <PageHeader title="ประวัติการเปลี่ยนแปลง" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xs text-[#888888] px-5 mt-4 mb-2 leading-[18px]">
          สิ่งที่คุณทำ และทุกอย่างในบ้านที่คุณเป็นเจ้าของ (100 รายการล่าสุด) · ระบบบันทึกเอง แก้ไขหรือลบไม่ได้
        </Text>

        {isLoading ? (
          <ActivityIndicator className="my-10" color="#000" />
        ) : unavailable ? (
          <Text className="text-sm text-[#888888] text-center px-8 my-10 leading-5">
            ระบบบันทึกประวัติยังไม่เปิดใช้{"\n"}จะเริ่มบันทึกเมื่อเปิดระบบบัญชีผู้ใช้บนฐานข้อมูล
          </Text>
        ) : rows.length === 0 ? (
          <Text className="text-sm text-[#888888] text-center my-10">ยังไม่มีประวัติ</Text>
        ) : (
          rows.map(({ e, text }) => {
            const where = e.house_ids.map((id) => houseName.get(id)).filter(Boolean).join(", ");
            return (
              <View key={e.id} className="bg-white rounded-2xl mx-5 mb-2 px-4 py-3">
                <Text className="text-sm text-[#1A1A1A] leading-5">{text}</Text>
                <Text className="text-xs text-[#888888] mt-1">
                  {formatWhen(e.at)}
                  {where ? ` · ${where}` : ""}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
