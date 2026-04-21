import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { useAuthStore, User } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const login = useAuthStore((state) => state.login);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Authenticate with Firebase
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;

      // 2. Fetch the FULL profile from Firestore
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);

      let userData;

      if (userDocSnap.exists()) {
        userData = { id: uid, ...userDocSnap.data() } as User;
      } else {
        // FAILSAFE: If no Firestore doc exists for this auth user, create one with a default batch
        userData = { id: uid, name: userCredential.user.displayName || 'Student', role: 'student', batch: 'RF28X' };
        await setDoc(userDocRef, userData);
      }

      // 3. Save full data to Global Store
      login(userData);
      
      // 4. Go to Timetable
      router.replace('/(tabs)/timetable');

    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>DigiKashmiri</Text>
        <Text style={styles.subtitle}>Sign in to your account</Text>

        <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#64748B" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
        <TextInput style={styles.input} placeholder="Password" placeholderTextColor="#64748B" value={password} onChangeText={setPassword} secureTextEntry />

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Login</Text>}
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/signup')}>
          <Text style={styles.linkText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', padding: 20 },
  card: { backgroundColor: '#1E293B', padding: 24, borderRadius: 20, borderWidth: 1, borderColor: '#334155' },
  title: { fontSize: 32, fontWeight: '800', color: '#F8FAFC', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#94A3B8', textAlign: 'center', marginBottom: 32 },
  input: { backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#334155', fontSize: 16 },
  button: { backgroundColor: '#38BDF8', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#0F172A', fontSize: 16, fontWeight: 'bold' },
  linkButton: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#38BDF8', fontSize: 14, fontWeight: '600' }
});