import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, RefreshControl, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuthStore } from '../../store/useAuthStore';
import { useTimetableStore, parseDateStr, getTimeValue } from '../../store/useTimetableStore';
import { useRouter } from 'expo-router';
import { askAI } from '../../services/ai';

export default function TimetableScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  
  const { dailySchedule, weeklySchedule, allWeeklyRaw, isLoading, lastUpdated, startAutoRefresh, loadData } = useTimetableStore();
  const [activeTab, setActiveTab] = useState<'DAILY' | 'WEEKLY'>('DAILY');

  const [isAIModalVisible, setAIModalVisible] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [isAITyping, setIsAITyping] = useState(false);
  const [messages, setMessages] = useState<any[]>([{ id: '1', text: `Hi ${user?.name?.split(' ')[0] || 'there'}! Ask me anything about your schedule!`, sender: 'ai' }]);

  const [isTeacherModalVisible, setTeacherModalVisible] = useState(false);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [teacherResults, setTeacherResults] = useState<any[]>([]);

  useEffect(() => {
    if (user?.batch) startAutoRefresh(user.batch);
  }, [user?.batch]);

  const handleManualRefresh = () => {
    if (user?.batch) loadData(user.batch);
  };

  const handleSendMessage = async () => {
    if (!aiInput.trim()) return;
    const userMsg = { id: Date.now().toString(), text: aiInput.trim(), sender: 'user' as const };
    setMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setIsAITyping(true);

    const fullKnowledgeBase = { user, dailySchedule, weeklySchedule };
    const aiResponseText = await askAI(userMsg.text, fullKnowledgeBase);
    
    setMessages(prev => [...prev, { id: Date.now().toString(), text: aiResponseText, sender: 'ai' }]);
    setIsAITyping(false);
  };

  // ADVANCED TEACHER SEARCH ENGINE (With Past-Filtering & Chronology)
  const searchTeacher = () => {
    if (!teacherSearchQuery.trim() || !allWeeklyRaw) return;
    const query = teacherSearchQuery.trim().toUpperCase();
    const foundClasses: any[] = [];

    // 1. Scan every batch for the teacher code
    allWeeklyRaw.forEach((batchRow: any) => {
      const batchName = batchRow.Batch || 'Unknown';
      Object.keys(batchRow).forEach((key) => {
        if (key === 'Batch' || key.startsWith('Room')) return;
        const cellValue = batchRow[key];
        
        if (typeof cellValue === 'string' && cellValue.includes(`(${query})`)) {
          let dateStr = "";
          let timeStr = "";
          if (key.includes(' - ')) {
            const parts = key.split(' - ');
            dateStr = parts[0].trim();
            timeStr = parts[1].trim();
          } else if (key.includes('(') && !key.startsWith('Room')) {
            const match = key.match(/(.*)\((.*?)\)/);
            if (match) {
              timeStr = match[1].trim().replace('Doubt,', '').trim();
              dateStr = match[2].trim();
            }
          }
          const room = batchRow[`Room (${dateStr})`] || 'TBA';
          if (dateStr) foundClasses.push({ batch: batchName, date: dateStr, time: timeStr, subject: cellValue, room });
        }
      });
    });

    const grouped: Record<string, any[]> = {};
    foundClasses.forEach(c => {
      if (!grouped[c.date]) grouped[c.date] = [];
      grouped[c.date].push(c);
    });

    // 2. Establish "Today" to filter out old dates like March
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    // 3. Convert, Filter out the Past, Sort by Date, then Sort by Time
    const sections = Object.keys(grouped).map(dateStr => {
      const dateObj = parseDateStr(dateStr);
      const daysDiff = Math.round((dateObj.getTime() - today.getTime()) / (1000 * 3600 * 24));
      
      return {
        title: dateStr,
        dateObj,
        daysDiff,
        data: grouped[dateStr].sort((a, b) => getTimeValue(a.time) - getTimeValue(b.time))
      };
    })
    .filter(section => section.daysDiff >= 0) // <--- PREVENTS MARCH/PAST DATES FROM SHOWING
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime()); // <--- ENSURES TODAY IS AT THE VERY TOP

    setTeacherResults(sections);
  };

  const renderClassItem = ({ item }: { item: any }) => (
    <View style={[styles.compactCard, item.isChanged && styles.changedCard]}>
      <View style={styles.timeColumn}>
        <Text style={styles.timeText}>{item.time}</Text>
      </View>
      <View style={styles.detailsColumn}>
        <Text style={styles.subjectText}>{item.subject}</Text>
        <View style={styles.subDetailsRow}>
          <Text style={styles.teacherText}>{item.teacher ? `By: ${item.teacher}` : 'TBA'}</Text>
          <Text style={styles.roomText}>Room: {item.room}</Text>
        </View>
      </View>
      {item.isChanged && <View style={styles.tagColumn}><Text style={styles.changedTag}>Update</Text></View>}
    </View>
  );

  const activeData = activeTab === 'DAILY' ? dailySchedule : weeklySchedule;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.batchText}>BATCH: {user?.batch || 'NOT SET'}</Text>
          <Text style={styles.headerTitle}>My Timetable</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
            <Text style={styles.lastUpdated}>Synced: {lastUpdated || 'Fetching...'}</Text>
            <TouchableOpacity onPress={handleManualRefresh} style={styles.refreshIconBtn}>
              <Text style={{ fontSize: 12 }}>🔄</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={() => { logout(); router.replace('/(auth)/login'); }}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'DAILY' && styles.activeTab]} onPress={() => setActiveTab('DAILY')}>
          <Text style={[styles.tabText, activeTab === 'DAILY' && styles.activeTabText]}>Today</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'WEEKLY' && styles.activeTab]} onPress={() => setActiveTab('WEEKLY')}>
          <Text style={[styles.tabText, activeTab === 'WEEKLY' && styles.activeTabText]}>Full Schedule</Text>
        </TouchableOpacity>
      </View>

      {isLoading && activeData.length === 0 ? (
        <View style={styles.centerContainer}><ActivityIndicator size="large" color="#38BDF8" /></View>
      ) : activeData.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.offEmoji}>🎉</Text>
          <Text style={styles.offText}>Off / No classes found!</Text>
        </View>
      ) : (
        <SectionList
          sections={activeData}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderClassItem}
          renderSectionHeader={({ section: { title } }) => <Text style={styles.sectionHeader}>{title}</Text>}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleManualRefresh} colors={['#38BDF8']} tintColor="#38BDF8" />}
        />
      )}

      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fabSecondary} onPress={() => setTeacherModalVisible(true)}>
          <Text style={styles.fabText}>👨‍🏫 Teacher Radar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.fabPrimary} onPress={() => setAIModalVisible(true)}>
          <Text style={styles.fabText}>✨ AI</Text>
        </TouchableOpacity>
      </View>

      {/* TEACHER MODAL */}
      <Modal visible={isTeacherModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setTeacherModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Weekly Teacher Radar</Text>
            <TouchableOpacity onPress={() => setTeacherModalVisible(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
          <View style={styles.inputContainer}>
            <TextInput style={styles.chatInput} placeholder="Enter Code (e.g. FN, AK)" placeholderTextColor="#64748B" value={teacherSearchQuery} onChangeText={setTeacherSearchQuery} autoCapitalize="characters" />
            <TouchableOpacity style={styles.sendButton} onPress={searchTeacher}><Text style={styles.sendText}>Scan</Text></TouchableOpacity>
          </View>
          
          <ScrollView style={{ padding: 16 }}>
            {teacherResults.length > 0 ? (
              teacherResults.map((section, idx) => (
                <View key={idx} style={{ marginBottom: 20 }}>
                  <Text style={styles.sectionHeader}>{section.title}</Text>
                  {section.data.map((res: any, i: number) => (
                    <View key={i} style={styles.compactCard}>
                      <View style={styles.timeColumn}><Text style={styles.timeText}>{res.time}</Text></View>
                      <View style={styles.detailsColumn}>
                        <Text style={styles.subjectText}>{res.subject}</Text>
                        <View style={styles.subDetailsRow}>
                          <Text style={styles.teacherText}>Batch: {res.batch}</Text>
                          <Text style={styles.roomText}>Room: {res.room}</Text>
                        </View>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            ) : (
               <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 40 }}>Enter a code to see their full weekly schedule.</Text>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* AI MODAL */}
      <Modal visible={isAIModalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setAIModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Assistant</Text>
            <TouchableOpacity onPress={() => setAIModalVisible(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
          </View>
          <SectionList sections={[{title: 'Chat', data: messages}]} keyExtractor={(item) => item.id} contentContainerStyle={styles.chatList} renderItem={({ item }) => (
              <View style={[styles.messageBubble, item.sender === 'user' ? styles.userBubble : styles.aiBubble]}><Text style={[styles.messageText, item.sender === 'user' ? styles.userText : styles.aiText]}>{item.text}</Text></View>
            )} />
          <View style={styles.inputContainer}>
            <TextInput style={styles.chatInput} placeholder="Ask about classes..." placeholderTextColor="#64748B" value={aiInput} onChangeText={setAiInput} onSubmitEditing={handleSendMessage} />
            <TouchableOpacity style={styles.sendButton} onPress={handleSendMessage} disabled={isAITyping}>
              {isAITyping ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.sendText}>Send</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 24, paddingTop: 60, backgroundColor: '#0F172A' },
  batchText: { fontSize: 12, fontWeight: '800', color: '#38BDF8', letterSpacing: 1, marginBottom: 4 },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#F8FAFC' },
  lastUpdated: { fontSize: 11, color: '#64748B', marginRight: 6 },
  refreshIconBtn: { backgroundColor: '#1E293B', padding: 4, borderRadius: 10, borderWidth: 1, borderColor: '#334155' },
  logoutButton: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: '#7F1D1D', borderRadius: 6 },
  logoutText: { color: '#FECACA', fontWeight: 'bold', fontSize: 13 },
  tabContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12, backgroundColor: '#0F172A', borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  tabButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#1E3A8A' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  activeTabText: { color: '#60A5FA', fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  offEmoji: { fontSize: 48, marginBottom: 16 },
  offText: { fontSize: 18, fontWeight: '700', color: '#94A3B8' },
  listContainer: { padding: 16, paddingBottom: 100 },
  sectionHeader: { fontSize: 14, fontWeight: '800', color: '#94A3B8', marginTop: 16, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  compactCard: { flexDirection: 'row', backgroundColor: '#1E293B', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#334155', elevation: 1 },
  changedCard: { borderColor: '#B45309', backgroundColor: '#422006' },
  timeColumn: { justifyContent: 'center', paddingRight: 12, borderRightWidth: 1, borderRightColor: '#334155', width: 95 },
  timeText: { fontSize: 12, fontWeight: '800', color: '#E2E8F0' },
  detailsColumn: { flex: 1, paddingLeft: 12, justifyContent: 'center' },
  subjectText: { fontSize: 16, fontWeight: '700', color: '#F8FAFC', marginBottom: 4 },
  subDetailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  teacherText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  roomText: { alignSelf: 'flex-start', fontSize: 11, color: '#38BDF8', fontWeight: '700', backgroundColor: '#0F2942', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  tagColumn: { justifyContent: 'center', paddingLeft: 8 },
  changedTag: { fontSize: 10, fontWeight: 'bold', color: '#FDE68A', backgroundColor: '#92400E', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, overflow: 'hidden' },
  
  fabContainer: { position: 'absolute', bottom: 20, right: 20, flexDirection: 'row' },
  fabPrimary: { backgroundColor: '#0D9488', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 30, elevation: 5, marginLeft: 10 },
  fabSecondary: { backgroundColor: '#3B82F6', paddingVertical: 12, paddingHorizontal: 18, borderRadius: 30, elevation: 5 },
  fabText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  
  modalContainer: { flex: 1, backgroundColor: '#0F172A' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, backgroundColor: '#1E293B', borderBottomWidth: 1, borderBottomColor: '#334155' },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#F8FAFC' },
  closeText: { color: '#F87171', fontSize: 16, fontWeight: '600' },
  chatList: { padding: 16 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16, marginBottom: 12 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#1E293B', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  userText: { color: '#F8FAFC' },
  aiText: { color: '#E2E8F0' },
  inputContainer: { flexDirection: 'row', padding: 16, backgroundColor: '#1E293B', borderTopWidth: 1, borderTopColor: '#334155', paddingBottom: Platform.OS === 'ios' ? 32 : 16 },
  chatInput: { flex: 1, backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 20, paddingHorizontal: 16, fontSize: 15, marginRight: 12, borderWidth: 1, borderColor: '#334155' },
  sendButton: { backgroundColor: '#0D9488', borderRadius: 20, justifyContent: 'center', paddingHorizontal: 20 },
  sendText: { color: '#FFFFFF', fontWeight: 'bold' }
});