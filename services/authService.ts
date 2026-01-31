import { supabase } from './supabaseClient';

/* LOGIN */
export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
};

/* REGISTER */
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  return data;
};

/* LOGOUT */
export const signOut = async () => {
  await supabase.auth.signOut();
};

/* CURRENT SESSION */
export const getSession = async () => {
  return await supabase.auth.getSession();
};
