import { ReactNode } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from "react-native";

interface ConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  message?: string | ReactNode;
  titleAlign?: "left" | "center";
  messageAlign?: "left" | "center";
  onConfirm?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  closeLabel?: string;
  children?: ReactNode;
}

export default function ConfirmModal({
  visible,
  onClose,
  title,
  message,
  titleAlign = "center",
  messageAlign = "center",
  onConfirm,
  confirmLabel = "ตกลง",
  cancelLabel = "ยกเลิก",
  closeLabel = "ปิด",
  children,
}: ConfirmModalProps) {
  const isConfirm = typeof onConfirm === "function";
  const titleAlignClass = titleAlign === "center" ? "text-center" : "text-left";
  const messageAlignClass =
    messageAlign === "center" ? "text-center" : "text-left";

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/40 items-center justify-center px-10">
          <TouchableWithoutFeedback>
            <View className="bg-white rounded-2xl w-full overflow-hidden">
              <View className="px-5 pt-5 pb-4">
                {title && (
                  <Text
                    className={`text-base font-semibold text-[#1A1A1A] mb-2 ${titleAlignClass}`}
                  >
                    {title}
                  </Text>
                )}
                {typeof message === "string" ? (
                  <Text
                    className={`text-sm text-[#555] leading-5 ${messageAlignClass}`}
                  >
                    {message}
                  </Text>
                ) : (
                  message
                )}
                {children}
              </View>

              {isConfirm ? (
                <View className="flex-row border-t border-[#E8E8E8]">
                  <TouchableOpacity
                    onPress={onClose}
                    className="flex-1 py-3 items-center border-r border-[#E8E8E8]"
                  >
                    <Text className="text-[#FF3055] font-medium text-sm">
                      {cancelLabel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onConfirm}
                    className="flex-1 py-3 items-center"
                  >
                    <Text className="text-[#FF3055] font-medium text-sm">
                      {confirmLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View className="items-end px-5 pb-4">
                  <TouchableOpacity onPress={onClose}>
                    <Text className="text-sm font-semibold text-[#FF3055]">
                      {closeLabel}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
