
import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity, AccountStatus } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, CROP_TYPES, GOOGLE_SHEETS_WEBHOOK_URL, GOOGLE_SHEET_VIEW_URL } from './constants.ts';
import { syncToGoogleSheets, fetchFromGoogleSheets, syncUserToCloud, fetchUsersFromCloud, clearAllRecordsOnCloud } from './services/googleSheetsService.ts';

type PortalType = 'SALES' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM';

const CLUSTERS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi'];
const WEEKLY_TARGET = 2;

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

const getWeekKey = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

const getPreviousWeekKey = (date: Date): string => {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 7);
  return getWeekKey(prev);
};

const computeHash = async (record: any): Promise<string> => {
  const msg = `${record.id}-${record.date}-${record.unitsSold}-${record.unitPrice}`;
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

  // Fix: Added missing availablePortals definition using role-based access control
  const availablePortals = useMemo<PortalType[]>(() => {
    if (!agentIdentity) return [];
    
    if (isSystemDev) {
      return ['SALES', 'FINANCE', 'AUDIT', 'BOARD', 'SYSTEM'];
    }

    const portals: PortalType[] = ['SALES'];
    
    if (agentIdentity.role === SystemRole.FINANCE_OFFICER) {
      portals.push('FINANCE');
    } else if (agentIdentity.role === SystemRole.AUDITOR) {
      portals.push('AUDIT');
    } else if (agentIdentity.role === SystemRole.MANAGER) {
      portals.push('FINANCE', 'AUDIT', 'BOARD');
    }
    
    return portals;
  }, [agentIdentity, isSystemDev]);

  const exportToCSV = (records: SaleRecord[]) => {
    // Filter: Exclude 'Unassigned' unless it's Barack James test data
    const filteredRecords = records.filter(r => 
      r.cluster !== 'Unassigned' || 
      r.agentName === 'Barack James' ||
      r.createdBy === 'Barack James'
    );
    
    if (filteredRecords.length === 0) {
      alert("No audit-eligible records found to export.");
      return;
    }

    const headers = [
      'Transaction ID', 'Date', 'Crop Type', 'Unit Type', 
      'Farmer Name', 'Farmer Phone', 'Customer Name', 'Customer Phone', 
      'Agent Name', 'Agent Phone', 'Cluster', 'Units Sold', 'Unit Price', 
      'Total Gross', 'Coop Commission', 'Status', 'Digital Signature'
    ];

    const rows = filteredRecords.map(r => [
      r.id, r.date, r.cropType, r.unitType,
      `"${r.farmerName}"`, r.farmerPhone, `"${r.customerName}"`, r.customerPhone,
      `"${r.agentName || 'System'}"`, r.agentPhone || '', r.cluster || '', r.unitsSold, r.unitPrice,
      r.totalSale, r.coopProfit, r.status, r.signature
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Audit_Report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleLogout = () => {
    setAgentIdentity(null);
    setRecords([]); 
    persistence.remove('agent_session');
    persistence.remove('food_coop_data');
  };

  useEffect(() => {
    const loadCloudData = async () => {
      if (!agentIdentity) return;
      const cloudUsers = await fetchUsersFromCloud();
      if (cloudUsers && cloudUsers.length > 0) {
        persistence.set('coop_users', JSON.stringify(cloudUsers));
      }
      const cloudRecords = await fetchFromGoogleSheets();
      if (Array.isArray(cloudRecords)) {
        setRecords(cloudRecords);
        persistence.set('food_coop_data', JSON.stringify(cloudRecords));
      }
    };
    loadCloudData();
  }, [agentIdentity]); 

  useEffect(() => {
    const saved = persistence.get('food_coop_data');
    if (saved) { try { setRecords(JSON.parse(saved)); } catch (e) { } }
  }, []);

  useEffect(() => {
    if (agentIdentity && records.length >= 0) {
      persistence.set('food_coop_data', JSON.stringify(records));
      persistence.set('agent_session', JSON.stringify(agentIdentity));
    }
  }, [records, agentIdentity]);

  const handleClearRecords = async () => {
    if (window.confirm("CRITICAL PURGE: This will wipe ALL records from cloud and local cache. Proceed?")) {
      try {
        await clearAllRecordsOnCloud();
        setRecords([]);
        localStorage.clear();
        sessionStorage.clear();

        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) { await registration.unregister(); }
        }
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          for (const key of cacheKeys) { await caches.delete(key); }
        }
        alert("System Cleaned. Reloading...");
        window.location.replace(window.location.origin + window.location.pathname);
      } catch (err) {
        window.location.reload();
      }
    }
  };

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
    const coopProfit = totalSale * PROFIT_MARGIN;
    const signature = await computeHash({ ...data, id });
    
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
      cluster: agentIdentity?.cluster || 'Unassigned',
      synced: false
    };
    
    setRecords([newRecord, ...records]);
    
    // Barack James can sync 'Unassigned' records; others cannot
    if (newRecord.cluster !== 'Unassigned' || isSystemDev) {
      const success = await syncToGoogleSheets(newRecord);
      if (success) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
      }
    }
  };

  const filteredRecords = useMemo(() => {
    let base = records;
    if (!isSystemDev) {
      // Normal users only see their own stuff and strictly filtered official records
      const isPriv = agentIdentity?.role === SystemRole.MANAGER || 
                     agentIdentity?.role === SystemRole.FINANCE_OFFICER ||
                     agentIdentity?.role === SystemRole.AUDITOR;
                     
      if (!isPriv) {
        base = base.filter(r => normalizePhone(r.agentPhone || '') === normalizePhone(agentIdentity?.phone || ''));
      }
      // Official audit log for others excludes 'Unassigned'
      base = base.filter(r => r.cluster !== 'Unassigned' || r.agentName === 'Barack James');
    }
    return base;
  }, [records, isSystemDev, agentIdentity]);

  const groupedAndSortedRecords = useMemo(() => {
    const grouped = filteredRecords.reduce((acc, r) => {
      const cluster = r.cluster || 'Unassigned';
      if (!acc[cluster]) acc[cluster] = [];
      acc[cluster].push(r);
      return acc;
    }, {} as Record<string, SaleRecord[]>);
    Object.keys(grouped).forEach(cluster => grouped[cluster].sort((a, b) => (a.agentName || '').localeCompare(b.agentName || '')));
    return grouped;
  }, [filteredRecords]);

  const boardMetrics = useMemo(() => {
    const rLog = records.filter(r => r.cluster !== 'Unassigned' || r.agentName === 'Barack James');
    const performanceMap = rLog.reduce((acc, r) => {
      const label = `${r.cropType} (${r.date})`;
      acc[label] = (acc[label] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    const performanceData: [string, number][] = (Object.entries(performanceMap) as [string, number][]).sort((a, b) => {
      const dateA = a[0].match(/\((.*?)\)/)?.[1] || "";
      const dateB = b[0].match(/\((.*?)\)/)?.[1] || "";
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }).slice(-15);

    const clusterMap = rLog.reduce((acc, r) => {
      const cluster = r.cluster || 'Unassigned';
      acc[cluster] = (acc[cluster] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    const clusterPerformance: [string, number][] = (Object.entries(clusterMap) as [string, number][]).sort((a, b) => b[1] - a[1]);

    const agentMap = rLog.reduce((acc, r) => {
      const agent = r.agentName || 'Unknown Agent';
      acc[agent] = (acc[agent] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    const topAgents: [string, number][] = (Object.entries(agentMap) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { performanceData, clusterPerformance, topAgents };
  }, [records]);

  // Rest of state logic remains identical...
  const stats = useMemo(() => {
    const relevantRecords = filteredRecords;
    const verifiedComm = relevantRecords.filter(r => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingAuditComm = relevantRecords.filter(r => r.status === RecordStatus.VALIDATED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingFinanceComm = relevantRecords.filter(r => r.status === RecordStatus.PAID).reduce((a, b) => a + Number(b.coopProfit), 0);
    const dueComm = relevantRecords.filter(r => r.status === RecordStatus.DRAFT).reduce((a, b) => a + Number(b.coopProfit), 0);
    return { awaitingAuditComm, awaitingFinanceComm, approvedComm: verifiedComm, dueComm };
  }, [filteredRecords]);

  // Auth, UpdateStatus, UI Logic remain same...
  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    const record = records.find(r => r.id === id);
    if (record && (record.cluster !== 'Unassigned' || isSystemDev)) {
      const success = await syncToGoogleSheets({ ...record, status: newStatus });
      if (success) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, synced: true } : r));
      }
    }
  };

  const handleSingleSync = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (!record || (record.cluster === 'Unassigned' && !isSystemDev)) return;
    const success = await syncToGoogleSheets(record);
    if (success) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const targetPhoneRaw = authForm.phone.trim();
    const targetPhoneNormalized = normalizePhone(targetPhoneRaw);
    const targetPasscode = authForm.passcode.replace(/\D/g, '');
    const targetName = authForm.name.trim();
    try {
      const latestCloudUsers = await fetchUsersFromCloud();
      let users: AgentIdentity[] = latestCloudUsers || JSON.parse(persistence.get('coop_users') || '[]');
      if (isRegisterMode) {
        if (!targetName || targetPhoneNormalized.length < 9 || targetPasscode.length !== 4) { alert("Invalid details."); setIsAuthLoading(false); return; }
        const newUser: AgentIdentity = { name: targetName, phone: targetPhoneRaw, passcode: targetPasscode, role: authForm.role, cluster: authForm.role === SystemRole.SYSTEM_DEVELOPER ? 'System' : authForm.cluster, status: 'ACTIVE' };
        users.push(newUser); persistence.set('coop_users', JSON.stringify(users)); await syncUserToCloud(newUser); setAgentIdentity(newUser);
      } else {
        const user = users.find(u => normalizePhone(u.phone) === targetPhoneNormalized && String(u.passcode).replace(/\D/g, '') === targetPasscode);
        if (user) { setAgentIdentity(user); } else { alert("Auth failed."); }
      }
    } catch (err) { alert("System error."); } finally { setIsAuthLoading(false); }
  };

  // UI RENDER START
  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-[#022c22] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl mb-4 border border-emerald-500/30"><i className="fas fa-leaf text-xl"></i></div>
           <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Food Coop Hub</h1>
        </div>
        <div className="w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden z-10 p-8 space-y-5">
            <div className="flex justify-between items-end">
              <h2 className="text-xl font-black text-white uppercase tracking-tight">{isRegisterMode ? 'New Account' : 'Secure Login'}</h2>
              <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-[9px] font-black uppercase text-white/40">{isRegisterMode ? 'Login' : 'Register'}</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && <input type="text" placeholder="Name" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none" />}
              <input type="tel" placeholder="Phone" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white outline-none" />
              <input type="password" maxLength={4} placeholder="••••" value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white text-center outline-none tracking-[1em]" />
              <button disabled={isAuthLoading} className="w-full bg-emerald-500 text-emerald-950 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em]">{isAuthLoading ? '...' : 'Authenticate'}</button>
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
              <h1 className="text-2xl font-black uppercase tracking-tight">Food Coop Hub</h1>
              <p className="text-emerald-400/40 text-[10px] font-black uppercase tracking-[0.3em]">{agentIdentity.role} {isSystemDev ? '(System Developer)' : `(${agentIdentity.cluster})`}</p>
            </div>
          </div>
          <div className="bg-white/5 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/10 text-right shadow-2xl">
            <p className="text-[8px] font-black uppercase text-emerald-300/60">Session: {agentIdentity.name}</p>
            <button onClick={handleLogout} className="text-[9px] font-black uppercase text-emerald-400 hover:text-white mt-1">End Session</button>
          </div>
        </div>
        <div className="container mx-auto px-6 flex flex-wrap gap-2">
          {availablePortals.map(portal => (
            <button key={portal} onClick={() => setCurrentPortal(portal)} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === portal ? 'bg-emerald-500 text-emerald-950 border-emerald-400' : 'bg-white/5 text-emerald-400/60 border-white/5'}`}>{portal} Portal</button>
          ))}
        </div>
      </header>

      <main className="container mx-auto px-6 -mt-8 space-y-10 relative z-20">
        {currentPortal === 'SALES' && <SaleForm onSubmit={handleAddRecord} />}
        
        {isSystemDev && currentPortal === 'SYSTEM' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-emerald-900 p-8 rounded-[2.5rem] border border-emerald-800 text-white flex justify-between items-center">
               <div><h3 className="font-black uppercase">Infrastructure</h3><p className="text-[10px] opacity-50 uppercase mt-1">Direct Cloud Access</p></div>
               <a href={GOOGLE_SHEET_VIEW_URL} target="_blank" className="bg-emerald-500 text-emerald-950 text-[10px] font-black uppercase px-6 py-4 rounded-2xl">Open Sheet</a>
            </div>
            <div className="bg-white p-8 rounded-[2.5rem] border border-red-50 flex justify-between items-center">
               <div><h3 className="font-black uppercase text-red-600">Danger Zone</h3><p className="text-[10px] opacity-50 uppercase mt-1">Nuclear Clear All Records</p></div>
               <button onClick={handleClearRecords} className="bg-red-500 text-white text-[10px] font-black uppercase px-6 py-4 rounded-2xl">Global Clear</button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-8 border-b border-slate-50 flex justify-between items-center">
            <div><h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em]">Audit & Integrity Log</h3></div>
            <button onClick={() => exportToCSV(records)} className="bg-blue-600 text-white text-[10px] font-black uppercase px-6 py-3 rounded-2xl shadow-xl">Download Audit Report</button>
          </div>
          <Table groupedRecords={groupedAndSortedRecords} portal={currentPortal} onStatusUpdate={handleUpdateStatus} onForceSync={handleSingleSync} normalizePhone={normalizePhone} />
        </div>
      </main>
    </div>
  );
};

const Table: React.FC<{ 
  groupedRecords: Record<string, SaleRecord[]>, 
  onStatusUpdate?: (id: string, s: RecordStatus) => void, 
  onForceSync?: (id: string) => void,
  portal?: PortalType,
  normalizePhone: (p: string) => string
}> = ({ groupedRecords, onStatusUpdate, onForceSync, portal, normalizePhone }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left min-w-[1200px]">
      <thead className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest">
        <tr><th className="px-8 py-6">Timestamp</th><th className="px-8 py-6">Participants</th><th className="px-8 py-6">Commodity</th><th className="px-8 py-6">Quantity</th><th className="px-8 py-6">Total Gross</th><th className="px-8 py-6">Status</th><th className="px-8 py-6">Security</th><th className="px-8 py-6 text-center">Action</th></tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {Object.keys(groupedRecords).length === 0 ? (<tr><td colSpan={8} className="px-8 py-20 text-center text-slate-300 uppercase font-black">No records detected</td></tr>) : Object.keys(groupedRecords).map(cluster => (
          <React.Fragment key={cluster}>
            <tr className="bg-slate-50/50"><td colSpan={8} className="px-8 py-3 text-[10px] font-black uppercase text-emerald-600 tracking-widest">{cluster} Cluster</td></tr>
            {groupedRecords[cluster].map(r => (
              <tr key={r.id} className="hover:bg-slate-50/30">
                <td className="px-8 py-6 text-[12px] font-black">{r.date}</td>
                <td className="px-8 py-6">
                  <div className="text-[11px] font-black">{r.farmerName} <span className="text-slate-300">→</span> {r.customerName}</div>
                  <div className="text-[9px] opacity-40 uppercase mt-1">Agent: {r.agentName || 'System'}</div>
                </td>
                <td className="px-8 py-6"><span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black uppercase">{r.cropType}</span></td>
                <td className="px-8 py-6 text-[12px] font-black">{r.unitsSold} {r.unitType}</td>
                <td className="px-8 py-6 text-[13px] font-black">KSh {r.totalSale.toLocaleString()}</td>
                <td className="px-8 py-6"><span className="text-[9px] font-black uppercase px-3 py-1 border rounded-lg">{r.status}</span></td>
                <td className="px-8 py-6"><SecurityBadge record={r} /></td>
                <td className="px-8 py-6 text-center">
                  {portal === 'SALES' && r.status === RecordStatus.DRAFT && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.PAID)} className="bg-emerald-500 text-white text-[9px] font-black px-4 py-2 rounded-xl">Forward</button>)}
                  {portal === 'AUDIT' && r.status === RecordStatus.VALIDATED && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.VERIFIED)} className="bg-emerald-900 text-white text-[9px] font-black px-4 py-2 rounded-xl">Verify</button>)}
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
  <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${synced ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
    {synced ? 'Synced' : 'Local'}
  </div>
);

const SecurityBadge: React.FC<{ record: SaleRecord }> = ({ record }) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  useEffect(() => { computeHash(record).then(h => setIsValid(h === record.signature)); }, [record]);
  if (isValid === null) return <div className="w-2 h-2 rounded-full bg-slate-200"></div>;
  return (
    <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isValid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
      {isValid ? 'Verified' : 'Tampered'}
    </div>
  );
};

export default App;
