import { useState } from "react";
import { Text, TextInput, TextInputProps, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./theme";

interface AuthFieldProps extends TextInputProps {
  label: string;
  error?: string;
  /** ข้อความเล็กใต้ช่อง (แสดงเมื่อไม่มี error) */
  hint?: string;
  /** ช่องรหัสผ่าน — ซ่อนตัวอักษร มีปุ่มรูปตาให้กดดู */
  secure?: boolean;
}

/** ช่องกรอกหน้าเข้าสู่ระบบ / สมัคร — หน้าตาเดียวกับ PhoneInput (ขอบมน 28 สูง 52) */
export default function AuthField({ label, error, hint, secure, ...inputProps }: AuthFieldProps) {
  const [hidden, setHidden] = useState(true);

  return (
    <View>
      <Text className="text-sm font-semibold text-ink mb-2">{label}</Text>
      <View
        className={`flex-row items-center border rounded-[28px] h-[52px] overflow-hidden ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <TextInput
          placeholderTextColor="#B8AFAF"
          {...inputProps}
          {...(secure
            ? { secureTextEntry: hidden, autoCapitalize: "none" as const, autoCorrect: false }
            : null)}
          className="flex-1 text-base text-ink px-5 h-full"
        />
        {secure && (
          <TouchableOpacity
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            className="px-4 h-full justify-center"
            accessibilityLabel={hidden ? "แสดงรหัสผ่าน" : "ซ่อนรหัสผ่าน"}
          >
            <Ionicons name={hidden ? "eye-off-outline" : "eye-outline"} size={20} color={C.sub} />
          </TouchableOpacity>
        )}
      </View>
      {error ? (
        <Text className="text-xs text-danger mt-2 ml-1">{error}</Text>
      ) : hint ? (
        <Text className="text-xs text-sub mt-2 ml-1 leading-[18px]">{hint}</Text>
      ) : null}
    </View>
  );
}
