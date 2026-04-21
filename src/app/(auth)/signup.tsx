import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../services/firebase';
import { generateOTP, sendOTPEmail } from '../../services/email';
import { useAuthStore } from '../../store/useAuthStore';

export default function SignupScreen() {
  const router = useRouter();
  const login = useAuthStore((state) => state.login);

  // Step Management: 'DETAILS' | 'OTP'
  const [step, setStep] = useState<'DETAILS' | 'OTP'>('DETAILS');
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [aim, setAim] = useState('');
  const [batch, setBatch] = useState('');

  // OTP State
  const [systemOtp, setSystemOtp] = useState('');
  const [userOtp, setUserOtp] = useState('');

  // Step 1: Send OTP
  const handleRequestOTP = async () => {
    if (!name || !email || !phone || !password) {
      Alert.alert('Error', 'Please fill in all required fields.');
      return;
    }

    setLoading(true);
    const otp = generateOTP();
    const sent = await sendOTPEmail(email, name, otp);
    
    if (sent) {
      setSystemOtp(otp);
      setStep('OTP');
      Alert.alert('Success', `An OTP has been sent to ${email}`);
    } else {
      Alert.alert('Error', 'Failed to send OTP. Please check your email and try again.');
    }
    setLoading(false);
  };

  // Step 2: Verify OTP and Create Account
  const handleVerifyOTP = async () => {
    if (userOtp !== systemOtp) {
      Alert.alert('Error', 'Invalid OTP. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // 1. Create User in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save Additional Data to Firestore
      const userData = {
        id: user.uid,
        name,
        phone,
        email,
        class: studentClass,
        aim,
        batch,
        role: 'student',
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      // 3. Log user into our fast local state
      await login({ id: user.uid, name: userData.name, role: userData.role });
      
      // 4. Redirect to main app
      router.replace('/(tabs)/timetable');
    } catch (error: any) {
      Alert.alert('Signup Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join the Student Portal</Text>

        {step === 'DETAILS' ? (
          <>
            <TextInput style={styles.input} placeholder="Full Name *" value={name} onChangeText={setName} />
            <TextInput style={styles.input} placeholder="Email Address *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} placeholder="Phone Number *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
            <TextInput style={styles.input} placeholder="Password *" value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput style={styles.input} placeholder="Class (e.g., 10th, 12th)" value={studentClass} onChangeText={setStudentClass} />
            <TextInput style={styles.input} placeholder="Aim (e.g., JEE, NEET)" value={aim} onChangeText={setAim} />
            <TextInput style={styles.input} placeholder="Batch Code" value={batch} onChangeText={setBatch} />

            <TouchableOpacity style={styles.button} onPress={handleRequestOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send OTP</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.linkText}>Already have an account? Login</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.instructionText}>Enter the 6-digit code sent to {email}</Text>
            <TextInput 
              style={[styles.input, styles.otpInput]} 
              placeholder="000000" 
              value={userOtp} 
              onChangeText={setUserOtp} 
              keyboardType="number-pad" 
              maxLength={6} 
            />

            <TouchableOpacity style={styles.button} onPress={handleVerifyOTP} disabled={loading}>
              {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify & Create Account</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => setStep('DETAILS')} disabled={loading}>
              <Text style={styles.linkText}>Change Email</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flexGrow: 1, backgroundColor: '#F3F4F6' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', marginBottom: 32 },
  instructionText: { fontSize: 16, color: '#374151', marginBottom: 16, textAlign: 'center' },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16 },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 'bold' },
  button: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  linkButton: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#3B82F6', fontSize: 14, fontWeight: '600' }
});