import { GoogleGenAI } from "@google/genai";

// Keep the existing ai initialization to avoid changing runtime behavior here
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  // Convert natural language into an array of simple task objects
  processAgenda: async (input: string) => {
    // Guard against offline usage
    if (!navigator.onLine) {
      console.warn('Offline — skipping Gemini API call');
      return [];
    }
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert planner assistant. Extract all actionable tasks from the following user input.
        Even if the grammar is poor, casual, or shorthand (e.g., "gym 2 to 4"), identify the intent and create tasks.
        IF AND ONLY IF the input is completely meaningless conversational filler or keyboard mashing (e.g., "asdf" or "hello"), return an empty array: []
        
        Return ONLY a valid JSON array of task objects.
        For each task include:
        - title (string)
        - description (string, brief)
        - category (one of: General, Work, Personal, Health, Finance, Learning)
        - priority (one of: low, medium, high)
        - startTime (optional string, strictly 24-hour "HH:mm" format if implied)
        - endTime (optional string, strictly 24-hour "HH:mm" format if implied or calculable from duration)

        User Input: "${input}"`,
        config: { 
          temperature: 0.1,
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
  }
};