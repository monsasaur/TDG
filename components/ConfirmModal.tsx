import { ReactNode } from "react";
import { Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
  /** ไอคอนวงกลมด้านบน — ไม่ใส่ก็ได้ */
  icon?: keyof typeof Ionicons.glyphMap;
  /** ภาพด้านบนแบบกำหนดเอง (ใช้แทน icon เมื่ออยากได้มากกว่าไอคอนเดียว) */
  iconNode?: ReactNode;
  /** danger = การกระทำที่ย้อนกลับไม่ได้ เช่นลบอุปกรณ์ · ปุ่มยืนยันเป็นสีแดง */
  tone?: "default" | "danger";
}

/**
 * ป๊อปอัปยืนยัน / แจ้งข้อความ — ดีไซน์ v2
 * การ์ดขาวมุมมน ไอคอนวงกลมด้านบน ปุ่มเต็มความกว้าง (แตะง่ายกว่าลิงก์ข้อความเล็ก ๆ แบบเดิม)
 */
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
  icon,
  iconNode,
  tone = "default",
}: ConfirmModalProps) {
  const isConfirm = typeof onConfirm === "function";
  const danger = tone === "danger";
  const shownIcon = icon;
  const titleAlignClass = titleAlign === "center" ? "text-center" : "text-left";
  const messageAlignClass = messageAlign === "center" ? "text-center" : "text-left";

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <TouchableWithoutFeedback>
            <View
              className="bg-white rounded-3xl w-full px-5 pt-6 pb-5"
              style={{
                elevation: 10,
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 24,
                shadowOffset: { width: 0, height: 10 },
              }}
            >
              {iconNode ? <View className="items-center mb-3">{iconNode}</View> : null}

              {!iconNode && shownIcon && (
                <View
                  className={`w-14 h-14 rounded-full items-center justify-center self-center mb-3 ${
                    danger ? "bg-[#FDECEC]" : "bg-[#F2F3F5]"
                  }`}
                >
                  <Ionicons name={shownIcon} size={28} color={danger ? "#DC2626" : "#292A32"} />
                </View>
              )}

              {title ? (
                <Text className={`text-lg font-semibold text-[#292A32] ${titleAlignClass}`}>{title}</Text>
              ) : null}

              {typeof message === "string" ? (
                <Text className={`text-sm text-[#858891] leading-[22px] mt-2 ${messageAlignClass}`}>{message}</Text>
              ) : (
                message
              )}
              {children}

              {isConfirm ? (
                <View className="flex-row mt-5">
                  <TouchableOpacity
                    onPress={onClose}
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    className="flex-1 h-[48px] rounded-2xl bg-white border border-[#E5E6E9] justify-center items-center mr-2"
                  >
                    <Text className="text-sm font-semibold text-[#292A32]">{cancelLabel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={onConfirm}
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    className={`flex-1 h-[48px] rounded-2xl justify-center items-center ml-2 ${
                      danger ? "bg-[#DC2626]" : "bg-[#292A32]"
                    }`}
                  >
                    <Text className="text-sm font-semibold text-white">{confirmLabel}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={onClose}
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  className={`h-[48px] rounded-2xl justify-center items-center mt-5 ${
                    danger ? "bg-[#DC2626]" : "bg-[#292A32]"
                  }`}
                >
                  <Text className="text-sm font-semibold text-white">{closeLabel}</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
