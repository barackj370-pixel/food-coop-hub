
import { GOOGLE_SHEETS_WEBHOOK_URL } from '../constants.ts';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from '../types.ts';

/**
 * Google Sheets Web App client
 */
const request = async (
  action: string,
  payload: any = {}
) => {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) {
    console.warn("GOOGLE_SHEETS_WEBHOOK_URL is not defined in constants.ts");
    return null;
  }

  try {
    const res = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, ...payload })
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();

  } catch (err) {
    console.error(`Sheets API error [${action}]`, err);
    return null;
  }
};

/* ───────── SALES ───────── */
export const syncToGoogleSheets = (record: SaleRecord) =>
  request('sync_record', { record });

export const fetchFromGoogleSheets = () =>
  request('fetch_records');

export const deleteRecordFromCloud = (id: string) =>
  request('delete_record', { id });

export const deleteAllRecordsFromCloud = () =>
  request('purge_records');

/* ───────── USERS ───────── */
export const syncUserToCloud = (user: AgentIdentity) =>
  request('sync_user', { user });

export const fetchUsersFromCloud = () =>
  request('fetch_users');

export const deleteUserFromCloud = (phone: string) =>
  request('delete_user', { phone });

export const deleteAllUsersFromCloud = () =>
  request('purge_users');

/* ───────── ORDERS ───────── */
export const syncOrderToCloud = (order: MarketOrder) =>
  request('sync_order', { order });

export const fetchOrdersFromCloud = () =>
  request('fetch_orders');

export const deleteAllOrdersFromCloud = () =>
  request('purge_orders');

/* ───────── PRODUCE ───────── */
export const syncProduceToCloud = (produce: ProduceListing) =>
  request('sync_produce', { produce });

export const fetchProduceFromCloud = () =>
  request('fetch_produce');

export const deleteProduceFromCloud = (id: string) =>
  request('delete_produce', { id });

export const deleteAllProduceFromCloud = () =>
  request('purge_produce');
