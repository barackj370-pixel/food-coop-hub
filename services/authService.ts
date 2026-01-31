
import { supabase } from './supabaseClient';
import { AgentIdentity } from '../types';
import { saveUser } from './supabaseService';

/**
 * Maps a phone number to a valid email format for Supabase Auth
 */
const phoneToEmail = (phone: string) => `${phone.replace(/\D/g, '')}@kpl-coop.market`;

/**
 * Ensure passcode meets minimum length requirements for Supabase (usually 6)
 * We pad if necessary to maintain the user's 4-digit pin experience
 */
const pinToPassword = (pin: string) => pin.length < 6 ? pin.padStart(6, '0') : pin;

export const signUp = async (identity: AgentIdentity) => {
  if (!supabase) throw new Error("Supabase not initialized");
  
  const email = phoneToEmail(identity.phone);
  const password = pinToPassword(identity.passcode);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: identity.name,
        role: identity.role,
        cluster: identity.cluster
      }
    }
  });

  if (error) throw error;
  
  // Also save to our custom users table for easier querying in the app
  await saveUser(identity);
  
  return data;
};

export const signIn = async (phone: string, passcode: string) => {
  if (!supabase) throw new Error("Supabase not initialized");
  
  const email = phoneToEmail(phone);
  const password = pinToPassword(passcode);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data;
};

export const signOut = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

export const getSession = async () => {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session;
};
