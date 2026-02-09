import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
// Note: This requires SUPABASE_SERVICE_ROLE_KEY to be set in your environment variables
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone, pin } = req.body;

  if (!phone || !pin) {
    return res.status(400).json({ error: 'Phone and PIN are required' });
  }

  try {
    // 1. Find the user ID from the public profile table
    // We use the public table to map Phone -> Auth ID
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', phone)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // 2. Update the Auth User Password using Admin privileges
    const { error: authError } = await supabase.auth.admin.updateUserById(
      userProfile.id,
      { password: pin }
    );

    if (authError) throw authError;

    // 3. Update the Public Profile Passcode (to keep it in sync for reference)
    await supabase
      .from('profiles')
      .update({ passcode: pin })
      .eq('id', userProfile.id);

    return res.status(200).json({ success: true, message: 'PIN updated successfully' });

  } catch (err: any) {
    console.error('Reset Pin Error:', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}