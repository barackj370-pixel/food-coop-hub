import { SaleRecord } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("Google Sheets Webhook URL not configured.");
    return false;
  }

  const data = Array.isArray(records) ? records : [records];
  
  // Map fields to match exactly what your Apps Script expects:
  // r.id, r.date, r.cropType, r.farmerName, r.unitsSold, r.totalSale, r.coopProfit, r.status, r.createdBy
  const payload = data.map(r => ({
    ...r,
    createdBy: r.agentName || "System" // Mapping agentName to createdBy for your script
  }));

  try {
    // Using a 'simple' request format to ensure it passes through no-cors correctly
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      cache: 'no-cache',
      body: JSON.stringify({
        action: 'sync_records',
        records: payload
      }),
    });
    return true;
  } catch (error) {
    console.error("Google Sheets Sync Error:", error);
    return false;
  }
};

export const fetchFromGoogleSheets = async (): Promise<SaleRecord[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;

  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_records' })
    });
    
    const text = await response.text();
    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
      return JSON.parse(text) as SaleRecord[];
    }
    return null;
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
};