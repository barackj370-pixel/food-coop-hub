import { GoogleGenAI } from "@google/genai";
import { SaleRecord } from "../types";
import { getEnv } from "./env";

export const analyzeSalesData = async (records: SaleRecord[]): Promise<string> => {
  // Initialize the GoogleGenAI client with the API key
  // The client will handle authentication errors internally if the key is invalid/missing
  const ai = new GoogleGenAI({ apiKey: getEnv('API_KEY') });
  
  const salesSummary = records.map(r => ({
    date: r.date,
    crop: r.cropType,
    qty: r.unitsSold,
    unit: r.unitType,
    price: r.unitPrice,
    total: r.totalSale,
    farmer: `${r.farmerName} (${r.farmerPhone})`,
    customer: `${r.customerName} (${r.customerPhone})`,
  }));

  const prompt = `
    Analyze the following agricultural sales records from our cooperative.
    
    In your report:
    1. Transaction Performance: Audit pricing consistency and volume for the recorded sales.
    2. Pricing Anomalies: Identify any transactions that seem outside the market norm.
    3. Customer Insights: Identify repeat customers or significant buyer trends.
    4. Audit Conclusions: Provide high-level recommendations for management.

    Sales Data (JSON):
    ${JSON.stringify(salesSummary, null, 2)}

    Format your response as a professional auditing report in markdown.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
      },
    });

    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Error generating AI report: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};
