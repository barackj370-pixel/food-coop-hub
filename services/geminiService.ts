import { GoogleGenAI } from "@google/genai";
import { SaleRecord } from "../types.ts";

export const analyzeSalesData = async (records: SaleRecord[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const salesSummary = records.map(r => ({
    date: r.date,
    crop: r.cropType,
    qty: r.unitsSold,
    unit: r.unitType,
    price: r.unitPrice,
    total: r.totalSale,
  }));

  const prompt = `Analyze these sales: ${JSON.stringify(salesSummary)}`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    return "Error generating AI report.";
  }
};