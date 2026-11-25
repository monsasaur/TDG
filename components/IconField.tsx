import { useState } from "react";
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

/**
 * ช่องกรอกดีไซน์ v2 — กล่องขาวขอบเทาอ่อน มีไอคอนด้านซ้าย · ช่องรหัสผ่านมีปุ่มรูปตา
 * ใช้ในหน้าเข้าสู่ระบบ (DESIGN = "v2" ใน components/designVersion.ts)
 */
interface Props extends TextInputProps {
  icon: keyof typeof Ionicons.glyphMap;
  error?: string;
  secure?: boolean;
}

export default function IconField({ icon, error, secure, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(true);
  return (
    <View>
      <View
        className={`flex-row items-center bg-white border rounded-2xl h-[54px] px-4 ${
          error ? "border-[#DC2626]" : "border-[#E5E6E9]"
        }`}
      >
        <Ionicons name={icon} size={20} color="#4B5563" />
        <TextInput
          placeholderTextColor="#9CA3AF"
          {...inputProps}
          {...(secure ? { secureTextEntry: hidden, autoCapitalize: "none" as const, autoCorrect: false } : null)}
          className="flex-1 text-base text-[#292A32] px-3 h-full"
        />
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
      {error ? <Text className="text-xs text-[#DC2626] mt-1.5 ml-1">{error}</Text> : null}
    </View>
  );
}
