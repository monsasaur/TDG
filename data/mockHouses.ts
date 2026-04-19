import { useEffect, useState } from "react";

export const MAX_HOUSES = 5;

let houses: string[] = ["บ้านแม่", "บ้านพ่อ"];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export const mockHouses = {
  list: () => houses,
  add(name: string) {
    houses = [...houses, name];
    notify();
  },
  remove(name: string) {
    houses = houses.filter((h) => h !== name);
    notify();
  },
};

export function useMockHouses() {
  const [snapshot, setSnapshot] = useState(houses);
  useEffect(() => {
    const listener = () => setSnapshot(mockHouses.list());
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return snapshot;
}
