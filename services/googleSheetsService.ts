import { SaleRecord } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("Google Sheets Webhook URL not configured. Skipping cloud sync.");
    return false;
  }

  const data = Array.isArray(records) ? records : [records];
  
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'sync_records',
        payload: data
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
    // Note: To fetch data, the Apps Script must handle the redirect and return JSON.
    // We use POST with a 'get_records' action to bypass some CORS issues with simple GETs on GAS.
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_records' })
    });
    
    // Some browser environments might still block the body on no-cors POST.
    // If the script is deployed as 'Anyone', a standard fetch without no-cors usually works.
    const text = await response.text();
    return JSON.parse(text) as SaleRecord[];
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
};