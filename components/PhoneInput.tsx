import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  Pressable,
  Keyboard,
  Platform,
  StatusBar,
} from "react-native";

interface PhoneInputProps {
  value: string;
  error?: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  autoFocus?: boolean;
  onDropdownChange?: (open: boolean) => void;
}

type Anchor = { x: number; y: number; width: number; height: number };

const statusBarOffset =
  Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0;

export default function PhoneInput({
  value,
  error,
  onChangeText,
  onBlur,
  autoFocus,
  onDropdownChange,
}: PhoneInputProps) {
  const inputRef = useRef<TextInput>(null);
  const containerRef = useRef<View>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const setOpen = (open: boolean) => {
    setDropdownOpen(open);
    onDropdownChange?.(open);
  };

  const handleToggle = () => {
    if (dropdownOpen) {
      setOpen(false);
      return;
    }
    Keyboard.dismiss();
    requestAnimationFrame(() => {
      containerRef.current?.measureInWindow((x, y, width, height) => {
        setAnchor({ x, y, width, height });
        setOpen(true);
      });
    });
  };

  return (
    <View>
      <Text className="text-sm font-semibold text-ink mb-2">เบอร์โทรของฉัน</Text>
      <View
        ref={containerRef}
        className={`flex-row items-center border rounded-[28px] h-[52px] overflow-hidden ${
          error ? "border-danger" : "border-line"
        }`}
      >
        <TouchableOpacity
          className="px-5 justify-center items-center"
          onPress={handleToggle}
          activeOpacity={0.6}
        >
          <Text className="text-base text-ink font-medium">+66</Text>
        </TouchableOpacity>
        <View className="w-px h-7 bg-line" />
        <TextInput
          ref={inputRef}
          className="flex-1 text-base text-ink px-4 h-full"
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          keyboardType="number-pad"
          maxLength={10}
          autoFocus={autoFocus}
        />
      </View>

      <Modal
        transparent
        visible={dropdownOpen}
        animationType="fade"
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
      >
        <Pressable
          className="flex-1 bg-black/30"
          onPress={() => setOpen(false)}
        >
          {anchor && (
            <View
              style={{
                position: "absolute",
                top: anchor.y + anchor.height + 6 + statusBarOffset,
                left: anchor.x,
                width: anchor.width,
              }}
            >
              <View className="border border-line rounded-[16px] px-5 py-3 bg-white">
                <Text className="text-base text-ink font-medium">+66</Text>
              </View>
            </View>
          )}
        </Pressable>
      </Modal>

      {error ? <Text className="text-xs text-danger mt-2 ml-1">{error}</Text> : null}
    </View>
  );
}
