import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity, AccountStatus } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, GOOGLE_SHEET_VIEW_URL } from './constants.ts';
import { 
  syncToGoogleSheets, 
  fetchFromGoogleSheets, 
  syncUserToCloud, 
  fetchUsersFromCloud, 
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
    
    if (agentIdentity) {
      // FIX: Ensure privileged roles (including System Dev) see EVERYTHING across all clusters
      const isPrivileged = isSystemDev || 
                           agentIdentity.role === SystemRole.MANAGER || 
                           agentIdentity.role === SystemRole.FINANCE_OFFICER ||
                           agentIdentity.role === SystemRole.AUDITOR;
      
      if (!isPrivileged) {
        // Only Field Agents are restricted to their own entries
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

  const boardMetrics = useMemo(() => {
    const rLog = filteredRecords;
    const clusterMap = rLog.reduce((acc: Record<string, { volume: number, profit: number }>, r) => {
      const cluster = r.cluster || 'Unknown';
      if (!acc[cluster]) acc[cluster] = { volume: 0, profit: 0 };
      acc[cluster].volume += Number(r.totalSale);
      acc[cluster].profit += Number(r.coopProfit);
      return acc;
    }, {} as Record<string, { volume: number, profit: number }>);
    const clusterPerformance = Object.entries(clusterMap).sort((a: any, b: any) => b[1].profit - a[1].profit) as [string, { volume: number, profit: number }][];

    const commodityMap = rLog.reduce((acc: Record<string, number>, r) => {
      acc[r.cropType] = (acc[r.cropType] || 0) + Number(r.unitsSold);
      return acc;
    }, {} as Record<string, number>);
    const commodityTrends = Object.entries(commodityMap).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];

    return { clusterPerformance, commodityTrends };
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
    
    setRecords(prev => {
        const updated = [newRecord, ...prev];
        persistence.set('food_coop_data', JSON.stringify(updated));
        return updated;
    });
    try {
      const success = await syncToGoogleSheets(newRecord);
      if (success) setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    } catch (e) { console.error("Sync error:", e); }
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

  // NEW: Handle deleting a record for demo cleanup
  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Action required: Permanent deletion of record ID: " + id + ". Continue?")) return;
    
    setRecords(prev => {
        const updated = prev.filter(r => r.id !== id);
        persistence.set('food_coop_data', JSON.stringify(updated));
        return updated;
    });

    try {
      await deleteRecordFromCloud(id);
    } catch (e) {
      console.error("Cloud deletion failed:", e);
    }
  };

  const handleToggleUserStatus = async (phone: string, currentStatus?: AccountStatus) => {
    const user = users.find(u => u.phone === phone);
    if (!user) return;
    const newStatus: AccountStatus = (currentStatus === 'ACTIVE') ? 'SUSPENDED' : 'ACTIVE';
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

  const handleExportDetailedCsv = () => {
    if (filteredRecords.length === 0) {
      alert("No detailed records to export.");
      return;
    }
    const headers = ["ID", "Date", "Cluster", "Agent", "Supplier", "Buyer", "Commodity", "Units", "Unit Price", "Gross Total", "Coop Profit", "Status"];
    const rows = filteredRecords.map(r => [
      r.id, r.date, r.cluster, r.agentName, r.farmerName, r.customerName, r.cropType, `${r.unitsSold} ${r.unitType}`, r.unitPrice, r.totalSale, r.coopProfit, r.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `kpl_detailed_audit_${new Date().toISOString().split('T')[0]}.csv`);
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
        if (authForm.role === SystemRole.FIELD_AGENT && !authForm.cluster) {
            alert("Please select a cluster.");
            setIsAuthLoading(false);
            return;
        }

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
        } else { alert("Authentication failed."); }
      }
    } catch (err) { alert("System Auth Error."); } finally { setIsAuthLoading(false); }
  };

  const AuditLogTable = ({ data, title, onDelete }: { data: SaleRecord[], title: string, onDelete?: (id: string) => void }) => {
    const groupedData = useMemo(() => {
      return data.reduce((acc: Record<string, SaleRecord[]>, r) => {
        const cluster = r.cluster || 'Unassigned';
        if (!acc[cluster]) acc[cluster] = [];
        acc[cluster].push(r);
        return acc;
      }, {} as Record<string, SaleRecord[]>);
    }, [data]);

    const grandTotals = useMemo(() => {
      return data.reduce((acc, r) => ({
        gross: acc.gross + Number(r.totalSale),
        comm: acc.comm + Number(r.coopProfit)
      }), { gross: 0, comm: 0 });
    }, [data]);

    return (
      <div className="space-y-12">
        <h3 className="text-sm font-black text-black uppercase tracking-tighter ml-2">{title} ({data.length})</h3>
        {(Object.entries(groupedData) as [string, SaleRecord[]][]).map(([cluster, records]) => {
          const clusterTotalGross = records.reduce((sum, r) => sum + Number(r.totalSale), 0);
          const clusterTotalComm = records.reduce((sum, r) => sum + Number(r.coopProfit), 0);
          
          return (
            <div key={cluster} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg overflow-x-auto">
              <h4 className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-6 border-b border-red-50 pb-3 flex items-center justify-between">
                <span><i className="fas fa-map-marker-alt mr-2"></i> Cluster: {cluster}</span>
                <span className="text-slate-400 font-bold">{records.length} Transactions</span>
              </h4>
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <tr>
                    <th className="pb-6">Date</th>
                    <th className="pb-6">Participants</th>
                    <th className="pb-6">Commodity</th>
                    <th className="pb-6">Gross Sale</th>
                    <th className="pb-6">Commission</th>
                    <th className="pb-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(r => (
                    <tr key={r.id} className="text-[11px] font-bold group hover:bg-slate-50/50">
                      <td className="py-6 text-slate-400">{r.date}</td>
                      <td className="py-6">
                        <div className="space-y-1">
                          <p className="text-black font-black uppercase text-[10px]">Agent: {r.agentName} ({r.agentPhone})</p>
                          <p className="text-slate-500 font-bold text-[9px]">Supplier: {r.farmerName}</p>
                          <p className="text-slate-500 font-bold text-[9px]">Buyer: {r.customerName}</p>
                        </div>
                        <p className="text-[8px] text-slate-300 mt-1 uppercase">ID: {r.id}</p>
                      </td>
                      <td className="py-6 text-black uppercase">{r.cropType}</td>
                      <td className="py-6 font-black text-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                      <td className="py-6 font-black text-green-600">KSh {Number(r.coopProfit).toLocaleString()}</td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {r.status}
                          </span>
                          {onDelete && (
                            <button onClick={() => onDelete(r.id)} className="text-slate-300 hover:text-red-600 transition-colors p-1" title="Delete record for demo cleanup">
                               <i className="fas fa-trash-alt text-[10px]"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-100">
                  <tr className="bg-slate-50/50">
                    <td colSpan={3} className="py-6 px-4 text-[11px] font-black text-black uppercase tracking-widest">
                      {cluster} Cluster Subtotal
                    </td>
                    <td className="py-6 text-[12px] font-black text-black">
                      KSh {clusterTotalGross.toLocaleString()}
                    </td>
                    <td className="py-6 text-[12px] font-black text-green-600">
                      KSh {clusterTotalComm.toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}

        {data.length > 0 && (
          <div className="bg-slate-900 text-white rounded-[2rem] p-10 border border-black shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-10">
                <i className="fas fa-chart-line text-8xl"></i>
             </div>
             <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 mb-2">Aggregate System Audit</p>
                   <h4 className="text-2xl font-black uppercase tracking-tight">Combined Universal Grand Totals</h4>
                   <p className="text-slate-400 text-[10px] font-bold uppercase mt-2">Consolidated across all registered nodes and clusters</p>
                </div>
                <div className="flex gap-12">
                   <div className="text-center md:text-right">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Trade Volume</p>
                      <p className="text-2xl font-black text-white leading-none">KSh {grandTotals.gross.toLocaleString()}</p>
                   </div>
                   <div className="text-center md:text-right">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Gross Commission</p>
                      <p className="text-2xl font-black text-green-400 leading-none">KSh {grandTotals.comm.toLocaleString()}</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {data.length === 0 && (
          <div className="bg-white rounded-[2rem] p-12 border border-slate-100 text-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
            No entries to display in this audit log
          </div>
        )}
      </div>
    );
  };

  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-16 h-16 bg-green-50 text-green-500 rounded-3xl mb-4 border border-green-100"><i className="fas fa-leaf text-2xl text-green-500"></i></div>
           <h1 className="text-3xl font-black text-black uppercase tracking-tighter">Food Coop Market</h1>
           <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Linking Suppliers and Consumer</p>
        </div>
        <div className="w-full max-w-[360px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6 z-10">
            <div className="flex justify-between items-end mb-2">
              <h2 className="text-2xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Register' : 'Login'}</h2>
              <button onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthForm({...authForm, cluster: CLUSTERS[0]})}} className="text-[10px] font-black uppercase text-red-600 hover:text-red-700">{isRegisterMode ? 'Back' : 'Create New Account'}</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none focus:border-green-400 focus:bg-white transition-all" />}
              <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none focus:border-green-400 focus:bg-white transition-all" />
              <input type="password" maxLength={4} placeholder="4-Digit Pin" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value.replace(/\D/g, '')})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black text-center outline-none focus:border-green-400 focus:bg-white transition-all" />
              {isRegisterMode && (
                <>
                  <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none">
                    {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {authForm.role === SystemRole.FIELD_AGENT && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Assign Cluster (Required)</label>
                      <select required value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none">
                        <option value="" disabled>Select Cluster</option>
                        {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  )}
                </>
              )}
              <button disabled={isAuthLoading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl active:scale-95 transition-all">{isAuthLoading ? <i className="fas fa-spinner fa-spin"></i> : (isRegisterMode ? 'Register' : 'Authenticate')}</button>
            </form>
            <div className="pt-4 flex justify-center space-x-2">
               <div className="w-8 h-1 bg-red-600 rounded-full"></div>
               <div className="w-8 h-1 bg-black rounded-full"></div>
               <div className="w-8 h-1 bg-green-500 rounded-full"></div>
            </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-10 gap-6">
          <div className="flex items-center space-x-5">
            <div className="bg-green-50 w-16 h-16 rounded-3xl flex items-center justify-center border border-green-100 shadow-sm"><i className="fas fa-leaf text-2xl text-green-500"></i></div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-black">Food Coop Market</h1>
              <div className="flex items-center space-x-2 mt-1.5">
                <span className="text-red-600 text-[9px] font-black uppercase tracking-[0.4em] italic">Linking Suppliers and Consumer</span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-black text-[9px] font-black uppercase tracking-[0.4em]">{agentIdentity.role}</span>
              </div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{isSystemDev ? 'Master Node Access' : `${agentIdentity.name} - ${agentIdentity.cluster} Cluster`}</p>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right w-full lg:w-auto shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-end space-x-6">
               <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Security Sync</p>
                  <p className="text-[10px] font-bold text-black">{isSyncing ? 'Syncing...' : lastSyncTime?.toLocaleTimeString() || '...'}</p>
               </div>
               <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm"><i className="fas fa-power-off text-sm"></i></button>
            </div>
          </div>
        </div>

        <nav className="container mx-auto px-6 flex flex-wrap gap-3 mt-4 relative z-10">
          {availablePortals.map(p => (
            <button 
              key={p} 
              onClick={() => setCurrentPortal(p)}
              className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? 'bg-black text-white border-black shadow-lg shadow-black/10 scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black'}`}
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
              <StatCard label="Pending Payment" icon="fa-clock" value={`KSh ${stats.dueComm.toLocaleString()}`} color="bg-white" accent="text-red-600" />
              <StatCard label="Processing" icon="fa-spinner" value={`KSh ${stats.awaitingFinanceComm.toLocaleString()}`} color="bg-white" accent="text-black" />
              <StatCard label="Awaiting Audit" icon="fa-clipboard-check" value={`KSh ${stats.awaitingAuditComm.toLocaleString()}`} color="bg-white" accent="text-slate-500" />
              <StatCard label="Verified Profit" icon="fa-check-circle" value={`KSh ${stats.approvedComm.toLocaleString()}`} color="bg-white" accent="text-green-600" />
            </div>
            <SaleForm onSubmit={handleAddRecord} />
            <AuditLogTable data={filteredRecords.slice(0, 10)} title="Recent Integrity Logs (Classified)" onDelete={isSystemDev ? handleDeleteRecord : undefined} />
          </>
        )}

        {currentPortal === 'FINANCE' && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">Transactions Waiting Confirmation</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                      <tr><th className="pb-4">Date</th><th className="pb-4">Participants</th><th className="pb-4">Commodity</th><th className="pb-4">Gross</th><th className="pb-4 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRecords.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-6 font-bold">{r.date}</td>
                          <td className="py-6">
                            <div className="text-[9px] space-y-1 uppercase font-bold text-slate-500">
                              <p className="text-black">Agent: {r.agentName}</p>
                              <p>Supplier: {r.farmerName}</p>
                              <p>Buyer: {r.customerName}</p>
                            </div>
                          </td>
                          <td className="py-6 uppercase font-bold">{r.cropType}</td>
                          <td className="py-6 font-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                          <td className="py-6 text-right">
                             <button onClick={() => handleUpdateStatus(r.id, RecordStatus.PAID)} className="bg-green-500 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-green-600 shadow-md">Confirm Receipt</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            <AuditLogTable data={filteredRecords} title="Full Financial Classified Audit Log" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} />
          </div>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-8">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-black pl-4">Awaiting Approval & Verification</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                      <tr><th className="pb-4">Details</th><th className="pb-4">Participants</th><th className="pb-4">Financials</th><th className="pb-4 text-right">Action</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredRecords.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-6">
                             <p className="font-bold uppercase text-black">{r.cropType}</p>
                             <p className="text-[9px] text-slate-400">{r.unitsSold} {r.unitType}</p>
                             <p className="text-[8px] font-mono mt-1 text-slate-300">{r.signature}</p>
                          </td>
                          <td className="py-6">
                            <div className="text-[9px] space-y-1 uppercase font-bold text-slate-500">
                              <p className="text-black">Agent: {r.agentName}</p>
                              <p>Supplier: {r.farmerName}</p>
                            </div>
                          </td>
                          <td className="py-6 font-black text-black">
                            <p>Gross: KSh {Number(r.totalSale).toLocaleString()}</p>
                            <p className="text-green-600">Comm: KSh {Number(r.coopProfit).toLocaleString()}</p>
                          </td>
                          <td className="py-6 text-right">
                             {r.status === RecordStatus.PAID ? (
                               <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VALIDATED)} className="bg-black text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-md">Verify</button>
                             ) : (
                               <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VERIFIED)} className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-700 shadow-md">Final Audit Seal</button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            <AuditLogTable data={filteredRecords} title="System Integrity Classified Log" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} />
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="space-y-12">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4">
                  <h3 className="text-sm font-black text-black uppercase tracking-tighter border-l-4 border-green-500 pl-4">KPL Food Coops Summary Trade Report</h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={handleExportSummaryCsv}
                      className="bg-slate-100 text-black px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Summary CSV
                    </button>
                    <button 
                      onClick={handleExportDetailedCsv}
                      className="bg-black text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-900 active:scale-95 transition-all"
                    >
                      <i className="fas fa-download mr-2"></i> Detailed CSV Report
                    </button>
                  </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50">
                      <tr>
                        <th className="pb-6">Food Coop Clusters</th>
                        <th className="pb-6">Total Volume of Sales (Ksh)</th>
                        <th className="pb-6">Total Gross Profit (Ksh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {boardMetrics.clusterPerformance.map(([cluster, stats]: any) => (
                        <tr key={cluster} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-6 font-black text-black uppercase text-[11px]">{cluster}</td>
                          <td className="py-6 font-black text-slate-900 text-[11px]">KSh {stats.volume.toLocaleString()}</td>
                          <td className="py-6 font-black text-green-600 text-[11px]">KSh {stats.profit.toLocaleString()}</td>
                        </tr>
                      ))}
                      <tr className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-xl">
                        <td className="py-6 px-8 font-black uppercase text-[11px] rounded-l-3xl">Aggregate Performance</td>
                        <td className="py-6 font-black text-[11px]">KSh {(boardMetrics.clusterPerformance as any[]).reduce((a: number, b: any) => a + b[1].volume, 0).toLocaleString()}</td>
                        <td className="py-6 px-8 font-black text-green-400 text-[11px] rounded-r-3xl">KSh {(boardMetrics.clusterPerformance as any[]).reduce((a: number, b: any) => a + b[1].profit, 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                 </table>
               </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
                 <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8">Yield Analysis</h3>
                 <div className="space-y-6">
                    {boardMetrics.commodityTrends.slice(0, 8).map(([crop, value]: any) => (
                      <div key={crop} className="space-y-2">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-wider text-slate-600">
                          <span>{crop}</span>
                          <span>{value.toLocaleString()} Units</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: `${(value / (boardMetrics.commodityTrends[0]?.[1] || 1)) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                 </div>
              </div>
              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
                 <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">Cluster Ranking</h3>
                 <div className="mt-8 space-y-5">
                    {boardMetrics.clusterPerformance.map(([cluster, stats]: any, idx) => (
                      <div key={cluster} className="space-y-2">
                         <div className="flex justify-between items-center text-[11px] font-black uppercase text-black tracking-widest">
                            <span className="text-slate-400">{idx + 1}. {cluster}</span>
                            <span className="text-green-600 font-black">KSh {stats.profit.toLocaleString()}</span>
                         </div>
                         <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-red-600 shadow-sm" style={{ width: `${(stats.profit / (boardMetrics.clusterPerformance[0]?.[1].profit || 1)) * 100}%` }}></div>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            <AuditLogTable data={filteredRecords} title="Universal Trade Log (Classified by Cluster)" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} />
          </div>
        )}

        {currentPortal === 'SYSTEM' && isSystemDev && (
          <div className="space-y-12">
            {/* Added: Direct Cloud Repository Link */}
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 border border-black shadow-2xl relative overflow-hidden">
               <div className="absolute top-0 right-0 p-8 opacity-10">
                  <i className="fas fa-database text-8xl"></i>
               </div>
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div>
                     <p className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-2">Cloud Storage Node</p>
                     <h4 className="text-2xl font-black uppercase tracking-tight">Master Database Repository</h4>
                     <p className="text-slate-400 text-[10px] font-bold uppercase mt-2">Direct live access to Google Sheets data ledger for auditing</p>
                  </div>
                  <a 
                    href={GOOGLE_SHEET_VIEW_URL} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl hover:bg-green-700 active:scale-95 transition-all flex items-center"
                  >
                    <i className="fas fa-table mr-3 text-lg"></i> Launch Master Ledger
                  </a>
               </div>
            </div>

            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">Agent Activation & Security</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                      <tr><th className="pb-4">Name & Contact</th><th className="pb-4">Role / Node</th><th className="pb-4">Status</th><th className="pb-4 text-right">Access Control</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {users.map(u => (
                        <tr key={u.phone} className="group hover:bg-slate-50/50">
                          <td className="py-6">
                             <p className="text-sm font-black uppercase text-black">{u.name}</p>
                             <p className="text-[10px] text-slate-400 font-mono">{u.phone}</p>
                          </td>
                          <td className="py-6">
                             <p className="text-[11px] font-black text-black uppercase">{u.role}</p>
                             <p className="text-[9px] text-slate-400 uppercase">{u.cluster}</p>
                          </td>
                          <td className="py-6">
                             <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                               {u.status || 'AWAITING'}
                             </span>
                          </td>
                          <td className="py-6 text-right">
                             {u.status === 'ACTIVE' ? (
                               <button onClick={() => handleToggleUserStatus(u.phone, 'ACTIVE')} className="bg-white border border-red-200 text-red-600 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm">Deactivate</button>
                             ) : (
                               <button onClick={() => handleToggleUserStatus(u.phone)} className="bg-green-500 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-md">Reactivate</button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            
            <AuditLogTable data={filteredRecords} title="System-Wide Classified Universal Audit Log" onDelete={handleDeleteRecord} />
          </div>
        )}
      </main>
    </div>
  );

  function isPrivilegedRole(agent: AgentIdentity | null) {
    if (!agent) return false;
    return isSystemDev || 
           agent.role === SystemRole.MANAGER || 
           agent.role === SystemRole.FINANCE_OFFICER || 
           agent.role === SystemRole.AUDITOR;
  }
};

export default App;