import { SaleRecord, AgentIdentity } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

const safeNum = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^\d.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const formatDate = (dateVal: any): string => {
  if (!dateVal) return "";
  try {
    const d = new Date(dateVal);
    return d.toISOString().split('T')[0];
  } catch (e) {
    return String(dateVal).split('T')[0];
  }
};

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
    unitType: r.unitType,
    farmerName: r.farmerName,
    farmerPhone: r.farmerPhone || "", 
    customerName: r.customerName || "",
    customerPhone: r.customerPhone || "",
    unitsSold: r.unitsSold,
    unitPrice: r.unitPrice, 
    totalSale: r.totalSale,
    coopProfit: r.coopProfit,
    status: r.status,
    createdBy: r.agentName || "System Agent",
    agentPhone: r.agentPhone || "",
    signature: r.signature
  }));

  try {
    await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      mode: 'no-cors', 
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'sync_records',
        records: mappedRecords,
        _t: Date.now() // Cache busting
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
      body: JSON.stringify({ 
        action: 'get_records',
        _t: Date.now() // Cache busting
      })
    });
    
    const text = await response.text();
    const trimmed = text.trim();
    
    // Check if the response is JSON (either array or object)
    if (trimmed && (trimmed.startsWith('[') || trimmed.startsWith('{'))) {
      const rawData = JSON.parse(trimmed);
      const dataArray = Array.isArray(rawData) ? rawData : [];
      
      // If we got an empty array from the cloud, it's explicitly cleared
      return dataArray.map(r => ({
        id: String(r["ID"] || ""),
        date: formatDate(r["Date"]),
        cropType: String(r["Commodity"] || r["Crop Type"] || ""),
        farmerName: String(r["Farmer"] || r["Farmer Name"] || ""),
        farmerPhone: String(r["Farmer Phone"] || ""),
        customerName: String(r["Customer"] || r["Customer Name"] || ""),
        customerPhone: String(r["Customer Phone"] || ""),
        unitsSold: safeNum(r["Units"] || r["Units Sold"]),
        unitPrice: safeNum(r["Unit Price"] || r["Price per Unit"] || r["Price"]),
        totalSale: safeNum(r["Total Gross"] || r["Total Sale"] || r["Total"]),
        coopProfit: safeNum(r["Commission"] || r["Commission 10%"] || r["Coop Profit"]),
        status: String(r["Status"] || "DRAFT") as any,
        agentName: String(r["Agent"] || r["Agent Name"] || ""),
        agentPhone: String(r["Agent Phone"] || ""),
        createdAt: formatDate(r["Date"]),
        synced: true,
        signature: String(r["Signature"] || ""),
        unitType: String(r["Unit"] || r["Unit Type"] || "Kg"),
      })) as SaleRecord[];
    }
    
    // If the response is success but not JSON, it implies the database is empty.
    // Return empty array to force all devices to clear their local state.
    return [];
  } catch (error) {
    console.error("Fetch Error:", error);
    return null;
  }
};

export const clearAllRecordsOnCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'clear_records',
        _t: Date.now()
      }),
    });
    return response.ok;
  } catch (error) {
    console.error("Clear Cloud Records Error:", error);
    return false;
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
      body: JSON.stringify({ 
        action: 'get_users',
        _t: Date.now()
      })
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