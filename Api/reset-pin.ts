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

// Helper to check if a phone number matches loosely (e.g. 0725... matches +254725...)
const isPhoneMatch = (p1: string, p2: string) => {
  const n1 = p1.replace(/\D/g, '').slice(-9); // Last 9 digits
  const n2 = p2.replace(/\D/g, '').slice(-9);
  return n1 === n2;
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
  console.log(`[ResetPIN] Processing: ${formattedPhone}`);

  try {
    let userId = null;
    let userRole = 'Customer';
    let userName = 'Member';
    
    // Developer Bootstrap Check
    // We check against the normalized version of the specific developer number
    const isSystemDev = formattedPhone === '+254725717170';
    if (isSystemDev) {
        userRole = 'System Developer';
        userName = 'Barack James';
    }

    // 1. DEEP SEARCH in Auth System FIRST (Source of Truth)
    console.log('[ResetPIN] Searching Auth system for user...');
    
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    
    if (!listError && users) {
       // Find user by checking all phone variants
       const foundUser = users.find(u => 
          isPhoneMatch(u.phone || '', formattedPhone) || 
          isPhoneMatch(u.user_metadata?.phone || '', formattedPhone)
       );

       if (foundUser) {
         userId = foundUser.id;
         if (!isSystemDev) {
            userRole = foundUser.user_metadata?.role || 'Customer';
            userName = foundUser.user_metadata?.full_name || 'Member';
         }
         console.log('[ResetPIN] Found existing Auth user:', userId);
       }
    }

    // 2. If not in Auth, check Profile (Edge case where auth was deleted but profile remains?)
    if (!userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', formattedPhone)
          .maybeSingle();

        if (profile) {
            // This is bad state: Profile exists but Auth doesn't. 
            // We can't "recover" the Auth, user must Register.
            // But we can delete the profile so Register works.
             await supabase.from('profiles').delete().eq('id', profile.id);
             return res.status(404).json({ error: 'Account corrupted. Please Register again (Old profile cleaned).' });
        }
    }

    if (!userId) {
        // Truly doesn't exist
        return res.status(404).json({ error: 'User not found. Please Register first.' });
    }

    // 3. Update the Auth User (Secure Layer)
    // We update the phone to the standard format to fix any legacy data issues
    const securePassword = pin.length === 4 ? `${pin}00` : pin;

    const { error: authError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        password: securePassword,
        phone: formattedPhone, // FORCE normalize phone in Auth
        user_metadata: { 
            phone: formattedPhone, 
            full_name: userName,
            role: userRole,
            cluster: isSystemDev ? '-' : undefined
        },
        email_confirm: true,
        phone_confirm: true
      }
    );

    if (authError) {
       console.error('[ResetPIN] Auth update failed:', authError.message);
       throw authError;
    }

    // 4. Force Update Public Profile
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      phone: formattedPhone,
      passcode: pin,
      role: userRole,
      name: userName,
      status: 'ACTIVE',
      cluster: isSystemDev ? '-' : 'Mariwa' // Default fallback
    });
    
    if (profileError) console.error('[ResetPIN] Profile sync warning:', profileError);

    return res.status(200).json({ success: true, message: 'Account synced and secured.' });

  } catch (err: any) {
    console.error('[ResetPIN] Critical Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}