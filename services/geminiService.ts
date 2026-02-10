
import { GoogleGenAI } from "@google/genai";
import { SaleRecord } from "../types";
import { getEnv } from "./env";

export const analyzeSalesData = async (records: SaleRecord[]): Promise<string> => {
  // Use getEnv to support runtime injection via window.APP_ENV
  const apiKey = getEnv('API_KEY');

  // Ensure the API key is present
  if (!apiKey) {
    return "API Key not configured. Please ensure your environment is set up correctly.";
  }

  // Initialize the GoogleGenAI client with the API key
  const ai = new GoogleGenAI({ apiKey });
  
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
    // Generate content using the recommended model and passing both model name and prompt directly
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Access .text property directly (not as a method)
    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Error generating AI report: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};
