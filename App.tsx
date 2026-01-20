
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity, AccountStatus } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, CROP_TYPES } from './constants.ts';
import { 
  syncToGoogleSheets, 
  fetchFromGoogleSheets, 
  syncUserToCloud, 
  fetchUsersFromCloud, 
  clearAllRecordsOnCloud, 
  clearAllUsersOnCloud, 
  deleteUserFromCloud 
} from './services/googleSheetsService.ts';

type PortalType = 'SALES' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM';

const CLUSTERS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana'];

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

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [users, setUsers] = useState<AgentIdentity[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('SALES');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [logFilterDays, setLogFilterDays] = useState(7);
  
  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: CLUSTERS[0]
  });

  const normalizePhone = (p: string) => {
    const clean = p.replace(/\D/g, '');
    return clean.length >= 9 ? clean.slice(-9) : clean;
  };

  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity?.name === 'Barack James';

  const availablePortals = useMemo<PortalType[]>(() => {
    if (!agentIdentity) return [];
    if (isSystemDev) return ['SALES', 'FINANCE', 'AUDIT', 'BOARD', 'SYSTEM'];
    const portals: PortalType[] = ['SALES'];
    if (agentIdentity.role === SystemRole.FINANCE_OFFICER) portals.push('FINANCE');
    else if (agentIdentity.role === SystemRole.AUDITOR) portals.push('AUDIT');
    else if (agentIdentity.role === SystemRole.MANAGER) portals.push('FINANCE', 'AUDIT', 'BOARD');
    return portals;
  }, [agentIdentity, isSystemDev]);

  const loadCloudData = useCallback(async () => {
    if (!agentIdentity) return;
    setIsSyncing(true);
    try {
      const [cloudUsers, cloudRecords] = await Promise.all([
        fetchUsersFromCloud(),
        fetchFromGoogleSheets()
      ]);
      
      if (cloudUsers) {
        setUsers(cloudUsers);
        persistence.set('coop_users', JSON.stringify(cloudUsers));
      }

      if (cloudRecords) {
        const validRecords = cloudRecords.filter(r => r.cluster && r.cluster !== 'Unassigned');
        setRecords(prev => {
          const cloudIds = new Set(validRecords.map(r => r.id));
          const localOnly = prev.filter(r => !cloudIds.has(r.id));
          return [...localOnly, ...validRecords];
        });
        persistence.set('food_coop_data', JSON.stringify(validRecords));
      }
      setLastSyncTime(new Date());
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [agentIdentity]);

  useEffect(() => {
    const savedUsers = persistence.get('coop_users');
    if (savedUsers) {
      try { setUsers(JSON.parse(savedUsers)); } catch (e) { }
    }
    if (agentIdentity) {
      loadCloudData();
    }
  }, [agentIdentity, loadCloudData]);

  useEffect(() => {
    if (!agentIdentity) return;
    const interval = setInterval(() => {
      loadCloudData();
    }, SYNC_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [agentIdentity, loadCloudData]);

  const filteredRecords = useMemo(() => {
    let base = records.filter(r => r.id && r.id.length >= 4 && r.date);
    base = base.filter(r => r.cluster && r.cluster !== 'Unassigned');

    if (!isSystemDev) {
      const isPriv = agentIdentity?.role === SystemRole.MANAGER || 
                     agentIdentity?.role === SystemRole.FINANCE_OFFICER ||
                     agentIdentity?.role === SystemRole.AUDITOR;
      if (!isPriv) {
        base = base.filter(r => normalizePhone(r.agentPhone || '') === normalizePhone(agentIdentity?.phone || ''));
      }
    }
    return base;
  }, [records, isSystemDev, agentIdentity]);

  const auditLogRecords = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = new Date(today);
    cutoff.setDate(today.getDate() - logFilterDays);

    return filteredRecords.filter(r => {
      const recordDate = parseLocalDate(r.date);
      recordDate.setHours(0, 0, 0, 0);
      return recordDate.getTime() >= cutoff.getTime();
    });
  }, [filteredRecords, logFilterDays]);

  const stats = useMemo(() => {
    const relevantRecords = filteredRecords;
    const verifiedComm = relevantRecords.filter(r => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingAuditComm = relevantRecords.filter(r => r.status === RecordStatus.VALIDATED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingFinanceComm = relevantRecords.filter(r => r.status === RecordStatus.PAID).reduce((a, b) => a + Number(b.coopProfit), 0);
    const dueComm = relevantRecords.filter(r => r.status === RecordStatus.DRAFT).reduce((a, b) => a + Number(b.coopProfit), 0);
    return { awaitingAuditComm, awaitingFinanceComm, approvedComm: verifiedComm, dueComm };
  }, [filteredRecords]);

  const boardMetrics = useMemo(() => {
    const rLog = filteredRecords;
    const clusterMap = rLog.reduce((acc: Record<string, number>, r) => {
      const cluster = r.cluster || 'Unknown';
      acc[cluster] = (acc[cluster] || 0) + Number(r.coopProfit);
      return acc;
    }, {});
    const clusterPerformance = Object.entries(clusterMap).sort((a: any, b: any) => b[1] - a[1]);

    const agentMap = rLog.reduce((acc: Record<string, number>, r) => {
      const agent = r.agentName || 'Unknown';
      acc[agent] = (acc[agent] || 0) + Number(r.coopProfit);
      return acc;
    }, {});
    const topAgents = Object.entries(agentMap).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5);

    const commodityMap = rLog.reduce((acc: Record<string, number>, r) => {
      acc[r.cropType] = (acc[r.cropType] || 0) + Number(r.unitsSold);
      return acc;
    }, {});
    const commodityTrends = Object.entries(commodityMap).sort((a: any, b: any) => b[1] - a[1]);

    return { clusterPerformance, topAgents, commodityTrends };
  }, [filteredRecords]);

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
    const coopProfit = totalSale * PROFIT_MARGIN;
    const signature = await computeHash({ ...data, id });
    const cluster = agentIdentity?.cluster || 'Unassigned';
    
    const newRecord: SaleRecord = {
      ...data,
      id,
      totalSale,
      coopProfit,
      status: RecordStatus.DRAFT,
      signature,
      createdAt: new Date().toISOString(),
      agentPhone: agentIdentity?.phone,
      agentName: agentIdentity?.name,
      cluster: cluster,
      synced: false
    };
    
    setRecords(prev => [newRecord, ...prev]);
    try {
      const success = await syncToGoogleSheets(newRecord);
      if (success) setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    } catch (e) { console.error("Sync error:", e); }
  };

  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const updated = { ...record, status: newStatus };
    setRecords(prev => prev.map(r => r.id === id ? updated : r));
    await syncToGoogleSheets(updated);
  };

  const handleToggleUserStatus = async (phone: string, currentStatus?: AccountStatus) => {
    const user = users.find(u => u.phone === phone);
    if (!user) return;
    const newStatus: AccountStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    const updatedUser = { ...user, status: newStatus };
    setUsers(prev => prev.map(u => u.phone === phone ? updatedUser : u));
    await syncUserToCloud(updatedUser);
  };

  const handleLogout = () => {
    setAgentIdentity(null);
    setRecords([]); 
    setUsers([]);
    persistence.remove('agent_session');
    persistence.remove('food_coop_data');
    persistence.remove('coop_users');
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const targetPhoneNormalized = normalizePhone(authForm.phone);
    const targetPasscode = authForm.passcode.replace(/\D/g, '');
    try {
      const latestCloudUsers = await fetchUsersFromCloud();
      let currentUsers: AgentIdentity[] = latestCloudUsers || users;
      if (isRegisterMode) {
        const newUser: AgentIdentity = { 
          name: authForm.name.trim(), 
          phone: authForm.phone.trim(), 
          passcode: targetPasscode, 
          role: authForm.role, 
          cluster: authForm.role === SystemRole.FIELD_AGENT ? authForm.cluster : 'System', 
          status: 'AWAITING_ACTIVATION' 
        };
        const updatedUsersList = [...currentUsers, newUser];
        setUsers(updatedUsersList);
        persistence.set('coop_users', JSON.stringify(updatedUsersList));
        await syncUserToCloud(newUser);
        setAgentIdentity(newUser);
        persistence.set('agent_session', JSON.stringify(newUser));
      } else {
        const user = currentUsers.find(u => normalizePhone(u.phone) === targetPhoneNormalized && String(u.passcode).replace(/\D/g, '') === targetPasscode);
        if (user) {
          setAgentIdentity(user);
          persistence.set('agent_session', JSON.stringify(user));
        } else { alert("Authentication failed."); }
      }
    } catch (err) { alert("System Auth Error."); } finally { setIsAuthLoading(false); }
  };

  const AuditLogTable = ({ data, title }: { data: SaleRecord[], title: string }) => (
    <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl overflow-x-auto">
      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-8">{title} ({data.length})</h3>
      <table className="w-full text-left">
        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
          <tr>
            <th className="pb-6">Date</th>
            <th className="pb-6">ID/Agent</th>
            <th className="pb-6">Commodity</th>
            <th className="pb-6">Gross Sale</th>
            <th className="pb-6">Commission</th>
            <th className="pb-6 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map(r => (
            <tr key={r.id} className="text-[11px] font-bold group hover:bg-slate-50/50">
              <td className="py-6 text-slate-400">{r.date}</td>
              <td className="py-6">
                <p className="text-slate-900">{r.id}</p>
                <p className="text-[9px] text-slate-400 uppercase">{r.agentName}</p>
              </td>
              <td className="py-6 text-slate-900 uppercase">{r.cropType}</td>
              <td className="py-6 font-black text-slate-900">KSh {r.totalSale.toLocaleString()}</td>
              <td className="py-6 font-black text-emerald-600">KSh {r.coopProfit.toLocaleString()}</td>
              <td className="py-6 text-right">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-[#022c22] flex flex-col items-center justify-center p-6 relative">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl mb-4 border border-emerald-500/30"><i className="fas fa-leaf text-xl"></i></div>
           <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Food Coop Hub</h1>
           <p className="text-emerald-400/60 text-[9px] font-black uppercase tracking-[0.4em] mt-2 italic">Professional Reporting</p>
        </div>
        <div className="w-full max-w-[340px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl p-8 space-y-5 z-10">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{isRegisterMode ? 'New Account' : 'Secure Login'}</h2>
              <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-[9px] font-black uppercase text-white/40 hover:text-emerald-400">{isRegisterMode ? 'Login Instead' : 'Register Account'}</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none" />}
              <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none" />
              <input type="password" maxLength={4} placeholder="4 digit pin" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value.replace(/\D/g, '')})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white text-center outline-none" />
              {isRegisterMode && (
                <>
                  <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none">
                    {Object.values(SystemRole).map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
                  </select>
                  {authForm.role === SystemRole.FIELD_AGENT && (
                    <select value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none">
                      {CLUSTERS.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                    </select>
                  )}
                </>
              )}
              <button disabled={isAuthLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl">{isAuthLoading ? <i className="fas fa-spinner fa-spin"></i> : (isRegisterMode ? 'Register' : 'Authenticate')}</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-[#022c22] text-white pt-10 pb-12 shadow-2xl relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-10 gap-6">
          <div className="flex items-center space-x-5">
            <div className="bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center border border-emerald-500/30"><i className="fas fa-leaf text-2xl text-emerald-400"></i></div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Food Coop Hub</h1>
              <p className="text-emerald-400/60 text-[8px] font-black uppercase tracking-[0.4em] mt-1.5 italic">Digital Reporting Platform</p>
              <p className="text-emerald-400/40 text-[10px] font-black uppercase tracking-[0.3em] mt-1">{agentIdentity.role} {isSystemDev ? '(System Developer)' : `(${agentIdentity.cluster})`}</p>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/10 text-right w-full lg:w-auto shadow-2xl">
            <div className="flex items-center justify-end space-x-4">
               {isSyncing && <i className="fas fa-sync fa-spin text-emerald-400 text-[10px]"></i>}
               <p className="text-[8px] font-black uppercase tracking-[0.4em] text-emerald-300/60">Last Sync: {lastSyncTime?.toLocaleTimeString() || '...'}</p>
               <button onClick={handleLogout} className="text-[8px] font-black uppercase tracking-[0.4em] text-red-400 hover:text-red-300 transition-colors">Logout</button>
            </div>
          </div>
        </div>

        <nav className="container mx-auto px-6 flex flex-wrap gap-4 mt-8 relative z-10">
          {availablePortals.map(p => (
            <button 
              key={p} 
              onClick={() => setCurrentPortal(p)}
              className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? 'bg-emerald-500 text-emerald-950 border-emerald-400 shadow-xl shadow-emerald-500/20 scale-105' : 'bg-white/5 text-emerald-100/40 border-white/5 hover:bg-white/10'}`}
            >
              {p}
            </button>
          ))}
        </nav>
      </header>

      <main className="container mx-auto px-6 -mt-8 relative z-20 space-y-12">
        {currentPortal === 'SALES' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <StatCard label="Pending Payment" icon="fa-clock" value={`KSh ${stats.dueComm.toLocaleString()}`} color="bg-[#022c22]" />
              <StatCard label="Processing" icon="fa-spinner" value={`KSh ${stats.awaitingFinanceComm.toLocaleString()}`} color="bg-[#022c22]" />
              <StatCard label="Awaiting Audit" icon="fa-clipboard-check" value={`KSh ${stats.awaitingAuditComm.toLocaleString()}`} color="bg-[#022c22]" />
              <StatCard label="Verified Profit" icon="fa-check-circle" value={`KSh ${stats.approvedComm.toLocaleString()}`} color="bg-emerald-600" />
            </div>
            <SaleForm onSubmit={handleAddRecord} />
            <AuditLogTable data={filteredRecords.slice(0, 10)} title="Recent Submissions" />
          </>
        )}

        {currentPortal === 'FINANCE' && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-8 border-l-4 border-emerald-500 pl-4">Transactions Waiting Confirmation</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                      <tr><th className="pb-4">Date</th><th className="pb-4">ID/Agent</th><th className="pb-4">Commodity</th><th className="pb-4">Gross</th><th className="pb-4">Comm</th><th className="pb-4 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRecords.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-6 font-bold">{r.date}</td>
                          <td className="py-6">
                            <p className="font-black">{r.id}</p>
                            <p className="text-[9px] text-slate-400 uppercase">{r.agentName}</p>
                          </td>
                          <td className="py-6 uppercase font-bold">{r.cropType}</td>
                          <td className="py-6 font-black">KSh {r.totalSale.toLocaleString()}</td>
                          <td className="py-6 font-black text-emerald-600">KSh {r.coopProfit.toLocaleString()}</td>
                          <td className="py-6 text-right">
                             <button onClick={() => handleUpdateStatus(r.id, RecordStatus.PAID)} className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700">Confirm Receipt</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            <AuditLogTable data={filteredRecords} title="Audit & Integrity Log" />
          </div>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-8 border-l-4 border-emerald-500 pl-4">Awaiting Verification & Audit</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                      <tr><th className="pb-4">Agent/Cluster</th><th className="pb-4">Details</th><th className="pb-4">Integrity Hash</th><th className="pb-4">Financials</th><th className="pb-4 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRecords.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-6">
                             <p className="font-black">{r.agentName}</p>
                             <p className="text-[9px] text-slate-400 uppercase">{r.cluster}</p>
                          </td>
                          <td className="py-6">
                             <p className="font-bold uppercase">{r.cropType}</p>
                             <p className="text-[9px] text-slate-400">{r.unitsSold} {r.unitType}</p>
                          </td>
                          <td className="py-6"><span className="bg-slate-50 px-2 py-1 rounded text-[9px] font-mono text-slate-500">{r.signature}</span></td>
                          <td className="py-6">
                            <p className="font-black">Gross: KSh {r.totalSale.toLocaleString()}</p>
                            <p className="text-emerald-600 font-black">Comm: KSh {r.coopProfit.toLocaleString()}</p>
                          </td>
                          <td className="py-6 text-right">
                             {r.status === RecordStatus.PAID ? (
                               <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VALIDATED)} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Audit Approval</button>
                             ) : (
                               <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VERIFIED)} className="bg-emerald-900 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Final Seal</button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            <AuditLogTable data={filteredRecords} title="Audit & Integrity Log" />
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="space-y-12">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
                 <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-8">Commodity Yield Analysis</h3>
                 <div className="space-y-6">
                    {boardMetrics.commodityTrends.slice(0, 6).map(([crop, value]: any) => (
                      <div key={crop} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-wider text-slate-600">
                          <span>{crop}</span>
                          <span>{value.toLocaleString()} Units</span>
                        </div>
                        <div className="h-2 bg-slate-50 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${(value / (boardMetrics.commodityTrends[0]?.[1] || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="bg-[#022c22] p-10 rounded-[2.5rem] shadow-2xl text-white">
                 <h3 className="text-sm font-black text-emerald-400 uppercase tracking-tighter mb-8">Market Trend Insights</h3>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                       <p className="text-[9px] font-black text-emerald-400/40 uppercase tracking-widest mb-2">Top Cluster</p>
                       <p className="text-lg font-black">{boardMetrics.clusterPerformance[0]?.[0] || 'N/A'}</p>
                    </div>
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10">
                       <p className="text-[9px] font-black text-emerald-400/40 uppercase tracking-widest mb-2">Total Yield</p>
                       <p className="text-lg font-black">KSh {stats.approvedComm.toLocaleString()}</p>
                    </div>
                 </div>
                 <div className="mt-8 space-y-4">
                    {boardMetrics.clusterPerformance.map(([cluster, value]: any, idx) => (
                      <div key={cluster} className="flex justify-between items-center text-[11px] font-black uppercase text-emerald-100/60">
                         <span>{idx + 1}. {cluster}</span>
                         <span className="text-emerald-400">KSh {value.toLocaleString()}</span>
                      </div>
                    ))}
                 </div>
              </div>
            </div>
            <AuditLogTable data={filteredRecords} title="Audit & Integrity Log" />
          </div>
        )}

        {currentPortal === 'SYSTEM' && isSystemDev && (
          <div className="space-y-12">
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Infrastructure & Identity Console</h3>
                  <div className="flex gap-4">
                     <button onClick={() => clearAllUsersOnCloud()} className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-red-200">Reset System</button>
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="text-[10px] font-black text-slate-300 uppercase tracking-widest border-b pb-4">
                      <tr><th className="pb-4">User Details</th><th className="pb-4">Role/Cluster</th><th className="pb-4">Verification</th><th className="pb-4 text-right">Portal Auth</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map(u => (
                        <tr key={u.phone} className="group hover:bg-slate-50/50">
                          <td className="py-6">
                             <p className="text-sm font-black uppercase text-slate-800">{u.name}</p>
                             <p className="text-[10px] text-slate-400 font-mono">{u.phone}</p>
                          </td>
                          <td className="py-6">
                             <p className="text-[11px] font-black text-slate-600 uppercase">{u.role}</p>
                             <p className="text-[9px] text-slate-400 uppercase">{u.cluster}</p>
                          </td>
                          <td className="py-6">
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                               {u.status || 'PENDING'}
                             </span>
                          </td>
                          <td className="py-6 text-right">
                             {u.status === 'AWAITING_ACTIVATION' || u.status === 'SUSPENDED' ? (
                               <button onClick={() => handleToggleUserStatus(u.phone)} className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Activate Agent</button>
                             ) : (
                               <button onClick={() => handleToggleUserStatus(u.phone, 'ACTIVE')} className="bg-red-100 text-red-600 px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest">Suspend Access</button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Summary Trade Report</h4>
                  <div className="space-y-4">
                     <div className="flex justify-between border-b border-slate-50 pb-2 text-[11px] font-bold">
                        <span className="text-slate-500">Total Registered Agents</span>
                        <span>{users.length}</span>
                     </div>
                     <div className="flex justify-between border-b border-slate-50 pb-2 text-[11px] font-bold">
                        <span className="text-slate-500">Active Field Units</span>
                        <span>{users.filter(u => u.status === 'ACTIVE').length}</span>
                     </div>
                     <div className="flex justify-between border-b border-slate-50 pb-2 text-[11px] font-bold">
                        <span className="text-slate-500">Verified Marketplace Profits</span>
                        <span className="text-emerald-600 font-black">KSh {stats.approvedComm.toLocaleString()}</span>
                     </div>
                  </div>
               </div>
               <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6">Agent Performance Leaderboard</h4>
                  <div className="space-y-4">
                     {boardMetrics.topAgents.map(([agent, value]: any, idx) => (
                        <div key={agent} className="flex justify-between items-center">
                           <span className="text-[11px] font-black uppercase text-slate-600">{idx + 1}. {agent}</span>
                           <span className="text-emerald-600 font-black text-[11px]">KSh {value.toLocaleString()}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            <AuditLogTable data={filteredRecords} title="Audit & Integrity Log" />
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
