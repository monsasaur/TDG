import { Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { V2C } from "./designVersion";

/**
 * Empty state ดีไซน์ v2 — ภาพประกอบสีเทา · หัวข้อ · คำอธิบาย · ปุ่ม CTA (ไม่ใส่ก็ได้)
 * ใช้ทั้งกรณียังไม่มีบ้าน และไม่มีการแจ้งเตือน
 */
interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  /** ไอคอนวงกลมเข้มที่มุมขวาล่างของภาพ */
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaIcon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  /** ภาพเล็กลง — ใช้ในพื้นที่แคบ เช่นแท็บที่ไม่มีรายการ */
  compact?: boolean;
}

export default function EmptyState({ icon, badgeIcon, title, description, ctaLabel, ctaIcon, onPress, compact }: Props) {
  const size = compact ? 64 : 96;
  return (
    <View className={`items-center px-8 ${compact ? "pt-12" : "pt-16"}`}>
      <View style={{ width: size + 24, height: size + 14 }} className="items-center justify-center">
        <Ionicons name={icon} size={size} color="#D1D5DB" />
        {badgeIcon && (
          <View className="absolute right-0 bottom-1 w-10 h-10 rounded-full bg-[#292A32] items-center justify-center border-[3px] border-[#F2F3F5]">
            <Ionicons name={badgeIcon} size={18} color="#FFFFFF" />
          </View>
        )}
      </View>
      <Text className={`${compact ? "text-base" : "text-lg"} font-bold text-[#292A32] mt-5 text-center`}>{title}</Text>
      {description ? (
        <Text className="text-sm text-[#858891] text-center leading-[22px] mt-1.5">{description}</Text>
      ) : null}
      {ctaLabel && onPress ? (
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.85}
          accessibilityRole="button"
          className={`mt-6 h-[52px] px-10 rounded-2xl ${V2C.dark} flex-row items-center justify-center`}
        >
          {ctaIcon && <Ionicons name={ctaIcon} size={20} color="#FFFFFF" />}
          <Text className={`text-base font-semibold text-white ${ctaIcon ? "ml-1.5" : ""}`}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
