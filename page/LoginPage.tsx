import React, { useEffect, useState } from 'react';
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

/* Roles that must select a cluster */
const CLUSTER_ROLES: SystemRole[] = [
  SystemRole.FIELD_AGENT,
  SystemRole.SUPPLIER,
  SystemRole.CUSTOMER,
];

const LoginPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);

  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState('');
  const [fullName, setFullName] = useState('');
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

  /* ───────── CHECK SESSION & PROFILE ───────── */
  useEffect(() => {
    const init = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', auth.user.id)
        .single();

      if (!profile?.role || !profile?.name) {
        setIsCompletingProfile(true);
        setFullName(auth.user.user_metadata?.full_name || '');
        if (auth.user.phone) setPhone(auth.user.phone);
      }
    };

    init();
  }, []);

  /* ───────── GOOGLE LOGIN ───────── */
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });

    if (error) setError(error.message);
    setLoading(false);
  };

  /* ───────── COMPLETE PROFILE (INVITE / OAUTH) ───────── */
  const handleCompleteProfile = async (e: React.FormEvent) => {
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

    const provider =
      auth.user.app_metadata?.provider ||
      auth.user.app_metadata?.providers?.[0] ||
      'invite';

    const normalizedPhone =
      normalizePhone(phone) || auth.user.phone || null;

    const { error } = await supabase
      .from('profiles')
      .update({
        name: fullName,
        role,
        cluster: CLUSTER_ROLES.includes(role) ? cluster : null,
        phone: normalizedPhone,
        provider,
        status: 'active',
      })
      .eq('id', auth.user.id);

    if (error) {
      setError(error.message);
    } else {
      window.location.reload();
    }

    setLoading(false);
  };

  /* ───────── LOGIN / SIGNUP (PHONE) ───────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError('Enter a valid Kenyan phone number.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        phone: normalizedPhone,
        password: passcode,
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
        onSubmit={isCompletingProfile ? handleCompleteProfile : handleSubmit}
        className="w-full max-w-md space-y-4 p-8 bg-white/5 rounded-3xl"
      >
        <h1 className="text-2xl font-bold text-center">
          {isCompletingProfile
            ? 'Complete Profile'
            : isSignUp
            ? 'Create Account'
            : 'Login'}
        </h1>

        {(isSignUp || isCompletingProfile) && (
          <>
            <input
              required
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
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
              {Object.values(SystemRole).map((r) => (
                <option key={r} value={r} className="text-black">
                  {r.replace('_', ' ')}
                </option>
              ))}
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
          </>
        )}

        <input
          required
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-3 rounded bg-white/10"
        />

        <input
          required
          type="password"
          placeholder="Passcode"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="w-full p-3 rounded bg-white/10"
        />

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button className="w-full bg-green-600 py-3 rounded font-bold">
          {loading ? 'Please wait…' : isCompletingProfile ? 'Save Profile' : isSignUp ? 'Register' : 'Login'}
        </button>

        {!isCompletingProfile && (
          <button
            type="button"
            onClick={() => setIsSignUp(!isSignUp)}
            className="text-xs text-slate-400 w-full"
          >
            {isSignUp ? 'Already registered? Login' : 'New user? Register'}
          </button>
        )}

        {!isCompletingProfile && (
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full bg-white text-black py-3 rounded font-bold"
          >
            Continue with Google
          </button>
        )}
      </form>
    </div>
  );
};

export default LoginPage;
