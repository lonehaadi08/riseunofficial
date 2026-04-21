import axios from 'axios';

const TIMETABLE_URL = 'https://raw.githubusercontent.com/lonehaadi08/school-timetable/main/public/data.json';

export const fetchTimetable = async () => {
  try {
    console.log("-----------------------------------------");
    console.log("1. ATTEMPTING TO FETCH TIMETABLE...");
    const response = await axios.get(TIMETABLE_URL, {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Expires': '0' }
    });
    
    console.log("2. SUCCESS! Data downloaded from GitHub.");
    console.log("3. Daily Batches Found:", response.data?.daily?.length || 0);
    console.log("-----------------------------------------");
    
    return response.data;
  } catch (error: any) {
    console.log("-----------------------------------------");
    console.error('CRITICAL FETCH ERROR:', error.message);
    console.log("-----------------------------------------");
    return null;
  }
};