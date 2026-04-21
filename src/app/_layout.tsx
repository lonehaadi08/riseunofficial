import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/useAuthStore';
import { View, ActivityIndicator, LogBox } from 'react-native';

// 1. Silences the harmless Firebase hot-reload warnings so your console stays clean
LogBox.ignoreLogs([
  'You are initializing Firebase Auth for React Native without providing AsyncStorage',
  '@firebase/auth: Auth'
]);

export default function RootLayout() {
  const { isInitialized, user, checkSession } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

// 2. Fire up the session listener the moment the app opens
  useEffect(() => {
    checkSession();
  }, []);

  // 3. Smart Routing: Automatically redirect based on login status
  useEffect(() => {
    if (!isInitialized) return; // Wait until Firebase checks the user

    const inAuthGroup = segments[0] === '(auth)';

    if (user && inAuthGroup) {
      // If logged in and on the login screen, jump to Timetable
      router.replace('/(tabs)/timetable');
    } else if (!user && !inAuthGroup) {
      // If NOT logged in and trying to access tabs, kick to Login
      router.replace('/(auth)/login');
    }
  }, [user, isInitialized, segments]);

  // 4. Premium Deep Slate loading screen while Firebase connects
  if (!isInitialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0F172A' }}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  // 5. The main app navigation stack
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="chat" options={{ headerShown: false, presentation: 'card' }} />
    </Stack>
  );
}