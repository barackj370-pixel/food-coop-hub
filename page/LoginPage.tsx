import { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SystemRole } from '../types';

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
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const normalizePhone = (input: string) => {
    const cleaned = input.replace(/\D/g, '');
    if (cleaned.length < 9) return null;
    return `+254${cleaned.slice(-9)}`;
  };

  useEffect(() => {
    const loadProfile = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profile?.status === 'INVITED' || !profile?.role) {
        setIsCompletingProfile(true);
        setFullName(data.user.user_metadata?.full_name ?? '');
        setPhone(data.user.phone ?? '');
      }
    };

    loadProfile();
  }, []);

  const finalizeProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!role) {
      setError('Select a role');
      setLoading(false);
      return;
    }

    if (CLUSTER_ROLES.includes(role as SystemRole) && !cluster) {
      setError('Select a cluster');
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const normalized = normalizePhone(phone);

    const { error } = await supabase
      .from('profiles')
      .update({
        name: fullName,
        phone: normalized,
        role,
        cluster: CLUSTER_ROLES.includes(role as SystemRole) ? cluster : null,
        status: 'ACTIVE',
      })
      .eq('id', data.user.id);

    if (error) setError(error.message);
    else window.location.reload();

    setLoading(false);
  };

  if (isCompletingProfile) {
    return (
      <form onSubmit={finalizeProfile}>
        <input value={fullName} onChange={e => setFullName(e.target.value)} required />
        <input value={phone} onChange={e => setPhone(e.target.value)} required />
        <select value={role} onChange={e => setRole(e.target.value as SystemRole)} required>
          <option value="" disabled>Select role</option>
          {Object.values(SystemRole).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        {CLUSTER_ROLES.includes(role as SystemRole) && (
          <select value={cluster} onChange={e => setCluster(e.target.value)} required>
            <option value="" disabled>Select cluster</option>
            {CLUSTERS.map(c => <option key={c}>{c}</option>)}
          </select>
        )}
        <button disabled={loading}>Finalize</button>
        {error && <p>{error}</p>}
      </form>
    );
  }

  return null; // handled elsewhere
}
