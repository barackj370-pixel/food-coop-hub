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
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch (e) {
    return String(dateVal).split('T')[0];
  }
};

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;

  const rawData = Array.isArray(records) ? records : [records];
  // STRICTOR FILTER: Never sync unassigned records
  const filteredData = rawData.filter(r => r.cluster && r.cluster !== 'Unassigned');
  
  if (filteredData.length === 0) {
    console.warn("Sync blocked: All records were 'Unassigned' cluster.");
    return true; 
  }

  const mappedRecords = filteredData.map(r => ({
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
    agentName: r.agentName || "System Agent", // Changed from createdBy to match retrieval key
    agentPhone: r.agentPhone || "",
    signature: r.signature,
    cluster: r.cluster
  }));

  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-cache',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'sync_records',
        records: mappedRecords,
        _t: Date.now()
      }),
    });
    
    // Using text() check because Google Apps Script might return a string like "Success"
    const resultText = await response.text();
    return response.ok || resultText.toLowerCase().includes('success');
  } catch (error) {
    console.error("Cloud Sync Error:", error);
    return false;
  }
};

export const deleteRecordFromCloud = async (id: string): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'delete_record',
        id: id,
        _t: Date.now()
      })
    });
    const text = await response.text();
    return response.ok || text.toLowerCase().includes('success');
  } catch (error) {
    console.error("Cloud Delete Error:", error);
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
        _t: Date.now()
      })
    });
    
    const text = await response.text();
    const trimmed = text.trim();
    
    if (trimmed && (trimmed.startsWith('[') || trimmed.startsWith('{'))) {
      const rawData = JSON.parse(trimmed);
      const dataArray = Array.isArray(rawData) ? rawData : [];
      
      return dataArray
        .filter(r => {
          // STRICTOR SOURCE FILTER: Discard any 'Unassigned' cluster records at the source
          const cluster = String(r["Cluster"] || r["cluster"] || "");
          return (r["ID"] || r["id"]) && cluster !== 'Unassigned' && cluster.trim() !== '';
        })
        .map(r => ({
          id: String(r["ID"] || r["id"] || ""),
          date: formatDate(r["Date"] || r["date"]),
          cropType: String(r["Commodity"] || r["Crop Type"] || r["cropType"] || ""),
          farmerName: String(r["Farmer"] || r["Farmer Name"] || r["farmerName"] || ""),
          farmerPhone: String(r["Farmer Phone"] || r["farmerPhone"] || ""),
          customerName: String(r["Customer"] || r["Customer Name"] || r["customerName"] || ""),
          customerPhone: String(r["Customer Phone"] || r["customerPhone"] || ""),
          unitsSold: safeNum(r["Units"] || r["Units Sold"] || r["unitsSold"]),
          unitPrice: safeNum(r["Unit Price"] || r["Price"] || r["unitPrice"]),
          totalSale: safeNum(r["Total Gross"] || r["Total Sale"] || r["totalSale"]),
          coopProfit: safeNum(r["Commission"] || r["Coop Profit"] || r["coopProfit"]),
          status: String(r["Status"] || r["status"] || "DRAFT") as any,
          agentName: String(r["Agent"] || r["Agent Name"] || r["agentName"] || ""),
          agentPhone: String(r["Agent Phone"] || r["agentPhone"] || ""),
          cluster: String(r["Cluster"] || r["cluster"] || ""),
          createdAt: formatDate(r["Created At"] || r["createdAt"] || r["Date"]),
          synced: true,
          signature: String(r["Signature"] || r["signature"] || ""),
          unitType: String(r["Unit"] || r["Unit Type"] || r["unitType"] || "Kg"),
        })) as SaleRecord[];
    }
    
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
        confirm: true,
        purge: true,
        auth: 'system_admin_reset',
        _t: Date.now()
      }),
    });
    const text = await response.text();
    return response.ok || text.toLowerCase().includes('success');
  } catch (error) {
    return false;
  }
};

export const clearAllUsersOnCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'clear_users',
        confirm: true,
        auth: 'system_admin_identity_reset',
        _t: Date.now()
      }),
    });
    const text = await response.text();
    return response.ok || text.toLowerCase().includes('success');
  } catch (error) {
    return false;
  }
};

export const syncUserToCloud = async (user: AgentIdentity): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
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
    const resultText = await response.text();
    return response.ok || resultText.toLowerCase().includes('success');
  } catch (e) {
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
    return null;
  }
};