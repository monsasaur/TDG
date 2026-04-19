import "../global.css";
import { Stack } from "expo-router";
import { AlertsProvider } from "../contexts/AlertsContext";
import { DevicesProvider } from "../contexts/DevicesContext";

export default function RootLayout() {
  return (
    <DevicesProvider>
      <AlertsProvider>
        <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
      </AlertsProvider>
    </DevicesProvider>
  );
}
