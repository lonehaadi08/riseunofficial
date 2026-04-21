import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../services/firebase';
import { generateOTP, sendOTPEmail } from '../../services/email';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  
  const [step, setStep] = useState<'EMAIL' | 'OTP' | 'SUCCESS'>('EMAIL');
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [systemOtp, setSystemOtp] = useState('');
  const [userOtp, setUserOtp] = useState('');

  // Step 1: Send OTP
  const handleSendOTP = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }

    setLoading(true);
    const otp = generateOTP();
    const sent = await sendOTPEmail(email, "Student", otp);
    
    if (sent) {
      setSystemOtp(otp);
      setStep('OTP');
    } else {
      Alert.alert('Error', 'Failed to send OTP. Please check your email and try again.');
    }
    setLoading(false);
  };

  // Step 2: Verify OTP & Trigger Firebase Reset Link
  const handleVerifyOTP = async () => {
    if (userOtp !== systemOtp) {
      Alert.alert('Error', 'Invalid OTP. Please try again.');
      return;
    }

    setLoading(true);
    try {
      // Because we are serverless, we use the OTP as an extra layer of verification,
      // but must rely on Firebase's secure link to actually change the password.
      await sendPasswordResetEmail(auth, email);
      setStep('SUCCESS');
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Reset Password</Text>

      {step === 'EMAIL' && (
        <>
          <Text style={styles.subtitle}>Enter your email to receive a verification code.</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Email Address" 
            value={email} 
            onChangeText={setEmail} 
            keyboardType="email-address" 
            autoCapitalize="none" 
          />
          <TouchableOpacity style={styles.button} onPress={handleSendOTP} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </TouchableOpacity>
        </>
      )}

      {step === 'OTP' && (
        <>
          <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
          <TextInput 
            style={[styles.input, styles.otpInput]} 
            placeholder="000000" 
            value={userOtp} 
            onChangeText={setUserOtp} 
            keyboardType="number-pad" 
            maxLength={6} 
          />
          <TouchableOpacity style={styles.button} onPress={handleVerifyOTP} disabled={loading}>
            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={styles.buttonText}>Verify OTP</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkButton} onPress={() => setStep('EMAIL')}>
            <Text style={styles.linkText}>Change Email</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'SUCCESS' && (
        <>
          <Text style={styles.subtitle}>Verification successful! We have emailed you a secure link to choose a new password.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/(auth)/login')}>
            <Text style={styles.buttonText}>Return to Login</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 'EMAIL' && (
        <TouchableOpacity style={styles.linkButton} onPress={() => router.back()}>
          <Text style={styles.linkText}>Back to Login</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F3F4F6' },
  title: { fontSize: 32, fontWeight: '800', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#4B5563', marginBottom: 32, lineHeight: 24 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 16 },
  otpInput: { textAlign: 'center', fontSize: 24, letterSpacing: 8, fontWeight: 'bold' },
  button: { backgroundColor: '#3B82F6', paddingVertical: 16, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  linkButton: { marginTop: 24, alignItems: 'center' },
  linkText: { color: '#3B82F6', fontSize: 14, fontWeight: '600' }
});