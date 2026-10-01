import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#166534' }}>
      <Tabs.Screen name="map" options={{ title: 'Mapa', tabBarIcon: ({ color, size }) => <Ionicons name="map-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="plots" options={{ title: 'Lotes', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alertas', tabBarIcon: ({ color, size }) => <Ionicons name="warning-outline" color={color} size={size} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Cuenta', tabBarIcon: ({ color, size }) => <Ionicons name="person-circle-outline" color={color} size={size} /> }} />
    </Tabs>
  );
}
