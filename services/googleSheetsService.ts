import { GOOGLE_SHEETS_WEBHOOK_URL } from '../constants.ts';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from '../types.ts';

/**
 * Standard request wrapper for Google Apps Script Web App interactions.
 * Includes exponential backoff retry logic for resilience against 'Failed to fetch' errors.
 */
const request = async (action: string, method: 'GET' | 'POST' = 'GET', data?: any, maxRetries = 3) => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL || GOOGLE_SHEETS_WEBHOOK_URL.trim() === "") {
    console.warn(`Google Sheets Service: Webhook URL is missing. Action [${action}] aborted.`);
    return null;
  }

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const url = new URL(GOOGLE_SHEETS_WEBHOOK_URL);
      const options: RequestInit = {
        method,
        // GAS Web Apps return a 302 redirect to a temporary Google user content URL.
        // Explicitly following ensure the browser handles this hop.
        redirect: 'follow', 
      };

      if (method === 'GET') {
        url.searchParams.append('action', action);
        // Append additional data as query params if provided for GET
        if (data && typeof data === 'object') {
          Object.entries(data).forEach(([key, val]) => {
            if (val !== undefined && val !== null) {
              url.searchParams.append(key, String(val));
            }
          });
        }
      } else {
        // For POST, we use text/plain to avoid preflight CORS checks (no-cors style)
        // while still passing our JSON payload.
        options.body = JSON.stringify({ action, ...data });
        options.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      }

      const res = await fetch(url.toString(), options);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // GET requests to GAS generally return JSON. 
      // POST requests might just return 200 OK.
      if (method === 'GET') {
        return await res.json();
      }
      
      return true;
    } catch (e) {
      const isLastAttempt = attempt === maxRetries;
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s...

      if (isLastAttempt) {
        console.error(`Google Sheets Service Critical Failure [${action}] after ${maxRetries + 1} attempts:`, e);
        return null;
      }

      console.warn(`Google Sheets Service Retry [${action}] - Attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, e);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  return null;
};

// Sale Record Operations
export const syncToGoogleSheets = (record: SaleRecord) => request('sync_record', 'POST', { record });
export const fetchFromGoogleSheets = () => request('fetch_records', 'GET');
export const deleteRecordFromCloud = (id: string) => request('delete_record', 'POST', { id });
export const deleteAllRecordsFromCloud = () => request('delete_all_records', 'POST');

// User / Agent Operations
export const syncUserToCloud = (user: AgentIdentity) => request('sync_user', 'POST', { user });
export const fetchUsersFromCloud = () => request('fetch_users', 'GET');
export const deleteUserFromCloud = (phone: string) => request('delete_user', 'POST', { phone });
export const deleteAllUsersFromCloud = () => request('delete_all_users', 'POST');

// Market Order Operations
export const syncOrderToCloud = (order: MarketOrder) => request('sync_order', 'POST', { order });
export const fetchOrdersFromCloud = () => request('fetch_orders', 'GET');
export const deleteAllOrdersFromCloud = () => request('delete_all_orders', 'POST');

// Produce Listing Operations
export const syncProduceToCloud = (produce: ProduceListing) => request('sync_produce', 'POST', { produce });
export const fetchProduceFromCloud = () => request('fetch_produce', 'GET');
export const deleteProduceFromCloud = (id: string) => request('delete_produce', 'POST', { id });
export const deleteAllProduceFromCloud = () => request('delete_all_produce', 'POST');
