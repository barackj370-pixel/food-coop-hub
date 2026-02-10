
import { supabase } from './supabaseClient';
import { getCurrentProfile } from './authService';
import { SaleRecord } from '../types';

/* CREATE / UPDATE */
export const saveRecord = async (record: SaleRecord) => {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('records')
    .upsert({
      ...record,
      agent_id: profile.id,
      agent_name: profile.name
    });

  if (error) {
    console.error('Save record error:', error);
    throw error;
  }

  return true;
};

/* FETCH */
export const fetchRecords = async () => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  let query = supabase
    .from('records')
    .select('*')
    .order('created_at', { ascending: false });

  if (profile.role === 'Sales Agent') {
    query = query.eq('agent_id', profile.id);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Fetch records error:', error);
    return [];
  }

  return data as SaleRecord[];
};

/* DELETE */
export const deleteRecord = async (id: string) => {
  const { error } = await supabase
    .from('records')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};
