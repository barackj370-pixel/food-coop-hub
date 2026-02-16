import React, { useEffect, useState, useRef } from 'react';
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

// Fallback credentials matching services/supabaseClient.ts
const FALLBACK_URL = 'https://xtgztxbbkduxfcaocjhh.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh0Z3p0eGJia2R1eGZjYW9jamhoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk0MjY3OTMsImV4cCI6MjA4NTAwMjc5M30._fYCizbbpv1mkyd2qNufDVLOFRc-wI5Yo6zKA3Mp4Og';

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
  const [isInviteFlow, setIsInviteFlow] = useState(false);

  const isMounted = useRef(true);
  const loadingWatchdog = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  /* ───────── SAFETY WATCHDOG ───────── */
  // Forces loading to stop if it runs longer than 20 seconds
  useEffect(() => {
    if (loading) {
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current);
      loadingWatchdog.current = setTimeout(() => {
        if (isMounted.current && loading) {
          setLoading(false);
          setError("Request timed out. Please check your connection and try again.");
        }
      }, 20000); // 20 Seconds Hard Limit
    } else {
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current);
    }
    return () => {
      if (loadingWatchdog.current) clearTimeout(loadingWatchdog.current);
    };
  }, [loading]);

  /* ───────── INITIALIZATION & DEEP LINKS ───────── */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = params.get('mode');
    const nameParam = params.get('name');
    const phoneParam = params.get('phone');
    const roleParam = params.get('role');
    const clusterParam = params.get('cluster');

    if (modeParam === 'register') {
      setIsSignUp(true);
      if (nameParam) {
        setFullName(nameParam);
        setIsInviteFlow(true);
      }
      if (phoneParam) setPhone(phoneParam);
      if (roleParam) setRole(roleParam as SystemRole);
      if (clusterParam) setCluster(clusterParam);
      
      if (nameParam) {
        setMessage(`Welcome ${nameParam}! Please create a 4-digit PIN to secure your account.`);
      }
    }

    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) console.warn("Session check warning:", sessionError.message);

        if (!session?.user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          const mappedProfile: AgentIdentity = {
             id: profile.id,
             name: profile.name,
             phone: profile.phone,
             role: profile.role,
             passcode: profile.passcode,
             cluster: profile.cluster,
             status: profile.status,
             email: profile.email,
             lastSignInAt: profile.last_sign_in_at,
             provider: profile.provider,
             createdAt: profile.created_at
          };
          onLoginSuccess(mappedProfile);
        } else {
          setIsCompletingProfile(true);
          const meta = session.user.user_metadata || {};
          if (meta.name || meta.full_name) setFullName(meta.name || meta.full_name);
          if (meta.phone) setPhone(meta.phone);
          setMessage("Welcome back! Please complete your profile setup.");
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
       return "Connection Issue: Check your internet or try again.";
    }
    if (msg.includes('timeout')) {
       return "Request Timed Out: Server might be waking up (Cold Start). Please try again.";
    }
    return e.message || "An unexpected error occurred.";
  };

  /**
   * DIRECT REST API PROFILE CREATION
   */
  const createProfileViaRest = async (profileData: AgentIdentity, accessToken: string) => {
     const supabaseUrl = getEnv('VITE_SUPABASE_URL') || FALLBACK_URL;
     const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || FALLBACK_KEY;

     const url = `${supabaseUrl}/rest/v1/profiles`;
     
     // MINIMAL PAYLOAD to prevent schema errors
     const dbPayload = {
        id: profileData.id,
        name: profileData.name,
        phone: profileData.phone,
        role: profileData.role,
        cluster: profileData.cluster,
        passcode: profileData.passcode,
        status: 'ACTIVE'
     };

     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s Timeout specifically for this fetch

     try {
       console.log("Attempting profile creation via REST...", dbPayload);
       const response = await fetch(url, {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'apikey': supabaseKey,
           'Authorization': `Bearer ${accessToken}`,
           'Prefer': 'resolution=merge-duplicates'
         },
         body: JSON.stringify(dbPayload),
         signal: controller.signal
       });

       clearTimeout(timeoutId);

       if (!response.ok) {
         const errText = await response.text();
         console.warn(`Profile creation warning (REST): ${errText}`);
         // We don't throw here if it's a conflict or minor issue, we try to proceed
       } else {
         console.log("Profile created successfully via REST");
       }

       if (isMounted.current) {
          window.history.replaceState({}, document.title, "/");
          onLoginSuccess(profileData);
       }
     } catch (err: any) {
        clearTimeout(timeoutId);
        console.error("Critical Profile Creation Error:", err);
        throw err;
     }
  };

  /* ───────── COMPLETE PROFILE ───────── */
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
        if (!validatePin(passcode)) throw new Error('PIN must be exactly 4 digits.');
        if (!role) throw new Error('Please select a role.');
        if (CLUSTER_ROLES.includes(role) && !cluster) throw new Error('Please select a cluster.');

        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) throw new Error('Session expired. Please reload.');

        if (passcode) await supabase.auth.updateUser({ password: getAuthPassword(passcode) });

        await createProfileViaRest({
          id: session.user.id,
          name: fullName,
          phone: normalizeKenyanPhone(phone),
          role: role,
          cluster: CLUSTER_ROLES.includes(role) ? cluster : '-',
          passcode: passcode,
          status: 'ACTIVE'
        }, session.access_token);
        
    } catch (err: any) {
        if (isMounted.current) {
            setError(handleFetchError(err));
            setLoading(false);
        }
    }
  };

  /* ───────── RESET PIN ───────── */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formattedPhone = normalizeKenyanPhone(phone);
    
    try {
        if (formattedPhone.length < 10) throw new Error("Invalid phone number.");
        if (!validatePin(passcode)) throw new Error("PIN must be 4 digits.");
        if (passcode !== confirmPasscode) throw new Error("PINs do not match.");

       const { data: { session } } = await supabase.auth.getSession();
       
       if (session) {
          const { error } = await supabase.auth.updateUser({ password: getAuthPassword(passcode) });
          if (error) throw error;
          if (isMounted.current) {
              setMessage("PIN updated successfully.");
              setIsResetting(false);
          }
       } else {
          throw new Error("For security, please contact your Cluster Admin to reset your PIN if you are locked out.");
       }
    } catch (err: any) {
      if (isMounted.current) setError(err.message || "Reset failed.");
    } finally {
      if (isMounted.current) setLoading(false);
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

    try {
        if (formattedPhone.length < 12) throw new Error('Invalid Phone Format.');
        if (!validatePin(passcode)) throw new Error('PIN must be 4 digits.');

        if (isSignUp) {
          if (!targetRole) throw new Error('Please select a role.');
          if (CLUSTER_ROLES.includes(targetRole) && !targetCluster) throw new Error('Please select a cluster.');

          // 1. Sign Up
          let { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            phone: formattedPhone,
            password: getAuthPassword(passcode),
            options: {
              data: { full_name: targetName, role: targetRole, phone: formattedPhone, cluster: targetCluster },
            },
          });

          if (signUpError && signUpError.message.toLowerCase().includes('already registered')) {
             console.log("User exists, attempting login...");
             // Fallthrough to login logic
          } else if (signUpError) {
             throw signUpError;
          }

          // 2. Determine Session
          let session = signUpData.session;
          let accessToken = session?.access_token;
          
          if (!session) {
             const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
                phone: formattedPhone,
                password: getAuthPassword(passcode),
             });
             
             if (loginError) {
                 if (isMounted.current) {
                    setError("Registration successful. Please switch to 'Member Login' to continue.");
                    setIsSignUp(false);
                 }
                 setLoading(false);
                 return; 
             }
             session = loginData.session;
             accessToken = loginData.session?.access_token;
          }

          // 3. Create Profile
          if (session && accessToken) {
             await createProfileViaRest({
                id: session.user.id,
                name: targetName,
                phone: formattedPhone,
                role: targetRole!,
                cluster: targetCluster,
                passcode: passcode,
                status: 'ACTIVE'
             }, accessToken);
          } else {
             if (isMounted.current) {
                setError("Registration successful. Please Login.");
                setIsSignUp(false);
             }
          }

        } else {
          // LOGIN FLOW
          let { data, error } = await supabase.auth.signInWithPassword({
            phone: formattedPhone,
            password: getAuthPassword(passcode),
          });

          if (error) throw new Error("Invalid Credentials. If you are new, please use 'Create Account'.");
          
          if (data.session) {
            const { data: profile, error: profileError } = await supabase.from('profiles').select('*').eq('id', data.session.user.id).maybeSingle();
            
            if (profile) {
                // Success path
                const mappedProfile: AgentIdentity = {
                    id: profile.id,
                    name: profile.name,
                    phone: profile.phone,
                    role: profile.role,
                    passcode: profile.passcode,
                    cluster: profile.cluster,
                    status: profile.status,
                    email: profile.email,
                    lastSignInAt: profile.last_sign_in_at,
                    provider: profile.provider,
                    createdAt: profile.created_at
                 };
                if (isMounted.current) onLoginSuccess(mappedProfile);
            } else {
                // Profile Healing - Attempt to create missing profile
                console.log("Profile missing on login. Healing...");
                const meta = data.session.user.user_metadata || {};
                
                try {
                    await createProfileViaRest({
                        id: data.session.user.id,
                        name: meta.full_name || 'Member',
                        phone: formattedPhone,
                        role: meta.role || SystemRole.CUSTOMER,
                        cluster: meta.cluster || 'Mariwa',
                        passcode: passcode,
                        status: 'ACTIVE'
                    }, data.session.access_token);
                } catch (healingError) {
                    console.error("Healing failed:", healingError);
                    // Still throw error so user knows something is wrong, or let them in with partial data?
                    // Safer to ask them to contact admin if self-healing fails.
                    throw new Error("Account exists but profile setup is incomplete. Please contact Admin.");
                }
            }
          }
        }
    } catch (err: any) {
        if (isMounted.current) {
            setError(handleFetchError(err));
        }
    } finally {
        if (isMounted.current) setLoading(false);
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
          {!isCompletingProfile && !isInviteFlow && (
            <button type="button" onClick={handleToggleMode} className="text-[10px] font-black uppercase text-red-600 hover:text-red-700 transition-colors">
              {isResetting ? 'Back to Login' : (isSignUp ? 'Back to Login' : 'Create Account')}
            </button>
          )}
        </div>

        <form onSubmit={isResetting ? handleReset : (isCompletingProfile ? handleCompleteProfile : handleSubmit)} className="space-y-4 relative z-10">
          
          {!isResetting && (isSignUp || isCompletingProfile) && (
            <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Full Name</label>
                 <input 
                   required 
                   type="text" 
                   placeholder="Enter full name" 
                   value={fullName} 
                   onChange={(e) => setFullName(e.target.value)} 
                   className={`w-full border rounded-2xl px-6 py-4 font-bold text-black outline-none transition-all ${isInviteFlow ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-green-400'}`}
                   readOnly={isInviteFlow}
                 />
            </div>
          )}

          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Phone Number</label>
             <input 
                required 
                type="tel" 
                placeholder="07... or +254..." 
                value={phone} 
                onChange={(e) => setPhone(e.target.value)} 
                className={`w-full border rounded-2xl px-6 py-4 font-bold text-black outline-none transition-all ${isCompletingProfile || isInviteFlow ? 'bg-slate-100 text-slate-500' : 'bg-slate-50 focus:bg-white focus:border-green-400'}`} 
                readOnly={isCompletingProfile || isInviteFlow} 
             />
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
                  {isInviteFlow ? (
                    <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-500">{role}</div>
                  ) : (
                    <select required value={role ?? ''} onChange={(e) => setRole(e.target.value as SystemRole)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all appearance-none">
                      <option value="" disabled>Select Role</option>
                      {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
              </div>
              {role && CLUSTER_ROLES.includes(role) && (
                <div className="space-y-1 animate-in slide-in-from-top-2 duration-300">
                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Cluster</label>
                    {isInviteFlow ? (
                        <div className="w-full bg-slate-100 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-500">{cluster}</div>
                    ) : (
                        <select required value={cluster} onChange={(e) => setCluster(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all appearance-none">
                        <option value="" disabled>Select Cluster</option>
                        {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    )}
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
