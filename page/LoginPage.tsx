
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SystemRole, AgentIdentity } from '../types';
import { getEnv } from '../services/env';

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
  SystemRole.SALES_AGENT,
  SystemRole.SUPPLIER,
  SystemRole.CUSTOMER,
];

interface LoginPageProps {
  onLoginSuccess: (identity: AgentIdentity) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [isCompletingProfile, setIsCompletingProfile] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState(''); 
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SystemRole | null>(null);
  const [cluster, setCluster] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  /* ───────── INITIALIZATION & DEEP LINKS ───────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'register') {
      setIsSignUp(true);
    }

    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.warn("Session check warning:", sessionError.message);

        if (!session?.user) return;

        // User is logged in
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          onLoginSuccess(profile as AgentIdentity);
        } else {
          // Logged in but missing profile (Ghost Account or Invite)
          // Attempt automatic self-healing if metadata exists
          const meta = session.user.user_metadata || {};
          
          // Check if we have enough info to auto-create (Common for Email Invites)
          if (meta.full_name && meta.role) {
             console.log("Detected Invite/Ghost Account. Attempting self-heal...");
             await createProfileViaRest({
                id: session.user.id,
                name: meta.full_name,
                phone: meta.phone || session.user.phone || session.user.email || '',
                role: meta.role,
                cluster: meta.cluster || '-',
                passcode: '0000', // Default for email invites, they use password reset later
                status: 'ACTIVE',
                email: session.user.email,
                provider: session.user.app_metadata.provider,
                createdAt: session.user.created_at,
                lastSignInAt: new Date().toISOString()
             }, session.access_token);
             return; 
          }

          setIsCompletingProfile(true);
          if (meta.name || meta.full_name) setFullName(meta.name || meta.full_name);
          if (meta.phone) setPhone(meta.phone);
          if (meta.role) setRole(meta.role as SystemRole);
          if (meta.cluster) setCluster(meta.cluster);
          setMessage("Welcome! Please complete your profile setup.");
        }
      } catch (err) {
        console.error("Session Check Failed:", err);
      }
    };

    checkUser();
  }, [onLoginSuccess]);

  /* ───────── HELPERS ───────── */
  const validatePin = (pin: string) => /^\d{4}$/.test(pin);
  
  const normalizeKenyanPhone = (input: string) => {
    let cleaned = input.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+254')) return cleaned;
    if (cleaned.startsWith('254')) return '+' + cleaned;
    if (cleaned.startsWith('01') || cleaned.startsWith('07')) return '+254' + cleaned.substring(1);
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) return '+254' + cleaned;
    return cleaned.length >= 9 ? '+254' + cleaned : '+' + cleaned;
  };
  
  const getAuthPassword = (p: string) => p.length === 4 ? `${p}00` : p;

  const handleFetchError = (e: any) => {
    const msg = (e.message || e.toString()).toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('network') || msg.includes('signal is aborted')) {
       return "Connection Interrupted: Please check your internet and try again.";
    }
    return e.message || "An unexpected error occurred.";
  };

  /**
   * DIRECT REST API PROFILE CREATION
   * Bypasses the Supabase Client SDK to avoid "signal is aborted" errors 
   * caused by client state transitions during auth.
   */
  const createProfileViaRest = async (profileData: AgentIdentity, accessToken: string) => {
     const supabaseUrl = getEnv('VITE_SUPABASE_URL');
     const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY');

     if (!supabaseUrl || !supabaseKey) {
       throw new Error("Missing System Configuration (URL/Key)");
     }

     const url = `${supabaseUrl}/rest/v1/profiles`;
     
     // Remove undefined values to avoid JSON errors
     const cleanPayload = JSON.parse(JSON.stringify(profileData));

     try {
       const response = await fetch(url, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'apikey': supabaseKey,
           'Authorization': `Bearer ${accessToken}`,
           'Prefer': 'resolution=merge-duplicates'
         },
         body: JSON.stringify(cleanPayload)
       });

       if (!response.ok) {
         const errText = await response.text();
         throw new Error(`DB Sync Failed: ${errText}`);
       }

       // Success - Redirect
       window.history.replaceState({}, document.title, "/");
       onLoginSuccess(profileData);

     } catch (err: any) {
        console.error("REST Profile Create Error:", err);
        setError(`Account created, but profile failed: ${err.message}`);
        // Do NOT stop loading here if called from a flow that handles it, 
        // but since this is usually the final step:
        setLoading(false);
     }
  };

  /* ───────── COMPLETE PROFILE ───────── */
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validatePin(passcode)) { setError('PIN must be exactly 4 digits.'); setLoading(false); return; }
    if (!role) { setError('Please select a role.'); setLoading(false); return; }
    if (CLUSTER_ROLES.includes(role) && !cluster) { setError('Please select a cluster.'); setLoading(false); return; }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) { setError('Session expired. Please click invite link again.'); setLoading(false); return; }

        if (passcode) await supabase.auth.updateUser({ password: getAuthPassword(passcode) });

        await createProfileViaRest({
          id: session.user.id,
          name: fullName,
          phone: normalizeKenyanPhone(phone),
          role: role,
          cluster: CLUSTER_ROLES.includes(role) ? cluster : '-',
          passcode: passcode,
          status: 'ACTIVE',
          email: session.user.email,
          provider: session.user.app_metadata.provider || 'email',
          createdAt: session.user.created_at,
          lastSignInAt: new Date().toISOString()
        }, session.access_token);
    } catch (err: any) {
        setError(handleFetchError(err));
        setLoading(false);
    }
  };

  /* ───────── RESET PIN ───────── */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formattedPhone = normalizeKenyanPhone(phone);
    if (formattedPhone.length < 10) { setError("Invalid phone number."); setLoading(false); return; }
    if (!validatePin(passcode)) { setError("PIN must be 4 digits."); setLoading(false); return; }
    if (passcode !== confirmPasscode) { setError("PINs do not match."); setLoading(false); return; }

    try {
      const response = await fetch('/api/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, pin: passcode }),
      });

      if (!response.ok) throw new Error("Reset API unavailable.");
      const result = await response.json();
      
      if (result.success) {
        const { data } = await supabase.auth.signInWithPassword({ phone: formattedPhone, password: getAuthPassword(passcode) });
        if (data.user) {
           const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
           if (profile) onLoginSuccess(profile as AgentIdentity);
           else window.location.reload(); 
        }
      } else {
        setError(result.error || "Reset failed.");
      }
    } catch (err: any) {
      setError("Automatic reset failed. Contact Admin.");
    } finally {
      setLoading(false);
    }
  };

  /* ───────── REGISTER / LOGIN ───────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formattedPhone = normalizeKenyanPhone(phone);
    const isSystemDev = formattedPhone === '+254725717170';
    const targetName = isSystemDev ? 'Barack James' : fullName;
    const targetRole = isSystemDev ? SystemRole.SYSTEM_DEVELOPER : role;
    const targetCluster = isSystemDev ? '-' : cluster;

    if (formattedPhone.length < 12) { setError('Invalid Phone Format.'); setLoading(false); return; }
    if (!validatePin(passcode)) { setError('PIN must be 4 digits.'); setLoading(false); return; }

    try {
        if (isSignUp) {
          if (!targetRole) { setError('Please select a role.'); setLoading(false); return; }
          if (CLUSTER_ROLES.includes(targetRole) && !targetCluster) { setError('Please select a cluster.'); setLoading(false); return; }

          // 1. Try Client SDK SignUp first (most reliable for direct connection)
          let { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            phone: formattedPhone,
            password: getAuthPassword(passcode),
            options: {
              data: { full_name: targetName, role: targetRole, phone: formattedPhone, cluster: targetCluster },
            },
          });

          // Handle "Already Registered" by proceeding to Login logic
          if (signUpError && signUpError.message.toLowerCase().includes('already registered')) {
             console.log("User exists, attempting login & heal...");
             // Proceed to Login block -> Falls through to next step
          } else if (signUpError) {
             throw signUpError;
          }

          // 2. MANDATORY LOGIN to get Session for RLS
          // We assume if signup succeeded or user existed, we can log in now
          const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
            phone: formattedPhone,
            password: getAuthPassword(passcode),
          });

          if (loginError) {
             setError("Registration successful, but login failed. Please try logging in manually.");
             setIsSignUp(false);
             return;
          }

          // 3. MANDATORY PROFILE CREATION (Using Robust REST Fetch)
          if (loginData.session) {
             await createProfileViaRest({
                id: loginData.session.user.id,
                name: targetName,
                phone: formattedPhone,
                role: targetRole!,
                cluster: targetCluster,
                passcode: passcode,
                status: 'ACTIVE',
                provider: loginData.session.user.app_metadata.provider,
                createdAt: loginData.session.user.created_at,
                email: loginData.session.user.email
             }, loginData.session.access_token);
             // createProfileViaRest calls onLoginSuccess, so we are done
          }

        } else {
          // LOGIN FLOW
          let { data, error } = await supabase.auth.signInWithPassword({
            phone: formattedPhone,
            password: getAuthPassword(passcode),
          });

          if (error) {
            setError("Invalid PIN or Phone.");
            return;
          } 
          
          if (data.session) {
            const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
            
            if (profile) {
                onLoginSuccess(profile as AgentIdentity);
            } else {
                // HEALING: User exists in Auth but not Profile
                console.log("Profile missing on login. Healing...");
                await createProfileViaRest({
                    id: data.session.user.id,
                    name: data.session.user.user_metadata.full_name || 'Member',
                    phone: formattedPhone,
                    role: data.session.user.user_metadata.role || SystemRole.CUSTOMER,
                    cluster: data.session.user.user_metadata.cluster || 'Mariwa',
                    passcode: passcode,
                    status: 'ACTIVE',
                    provider: data.session.user.app_metadata.provider,
                    createdAt: data.session.user.created_at,
                    email: data.session.user.email
                }, data.session.access_token);
            }
          }
        }
    } catch (err: any) {
        setError(handleFetchError(err));
        setLoading(false); // Only ensure loading stops on error
    } finally {
        // NOTE: We don't always set loading false here because createProfileViaRest might be redirecting
        // But if there was an error caught above, loading is cleared.
        // If success, we want the spinner to stay until the page flips.
    }
  };

  const handleToggleMode = () => {
    if (isResetting) {
      setIsResetting(false); setError(null); setPasscode(''); setConfirmPasscode('');
    } else {
      setIsSignUp(!isSignUp); setError(null); setPasscode('');
    }
  };

  const renderTitle = () => isResetting ? 'Set New PIN' : (isCompletingProfile ? 'Complete Profile' : (isSignUp ? 'Create Account' : 'Member Login'));

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6 relative overflow-hidden">
        <div className="flex justify-between items-end mb-2 relative z-10">
          <h2 className="text-2xl font-black text-black uppercase tracking-tight">{renderTitle()}</h2>
          {!isCompletingProfile && (
            <button type="button" onClick={handleToggleMode} className="text-[10px] font-black uppercase text-red-600 hover:text-red-700 transition-colors">
              {isResetting ? 'Back to Login' : (isSignUp ? 'Back to Login' : 'Create Account')}
            </button>
          )}
        </div>

        <form onSubmit={isResetting ? handleReset : (isCompletingProfile ? handleCompleteProfile : handleSubmit)} className="space-y-4 relative z-10">
          
          {!isResetting && (isSignUp || isCompletingProfile) && (
            <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Full Name</label>
                 <input required type="text" placeholder="Enter full name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all" />
            </div>
          )}

          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Phone Number</label>
             <input required type="tel" placeholder="07... or +254..." value={phone} onChange={(e) => setPhone(e.target.value)} className={`w-full border rounded-2xl px-6 py-4 font-bold text-black outline-none transition-all ${isCompletingProfile ? 'bg-slate-100' : 'bg-slate-50 focus:bg-white focus:border-green-400'}`} readOnly={isCompletingProfile} />
          </div>

          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">{isResetting ? 'New 4-Digit Pin' : '4-Digit Pin'}</label>
             <input required type="password" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="****" value={passcode} onChange={(e) => setPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black text-center outline-none focus:bg-white focus:border-green-400 transition-all tracking-[0.5em]" />
          </div>

          {isResetting && (
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Confirm Pin</label>
               <input required type="password" inputMode="numeric" maxLength={4} pattern="\d{4}" placeholder="****" value={confirmPasscode} onChange={(e) => setConfirmPasscode(e.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black text-center outline-none focus:bg-white focus:border-green-400 transition-all tracking-[0.5em]" />
            </div>
          )}

          {(!isResetting) && (isSignUp || isCompletingProfile) && (
            <>
              <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">System Role</label>
                  <select required value={role ?? ''} onChange={(e) => setRole(e.target.value as SystemRole)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all appearance-none">
                    <option value="" disabled>Select Role</option>
                    {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
              </div>
              {role && CLUSTER_ROLES.includes(role) && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Cluster</label>
                    <select required value={cluster} onChange={(e) => setCluster(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all appearance-none">
                      <option value="" disabled>Select Cluster</option>
                      {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
              )}
            </>
          )}

          {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl whitespace-pre-line">{error}</div>}
          {message && <div className="p-4 bg-green-50 text-green-600 text-xs font-bold rounded-xl">{message}</div>}

          <button disabled={loading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
            {loading && <i className="fas fa-spinner fa-spin"></i>}
            {isResetting ? 'Reset & Login' : (isCompletingProfile ? 'Save & Activate' : (isSignUp ? 'Register Account' : 'Authenticate'))}
          </button>
          
          {!isResetting && !isSignUp && !isCompletingProfile && (
            <button type="button" onClick={() => { setIsResetting(true); setError(null); setMessage(null); }} className="w-full text-center text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-black transition-colors">
              Forgot Pin?
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
