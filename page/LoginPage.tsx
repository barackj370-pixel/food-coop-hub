import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SystemRole } from '../types';

/* ───────── CLUSTERS ───────── */
const CLUSTERS = [
  'Mariwa',
  'Rabolo',
  'Mulo',
  'Kabarnet',
  'Nyamagagana',
  'Kangemi',
  'Apuoyo',
];

const CLUSTER_ROLES: SystemRole[] = [
  SystemRole.FIELD_AGENT,
  SystemRole.SUPPLIER,
  SystemRole.CUSTOMER,
];

export default function LoginPage() {
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<SystemRole | ''>('');
  const [cluster, setCluster] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ───────── PHONE NORMALIZATION (KE) ───────── */
  const normalizePhone = (input: string): string => {
    const cleaned = input.replace(/\D/g, '');
    return `+254${cleaned.slice(-9)}`;
  };

  /* ───────── LOAD INVITED USER ───────── */
  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      // Invited OR incomplete profile
      if (!profile || profile.status === 'INVITED' || !profile.role) {
        setIsCompletingProfile(true);
        setFullName(data.user.user_metadata?.full_name ?? '');
        setPhone(data.user.phone ?? '');
      }
    };

    loadProfile();
  }, []);

  /* ───────── FINALIZE PROFILE ───────── */
  const finalizeProfile = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);

  if (!role) {
    setError('Please select a role.');
    setLoading(false);
    return;
  }

  if (CLUSTER_ROLES.includes(role) && !cluster) {
    setError('Please select a cluster.');
    setLoading(false);
    return;
  }

  const { data: authData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !authData.user) {
    setError('No active session.');
    setLoading(false);
    return;
  }

  const normalizedPhone = normalizePhone(phone);

  /* 1️⃣ UPDATE AUTH METADATA */
  const { error: authUpdateError } = await supabase.auth.updateUser({
    data: {
      full_name: fullName.trim(),
      phone: normalizedPhone,
      role,
      cluster: CLUSTER_ROLES.includes(role) ? cluster : null,
    },
  });

  if (authUpdateError) {
    setError(authUpdateError.message);
    setLoading(false);
    return;
  }

  /* 2️⃣ UPSERT PROFILE ROW (THIS FIXES NULLS) */
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: authData.user.id,
        name: fullName.trim(),
        phone: normalizedPhone,
        role,
        cluster: CLUSTER_ROLES.includes(role) ? cluster : null,
        status: 'ACTIVE',
      },
      { onConflict: 'id' }
    );

  if (profileError) {
    setError(profileError.message);
    setLoading(false);
    return;
  }

  window.location.reload();
};


  /* ───────── FINALIZE PROFILE UI ───────── */
  if (isCompletingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <form
          onSubmit={finalizeProfile}
          className="w-full max-w-md space-y-4 p-8 bg-white/5 rounded-3xl"
        >
          <h1 className="text-xl font-bold text-center">
            Complete Your Profile
          </h1>

          <input
            required
            placeholder="Full name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="w-full p-3 rounded bg-white/10"
          />

          <input
            required
            placeholder="Phone (07…)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full p-3 rounded bg-white/10"
          />

          <select
            required
            value={role}
            onChange={e => setRole(e.target.value as SystemRole)}
            className="w-full p-3 rounded bg-white/10"
          >
            <option value="" disabled>Select role</option>
            {Object.values(SystemRole).map(r => (
              <option key={r} value={r} className="text-black">
                {r.replace('_', ' ')}
              </option>
            ))}
          </select>

          {role && CLUSTER_ROLES.includes(role) && (
            <select
              required
              value={cluster}
              onChange={e => setCluster(e.target.value)}
              className="w-full p-3 rounded bg-white/10"
            >
              <option value="" disabled>Select cluster</option>
              {CLUSTERS.map(c => (
                <option key={c} value={c} className="text-black">
                  {c}
                </option>
              ))}
            </select>
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            disabled={loading}
            className="w-full bg-green-600 py-3 rounded font-bold"
          >
            {loading ? 'Saving…' : 'Finalize Profile'}
          </button>
        </form>
      </div>
    );
  }

  return null;
}




