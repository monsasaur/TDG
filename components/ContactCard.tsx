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
}

export default function ContactCard({
  name,
  phone,
  tags = [],
  onPress,
  showChevron,
  className = "bg-white mx-5 mb-2 rounded-2xl px-4 py-3 flex-row items-center",
}: ContactCardProps) {
  const initial = name.trim().charAt(0);
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
        {tags.length > 0 && (
          <View className="flex-row">
            {tags.map((t) => (
              <View
                key={t.label}
                className={`rounded-md px-2 py-0.5 mr-1 ${
                  t.active ? "bg-brand-soft" : "bg-[#EEEEEE]"
                }`}
              >
                <Text
                  className={`text-[10px] ${
                    t.active ? "text-brand-strong" : "text-sub"
                  }`}
                >
                  {t.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color="#AAAAAA" />
      )}
    </TouchableOpacity>
  );
}
