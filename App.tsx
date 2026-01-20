
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
        setRecords(validRecords);
        persistence.set('food_coop_data', JSON.stringify(validRecords));
      }
      setLastSyncTime(new Date());
    } catch (e) {
      console.error("Background sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, [agentIdentity]);

  // Initial load
  useEffect(() => {
    const savedUsers = persistence.get('coop_users');
    if (savedUsers) {
      try { setUsers(JSON.parse(savedUsers)); } catch (e) { }
    }
    
    if (agentIdentity) {
      loadCloudData();
    }
  }, [agentIdentity, loadCloudData]);

  // Background polling
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
      setUsers([]);
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
    
    // Update state immediately (Optimistic)
    const updatedUsers = users.filter(u => u.phone !== phone);
    setUsers(updatedUsers);
    persistence.set('coop_users', JSON.stringify(updatedUsers));
    
    setIsSyncing(true);
    try {
      const success = await deleteUserFromCloud(phone);
      if (success) {
        // Success: ensure local storage is synced with the deletion
        alert("User permanently removed from global registry.");
      } else {
        alert("Cloud deletion failed. The user might reappear during next sync.");
        // Re-fetch to restore correct state if cloud failed
        await loadCloudData();
      }
    } catch (e) {
      console.error("Delete Error:", e);
      await loadCloudData();
    } finally {
      setIsSyncing(false);
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
    
    setRecords(prev => [newRecord, ...prev]);
    
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
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - logFilterDays);
    return filteredRecords.filter(r => {
      const recordDate = new Date(r.date);
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

  const auditPeriodMetrics = useMemo(() => {
    const now = new Date();
    const rLog = filteredRecords;
    const getRange = (days: number) => {
      const cutoff = new Date(now);
      cutoff.setHours(0, 0, 0, 0);
      cutoff.setDate(now.getDate() - days);
      const rangeRecords = rLog.filter(r => {
        const d = new Date(r.date);
        d.setHours(0,0,0,0);
        return d.getTime() >= cutoff.getTime();
      });
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
    startOfMonth.setHours(0,0,0,0);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0,0,0,0);
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

  const updateUserStatus = (phone: string, status: AccountStatus, resetWarnings = false) => {
    const updatedUsers = users.map(u => {
      if (normalizePhone(u.phone) === normalizePhone(phone)) {
        return { ...u, status, warnings: resetWarnings ? 0 : u.warnings };
      }
      return u;
    });
    setUsers(updatedUsers);
    persistence.set('coop_users', JSON.stringify(updatedUsers));
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
    const headers = ["Food Coop Clusters", "Total Volume of Sales (Ksh)", "Total Gross Profit 10% (Ksh)"];
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
