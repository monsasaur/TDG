import { ReactNode } from "react";
import { Text, View } from "react-native";

/** หัวหน้าจอของแท็บหลัก ดีไซน์ v2 — ชื่อหน้าตัวใหญ่ชิดซ้าย ไม่มีปุ่มย้อนกลับ · ใส่ปุ่มทางขวาได้ */
export default function TabHeader({
  title,
  right,
  children,
  bordered,
}: {
  title: string;
  right?: ReactNode;
  children?: ReactNode;
  /** เส้นคั่นใต้หัว — ใช้เมื่อไม่มีแถบแท็บต่อด้านล่าง */
  bordered?: boolean;
}) {
  return (
    <View className={`bg-white px-5 pt-16 pb-3 ${bordered ? "border-b border-[#E5E6E9]" : ""}`}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[26px] font-bold text-[#292A32]">{title}</Text>
        {right}
      </View>
      {children}
    </View>
  );
}
