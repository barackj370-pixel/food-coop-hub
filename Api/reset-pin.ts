import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const normalizeKenyanPhone = (input: string) => {
  if (!input) return '';
  let cleaned = input.replace(/[^\d+]/g, '');
  
  if (cleaned.startsWith('+254')) return cleaned;
  if (cleaned.startsWith('254')) return '+' + cleaned;
  if (cleaned.startsWith('01') || cleaned.startsWith('07')) {
    return '+254' + cleaned.substring(1);
  }
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) {
    return '+254' + cleaned;
  }
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
    let userName = 'Member';
    let isGhostAccount = false;
    
    // Developer Bootstrap Check
    const isSystemDev = formattedPhone === '+254725717170';
    if (isSystemDev) {
        userRole = 'System Developer';
        userName = 'Barack James';
    }

    // 1. Try to find the user in the public PROFILE table
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('phone', formattedPhone)
      .maybeSingle();

    if (profile) {
      userId = profile.id;
      userRole = isSystemDev ? 'System Developer' : (profile.role || 'Customer');
      userName = isSystemDev ? 'Barack James' : (profile.name || 'Member');
    } else {
      // 2. DEEP SEARCH in Auth
      console.log('[ResetPIN] Profile missing. Searching Auth system...');
      const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      
      if (!listError && users) {
         const foundUser = users.find(u => 
            normalizeKenyanPhone(u.phone || '') === formattedPhone || 
            u.user_metadata?.phone === formattedPhone
         );

         if (foundUser) {
           userId = foundUser.id;
           if (!isSystemDev) {
              userRole = foundUser.user_metadata?.role || 'Customer';
              userName = foundUser.user_metadata?.full_name || 'Member';
           }
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
        user_metadata: { 
            phone: formattedPhone, 
            full_name: userName,
            role: userRole
        }
      }
    );

    if (authError) {
       console.error('[ResetPIN] Auth update failed:', authError.message);
       throw authError;
    }

    // 4. Update or Create the Public Profile (Self-Healing)
    await supabase.from('profiles').upsert({
      id: userId,
      phone: formattedPhone,
      passcode: pin,
      role: userRole,
      name: userName,
      status: 'ACTIVE',
      cluster: isSystemDev ? '-' : (profile?.cluster || 'Mariwa')
    });

    return res.status(200).json({ success: true, message: 'PIN updated successfully' });

  } catch (err: any) {
    console.error('[ResetPIN] Critical Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}