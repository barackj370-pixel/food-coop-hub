
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity, AccountStatus } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, CROP_TYPES, GOOGLE_SHEETS_WEBHOOK_URL, GOOGLE_SHEET_VIEW_URL, SYNC_POLLING_INTERVAL } from './constants.ts';
import { syncToGoogleSheets, fetchFromGoogleSheets, syncUserToCloud, fetchUsersFromCloud, clearAllRecordsOnCloud, clearAllUsersOnCloud, deleteRecordFromCloud, deleteUserFromCloud } from './services/googleSheetsService.ts';

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
  const [records, setRecords] = useState<SaleRecord[]>([]);
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
    persistence.remove('agent_session');
    persistence.remove('food_coop_data');
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
        persistence.set('coop_users', JSON.stringify(cloudUsers));
      }

      if (cloudRecords) {
        const validRecords = cloudRecords.filter(r => r.cluster && r.cluster !== 'Unassigned');
        setRecords(validRecords);
        persistence.set('food_coop_data', JSON.stringify(validRecords));
        setLastSyncTime(new Date());
      }
    } catch (e) {
      console.error("Background sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [agentIdentity]);

  // Initial load on login
  useEffect(() => {
    if (agentIdentity) {
      loadCloudData();
    }
  }, [agentIdentity, loadCloudData]);

  // Background polling for dynamic multi-device sync
  useEffect(() => {
    if (!agentIdentity) return;
    const interval = setInterval(() => {
      loadCloudData();
    }, SYNC_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [agentIdentity, loadCloudData]);

  useEffect(() => {
    const saved = persistence.get('food_coop_data');
    if (saved && records.length === 0) { 
      try { 
        const parsed: SaleRecord[] = JSON.parse(saved);
        const scrubbed = parsed.filter(r => r.cluster && r.cluster !== 'Unassigned');
        setRecords(scrubbed); 
      } catch (e) { } 
    }
  }, [records.length]);

  const handleClearRecords = async () => {
    if (window.confirm("CRITICAL RESET: This will wipe ALL records from the cloud source and local storage. Your account session will be preserved. Continue?")) {
      try {
        setRecords([]);
        await clearAllRecordsOnCloud();
        persistence.remove('food_coop_data');
        alert("Full Data Reset Successful.");
        loadCloudData();
      } catch (err) {
        window.location.reload();
      }
    }
  };

  const handleClearUsers = async (confirm = true) => {
    if (confirm && !window.confirm("IDENTITY NUCLEAR RESET: This will delete ALL registered accounts from the cloud and local registry. You will be logged out. Continue?")) return;
    try {
      await clearAllUsersOnCloud();
      persistence.remove('coop_users');
      persistence.remove('agent_session');
      alert("Identity Database Cleared.");
      window.location.reload();
    } catch (err) {
      window.location.reload();
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Permanently delete this record from the cloud?")) return;
    setRecords(prev => prev.filter(r => r.id !== id));
    await deleteRecordFromCloud(id);
  };

  const handleDeleteUser = async (phone: string) => {
    if (!window.confirm(`Permanently delete user with phone ${phone} from the cloud and local registry?`)) return;
    const success = await deleteUserFromCloud(phone);
    if (success) {
      const usersData = persistence.get('coop_users');
      if (usersData) {
        let users: AgentIdentity[] = JSON.parse(usersData);
        users = users.filter(u => normalizePhone(u.phone) !== normalizePhone(phone));
        persistence.set('coop_users', JSON.stringify(users));
        setIsAuthLoading(!isAuthLoading);
      }
      alert("User deleted successfully.");
    }
  };

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
    const coopProfit = totalSale * PROFIT_MARGIN;
    const signature = await computeHash({ ...data, id });
    
    const cluster = agentIdentity?.cluster || 'Unassigned';
    if (cluster === 'Unassigned' && !isSystemDev) {
      alert("Error: Your account is missing a cluster assignment. Please contact support.");
      return;
    }

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
    
    setRecords([newRecord, ...records]);
    
    if (newRecord.cluster !== 'Unassigned') {
      const success = await syncToGoogleSheets(newRecord);
      if (success) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
      }
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const targetPhoneNormalized = normalizePhone(authForm.phone);
    const targetPasscode = authForm.passcode.replace(/\D/g, '');

    try {
      const latestCloudUsers = await fetchUsersFromCloud();
      let users: AgentIdentity[] = latestCloudUsers || JSON.parse(persistence.get('coop_users') || '[]');

      if (isRegisterMode) {
        const newUser: AgentIdentity = { 
          name: authForm.name.trim(), 
          phone: authForm.phone.trim(), 
          passcode: targetPasscode, 
          role: authForm.role, 
          cluster: authForm.role === SystemRole.FIELD_AGENT ? authForm.cluster : 'System', 
          status: 'ACTIVE' 
        };
        users.push(newUser);
        persistence.set('coop_users', JSON.stringify(users));
        await syncUserToCloud(newUser);
        setAgentIdentity(newUser);
      } else {
        const user = users.find(u => normalizePhone(u.phone) === targetPhoneNormalized && String(u.passcode).replace(/\D/g, '') === targetPasscode);
        if (user) setAgentIdentity(user);
        else alert("Authentication failed.");
      }
    } catch (err) {
      alert("System Auth Error.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const filteredRecords = useMemo(() => {
    let base = records.filter(r => r.id && r.id.length >= 4 && r.date);
    base = base.filter(r => r.cluster && r.cluster !== 'Unassigned');
    base = base.filter(r => r.date !== '2025-02-10');

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
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - logFilterDays);
    return filteredRecords.filter(r => new Date(r.date).getTime() >= cutoff.getTime());
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

  const auditPeriodMetrics = useMemo(() => {
    const now = new Date();
    const rLog = filteredRecords;
    const getRange = (days: number) => {
      const cutoff = new Date(now);
      cutoff.setDate(now.getDate() - days);
      const rangeRecords = rLog.filter(r => new Date(r.date).getTime() >= cutoff.getTime());
      return {
        sales: rangeRecords.reduce((sum, r) => sum + Number(r.totalSale), 0),
        comm: rangeRecords.filter(r => r.status === RecordStatus.VERIFIED).reduce((sum, r) => sum + Number(r.coopProfit), 0)
      };
    };
    return { d7: getRange(7), d14: getRange(14), d21: getRange(21), d30: getRange(30) };
  }, [filteredRecords]);

  const periodicMetrics = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    const rLog = filteredRecords;
    return {
      monthly: {
        sales: rLog.filter(r => new Date(r.date).getTime() >= startOfMonth.getTime()).reduce((sum, r) => sum + Number(r.totalSale), 0),
        comm: rLog.filter(r => r.status === RecordStatus.VERIFIED && new Date(r.date).getTime() >= startOfMonth.getTime()).reduce((sum, r) => sum + Number(r.coopProfit), 0),
      },
      weekly: {
        sales: rLog.filter(r => new Date(r.date).getTime() >= startOfWeek.getTime()).reduce((sum, r) => sum + Number(r.totalSale), 0),
        comm: rLog.filter(r => r.status === RecordStatus.VERIFIED && new Date(r.date).getTime() >= startOfWeek.getTime()).reduce((sum, r) => sum + Number(r.coopProfit), 0),
      }
    };
  }, [filteredRecords]);

  const boardMetrics = useMemo(() => {
    const rLog = filteredRecords;
    const performanceMap = rLog.reduce((acc, r) => {
      const label = `${r.cropType} (${r.date})`;
      acc[label] = (acc[label] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    
    const performanceData: [string, number][] = (Object.keys(performanceMap).map(key => [key, Number(performanceMap[key])] as [string, number])).sort((a, b) => {
      const dateA = a[0].match(/\((.*?)\)/)?.[1] || "";
      const dateB = b[0].match(/\((.*?)\)/)?.[1] || "";
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }).slice(-15);

    const clusterMap = rLog.reduce((acc, r) => {
      const cluster = r.cluster || 'Unknown';
      acc[cluster] = (acc[cluster] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    
    const clusterPerformance: [string, number][] = (Object.keys(clusterMap).map(key => [key, Number(clusterMap[key])] as [string, number])).sort((a, b) => b[1] - a[1]);

    const agentMap = rLog.reduce((acc, r) => {
      const agent = r.agentName || 'Unknown Agent';
      acc[agent] = (acc[agent] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    
    const topAgents: [string, number][] = (Object.keys(agentMap).map(key => [key, Number(agentMap[key])] as [string, number])).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return { performanceData, clusterPerformance, topAgents };
  }, [filteredRecords]);

  const clusterSummary = useMemo(() => {
    const rLog = filteredRecords;
    const summary = rLog.reduce((acc: Record<string, { sales: number; profit: number }>, r) => {
      const cluster = r.cluster || 'Unknown';
      if (!acc[cluster]) {
        acc[cluster] = { sales: 0, profit: 0 };
      }
      acc[cluster].sales += Number(r.totalSale);
      acc[cluster].profit += Number(r.coopProfit);
      return acc;
    }, {} as Record<string, { sales: number; profit: number }>);

    const rows = (Object.entries(summary) as [string, { sales: number; profit: number }][]).map(([name, data]) => ({
      name,
      sales: data.sales,
      profit: data.profit
    })).sort((a, b) => b.sales - a.sales);

    const totals = rows.reduce((acc, row) => ({
      sales: acc.sales + row.sales,
      profit: acc.profit + row.profit
    }), { sales: 0, profit: 0 });

    return { rows, totals };
  }, [filteredRecords]);

  const registeredUsers = useMemo(() => {
    const usersData = persistence.get('coop_users');
    return usersData ? JSON.parse(usersData) as AgentIdentity[] : [];
  }, [isAuthLoading]);

  const updateUserStatus = (phone: string, status: AccountStatus, resetWarnings = false) => {
    const usersData = persistence.get('coop_users');
    if (!usersData) return;
    let users: AgentIdentity[] = JSON.parse(usersData);
    const idx = users.findIndex(u => normalizePhone(u.phone) === normalizePhone(phone));
    if (idx !== -1) {
      users[idx].status = status;
      if (resetWarnings) users[idx].warnings = 0;
      persistence.set('coop_users', JSON.stringify(users));
      setIsAuthLoading(!isAuthLoading);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    const record = records.find(r => r.id === id);
    if (record && record.cluster && record.cluster !== 'Unassigned') {
      const success = await syncToGoogleSheets({ ...record, status: newStatus });
      if (success) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, synced: true } : r));
      }
    }
  };

  const handleSingleSync = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (!record || !record.cluster || record.cluster === 'Unassigned') return;
    const success = await syncToGoogleSheets(record);
    if (success) setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
  };

  const handleExportCsv = () => {
    if (auditLogRecords.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = [
      "ID", "Date", "Commodity", "Farmer", "Farmer Phone",
      "Customer", "Customer Phone", "Units", "Unit Price",
      "Total Gross", "Commission", "Status", "Agent",
      "Agent Phone", "Cluster", "Created At", "Signature", "Unit"
    ];
    const csvRows = auditLogRecords.map(r => [
      r.id, r.date, r.cropType, r.farmerName, r.farmerPhone || "",
      r.customerName || "", r.customerPhone || "", r.unitsSold, r.unitPrice,
      r.totalSale, r.coopProfit, r.status, r.agentName || "",
      r.agentPhone || "", r.cluster || "", r.createdAt, r.signature, r.unitType
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `food_coop_audit_${logFilterDays}D_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSummaryCsv = () => {
    if (clusterSummary.rows.length === 0) {
      alert("No data available to export.");
      return;
    }
    const headers = ["Food Coop Clusters", "Total of sales (Ksh)", "Total Gross Profit 10% (Ksh)"];
    const csvRows = clusterSummary.rows.map(row => [
      row.name, row.sales, row.profit
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

    csvRows.push([
      "Grand Totals", clusterSummary.totals.sales, clusterSummary.totals.profit
    ].map(val => `"${String(val).replace(/"/g, '""')}"`).join(","));

    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `food_coop_summary_trade_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
          </div>
        </div>
        <div className="container mx-auto px-6 flex flex-wrap gap-2 animate-fade-in">
          {availablePortals.map(portal => (
            <button key={portal} onClick={() => setCurrentPortal(portal)} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === portal ? 'bg-emerald-500 text-emerald-950 border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-emerald-400/60 border-white/5 hover:bg-white/10'}`}>
              <i className={`fas ${portal === 'SALES' ? 'fa-cart-shopping' : portal === 'FINANCE' ? 'fa-chart-line' : portal === 'AUDIT' ? 'fa-shield-halved' : portal === 'BOARD' ? 'fa-users' : 'fa-id-card-clip'} mr-3`}></i>{portal} Portal
            </button>
          ))}
        </div>
      </header>

      <main className="container mx-auto px-6 -mt-8 space-y-10 relative z-20">
        {currentPortal === 'SALES' && <div className="animate-fade-in"><SaleForm onSubmit={handleAddRecord} /></div>}
        
        {currentPortal === 'FINANCE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
             <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-blue-500">
                <p className="text-[10px] font-black text-blue-100 uppercase tracking-[0.4em] mb-4">Urgent Actions</p>
                <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-1">Awaiting Finance Approval</p>
                <p className="text-3xl font-black">KSh {stats.awaitingFinanceComm.toLocaleString()}</p>
                <div className="mt-6 pt-6 border-t border-white/10"><span className="text-[9px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-lg">High Visibility Queue</span></div>
             </div>
          </div>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-10 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-emerald-800">
                   <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-4">Verification Desk</p>
                   <p className="text-[8px] font-black text-emerald-400/40 uppercase tracking-widest mb-1">Awaiting Auditor's Stamp</p>
                   <p className="text-3xl font-black">KSh {stats.awaitingAuditComm.toLocaleString()}</p>
                   <div className="mt-6 pt-6 border-t border-white/5"><span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg">Audit Verification Required</span></div>
                </div>
             </div>
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <div className="flex items-center justify-between mb-8">
                 <div><h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Agent Re-instatement</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Approve suspended agents</p></div>
                 <i className="fas fa-user-shield text-slate-200 text-2xl"></i>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Agent Name</th><th className="px-6 py-4">Cluster</th><th className="px-6 py-4 text-center">Action</th></tr></thead>
                   <tbody className="divide-y divide-slate-50">
                     {registeredUsers.filter(u => u.status === 'SUSPENDED').length === 0 ? (<tr><td colSpan={3} className="px-6 py-10 text-center text-slate-300 font-bold uppercase text-[10px]">No suspensions detected</td></tr>) : registeredUsers.filter(u => u.status === 'SUSPENDED').map(user => (
                       <tr key={user.phone}>
                         <td className="px-6 py-4 text-[12px] font-black text-slate-900">{user.name}</td>
                         <td className="px-6 py-4 text-[11px] font-bold text-slate-400">{user.cluster}</td>
                         <td className="px-6 py-4 text-center"><button onClick={() => updateUserStatus(user.phone, 'AWAITING_ACTIVATION')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl">Approve</button></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                  <div>
                    <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Summary Trade Report for Food Coop</h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Global Cluster Performance Summary</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <button onClick={handleExportSummaryCsv} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-8 py-3.5 rounded-2xl shadow-xl active:scale-95 transition-all inline-flex items-center">
                      <i className="fas fa-file-csv mr-2"></i>Download CSV
                    </button>
                    <i className="fas fa-file-contract text-slate-200 text-2xl hidden md:block"></i>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-5">Food Coop Clusters</th>
                        <th className="px-8 py-5">Total of sales (Ksh)</th>
                        <th className="px-8 py-5">Total Gross Profit 10% (Ksh)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {clusterSummary.rows.length === 0 ? (
                        <tr><td colSpan={3} className="px-8 py-10 text-center text-slate-300 font-black uppercase text-[10px]">No sales data recorded</td></tr>
                      ) : clusterSummary.rows.map(row => (
                        <tr key={row.name} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-8 py-5 text-[12px] font-black text-slate-900 uppercase tracking-tight">{row.name}</td>
                          <td className="px-8 py-5 text-[12px] font-black text-slate-700">KSh {row.sales.toLocaleString()}</td>
                          <td className="px-8 py-5 text-[12px] font-black text-emerald-600">KSh {row.profit.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200">
                      <tr className="font-black text-slate-900">
                        <td className="px-8 py-6 text-[11px] uppercase tracking-widest">Grand Totals</td>
                        <td className="px-8 py-6 text-[14px]">KSh {clusterSummary.totals.sales.toLocaleString()}</td>
                        <td className="px-8 py-6 text-[14px] text-emerald-600">KSh {clusterSummary.totals.profit.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col">
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-10">Commodity Yield Analysis</h3>
                  <div className="flex-1 min-h-[300px] flex items-end justify-between pl-10 pr-6 pb-16 pt-8 relative bg-slate-50/20 rounded-[2rem] border border-slate-100/50 overflow-visible">
                    {boardMetrics.performanceData.length === 0 ? (<div className="absolute inset-0 flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No data</div>) : boardMetrics.performanceData.map(([label, value]) => {
                      const maxVal = Math.max(...boardMetrics.performanceData.map(d => Number(d[1])), 1);
                      const heightPercent = (Number(value) / maxVal) * 100;
                      return (
                        <div key={label} className="flex-1 flex flex-col items-center group relative h-full justify-end px-1">
                          <div className="w-full bg-emerald-500 rounded-t-xl transition-all duration-500 group-hover:bg-emerald-600 relative" style={{ height: `${heightPercent}%` }}>
                            <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[8px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-black shadow-lg">KSh {Number(value).toLocaleString()}</div>
                          </div>
                          <span className="text-[6px] font-black text-slate-800 uppercase mt-2 transform rotate-45 whitespace-nowrap">{label.split(' (')[0]}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white shadow-2xl space-y-6 relative overflow-hidden flex flex-col justify-center">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-[40px] translate-x-1/2 -translate-y-1/2"></div>
                   <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em]">Integrity Snapshots</p>
                   <div className="grid grid-cols-1 gap-6">
                      <div className="border-l-2 border-emerald-500/30 pl-4">
                        <p className="text-[8px] font-black text-emerald-400/40 uppercase tracking-widest mb-1">Monthly Approved Comm</p>
                        <p className="text-2xl font-black text-emerald-300">KSh {periodicMetrics.monthly.comm.toLocaleString()}</p>
                      </div>
                      <div className="border-l-2 border-emerald-500/30 pl-4">
                        <p className="text-[8px] font-black text-emerald-400/40 uppercase tracking-widest mb-1">Weekly Approved Comm</p>
                        <p className="text-2xl font-black text-emerald-300">KSh {periodicMetrics.weekly.comm.toLocaleString()}</p>
                      </div>
                      <div className="border-l-2 border-white/10 pl-4 opacity-50">
                        <p className="text-[8px] font-black text-white/40 uppercase tracking-widest mb-1">Monthly Gross Sales</p>
                        <p className="text-xl font-black">KSh {periodicMetrics.monthly.sales.toLocaleString()}</p>
                      </div>
                   </div>
                   <div className="pt-6 border-t border-white/5"><div className="flex items-center space-x-2"><i className="fas fa-shield-check text-emerald-400 text-[10px]"></i><span className="text-[9px] font-black uppercase tracking-widest">Coop Status: Healthy</span></div></div>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Agent Leaderboard</h3>
                    <i className="fas fa-medal text-amber-500 text-xl"></i>
                  </div>
                  <div className="space-y-4">
                    {boardMetrics.topAgents.length === 0 ? (
                      <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">No agent data</p>
                    ) : boardMetrics.topAgents.map(([name, value], idx) => (
                      <div key={name} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100/50">
                        <div className="flex items-center space-x-4">
                          <span className={`w-8 h-8 flex items-center justify-center rounded-xl font-black text-[10px] ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-200 text-slate-600' : 'bg-orange-50 text-orange-600'}`}>{idx + 1}</span>
                          <div>
                            <p className="text-[12px] font-black text-slate-900">{name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Field Agent</p>
                          </div>
                        </div>
                        <p className="text-[12px] font-black text-emerald-600">KSh {value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Cluster Rankings</h3>
                    <i className="fas fa-chart-bar text-emerald-500 text-xl"></i>
                  </div>
                  <div className="space-y-6">
                    {boardMetrics.clusterPerformance.length === 0 ? (
                      <p className="text-center py-10 text-slate-300 font-bold uppercase text-[10px]">No cluster data</p>
                    ) : boardMetrics.clusterPerformance.map(([cluster, value]) => {
                      const maxVal = Math.max(...boardMetrics.clusterPerformance.map(d => Number(d[1])), 1);
                      const widthPercent = (Number(value) / maxVal) * 100;
                      return (
                        <div key={cluster} className="space-y-2">
                          <div className="flex justify-between items-end">
                            <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">{cluster}</span>
                            <span className="text-[11px] font-black text-emerald-600">KSh {value.toLocaleString()}</span>
                          </div>
                          <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                            <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${widthPercent}%` }}></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
             </div>
          </div>
        )}

        {isSystemDev && currentPortal === 'SYSTEM' && (
          <div className="space-y-10 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-emerald-900 p-8 rounded-[2.5rem] border border-emerald-800 text-white flex justify-between items-center shadow-2xl">
                   <div><h3 className="font-black uppercase tracking-tight text-lg">Infrastructure</h3><p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Cloud Engine</p></div>
                   <div className="flex flex-col space-y-2">
                     <a href={GOOGLE_SHEET_VIEW_URL} target="_blank" rel="noopener noreferrer" className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[10px] font-black uppercase px-6 py-4 rounded-2xl shadow-xl active:scale-95 transition-all text-center">Open Sheet</a>
                     <button onClick={loadCloudData} className="bg-emerald-400/10 hover:bg-emerald-400/20 text-emerald-400 text-[10px] font-black uppercase px-6 py-3 rounded-2xl border border-emerald-400/30">Manual Sync</button>
                   </div>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-red-100 flex justify-between items-center shadow-xl">
                   <div><h3 className="font-black uppercase tracking-tight text-lg text-red-600">Nuclear Records</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Clear All History</p></div>
                   <button onClick={handleClearRecords} className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase px-6 py-4 rounded-2xl shadow-xl active:scale-95 transition-all">Clear All</button>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-red-500 flex justify-between items-center shadow-xl">
                   <div><h3 className="font-black uppercase tracking-tight text-lg text-red-600">Nuclear Identity</h3><p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Wipe All Users</p></div>
                   <button onClick={handleClearUsers} className="bg-red-900 hover:bg-black text-white text-[10px] font-black uppercase px-6 py-4 rounded-2xl shadow-xl active:scale-95 transition-all">Wipe Users</button>
                </div>
             </div>
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight mb-8">Pending Activations</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest"><tr><th className="px-6 py-4">Agent Name</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Action</th></tr></thead>
                   <tbody className="divide-y divide-slate-50">
                     {registeredUsers.filter(u => u.status === 'AWAITING_ACTIVATION').length === 0 ? (<tr><td colSpan={3} className="px-6 py-10 text-center text-slate-300 font-bold uppercase text-[10px]">No pending activations</td></tr>) : registeredUsers.filter(u => u.status === 'AWAITING_ACTIVATION').map(user => (
                       <tr key={user.phone}>
                         <td className="px-6 py-4 text-[12px] font-black text-slate-900">{user.name}</td>
                         <td className="px-6 py-4"><span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-[8px] font-black uppercase">Pending Approval</span></td>
                         <td className="px-6 py-4 text-center"><button onClick={() => updateUserStatus(user.phone, 'ACTIVE', true)} className="bg-slate-900 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-md">Reactivate</button></td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>
             <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden h-[450px] flex flex-col">
                <div className="p-8 border-b border-slate-50 flex items-center justify-between"><h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Global Identity Registry</h3><p className="text-[9px] font-bold text-slate-300 uppercase">Authenticated Accounts</p></div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 sticky top-0 text-[10px] text-slate-400 font-black uppercase tracking-widest"><tr><th className="px-8 py-4">Name</th><th className="px-8 py-4">Role</th><th className="px-8 py-4">Cluster</th><th className="px-8 py-4">Phone</th><th className="px-8 py-4">Status</th><th className="px-8 py-4 text-center">Action</th></tr></thead>
                    <tbody className="divide-y divide-slate-50">{registeredUsers.map((user, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-8 py-4 text-[12px] font-black text-slate-900">{user.name}</td>
                        <td className="px-8 py-4"><span className="px-2 py-1 bg-emerald-50 text-emerald-600 rounded text-[9px] font-black uppercase">{user.role}</span></td>
                        <td className="px-8 py-4 text-[11px] font-bold text-slate-500 italic">{user.cluster || 'None'}</td>
                        <td className="px-8 py-4 text-[12px] font-bold text-slate-500">{user.phone}</td>
                        <td className="px-8 py-4"><span className={`text-[8px] font-black uppercase ${user.status === 'ACTIVE' ? 'text-emerald-500' : 'text-red-500'}`}>{user.status}</span></td>
                        <td className="px-8 py-4 text-center">
                          <button 
                            onClick={() => handleDeleteUser(user.phone)} 
                            className="text-slate-300 hover:text-red-500 transition-colors p-2"
                            title="Delete User Permanently"
                          >
                            <i className="fas fa-trash-can text-[12px]"></i>
                          </button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
             </div>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
            {[7, 14, 21, 30].map(days => {
              const range = auditPeriodMetrics[`d${days}` as keyof typeof auditPeriodMetrics];
              return (
                <div key={days} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] mb-3">{days} Day Audit</p>
                  <div className="space-y-1">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Gross Sales</p>
                    <p className="text-[13px] font-black text-slate-900">KSh {range.sales.toLocaleString()}</p>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-50 space-y-1">
                    <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest">Approved Comm.</p>
                    <p className="text-[13px] font-black text-emerald-600">KSh {range.comm.toLocaleString()}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-fade-in">
            <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em]">Audit & Integrity Log</h3>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Universal System Integrity Oversight</p>
              </div>
              <div className="flex items-center space-x-4">
                 <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
                    {[7, 14, 21, 30].map(d => (
                      <button key={d} onClick={() => setLogFilterDays(d)} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase transition-all ${logFilterDays === d ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>{d}D</button>
                    ))}
                 </div>
                 <button onClick={handleExportCsv} className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase px-8 py-3.5 rounded-2xl shadow-xl active:scale-95 transition-all inline-flex items-center">
                   <i className="fas fa-file-csv mr-2"></i>Export CSV
                 </button>
                 {currentPortal === 'SYSTEM' && (
                   <a href={GOOGLE_SHEET_VIEW_URL} target="_blank" rel="noopener noreferrer" className="bg-emerald-900 hover:bg-black text-white text-[10px] font-black uppercase px-8 py-3.5 rounded-2xl shadow-xl active:scale-95 transition-all inline-flex items-center">
                     <i className="fas fa-table mr-2"></i>Open Cloud Sheet
                   </a>
                 )}
              </div>
            </div>
            <Table 
              groupedRecords={groupedAndSortedRecords} 
              portal={currentPortal} 
              onStatusUpdate={handleUpdateStatus} 
              onForceSync={handleSingleSync} 
              onDeleteRecord={isSystemDev ? handleDeleteRecord : undefined}
              normalizePhone={normalizePhone} 
            />
          </div>
        </div>
      </main>
      <footer className="mt-20 text-center pb-12"><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Agricultural Trust Network • v4.7.11</p></footer>
    </div>
  );
};

const Table: React.FC<{ 
  groupedRecords: Record<string, SaleRecord[]>, 
  onStatusUpdate?: (id: string, s: RecordStatus) => void, 
  onForceSync?: (id: string) => void,
  onDeleteRecord?: (id: string) => void,
  portal?: PortalType,
  normalizePhone: (p: string) => string
}> = ({ groupedRecords, onStatusUpdate, onForceSync, onDeleteRecord, portal, normalizePhone }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left min-w-[1200px]">
      <thead className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest">
        <tr>
          <th className="px-8 py-6">Timestamp</th>
          <th className="px-8 py-6">Participants</th>
          <th className="px-8 py-6">Commodity</th>
          <th className="px-8 py-6">Quantity/Unit Sold</th>
          <th className="px-8 py-6">Unit Price</th>
          <th className="px-8 py-6">Total Volume of Sales/Total Sales (Ksh)</th>
          <th className="px-8 py-6">Total Gross Profit 10% (Ksh)</th>
          <th className="px-8 py-6 text-center">Cloud</th>
          <th className="px-8 py-6">Status</th>
          <th className="px-8 py-6">Security</th>
          <th className="px-8 py-6 text-center">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {Object.keys(groupedRecords).length === 0 ? (
          <tr><td colSpan={11} className="px-8 py-20 text-center text-slate-300 uppercase font-black tracking-[0.2em] text-[10px]">No audit logs detected</td></tr>
        ) : Object.keys(groupedRecords).map(cluster => (
          <React.Fragment key={cluster}>
            <tr className="bg-slate-50/50"><td colSpan={11} className="px-8 py-3 text-[10px] font-black uppercase text-emerald-600 tracking-[0.4em] border-y border-slate-100">{cluster} Cluster</td></tr>
            {groupedRecords[cluster].map(r => (
              <tr key={r.id} className="hover:bg-slate-50/30 group transition-colors">
                <td className="px-8 py-6 text-[12px] font-black text-slate-900">{r.date}<br/><span className="text-[9px] text-slate-400 font-bold">{new Date(r.createdAt).toLocaleTimeString()}</span></td>
                <td className="px-8 py-6">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-slate-800">
                      <span className="text-emerald-600 uppercase text-[8px] mr-1">Agent:</span> 
                      {r.agentName || 'System'} <span className="text-slate-400 font-bold">({r.agentPhone || 'N/A'})</span>
                    </div>
                    <div className="text-[10px] font-black text-slate-700">
                      <span className="text-slate-400 uppercase text-[8px] mr-1">Supplier:</span> 
                      {r.farmerName} <span className="text-slate-400 font-bold">({r.farmerPhone || 'N/A'})</span>
                    </div>
                    <div className="text-[10px] font-black text-slate-700">
                      <span className="text-slate-400 uppercase text-[8px] mr-1">Buyer:</span> 
                      {r.customerName} <span className="text-slate-400 font-bold">({r.customerPhone || 'N/A'})</span>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6"><span className="bg-slate-100 px-3 py-1 rounded-xl text-[10px] font-black uppercase text-slate-600">{r.cropType}</span></td>
                <td className="px-8 py-6 text-[12px] font-black text-slate-900">
                  {r.unitsSold} <span className="text-[10px] text-slate-400 uppercase ml-0.5">{r.unitType}</span>
                </td>
                <td className="px-8 py-6 text-[12px] font-black text-slate-900">
                  KSh {r.unitPrice.toLocaleString()}<br/>
                  <span className="text-[9px] text-slate-400 font-bold uppercase">per {r.unitType}</span>
                </td>
                <td className="px-8 py-6 text-[12px] font-black text-slate-700">
                  KSh {r.totalSale.toLocaleString()}
                </td>
                <td className="px-8 py-6 text-[12px] font-black text-emerald-600">KSh {r.coopProfit.toLocaleString()}</td>
                <td className="px-8 py-6 text-center"><CloudSyncBadge synced={r.synced} onSync={() => onForceSync?.(r.id)} showSyncBtn={portal === 'SALES'} /></td>
                <td className="px-8 py-6"><span className={`text-[9px] font-black uppercase px-3 py-1.5 rounded-xl border shadow-sm ${r.status === RecordStatus.VERIFIED ? 'bg-emerald-900 text-white border-emerald-800' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>{r.status}</span></td>
                <td className="px-8 py-6"><SecurityBadge record={r} /></td>
                <td className="px-8 py-6 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    {portal === 'SALES' && r.status === RecordStatus.DRAFT && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.PAID)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-md transition-all active:scale-95">Forward</button>)}
                    {portal === 'FINANCE' && r.status === RecordStatus.PAID && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.VALIDATED)} className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-md transition-all active:scale-95">Approve</button>)}
                    {portal === 'AUDIT' && r.status === RecordStatus.VALIDATED && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.VERIFIED)} className="bg-emerald-900 hover:bg-black text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-md transition-all active:scale-95">Verify</button>)}
                    {onDeleteRecord && (
                      <button 
                        onClick={() => onDeleteRecord(r.id)} 
                        className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                        title="Delete Record Permanently"
                      >
                        <i className="fas fa-trash-can text-[12px]"></i>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
);

const CloudSyncBadge: React.FC<{ synced?: boolean; onSync?: () => void; showSyncBtn?: boolean }> = ({ synced, onSync, showSyncBtn }) => (
  <div className="flex flex-col items-center">
    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${synced ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
      {synced ? 'Synced' : 'Local'}
    </div>
    {!synced && showSyncBtn && <button onClick={(e) => { e.stopPropagation(); onSync?.(); }} className="text-[7px] font-black text-blue-600 uppercase mt-1 underline">Retry</button>}
  </div>
);

const SecurityBadge: React.FC<{ record: SaleRecord }> = ({ record }) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  useEffect(() => { computeHash(record).then(h => setIsValid(h === record.signature)); }, [record]);
  if (isValid === null) return <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse"></div>;
  return (
    <div className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isValid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
      <i className={`fas ${isValid ? 'fa-check-circle' : 'fa-exclamation-triangle'} mr-1`}></i>
      {isValid ? 'Authentic' : 'Tampered'}
    </div>
  );
};

export default App;
