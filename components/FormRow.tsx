import { useState } from "react";
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * แถวในกล่องฟอร์มดีไซน์ v2 (หน้าสมัครใช้งาน) — ไอคอน · ป้ายเล็ก · ช่องกรอก · ปุ่มรูปตาสำหรับรหัสผ่าน
 * วางหลายแถวต่อกันในกล่องขาวเดียว แถวสุดท้ายส่ง last เพื่อไม่ขีดเส้นคั่น
 */
interface Props extends TextInputProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  error?: string;
  secure?: boolean;
  last?: boolean;
}

export default function FormRow({ icon, label, error, secure, last, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(true);
  return (
    <View className={`flex-row items-center px-4 py-3 ${last ? "" : "border-b border-[#F0F0F0]"}`}>
      <Ionicons name={icon} size={22} color="#292A32" />
      <View className="flex-1 ml-4">
        <Text className={`text-xs ${error ? "text-[#DC2626]" : "text-[#858891]"}`}>{error || label}</Text>
        <TextInput
          placeholderTextColor="#9CA3AF"
          {...inputProps}
          {...(secure ? { secureTextEntry: hidden, autoCapitalize: "none" as const, autoCorrect: false } : null)}
          className="text-base text-[#292A32] py-1"
        />
      </View>
      {secure && (
        <TouchableOpacity
          onPress={() => setHidden((h) => !h)}
          hitSlop={12}
          accessibilityLabel={hidden ? "แสดงรหัสผ่าน" : "ซ่อนรหัสผ่าน"}
        >
          <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color="#858891" />
        </TouchableOpacity>
      )}
    </View>
  );
}
