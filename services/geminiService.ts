import { GoogleGenAI } from "@google/genai";

// Keep the existing ai initialization to avoid changing runtime behavior here
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  // Convert natural language into an array of simple task objects
  processAgenda: async (input: string) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Analyze the following user input.
        If the input is complete gibberish or clearly not actionable, return exactly an empty array: []
        If the input has poor grammar but implies actionable tasks, auto-correct the intent and extract the tasks.
        Return ONLY a valid JSON array of task objects (no markdown, no backticks).
        For each task include:
        - title (string)
        - description (string, brief)
        - category (one of: General, Work, Personal, Health, Finance, Learning)
        - priority (one of: low, medium, high)

        User Input: "${input}"`,
        config: { 
          temperature: 0,
          responseMimeType: "application/json"
        }
      });

      const text = (response && response.text) ? response.text.trim() : '';
      // Try to find a JSON array inside the response (handles markdown code blocks if any)
      const match = text.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error('processAgenda error:', e);
      return [];
    }
  },

  // Cache daily inspiration locally (one call per day)
  getDailyInspiration: async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const cached = localStorage.getItem('dailyInspirationCache');
      const cacheDay = localStorage.getItem('dailyInspirationTime');
      if (cached && cacheDay === today) return cached;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Generate a one-sentence daily productivity mission for a personal planner. Keep it under 15 words.',
        config: { temperature: 0.4 }
      });
      const text = response && response.text ? response.text.trim() : 'Make today count.';
      localStorage.setItem('dailyInspirationCache', text);
      localStorage.setItem('dailyInspirationTime', today);
      return text;
    } catch (e) {
      console.error('getDailyInspiration error:', e);
      return 'Make today count.';
    }
  },

  // Use local canned responses to avoid frequent API calls for small chats
  getChatResponse: async (message: string, currentTasks: any[]) => {
    const canned = [
      "You got this! Keep focused on what matters most.",
      "That sounds like a solid plan. How can I help you organize it?",
      "Great energy! Break that down into smaller tasks if you need to.",
      "I'm here to help. Want me to turn this into actionable tasks?",
      "Perfect mindset! Let's make it happen.",
      "Love the ambition. What's the first step?"
    ];
    return canned[Math.floor(Math.random() * canned.length)];
  },

  // Generate a new daily mission on demand (limit 3 per day)
  generateDailyMission: async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const usageKey = `dailyMissionUsage_${today}`;
      const count = parseInt(localStorage.getItem(usageKey) || '0', 10);

      if (count >= 3) {
        throw new Error("Daily mission generation limit reached (3/3).");
      }

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Generate exactly ONE inspirational, deep, optimistic, and thought-provoking philosophical quote from a famous author or philosopher. The quote must be short (under 20 words). Format the output exactly as: "Quote text here." - Author Name. Do NOT return a list or extra text.',
        config: { temperature: 0.6 }
      });
      const text = response && response.text ? response.text.trim().replace(/"/g, '') : 'Fulfill your duty with goodness.';

      localStorage.setItem(usageKey, (count + 1).toString());
      localStorage.setItem('dailyInspirationCache', text);
      localStorage.setItem('dailyInspirationTime', today);
      return text;
    } catch (e) {
      console.error('generateDailyMission error:', e);
      throw e;
    }
  }
};