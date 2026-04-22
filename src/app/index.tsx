import { Redirect } from 'expo-router';
import { useAuthStore } from '../../src/store/useAuthStore'; // Adjust path if needed, but relative from src/app is '../store/useAuthStore'
import { View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';

export default function Index() {
  const { user } = useAuthStore();
  const [isMounted, setIsMounted] = useState(false);

  // Prevent rendering until the app has fully checked the local storage for your login state
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  // The Traffic Cop Logic
  if (user) {
    return <Redirect href="/(tabs)/timetable" />;
  } else {
    return <Redirect href="/(auth)/login" />;
  }
}