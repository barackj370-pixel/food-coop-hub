import { supabase } from './supabaseClient.ts';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from '../types.ts';

// Sale Record Operations
export const syncToGoogleSheets = async (record: SaleRecord) => {
  const { error } = await supabase.from('records').upsert(record);
  if (error) console.error("Record sync error:", error);
  return !error;
};

export const fetchFromGoogleSheets = async () => {
  const { data, error } = await supabase.from('records').select('*').order('createdAt', { ascending: false });
  if (error) return null;
  return data as SaleRecord[];
};

export const deleteRecordFromCloud = async (id: string) => {
  const { error } = await supabase.from('records').delete().eq('id', id);
  return !error;
};

export const deleteAllRecordsFromCloud = async () => {
  const { error } = await supabase.from('records').delete().neq('id', '0'); // Clear all
  return !error;
};

// User Operations
export const syncUserToCloud = async (user: AgentIdentity) => {
  const { error } = await supabase.from('users').upsert(user);
  return !error;
};

export const fetchUsersFromCloud = async () => {
  const { data, error } = await supabase.from('users').select('*');
  if (error) return null;
  return data as AgentIdentity[];
};

export const deleteUserFromCloud = async (phone: string) => {
  const { error } = await supabase.from('users').delete().eq('phone', phone);
  return !error;
};

export const deleteAllUsersFromCloud = async () => {
  const { error } = await supabase.from('users').delete().neq('phone', '0');
  return !error;
};

// Market Order Operations
export const syncOrderToCloud = async (order: MarketOrder) => {
  const { error } = await supabase.from('orders').upsert(order);
  return !error;
};

export const fetchOrdersFromCloud = async () => {
  const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
  if (error) return null;
  return data as MarketOrder[];
};

export const deleteAllOrdersFromCloud = async () => {
  const { error } = await supabase.from('orders').delete().neq('id', '0');
  return !error;
};

// Produce Listing Operations
export const syncProduceToCloud = async (produce: ProduceListing) => {
  const { error } = await supabase.from('produce').upsert(produce);
  return !error;
};

export const fetchProduceFromCloud = async () => {
  const { data, error } = await supabase.from('produce').select('*').order('date', { ascending: false });
  if (error) return null;
  return data as ProduceListing[];
};

export const deleteProduceFromCloud = async (id: string) => {
  const { error } = await supabase.from('produce').delete().eq('id', id);
  return !error;
};

export const deleteAllProduceFromCloud = async () => {
  const { error } = await supabase.from('produce').delete().neq('id', '0');
  return !error;
};