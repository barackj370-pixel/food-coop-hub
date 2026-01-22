import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from "../types.ts";
import { GOOGLE_SHEETS_WEBHOOK_URL } from "../constants.ts";

const safeNum = (val: any): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = String(val).replace(/[^\d.]/g, '');
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

// Sanitization helper to catch literal "undefined" strings
const cleanStr = (val: any): string => {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();
  if (s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return "";
  return s;
};

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;

  const rawData = Array.isArray(records) ? records : [records];
  const filteredData = rawData.filter(r => r.cluster && r.cluster !== 'Unassigned');
  
  if (filteredData.length === 0) return true; 

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
    agentName: r.agentName || "System Agent",
    agentPhone: r.agentPhone || "",
    signature: r.signature,
    cluster: r.cluster
  }));

  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'sync_records',
        records: mappedRecords,
        _t: Date.now()
      }),
    });
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
      cache: 'no-store',
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
    console.error("Cloud Record Delete Error:", error);
    return false;
  }
};

export const deleteUserFromCloud = async (phone: string): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'delete_user',
        phone: phone.trim(),
        _t: Date.now()
      })
    });
    const text = await response.text();
    return response.ok || text.toLowerCase().includes('success');
  } catch (error) {
    console.error("Cloud User Delete Error:", error);
    return false;
  }
};

export const deleteAllUsersFromCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'delete_all_users',
        _t: Date.now()
      })
    });
    const text = await response.text();
    return response.ok || text.toLowerCase().includes('success');
  } catch (error) {
    console.error("Cloud User Purge Error:", error);
    return false;
  }
};

export const deleteProduceFromCloud = async (id: string): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'delete_produce',
        id: id,
        _t: Date.now()
      })
    });
    const text = await response.text();
    return response.ok || text.toLowerCase().includes('success');
  } catch (error) {
    console.error("Cloud Produce Delete Error:", error);
    return false;
  }
};

export const deleteAllProduceFromCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'delete_all_produce',
        _t: Date.now()
      })
    });
    const text = await response.text();
    return response.ok || text.toLowerCase().includes('success');
  } catch (error) {
    console.error("Cloud Purge Error:", error);
    return false;
  }
};

export const fetchFromGoogleSheets = async (): Promise<SaleRecord[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
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
      const dataArray = Array.isArray(rawData) ? rawData : (rawData.data || rawData.records || []);
      return dataArray
        .filter((r: any) => r && (r["ID"] || r["id"]))
        .map((r: any) => ({
          id: cleanStr(r["ID"] || r["id"] || ""),
          date: formatDate(r["Date"] || r["date"]),
          cropType: cleanStr(r["Commodity"] || r["Crop Type"] || r["cropType"] || ""),
          farmerName: cleanStr(r["Farmer"] || r["Farmer Name"] || r["farmerName"] || ""),
          farmerPhone: cleanStr(r["Farmer Phone"] || r["farmerPhone"] || ""),
          customerName: cleanStr(r["Customer"] || r["Customer Name"] || r["customerName"] || ""),
          customerPhone: cleanStr(r["Customer Phone"] || r["customerPhone"] || ""),
          unitsSold: safeNum(r["Units"] || r["Units Sold"] || r["unitsSold"]),
          unitPrice: safeNum(r["Unit Price"] || r["Price"] || r["unitPrice"]),
          totalSale: safeNum(r["Total Gross"] || r["Total Sale"] || r["totalSale"]),
          coopProfit: safeNum(r["Commission"] || r["Coop Profit"] || r["coopProfit"]),
          status: cleanStr(r["Status"] || r["status"] || "DRAFT") as any,
          agentName: cleanStr(r["Agent"] || r["Agent Name"] || r["agentName"] || ""),
          agentPhone: cleanStr(r["Agent Phone"] || r["agentPhone"] || ""),
          cluster: cleanStr(r["Cluster"] || r["cluster"] || ""),
          createdAt: formatDate(r["Created At"] || r["createdAt"] || r["Date"]),
          synced: true,
          signature: cleanStr(r["Signature"] || r["signature"] || ""),
          unitType: cleanStr(r["Unit"] || r["Unit Type"] || r["unitType"] || "Kg"),
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
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
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
        },
        _t: Date.now()
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
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'get_users',
        _t: Date.now()
      })
    });
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const rawUsersRaw = JSON.parse(trimmed);
      const rawUsers = Array.isArray(rawUsersRaw) ? rawUsersRaw : (rawUsersRaw.data || rawUsersRaw.records || []);
      return rawUsers.map((u: any) => ({
        name: cleanStr(u["Name"] || u["name"] || ""),
        phone: cleanStr(u["Phone"] || u["phone"] || ""),
        role: cleanStr(u["Role"] || u["role"] || "") as any,
        passcode: cleanStr(u["Passcode"] || u["passcode"] || ""),
        cluster: cleanStr(u["Cluster"] || u["cluster"] || ""),
        status: cleanStr(u["Status"] || u["status"] || "ACTIVE") as any
      }));
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const syncOrderToCloud = async (order: MarketOrder): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'sync_order',
        order: {
          id: order.id,
          date: order.date,
          cropType: order.cropType,
          unitsRequested: order.unitsRequested,
          unitType: order.unitType,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          status: order.status,
          agentPhone: order.agentPhone,
          cluster: order.cluster
        },
        _t: Date.now()
      }),
    });
    const resultText = await response.text();
    return response.ok || resultText.toLowerCase().includes('success');
  } catch (e) {
    return false;
  }
};

export const fetchOrdersFromCloud = async (): Promise<MarketOrder[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'get_orders',
        _t: Date.now()
      })
    });
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const rawOrdersRaw = JSON.parse(trimmed);
      const rawOrders = Array.isArray(rawOrdersRaw) ? rawOrdersRaw : (rawOrdersRaw.data || rawOrdersRaw.records || []);
      return rawOrders.map((o: any) => ({
        id: cleanStr(o["ID"] || o["id"] || ""),
        date: formatDate(o["Date"] || o["date"]),
        cropType: cleanStr(o["Crop Type"] || o["cropType"] || ""),
        unitsRequested: safeNum(o["Units Requested"] || o["unitsRequested"]),
        unitType: cleanStr(o["Unit Type"] || o["unitType"] || ""),
        customerName: cleanStr(o["Customer Name"] || o["customerName"] || ""),
        customerPhone: cleanStr(o["Customer Phone"] || o["customerPhone"] || ""),
        status: cleanStr(o["Status"] || o["status"] || "OPEN") as any,
        agentPhone: cleanStr(o["Agent Phone"] || o["agentPhone"] || ""),
        cluster: cleanStr(o["Cluster"] || o["cluster"] || "")
      }));
    }
    return null;
  } catch (e) {
    return null;
  }
};

export const syncProduceToCloud = async (produce: ProduceListing): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        action: 'sync_produce',
        produce: {
          id: produce.id,
          date: produce.date,
          cropType: produce.cropType,
          unitsAvailable: produce.unitsAvailable,
          unitType: produce.unitType,
          sellingPrice: produce.sellingPrice,
          supplierName: produce.supplierName,
          supplierPhone: produce.supplierPhone,
          cluster: produce.cluster,
          status: produce.status
        },
        _t: Date.now()
      }),
    });
    const resultText = await response.text();
    return response.ok || resultText.toLowerCase().includes('success');
  } catch (e) {
    return false;
  }
};

export const fetchProduceFromCloud = async (): Promise<ProduceListing[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ 
        action: 'get_produce',
        _t: Date.now()
      })
    });
    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed && (trimmed.startsWith('[') || trimmed.startsWith('{'))) {
      const rawData = JSON.parse(trimmed);
      const dataArray = Array.isArray(rawData) ? rawData : (rawData.data || rawData.records || rawData.produce || []);
      
      return dataArray
        .filter((p: any) => p && (p.id || p.ID))
        .map((p: any) => {
          return {
            id: cleanStr(p.id || p.ID || ""),
            date: formatDate(p.date || p.Date || p["Posted Date"]),
            cropType: cleanStr(p.cropType || p["Crop Type"] || p.Commodity || ""),
            unitsAvailable: safeNum(p.unitsAvailable || p["Units Available"] || p.Quantity || p.Units),
            unitType: cleanStr(p.unitType || p["Unit Type"] || ""),
            sellingPrice: safeNum(p.sellingPrice || p["Selling Price"] || p["Asking Price"]),
            supplierName: cleanStr(p.supplierName || p["Supplier Name"] || p.Name),
            supplierPhone: cleanStr(p.supplierPhone || p["Supplier Phone"]),
            cluster: cleanStr(p.cluster || p.Cluster || ""),
            status: (cleanStr(p.status || p.Status || "AVAILABLE").toUpperCase() === "SOLD_OUT" ? "SOLD_OUT" : "AVAILABLE") as any,
          };
        });
    }
    return null; 
  } catch (e) {
    console.error("Produce Fetch Error:", e);
    return null;
  }
};