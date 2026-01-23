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

const cleanStr = (val: any): string => {
  if (val === undefined || val === null) return "";
  const s = String(val).trim();
  if (s.toLowerCase() === "undefined" || s.toLowerCase() === "null") return "";
  return s;
};

// Robust helper to find values in an object using multiple possible keys (case-insensitive and trimmed)
const getFlexibleVal = (obj: any, keys: string[]): any => {
  if (!obj) return undefined;
  const objKeys = Object.keys(obj);
  const normalizedMap = new Map<string, string>();
  objKeys.forEach(k => normalizedMap.set(k.trim().toLowerCase(), k));

  for (const k of keys) {
    const searchKey = k.trim().toLowerCase();
    if (normalizedMap.has(searchKey)) {
      return obj[normalizedMap.get(searchKey)!];
    }
  }
  return undefined;
};

// Resilient JSON extractor to handle cases where GAS might prepend or append non-JSON text
const extractJson = (str: string): any => {
  const trimmed = str.trim();
  try { return JSON.parse(trimmed); } catch (e) {
    // Try finding an array first
    const startArr = trimmed.indexOf('[');
    const endArr = trimmed.lastIndexOf(']');
    if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
      try { return JSON.parse(trimmed.substring(startArr, endArr + 1)); } catch (err) {}
    }
    // Try finding an object
    const startObj = trimmed.indexOf('{');
    const endObj = trimmed.lastIndexOf('}');
    if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
      try { return JSON.parse(trimmed.substring(startObj, endObj + 1)); } catch (err) {}
    }
    return null;
  }
};

// Helper to find the first array in a response object (handles various GAS return formats)
const findDataArray = (data: any): any[] | null => {
  if (Array.isArray(data)) return data;
  if (typeof data !== 'object' || data === null) return null;
  
  const keys = ['data', 'records', 'users', 'userList', 'members', 'rows', 'result', 'body', 'values'];
  for (const key of keys) {
    if (Array.isArray(data[key])) return data[key];
  }
  
  for (const key in data) {
    if (Array.isArray(data[key])) {
      if (data[key].length > 0) return data[key];
    }
  }
  return null;
};

export const syncToGoogleSheets = async (records: SaleRecord | SaleRecord[]): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  const rawData = Array.isArray(records) ? records : [records];
  const filteredData = rawData.filter(r => r.cluster && r.cluster !== 'Unassigned');
  if (filteredData.length === 0) return true; 
  
  const mappedRecords = filteredData.map(r => ({
    "ID": r.id,
    "Date": r.date,
    "Commodity": r.cropType,
    "Unit": r.unitType,
    "Farmer ": r.farmerName, 
    "Farmer Phone": r.farmerPhone || "",
    "Customer": r.customerName || "",
    "Customer Phone": r.customerPhone || "",
    "Units Sold": r.unitsSold,
    "Price per unit": r.unitPrice, 
    "Total Gross": r.totalSale,
    "Commission": r.coopProfit,
    "Status": r.status,
    "Agent": r.agentName || "System Agent",
    "Agent Phone ": r.agentPhone || "", 
    "Signature": r.signature,
    "Cluster": r.cluster,
    "Created At": r.createdAt
  }));

  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync_records', records: mappedRecords, _t: Date.now() }),
    });
    return response.ok;
  } catch (error) { return false; }
};

export const deleteRecordFromCloud = async (id: string): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete_record', id: id, _t: Date.now() })
    });
    return response.ok;
  } catch (error) { return false; }
};

export const deleteUserFromCloud = async (phone: string): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete_user', phone: phone.trim(), _t: Date.now() })
    });
    return response.ok;
  } catch (error) { return false; }
};

export const deleteAllUsersFromCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete_all_users', _t: Date.now() })
    });
    return response.ok;
  } catch (error) { return false; }
};

export const deleteProduceFromCloud = async (id: string): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete_produce', id: id, _t: Date.now() })
    });
    return response.ok;
  } catch (error) { return false; }
};

export const deleteAllProduceFromCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete_all_produce', _t: Date.now() })
    });
    return response.ok;
  } catch (error) { return false; }
};

export const deleteAllOrdersFromCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete_all_orders', _t: Date.now() })
    });
    return response.ok;
  } catch (error) { return false; }
};

export const deleteAllRecordsFromCloud = async (): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'delete_all_records', _t: Date.now() })
    });
    return response.ok;
  } catch (error) { return false; }
};

export const fetchFromGoogleSheets = async (): Promise<SaleRecord[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'get_records', _t: Date.now() })
    });
    const text = await response.text();
    const rawData = extractJson(text);
    if (rawData) {
      const dataArray = findDataArray(rawData);
      if (!dataArray) return null;
      return dataArray.filter((r: any) => r && (r["ID"] || r["id"])).map((r: any) => ({
          id: cleanStr(r["ID"] || r["id"] || ""),
          date: formatDate(r["Date"] || r["date"]),
          cropType: cleanStr(r["Commodity"] || r["cropType"] || ""),
          farmerName: cleanStr(r["Farmer "] || r["Farmer"] || r["farmerName"] || ""),
          farmerPhone: cleanStr(r["Farmer Phone"] || r["farmerPhone"] || ""),
          customerName: cleanStr(r["Customer"] || r["customerName"] || ""),
          customerPhone: cleanStr(r["Customer Phone"] || r["customerPhone"] || ""),
          unitsSold: safeNum(r["Units Sold"] || r["unitsSold"]),
          unitPrice: safeNum(r["Price per unit"] || r["unitPrice"]),
          totalSale: safeNum(r["Total Gross"] || r["totalSale"]),
          coopProfit: safeNum(r["Commission"] || r["coopProfit"]),
          status: cleanStr(r["Status"] || r["status"] || "DRAFT") as any,
          agentName: cleanStr(r["Agent"] || r["agentName"] || ""),
          agentPhone: cleanStr(r["Agent Phone "] || r["Agent Phone"] || r["agentPhone"] || ""),
          cluster: cleanStr(r["Cluster"] || r["cluster"] || ""),
          createdAt: formatDate(r["Created At"] || r["createdAt"] || r["Date"]),
          synced: true,
          signature: cleanStr(r["Signature"] || r["signature"] || ""),
          unitType: cleanStr(r["Unit"] || r["unitType"] || "Kg"),
        })) as SaleRecord[];
    }
    return null;
  } catch (error) { return null; }
};

export const syncUserToCloud = async (user: AgentIdentity): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const mappedUser = {
      "Name": user.name,
      "Phone": user.phone,
      "Role": user.role,
      "Passcode": user.passcode,
      "Cluster": user.cluster,
      "Status": user.status || "ACTIVE"
    };
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync_user', user: mappedUser, _t: Date.now() }),
    });
    return response.ok;
  } catch (e) { return false; }
};

export const fetchUsersFromCloud = async (): Promise<AgentIdentity[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'get_users', _t: Date.now() })
    });
    const text = await response.text();
    const rawUsersRaw = extractJson(text);
    if (rawUsersRaw) {
      const dataArray = findDataArray(rawUsersRaw);
      if (!dataArray) return null;
      // Filter out rows that are clearly not users (missing phone)
      return dataArray
        .filter((u: any) => u && getFlexibleVal(u, ["Phone", "phone", "Phone Number", "Contact"]))
        .map((u: any) => ({
          name: cleanStr(getFlexibleVal(u, ["Name", "name", "Full Name", "Agent Name", "Farmer Name", "Agent"])),
          phone: cleanStr(getFlexibleVal(u, ["Phone", "phone", "Phone Number", "Contact", "Farmer Phone", "Agent Phone", "Agent Phone "])),
          role: cleanStr(getFlexibleVal(u, ["Role", "role", "System Role", "Designation"])) as any,
          passcode: cleanStr(getFlexibleVal(u, ["Passcode", "passcode", "Pin", "Password", "Access Code"])),
          cluster: cleanStr(getFlexibleVal(u, ["Cluster", "cluster", "Node", "Zone", "Area"])),
          status: cleanStr(getFlexibleVal(u, ["Status", "status", "Account Status"])) as any || "ACTIVE"
        }));
    }
    return null;
  } catch (e) { return null; }
};

export const syncOrderToCloud = async (order: MarketOrder): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const mappedOrder = {
      "ID": order.id,
      "Date": order.date,
      "Cluster": order.cluster,
      "Commodity": order.cropType,
      "Units Requested": order.unitsRequested,
      "Unit Type": order.unitType,
      "Customer Name": order.customerName,
      "Customer Phone": order.customerPhone,
      "Status": order.status,
      "Agent Phone": order.agentPhone
    };
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync_order', order: mappedOrder, _t: Date.now() }),
    });
    return response.ok;
  } catch (e) { return false; }
};

export const fetchOrdersFromCloud = async (): Promise<MarketOrder[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'get_orders', _t: Date.now() })
    });
    const text = await response.text();
    const rawOrdersRaw = extractJson(text);
    if (rawOrdersRaw) {
      const dataArray = findDataArray(rawOrdersRaw);
      if (!dataArray) return null;
      return dataArray.map((o: any) => ({
        id: cleanStr(o["ID"] || o["id"] || ""),
        date: formatDate(o["Date"] || o["date"]),
        cropType: cleanStr(o["Commodity"] || o["cropType"] || ""),
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
  } catch (e) { return null; }
};

export const syncProduceToCloud = async (produce: ProduceListing): Promise<boolean> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;
  try {
    const mappedProduce = {
      "ID": produce.id,
      "Date": produce.date,
      "Commodity": produce.cropType,
      "Unit": produce.unitType,
      "Units Available": produce.unitsAvailable,
      "Price": produce.sellingPrice,
      "Supplier": produce.supplierName,
      "Supplier Phone": produce.supplierPhone,
      "Cluster": produce.cluster,
      "Status": produce.status
    };
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'sync_produce', produce: mappedProduce, _t: Date.now() }),
    });
    return response.ok;
  } catch (e) { return false; }
};

export const fetchProduceFromCloud = async (): Promise<ProduceListing[] | null> => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return null;
  try {
    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ action: 'get_produce', _t: Date.now() })
    });
    const text = await response.text();
    const rawData = extractJson(text);
    if (rawData) {
      const dataArray = findDataArray(rawData);
      if (!dataArray) return null;
      return dataArray.filter((p: any) => p && (p.id || p["ID"])).map((p: any) => ({
          id: cleanStr(p["ID"] || p.id || ""),
          date: formatDate(p["Date"] || p.date || p["Posted Date"]),
          cropType: cleanStr(p["Commodity"] || p.cropType || p["Crop Type"] || ""),
          unitsAvailable: safeNum(p["Units Available"] || p.unitsAvailable || p.Quantity),
          unitType: cleanStr(p["Unit"] || p.unitType || p["Unit Type"] || "Units"),
          sellingPrice: safeNum(p["Price"] || p.sellingPrice || p["Selling Price"] || p["Asking Price"]),
          supplierName: cleanStr(p["Supplier"] || p.supplierName || p["Supplier Name"] || p.Name),
          supplierPhone: cleanStr(p["Supplier Phone"] || p.supplierPhone),
          cluster: cleanStr(p["Cluster"] || p.cluster || ""),
          status: (cleanStr(p["Status"] || p.status || "AVAILABLE").toUpperCase() === "SOLD_OUT" ? "SOLD_OUT" : "AVAILABLE") as any,
        }));
    }
    return null; 
  } catch (e) { return null; }
};