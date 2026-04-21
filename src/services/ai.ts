import axios from 'axios';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY;

export const askAI = async (prompt: string, contextData: any) => {
  const { user, dailySchedule, weeklySchedule } = contextData;

  // 1. Build a highly readable text summary of the schedules to save tokens and improve AI accuracy
  const buildScheduleText = (scheduleArray: any[]) => {
    if (!scheduleArray || scheduleArray.length === 0) return "No classes scheduled.";
    return scheduleArray.map(day => {
      const classes = day.data.map((c: any) => `  - ${c.time}: ${c.subject} by Teacher ${c.teacher || 'TBA'} in Room ${c.room}`).join('\n');
      return `${day.title}:\n${classes}`;
    }).join('\n\n');
  };

  const studentProfile = `Name: ${user?.name || 'Student'}\nBatch: ${user?.batch || 'Unknown'}\nAim/Goal: ${user?.aim || 'Not stated'}`;
  const todayClasses = buildScheduleText(dailySchedule);
  const weekClasses = buildScheduleText(weeklySchedule);

  // 2. The Ultimate System Context with strict behavioral constraints
  const systemContext = `You are a highly intelligent, upbeat, and strictly factual academic AI assistant for a student.

--- STUDENT PROFILE ---
${studentProfile}

--- TODAY'S SCHEDULE ---
${todayClasses}

--- UPCOMING WEEKLY SCHEDULE ---
${weekClasses}

--- STRICT BEHAVIORAL RULES ---
1. KNOWLEDGE: Answer questions accurately based ONLY on the provided schedules and profile. You know everything about their classes, timings, rooms, and teachers based on this data.
2. NO NEGATIVITY: NEVER provide a negative, rude, or unhelpful answer. Always remain highly encouraging, supportive, and positive.
3. NEVER YIELD ON FACTS: NEVER agree with the student over facts if they are wrong. If the student claims they have a class at 9 PM, but the schedule says 9 AM, politely but firmly correct them. Your provided JSON data is the absolute truth. Do not let the student gaslight you into agreeing with incorrect schedule details.
4. TONE: Keep your responses friendly, concise, and easy to read on a mobile screen. Use emojis appropriately.`;

  try {
    // ENGINE 1: Gemini 1.5 Flash
    const geminiResponse = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: `${systemContext}\n\nStudent: ${prompt}` }] }] },
      { headers: { 'Content-Type': 'application/json' }, timeout: 8000 }
    );
    return geminiResponse.data.candidates[0].content.parts[0].text;
    
  } catch (geminiError: any) {
    console.warn('Gemini unavailable/Timeout. Switching to Groq...');

    try {
      // ENGINE 2: Llama 3.1 8B via Groq
      const groqResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemContext },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.3 // Lower temperature makes the AI more factual and less prone to hallucination
        },
        {
          headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 8000
        }
      );
      return groqResponse.data.choices[0].message.content;
    } catch (groqError: any) {
      console.error('AI Error:', groqError.response?.data || groqError.message);
      return "I am currently offline! Please check your schedule manually for now. ✨";
    }
  }
};