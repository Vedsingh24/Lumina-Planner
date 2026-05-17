import { GoogleGenAI } from "@google/genai";

// Keep the existing ai initialization to avoid changing runtime behavior here
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  // Convert natural language into an array of simple task objects and a conversational reply
  processAgenda: async (input: string): Promise<{reply: string, tasks: any[]}> => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are Lumina, an expert AI productivity assistant. 
        Analyze the user's input to extract actionable tasks AND formulate a natural, conversational response.
        
        Rules:
        1. If the user provides tasks (even casually, e.g., "gym 2 to 4"), extract them AND set 'reply' to a friendly, encouraging confirmation of what you added.
        2. If the user is just chatting (e.g., "Hi", "How are you doing?"), return an empty tasks array AND set 'reply' to an appropriate conversational response.
        3. IF AND ONLY IF the input is completely meaningless conversational filler, keyboard mashing, or highly incomprehensible (e.g., "asdfgasdf"), set 'reply' to EXACTLY "I couldn't understand that. Could you repeat?" and return an empty tasks array.
        
        Return ONLY a valid JSON object matching the requested schema.
        
        User Input: "${input}"`,
        config: {
          temperature: 0.3,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              reply: { type: "STRING", description: "Your conversational response to the user" },
              tasks: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    title: { type: "STRING" },
                    description: { type: "STRING" },
                    category: { type: "STRING", enum: ["Health", "Personal", "General", "Work", "Travel", "Finance", "Learning"] },
                    priority: { type: "STRING" },
                    startTime: { type: "STRING" },
                    endTime: { type: "STRING" }
                  },
                  required: ["title", "description", "category", "priority"]
                }
              }
            },
            required: ["reply", "tasks"]
          }
        }
      });

      let text = (response && response.text) ? response.text.trim() : '{}';
      // Strip markdown code block formatting if present
      if (text.startsWith('```')) {
        text = text.replace(/^```json\n?/, '').replace(/^```\n?/, '');
        text = text.replace(/\n?```$/, '');
      }
      text = text.trim();
      const parsed = JSON.parse(text);
      const tasksArray = Array.isArray(parsed.tasks) ? parsed.tasks : [];
      let fallbackReply = "I didn't quite catch that. Could you repeat?";
      if (tasksArray.length > 0) {
        fallbackReply = `I've created ${tasksArray.length} new tasks for you. Check your board!`;
      }
      
      return {
        reply: parsed.reply || fallbackReply,
        tasks: tasksArray
      };
    } catch (e: any) {
      console.error('processAgenda error:', e);
      let errorMsg = "I encountered a network or API error while processing that. Please try again.";
      if (e?.status === 403 || (e?.message && e.message.includes('403'))) {
        errorMsg = "API Key Error: Your API key is invalid, expired, or has been disabled (e.g. reported as leaked). Please generate a new API key and update it in .env.local.";
      } else if (e?.status === 503 || (e?.message && e.message.includes('503'))) {
        errorMsg = "The AI is currently experiencing high demand. Please try again in a moment.";
      }
      return { reply: errorMsg, tasks: [] };
    }
  }
};