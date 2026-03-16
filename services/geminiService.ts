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