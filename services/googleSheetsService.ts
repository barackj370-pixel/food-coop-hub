import { SaleRecord, AgentIdentity } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("Google Sheets Webhook URL not configured.");
    return false;
  }

  const rawData = Array.isArray(records) ? records : [records];
  
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
      headers: { 'Content-Type': 'text/plain' },
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
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'get_records' })
    });
    
    const text = await response.text();
    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
      const rawData = JSON.parse(text) as any[];
      // Map cloud headers back to application keys
      return rawData.map(r => ({
        id: String(r["ID"] || ""),
        date: String(r["Date"] || ""),
        cropType: String(r["Commodity"] || ""),
        farmerName: String(r["Farmer"] || ""),
        farmerPhone: String(r["Farmer Phone"] || ""),
        unitsSold: Number(r["Units"] || 0),
        unitPrice: Number(r["Unit Price"] || 0),
        totalSale: Number(r["Total Gross"] || 0),
        coopProfit: Number(r["Commission"] || 0),
        status: String(r["Status"] || "DRAFT") as any,
        agentName: String(r["Agent"] || ""),
        agentPhone: String(r["Agent Phone"] || ""),
        createdAt: String(r["Date"] || new Date().toISOString()), // Fallback
        synced: true,
        signature: "", // Re-computation happens on client
        unitType: "Kg", // Fallback for cloud data
        customerName: "Cloud Customer",
        customerPhone: ""
      })) as SaleRecord[];
    }
    return null;
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
};

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
      const rawUsers = JSON.parse(text) as any[];
      return rawUsers.map(u => ({
        name: String(u["Name"] || ""),
        phone: String(u["Phone"] || ""),
        role: String(u["Role"] || "") as any,
        passcode: String(u["Passcode"] || ""),
        cluster: String(u["Cluster"] || ""),
        status: String(u["Status"] || "ACTIVE") as any
      }));
    }
    return null;
  } catch (e) {
    console.error("Fetch Cloud Users Error:", e);
    return null;
  }
};