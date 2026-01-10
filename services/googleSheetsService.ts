import { SaleRecord, AgentIdentity } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("Google Sheets Webhook URL not configured.");
    return false;
  }

  // Ensure we have an array
  const rawData = Array.isArray(records) ? records : [records];
  
  // Explicitly map fields to match the variables used in your Apps Script:
  const mappedRecords = rawData.map(r => ({
    id: r.id,
    date: r.date,
    cropType: r.cropType,
    farmerName: r.farmerName,
    farmerPhone: r.farmerPhone || "", 
    unitsSold: r.unitsSold,
    unitPrice: r.unitPrice, 
    totalSale: r.totalSale,
    coopProfit: r.coopProfit,
    status: r.status,
    createdBy: r.agentName || "System Agent",
    agentPhone: r.agentPhone || "" 
  }));

  try {
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

/**
 * NEW: Sync a single user to the cloud for cross-device login.
 */
export const syncUserToCloud = async (user: AgentIdentity): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'sync_user',
        user: {
          name: user.name,
          phone: user.phone,
          role: user.role,
          passcode: user.passcode,
          cluster: user.cluster,
          status: user.status
        }
      }),
    });
    return true;
  } catch (e) {
    console.error("Cloud User Sync Error:", e);
    return false;
  }
};

/**
 * NEW: Fetch all registered users from the cloud.
 */
export const fetchUsersFromCloud = async (): Promise<AgentIdentity[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'get_users' })
    });
    const text = await response.text();
    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
      return JSON.parse(text) as AgentIdentity[];
    }
    return null;
  } catch (e) {
    console.error("Fetch Cloud Users Error:", e);
    return null;
  }
};