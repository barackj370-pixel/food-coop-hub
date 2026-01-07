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
      mode: 'no-cors', // Standard for Google Apps Script web apps
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timestamp: new Date().toISOString(),
        action: 'sync_records',
        payload: data
      }),
    });

    // Since 'no-cors' doesn't allow reading the response body, 
    // we assume success if no error was thrown during fetch.
    return true;
  } catch (error) {
    console.error("Google Sheets Sync Error:", error);
    return false;
  }
};