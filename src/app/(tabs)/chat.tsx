import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { collection, query, where, onSnapshot, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { useAuthStore } from '../../store/useAuthStore';
import { useRouter } from 'expo-router';

export default function ChatScreen() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [chats, setChats] = useState<any[]>([]);
  const [searchPhone, setSearchPhone] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('participants', 'array-contains', user.id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).sort((a: any, b: any) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
      
      setChats(chatList);
    });
    return () => unsubscribe();
  }, [user]);

  const handleSearch = async () => {
    if (!searchPhone.trim()) return;
    setIsSearching(true);
    
    try {
      const q = query(collection(db, 'users'), where('phone', '==', searchPhone.trim()));
      const snapshot = await getDocs(q);
      
      const results = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(u => u.id !== user?.id); 
        
      setSearchResults(results);
      if (results.length === 0) Alert.alert("Not Found", "No student found with this phone number.");
    } catch (error) {
      console.error("Search error", error);
    } finally {
      setIsSearching(false);
    }
  };

  const startChat = async (targetUser: any) => {
    if (!user || !user.id) return;

    // Composite ID logic
    const chatId = user.id < targetUser.id 
      ? `${user.id}_${targetUser.id}` 
      : `${targetUser.id}_${user.id}`;

    try {
      // We use setDoc with merge so it creates if missing, but doesn't wipe existing data
      await setDoc(doc(db, 'chats', chatId), {
        participants: [user.id, targetUser.id],
        participantNames: { [user.id]: user.name, [targetUser.id]: targetUser.name },
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setSearchPhone('');
      setSearchResults([]);

      router.push({
        pathname: "/chat/[id]",
        params: { id: chatId, name: targetUser.name }
      });
    } catch (error) {
      Alert.alert("Error", "Could not start chat.");
    }
  };

  const renderChatItem = ({ item }: { item: any }) => {
    const otherUserId = item.participants.find((id: string) => id !== user?.id);
    const otherUserName = item.participantNames?.[otherUserId] || 'Unknown Student';
    
    // Format timestamp nicely
    const timeString = item.updatedAt ? new Date(item.updatedAt.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

    return (
      <TouchableOpacity 
        style={styles.chatCard} 
        onPress={() => router.push({ pathname: "/chat/[id]", params: { id: item.id, name: otherUserName } })}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{otherUserName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatName}>{otherUserName}</Text>
            <Text style={styles.timeText}>{timeString}</Text>
          </View>
          <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage || 'Tap to chat'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Chats</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput 
          style={styles.searchInput} 
          placeholder="Search by phone number..." 
          value={searchPhone} 
          onChangeText={setSearchPhone} 
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={isSearching}>
          {isSearching ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.searchButtonText}>New Chat</Text>}
        </TouchableOpacity>
      </View>

      {searchResults.length > 0 && (
        <View style={styles.searchResultsContainer}>
          <Text style={styles.sectionTitle}>Found Student</Text>
          {searchResults.map(u => (
            <TouchableOpacity key={u.id} style={styles.resultCard} onPress={() => startChat(u)}>
              <View style={styles.avatarSmall}><Text style={styles.avatarTextSmall}>{u.name.charAt(0)}</Text></View>
              <Text style={styles.resultName}>{u.name}</Text>
              <Text style={styles.resultAction}>Message</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <FlatList
        data={chats}
        keyExtractor={item => item.id}
        renderItem={renderChatItem}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={<Text style={styles.emptyText}>No messages yet. Find a friend to start chatting!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { padding: 24, paddingTop: 60, backgroundColor: '#FFFFFF' },
  headerTitle: { fontSize: 32, fontWeight: '800', color: '#111827' },
  searchContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  searchInput: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 20, paddingHorizontal: 16, height: 44, fontSize: 15, marginRight: 12 },
  searchButton: { backgroundColor: '#10B981', borderRadius: 20, justifyContent: 'center', paddingHorizontal: 20, height: 44 },
  searchButtonText: { color: '#FFFFFF', fontWeight: 'bold' },
  searchResultsContainer: { padding: 16, backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6B7280', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  resultCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  avatarTextSmall: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' },
  resultName: { flex: 1, fontSize: 16, fontWeight: '600', color: '#1F2937' },
  resultAction: { color: '#10B981', fontWeight: 'bold', fontSize: 14 },
  listContainer: { padding: 16 },
  chatCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  avatarText: { color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' },
  chatInfo: { flex: 1, justifyContent: 'center' },
  chatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 17, fontWeight: '600', color: '#111827' },
  timeText: { fontSize: 12, color: '#9CA3AF' },
  lastMessage: { fontSize: 14, color: '#6B7280' },
  emptyText: { textAlign: 'center', color: '#9CA3AF', marginTop: 60, fontSize: 15 }
});