import { GoogleGenAI } from "@google/genai";
import { SaleRecord } from "../types";
import { getEnv } from "./env";

export const analyzeSalesData = async (records: SaleRecord[]): Promise<string> => {
  if (!records || records.length === 0) {
    return "No sales records available for analysis.";
  }

  // Initialize the GoogleGenAI client with the API key
  const ai = new GoogleGenAI({ apiKey: getEnv('API_KEY') });
  
  // Create a streamlined dataset for the AI
  const salesSummary = records.map(r => ({
    date: r.date,
    crop: r.cropType,
    qty: `${r.unitsSold} ${r.unitType}`,
    price: r.unitPrice,
    total: r.totalSale,
    cluster: r.cluster || 'Unassigned',
    farmer: r.farmerName,
    customer: r.customerName
  }));

  const prompt = `
    Analyze the following agricultural sales records from our cooperative.
    
    Please generate a professional audit report in Markdown format.
    
    Your report should include:
    1. **Executive Summary**: A brief overview of the sales volume and revenue.
    2. **Cluster Performance**: Compare sales activity across different clusters.
    3. **Pricing Analysis**: Identify any pricing inconsistencies or anomalies for similar crops.
    4. **Key Insights**: Highlight top-performing farmers, frequent buyers, or unusual trends.
    5. **Recommendations**: Strategic advice for the cooperative management.

    Sales Data (JSON):
    ${JSON.stringify(salesSummary, null, 2)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are an expert agricultural economist and cooperative auditor. Provide data-driven insights with a professional tone.",
        temperature: 0.3,
        topP: 0.95,
        thinkingConfig: { thinkingBudget: 2048 },
      },
    });

    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return `Error generating AI report: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
};
