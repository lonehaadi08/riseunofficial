import { create } from 'zustand';
import { fetchTimetable } from '../services/timetable';

export interface ClassItem {
  id: string;
  dateStr: string;
  dateObj: Date;
  time: string;
  subject: string;
  teacher: string;
  room: string;
  isChanged: boolean;
}

export interface DaySchedule {
  title: string;
  dateObj: Date;
  daysDiff: number;
  data: ClassItem[];
}

interface TimetableState {
  allDailyRaw: any[];
  allWeeklyRaw: any[];
  dailySchedule: DaySchedule[];
  weeklySchedule: DaySchedule[];
  isLoading: boolean;
  lastUpdated: string | null;
  loadData: (userBatch: string) => Promise<void>;
  startAutoRefresh: (userBatch: string) => void;
}

// ---------------------------------------------------------
// EXPORTED PARSERS (So the UI's Teacher Radar can use them!)
// ---------------------------------------------------------

export const parseDateStr = (dateStr: string): Date => {
  const currentYear = new Date().getFullYear();
  const cleanDate = dateStr.split(',')[0].trim(); 
  const parts = cleanDate.split(' '); 
  
  let day = "01";
  let month = "01";
  
  if (parts.length >= 2) {
    day = parts[0].padStart(2, '0');
    const monthMap: Record<string, string> = {
      Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
      Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
    };
    month = monthMap[parts[1]] || '01';
  }

  // Hermes Engine (Android) safe ISO format
  return new Date(`${currentYear}-${month}-${day}T12:00:00`);
};

export const getTimeValue = (timeStr: string): number => {
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 0; 
  
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const upperTime = timeStr.toUpperCase();
  
  let isPM = upperTime.includes('PM');
  const isAM = upperTime.includes('AM');
  
  // Infer AM/PM if missing
  if (!isPM && !isAM) {
    if (hours >= 1 && hours <= 7) isPM = true;
  }
  
  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;
  
  return (hours * 60) + mins;
};

// ---------------------------------------------------------
// CORE ENGINE
// ---------------------------------------------------------

const processBatchData = (rawObj: any, isDaily: boolean = false): DaySchedule[] => {
  if (!rawObj) return [];
  
  const classes: ClassItem[] = [];
  const roomMap: Record<string, string> = {};

  for (const [key, value] of Object.entries(rawObj)) {
    if (key.startsWith('Room')) {
      const match = key.match(/Room \((.*?)\)/);
      if (match) roomMap[match[1].trim()] = value as string;
    }
  }

  for (const [key, value] of Object.entries(rawObj)) {
    if (key === 'Batch' || key.startsWith('Room')) continue;

    let dateStr = "";
    let timeStr = "";
    let subject = value as string;
    let teacher = "";
    
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

    if (!dateStr) continue;

    const teacherMatch = subject.match(/(.*)\((.*?)\)/);
    if (teacherMatch) {
      subject = teacherMatch[1].trim();
      teacher = teacherMatch[2].trim();
    }

    classes.push({
      id: key,
      dateStr,
      dateObj: parseDateStr(dateStr),
      time: timeStr,
      subject,
      teacher,
      room: roomMap[dateStr] || 'TBA',
      isChanged: isDaily 
    });
  }

  const grouped: Record<string, ClassItem[]> = {};
  classes.forEach(c => {
    if (!grouped[c.dateStr]) grouped[c.dateStr] = [];
    grouped[c.dateStr].push(c);
  });

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  return Object.keys(grouped).map(dateStr => {
    const dateObj = parseDateStr(dateStr);
    const daysDiff = Math.round((dateObj.getTime() - today.getTime()) / (1000 * 3600 * 24));
    const sortedData = grouped[dateStr].sort((a, b) => getTimeValue(a.time) - getTimeValue(b.time));
    return { title: dateStr, dateObj, daysDiff, data: sortedData };
  });
};

export const useTimetableStore = create<TimetableState>((set, get) => ({
  allDailyRaw: [],
  allWeeklyRaw: [],
  dailySchedule: [],
  weeklySchedule: [],
  isLoading: false,
  lastUpdated: null,

  loadData: async (userBatch: string) => {
    if (!userBatch) return;
    set({ isLoading: true });
    
    try {
      const data = await fetchTimetable();
      
      if (data && data.daily && data.weekly) {
        const targetBatch = userBatch.trim().toUpperCase();
        const rawDaily = data.daily.find((b: any) => b.Batch?.trim().toUpperCase() === targetBatch);
        const rawWeekly = data.weekly.find((b: any) => b.Batch?.trim().toUpperCase() === targetBatch);

        const parsedDaily = processBatchData(rawDaily, true);
        const parsedWeekly = processBatchData(rawWeekly, false);

        // Merge daily overrides
        const mergedWeekly = parsedWeekly.map(weekDay => {
          const dailyOverride = parsedDaily.find(d => d.title === weekDay.title);
          return dailyOverride ? dailyOverride : weekDay;
        });

        parsedDaily.forEach(dailyDay => {
          if (!mergedWeekly.find(w => w.title === dailyDay.title)) mergedWeekly.push(dailyDay); 
        });

        const filteredSortedWeekly = mergedWeekly
          .filter(day => day.daysDiff >= -14 && day.daysDiff <= 7)
          .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

        const todaysSchedule = parsedDaily.filter(day => day.daysDiff === 0);

        set({ 
          allDailyRaw: data.daily || [], 
          allWeeklyRaw: data.weekly || [], 
          dailySchedule: todaysSchedule, 
          weeklySchedule: filteredSortedWeekly,
          lastUpdated: data.metadata?.last_updated 
            ? new Date(data.metadata.last_updated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isLoading: false 
        });
      } else {
        set({ isLoading: false, lastUpdated: 'Invalid Format' });
      }
    } catch (error) {
      set({ isLoading: false, lastUpdated: 'Network Error' });
    }
  },

  startAutoRefresh: (userBatch: string) => {
    if (!userBatch) return;
    get().loadData(userBatch);
    setInterval(() => {
      const store = get();
      if (!store.isLoading) store.loadData(userBatch);
    }, 600000); 
  }
}));