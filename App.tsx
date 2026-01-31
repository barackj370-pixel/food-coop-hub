
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SaleRecord, RecordStatus, OrderStatus, SystemRole, AgentIdentity, AccountStatus, MarketOrder, ProduceListing } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import ProduceForm from './components/ProduceForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, GOOGLE_SHEET_VIEW_URL, COMMODITY_CATEGORIES, CROP_CONFIG } from './constants.ts';
import { 
  syncToGoogleSheets, 
  fetchFromGoogleSheets, 
  syncUserToCloud, 
  fetchUsersFromCloud, 
  deleteRecordFromCloud, 
  deleteUserFromCloud,
  deleteAllUsersFromCloud,
  deleteProduceFromCloud,
  deleteAllProduceFromCloud,
  syncOrderToCloud,
  fetchOrdersFromCloud,
  syncProduceToCloud,
  fetchProduceFromCloud,
  deleteAllOrdersFromCloud,
  deleteAllRecordsFromCloud
} from './services/googleSheetsService.ts';

type PortalType = 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'HOME' | 'ABOUT' | 'CONTACT' | 'LOGIN' | 'NEWS';
type MarketView = 'SALES' | 'SUPPLIER' | 'CUSTOMER';

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

// Global robust normalization function
const normalizePhone = (p: any) => {
  let s = String(p || '').trim();
  if (s.includes('.')) s = s.split('.')[0];
  const clean = s.replace(/\D/g, '');
  return clean.length >= 9 ? clean.slice(-9) : clean;
};

// Robust passcode normalization
const normalizePasscode = (p: any) => {
  let s = String(p || '').trim();
  if (s.includes('.')) s = s.split('.')[0];
  return s.replace(/\D/g, '');
};

const computeHash = async (record: any): Promise<string> => {
  const normalizedUnits = Number(record.unitsSold).toString();
  const normalizedPrice = Number(record.unitPrice).toString();
  const msg = `${record.id}-${record.date}-${normalizedUnits}-${normalizedPrice}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(msg);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>(() => {
    const saved = persistence.get('food_coop_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>(() => {
    const saved = persistence.get('food_coop_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [produceListings, setProduceListings] = useState<ProduceListing[]>(() => {
    const saved = persistence.get('food_coop_produce');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [deletedProduceIds, setDeletedProduceIds] = useState<string[]>(() => {
    const saved = persistence.get('deleted_produce_blacklist');
    return saved ? JSON.parse(saved) : [];
  });

  const [users, setUsers] = useState<AgentIdentity[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('HOME');
  const [marketView, setMarketView] = useState<MarketView>(() => {
    const saved = persistence.get('agent_session');
    if (saved) {
      const agent = JSON.parse(saved);
      return agent.role === SystemRole.SUPPLIER ? 'SUPPLIER' : 'CUSTOMER';
    }
    return 'CUSTOMER';
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncLock = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fulfillmentData, setFulfillmentData] = useState<any>(null);
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);

  const [contactForm, setContactForm] = useState({
    name: '', email: '', subject: '', message: ''
  });

  const [authForm, setAuthForm] = useState({
    name: '', phone: '', passcode: '', role: SystemRole.FIELD_AGENT, cluster: ''
  });

  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity?.name === 'Barack James';

  const isPrivilegedRole = (agent: AgentIdentity | null) => {
    if (!agent) return false;
    return isSystemDev || 
           agent.role === SystemRole.MANAGER || 
           agent.role === SystemRole.FINANCE_OFFICER || 
           agent.role === SystemRole.AUDITOR;
  };

  const availablePortals = useMemo<PortalType[]>(() => {
    const guestPortals: PortalType[] = ['HOME', 'NEWS', 'ABOUT', 'CONTACT'];
    if (!agentIdentity) return guestPortals;
    
    const loggedInBase: PortalType[] = ['HOME', 'NEWS', 'ABOUT', 'MARKET', 'CONTACT'];
    if (isSystemDev) return [...loggedInBase, 'FINANCE', 'AUDIT', 'BOARD', 'SYSTEM'];
    if (agentIdentity.role === SystemRole.SUPPLIER) return loggedInBase;
    
    let base = [...loggedInBase];
    if (agentIdentity.role === SystemRole.FINANCE_OFFICER) base.splice(4, 0, 'FINANCE');
    else if (agentIdentity.role === SystemRole.AUDITOR) base.splice(4, 0, 'AUDIT');
    else if (agentIdentity.role === SystemRole.MANAGER) base.splice(4, 0, 'FINANCE', 'AUDIT', 'BOARD');
    return base;
  }, [agentIdentity, isSystemDev]);

  const loadCloudData = useCallback(async () => {
    if (syncLock.current) return;
    syncLock.current = true;
    setIsSyncing(true);
    try {
      const [cloudUsers, cloudRecords, cloudOrders, cloudProduce] = await Promise.all([
        fetchUsersFromCloud(),
        fetchFromGoogleSheets(),
        fetchOrdersFromCloud(),
        fetchProduceFromCloud()
      ]);
      
      if (cloudUsers && cloudUsers.length > 0) {
        setUsers(cloudUsers);
        persistence.set('coop_users', JSON.stringify(cloudUsers));
      }

      if (cloudRecords !== null) {
        setRecords(cloudRecords);
        persistence.set('food_coop_data', JSON.stringify(cloudRecords));
      }

      if (cloudOrders !== null) {
        setMarketOrders(cloudOrders);
        persistence.set('food_coop_orders', JSON.stringify(cloudOrders));
      }

      if (cloudProduce !== null) {
        const blacklist = new Set(deletedProduceIds);
        const filteredCloud = cloudProduce.filter(cp => !blacklist.has(cp.id));
        setProduceListings(filteredCloud);
        persistence.set('food_coop_produce', JSON.stringify(filteredCloud));
      }
      setLastSyncTime(new Date());
    } catch (e) { console.error("Global Sync failed:", e); } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [deletedProduceIds]);

  useEffect(() => {
    const savedUsers = persistence.get('coop_users');
    if (savedUsers) { try { setUsers(JSON.parse(savedUsers)); } catch (e) { } }
    loadCloudData();
  }, [loadCloudData]);

  useEffect(() => {
    const interval = setInterval(() => { loadCloudData(); }, SYNC_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [loadCloudData]);

  const filteredRecords = useMemo(() => {
    let base = records.filter(r => r.id && r.date);
    if (agentIdentity) {
      if (!isPrivilegedRole(agentIdentity)) {
        base = base.filter(r => normalizePhone(r.agentPhone || '') === normalizePhone(agentIdentity.phone || ''));
      }
    }
    return base;
  }, [records, agentIdentity]);

  const stats = useMemo(() => {
    const relevantRecords = filteredRecords;
    const verifiedComm = relevantRecords.filter(r => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingAuditComm = relevantRecords.filter(r => r.status === RecordStatus.VALIDATED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingFinanceComm = relevantRecords.filter(r => r.status === RecordStatus.PAID).reduce((a, b) => a + Number(b.coopProfit), 0);
    const dueComm = relevantRecords.filter(r => r.status === RecordStatus.DRAFT).reduce((a, b) => a + Number(b.coopProfit), 0);
    return { awaitingAuditComm, awaitingFinanceComm, approvedComm: verifiedComm, dueComm };
  }, [filteredRecords]);

  const boardMetrics = useMemo(() => {
    const clusterMap = filteredRecords.reduce((acc: Record<string, { volume: number, profit: number }>, r) => {
      const cluster = r.cluster || 'Unknown';
      if (!acc[cluster]) acc[cluster] = { volume: 0, profit: 0 };
      acc[cluster].volume += Number(r.totalSale);
      acc[cluster].profit += Number(r.coopProfit);
      return acc;
    }, {} as Record<string, { volume: number, profit: number }>);
    return { clusterPerformance: Object.entries(clusterMap).sort((a: any, b: any) => b[1].profit - a[1].profit) as [string, { volume: number, profit: number }][] };
  }, [filteredRecords]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    
    const targetPhoneNormalized = normalizePhone(authForm.phone);
    const targetPasscode = normalizePasscode(authForm.passcode);
    
    if (targetPhoneNormalized.length < 8) {
      alert("Invalid Phone: Please enter a valid phone number.");
      setIsAuthLoading(false);
      return;
    }

    try {
      const latestCloudUsers = await fetchUsersFromCloud();
      if (latestCloudUsers && latestCloudUsers.length > 0) {
        setUsers(latestCloudUsers);
        persistence.set('coop_users', JSON.stringify(latestCloudUsers));
      }

      const authPool = latestCloudUsers || users;

      if (isRegisterMode) {
        if (authForm.role !== SystemRole.SYSTEM_DEVELOPER && !authForm.cluster) { 
          alert("Registration Error: Cluster selection is mandatory."); 
          setIsAuthLoading(false); 
          return; 
        }
        
        const newUser: AgentIdentity = { 
          name: authForm.name.trim(), 
          phone: authForm.phone.trim(), 
          passcode: targetPasscode, 
          role: authForm.role, 
          cluster: (authForm.role === SystemRole.SYSTEM_DEVELOPER || authForm.role === SystemRole.FINANCE_OFFICER || authForm.role === SystemRole.AUDITOR || authForm.role === SystemRole.MANAGER) ? '-' : (authForm.cluster || 'System'), 
          status: 'ACTIVE' 
        };
        
        const syncSuccess = await syncUserToCloud(newUser);
        if (!syncSuccess) {
           alert("Warning: Account created locally, but failed to sync with cloud. Please ensure you have an active internet connection.");
        }
        
        setAgentIdentity(newUser);
        persistence.set('agent_session', JSON.stringify(newUser));
        setCurrentPortal('HOME');
      } else {
        const matchedUser = authPool.find(u => {
          const cloudPhoneNorm = normalizePhone(u.phone);
          const cloudPassNorm = normalizePasscode(u.passcode);
          return cloudPhoneNorm === targetPhoneNormalized && cloudPassNorm === targetPasscode;
        });
        
        if (matchedUser) { 
          setAgentIdentity(matchedUser); 
          persistence.set('agent_session', JSON.stringify(matchedUser)); 
          setCurrentPortal('HOME');
        } else {
          alert("Authentication Failed: Account not found or passcode is incorrect."); 
        }
      }
    } catch (err) { 
      console.error("Critical Auth Error:", err);
      alert("System Error: A failure occurred during authentication."); 
    } finally { 
      setIsAuthLoading(false); 
    }
  };

  const handleLogout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
    setCurrentPortal('HOME');
  };

  const renderCustomerPortal = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-12">
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
          <div>
            <h3 className="text-sm font-black text-black uppercase tracking-widest">Coop Storefront</h3>
            <p className="text-[9px] font-black text-green-600 uppercase tracking-[0.2em] mt-1">Direct from Local Farmers</p>
          </div>
          <div className="bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 flex items-center gap-3">
            <i className="fas fa-map-marker-alt text-red-600"></i>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Your Cluster: {agentIdentity?.cluster || 'Unassigned'}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {produceListings.filter(p => p.status === 'AVAILABLE' && p.unitsAvailable > 0).map(p => (
              <div key={p.id} className="bg-slate-50/50 rounded-[2rem] border border-slate-100 p-8 flex flex-col justify-between hover:bg-white hover:shadow-2xl transition-all group">
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest ${p.cluster === agentIdentity?.cluster ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                      {p.cluster} {p.cluster === agentIdentity?.cluster && ' (Local)'}
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-black text-black uppercase leading-tight">{p.cropType}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">{p.unitsAvailable} {p.unitType} in stock</p>
                  </div>
                  <div className="pt-4 border-t border-slate-100">
                    <p className="text-lg font-black text-black">KSh {p.sellingPrice.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">/ {p.unitType}</span></p>
                  </div>
                </div>
                <button 
                  onClick={() => {/* Order logic */}}
                  className="w-full mt-8 bg-black text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-green-600 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  <i className="fas fa-shopping-cart"></i> Order Now
                </button>
              </div>
          ))}
        </div>
      </div>
    </div>
  );

  const AuditLogTable = ({ data, title, onDelete }: { data: SaleRecord[], title: string, onDelete?: (id: string) => void }) => {
    const groupedData = data.reduce((acc: Record<string, SaleRecord[]>, r) => {
        const cluster = r.cluster || 'Unassigned';
        if (!acc[cluster]) acc[cluster] = [];
        acc[cluster].push(r);
        return acc;
      }, {} as Record<string, SaleRecord[]>);
    
    return (
      <div className="space-y-12">
        <h3 className="text-sm font-black text-black uppercase tracking-tighter ml-2">{title} ({data.length})</h3>
        {Object.entries(groupedData).map(([cluster, records]) => (
            <div key={cluster} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg overflow-x-auto">
              <h4 className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-6 border-b border-red-50 pb-3">
                <i className="fas fa-map-marker-alt mr-2"></i> Cluster: {cluster}
              </h4>
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <tr><th className="pb-6">Date</th><th className="pb-6">Details</th><th className="pb-6">Commodity</th><th className="pb-6">Gross Sale</th><th className="pb-6 text-right">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(r => (
                    <tr key={r.id} className="text-[11px] font-bold group hover:bg-slate-50/50">
                      <td className="py-6 text-slate-400">{r.date}</td>
                      <td className="py-6">
                        <div className="space-y-1">
                          <p className="text-black font-black uppercase text-[10px]">Buyer: {r.customerName}</p>
                          <p className="text-slate-500 font-bold text-[9px]">Supplier: {r.farmerName}</p>
                        </div>
                      </td>
                      <td className="py-6 text-black uppercase">{r.cropType}</td>
                      <td className="py-6 font-black text-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{r.status}</span>
                          {onDelete && <button onClick={() => onDelete(r.id)} className="text-slate-300 hover:text-red-600 transition-colors p-1"><i className="fas fa-trash-alt text-[10px]"></i></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-4 gap-6">
          <div className="flex items-center space-x-5">
            <div className="bg-white w-16 h-16 rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden">
              <img src={APP_LOGO} alt="KPL Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-black">KPL Food Coop</h1>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{agentIdentity ? `${agentIdentity.name} - ${agentIdentity.cluster}` : 'Guest Hub'}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
            {agentIdentity ? (
              <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right w-full lg:w-auto shadow-sm flex items-center justify-end space-x-6">
                   <div className="text-right"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Security Sync</p><p className="text-[10px] font-bold text-black">{isSyncing ? 'Syncing...' : lastSyncTime?.toLocaleTimeString() || '...'}</p></div>
                   <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100"><i className="fas fa-power-off text-sm"></i></button>
              </div>
            ) : (
              <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-3">
                <i className="fas fa-user-shield"></i> Member Login
              </button>
            )}
            <div className="flex gap-4">
              <button onClick={() => setCurrentPortal('HOME')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'HOME' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black'}`}>Home</button>
              <button onClick={() => setCurrentPortal('ABOUT')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'ABOUT' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black'}`}>About</button>
              <button onClick={() => setCurrentPortal('CONTACT')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'CONTACT' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black'}`}>Contact</button>
            </div>
          </div>
        </div>
        <nav className="container mx-auto px-6 flex flex-wrap gap-3 mt-4 relative z-10">
          {availablePortals.filter(p => !['HOME', 'ABOUT', 'CONTACT', 'NEWS', 'LOGIN'].includes(p)).map(p => (
            <button key={p} type="button" onClick={() => setCurrentPortal(p)} className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black'}`}>{p}</button>
          ))}
        </nav>
      </header>

      <main className="container mx-auto px-6 -mt-8 relative z-20 space-y-12">
        {currentPortal === 'LOGIN' && !agentIdentity && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center py-20">
            <div className="w-full max-w-[450px] bg-white border border-slate-200 rounded-[3rem] shadow-2xl p-12 space-y-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
                  <i className={`fas ${isRegisterMode ? 'fa-user-plus' : 'fa-lock'} text-2xl`}></i>
                </div>
                <h2 className="text-2xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Create Account' : 'Welcome Back'}</h2>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{isRegisterMode ? 'Join the cooperative network' : 'Secure access to market hub'}</p>
              </div>

              <form onSubmit={handleAuth} className="space-y-4">
                {isRegisterMode && (
                  <div className="space-y-1">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Full Name</label>
                    <input type="text" placeholder="..." required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-black transition-all" />
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Phone Number</label>
                  <input type="tel" placeholder="07..." required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-black transition-all" />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">4-Digit Passcode</label>
                  <input type="password" placeholder="****" required maxLength={4} value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black text-center text-xl tracking-[0.5em] outline-none focus:bg-white focus:border-black transition-all" />
                </div>

                {isRegisterMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Member Role</label>
                      <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none">
                        {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                    {![SystemRole.SYSTEM_DEVELOPER, SystemRole.FINANCE_OFFICER, SystemRole.AUDITOR, SystemRole.MANAGER].includes(authForm.role) && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 ml-4">Cluster</label>
                        <select required value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none">
                          <option value="" disabled>Select...</option>
                          {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <button disabled={isAuthLoading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 mt-6">
                  {isAuthLoading ? <i className="fas fa-spinner fa-spin mr-2"></i> : (isRegisterMode ? 'Complete Registration' : 'Secure Login')}
                </button>
              </form>

              <div className="pt-6 border-t border-slate-50 text-center">
                <button onClick={() => { setIsRegisterMode(!isRegisterMode); }} className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-black transition-colors">
                  {isRegisterMode ? 'Already have an account? Login' : "Don't have an account? Create one"}
                </button>
              </div>
            </div>
          </div>
        )}

        {currentPortal === 'HOME' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 space-y-6">
                <h2 className="text-4xl font-black uppercase tracking-tight text-black leading-tight">Empowering Rural Trade</h2>
                <p className="text-slate-600 font-medium leading-relaxed">
                  Join the most efficient agricultural cooperative platform in the region. Connect with fresh produce, manage sales, and leverage AI insights for growth.
                </p>
                <div className="flex gap-4">
                  {!agentIdentity ? (
                    <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all">Get Started</button>
                  ) : (
                    <button onClick={() => setCurrentPortal('MARKET')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all">Go to Market</button>
                  )}
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-8 rounded-3xl border border-green-100 text-center">
                  <p className="text-3xl font-black text-green-600">{users.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Members</p>
                </div>
                <div className="bg-red-50 p-8 rounded-3xl border border-red-100 text-center">
                  <p className="text-3xl font-black text-red-600">{records.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Trades</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentPortal === 'MARKET' && agentIdentity && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <button type="button" onClick={() => setMarketView('CUSTOMER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === 'CUSTOMER' ? 'bg-black text-white' : 'bg-slate-50 text-slate-400'}`}>Customer Hub</button>
                <button type="button" onClick={() => setMarketView('SUPPLIER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === 'SUPPLIER' ? 'bg-black text-white' : 'bg-slate-50 text-slate-400'}`}>Supplier Hub</button>
                <button type="button" onClick={() => setMarketView('SALES')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === 'SALES' ? 'bg-black text-white' : 'bg-slate-50 text-slate-400'}`}>Sales Records</button>
            </div>
            
            {marketView === 'CUSTOMER' && renderCustomerPortal()}
            
            {marketView === 'SUPPLIER' && (
              <div className="space-y-12">
                <ProduceForm userRole={agentIdentity.role} defaultSupplierName={agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.name : undefined} defaultSupplierPhone={agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.phone : undefined} onSubmit={() => {}} />
              </div>
            )}

            {marketView === 'SALES' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard label="Pending" icon="fa-clock" value={`KSh ${stats.dueComm.toLocaleString()}`} color="bg-white" accent="text-red-600" />
                  <StatCard label="Verified" icon="fa-check-circle" value={`KSh ${stats.approvedComm.toLocaleString()}`} color="bg-white" accent="text-green-600" />
                </div>
                <AuditLogTable data={filteredRecords} title="Recent Activity" />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
