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
  const [role, setRole] = useState<SystemRole | null>(null);
  const [cluster, setCluster] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /* ───────── PHONE NORMALIZATION (KE) ───────── */
  const normalizePhone = (input: string): string | null => {
    const cleaned = input.replace(/\D/g, '');
    if (cleaned.length < 9) return null;
    return `+254${cleaned.slice(-9)}`;
  };

  /* ───────── CHECK EXISTING SESSION ───────── */
  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (!profile) {
        setIsCompletingProfile(true);
        setFullName(data.user.user_metadata?.full_name || '');
        if (data.user.phone) setPhone(data.user.phone);
      }
    };

    checkUser();
  }, []);

  /* ───────── GOOGLE LOGIN ───────── */
  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  /* ───────── COMPLETE PROFILE ───────── */
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

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setError('No active session.');
      setLoading(false);
      return;
    }

    const normalized = normalizePhone(phone) || data.user.phone;

    const { error } = await supabase.from('profiles').upsert({
      id: data.user.id,
      name: fullName,
      role,
      cluster: CLUSTER_ROLES.includes(role) ? cluster : null,
      phone: normalized,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setError(error.message);
    } else {
      window.location.reload();
    }

    setLoading(false);
  };

  /* ───────── SIGN UP / LOGIN ───────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      setError('Enter a valid Kenyan phone number.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
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

      const { data, error } = await supabase.auth.signUp({
        phone: normalizedPhone,
        password: passcode,
        options: {
          data: { full_name: fullName, role },
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          name: fullName,
          role,
          cluster: CLUSTER_ROLES.includes(role) ? cluster : null,
          phone: normalizedPhone,
          updated_at: new Date().toISOString(),
        });
      }

      setMessage('Account created. Please log in.');
      setIsSignUp(false);
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
      <form onSubmit={isCompletingProfile ? handleCompleteProfile : handleSubmit} className="w-full max-w-md space-y-4 p-8 bg-white/5 rounded-3xl">
        <h1 className="text-2xl font-bold text-center">
          {isCompletingProfile ? 'Finalize Profile' : isSignUp ? 'Create Account' : 'Login'}
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
              value={role ?? ''}
              onChange={(e) => setRole(e.target.value as SystemRole)}
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
                onChange={(e) => setCluster(e.target.value)}
                className="w-full p-3 rounded bg-white/10"
              >
                <option value="" disabled>Select cluster</option>
                {CLUSTERS.map(c => (
                  <option key={c} value={c} className="text-black">{c}</option>
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
        {message && <p className="text-green-400 text-sm">{message}</p>}

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
