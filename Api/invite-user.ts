
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, role, cluster, data: userData } = req.body;

  if (!email || !role) {
    return res.status(400).json({ error: 'Email and role are required' });
  }

  try {
    const { data, error } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: {
          role,
          cluster: cluster ?? null,
          full_name: userData?.full_name,
          phone: userData?.phone // Pass the phone number to metadata
        },
        redirectTo: process.env.NEXT_PUBLIC_SITE_URL,
      });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      message: 'Invitation sent',
      user: data.user,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
