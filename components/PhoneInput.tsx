import { useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";

interface PhoneInputProps {
  value: string;
  error?: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
}

export default function PhoneInput({ value, error, onChangeText, onBlur, autoFocus }: PhoneInputProps) {
  const inputRef = useRef<TextInput>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <View>
      <Text className="text-sm font-semibold text-[#1A1A1A] mb-2">เบอร์โทรของฉัน</Text>
      <View
        className={`flex-row items-center border rounded-[28px] h-[52px] overflow-hidden ${
          error ? "border-[#FF3055]" : "border-[#E0D5D5]"
        }`}
      >
        <TouchableOpacity
          className="px-5 justify-center items-center"
          onPress={() => setDropdownOpen(!dropdownOpen)}
          activeOpacity={0.6}
        >
          <Text className="text-base text-[#1A1A1A] font-medium">+66</Text>
        </TouchableOpacity>
        <View className="w-px h-7 bg-[#E0D5D5]" />
        <TextInput
          ref={inputRef}
          className="flex-1 text-base text-[#1A1A1A] px-4 h-full"
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="number-pad"
          maxLength={10}
          autoFocus={autoFocus}
        />
      </View>

      {/* Country code dropdown */}
      {dropdownOpen && (
        <TouchableOpacity
          className="border border-[#E0D5D5] rounded-[16px] mt-1 px-5 py-3"
          onPress={() => setDropdownOpen(false)}
          activeOpacity={0.6}
        >
          <Text className="text-base text-[#1A1A1A] font-medium">+66</Text>
        </TouchableOpacity>
      )}

      {error ? <Text className="text-xs text-[#FF3055] mt-2 ml-1">{error}</Text> : null}
    </View>
  );
}
