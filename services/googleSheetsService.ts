import { SaleRecord } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("Google Sheets Webhook URL not configured. Skipping cloud sync.");
    return false;
  }

  // Ensure we always send an array under the 'records' key
  const data = Array.isArray(records) ? records : [records];
  
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'sync_records',
        records: data // Changed from 'payload' to 'records' to match your script
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
      headers: {
        'Content-Type': 'text/plain', // GAS handles text/plain better for JSON parsing in some contexts
      },
      body: JSON.stringify({ action: 'get_records' })
    });
    
    const text = await response.text();
    // Validate if the response is actually JSON
    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
      return JSON.parse(text) as SaleRecord[];
    }
    return null;
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
};