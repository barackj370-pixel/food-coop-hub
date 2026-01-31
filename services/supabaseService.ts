
import { supabase } from './supabaseClient';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing } from '../types';

/**
 * Utility to check if the Supabase client is configured and ready.
 * Provides a helpful warning if environment variables are missing.
 */
const isClientReady = (): boolean => {
  if (!supabase) {
    console.warn("Supabase client is not initialized. Please ensure SUPABASE_URL and SUPABASE_ANON_KEY are set in your environment variables.");
    return false;
  }
  return true;
};

/* =======================
   SALE RECORDS
======================= */

export const saveRecord = async (record: SaleRecord) => {
  if (!isClientReady()) return false;
  
  const { error } = await supabase!
    .from('records')
    .upsert(record, { onConflict: 'id' });

  if (error) {
    console.error('Save record error:', error);
    return false;
  }
  return true;
};

export const fetchRecords = async () => {
  if (!isClientReady()) return [];

  const { data, error } = await supabase!
    .from('records')
    .select('*')
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Fetch records error:', error);
    return [];
  }

  return data as SaleRecord[];
};

export const deleteRecord = async (id: string) => {
  if (!isClientReady()) return false;
  const { error } = await supabase!.from('records').delete().eq('id', id);
  return !error;
};

/* =======================
   USERS
======================= */

export const saveUser = async (user: AgentIdentity) => {
  if (!isClientReady()) return false;
  
  const { error } = await supabase!
    .from('users')
    .upsert(user, { onConflict: 'phone' });

  if (error) {
    console.error('Save user error:', error);
    return false;
  }
  return true;
};

export const fetchUsers = async () => {
  if (!isClientReady()) return [];
  
  const { data, error } = await supabase!.from('users').select('*');

  if (error) {
    console.error('Fetch users error:', error);
    return [];
  }

  return data as AgentIdentity[];
};

export const deleteUser = async (phone: string) => {
  if (!isClientReady()) return false;
  const { error } = await supabase!.from('users').delete().eq('phone', phone);
  return !error;
};

/* =======================
   ORDERS
======================= */

export const saveOrder = async (order: MarketOrder) => {
  if (!isClientReady()) return false;

  const { error } = await supabase!
    .from('orders')
    .upsert(order, { onConflict: 'id' });

  if (error) {
    console.error('Save order error:', error);
    return false;
  }
  return true;
};

export const fetchOrders = async () => {
  if (!isClientReady()) return [];

  const { data, error } = await supabase!
    .from('orders')
    .select('*')
    .order('date', { ascending: false });

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
  if (!isClientReady()) return false;

  const { error } = await supabase!
    .from('produce')
    .upsert(produce, { onConflict: 'id' });

  if (error) {
    console.error('Save produce error:', error);
    return false;
  }
  return true;
};

export const fetchProduce = async () => {
  if (!isClientReady()) return [];

  const { data, error } = await supabase!
    .from('produce')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Fetch produce error:', error);
    return [];
  }

  return data as ProduceListing[];
};

export const deleteProduce = async (id: string) => {
  if (!isClientReady()) return false;
  const { error } = await supabase!.from('produce').delete().eq('id', id);
  return !error;
};
export const getCurrentUserProfile = async () => {
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.session.user.id)
    .single();

  if (error) throw error;
  return data;
};

