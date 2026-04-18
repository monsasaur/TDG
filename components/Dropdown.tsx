import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface DropdownProps {
  label?: string;
  placeholder?: string;
  options: string[];
  value?: string;
  onChange: (value: string) => void;
  containerClassName?: string;
  disabled?: boolean;
}

export default function Dropdown({
  label,
  placeholder = "-- เลือก --",
  options,
  value,
  onChange,
  containerClassName = "px-5 mt-4",
  disabled,
}: DropdownProps) {
  const [open, setOpen] = useState(false);

  const displayText = value || placeholder;
  const isPlaceholder = !value;

  return (
    <View className={containerClassName}>
      {label && <Text className="text-sm text-[#1A1A1A] mb-2">{label}</Text>}
      <TouchableOpacity
        activeOpacity={0.7}
        disabled={disabled}
        onPress={() => setOpen(true)}
        className="bg-white rounded-xl px-4 py-3 border border-[#E8E8E8] flex-row items-center justify-between"
      >
        <Text
          className={`text-sm ${
            isPlaceholder ? "text-[#888]" : "text-[#1A1A1A]"
          }`}
        >
          {displayText}
        </Text>
        <Ionicons name="chevron-down" size={16} color="#1A1A1A" />
      </TouchableOpacity>

      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View className="flex-1 bg-black/30 justify-end">
            <TouchableWithoutFeedback>
              <View className="bg-white rounded-t-2xl max-h-[60%] pb-6">
                <View className="w-12 h-1 bg-[#E8E8E8] rounded-full self-center my-3" />
                <ScrollView>
                  {options.map((opt, i) => (
                    <TouchableOpacity
                      key={opt}
                      onPress={() => {
                        onChange(opt);
                        setOpen(false);
                      }}
                      className={`px-5 py-4 flex-row items-center justify-between ${
                        i > 0 ? "border-t border-[#F0F0F0]" : ""
                      }`}
                    >
                      <Text
                        className={`text-sm ${
                          value === opt
                            ? "text-[#FF3055] font-medium"
                            : "text-[#1A1A1A]"
                        }`}
                      >
                        {opt}
                      </Text>
                      {value === opt && (
                        <Ionicons name="checkmark" size={18} color="#FF3055" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}
