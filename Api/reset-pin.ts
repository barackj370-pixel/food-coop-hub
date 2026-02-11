import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const normalizeKenyanPhone = (input: string) => {
  if (!input) return '';
  let cleaned = input.replace(/[^\d+]/g, '');
  
  // Handle already formatted +254...
  if (cleaned.startsWith('+254')) return cleaned;
  
  // Handle 254... (missing +)
  if (cleaned.startsWith('254')) return '+' + cleaned;
  
  // Handle 07... or 01... (Local)
  if (cleaned.startsWith('01') || cleaned.startsWith('07')) {
    return '+254' + cleaned.substring(1);
  }
  
  // Handle 7... or 1... (Short Local)
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    return '+254' + cleaned;
  }
  
  // Fallback: Add + if missing
  return cleaned.startsWith('+') ? cleaned : '+' + cleaned;
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN are required' });
  }

  const formattedPhone = normalizeKenyanPhone(phone);
  console.log(`[ResetPIN] Attempting reset for: ${formattedPhone}`);

  try {
    let userId = null;
    let userRole = 'Customer';
    let userName = 'Member (Recovered)';
    let isGhostAccount = false;

    // 1. Try to find the user in the public PROFILE table (Standard Path)
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', formattedPhone)
      .maybeSingle();

    if (profile) {
      userId = profile.id;
      userRole = profile.role || 'Customer';
      userName = profile.name || 'Member';
    } else {
      // 2. DEEP SEARCH: User not in Profile? Check Auth System (Ghost Account Recovery)
      // This happens if a user registered but the profile creation failed.
      console.log('[ResetPIN] Profile missing. Searching Auth system...');
      
      // Note: listing users is expensive at scale, but necessary for recovery of ghost accounts
      // where we don't have the ID.
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ 
        page: 1, 
        perPage: 1000 
      });
      
      if (!listError && users) {
         // Normalize auth users phones to compare
         const foundUser = users.find(u => 
            normalizeKenyanPhone(u.phone || '') === formattedPhone || 
            u.user_metadata?.phone === formattedPhone
         );

         if (foundUser) {
           userId = foundUser.id;
           userRole = foundUser.user_metadata?.role || 'Customer';
           userName = foundUser.user_metadata?.full_name || foundUser.user_metadata?.name || 'Member (Recovered)';
           isGhostAccount = true;
           console.log('[ResetPIN] Found ghost account in Auth:', userId);
         }
      }
    }

    if (!userId) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // 3. Update the Auth User Password (Secure Layer)
    // Pad PIN to 6 chars for Supabase Password policy
    const securePassword = pin.length === 4 ? `${pin}00` : pin;

    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        password: securePassword,
        user_metadata: { phone: formattedPhone } // Ensure metadata is synced
      }
    );

    if (authError) {
       console.error('[ResetPIN] Auth update failed:', authError.message);
       throw authError;
    }

    // 4. Update or Create the Public Profile (Self-Healing)
    if (isGhostAccount) {
      // Create missing profile
      await supabase.from('profiles').upsert({
        id: userId,
        phone: formattedPhone,
        passcode: pin,
        role: userRole,
        name: userName,
        status: 'ACTIVE',
        cluster: 'Mariwa' // Default cluster for recovery
      });
    } else {
      // Update existing profile
      await supabase
        .from('profiles')
        .update({ passcode: pin })
        .eq('id', userId);
    }

    return res.status(200).json({ success: true, message: 'PIN updated successfully' });

  } catch (err: any) {
    console.error('[ResetPIN] Critical Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}