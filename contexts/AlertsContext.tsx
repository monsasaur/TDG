import { createContext, useContext, useState, ReactNode } from "react";
import { Alert, SystemAlert } from "../types/alert";
import { mockAlerts } from "../data/mockAlerts";
import { mockSystemAlerts } from "../data/mockSystemAlerts";

type ClearOptions = {
  house?: string;
  clearFall: boolean;
  clearSystem: boolean;
};

type AlertsContextType = {
  alerts: Alert[];
  systemAlerts: SystemAlert[];
  setAlerts: React.Dispatch<React.SetStateAction<Alert[]>>;
  setSystemAlerts: React.Dispatch<React.SetStateAction<SystemAlert[]>>;
  clearAlerts: (opts: ClearOptions) => void;
};

const AlertsContext = createContext<AlertsContextType | undefined>(undefined);

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>(mockSystemAlerts);

  const clearAlerts = ({ house, clearFall, clearSystem }: ClearOptions) => {
    if (clearFall) {
      setAlerts((prev) =>
        house ? prev.filter((a) => a.houseName !== house) : []
      );
    }
    if (clearSystem) {
      setSystemAlerts((prev) =>
        house ? prev.filter((a) => a.houseName !== house) : []
      );
    }
  };

  return (
    <AlertsContext.Provider
      value={{ alerts, systemAlerts, setAlerts, setSystemAlerts, clearAlerts }}
    >
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlerts() {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error("useAlerts must be used within AlertsProvider");
  return ctx;
}
