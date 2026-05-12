const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: 'AIzaSyCsKca3a-wxDF_RgYNsv9pT-Cf9MX4qnL0' });

async function run() {
  const input = 'Today I would like to do thus : 1) Pack my bags 2) Create a detailed plan for goal settings and implementation 3) Hit the gym and drink protein shake 4) Finish up with website work';
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
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: {
            reply: { type: 'STRING', description: 'Your conversational response to the user' },
            tasks: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  title: { type: 'STRING' },
                  description: { type: 'STRING' },
                  category: { type: 'STRING' },
                  priority: { type: 'STRING' },
                  startTime: { type: 'STRING' },
                  endTime: { type: 'STRING' }
                },
                required: ['title', 'description', 'category', 'priority']
              }
            }
          },
          required: ['reply', 'tasks']
        }
      }
    });
    console.log('SUCCESS:', response.text);
  } catch (e) {
    console.error('ERROR_CAUGHT:', e);
  }
}
run();
