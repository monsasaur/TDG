import { useState } from "react";
import { View, Text, TextInput, TextInputProps } from "react-native";

export type StackedInputCardField = {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoFocus?: boolean;
};

interface StackedInputCardProps {
  fields: StackedInputCardField[];
  error?: string;
  className?: string;
}

export default function StackedInputCard({
  fields,
  error,
  className = "px-5",
}: StackedInputCardProps) {
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const borderClass = error ? "border-danger" : "border-[#E8E8E8]";

  return (
    <View className={className}>
      <View className={`bg-white rounded-2xl border ${borderClass} px-4`}>
        {fields.map((f, i) => {
          const isFocused = focusedIndex === i;
          return (
            <View key={f.label} className="pt-3 pb-2">
              <Text className="text-xs text-sub mb-1">{f.label}</Text>
              <TextInput
                value={f.value}
                onChangeText={f.onChangeText}
                secureTextEntry={f.secureTextEntry}
                autoCapitalize={f.autoCapitalize}
                autoFocus={f.autoFocus}
                onFocus={() => setFocusedIndex(i)}
                onBlur={() =>
                  setFocusedIndex((prev) => (prev === i ? null : prev))
                }
                className="text-sm text-ink py-0"
              />
              <View
                className={`h-[1px] mt-2 ${
                  isFocused ? "bg-ink" : "bg-[#E8E8E8]"
                }`}
              />
            </View>
          );
        })}
      </View>
      {error && (
        <Text className="text-xs text-danger mt-2 ml-4">{error}</Text>
      )}
    </View>
  );
}
