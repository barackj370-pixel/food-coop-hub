import { supabase } from './supabaseClient';
import { getCurrentProfile } from './authService';
import { MarketOrder } from '../types';

/* CREATE / UPDATE */
export const saveOrder = async (order: MarketOrder) => {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('orders')
    .upsert({
      ...order,
      agent_id: profile.id
    });

  if (error) throw error;
  return true;
};

/* FETCH */
export const fetchOrders = async () => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  let query = supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (profile.role === 'Sales Agent') {
    query = query.eq('agent_id', profile.id);
  }

  const { data, error } = await query;
  if (error) return [];

  return data as MarketOrder[];
};
