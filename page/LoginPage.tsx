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

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);

  /* 🔑 IMPORTANT: DEFAULT ROLE IS SALES_AGENT */
  const [role, setRole] = useState<SystemRole>(SystemRole.SALES_AGENT);
  const [cluster, setCluster] = useState('');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ───────── PHONE NORMALIZATION (KE) ───────── */
  const normalizePhone = (input: string): string | null => {
    const cleaned = input.replace(/\D/g, '');
    if (cleaned.length < 9) return null;
    return `+254${cleaned.slice(-9)}`;
  };

  /* ───────── ROLE CHANGE HANDLER ───────── */
  const handleRoleChange = (newRole: SystemRole) => {
    setRole(newRole);

    // Clear cluster immediately if role does NOT require it
    if (!CLUSTER_ROLES.includes(newRole)) {
      setCluster('');
    }
  };

  /* ───────── SIGN UP / LOGIN ───────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError('Enter a valid Kenyan phone number.');
      setLoading(false);
      return;
    }

    // 🔒 STRICT CLUSTER ENFORCEMENT
    if (CLUSTER_ROLES.includes(role) && !cluster) {
      setError('Please select a cluster.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        phone: normalizedPhone,
        password: passcode,
        options: {
          data: {
            full_name: fullName.trim(),
            role,
            cluster: CLUSTER_ROLES.includes(role) ? cluster : null,
          },
        },
      });

      if (error) setError(error.message);
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        phone: normalizedPhone,
        password: passcode,
      });

      if (error) setError(error.message);
    }

    setLoading(false);
  };

  /* ───────── UI ───────── */
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 p-8 bg-white/5 rounded-3xl"
      >
        <h1 className="text-2xl font-bold text-center">
          {isSignUp ? 'Create Account' : 'Login'}
        </h1>

        {isSignUp && (
          <>
            <input
              required
              placeholder="Full name"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full p-3 rounded bg-white/10"
            />

            <select
              value={role}
              onChange={e => handleRoleChange(e.target.value as SystemRole)}
              className="w-full p-3 rounded bg-white/10"
            >
              {Object.values(SystemRole).map(r => (
                <option key={r} value={r} className="text-black">
                  {r}
                </option>
              ))}
            </select>

            {/* ✅ CLUSTER SHOWS ONLY FOR SALES_AGENT, SUPPLIER, CUSTOMER */}
            {CLUSTER_ROLES.includes(role) && (
              <select
                required
                value={cluster}
                onChange={e => setCluster(e.target.value)}
                className="w-full p-3 rounded bg-white/10"
              >
                <option value="" disabled>
                  Select cluster
                </option>
                {CLUSTERS.map(c => (
                  <option key={c} value={c} className="text-black">
                    {c}
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        <input
          required
          placeholder="Phone (07…)"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          className="w-full p-3 rounded bg-white/10"
        />

        <input
          required
          type="password"
          placeholder="Passcode"
          value={passcode}
          onChange={e => setPasscode(e.target.value)}
          className="w-full p-3 rounded bg-white/10"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          disabled={loading}
          className="w-full bg-green-600 py-3 rounded font-bold"
        >
          {loading ? 'Please wait…' : isSignUp ? 'Register' : 'Login'}
        </button>

        <button
          type="button"
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs text-slate-400 w-full"
        >
          {isSignUp ? 'Already registered? Login' : 'New user? Register'}
        </button>
      </form>
    </div>
  );
}


