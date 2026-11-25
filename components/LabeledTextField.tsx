import { View, Text, TextInput, TextInputProps } from "react-native";

interface LabeledTextFieldProps extends TextInputProps {
  label: string;
  containerClassName?: string;
  error?: string;
  readOnly?: boolean;
}

export default function LabeledTextField({
  label,
  containerClassName = "px-5 mt-4",
  error,
  readOnly,
  editable,
  ...inputProps
}: LabeledTextFieldProps) {
  const borderClass = error
    ? "border-danger"
    : readOnly
    ? "border-brand-line"
    : "border-[#E8E8E8]";
  const bgClass = readOnly ? "bg-[#F5F5F5]" : "bg-white";
  const textColor = readOnly ? "text-sub" : "text-ink";

  return (
    <View className={containerClassName}>
      <Text className="text-sm text-ink mb-2">{label}</Text>
      <TextInput
        {...inputProps}
        editable={readOnly ? false : editable}
        className={`${bgClass} rounded-xl px-4 py-3 text-sm ${textColor} border ${borderClass}`}
      />
      {error && (
        <Text className="text-xs text-danger mt-1 ml-1">{error}</Text>
      )}
    </View>
  );
}
