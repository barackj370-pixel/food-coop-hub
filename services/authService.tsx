import { supabase } from './supabaseClient';

export const getCurrentProfile = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', session.user.id)
    .single();

  if (error) {
    console.error('Profile fetch error:', error);
    return null;
  }

  return data;
};