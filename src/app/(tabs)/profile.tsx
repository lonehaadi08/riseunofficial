import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/useAuthStore';

const IMGBB_API_KEY = '52b826b5c39121d51a6d4825d19fbc74'; 

export default function ProfileScreen() {
  const { user, updateUser } = useAuthStore();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // Editable Fields
  const [aboutText, setAboutText] = useState(user?.about || '');
  const [batchText, setBatchText] = useState(user?.batch || '');
  const [phoneText, setPhoneText] = useState(user?.phone || '');
  const [aimText, setAimText] = useState(user?.aim || '');

  const pickAndUploadImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Allow camera roll access to change your picture.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1], 
      quality: 0.5, 
      base64: true, 
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadToImgBB(result.assets[0].base64);
    }
  };

  const uploadToImgBB = async (base64Image: string) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', base64Image);
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
      const data = await response.json();
      
      if (data.success) {
        const newImageUrl = data.data.url;
        await updateDoc(doc(db, 'users', user!.id), { profilePic: newImageUrl });
        updateUser({ profilePic: newImageUrl });
      } else {
        Alert.alert("Upload Failed", "Could not upload image to server.");
      }
    } catch (error) {
      Alert.alert("Error", "Something went wrong during upload.");
    } finally {
      setIsUploading(false);
    }
  };

  const saveProfile = async () => {
    if (!batchText.trim()) {
      Alert.alert("Required", "Batch code is required for the Timetable to work!");
      return;
    }
    
    try {
      await updateDoc(doc(db, 'users', user!.id), { 
        about: aboutText,
        batch: batchText.trim().toUpperCase(), // Force uppercase for JSON matching
        phone: phoneText.trim(),
        aim: aimText 
      });
      
      updateUser({ 
        about: aboutText, 
        batch: batchText.trim().toUpperCase(), 
        phone: phoneText.trim(), 
        aim: aimText 
      });
      
      setIsEditing(false);
    } catch (error) {
      Alert.alert("Error", "Could not save profile details.");
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={() => isEditing ? saveProfile() : setIsEditing(true)}>
            <Text style={styles.editButton}>{isEditing ? 'Save' : 'Edit'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickAndUploadImage} disabled={isUploading || !isEditing}>
            <View style={styles.avatarWrapper}>
              {user?.profilePic ? (
                <Image source={{ uri: user.profilePic }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{user?.name?.charAt(0).toUpperCase()}</Text>
              )}
              {isUploading && <View style={styles.uploadingOverlay}><ActivityIndicator color="#FFFFFF" /></View>}
            </View>
            {isEditing && (
              <View style={styles.cameraIconBadge}><Text style={styles.cameraIcon}>📷</Text></View>
            )}
          </TouchableOpacity>
          <Text style={styles.userName}>{user?.name || 'Student Name'}</Text>
          <Text style={styles.userBatch}>{user?.batch || 'Batch Not Set'} • Class {user?.studentClass || 'N/A'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Batch Code (Crucial for Timetable)</Text>
          {isEditing ? (
             <TextInput style={styles.textInput} value={batchText} onChangeText={setBatchText} placeholder="e.g. RF28X" placeholderTextColor="#64748B" autoCapitalize="characters" />
          ) : (
             <Text style={[styles.valueText, !user?.batch && { color: '#F87171' }]}>{user?.batch || 'Tap Edit and enter your batch code'}</Text>
          )}
          <View style={styles.divider} />

          <Text style={styles.label}>Phone Number</Text>
          {isEditing ? (
             <TextInput style={styles.textInput} value={phoneText} onChangeText={setPhoneText} placeholder="e.g. 9999999999" placeholderTextColor="#64748B" keyboardType="phone-pad" />
          ) : (
             <Text style={styles.valueText}>{user?.phone || 'Not Provided'}</Text>
          )}
          <View style={styles.divider} />

          <Text style={styles.label}>Aim / Goal</Text>
          {isEditing ? (
             <TextInput style={styles.textInput} value={aimText} onChangeText={setAimText} placeholder="e.g. JEE Advanced 2026" placeholderTextColor="#64748B" />
          ) : (
             <Text style={styles.valueText}>{user?.aim || 'Not Provided'}</Text>
          )}
          <View style={styles.divider} />

          <Text style={styles.label}>About Me</Text>
          {isEditing ? (
            <TextInput style={[styles.textInput, { minHeight: 80, textAlignVertical: 'top' }]} value={aboutText} onChangeText={setAboutText} multiline maxLength={150} placeholder="Write something about yourself..." placeholderTextColor="#64748B" />
          ) : (
            <Text style={styles.valueText}>{user?.about || 'No details added yet.'}</Text>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' }, 
  scrollContent: { padding: 24, paddingTop: 60, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#F8FAFC' },
  editButton: { fontSize: 16, fontWeight: '700', color: '#38BDF8', padding: 8 }, 
  
  avatarSection: { alignItems: 'center', marginBottom: 40 },
  avatarWrapper: { width: 120, height: 120, borderRadius: 60, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#38BDF8', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 48, fontWeight: '800', color: '#F8FAFC' },
  uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.7)', justifyContent: 'center', alignItems: 'center' },
  cameraIconBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#38BDF8', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#0F172A' },
  cameraIcon: { fontSize: 16 },
  
  userName: { fontSize: 24, fontWeight: '800', color: '#F8FAFC', marginTop: 16, marginBottom: 4 },
  userBatch: { fontSize: 14, fontWeight: '600', color: '#94A3B8', letterSpacing: 0.5 },

  card: { backgroundColor: '#1E293B', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: '#334155', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  valueText: { fontSize: 16, fontWeight: '500', color: '#F1F5F9', lineHeight: 24 },
  textInput: { backgroundColor: '#0F172A', color: '#F1F5F9', fontSize: 16, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#38BDF8' },
  divider: { height: 1, backgroundColor: '#334155', marginVertical: 20 }
});