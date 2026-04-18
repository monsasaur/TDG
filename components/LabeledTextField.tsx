import { View, Text, TextInput, TextInputProps } from "react-native";

interface LabeledTextFieldProps extends TextInputProps {
  label: string;
  containerClassName?: string;
}

export default function LabeledTextField({
  label,
  containerClassName = "px-5 mt-4",
  ...inputProps
}: LabeledTextFieldProps) {
  return (
    <View className={containerClassName}>
      <Text className="text-sm text-[#1A1A1A] mb-2">{label}</Text>
      <TextInput
        {...inputProps}
        className="bg-white rounded-xl px-4 py-3 text-sm text-[#1A1A1A] border border-[#E8E8E8]"
      />
    </View>
  );
}
