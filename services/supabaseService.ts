import { supabase } from './supabaseClient';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from '../types';

/* =======================
   SALE RECORDS
======================= */

export const saveRecord = async (record: SaleRecord) => {
  const { error } = await supabase
    .from('records')
    .upsert(record, { onConflict: 'id' });

  if (error) {
    console.error('Save record error:', error);
    return false;
  }
  return true;
};

export const fetchRecords = async () => {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch records error:', error);
    return [];
  }

  return data as SaleRecord[];
};

export const deleteRecord = async (id: string) => {
  const { error } = await supabase.from('records').delete().eq('id', id);
  return !error;
};

/* =======================
   USERS
======================= */

export const saveUser = async (user: AgentIdentity) => {
  const { error } = await supabase
    .from('users')
    .upsert(user, { onConflict: 'phone' });

  if (error) {
    console.error('Save user error:', error);
    return false;
  }
  return true;
};

export const fetchUsers = async () => {
  const { data, error } = await supabase.from('users').select('*');

  if (error) {
    console.error('Fetch users error:', error);
    return [];
  }

  return data as AgentIdentity[];
};

export const deleteUser = async (phone: string) => {
  const { error } = await supabase.from('users').delete().eq('phone', phone);
  return !error;
};

/* =======================
   ORDERS
======================= */

export const saveOrder = async (order: MarketOrder) => {
  const { error } = await supabase
    .from('orders')
    .upsert(order, { onConflict: 'id' });

  if (error) {
    console.error('Save order error:', error);
    return false;
  }
  return true;
};

export const fetchOrders = async () => {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch orders error:', error);
    return [];
  }

  return data as MarketOrder[];
};

/* =======================
   PRODUCE
======================= */

export const saveProduce = async (produce: ProduceListing) => {
  const { error } = await supabase
    .from('produce')
    .upsert(produce, { onConflict: 'id' });

  if (error) {
    console.error('Save produce error:', error);
    return false;
  }
  return true;
};

export const fetchProduce = async () => {
  const { data, error } = await supabase
    .from('produce')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Fetch produce error:', error);
    return [];
  }

  return data as ProduceListing[];
};

export const deleteProduce = async (id: string) => {
  const { error } = await supabase.from('produce').delete().eq('id', id);
  return !error;
};
