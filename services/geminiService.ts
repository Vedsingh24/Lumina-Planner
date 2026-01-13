import { GoogleGenAI } from "@google/genai";

// Keep the existing ai initialization to avoid changing runtime behavior here
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  // Convert a rough agenda into an array of simple task objects
  processAgenda: async (agenda: string) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract specific, actionable tasks from the agenda below. Return ONLY a JSON array. For each task include title, description, category (Work/Personal/Health/Finance/Learning) and priority (low/medium/high).\n\nAgenda: "${agenda}"`,
      });

      const text = (response && response.text) ? response.text.trim() : '';
      // Try to find a JSON array inside the response
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
        model: 'gemini-3-flash-preview',
        contents: 'Generate a one-sentence daily productivity mission for a personal planner. Keep it under 15 words.',
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
  }
};