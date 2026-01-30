
import { GoogleGenAI } from "@google/genai";
import { SaleRecord } from "../types.ts";

export const analyzeSalesData = async (records: SaleRecord[]): Promise<string> => {
  // Check if API_KEY is available in the environment
  if (!process.env.API_KEY) {
    return "API Key not configured. Please ensure process.env.API_KEY is available.";
  }

  // Fix: Initializing GoogleGenAI instance right before the API call using a named parameter.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const salesSummary = records.map(r => ({
    date: r.date,
    product: r.productType,
    qty: r.unitsSold,
    unit: r.unitType,
    price: r.unitPrice,
    total: r.totalSale,
    farmer: `${r.farmerName} (${r.farmerPhone})`,
    customer: `${r.customerName} (${r.customerPhone})`,
  }));

  const prompt = `
    Analyze the following agricultural and product sales records from our cooperative.
    
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
    // Fix: Using 'gemini-3-pro-preview' for the complex reasoning task of auditing sales data.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        topP: 0.95,
      },
    });

    // Fix: Directly accessing the .text property from GenerateContentResponse as per guidelines.
    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Error generating AI report: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};
