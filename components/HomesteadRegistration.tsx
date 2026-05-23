import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { AgentIdentity } from '../types';
import { FOOD_COOPS } from '../App';
import Markdown from 'react-markdown';

interface Props {
  onSuccess?: () => void;
}

const HomesteadRegistration: React.FC<Props> = ({ onSuccess }) => {
  const [phoneOrEmail, setPhoneOrEmail] = useState('');
  const [homesteadName, setHomesteadName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState('');
  const [allBaselines, setAllBaselines] = useState<any[]>([]);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);

  useEffect(() => {
    const fetchBaselines = async () => {
      try {
        const { data } = await supabase.from('farm_baselines').select('*').order('verified_at', { ascending: false });
        if (data) setAllBaselines(data);
      } catch (err) {}
    };
    fetchBaselines();
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setMessage('');
    try {
      setMessage('Acquiring GPS coordinates...');
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          (err) => reject(new Error(`GPS_FAILED: ${err.message}`)),
          { timeout: 30000, enableHighAccuracy: true, maximumAge: 0 }
        );
      });

      setMessage('Generating Agroecology Profile...');
      const { generateAgroecologyProfile } = await import('../services/geminiService');
      const aiProfile = await generateAgroecologyProfile(homesteadName, "Global Baseline", location.lat, location.lng);

      const id = `homestead_${Date.now()}`;
      const payload = {
        id,
        farmer_phone: phoneOrEmail, 
        farmer_name: 'Open Source User',
        farm_name: homesteadName,
        cluster: 'General',
        verified_at: new Date().toISOString(),
        latitude: location.lat,
        longitude: location.lng,
        ai_profile: aiProfile
      };
      
      const { error } = await supabase.from('farm_baselines').insert([payload]);
      
      if (error) throw error;
      
      // Attempt to save AI profile explicitly to pages for fallback too
      await supabase.from('pages').upsert([{ id: `ai_profile_${id}`, content: aiProfile, updated_at: new Date().toISOString() }]);

      // Auto-Login
      const newIdentity: AgentIdentity = {
        name: 'Open Source User',
        phone: phoneOrEmail,
        role: 'FARMER',
        cluster: 'General',
        homesteadName: homesteadName
      };
      localStorage.setItem('agent_session', JSON.stringify(newIdentity));
      
      setMessage('Homestead registered! Redirecting to Farm Dashboard...');
      setHomesteadName('');
      setPhoneOrEmail('');
      setTimeout(() => {
        if (onSuccess) onSuccess();
        // Force reload to pick up new identity if not using React context perfectly
        window.location.href = '/my_farm';
      }, 1500);
    } catch (err: any) {
      setMessage(`Error: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-300">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-emerald-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-5"><i className="fas fa-home text-9xl text-emerald-600"></i></div>
        <h2 className="text-3xl font-black text-black mb-2">Open Source Homestead Baseline</h2>
        <p className="text-slate-500 font-medium mb-8">Register your homestead/household to get access to soil baselines, crop calendars, and AI-driven recommendations. Open to everyone globally.</p>
        
        <form onSubmit={handleRegister} className="space-y-6 relative z-10">
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 bg-white px-2">Email Address</label>
            <input 
              type="email" 
              required
              placeholder="Enter your email address"
              value={phoneOrEmail}
              onChange={e => setPhoneOrEmail(e.target.value)}
              className="w-full mt-2 bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 bg-white px-2">Homestead/Household Name</label>
            <input 
              type="text" 
              required
              placeholder="Give your homestead a name"
              value={homesteadName}
              onChange={e => setHomesteadName(e.target.value)}
              className="w-full mt-2 bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
            />
          </div>
          <button 
            type="submit" 
            disabled={isRegistering}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-black text-[12px] uppercase tracking-widest transition-colors flex items-center justify-center gap-2 w-full sm:w-auto shadow-md hover:shadow-lg"
          >
            {isRegistering ? 'Registering...' : <><i className="fas fa-seedling"></i> Register Homestead</>}
          </button>
          
          {message && <p className={`text-sm font-bold mt-4 ${message.includes('Error') ? 'text-red-500' : 'text-emerald-500'}`}>{message}</p>}
        </form>
      </div>

      {allBaselines.length > 0 && (
        <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
          <h3 className="text-xl font-black text-black mb-8 px-2 tracking-tight">Global Open Source Baseline Records</h3>
          <div className="space-y-4">
            {allBaselines.map(b => (
              <div key={b.id} className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex items-center justify-between gap-4 flex-wrap hover:bg-slate-100 transition-colors">
                <div>
                  <h4 className="font-bold text-black text-lg">{b.farm_name}</h4>
                  <p className="text-xs text-slate-500 font-mono mt-1">{b.farmer_phone ? b.farmer_phone.substring(0, 3) + '****' + b.farmer_phone.slice(-3) : 'Anonymous'} • {new Date(b.verified_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-2">
                     <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase"><i className="fas fa-satellite"></i> GPS Baseline</span>
                  </div>
                  <button 
                    onClick={async () => {
                      // Fetch AI profile if available
                      const { data } = await supabase.from('pages').select('content').eq('id', `ai_profile_${b.id}`).maybeSingle();
                      if (data && data.content) {
                        setViewingProfile(data.content);
                      } else if (b.ai_profile) {
                        setViewingProfile(b.ai_profile);
                      } else {
                        setViewingProfile("Agroecology Profile is currently unavailable for this plot.");
                      }
                    }} 
                    className="p-3 bg-white border border-slate-200 text-emerald-600 hover:text-white hover:bg-emerald-600 hover:border-emerald-600 rounded-xl transition-all shadow-sm flex items-center gap-2 text-xs font-bold uppercase tracking-widest" title="View & Download AI Profile"
                  >
                    <i className="fas fa-leaf"></i> Data & Recommendations
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {viewingProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full rounded-[2.5rem] shadow-2xl my-8 overflow-hidden flex flex-col">
            <div className="bg-emerald-600 p-6 flex justify-between items-center text-white shrink-0">
               <h3 className="font-black text-xl flex items-center gap-2"><i className="fas fa-leaf"></i> Firm Data & Recommendations</h3>
               <button onClick={() => setViewingProfile(null)} className="w-10 h-10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 pb-12 markdown-body text-slate-800 space-y-4 overflow-y-auto max-h-[70vh]">
               <Markdown>{viewingProfile}</Markdown>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4 shrink-0">
               <button onClick={() => window.print()} className="px-6 py-3 bg-white text-slate-800 border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-xs hover:text-black hover:border-slate-400 shadow-sm transition-all flex items-center gap-2"><i className="fas fa-file-pdf"></i> Download PDF</button>
               <button onClick={() => setViewingProfile(null)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors">Close Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomesteadRegistration;
