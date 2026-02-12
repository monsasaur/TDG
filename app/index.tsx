import { useEffect, useState } from "react";
import { StyleSheet, Text, View, TouchableOpacity } from "react-native";

export default function HomeScreen() {
  const [devices, setDevices] = useState<any[]>([]);

  const fetchData = () => {
    fetch("http://localhost:3000/api/devices")
      .then((res) => res.json())
      .then((data) => setDevices(data))
      .catch((err) => console.log(err));
  };

  useEffect(() => {
    fetchData(); // โหลดครั้งแรก
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TRUE IoT Devices</Text>

      {/* 🔄 ปุ่ม Reload */}
      <TouchableOpacity style={styles.button} onPress={fetchData}>
        <Text style={styles.buttonText}>Reload Data</Text>
      </TouchableOpacity>

      {devices.map((device) => (
        <View key={device.id} style={styles.card}>
          <Text>{device.name}</Text>
          <Text>Status: {device.status}</Text>
          <Text>Value: {device.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    marginTop: 60,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
  card: {
    padding: 15,
    backgroundColor: "#f2f2f2",
    borderRadius: 10,
    marginBottom: 10,
  },
});