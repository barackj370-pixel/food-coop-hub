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

/* ───────── ROLES THAT REQUIRE CLUSTER ───────── */
const CLUSTER_ROLES: SystemRole[] = [
  SystemRole.SALES_AGENT,
  SystemRole.SUPPLIER,
  SystemRole.CUSTOMER,
];

const requiresCluster = (role: SystemRole | '') =>
  !!role && CLUSTER_ROLES.includes(role as SystemRole);

export default function LoginPage() {
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<SystemRole | ''>('');
  const [cluster, setCluster] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ───────── PHONE NORMALIZATION (KE) ───────── */
  const normalizePhone = (input: string): string | null => {
    const cleaned = input.replace(/\D/g, '');
    if (cleaned.length < 9) return null;
    return `+254${cleaned.slice(-9)}`;
  };

  /* ───────── LOAD INVITED / INCOMPLETE USER ───────── */
  useEffect(() => {
    const loadProfile = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, role, status')
        .eq('id', auth.user.id)
        .single();

      if (!profile || profile.status === 'INVITED' || !profile.role) {
        setIsCompletingProfile(true);
        setFullName(auth.user.user_metadata?.full_name ?? '');
        setPhone(auth.user.phone ?? '');
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


    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError('Invalid phone number.');
      setLoading(false);
      return;
    }

    /* 1️⃣ UPDATE AUTH METADATA (SOURCE OF TRUTH) */
    const { error: authErr } = await supabase.auth.updateUser({
      phone: normalizedPhone,
      data: {
        full_name: fullName.trim(),
        phone: normalizedPhone,
        role,
        cluster: requiresCluster(role) ? cluster : null,
        provider_type: 'phone',
      },
    });

    if (authErr) {
      setError(authErr.message);
      setLoading(false);
      return;
    }

    /* 2️⃣ UPDATE PROFILES TABLE */
    const { error: profileErr } = await supabase
      .from('profiles')
      .update({
        name: fullName.trim(),
        phone: normalizedPhone,
        role,
        cluster: requiresCluster(role) ? cluster : null,
        status: 'ACTIVE',
      })
      .eq('id', auth.user.id);

    if (profileErr) {
      setError(profileErr.message);
      setLoading(false);
      return;
    }

    window.location.reload();
  };

  /* ───────── UI ───────── */
  if (!isCompletingProfile) return null;

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
  onChange={(e) => setRole(e.target.value as SystemRole)}
  className="w-full p-3 rounded bg-white/10"
>
  <option value="" disabled>
    Select role
  </option>

  <option value={SystemRole.SALES_AGENT}>Sales Agent</option>
  <option value={SystemRole.SUPPLIER}>Supplier</option>
  <option value={SystemRole.CUSTOMER}>Customer</option>
  <option value={SystemRole.FINANCE_OFFICER}>Finance Officer</option>
  <option value={SystemRole.AUDIT_OFFICER}>Audit Officer</option>
  <option value={SystemRole.DIRECTOR}>Director</option>
  <option value={SystemRole.SYSTEM_DEVELOPER}>System Developer</option>
</select>



       {role && CLUSTER_ROLES.includes(role) && (
  <select
    required
    value={cluster}
    onChange={(e) => setCluster(e.target.value)}
    className="w-full p-3 rounded bg-white/10"
  >
    <option value="" disabled>
      Select cluster
    </option>

    {CLUSTERS.map((c) => (
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






