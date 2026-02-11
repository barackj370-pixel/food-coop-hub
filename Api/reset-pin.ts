import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const normalizeKenyanPhone = (input: string) => {
  let cleaned = input.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) cleaned = cleaned.substring(1);
  if (cleaned.startsWith('254')) return '+' + cleaned;
  if (cleaned.startsWith('01') || cleaned.startsWith('07')) return '+254' + cleaned.substring(1);
  if (cleaned.startsWith('7') || cleaned.startsWith('1')) return '+254' + cleaned;
  return cleaned.length >= 9 ? '+254' + cleaned : '+' + cleaned;
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

  try {
    // 1. Find the user ID from the public profile table
    const { data: userProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', formattedPhone)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ error: 'User not found. Please register first.' });
    }

    // 2. Update the Auth User Password using Admin privileges
    const securePassword = pin.length === 4 ? `${pin}00` : pin;

    const { error: authError } = await supabase.auth.admin.updateUserById(
      userProfile.id,
      { password: securePassword }
    );

    if (authError) throw authError;

    // 3. Update the Public Profile Passcode
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