import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface ContactCardTag {
  label: string;
  active: boolean;
}

interface ContactCardProps {
  name: string;
  phone: string;
  tags?: ContactCardTag[];
  onPress?: () => void;
  showChevron?: boolean;
  className?: string;
  /** แสดงป้ายบ้านได้สูงสุดกี่อัน ที่เหลือรวบเป็น "+N" (อยู่หลายบ้านแล้วป้ายล้นการ์ด) */
  maxTags?: number;
}

export default function ContactCard({
  name,
  phone,
  tags = [],
  onPress,
  showChevron,
  className = "bg-white mx-5 mb-2 rounded-2xl px-4 py-3 flex-row items-center",
  maxTags = 3,
}: ContactCardProps) {
  const initial = name.trim().charAt(0);
  // ป้ายของบ้านที่กำลังกรองอยู่ (active) ได้ขึ้นก่อนเสมอ ที่เหลือรวบเป็น "+N"
  const sorted = [...tags].sort((a, b) => Number(b.active) - Number(a.active));
  const shown = sorted.slice(0, maxTags);
  const hidden = sorted.length - shown.length;
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      className={className}
    >
      <View className="w-10 h-10 rounded-full bg-brand-soft items-center justify-center mr-3">
        <Text className="text-base font-semibold text-brand-strong">{initial}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-ink">{name}</Text>
        <Text className="text-xs text-sub mb-1">{phone}</Text>
        {shown.length > 0 && (
          <View className="flex-row flex-wrap items-center">
            {shown.map((t) => (
              <View
                key={t.label}
                className={`rounded-md px-2 py-0.5 mr-1 mb-1 max-w-[150px] ${
                  t.active ? "bg-brand-soft" : "bg-[#EEEEEE]"
                }`}
              >
                <Text
                  className={`text-[10px] ${t.active ? "text-brand-strong" : "text-sub"}`}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </View>
            ))}
            {hidden > 0 && (
              <View className="rounded-md px-2 py-0.5 mr-1 mb-1 bg-[#EEEEEE]">
                <Text className="text-[10px] text-sub">+{hidden}</Text>
              </View>
            )}
          </View>
        )}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color="#AAAAAA" />
      )}
    </TouchableOpacity>
  );
}
