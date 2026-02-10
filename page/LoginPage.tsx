
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

  /* ───────── CHECK EXISTING SESSION & HANDLE INVITES ───────── */
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        onLoginSuccess(profile as AgentIdentity);
      } else {
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
        
        setMessage("Invitation accepted. Please complete your account details.");
      }
    };

    checkUser();
  }, [onLoginSuccess]);

  /* ───────── HELPERS ───────── */
  const validatePin = (pin: string) => /^\d{4}$/.test(pin);
  const cleanPhoneNumber = (p: string) => p.trim();

  /* ───────── COMPLETE PROFILE (FOR INVITED USERS) ───────── */
  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!validatePin(passcode)) { setError('PIN must be exactly 4 digits.'); setLoading(false); return; }
    if (!role) { setError('Please select a role.'); setLoading(false); return; }
    if (CLUSTER_ROLES.includes(role) && !cluster) { setError('Please select a cluster.'); setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError('Session expired. Please click the invite link again.'); setLoading(false); return; }

    if (passcode) {
      const { error: pwError } = await supabase.auth.updateUser({ password: passcode });
      if (pwError) { setError(`Pin Error: ${pwError.message}`); setLoading(false); return; }
    }

    const newUserProfile: AgentIdentity = {
      id: user.id,
      name: fullName,
      phone: phone,
      role: role,
      cluster: CLUSTER_ROLES.includes(role) ? cluster : '-',
      passcode: passcode, 
      status: 'ACTIVE'
    };

    const { error: dbError } = await supabase.from('profiles').upsert(newUserProfile, { onConflict: 'id' });

    if (dbError) {
      setError(dbError.message);
    } else {
      onLoginSuccess(newUserProfile);
    }
    setLoading(false);
  };

  /* ───────── RESET PIN (DEV MODE / HYBRID) ───────── */
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const cleanPhone = cleanPhoneNumber(phone);
    if (!cleanPhone) { setError("Please enter your phone number."); setLoading(false); return; }
    if (!validatePin(passcode)) { setError("New PIN must be exactly 4 digits."); setLoading(false); return; }
    if (passcode !== confirmPasscode) { setError("PINs do not match."); setLoading(false); return; }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for API

    try {
      // 1. Attempt Secure API Reset
      const response = await fetch('/api/reset-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, pin: passcode }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Check if response is valid JSON (API exists)
      const contentType = response.headers.get("content-type");
      if (!response.ok || !contentType || !contentType.includes("application/json")) {
        throw new Error("API_UNAVAILABLE");
      }

      const result = await response.json();
      if (result.success) {
        // 2. Auto Login on Success
        const { data } = await supabase.auth.signInWithPassword({ phone: cleanPhone, password: passcode });
        if (data.user) {
           const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
           if (profile) onLoginSuccess(profile as AgentIdentity);
           return;
        }
      }
    } catch (err: any) {
      // 3. FALLBACK: DEV BYPASS
      // If API fails (no backend), we manually verify user exists and log them in
      console.warn("Reset API unreachable, attempting profile lookup bypass...");

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', cleanPhone)
        .maybeSingle();

      if (profile && !profileError) {
        // Note: In a real prod environment without the API, this reset is only local/simulated or requires manual DB intervention.
        // For the purpose of this app without a Node backend, we allow login if the user matches, but warn about the PIN.
        setError("Password reset requires administrator contact. Please contact support.");
        return;
      } else {
         setError("User not found. Please register first.");
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

    const cleanPhone = cleanPhoneNumber(phone);

    if (!validatePin(passcode)) {
      setError('PIN must be exactly 4 digits.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      if (!role) { setError('Please select a role.'); setLoading(false); return; }
      if (CLUSTER_ROLES.includes(role) && !cluster) { setError('Please select a cluster.'); setLoading(false); return; }

      const { data, error } = await supabase.auth.signUp({
        phone: cleanPhone,
        password: passcode,
        options: {
          data: { full_name: fullName, role, phone: cleanPhone, cluster },
        },
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data.user) {
         const newUserProfile: AgentIdentity = {
          id: data.user.id,
          name: fullName,
          phone: cleanPhone,
          role: role,
          cluster: CLUSTER_ROLES.includes(role) ? cluster : '-',
          passcode: passcode,
          status: 'ACTIVE'
        };

        // Try to insert profile immediately
        const { error: dbError } = await supabase.from('profiles').upsert(newUserProfile);
        
        if (dbError) {
             // If DB insert fails (likely RLS because session not ready), we warn but allow "success"
             // because the Login step below will auto-heal it.
             console.warn("Profile creation deferred due to auth state:", dbError.message);
             setMessage('Account created! Please Log In to activate your profile in the database.');
             setIsSignUp(false);
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
        // 1. Check for existing profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();
        
        if (profile) {
            onLoginSuccess(profile as AgentIdentity);
        } else {
            // 2. SELF-HEALING: Profile missing? Recreate it from Auth Metadata
            console.log("Profile missing for authenticated user. Attempting auto-heal...");
            const meta = data.user.user_metadata;
            
            if (meta && meta.role && meta.full_name) {
                const recoveryProfile: AgentIdentity = {
                    id: data.user.id,
                    name: meta.full_name,
                    phone: data.user.phone || cleanPhone,
                    role: meta.role,
                    cluster: meta.cluster || '-',
                    passcode: passcode,
                    status: 'ACTIVE'
                };
                
                const { error: healError } = await supabase.from('profiles').upsert(recoveryProfile);
                
                if (!healError) {
                    onLoginSuccess(recoveryProfile);
                } else {
                    console.error("Auto-heal failed:", healError);
                    setIsCompletingProfile(true);
                    setPhone(cleanPhone);
                    setMessage("Profile synchronization failed. Please re-enter details.");
                }
            } else {
                // Metadata missing too? Force manual completion
                setIsCompletingProfile(true);
                setPhone(cleanPhone);
                setMessage("Profile not found. Please complete your details.");
            }
        }
      }
    }
    setLoading(false);
  };

  /* ───────── RENDER MODE ───────── */
  const renderTitle = () => {
    if (isResetting) return 'Set New PIN';
    if (isCompletingProfile) return 'Create Account';
    return isSignUp ? 'Register' : 'Login';
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
          
          {/* Name Field - Register / Complete Profile only */}
          {!isResetting && (isSignUp || isCompletingProfile) && (
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

          {/* Phone Field - All Modes */}
          <div className="space-y-1">
             <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3">Phone Number</label>
             <input
              required
              type="tel"
              placeholder="+254..."
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`w-full border rounded-2xl px-6 py-4 font-bold text-black outline-none transition-all ${isCompletingProfile ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-green-400'}`}
              readOnly={isCompletingProfile} 
            />
          </div>

          {/* Passcode Field - Login / Register / Complete / Reset */}
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

          {/* Role & Cluster - Register / Complete */}
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
