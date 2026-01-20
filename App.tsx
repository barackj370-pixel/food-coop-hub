
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity, AccountStatus } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL } from './constants.ts';
import { 
  syncToGoogleSheets, 
  fetchFromGoogleSheets, 
  syncUserToCloud, 
  fetchUsersFromCloud, 
  clearAllRecordsOnCloud, 
  clearAllUsersOnCloud, 
  deleteRecordFromCloud, 
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

// Helper to parse "YYYY-MM-DD" as a local date to avoid timezone shifts
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

  const handleLogout = () => {
    setAgentIdentity(null);
    setRecords([]); 
    setUsers([]);
    persistence.remove('agent_session');
    persistence.remove('food_coop_data');
    persistence.remove('coop_users');
  };

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
        // FIX: Merge local records with cloud records so new entries don't disappear before cloud update
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

  const groupedAndSortedRecords = useMemo(() => {
    const grouped = auditLogRecords.reduce((acc, r) => {
      const cluster = r.cluster || 'Unknown';
      if (!acc[cluster]) acc[cluster] = [];
      acc[cluster].push(r);
      return acc;
    }, {} as Record<string, SaleRecord[]>);
    Object.keys(grouped).forEach(cluster => grouped[cluster].sort((a, b) => (a.agentName || '').localeCompare(b.agentName || '')));
    return grouped;
  }, [auditLogRecords]);

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

    return { clusterPerformance, topAgents };
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
      if (success) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
      }
    } catch (e) {
      console.error("Sync error:", e);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const updated = { ...record, status: newStatus };
    setRecords(prev => prev.map(r => r.id === id ? updated : r));
    await syncToGoogleSheets(updated);
  };

  // Fix: Added handleExportCsv function to resolve missing name error
  const handleExportCsv = () => {
    if (filteredRecords.length === 0) {
      alert("No records to export.");
      return;
    }
    const headers = ["ID", "Date", "Commodity", "Farmer", "Farmer Phone", "Customer", "Customer Phone", "Units", "Unit Type", "Price", "Total", "Commission", "Status", "Agent", "Cluster"];
    const rows = filteredRecords.map(r => [
      r.id, r.date, r.cropType, r.farmerName, r.farmerPhone, r.customerName, r.customerPhone, r.unitsSold, r.unitType, r.unitPrice, r.totalSale, r.coopProfit, r.status, r.agentName, r.cluster
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `coop_audit_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          status: 'ACTIVE' 
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
        } else {
          alert("Authentication failed.");
        }
      }
    } catch (err) {
      alert("System Auth Error.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-[#022c22] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl mb-4 border border-emerald-500/30"><i className="fas fa-leaf text-xl"></i></div>
           <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Food Coop Hub</h1>
           <p className="text-emerald-400/60 text-[9px] font-black uppercase tracking-[0.4em] mt-2 italic">Digital Reporting Platform</p>
        </div>
        <div className="w-full max-w-[340px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in z-10 p-8 space-y-5">
            <div className="flex justify-between items-end">
              <div><h2 className="text-xl font-black text-white uppercase tracking-tight">{isRegisterMode ? 'New Account' : 'Secure Login'}</h2><p className="text-[9px] text-emerald-400/80 font-black uppercase tracking-widest mt-1">Identity Required</p></div>
              <button onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthForm({...authForm, name: '', phone: '', passcode: '', cluster: CLUSTERS[0]})}} className="text-[9px] font-black uppercase text-white/40 hover:text-emerald-400">{isRegisterMode ? 'Login Instead' : 'Register Account'}</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none" />}
              <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none" />
              <input type="password" maxLength={4} placeholder="enter 4 digit pincode" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value.replace(/\D/g, '')})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white text-center outline-none" />
              {isRegisterMode && (
                <>
                  <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none appearance-none">
                    <option value={SystemRole.FIELD_AGENT} className="bg-slate-900">Field Agent</option>
                    <option value={SystemRole.FINANCE_OFFICER} className="bg-slate-900">Finance Officer</option>
                    <option value={SystemRole.AUDITOR} className="bg-slate-900">Audit Officer</option>
                    <option value={SystemRole.MANAGER} className="bg-slate-900">Director</option>
                    <option value={SystemRole.SYSTEM_DEVELOPER} className="bg-slate-900">System Developer</option>
                  </select>
                  {authForm.role === SystemRole.FIELD_AGENT && (
                    <select value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none appearance-none">
                      {CLUSTERS.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
                    </select>
                  )}
                </>
              )}
              <button disabled={isAuthLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl">{isAuthLoading ? <i className="fas fa-spinner fa-spin"></i> : (isRegisterMode ? 'Create Account' : 'Authenticate')}</button>
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
            <div className="flex items-center justify-end space-x-2">
              {isSyncing && <i className="fas fa-sync fa-spin text-emerald-400 text-[10px]"></i>}
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-emerald-300/60">
                Last Sync: {lastSyncTime ? lastSyncTime.toLocaleTimeString() : 'Initializing...'}
              </p>
            </div>
            <p className="text-[8px] font-black uppercase tracking-[0.4em] text-emerald-300/60 mt-1">User: {agentIdentity.name}</p>
            <button onClick={handleLogout} className="text-[8px] font-black uppercase tracking-[0.4em] text-red-400 hover:text-red-300 transition-colors mt-2">Logout Session</button>
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
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl overflow-x-auto">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-8">Recent Submissions ({filteredRecords.length})</h3>
               <table className="w-full text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                    <tr>
                      <th className="pb-6">Date</th>
                      <th className="pb-6">Commodity</th>
                      <th className="pb-6">Farmer</th>
                      <th className="pb-6">Gross Sale</th>
                      <th className="pb-6">Profit (10%)</th>
                      <th className="pb-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredRecords.slice(0, 10).map(r => (
                      <tr key={r.id} className="text-[12px] font-bold group hover:bg-slate-50/50">
                        <td className="py-6 text-slate-400">{r.date}</td>
                        <td className="py-6 text-slate-900">{r.cropType}</td>
                        <td className="py-6 text-slate-700">{r.farmerName}</td>
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
          </>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center bg-white p-8 rounded-[2rem] border border-slate-100 shadow-xl">
              <div>
                <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Audit & Integrity Log</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mt-1">Real-time Verification Ledger</p>
              </div>
              <div className="flex gap-4">
                <select value={logFilterDays} onChange={e => setLogFilterDays(Number(e.target.value))} className="bg-slate-50 border-none rounded-xl px-6 py-3 font-bold text-[11px] uppercase tracking-widest outline-none">
                  <option value={7}>Last 7 Days</option>
                  <option value={14}>Last 14 Days</option>
                  <option value={30}>Last 30 Days</option>
                  <option value={365}>Full History</option>
                </select>
                <button onClick={handleExportCsv} className="bg-emerald-900 text-white px-8 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl">Export Report</button>
              </div>
            </div>

            {/* Fix: Explicitly typed clusterRecords to SaleRecord[] to resolve 'unknown' property errors */}
            {Object.entries(groupedAndSortedRecords).map(([cluster, clusterRecords]: [string, SaleRecord[]]) => (
              <div key={cluster} className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
                <div className="flex justify-between items-end mb-8">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter border-l-4 border-emerald-500 pl-4">{cluster} Cluster</h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">{clusterRecords.length} Records Found</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="text-[9px] font-black text-slate-300 uppercase tracking-widest text-left">
                      <tr>
                        <th className="pb-4">Agent Identification</th>
                        <th className="pb-4">Transaction Details</th>
                        <th className="pb-4">Audit Signature</th>
                        <th className="pb-4">Financial Yield</th>
                        <th className="pb-4 text-right">Verification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {clusterRecords.map(r => (
                        <tr key={r.id} className="text-[11px] font-bold hover:bg-slate-50/50">
                          <td className="py-6">
                            <p className="text-slate-900 uppercase">{r.agentName}</p>
                            <p className="text-slate-400 text-[9px] mt-0.5">{r.id}</p>
                          </td>
                          <td className="py-6">
                            <p className="text-slate-900 uppercase">{r.cropType}</p>
                            <p className="text-slate-400 text-[9px] mt-0.5">{r.date} • {r.unitsSold} {r.unitType}</p>
                          </td>
                          <td className="py-6">
                             <div className="flex items-center space-x-2">
                                <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-md font-mono text-[9px]">{r.signature}</span>
                                <i className="fas fa-shield-alt text-emerald-200 text-[10px]"></i>
                             </div>
                          </td>
                          <td className="py-6">
                            <p className="text-slate-900 font-black">Gross: KSh {r.totalSale.toLocaleString()}</p>
                            <p className="text-emerald-600 font-black">Coop: KSh {r.coopProfit.toLocaleString()}</p>
                          </td>
                          <td className="py-6 text-right">
                             <div className="flex justify-end gap-2">
                                {r.status === RecordStatus.DRAFT && (
                                  <button onClick={() => handleUpdateStatus(r.id, RecordStatus.PAID)} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-lg text-[9px] uppercase tracking-widest font-black">Verify Pay</button>
                                )}
                                {r.status === RecordStatus.PAID && (
                                  <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VALIDATED)} className="bg-emerald-900 text-white px-4 py-2 rounded-lg text-[9px] uppercase tracking-widest font-black">Log Audit</button>
                                )}
                                {r.status === RecordStatus.VALIDATED && (
                                  <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VERIFIED)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg text-[9px] uppercase tracking-widest font-black">Final Seal</button>
                                )}
                                {r.status === RecordStatus.VERIFIED && (
                                  <span className="text-emerald-500 flex items-center gap-1.5"><i className="fas fa-check-double"></i> Authenticated</span>
                                )}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter mb-8">Cluster Contribution Rankings</h3>
               <div className="space-y-6">
                  {boardMetrics.clusterPerformance.map(([cluster, value]: any, idx) => (
                    <div key={cluster} className="space-y-2">
                      <div className="flex justify-between text-[11px] font-black uppercase tracking-wider">
                        <span className="text-slate-600">#{idx + 1} {cluster}</span>
                        <span className="text-emerald-600">KSh {value.toLocaleString()}</span>
                      </div>
                      <div className="h-3 bg-slate-50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-1000" 
                          style={{ width: `${(value / (boardMetrics.clusterPerformance[0]?.[1] || 1)) * 100}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
               </div>
            </div>
            <div className="bg-[#022c22] p-10 rounded-[2.5rem] shadow-2xl text-white">
               <h3 className="text-sm font-black text-emerald-400 uppercase tracking-tighter mb-8">Agent Performance Leaderboard</h3>
               <div className="space-y-8">
                  {boardMetrics.topAgents.map(([agent, value]: any, idx) => (
                    <div key={agent} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-[10px]">{idx + 1}</div>
                        <span className="font-black text-[11px] uppercase tracking-widest">{agent}</span>
                      </div>
                      <span className="font-black text-emerald-400">KSh {value.toLocaleString()}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {currentPortal === 'SYSTEM' && isSystemDev && (
          <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-xl">
             <div className="flex justify-between items-center mb-10">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">Identity Management Console</h3>
                <div className="flex gap-4">
                   <button onClick={() => clearAllUsersOnCloud()} className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border border-red-200">Reset Users</button>
                   <button onClick={() => clearAllRecordsOnCloud()} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest">Wipe Sales</button>
                </div>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full">
                  <thead className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-left">
                    <tr>
                      <th className="pb-6">User Name & Identifier</th>
                      <th className="pb-6">System Role</th>
                      <th className="pb-6">Cluster Node</th>
                      <th className="pb-6 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {users.map(u => (
                      <tr key={u.phone} className="text-[11px] font-bold group">
                        <td className="py-6">
                           <p className="text-slate-900 uppercase">{u.name}</p>
                           <p className="text-slate-400 font-mono text-[10px] mt-0.5">{u.phone}</p>
                        </td>
                        <td className="py-6"><span className="bg-slate-100 px-3 py-1 rounded-md text-slate-600 uppercase text-[9px] tracking-widest font-black">{u.role}</span></td>
                        <td className="py-6 text-slate-500 uppercase">{u.cluster}</td>
                        <td className="py-6 text-right">
                           <button onClick={() => deleteUserFromCloud(u.phone)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all mr-6"><i className="fas fa-trash-alt"></i></button>
                           <span className="bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full font-black text-[9px] tracking-widest uppercase">{u.status || 'ACTIVE'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
             </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
