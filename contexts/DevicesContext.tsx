import { createContext, useContext, useState, ReactNode } from "react";
import { Device, mockDevices } from "../data/mockDevices";

type DevicesContextType = {
  devices: Device[];
  setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
  updateDevice: (id: string, updates: Partial<Device>) => void;
};

const DevicesContext = createContext<DevicesContextType | undefined>(undefined);

export function DevicesProvider({ children }: { children: ReactNode }) {
  const [devices, setDevices] = useState<Device[]>(mockDevices);

  const updateDevice = (id: string, updates: Partial<Device>) =>
    setDevices((prev) =>
      prev.map((d) => (d.id === id ? { ...d, ...updates } : d))
    );

  return (
    <DevicesContext.Provider value={{ devices, setDevices, updateDevice }}>
      {children}
    </DevicesContext.Provider>
  );
}

export function useDevices() {
  const ctx = useContext(DevicesContext);
  if (!ctx) throw new Error("useDevices must be used within DevicesProvider");
  return ctx;
}
