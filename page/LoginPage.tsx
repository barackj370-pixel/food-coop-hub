import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient.ts';
import { SystemRole, AgentIdentity } from '../types.ts';

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

interface LoginPageProps {
  onLoginSuccess: (identity: AgentIdentity) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
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

  /* ───────── CHECK EXISTING SESSION & HANDLE INVITES ───────── */
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // If no session, user is strictly on the login/register screen
      if (!session?.user) return;

      // Check if a profile exists in the public 'users' table
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('phone', session.user.user_metadata?.phone || session.user.phone) // Check metadata phone first for invites
        .maybeSingle();

      if (profile) {
        // User has a session and a profile -> Log them in immediately
        onLoginSuccess(profile as AgentIdentity);
      } else {
        // User has a session (e.g. clicked invite link) but NO profile -> Show Create Account
        setIsCompletingProfile(true);
        
        // Auto-fill details from Invitation Metadata
        const meta = session.user.user_metadata || {};
        if (meta.name || meta.full_name) setFullName(meta.name || meta.full_name);
        if (meta.phone) setPhone(meta.phone);
        if (meta.role) setRole(meta.role as SystemRole);
        if (meta.cluster) setCluster(meta.cluster);
        
        setMessage("Invitation accepted. Please complete your account details.");
      }
    };

    checkUser();
  }, [onLoginSuccess]);

  /* ───────── COMPLETE PROFILE (FOR INVITED USERS) ───────── */
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!role) { setError('Please select a role.'); setLoading(false); return; }
    if (CLUSTER_ROLES.includes(role) && !cluster) { setError('Please select a cluster.'); setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Session expired. Please click the invite link again.'); setLoading(false); return; }

    // 1. Update the User's Password (PIN) in Auth
    if (passcode) {
      const { error: pwError } = await supabase.auth.updateUser({ password: passcode });
      if (pwError) { setError(`Pin Error: ${pwError.message}`); setLoading(false); return; }
    }

    // 2. Create the Public Profile in 'users' table
    const newUserProfile: AgentIdentity = {
      name: fullName,
      phone: phone,
      role: role,
      cluster: CLUSTER_ROLES.includes(role) ? cluster : '-',
      passcode: passcode, // Storing ref for legacy app logic, though Auth handles login
      status: 'ACTIVE'
    };

    const { error: dbError } = await supabase.from('users').upsert(newUserProfile, { onConflict: 'phone' });

    if (dbError) {
      setError(dbError.message);
    } else {
      // Success - Trigger login
      onLoginSuccess(newUserProfile);
    }
    setLoading(false);
  };

  /* ───────── STANDARD SIGN UP / LOGIN ───────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Normalize phone not strictly required here if user inputs clearly, 
    // but good practice. Using raw input for now to match App logic.
    const cleanPhone = phone.trim(); 

    if (isSignUp) {
      if (!role) { setError('Please select a role.'); setLoading(false); return; }
      if (CLUSTER_ROLES.includes(role) && !cluster) { setError('Please select a cluster.'); setLoading(false); return; }

      // Register in Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        phone: cleanPhone,
        password: passcode,
        options: {
          data: { full_name: fullName, role, phone: cleanPhone, cluster }, // Store in metadata for consistency
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      // If sign-up successful, create public profile
      if (data.user) {
         const newUserProfile: AgentIdentity = {
          name: fullName,
          phone: cleanPhone,
          role: role,
          cluster: CLUSTER_ROLES.includes(role) ? cluster : '-',
          passcode: passcode,
          status: 'ACTIVE'
        };

        const { error: dbError } = await supabase.from('users').upsert(newUserProfile);
        if (dbError) {
             setError("Auth created but profile failed: " + dbError.message);
        } else {
             setMessage('Account created successfully! You can now log in.');
             setIsSignUp(false);
        }
      }
    } else {
      // Login
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: cleanPhone,
        password: passcode,
      });

      if (error) {
        setError("Login Failed: " + error.message);
      } else if (data.user) {
        // Fetch profile to confirm
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('phone', cleanPhone)
          .single();
        
        if (profile) {
            onLoginSuccess(profile as AgentIdentity);
        } else {
            // Edge case: User in Auth but not in public table
            setIsCompletingProfile(true);
            setPhone(cleanPhone);
            setMessage("Profile not found. Please complete your details.");
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6 relative overflow-hidden">
        <div className="flex justify-between items-end mb-2 relative z-10">
          <h2 className="text-2xl font-black text-black uppercase tracking-tight">
            {isCompletingProfile ? 'Create Account' : (isSignUp ? 'Register' : 'Login')}
          </h2>
          {!isCompletingProfile && (
            <button 
              onClick={() => { setIsSignUp(!isSignUp); setError(null); }} 
              className="text-[10px] font-black uppercase text-red-600 hover:text-red-700 transition-colors"
            >
              {isSignUp ? 'Back to Login' : 'Create Account'}
            </button>
          )}
        </div>

        <form onSubmit={isCompletingProfile ? handleCompleteProfile : handleSubmit} className="space-y-4 relative z-10">
          
          {/* Name Field - Shown for Register or Complete Profile */}
          {(isSignUp || isCompletingProfile) && (
            <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Full Name</label>
                 <input
                  required
                  type="text"
                  placeholder="e.g. John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all"
                />
            </div>
          )}

          {/* Phone Field - Always shown, but readonly if completing profile from invite */}
          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Phone Number</label>
             <input
              required
              type="tel"
              placeholder="+254..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full border rounded-2xl px-6 py-4 font-bold text-black outline-none transition-all ${isCompletingProfile ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-green-400'}`}
              readOnly={isCompletingProfile && phone.length > 0} 
            />
          </div>

          {/* Passcode Field */}
          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">4-Digit Pin</label>
             <input
              required
              type="password"
              placeholder="****"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black text-center outline-none focus:bg-white focus:border-green-400 transition-all"
            />
          </div>

          {/* Role Selection */}
          {(isSignUp || isCompletingProfile) && (
            <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">System Role</label>
                <select
                  required
                  value={role ?? ''}
                  onChange={(e) => setRole(e.target.value as SystemRole)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all appearance-none"
                >
                  <option value="" disabled>Select Role</option>
                  {Object.values(SystemRole).map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
            </div>
          )}

          {/* Cluster Selection - Conditional */}
          {(isSignUp || isCompletingProfile) && role && CLUSTER_ROLES.includes(role) && (
            <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Cluster</label>
                <select
                  required
                  value={cluster}
                  onChange={(e) => setCluster(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all appearance-none"
                >
                  <option value="" disabled>Select Cluster</option>
                  {CLUSTERS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
            </div>
          )}

          {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl">{error}</div>}
          {message && <div className="p-4 bg-green-50 text-green-600 text-xs font-bold rounded-xl">{message}</div>}

          <button disabled={loading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
            {loading && <i className="fas fa-spinner fa-spin"></i>}
            {isCompletingProfile ? 'Save & Activate' : (isSignUp ? 'Register Account' : 'Authenticate')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;