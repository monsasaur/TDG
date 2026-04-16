import "../global.css";
import { Stack } from "expo-router";
import { AlertsProvider } from "../contexts/AlertsContext";

export default function RootLayout() {
  return (
    <AlertsProvider>
      <Stack screenOptions={{ headerShown: false, animation: "fade" }} />
    </AlertsProvider>
  );
}
