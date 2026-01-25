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
  const [marketView, setMarketView] = useState<MarketView>('SALES');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncLock = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);

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
      const [cloudUsers, cloudRecords, cloudProduce] = await Promise.all([
        fetchUsersFromCloud(),
        fetchFromGoogleSheets(),
        fetchProduceFromCloud()
      ]);
      
      if (cloudUsers && cloudUsers.length > 0) {
        setUsers(prev => {
          const userMap = new Map<string, AgentIdentity>();
          cloudUsers.forEach(u => { userMap.set(normalizePhone(u.phone), u); });
          prev.forEach(u => {
            const key = normalizePhone(u.phone);
            if (!userMap.has(key)) userMap.set(key, u);
          });
          const combined = Array.from(userMap.values());
          persistence.set('coop_users', JSON.stringify(combined));
          return combined;
        });
      }

      if (cloudRecords !== null) {
        setRecords(prev => {
          const cloudIds = new Set(cloudRecords.map(r => r.id));
          const localOnly = prev.filter(r => r.id && !cloudIds.has(r.id));
          const combined = [...localOnly, ...cloudRecords];
          persistence.set('food_coop_data', JSON.stringify(combined));
          return combined;
        });
      }

      if (cloudProduce !== null) {
        setProduceListings(prev => {
          const blacklist = new Set(deletedProduceIds);
          const filteredCloud = cloudProduce.filter(cp => !blacklist.has(cp.id));
          const combined = [...filteredCloud];
          persistence.set('food_coop_produce', JSON.stringify(combined));
          return combined;
        });
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
      const isPrivileged = isSystemDev || 
                           agentIdentity.role === SystemRole.MANAGER || 
                           agentIdentity.role === SystemRole.FINANCE_OFFICER ||
                           agentIdentity.role === SystemRole.AUDITOR;
      if (!isPrivileged) {
        base = base.filter(r => normalizePhone(r.agentPhone || '') === normalizePhone(agentIdentity.phone || ''));
      }
    }
    return base;
  }, [records, isSystemDev, agentIdentity]);

  const stats = useMemo(() => {
    const relevantRecords = filteredRecords;
    const verifiedComm = relevantRecords.filter(r => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingAuditComm = relevantRecords.filter(r => r.status === RecordStatus.VALIDATED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingFinanceComm = relevantRecords.filter(r => r.status === RecordStatus.PAID).reduce((a, b) => a + Number(b.coopProfit), 0);
    const dueComm = relevantRecords.filter(r => r.status === RecordStatus.DRAFT).reduce((a, b) => a + Number(b.coopProfit), 0);
    return { awaitingAuditComm, awaitingFinanceComm, approvedComm: verifiedComm, dueComm };
  }, [filteredRecords]);

  const handleAddProduce = async (data: any) => {
    const clusterValue = agentIdentity?.cluster && agentIdentity.cluster !== '-' ? agentIdentity.cluster : 'Mariwa';
    const newListing: ProduceListing = {
      id: 'LST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: data.date,
      cropType: data.cropType,
      unitsAvailable: data.unitsAvailable,
      unitType: data.unitType,
      sellingPrice: data.sellingPrice,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      cluster: clusterValue,
      status: 'AVAILABLE'
    };
    setProduceListings(prev => {
        const updated = [newListing, ...prev];
        persistence.set('food_coop_produce', JSON.stringify(updated));
        return updated;
    });
    try { await syncProduceToCloud(newListing); } catch (err) { console.error("Produce sync failed:", err); }
  };

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
    const coopProfit = totalSale * PROFIT_MARGIN;
    const signature = await computeHash({ ...data, id });
    const cluster = data.cluster || agentIdentity?.cluster || 'Unassigned';
    const newRecord: SaleRecord = {
      ...data, id, totalSale, coopProfit, status: RecordStatus.DRAFT, signature,
      createdAt: new Date().toISOString(), agentPhone: agentIdentity?.phone, agentName: agentIdentity?.name, cluster, synced: false
    };
    setRecords(prev => {
        const updated = [newRecord, ...prev];
        persistence.set('food_coop_data', JSON.stringify(updated));
        return updated;
    });
    try {
      const success = await syncToGoogleSheets(newRecord);
      if (success) setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    } catch (e) { }
  };

  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const updated = { ...record, status: newStatus };
    setRecords(prev => {
        const updatedList = prev.map(r => r.id === id ? updated : r);
        persistence.set('food_coop_data', JSON.stringify(updatedList));
        return updatedList;
    });
    await syncToGoogleSheets(updated);
  };

  const handleLogout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
    setCurrentPortal('HOME');
  };

  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: ''
  });

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const targetPhoneNormalized = normalizePhone(authForm.phone);
    const targetPasscode = normalizePasscode(authForm.passcode);
    try {
      const latestCloudUsers = await fetchUsersFromCloud();
      if (latestCloudUsers) setUsers(latestCloudUsers);
      const authPool = latestCloudUsers || users;
      
      if (isRegisterMode) {
        const newUser: AgentIdentity = { 
          name: authForm.name, phone: authForm.phone, passcode: targetPasscode, 
          role: authForm.role, cluster: authForm.cluster || 'Mariwa', status: 'ACTIVE' 
        };
        await syncUserToCloud(newUser);
        setAgentIdentity(newUser);
        persistence.set('agent_session', JSON.stringify(newUser));
        setCurrentPortal('HOME');
      } else {
        const matchedUser = authPool.find(u => normalizePhone(u.phone) === targetPhoneNormalized && normalizePasscode(u.passcode) === targetPasscode);
        if (matchedUser) { 
          setAgentIdentity(matchedUser); 
          persistence.set('agent_session', JSON.stringify(matchedUser)); 
          setCurrentPortal('HOME');
        } else alert("Authentication Failed.");
      }
    } catch (err) { alert("System Error."); } finally { setIsAuthLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 flex justify-between items-start mb-4">
          <div className="flex items-center space-x-5">
            <div className="bg-white w-16 h-16 rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden"><img src={APP_LOGO} alt="KPL Logo" className="w-10 h-10 object-contain" /></div>
            <h1 className="text-3xl font-black uppercase tracking-tight leading-none">KPL Food Coop Market</h1>
          </div>
          <div className="flex gap-4">
            {agentIdentity ? (
              <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100"><i className="fas fa-power-off"></i></button>
            ) : (
              <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl">Member Login</button>
            )}
          </div>
        </div>
        <nav className="container mx-auto px-6 flex gap-3 mt-4">
          <button onClick={() => setCurrentPortal('HOME')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest ${currentPortal === 'HOME' ? 'bg-black text-white' : 'bg-white text-slate-400 border border-slate-100'}`}>Home</button>
          {agentIdentity && (
            <div className="relative">
              <button onClick={() => { setCurrentPortal('MARKET'); setIsMarketMenuOpen(!isMarketMenuOpen); }} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 ${currentPortal === 'MARKET' ? 'bg-black text-white' : 'bg-white text-slate-400 border-slate-100'}`}>Market <i className="fas fa-chevron-down opacity-50"></i></button>
              {isMarketMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 z-50">
                  <button onClick={() => { setMarketView('SUPPLIER'); setIsMarketMenuOpen(false); }} className="w-full text-left px-6 py-3 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">Supplier Portal</button>
                  <button onClick={() => { setMarketView('SALES'); setIsMarketMenuOpen(false); }} className="w-full text-left px-6 py-3 text-[10px] font-black uppercase text-slate-500 hover:bg-slate-50">Sales Portal</button>
                </div>
              )}
            </div>
          )}
          {availablePortals.filter(p => !['HOME', 'MARKET', 'ABOUT', 'CONTACT', 'NEWS', 'LOGIN'].includes(p)).map(p => (
            <button key={p} onClick={() => setCurrentPortal(p)} className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border ${currentPortal === p ? 'bg-black text-white' : 'bg-white text-slate-400 border-slate-100'}`}>{p}</button>
          ))}
        </nav>
      </header>

      <main className="container mx-auto px-6 -mt-8 relative z-20 space-y-12">
        {currentPortal === 'LOGIN' && !agentIdentity && (
          <div className="flex flex-col items-center py-12 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6">
              <h2 className="text-2xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Register' : 'Login'}</h2>
              <form onSubmit={handleAuth} className="space-y-4">
                {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none" />}
                <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none" />
                <input type="password" placeholder="4-Digit Pin" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black text-center outline-none" />
                <button disabled={isAuthLoading} className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl">Authenticate</button>
              </form>
            </div>
          </div>
        )}

        {currentPortal === 'MARKET' && agentIdentity && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {marketView === 'SALES' ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><StatCard label="Pending" icon="fa-clock" value={`KSh ${stats.dueComm.toLocaleString()}`} color="bg-white" accent="text-red-600" /><StatCard label="Processing" icon="fa-spinner" value={`KSh ${stats.awaitingFinanceComm.toLocaleString()}`} color="bg-white" accent="text-black" /><StatCard label="Verified" icon="fa-check-circle" value={`KSh ${stats.approvedComm.toLocaleString()}`} color="bg-white" accent="text-green-600" /></div>
                <SaleForm clusters={CLUSTERS} produceListings={produceListings} onSubmit={handleAddRecord} />
              </>
            ) : (
              <div className="space-y-12">
                <ProduceForm userRole={agentIdentity.role} onSubmit={handleAddProduce} />
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
                  <h3 className="text-sm font-black text-black uppercase tracking-widest mb-8">Harvest Inventory</h3>
                  <div className="overflow-x-auto"><table className="w-full text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4"><tr><th>Supplier</th><th>Commodity</th><th>Price</th></tr></thead>
                    <tbody className="divide-y">{produceListings.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors"><td className="py-6 font-black uppercase text-xs">{p.supplierName}</td><td className="py-6 font-black text-green-600 text-xs uppercase">{p.cropType}</td><td className="py-6 font-black text-xs">KSh {p.sellingPrice.toLocaleString()}</td></tr>
                    ))}</tbody>
                  </table></div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentPortal === 'HOME' && (
          <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-4xl font-black uppercase tracking-tight text-black leading-tight mb-6">Welcome to the Market Hub</h2>
            <p className="text-slate-600 font-medium leading-relaxed max-w-xl">Efficiently manage sales, audit transactions, and connect local farmers to markets.</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;