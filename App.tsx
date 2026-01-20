
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

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>(() => {
    const saved = persistence.get('food_coop_data');
    return saved ? JSON.parse(saved) : [];
  });
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
  
  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: ''
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
        setRecords(prev => {
          const cloudIds = new Set(cloudRecords.map(r => r.id));
          const localOnly = prev.filter(r => !cloudIds.has(r.id));
          const combined = [...localOnly, ...cloudRecords];
          persistence.set('food_coop_data', JSON.stringify(combined));
          return combined;
        });
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
    let base = records.filter(r => r.id && r.date);
    if (!isSystemDev && agentIdentity) {
      const isPrivilegedRole = agentIdentity.role === SystemRole.MANAGER || 
                               agentIdentity.role === SystemRole.FINANCE_OFFICER ||
                               agentIdentity.role === SystemRole.AUDITOR;
      if (!isPrivilegedRole) {
        const myPhone = normalizePhone(agentIdentity.phone || '');
        base = base.filter(r => normalizePhone(r.agentPhone || '') === myPhone);
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
      await syncToGoogleSheets(newRecord);
    } catch (e) { console.error("Sync error:", e); }
  };

  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const updated = { ...record, status: newStatus };
    setRecords(prev => prev.map(r => r.id === id ? updated : r));
    await syncToGoogleSheets(updated);
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
        const user = currentUsers.find(u => normalizePhone(u.phone) === targetPhoneNormalized && String(u.passcode) === targetPasscode);
        if (user) {
          setAgentIdentity(user);
          persistence.set('agent_session', JSON.stringify(user));
        } else { alert("Authentication failed."); }
      }
    } catch (err) { alert("System Auth Error."); } finally { setIsAuthLoading(false); }
  };

  const handleLogout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
  };

  const boardMetrics = useMemo(() => {
    const rLog = filteredRecords;
    const clusterMap = rLog.reduce((acc: Record<string, { volume: number, profit: number }>, r) => {
      const cluster = r.cluster || 'Unknown';
      if (!acc[cluster]) acc[cluster] = { volume: 0, profit: 0 };
      acc[cluster].volume += Number(r.totalSale);
      acc[cluster].profit += Number(r.coopProfit);
      return acc;
    }, {} as Record<string, { volume: number, profit: number }>);
    const clusterPerformance = Object.entries(clusterMap).sort((a: any, b: any) => b[1].profit - a[1].profit);

    const commodityMap = rLog.reduce((acc: Record<string, number>, r) => {
      acc[r.cropType] = (acc[r.cropType] || 0) + Number(r.unitsSold);
      return acc;
    }, {} as Record<string, number>);
    const commodityTrends = Object.entries(commodityMap).sort((a: any, b: any) => b[1] - a[1]);

    return { clusterPerformance, commodityTrends };
  }, [filteredRecords]);

  const handleExportSummaryCsv = () => {
    if (boardMetrics.clusterPerformance.length === 0) {
      alert("No summary data to export.");
      return;
    }
    const headers = ["Food Coop Clusters", "Total Volume of Sales (Ksh)", "Total Gross Profit (Ksh)"];
    const rows = boardMetrics.clusterPerformance.map(([cluster, stats]: [string, any]) => [
      cluster, stats.volume, stats.profit
    ]);
    const totalVolume = boardMetrics.clusterPerformance.reduce((a: number, b: any) => a + (b[1] as any).volume, 0);
    const totalProfit = boardMetrics.clusterPerformance.reduce((a: number, b: any) => a + (b[1] as any).profit, 0);
    rows.push(["TOTAL SYSTEM OUTPUT", totalVolume, totalProfit]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `kpl_coop_summary_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const AuditLogTable = ({ data, title }: { data: SaleRecord[], title: string }) => (
    <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg overflow-x-auto">
      <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-black pl-4">{title}</h3>
      <table className="w-full text-left">
        <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
          <tr>
            <th className="pb-6">Date</th>
            <th className="pb-6">Commodity</th>
            <th className="pb-6">Participants</th>
            <th className="pb-6">Value</th>
            <th className="pb-6 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map(r => (
            <tr key={r.id} className="text-[11px] font-bold group hover:bg-slate-50/50">
              <td className="py-6 text-slate-400">{r.date}</td>
              <td className="py-6">
                 <p className="text-black font-black uppercase">{r.cropType}</p>
                 <p className="text-slate-400 text-[9px]">{r.unitsSold} {r.unitType}</p>
              </td>
              <td className="py-6">
                 <p className="text-black uppercase">S: {r.farmerName}</p>
                 <p className="text-slate-500 uppercase">A: {r.agentName}</p>
              </td>
              <td className="py-6 font-black text-black">
                 <p>KSh {Number(r.totalSale).toLocaleString()}</p>
                 <p className="text-green-600 text-[9px]">P: KSh {Number(r.coopProfit).toLocaleString()}</p>
              </td>
              <td className="py-6 text-right">
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
          {data.length === 0 && (
            <tr><td colSpan={5} className="py-12 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No records found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );

  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 text-green-500 rounded-3xl mb-4 border border-green-100"><i className="fas fa-leaf text-2xl"></i></div>
           <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Food Coop Market</h1>
           <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Linking Suppliers and Consumer</p>
        </div>
        <div className="w-full max-w-[360px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6 z-10">
            <div className="flex justify-between items-end mb-2">
              <h2 className="text-2xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Register' : 'Login'}</h2>
              <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-[10px] font-black uppercase text-red-600 hover:text-red-700">{isRegisterMode ? 'Back to Login' : 'Create Account'}</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none focus:border-green-400 focus:bg-white transition-all" />}
              <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none focus:border-green-400 focus:bg-white transition-all" />
              <input type="password" placeholder="4-Digit PIN" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black text-center outline-none focus:border-green-400 focus:bg-white transition-all" />
              {isRegisterMode && (
                <>
                  <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none appearance-none">
                    {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {authForm.role === SystemRole.FIELD_AGENT && (
                    <select required value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none appearance-none">
                      <option value="">Select Cluster</option>
                      {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </>
              )}
              <button disabled={isAuthLoading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all">{isAuthLoading ? <i className="fas fa-spinner fa-spin"></i> : (isRegisterMode ? 'Register' : 'Authenticate')}</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white border-b border-slate-100 pt-10 pb-8 sticky top-0 z-50">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-4">
             <div className="bg-black w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl"><i className="fas fa-leaf"></i></div>
             <div>
                <h1 className="text-xl font-black tracking-tight uppercase">Food Coop Hub</h1>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{agentIdentity.name} &bull; {agentIdentity.cluster} &bull; {agentIdentity.role}</p>
             </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-3">
            {availablePortals.map(p => (
              <button 
                key={p} 
                onClick={() => setCurrentPortal(p)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${currentPortal === p ? 'bg-black text-white shadow-xl' : 'bg-slate-50 text-slate-400 hover:text-black'}`}
              >
                {p}
              </button>
            ))}
            <button onClick={handleLogout} className="px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all">Sign Out</button>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 mt-12 space-y-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard label="Awaiting Audit" value={`KSh ${stats.awaitingAuditComm.toLocaleString()}`} icon="fa-clock" color="bg-white" accent="text-amber-500" />
          <StatCard label="Finance Queue" value={`KSh ${stats.awaitingFinanceComm.toLocaleString()}`} icon="fa-money-bill-transfer" color="bg-white" accent="text-blue-600" />
          <StatCard label="Verified Profit" value={`KSh ${stats.approvedComm.toLocaleString()}`} icon="fa-check-circle" color="bg-white" accent="text-emerald-500" />
          <StatCard label="Local Drafts" value={`KSh ${stats.dueComm.toLocaleString()}`} icon="fa-file-signature" color="bg-white" accent="text-slate-400" />
        </div>

        {currentPortal === 'SALES' && (
          <div className="space-y-12">
            <SaleForm onSubmit={handleAddRecord} />
            <AuditLogTable data={filteredRecords.slice(0, 10)} title="Integrity Operations Log" />
          </div>
        )}

        {currentPortal === 'FINANCE' && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-x-auto">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-blue-600 pl-4">Pending Payments</h3>
               <table className="w-full text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                    <tr><th className="pb-4">Date</th><th className="pb-4">Details</th><th className="pb-4">Stakeholders</th><th className="pb-4">Amount</th><th className="pb-4 text-right">Action</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRecords.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-6 text-[11px] font-bold text-slate-400">{r.date}</td>
                        <td className="py-6"><p className="text-xs font-black uppercase text-black">{r.cropType}</p></td>
                        <td className="py-6 text-[10px] font-bold uppercase text-slate-500"><p>Supplier: {r.farmerName}</p><p>Agent: {r.agentName}</p></td>
                        <td className="py-6 font-black text-black text-xs">KSh {r.totalSale.toLocaleString()}</td>
                        <td className="py-6 text-right"><button onClick={() => handleUpdateStatus(r.id, RecordStatus.PAID)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-700">Receive Cash</button></td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
            <AuditLogTable data={filteredRecords} title="Financial Audit History" />
          </div>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-8">
             <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-x-auto">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-amber-500 pl-4">Audit Approval Queue</h3>
               <table className="w-full text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                    <tr><th className="pb-4">Details</th><th className="pb-4">Financials</th><th className="pb-4 text-right">Verification</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRecords.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-6">
                           <p className="text-xs font-black uppercase text-black">{r.cropType}</p>
                           <p className="text-[9px] font-bold text-slate-400">Agent: {r.agentName} ({r.cluster})</p>
                        </td>
                        <td className="py-6 font-black text-black text-xs">
                          <p>KSh {r.totalSale.toLocaleString()}</p>
                          <p className="text-emerald-600">Comm: KSh {r.coopProfit.toLocaleString()}</p>
                        </td>
                        <td className="py-6 text-right">
                           {r.status === RecordStatus.PAID ? (
                             <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VALIDATED)} className="bg-black text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Validate</button>
                           ) : (
                             <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VERIFIED)} className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest">Final Approval</button>
                           )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
            <AuditLogTable data={filteredRecords} title="Security Compliance Audit" />
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="space-y-12">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
               <div className="flex justify-between items-center mb-10">
                  <h3 className="text-sm font-black text-black uppercase tracking-tighter border-l-4 border-emerald-500 pl-4">Cooperative Performance Summary</h3>
                  <button onClick={handleExportSummaryCsv} className="bg-black text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-900 transition-all"><i className="fas fa-download mr-2"></i> Export CSV Report</button>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-6">
                      <tr><th className="pb-6">Coop Cluster</th><th className="pb-6">Total Volume</th><th className="pb-6">Net Commission</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {boardMetrics.clusterPerformance.map(([cluster, stats]: any) => (
                        <tr key={cluster} className="hover:bg-slate-50/50">
                          <td className="py-6 font-black text-black uppercase text-xs">{cluster}</td>
                          <td className="py-6 font-black text-slate-900 text-xs">KSh {stats.volume.toLocaleString()}</td>
                          <td className="py-6 font-black text-emerald-600 text-xs">KSh {stats.profit.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            <AuditLogTable data={filteredRecords} title="Universal Performance Audit" />
          </div>
        )}

        {currentPortal === 'SYSTEM' && isSystemDev && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-x-auto">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">System Identity Node Control</h3>
               <table className="w-full text-left">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                    <tr><th className="pb-4">Name</th><th className="pb-4">Node / Role</th><th className="pb-4">Status</th><th className="pb-4 text-right">Control</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {users.map(u => (
                      <tr key={u.phone}>
                        <td className="py-6"><p className="text-xs font-black uppercase text-black">{u.name}</p><p className="text-[9px] text-slate-400">{u.phone}</p></td>
                        <td className="py-6"><p className="text-[10px] font-black text-black uppercase">{u.role}</p><p className="text-[8px] text-slate-400 uppercase">{u.cluster}</p></td>
                        <td className="py-6"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{u.status || 'ACTIVE'}</span></td>
                        <td className="py-6 text-right"><button onClick={() => deleteUserFromCloud(u.phone).then(loadCloudData)} className="text-red-600 hover:text-red-800"><i className="fas fa-trash-alt"></i></button></td>
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
