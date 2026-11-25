import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * การ์ดตัวเลือกดีไซน์ v2 — ไอคอน · หัวข้อ · คำอธิบาย · ลูกศร · กดได้ทั้งการ์ด มี pressed state
 * ใช้ในหน้าเริ่มต้นใช้งาน และเมนูหน้าตั้งค่า / โปรไฟล์
 */
interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  onPress: () => void;
  /** สีของหัวข้อและไอคอน — ใช้สีแดงกับการกระทำอย่างออกจากระบบ */
  tone?: "default" | "danger";
  /** พื้นการ์ด — เทาอ่อนบนหน้าขาว (ค่าเริ่มต้น) หรือขาวบนหน้าเทา */
  surface?: "muted" | "white";
  chevron?: boolean;
}

export default function ActionCard({ icon, title, description, onPress, tone = "default", surface = "muted", chevron = true }: Props) {
  const color = tone === "danger" ? "#DC2626" : "#292A32";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={description ? `${title} ${description}` : title}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}
      className={`flex-row items-center rounded-2xl px-4 py-4 mb-3 min-h-[64px] ${
        surface === "white" ? "bg-white" : "bg-[#F7F7F8]"
      }`}
    >
      <Ionicons name={icon} size={24} color={color} />
      <View className="flex-1 ml-4">
        <Text style={{ color }} className="text-base font-semibold">
          {title}
        </Text>
        {description ? <Text className="text-xs text-[#858891] mt-0.5 leading-[18px]">{description}</Text> : null}
      </View>
      {chevron && <Ionicons name="chevron-forward" size={20} color="#858891" />}
    </Pressable>
  );
}
