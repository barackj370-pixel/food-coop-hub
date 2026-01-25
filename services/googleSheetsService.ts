import { GOOGLE_SHEETS_WEBHOOK_URL } from '../constants.ts';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from '../types.ts';

/**
 * Standard request wrapper for Google Apps Script Web App interactions.
 */
const request = async (action: string, method: 'GET' | 'POST' = 'GET', data?: any) => {
  try {
    const url = new URL(GOOGLE_SHEETS_WEBHOOK_URL);
    
    if (method === 'GET') {
      url.searchParams.append('action', action);
      const res = await fetch(url.toString());
      if (!res.ok) return null;
      return await res.json();
    } else {
      const res = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
        method: 'POST',
        // Using text/plain to avoid preflight CORS checks in GAS while still sending JSON
        body: JSON.stringify({ action, ...data }),
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }
      });
      return res.ok;
    }
  } catch (e) {
    console.error(`Google Sheets Service Error [${action}]:`, e);
    return null;
  }
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
