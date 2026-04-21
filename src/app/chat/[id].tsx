import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/useAuthStore';

export default function ChatRoomScreen() {
  const { id, name } = useLocalSearchParams(); // Gets the chat ID and Friend's Name from the URL
  const { user } = useAuthStore();
  const router = useRouter();

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');

  // 1. Listen for new messages in this specific chat
  useEffect(() => {
    if (!id) return;

    const messagesRef = collection(db, 'chats', id as string, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc')); // Fetch newest first

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [id]);

  // 2. Send Message
  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText(''); // Clear input instantly for UI responsiveness

    try {
      // Add message to subcollection
      await addDoc(collection(db, 'chats', id as string, 'messages'), {
        text: textToSend,
        senderId: user?.id,
        createdAt: serverTimestamp()
      });

      // Update the parent chat document with the last message
      await updateDoc(doc(db, 'chats', id as string), {
        lastMessage: textToSend,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.senderId === user?.id;

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.messageText, isMe ? styles.textMe : styles.textThem]}>{item.text}</Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name}</Text>
        <View style={{ width: 50 }} /> {/* Spacer to center title */}
      </View>

      {/* Messages List (Inverted so newest is at the bottom) */}
      <FlatList
        data={messages}
        keyExtractor={item => item.id}
        renderItem={renderMessage}
        inverted
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backButton: { padding: 8 },
  backText: { color: '#3B82F6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  listContainer: { padding: 16 },
  messageWrapper: { width: '100%', marginBottom: 12, flexDirection: 'row' },
  messageWrapperMe: { justifyContent: 'flex-end' },
  messageWrapperThem: { justifyContent: 'flex-start' },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleMe: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#E5E7EB', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  textMe: { color: '#FFFFFF' },
  textThem: { color: '#1F2937' },
  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  input: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, marginRight: 12 },
  sendButton: { backgroundColor: '#3B82F6', borderRadius: 24, justifyContent: 'center', paddingHorizontal: 20 },
  sendText: { color: '#FFFFFF', fontWeight: 'bold' }
});