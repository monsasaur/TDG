export const MAX_HOUSES = 5;

export type DeviceStatus = "connected" | "disconnected";

export type Device = {
  id: string;
  name: string;
  code: string;
  wifi: string;
  status: DeviceStatus;
  house: string;
};

export const mockDevices: Device[] = [
  {
    id: "d1",
    name: "Esp32 - ห้องนอน",
    code: "ESP-0001A",
    wifi: "MeeNeeNetZa_5G",
    status: "disconnected",
    house: "บ้านแม่",
  },
  {
    id: "d2",
    name: "Esp32 - ห้องครัว",
    code: "ESP-0002B",
    wifi: "MeeNeeNetZa_5G",
    status: "connected",
    house: "บ้านแม่",
  },
  {
    id: "d3",
    name: "Esp32 - ห้องนอน",
    code: "ESP-0003C",
    wifi: "MeeNeeNetZa_5G",
    status: "connected",
    house: "บ้านพ่อ",
  },
  {
    id: "d4",
    name: "Esp32 - ห้องน้ำ",
    code: "ESP-0004D",
    wifi: "MeeNeeNetZa_5G",
    status: "disconnected",
    house: "บ้านพ่อ",
  },
];

export const mockAvailableNetworks: string[] = [
  "MyHome_2.4G",
  "NeighborWifi_5G",
  "TrueNet-ABCD",
];
