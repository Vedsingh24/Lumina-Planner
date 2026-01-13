import { GoogleGenAI, Type } from "@google/genai";

// Always use the process.env.API_KEY directly as required by the system instructions
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  processAgenda: async (agenda: string) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract a list of specific, actionable tasks from the following rough agenda points. For each task, suggest a title, a short description, a category (e.g., Work, Personal, Health, Finance, Learning), and a priority (low, medium, high). 
      
      Agenda: "${agenda}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: { type: Type.STRING },
                  priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                },
                required: ['title', 'category', 'priority']
              }
            }
          },
          required: ['tasks']
        }
      }
    });

    try {
      const result = JSON.parse(response.text);
      return result.tasks;
    } catch (error) {
      console.error("Failed to parse Gemini response:", error);
      return [];
    }
  },

  getDailyInspiration: async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Generate a one-sentence daily productivity mission or inspiring focus prompt for a personal planner. Make it punchy and motivational.",
    });
    return response.text;
  },

  getChatResponse: async (message: string, currentTasks: any[]) => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are Lumina, a helpful personal productivity assistant. You help the user manage their tasks and stay motivated. Here is the current state of their task list: ${JSON.stringify(currentTasks)}. Respond to the user's message in a friendly, concise, and encouraging way. User says: "${message}"`,
    });
    return response.text;
  }
};