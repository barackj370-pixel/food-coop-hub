
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SaleRecord, RecordStatus, OrderStatus, SystemRole, AgentIdentity, AccountStatus, MarketOrder, ProduceListing } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import ProduceForm from './components/ProduceForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, GOOGLE_SHEET_VIEW_URL, COMMODITY_CATEGORIES, CROP_CONFIG } from './constants.ts';

type PortalType = 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'HOME' | 'ABOUT' | 'CONTACT' | 'LOGIN' | 'NEWS';
type MarketView = 'SALES' | 'SUPPLIER';

export const CLUSTERS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana'];

const APP_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000000' d='M160 96c0-17.7-14.3-32-32-32H32C14.3 64 0 78.3 0 96s14.3 32 32 32h73.4l57.1 240.1c5.3 22.3 25.3 37.9 48.2 37.9H436c22.9 0 42.9-15.6 48.2-37.9l39.1-164.2c4.2-17.8-7-35.7-24.9-39.9s-35.7 7-39.9 24.9l-33.9 142.2H198.5l-57.1-240c-2.7-11.2-12.7-19-24.1-19H32z'/%3E%3Ccircle fill='%23dc2626' cx='208' cy='448' r='48'/%3E%3Ccircle fill='%23dc2626' cx='416' cy='448' r='48'/%3E%3Cpath fill='%2322c55e' d='M340 120 C 340 120, 260 140, 260 220 C 260 300, 340 320, 340 320 S 420 300, 420 220 C 420 140, 340 120, 340 120 Z' transform='translate(0, -30)'/%3E%3Cpath fill='none' stroke='%2322c55e' stroke-width='12' stroke-linecap='round' d='M340 320 L 340 360' transform='translate(0, -30)'/%3E%3Cpath fill='white' d='M340 150 L 340 290' stroke='white' stroke-width='4' stroke-linecap='round' transform='translate(0, -30)'/%3E%3C/svg%3E";

const persistence = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set: (key: string, val: string) => {
    try { localStorage.setItem(key, val); } catch (e) { }
  },
  remove: (key: string) => {
    try { localStorage.removeItem(key); } catch (e) { }
  }
};

const normalizePhone = (p: any) => {
  let s = String(p || '').trim();
  if (s.includes('.')) s = s.split('.')[0];
  const clean = s.replace(/\D/g, '');
  return clean.length >= 9 ? clean.slice(-9) : clean;
};

const normalizePasscode = (p: any) => {
  let s = String(p || '').trim();
  if (s.includes('.')) s = s.split('.')[0];
  return s.replace(/\D/g, '');
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>(() => {
    const saved = persistence.get('food_coop_data');
    return saved ? JSON.parse(saved) : [];
  });

  const [produceListings, setProduceListings] = useState<ProduceListing[]>(() => {
    const saved = persistence.get('food_coop_produce');
    return saved ? JSON.parse(saved) : [];
  });

  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('HOME');
  const [marketView, setMarketView] = useState<MarketView>('SUPPLIER');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: ''
  });

  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER;

  const handleLogout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
    setCurrentPortal('HOME');
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setTimeout(() => {
      const user: AgentIdentity = {
        name: authForm.name || 'User',
        phone: authForm.phone,
        passcode: authForm.passcode,
        role: authForm.role,
        cluster: authForm.cluster || 'Mariwa',
        status: 'ACTIVE'
      };
      setAgentIdentity(user);
      persistence.set('agent_session', JSON.stringify(user));
      setCurrentPortal('HOME');
      setIsAuthLoading(false);
    }, 1000);
  };

  const stats = useMemo(() => {
    const totalProfit = records.reduce((acc, r) => acc + Number(r.coopProfit), 0);
    return { totalProfit };
  }, [records]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-4 gap-6">
          <div className="flex items-center space-x-5">
            <div className="bg-white w-16 h-16 rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden"><img src={APP_LOGO} alt="KPL Logo" className="w-10 h-10 object-contain" /></div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-black">KPL Food Coop Market</h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{agentIdentity ? `${agentIdentity.name} - ${agentIdentity.cluster}` : 'Guest Hub Access'}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
            {agentIdentity ? (
              <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100"><i className="fas fa-power-off"></i></button>
            ) : (
              <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-3"><i className="fas fa-user-shield"></i> Member Login</button>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 -mt-8 relative z-20 space-y-12">
        {currentPortal === 'LOGIN' && (
           <div className="flex flex-col items-center py-12">
              <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6">
                 <h2 className="text-2xl font-black text-black uppercase tracking-tight">Login</h2>
                 <form onSubmit={handleAuth} className="space-y-4">
                    <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none" />
                    <input type="password" placeholder="Pin" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none" />
                    <button disabled={isAuthLoading} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl">{isAuthLoading ? '...' : 'Authenticate'}</button>
                 </form>
              </div>
           </div>
        )}

        {currentPortal === 'HOME' && (
          <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-12 items-center">
            <div className="flex-1 space-y-6">
              <h2 className="text-4xl font-black uppercase tracking-tight text-black leading-tight">Welcome to the KPL Cooperative Hub</h2>
              <p className="text-slate-600 font-medium">Sustainable growth for our community through transparent trade.</p>
              <button onClick={() => setCurrentPortal('MARKET')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">Explore Market</button>
            </div>
          </div>
        )}

        {currentPortal === 'MARKET' && agentIdentity && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Total Coop Profit" icon="fa-check-circle" value={`KSh ${stats.totalProfit.toLocaleString()}`} color="bg-white" accent="text-green-600" />
            </div>
            <SaleForm clusters={CLUSTERS} produceListings={produceListings} onSubmit={(data) => {
              // Fix: Ensure the new record object conforms to the SaleRecord interface by adding missing required properties like 'signature'
              const newRecord: SaleRecord = { 
                ...data, 
                id: Math.random().toString(36).substring(7).toUpperCase(), 
                coopProfit: data.unitsSold * data.unitPrice * PROFIT_MARGIN, 
                totalSale: data.unitsSold * data.unitPrice, 
                status: RecordStatus.DRAFT, 
                signature: 'SYSTEM_DIGITAL_SIG_PENDING',
                createdAt: new Date().toISOString(),
                agentPhone: agentIdentity.phone,
                agentName: agentIdentity.name,
                cluster: data.cluster || agentIdentity.cluster
              };
              const updated = [newRecord, ...records];
              setRecords(updated);
              persistence.set('food_coop_data', JSON.stringify(updated));
            }} />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
