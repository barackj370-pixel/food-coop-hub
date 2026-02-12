
import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SystemRole, AgentIdentity } from '../types';

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
    // Check for "mode=register" in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'register') {
      setIsSignUp(true);
    }

    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn("Session check warning:", sessionError.message);
        }

        if (!session?.user) return;

        // User is logged in (e.g. from Email Link)
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profile) {
          onLoginSuccess(profile as AgentIdentity);
        } else {
          // Logged in but no profile (Email Invite Clicked)
          const { data: phoneProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('phone', session.user.user_metadata?.phone || session.user.phone)
            .maybeSingle();
            
          if (phoneProfile) {
             onLoginSuccess(phoneProfile as AgentIdentity);
             return;
          }

          setIsCompletingProfile(true);
          const meta = session.user.user_metadata || {};
          
          if (meta.name || meta.full_name) setFullName(meta.name || meta.full_name);
          if (meta.phone) setPhone(meta.phone);
          if (meta.role) setRole(meta.role as SystemRole);
          if (meta.cluster) setCluster(meta.cluster);
          
          setMessage("Welcome! Please set your 4-digit PIN to activate your account.");
        }
      } catch (err) {
        console.error("Session Check Failed:", err);
      }
    };

    checkUser();
  }, [onLoginSuccess]);

  /* ───────── HELPERS ───────── */
  const validatePin = (pin: string) => /^\d{4}$/.test(pin);
  
  // Robust Kenyan Phone Normalizer (E.164 Format)
  const normalizeKenyanPhone = (input: string) => {
    let cleaned = input.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+254')) return cleaned;
    if (cleaned.startsWith('254')) return '+' + cleaned;
    if (cleaned.startsWith('01') || cleaned.startsWith('07')) return '+254' + cleaned.substring(1);
    if (cleaned.startsWith('7') || cleaned.startsWith('1')) return '+254' + cleaned;
    
    return cleaned.length >= 9 ? '+254' + cleaned : '+' + cleaned;
  };
  
  // Pad 4-digit PIN to 6 chars for Supabase Auth requirements
  const getAuthPassword = (p: string) => p.length === 4 ? `${p}00` : p;

  const handleFetchError = (e: any) => {
    const msg = (e.message || e.toString()).toLowerCase();
    if (msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('network')) {
       return "Connection Failed: Unable to reach database. Please check your internet connection and ensure the Project URL in .env is correct.";
    }
    return e.message || "An unexpected error occurred.";
  };

  /* ───────── COMPLETE PROFILE (FOR INVITED USERS) ───────── */
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validatePin(passcode)) { setError('PIN must be exactly 4 digits.'); setLoading(false); return; }
    if (!role) { setError('Please select a role.'); setLoading(false); return; }
    if (CLUSTER_ROLES.includes(role) && !cluster) { setError('Please select a cluster.'); setLoading(false); return; }

    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setError('Session expired. Please click the invite link again.'); setLoading(false); return; }

        // Update Auth Password to the new PIN (padded)
        if (passcode) {
          const { error: pwError } = await supabase.auth.updateUser({ password: getAuthPassword(passcode) });
          if (pwError) throw pwError;
        }

        // Create Profile Entry
        const newUserProfile: AgentIdentity = {
          id: user.id,
          name: fullName,
          phone: normalizeKenyanPhone(phone),
          role: role,
          cluster: CLUSTER_ROLES.includes(role) ? cluster : '-',
          passcode: passcode, // Store plain 4-digit PIN for reference
          status: 'ACTIVE',
          // Autofill extra metadata
          email: user.email,
          provider: user.app_metadata.provider || 'email',
          createdAt: user.created_at,
          lastSignInAt: new Date().toISOString()
        };

        const { error: dbError } = await supabase.from('profiles').upsert(newUserProfile, { onConflict: 'id' });

        if (dbError) throw dbError;
        
        // Clear query params if any
        window.history.replaceState({}, document.title, "/");
        onLoginSuccess(newUserProfile);
    } catch (err: any) {
        setError(handleFetchError(err));
    } finally {
        setLoading(false);
    }
  };

  /* ───────── RESET PIN (SELF-HEALING) ───────── */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const formattedPhone = normalizeKenyanPhone(phone);

    if (!formattedPhone || formattedPhone.length < 10) { setError("Please enter a valid phone number."); setLoading(false); return; }
    if (!validatePin(passcode)) { setError("New PIN must be exactly 4 digits."); setLoading(false); return; }
    if (passcode !== confirmPasscode) { setError("PINs do not match."); setLoading(false); return; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); 

    try {
      const response = await fetch('/api/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, pin: passcode }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
         if (response.status === 404) throw new Error("USER_NOT_FOUND");
         throw new Error("API_UNAVAILABLE");
      }

      const result = await response.json();
      if (result.success) {
        // Auto Login after reset
        const { data } = await supabase.auth.signInWithPassword({ phone: formattedPhone, password: getAuthPassword(passcode) });
        if (data.user) {
           const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
           if (profile) onLoginSuccess(profile as AgentIdentity);
           else window.location.reload();
           return;
        }
      } else {
        setError(result.error || "Reset failed.");
      }
    } catch (err: any) {
      if (err.message === "USER_NOT_FOUND") {
         setError("User not found. Please Register first.");
      } else if (err.message === "API_UNAVAILABLE") {
         setError("Reset service unavailable. Please try again later.");
      } else {
         setError(handleFetchError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  /* ───────── STANDARD SIGN UP / LOGIN ───────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formattedPhone = normalizeKenyanPhone(phone);

    // ─── DEVELOPER BOOTSTRAP LOGIC ───
    const isSystemDev = formattedPhone === '+254725717170';
    const targetName = isSystemDev ? 'Barack James' : fullName;
    const targetRole = isSystemDev ? SystemRole.SYSTEM_DEVELOPER : role;
    const targetCluster = isSystemDev ? '-' : cluster;

    if (!formattedPhone || formattedPhone.length < 12) {
      setError('Invalid Phone Number. Please check format (e.g., 0725...)');
      setLoading(false);
      return;
    }

    if (!validatePin(passcode)) {
      setError('PIN must be exactly 4 digits.');
      setLoading(false);
      return;
    }

    try {
        if (isSignUp) {
          if (!targetRole) { setError('Please select a role.'); setLoading(false); return; }
          if (CLUSTER_ROLES.includes(targetRole) && !targetCluster) { setError('Please select a cluster.'); setLoading(false); return; }

          // 1. Attempt Registration via Server API (Bypasses SMS)
          let registrationSuccess = false;
          let registrationError = '';

          try {
            const apiRes = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                phone: formattedPhone,
                password: getAuthPassword(passcode),
                data: { full_name: targetName, role: targetRole, phone: formattedPhone, cluster: targetCluster }
              })
            });

            const apiData = await apiRes.json();
            if (apiRes.ok && apiData.success) {
              registrationSuccess = true;
            } else if (apiData.error && apiData.error.toLowerCase().includes('already registered')) {
               // Fallthrough to login attempt
               console.log("User exists (API), logging in...");
            } else {
               registrationError = apiData.error || 'Registration failed.';
               throw new Error(registrationError);
            }
          } catch (apiErr: any) {
             // If API fails (e.g. 404 in local dev without functions), fall back to client SDK
             console.warn("API Registration failed, trying client SDK:", apiErr);
             
             // Client SDK Backup (Note: Will fail if Twilio is broken)
             const { data, error } = await supabase.auth.signUp({
                phone: formattedPhone,
                password: getAuthPassword(passcode),
                options: {
                  data: { full_name: targetName, role: targetRole, phone: formattedPhone, cluster: targetCluster },
                },
             });

             if (error) {
               if (error.message.toLowerCase().includes('already registered')) {
                 console.log("User exists (SDK), logging in...");
               } else {
                 throw error;
               }
             } else if (data.user) {
               registrationSuccess = true;
               // Ensure profile exists with metadata
               await supabase.from('profiles').upsert({
                  id: data.user.id,
                  name: targetName,
                  phone: formattedPhone,
                  role: targetRole!,
                  cluster: targetCluster,
                  passcode: passcode,
                  status: 'ACTIVE',
                  provider: data.user.app_metadata.provider,
                  createdAt: data.user.created_at,
                  email: data.user.email
               });
             }
          }

          // 2. Auto Login after Registration
          // This handles both "New Registration Success" and "User Already Exists" cases
          const { data, error: loginError } = await supabase.auth.signInWithPassword({
            phone: formattedPhone,
            password: getAuthPassword(passcode),
          });

          if (loginError) {
             if (registrationSuccess) {
                // Rare edge case: Registered but can't login immediately
                setMessage('Account created! Please log in manually.');
                setIsSignUp(false);
                setLoading(false);
                return;
             }
             setError("Registration failed or Account exists with different PIN. Use 'Forgot Pin'.");
          } else if (data.user) {
             // Success - Ensure Profile (Self-Heal)
             const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
             if (profile) {
                window.history.replaceState({}, document.title, "/");
                onLoginSuccess(profile as AgentIdentity);
             } else {
                // Just in case profile creation failed during register
                const recoveryProfile: AgentIdentity = {
                    id: data.user.id,
                    name: targetName,
                    phone: formattedPhone,
                    role: targetRole!,
                    cluster: targetCluster,
                    passcode: passcode,
                    status: 'ACTIVE',
                    provider: data.user.app_metadata.provider,
                    createdAt: data.user.created_at,
                    email: data.user.email
                };
                await supabase.from('profiles').upsert(recoveryProfile);
                window.history.replaceState({}, document.title, "/");
                onLoginSuccess(recoveryProfile);
             }
          }

        } else {
          // Login
          let { data, error } = await supabase.auth.signInWithPassword({
            phone: formattedPhone,
            password: getAuthPassword(passcode),
          });

          if (error) {
            // Check specifically for connection errors
            if (error.message.includes('fetch')) throw error;
            setError("Invalid PIN or Phone. If you have an account, please use 'Forgot Pin'.");
          } else if (data.user) {
            // Check Profile
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .maybeSingle();
            
            if (profile) {
                onLoginSuccess(profile as AgentIdentity);
            } else {
                console.log("Profile missing. Healing...");
                const recoveryProfile: AgentIdentity = {
                    id: data.user.id,
                    name: data.user.user_metadata.full_name || 'Member',
                    phone: formattedPhone,
                    role: data.user.user_metadata.role || SystemRole.CUSTOMER,
                    cluster: data.user.user_metadata.cluster || 'Mariwa',
                    passcode: passcode,
                    status: 'ACTIVE',
                    provider: data.user.app_metadata.provider,
                    createdAt: data.user.created_at,
                    email: data.user.email
                };
                await supabase.from('profiles').upsert(recoveryProfile);
                onLoginSuccess(recoveryProfile);
            }
          }
        }
    } catch (err: any) {
        setError(handleFetchError(err));
    } finally {
        setLoading(false);
    }
  };

  /* ───────── RENDER MODE ───────── */
  const renderTitle = () => {
    if (isResetting) return 'Set New PIN';
    if (isCompletingProfile) return 'Complete Profile';
    return isSignUp ? 'Create Account' : 'Member Login';
  };

  const handleToggleMode = () => {
    if (isResetting) {
      setIsResetting(false);
      setError(null);
      setPasscode('');
      setConfirmPasscode('');
    } else {
      setIsSignUp(!isSignUp);
      setError(null);
      setPasscode('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6 relative overflow-hidden">
        <div className="flex justify-between items-end mb-2 relative z-10">
          <h2 className="text-2xl font-black text-black uppercase tracking-tight">
            {renderTitle()}
          </h2>
          {!isCompletingProfile && (
            <button 
              type="button"
              onClick={handleToggleMode} 
              className="text-[10px] font-black uppercase text-red-600 hover:text-red-700 transition-colors"
            >
              {isResetting ? 'Back to Login' : (isSignUp ? 'Back to Login' : 'Create Account')}
            </button>
          )}
        </div>

        <form onSubmit={
            isResetting 
              ? handleReset
              : (isCompletingProfile ? handleCompleteProfile : handleSubmit)
          } className="space-y-4 relative z-10"
        >
          
          {/* Name Field */}
          {!isResetting && (isSignUp || isCompletingProfile) && (
            <div className="space-y-1">
                 <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Full Name</label>
                 <input
                  required
                  type="text"
                  placeholder="Enter full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all"
                />
            </div>
          )}

          {/* Phone Field */}
          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Phone Number</label>
             <input
              required
              type="tel"
              placeholder="07... or +254..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full border rounded-2xl px-6 py-4 font-bold text-black outline-none transition-all ${isCompletingProfile ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-green-400'}`}
              readOnly={isCompletingProfile} 
            />
          </div>

          {/* Passcode Field */}
          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">
               {isResetting ? 'New 4-Digit Pin' : '4-Digit Pin'}
             </label>
             <input
              required
              type="password"
              inputMode="numeric"
              maxLength={4}
              pattern="\d{4}"
              placeholder="****"
              value={passcode}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setPasscode(val);
              }}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black text-center outline-none focus:bg-white focus:border-green-400 transition-all tracking-[0.5em]"
            />
          </div>

          {/* Confirm Passcode - Reset Mode */}
          {isResetting && (
            <div className="space-y-1">
               <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Confirm Pin</label>
               <input
                required
                type="password"
                inputMode="numeric"
                maxLength={4}
                pattern="\d{4}"
                placeholder="****"
                value={confirmPasscode}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setConfirmPasscode(val);
                }}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black text-center outline-none focus:bg-white focus:border-green-400 transition-all tracking-[0.5em]"
              />
            </div>
          )}

          {/* Role & Cluster */}
          {(!isResetting) && (isSignUp || isCompletingProfile) && (
            <>
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

              {role && CLUSTER_ROLES.includes(role) && (
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
            </>
          )}

          {error && <div className="p-4 bg-red-50 text-red-600 text-xs font-bold rounded-xl">{error}</div>}
          {message && <div className="p-4 bg-green-50 text-green-600 text-xs font-bold rounded-xl">{message}</div>}

          <button disabled={loading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
            {loading && <i className="fas fa-spinner fa-spin"></i>}
            {isResetting 
              ? 'Reset & Login' 
              : (isCompletingProfile ? 'Save & Activate' : (isSignUp ? 'Register Account' : 'Authenticate'))
            }
          </button>
          
          {!isResetting && !isSignUp && !isCompletingProfile && (
            <button 
              type="button"
              onClick={() => { setIsResetting(true); setError(null); setMessage(null); }}
              className="w-full text-center text-[9px] font-black text-slate-400 uppercase tracking-widest hover:text-black transition-colors"
            >
              Forgot Pin?
            </button>
          )}

        </form>
      </div>
    </div>
  );
};

export default LoginPage;
