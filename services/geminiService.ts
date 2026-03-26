
import { GoogleGenAI, Type } from "@google/genai";
import { RoadmapResponse } from "../types";

const API_KEY = process.env.API_KEY || "";

export const generateRoadmap = async (prompt: string): Promise<RoadmapResponse | null> => {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate a professional digital innovation roadmap for the following project idea: ${prompt}. Position this as coming from Onedigispot, a top-tier Kenyan tech hub.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projectName: { type: Type.STRING },
            summary: { type: Type.STRING },
            phases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  tasks: { type: Type.ARRAY, items: { type: Type.STRING } },
                  duration: { type: Type.STRING }
                },
                required: ["name", "tasks", "duration"]
              }
            },
            techStack: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["projectName", "summary", "phases", "techStack"]
        }
      }
    });

    return JSON.parse(response.text.trim());
  } catch (error) {
    console.error("Error generating roadmap:", error);
    return null;
  }
};

export const chatWithAssistant = async (message: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: "You are 'Spot', the AI assistant for Onedigispot, a leading digital innovation hub in Kenya. Your goal is to help potential clients understand how Onedigispot can build custom apps and web apps for their organizations. You are professional, tech-savvy, and warm. Emphasize that we are based in Nairobi but serve global standards.",
      }
    });
    
    // Note: We're not using history in this simple implementation to avoid complex state management for this demo, 
    // but the API supports it via `history` in `chats.create`.
    const response = await chat.sendMessage({ message });
    return response.text;
  } catch (error) {
    console.error("Assistant error:", error);
    return "I'm having a bit of a technical hiccup. Feel free to contact us via the form!";
  }
};
