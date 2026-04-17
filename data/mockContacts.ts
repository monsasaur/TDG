export const MAX_MEMBERS_PER_HOUSE = 6; // รวมตัวเรา
export const MAX_EXTERNAL_PER_HOUSE = 4;

export type ContactType = "self" | "member" | "external";

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  houses: string[];
  type: ContactType;
};

export const mockContacts: EmergencyContact[] = [
  {
    id: "c1",
    name: "คุณ (ฉัน)",
    phone: "000-000-0000",
    houses: ["บ้านแม่", "บ้านพ่อ"],
    type: "self",
  },
  {
    id: "c2",
    name: "ตังเม",
    phone: "000-000-0000",
    houses: ["บ้านแม่", "บ้านพ่อ"],
    type: "member",
  },
  {
    id: "c3",
    name: "พี่สาว",
    phone: "000-000-0000",
    houses: ["บ้านแม่", "บ้านพ่อ"],
    type: "member",
  },
  {
    id: "c4",
    name: "สมหญิง",
    phone: "000-000-0000",
    houses: ["บ้านแม่"],
    type: "external",
  },
];
