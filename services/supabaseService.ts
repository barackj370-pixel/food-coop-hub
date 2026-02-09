
import { supabase } from './supabaseClient.ts';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from '../types.ts';

const isClientReady = (): boolean => {
  if (!supabase || !supabase.from) {
    console.warn("Supabase client not properly initialized.");
    return false;
  }
  return true;
};

/* SALE RECORDS */
export const saveRecord = async (record: SaleRecord) => {
  if (!isClientReady()) return false;
  // Ensure we don't send local-only flags to DB if they aren't in schema
  const { synced, ...dbRecord } = record;
  const { error } = await supabase.from('records').upsert(dbRecord, { onConflict: 'id' });
  if (error) console.error('Supabase saveRecord error:', error);
  return !error;
};

export const fetchRecords = async () => {
  if (!isClientReady()) return [];
  const { data, error } = await supabase.from('records').select('*').order('createdAt', { ascending: false });
  if (error) {
    console.error('Supabase fetchRecords error:', error);
    return [];
  }
  return (data as SaleRecord[]) || [];
};

export const deleteRecord = async (id: string) => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('records').delete().eq('id', id);
  return !error;
};

export const deleteAllRecords = async () => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('records').delete().neq('id', '0');
  return !error;
};

/* USERS / AGENTS */
export const saveUser = async (user: AgentIdentity) => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('users').upsert(user, { onConflict: 'phone' });
  if (error) console.error('Supabase saveUser error:', error);
  return !error;
};

export const fetchUsers = async () => {
  if (!isClientReady()) return [];
  const { data, error } = await supabase.from('users').select('*');
  if (error) {
    console.error('Supabase fetchUsers error:', error);
    return [];
  }
  return (data as AgentIdentity[]) || [];
};

export const deleteUser = async (phone: string) => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('users').delete().eq('phone', phone);
  return !error;
};

export const deleteAllUsers = async () => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('users').delete().neq('phone', '0');
  return !error;
};

/* MARKET ORDERS */
export const saveOrder = async (order: MarketOrder) => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('orders').upsert(order, { onConflict: 'id' });
  if (error) console.error('Supabase saveOrder error:', error);
  return !error;
};

export const fetchOrders = async () => {
  if (!isClientReady()) return [];
  const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
  if (error) {
    console.error('Supabase fetchOrders error:', error);
    return [];
  }
  return (data as MarketOrder[]) || [];
};

export const deleteAllOrders = async () => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('orders').delete().neq('id', '0');
  return !error;
};

/* PRODUCE LISTINGS */
export const saveProduce = async (produce: ProduceListing) => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('produce').upsert(produce, { onConflict: 'id' });
  if (error) console.error('Supabase saveProduce error:', error);
  return !error;
};

export const fetchProduce = async () => {
  if (!isClientReady()) return [];
  const { data, error } = await supabase.from('produce').select('*').order('date', { ascending: false });
  if (error) {
    console.error('Supabase fetchProduce error:', error);
    return [];
  }
  return (data as ProduceListing[]) || [];
};

export const deleteProduce = async (id: string) => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('produce').delete().eq('id', id);
  return !error;
};

export const deleteAllProduce = async () => {
  if (!isClientReady()) return false;
  const { error } = await supabase.from('produce').delete().neq('id', '0');
  return !error;
};
