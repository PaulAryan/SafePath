import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export const generateSafetyBriefing = async (
  safetyScore: number,
  metrics: any,
  distance: number,
  duration: number
) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: `Analyze the safety of this route. 
      Safety Score: ${safetyScore}/100. 
      Metrics: Crime Safety ${metrics.crimeSafety}%, Lighting ${metrics.lighting}%, Crowd Density ${metrics.crowdDensity}%, Infrastructure ${metrics.infrastructure}%.
      The route is ${distance / 1000}km long and takes ${Math.round(duration / 60)} minutes.
      Provide a concise, professional safety briefing (max 150 words) highlighting specific precautions and why this route was chosen as the safest.`,
    });
    return response.text;
  } catch (error) {
    console.error("Briefing generation failed:", error);
    throw new Error("Unable to generate live safety briefing at this time.");
  }
};
