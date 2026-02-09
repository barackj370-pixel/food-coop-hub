
// Fix: Replaced raw SQL script with valid TypeScript service logic for Supabase interactions
import { supabase } from './supabaseClient';
import { getCurrentProfile } from './authService';
import { ProduceListing } from '../types';

/* CREATE / UPDATE */
export const saveProduce = async (produce: ProduceListing) => {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('produce')
    .upsert({
      ...produce,
      agent_id: profile.id
    });

  if (error) {
    console.error('Save produce error:', error);
    throw error;
  }

  return true;
};

/* FETCH */
export const fetchProduce = async () => {
  const profile = await getCurrentProfile();
  if (!profile) return [];

  let query = supabase
    .from('produce')
    .select('*')
    .order('date', { ascending: false });

  // Note: Row Level Security (RLS) is configured in the Supabase dashboard and will automatically
  // filter the data returned based on the user's authentication context.
  const { data, error } = await query;
  if (error) {
    console.error('Fetch produce error:', error);
    return [];
  }

  return data as ProduceListing[];
};

/* DELETE */
export const deleteProduce = async (id: string) => {
  const { error } = await supabase
    .from('produce')
    .delete()
    .eq('id', id);

  if (error) throw error;
  return true;
};
