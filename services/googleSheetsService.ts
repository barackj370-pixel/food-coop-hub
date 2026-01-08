import { SaleRecord } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("Google Sheets Webhook URL not configured.");
    return false;
  }

  // Ensure we have an array
  const rawData = Array.isArray(records) ? records : [records];
  
  // Explicitly map fields to match the variables used in your Apps Script:
  // r.id, r.date, r.cropType, r.farmerName, r.unitsSold, r.totalSale, r.coopProfit, r.status, r.createdBy
  const mappedRecords = rawData.map(r => ({
    id: r.id,
    date: r.date,
    cropType: r.cropType,
    farmerName: r.farmerName,
    unitsSold: r.unitsSold,
    totalSale: r.totalSale,
    coopProfit: r.coopProfit,
    status: r.status,
    createdBy: r.agentName || "System Agent" // Maps to Agent column
  }));

  try {
    // We use text/plain because application/json triggers CORS pre-flight
    // Google Apps Script handles JSON.parse(e.postData.contents) best this way.
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      cache: 'no-cache',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: JSON.stringify({
        action: 'sync_records',
        records: mappedRecords
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
    // Fetching requires a standard POST (not no-cors) because we need the response
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
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