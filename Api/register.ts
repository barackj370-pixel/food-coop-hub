
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client with fallbacks matching reset-pin.ts
const supabaseUrl = process.env.SUPABASE_URL || 'https://xtgztxbbkduxfcaocjhh.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z3p0eGJia2R1eGZjYW9jamhoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQyNjc5MywiZXhwIjoyMDg1MDAyNzkzfQ.bOqUP1xXkHP6lf5-B2Azd9FAC5WyS_WdmI53iKXfYzk';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, password, data } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: 'Phone and password are required' });
  }

  try {
    // 1. Create User via Admin API (skips SMS verification via phone_confirm: true)
    const { data: user, error } = await supabase.auth.admin.createUser({
      phone,
      password,
      user_metadata: data,
      phone_confirm: true 
    });

    if (error) throw error;

    if (user.user) {
      // 2. Create Public Profile with Extended Metadata (Autofill)
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.user.id,
        name: data.full_name,
        phone: data.phone,
        role: data.role,
        cluster: data.cluster,
        passcode: password.slice(0, 4), // Store original 4-digit PIN reference
        status: 'ACTIVE',
        // Autofill Fields
        // REMOVED EMAIL to prevent schema error
        created_at: user.user.created_at,
        last_sign_in_at: user.user.last_sign_in_at || null,
        provider: user.user.app_metadata?.provider || 'phone'
      });

      if (profileError) {
        console.error("Profile creation warning:", profileError);
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Account created successfully',
      user: user.user 
    });

  } catch (err: any) {
    console.error("Register Error:", err);
    return res.status(500).json({ error: err.message });
  }
}
