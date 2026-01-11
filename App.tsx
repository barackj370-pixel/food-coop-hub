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

const exportToCSV = (records: SaleRecord[]) => {
  if (records.length === 0) return;

  const headers = [
    'Transaction ID', 'Date', 'Crop Type', 'Unit Type', 
    'Farmer Name', 'Farmer Phone', 'Customer Name', 'Customer Phone', 
    'Agent Name', 'Agent Phone', 'Cluster', 'Units Sold', 'Unit Price', 
    'Total Gross', 'Coop Commission', 'Status', 'Digital Signature'
  ];

  const rows = records.map(r => [
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

const CloudSyncBadge: React.FC<{ synced?: boolean; onSync?: () => void; showSyncBtn?: boolean }> = ({ synced, onSync, showSyncBtn }) => (
  <div className="flex flex-col items-start space-y-1">
    <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${synced ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-400'}`}>
      <i className={`fas ${synced ? 'fa-cloud-check' : 'fa-cloud-arrow-up'}`}></i>
      <span>{synced ? 'Synced' : 'Local Only'}</span>
    </div>
    {!synced && showSyncBtn && (
      <button 
        onClick={(e) => { e.stopPropagation(); onSync?.(); }}
        className="text-[7px] font-black text-blue-600 hover:text-blue-800 uppercase tracking-tighter bg-blue-50 px-2 py-0.5 rounded border border-blue-100 transition-colors"
      >
        <i className="fas fa-rotate mr-1"></i>Sync Now
      </button>
    )}
  </div>
);

const SecurityBadge: React.FC<{ record: SaleRecord }> = ({ record }) => {
  const [isValid, setIsValid] = useState<boolean | null>(null);
  useEffect(() => {
    computeHash(record).then(h => setIsValid(h === record.signature));
  }, [record]);

  if (isValid === null) return <div className="w-2 h-2 rounded-full bg-slate-200 animate-pulse"></div>;
  return (
    <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${isValid ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600 animate-bounce'}`}>
      <i className={`fas ${isValid ? 'fa-shield-check' : 'fa-triangle-exclamation'}`}></i>
      <span>{isValid ? 'Verified' : 'Tampered'}</span>
    </div>
  );
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

  const handleLogout = () => {
    setAgentIdentity(null);
    setRecords([]); 
    persistence.remove('agent_session');
    persistence.remove('food_coop_data');
  };

  // Synchronize Cloud state as absolute truth
  useEffect(() => {
    const loadCloudData = async () => {
      if (!agentIdentity) return;
      
      const cloudUsers = await fetchUsersFromCloud();
      if (cloudUsers && cloudUsers.length > 0) {
        persistence.set('coop_users', JSON.stringify(cloudUsers));
      }
      
      const cloudRecords = await fetchFromGoogleSheets();
      
      // If we got a valid array (even empty), it's the absolute truth
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
    if (agentIdentity && agentIdentity.role === SystemRole.FIELD_AGENT) {
      const currentWeek = getWeekKey(new Date());
      const lastCheck = agentIdentity.lastCheckWeek || currentWeek;

      if (currentWeek !== lastCheck) {
        const prevWeek = getPreviousWeekKey(new Date());
        const weekSales = records.filter(r => 
          r.agentPhone === agentIdentity.phone && 
          getWeekKey(new Date(r.createdAt)) === prevWeek
        ).length;

        let newWarnings = agentIdentity.warnings || 0;
        let newStatus: AccountStatus = agentIdentity.status || 'ACTIVE';

        if (weekSales < WEEKLY_TARGET) {
          newWarnings += 1;
        }

        if (newWarnings >= 3) {
          newStatus = 'SUSPENDED';
        }

        const updatedIdentity = { 
          ...agentIdentity, 
          warnings: newWarnings, 
          lastCheckWeek: currentWeek, 
          status: newStatus 
        };

        const usersData = persistence.get('coop_users');
        if (usersData) {
          let users: AgentIdentity[] = JSON.parse(usersData);
          const idx = users.findIndex(u => normalizePhone(u.phone) === normalizePhone(agentIdentity.phone));
          if (idx !== -1) {
            users[idx] = updatedIdentity;
            persistence.set('coop_users', JSON.stringify(users));
          }
        }

        setAgentIdentity(updatedIdentity);

        if (newStatus === 'SUSPENDED') {
          alert("Account Suspended: You have received 3 warnings for not meeting weekly targets. Please contact the Director.");
          handleLogout();
        }
      }
    }
  }, [agentIdentity, records]);

  // Persist records to local storage only if an identity is active
  useEffect(() => {
    if (agentIdentity && records.length >= 0) {
      persistence.set('food_coop_data', JSON.stringify(records));
      persistence.set('agent_session', JSON.stringify(agentIdentity));
    }
  }, [records, agentIdentity]);

  const isPrivileged = useMemo(() => {
    if (!agentIdentity) return false;
    return agentIdentity.role === SystemRole.SYSTEM_DEVELOPER || 
           agentIdentity.role === SystemRole.MANAGER || 
           agentIdentity.role === SystemRole.FINANCE_OFFICER ||
           agentIdentity.role === SystemRole.AUDITOR;
  }, [agentIdentity]);

  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER;

  const registeredUsers = useMemo(() => {
    const usersData = persistence.get('coop_users');
    return usersData ? JSON.parse(usersData) as AgentIdentity[] : [];
  }, [isAuthLoading, agentIdentity]);

  const availablePortals = useMemo(() => {
    if (!agentIdentity) return ['SALES'] as PortalType[];
    
    if (agentIdentity.role === SystemRole.SYSTEM_DEVELOPER) {
      return ['SALES', 'FINANCE', 'AUDIT', 'BOARD', 'SYSTEM'] as PortalType[];
    }
    
    switch (agentIdentity.role) {
      case SystemRole.FIELD_AGENT:
        return ['SALES'] as PortalType[];
      case SystemRole.FINANCE_OFFICER:
        return ['FINANCE'] as PortalType[];
      case SystemRole.AUDITOR:
        return ['AUDIT'] as PortalType[];
      case SystemRole.MANAGER: 
        return ['BOARD'] as PortalType[];
      default:
        return ['SALES'] as PortalType[];
    }
  }, [agentIdentity]);

  useEffect(() => {
    if (availablePortals.length > 0 && !availablePortals.includes(currentPortal)) {
      setCurrentPortal(availablePortals[0]);
    }
  }, [availablePortals, currentPortal]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);

    const targetPhoneRaw = authForm.phone.trim();
    const targetPhoneNormalized = normalizePhone(targetPhoneRaw);
    const targetPasscode = authForm.passcode.replace(/\D/g, '');
    const targetName = authForm.name.trim();
    const targetRole = authForm.role;
    const targetCluster = targetRole === SystemRole.SYSTEM_DEVELOPER ? 'System' : authForm.cluster;

    try {
      const latestCloudUsers = await fetchUsersFromCloud();
      let users: AgentIdentity[] = latestCloudUsers || JSON.parse(persistence.get('coop_users') || '[]');

      if (isRegisterMode) {
        if (!targetName || targetPhoneNormalized.length < 9 || targetPasscode.length !== 4) {
          alert("Validation failed: Please check phone number and 4-digit passcode.");
          setIsAuthLoading(false);
          return;
        }
        
        const exists = users.find(u => normalizePhone(u.phone) === targetPhoneNormalized);
        if (exists) {
          alert("Account already exists with this phone number.");
          setIsAuthLoading(false);
          return;
        }

        const newUser: AgentIdentity = { 
          name: targetName, 
          phone: targetPhoneRaw, 
          passcode: targetPasscode, 
          role: targetRole,
          cluster: targetCluster,
          status: 'ACTIVE',
          ...(targetRole === SystemRole.FIELD_AGENT && {
            warnings: 0,
            lastCheckWeek: getWeekKey(new Date())
          })
        };
        
        users.push(newUser);
        persistence.set('coop_users', JSON.stringify(users));
        await syncUserToCloud(newUser);
        setAgentIdentity(newUser);
      } else {
        const user = users.find(u => 
          normalizePhone(u.phone) === targetPhoneNormalized && 
          String(u.passcode).replace(/\D/g, '') === targetPasscode
        );
        
        if (user) {
          if (user.status === 'SUSPENDED') {
            alert("This account is suspended due to target failures. Contact the Director for approval.");
          } else if (user.status === 'AWAITING_ACTIVATION') {
            alert("Director has approved your account. Waiting for System Developer to finalize reactivation.");
          } else {
            setAgentIdentity(user);
          }
        } else {
          alert("Authentication failed. Check details or verify your cloud connection.");
        }
      }
    } catch (err) {
      console.error("Auth Error:", err);
      alert("System Error: Could not verify identity. Please check your internet connection.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
    const record = records.find(r => r.id === id);
    if (record) {
      const success = await syncToGoogleSheets({ ...record, status: newStatus });
      if (success) {
        setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus, synced: true } : r));
      }
    }
  };

  const handleSingleSync = async (id: string) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const success = await syncToGoogleSheets(record);
    if (success) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    }
  };

  const handleClearRecords = async () => {
    if (window.confirm("ULTIMATE NUCLEAR CLEAR: This will force-purge the cloud, destroy ALL local caches, unregister Service Workers, and clear browser caches to banish ghost records permanently. Proceed?")) {
      try {
        // Step 1: Nuclear purge in cloud
        await clearAllRecordsOnCloud();
        
        // Step 2: Immediate local state wipe
        setRecords([]);
        
        // Step 3: Purge ALL local storage keys
        localStorage.clear();

        // Step 4: Purge Service Worker and Cache Storage
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) {
            await registration.unregister();
          }
        }
        
        if ('caches' in window) {
          const cacheKeys = await caches.keys();
          for (const key of cacheKeys) {
            await caches.delete(key);
          }
        }

        alert("System Cleaned: Global Cloud and Local caches destroyed. The app will now reload.");
      } catch (err) {
        console.error("Clear Error:", err);
        alert("Partial Clean complete. Reloading to reset state.");
      } finally {
        // Step 5: Force reload bypass cache
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
      cluster: agentIdentity?.cluster,
      synced: false
    };
    
    setRecords([newRecord, ...records]);
    const success = await syncToGoogleSheets(newRecord);
    if (success) {
      setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    }
  };

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

  const logStats = useMemo(() => {
    const threshold = new Date(Date.now() - logFilterDays * 24 * 60 * 60 * 1000);
    const filtered = records.filter(r => new Date(r.date).getTime() >= threshold.getTime());
    return {
      totalSales: filtered.reduce((sum, r) => sum + Number(r.totalSale), 0),
      totalComm: filtered.filter(r => r.status === RecordStatus.VERIFIED).reduce((sum, r) => sum + Number(r.coopProfit), 0),
      allTimeSales: records.reduce((sum, r) => sum + Number(r.totalSale), 0),
      allTimeComm: records.filter(r => r.status === RecordStatus.VERIFIED).reduce((sum, r) => sum + Number(r.coopProfit), 0),
    };
  }, [records, logFilterDays]);

  const periodicMetrics = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    return {
      monthly: {
        sales: records
          .filter(r => new Date(r.date).getTime() >= startOfMonth.getTime())
          .reduce((sum, r) => sum + Number(r.totalSale), 0),
        comm: records
          .filter(r => r.status === RecordStatus.VERIFIED && new Date(r.date).getTime() >= startOfMonth.getTime())
          .reduce((sum, r) => sum + Number(r.coopProfit), 0),
      },
      weekly: {
        sales: records
          .filter(r => new Date(r.date).getTime() >= startOfWeek.getTime())
          .reduce((sum, r) => sum + Number(r.totalSale), 0),
        comm: records
          .filter(r => r.status === RecordStatus.VERIFIED && new Date(r.date).getTime() >= startOfWeek.getTime())
          .reduce((sum, r) => sum + Number(r.coopProfit), 0),
      }
    };
  }, [records]);

  const stats = useMemo(() => {
    const relevantRecords = records.filter(r => isPrivileged || normalizePhone(r.agentPhone || '') === normalizePhone(agentIdentity?.phone || ''));
    const verifiedComm = relevantRecords.filter(r => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingAuditComm = relevantRecords.filter(r => r.status === RecordStatus.VALIDATED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingFinanceComm = relevantRecords.filter(r => r.status === RecordStatus.PAID).reduce((a, b) => a + Number(b.coopProfit), 0);
    const dueComm = relevantRecords.filter(r => r.status === RecordStatus.DRAFT).reduce((a, b) => a + Number(b.coopProfit), 0);
    
    return { awaitingAuditComm, awaitingFinanceComm, approvedComm: verifiedComm, dueComm };
  }, [records, isPrivileged, agentIdentity]);

  const filteredRecords = useMemo(() => {
    let base = records;
    if (!isPrivileged) base = base.filter(r => normalizePhone(r.agentPhone || '') === normalizePhone(agentIdentity?.phone || ''));
    return base;
  }, [records, isPrivileged, agentIdentity]);

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
    const performanceMap = records.reduce((acc, r) => {
      const label = `${r.cropType} (${r.date})`;
      acc[label] = (acc[label] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    const performanceData: [string, number][] = (Object.entries(performanceMap) as [string, number][]).sort((a, b) => {
      const dateA = a[0].match(/\((.*?)\)/)?.[1] || "";
      const dateB = b[0].match(/\((.*?)\)/)?.[1] || "";
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    }).slice(-15);

    const clusterMap = records.reduce((acc, r) => {
      const cluster = r.cluster || 'Unassigned';
      acc[cluster] = (acc[cluster] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    const clusterPerformance: [string, number][] = (Object.entries(clusterMap) as [string, number][]).sort((a, b) => b[1] - a[1]);

    const agentMap = records.reduce((acc, r) => {
      const agent = r.agentName || 'Unknown Agent';
      acc[agent] = (acc[agent] || 0) + Number(r.coopProfit);
      return acc;
    }, {} as Record<string, number>);
    const topAgents: [string, number][] = (Object.entries(agentMap) as [string, number][])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { performanceData, clusterPerformance, topAgents };
  }, [records]);

  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-[#022c22] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl mb-4 border border-emerald-500/30"><i className="fas fa-leaf text-xl"></i></div>
           <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Food Coop Hub</h1>
           <p className="text-emerald-400/60 text-[9px] font-black uppercase tracking-[0.4em] mt-2 italic">Digital Reporting Platform</p>
        </div>
        <div className="w-full max-w-sm bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in z-10">
          <div className="p-8 space-y-5">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">{isRegisterMode ? 'New Account' : 'Secure Login'}</h2>
                <p className="text-[9px] text-emerald-400/80 font-black uppercase tracking-widest mt-1">Verified Identity Required</p>
              </div>
              <button onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthForm({...authForm, name: '', phone: '', passcode: '', cluster: CLUSTERS[0]})}} className="text-[9px] font-black uppercase text-white/40 hover:text-emerald-400 transition-colors">{isRegisterMode ? 'Login Instead' : 'Register Account'}</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">Full Name</label>
                  <input type="text" required placeholder="e.g. Barack James" value={authForm.name} onChange={(e) => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-white/10" />
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">Phone Number</label>
                <input type="tel" required placeholder="07..." value={authForm.phone} onChange={(e) => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-white/10" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">4-Digit Passcode</label>
                <input type="password" maxLength={4} required placeholder="••••" value={authForm.passcode} onChange={(e) => setAuthForm({...authForm, passcode: e.target.value.replace(/\D/g, '')})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white tracking-[1.2em] text-center focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-white/10" />
              </div>
              {isRegisterMode && (
                <>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">System Role</label>
                    <select value={authForm.role} onChange={(e) => setAuthForm({...authForm, role: e.target.value as SystemRole})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all appearance-none">
                      {Object.values(SystemRole).map(role => (<option key={role} value={role} className="bg-slate-900">{role}</option>))}
                    </select>
                  </div>
                  {authForm.role === SystemRole.FIELD_AGENT && (
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">Assigned Cluster</label>
                      <select value={authForm.cluster} onChange={(e) => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all appearance-none">
                        {CLUSTERS.map(c => (<option key={c} value={c} className="bg-slate-900">{c}</option>))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <button disabled={isAuthLoading} className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-emerald-500/10 active:scale-95 transition-all mt-4">{isAuthLoading ? <i className="fas fa-circle-notch fa-spin"></i> : (isRegisterMode ? 'Create Identity' : 'Authenticate')}</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-[#022c22] text-white pt-10 pb-12 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] translate-x-1/2 -translate-y-1/2"></div>
        <div className="container mx-auto px-6 relative z-10">
          <div className="flex flex-col lg:flex-row justify-between items-start mb-10 gap-6">
            <div className="flex items-center space-x-5">
              <div className="bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center border border-emerald-500/30"><i className="fas fa-leaf text-2xl text-emerald-400"></i></div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Food Coop Hub</h1>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20 tracking-widest">
                    {agentIdentity.role} {agentIdentity.role !== SystemRole.SYSTEM_DEVELOPER ? `(${agentIdentity.cluster})` : ''}
                  </span>
                  {agentIdentity.role === SystemRole.FIELD_AGENT && agentIdentity.warnings && agentIdentity.warnings > 0 && (
                    <div className="flex items-center space-x-1 ml-2">
                      {[...Array(agentIdentity.warnings)].map((_, i) => (
                        <div key={i} className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" title={`Warning ${i+1}`}></div>
                      ))}
                    </div>
                  )}
                  <span className="text-emerald-400/40 text-[10px] font-black uppercase tracking-[0.3em]">Digital Reporting Platform</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/10 text-right w-full lg:w-auto shadow-2xl">
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-emerald-300/60 mb-1">Authenticated: {agentIdentity.name}</p>
              <p className="text-[13px] font-black tracking-tight">{agentIdentity.phone}</p>
              <button onClick={handleLogout} className="text-[9px] font-black uppercase text-emerald-400 hover:text-white mt-1.5 flex items-center justify-end w-full group"><i className="fas fa-user-gear mr-2 text-[8px] opacity-50 group-hover:opacity-100 transition-opacity"></i>End Session</button>
            </div>
          </div>
          <div className="mb-10 flex flex-wrap gap-2 animate-fade-in">
            {availablePortals.map(portal => (
              <button key={portal} onClick={() => setCurrentPortal(portal)} className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === portal ? 'bg-emerald-500 text-emerald-950 border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-emerald-400/60 border-white/5 hover:bg-white/10'}`}>
                <i className={`fas ${portal === 'SALES' ? 'fa-cart-shopping' : portal === 'FINANCE' ? 'fa-chart-line' : portal === 'AUDIT' ? 'fa-shield-halved' : portal === 'BOARD' ? 'fa-users' : 'fa-id-card-clip'} mr-3`}></i>{portal.replace('_', ' ')} Portal
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 -mt-8 space-y-10 relative z-20">
        {currentPortal === 'SALES' && <div className="space-y-10 animate-fade-in"><SaleForm onSubmit={handleAddRecord} /></div>}
        
        {currentPortal === 'FINANCE' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
             <div className="bg-blue-600 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-blue-500">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-[40px] translate-x-1/2 -translate-y-1/2"></div>
                <p className="text-[10px] font-black text-blue-100 uppercase tracking-[0.4em] mb-4">Urgent Actions</p>
                <p className="text-[8px] font-black text-blue-200 uppercase tracking-widest mb-1">Awaiting Finance Approval</p>
                <p className="text-3xl font-black">KSh {stats.awaitingFinanceComm.toLocaleString()}</p>
                <div className="mt-6 pt-6 border-t border-white/10">
                  <span className="text-[9px] font-black uppercase tracking-widest bg-white/10 px-3 py-1 rounded-lg">High Visibility Queue</span>
                </div>
             </div>
          </div>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-10 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden border border-emerald-800">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-[40px] translate-x-1/2 -translate-y-1/2"></div>
                   <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-4">Verification Desk</p>
                   <p className="text-[8px] font-black text-emerald-400/40 uppercase tracking-widest mb-1">Awaiting Auditor's Stamp</p>
                   <p className="text-3xl font-black">KSh {stats.awaitingAuditComm.toLocaleString()}</p>
                   <div className="mt-6 pt-6 border-t border-white/5">
                      <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-lg">Audit Verification Required</span>
                   </div>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <div className="flex items-center justify-between mb-8">
                 <div>
                   <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Audit Controls</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Universal System Integrity Oversight</p>
                 </div>
                 <button onClick={() => exportToCSV(records)} className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase px-6 py-3 rounded-2xl shadow-xl active:scale-95 transition-all">
                   <i className="fas fa-file-csv mr-2"></i>Download Audit Report
                 </button>
               </div>
             </div>
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <div className="flex items-center justify-between mb-8">
                 <div>
                   <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Agent Re-instatement</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Approve suspended agents for activation</p>
                 </div>
                 <div className="flex items-center space-x-3">
                    <button onClick={() => exportToCSV(records)} className="bg-emerald-900 hover:bg-black text-white text-[10px] font-black uppercase px-6 py-3 rounded-2xl shadow-xl active:scale-95 transition-all">
                      <i className="fas fa-file-csv mr-2 text-emerald-400"></i>Download Audit Report
                    </button>
                    <i className="fas fa-user-shield text-slate-200 text-2xl"></i>
                 </div>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                     <tr><th className="px-6 py-4">Agent Name</th><th className="px-6 py-4">Cluster</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Action</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {registeredUsers.filter(u => u.status === 'SUSPENDED').length === 0 ? (
                       <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-300 font-bold uppercase text-[10px]">No suspended agents found</td></tr>
                     ) : registeredUsers.filter(u => u.status === 'SUSPENDED').map(user => (
                       <tr key={user.phone}>
                         <td className="px-6 py-4 text-[12px] font-black text-slate-900">{user.name}</td>
                         <td className="px-6 py-4 text-[11px] font-bold text-slate-400">{user.cluster}</td>
                         <td className="px-6 py-4"><span className="px-3 py-1 bg-red-50 text-red-500 rounded-lg text-[9px] font-black uppercase">Suspended</span></td>
                         <td className="px-6 py-4 text-center">
                           <button onClick={() => updateUserStatus(user.phone, 'AWAITING_ACTIVATION')} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-md">Approve Activation</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Commodity Performance</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Commission Yield Analysis</p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[350px] flex items-end justify-between pl-24 pr-6 pb-20 pt-8 relative bg-slate-50/20 rounded-[2rem] border border-slate-100/50 overflow-visible">
                    <div className="absolute inset-0 pl-24 pr-6 pb-20 pt-8 pointer-events-none flex flex-col justify-between">
                      {[1, 0.75, 0.5, 0.25, 0].map((_, i) => (
                        <div key={i} className="w-full border-t border-slate-200/60 h-0 first:border-t-0"></div>
                      ))}
                    </div>
                    {boardMetrics.performanceData.length === 0 ? (<div className="absolute inset-0 flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No data</div>) : (
                      <>{(() => {
                        const maxVal = Math.max(...boardMetrics.performanceData.map(d => Number(d[1])), 1);
                        const intervals = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];
                        return intervals.map((val, idx) => (
                          <div key={idx} className="absolute left-2 text-[8px] font-black text-slate-400 pointer-events-none whitespace-nowrap" style={{ bottom: `calc(80px + ${(100 - (Number(idx) * 25)) * 0.75}%)`, transform: 'translateY(50%)' }}>
                            KSh {Math.round(val).toLocaleString()}
                          </div>
                        ));
                      })()}{boardMetrics.performanceData.map(([label, value]) => {
                        const maxVal = Math.max(...boardMetrics.performanceData.map(d => Number(d[1])), 1);
                        const heightPercent = (Number(value) / maxVal) * 100;
                        const [crop] = label.split(' (');
                        return (
                          <div key={label} className="flex-1 flex flex-col items-center group relative h-full justify-end px-1.5 z-10">
                            <div className="w-full max-w-[32px] bg-emerald-500 rounded-t-xl transition-all duration-500 group-hover:bg-emerald-600 group-hover:scale-x-105 relative shadow-lg group-hover:shadow-emerald-500/20" style={{ height: `${heightPercent}%` }}>
                              <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-2.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 font-black shadow-2xl whitespace-nowrap transform translate-y-2 group-hover:translate-y-0">
                                <p className="text-emerald-400 text-[8px] mb-1 uppercase tracking-widest">{crop}</p>
                                KSh {Number(value).toLocaleString()}
                              </div>
                            </div>
                            <div className="absolute -bottom-16 flex flex-col items-center transform rotate-45 origin-left mt-4">
                              <span className="text-[7px] font-black text-slate-800 uppercase whitespace-nowrap">{crop}</span>
                            </div>
                          </div>
                        );
                      })}</>
                    )}
                    <div className="absolute -left-20 top-1/2 -rotate-90 text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] pointer-events-none whitespace-nowrap">Revenue (KSh)</div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden h-full">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-[40px] translate-x-1/2 -translate-y-1/2"></div>
                    <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-4">Integrity Snapshots</p>
                    <div className="space-y-6">
                      <div>
                        <p className="text-[8px] font-black text-emerald-400/40 uppercase tracking-widest">Monthly Performance</p>
                        <p className="text-2xl font-black leading-none">KSh {periodicMetrics.monthly.sales.toLocaleString()}</p>
                        <p className="text-[10px] font-black text-emerald-400 mt-1 uppercase tracking-widest">Verified Comm: KSh {periodicMetrics.monthly.comm.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-black text-emerald-400/40 uppercase tracking-widest">Weekly Performance</p>
                        <p className="text-2xl font-black leading-none">KSh {periodicMetrics.weekly.sales.toLocaleString()}</p>
                        <p className="text-[10px] font-black text-emerald-400 mt-1 uppercase tracking-widest">Verified Comm: KSh {periodicMetrics.weekly.comm.toLocaleString()}</p>
                      </div>
                      <div className="pt-6 border-t border-white/5">
                        <div className="flex items-center space-x-2">
                           <i className="fas fa-circle-check text-emerald-400 text-[10px]"></i>
                           <span className="text-[9px] font-black uppercase tracking-widest">Coop Status: Optimal</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Cluster Yield Analysis</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Regional Commission Contribution</p>
                    </div>
                  </div>
                  <div className="flex-1 min-h-[300px] flex items-end justify-around px-10 pb-16 pt-8 relative bg-slate-50/20 rounded-[2rem] border border-slate-100/50 overflow-visible">
                    {boardMetrics.clusterPerformance.length === 0 ? (<div className="absolute inset-0 flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest">No data</div>) : (
                      boardMetrics.clusterPerformance.map(([cluster, value]) => {
                        const maxVal = Math.max(...boardMetrics.clusterPerformance.map(d => Number(d[1])), 1);
                        const heightPercent = (Number(value) / maxVal) * 100;
                        return (
                          <div key={cluster} className="flex flex-col items-center group relative h-full justify-end px-4 w-full max-w-[100px] z-10">
                            <div className="w-full bg-blue-600 rounded-t-xl transition-all duration-500 group-hover:bg-blue-700 group-hover:scale-x-105 relative shadow-lg group-hover:shadow-blue-500/20" style={{ height: `${heightPercent}%` }}>
                              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-2 rounded-xl opacity-0 group-hover:opacity-100 transition-all duration-300 z-50 font-black shadow-2xl whitespace-nowrap">KSh {Number(value).toLocaleString()}</div>
                            </div>
                            <div className="absolute -bottom-10 flex flex-col items-center"><span className="text-[9px] font-black text-slate-800 uppercase whitespace-nowrap">{cluster}</span></div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-10">
                    <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Agent Leaderboard</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Top 5 Performers by Commission</p>
                    </div>
                    <i className="fas fa-trophy text-amber-500 text-xl"></i>
                  </div>
                  <div className="space-y-6 flex-1 flex flex-col justify-center">
                    {boardMetrics.topAgents.length === 0 ? (<div className="text-center text-slate-300 font-black uppercase text-[10px] tracking-widest py-10">No performance data</div>) : (
                      boardMetrics.topAgents.map(([name, value], idx) => {
                        const maxVal = Math.max(...boardMetrics.topAgents.map(d => Number(d[1])), 1);
                        const widthPercent = (Number(value) / maxVal) * 100;
                        return (
                          <div key={name} className="space-y-2">
                            <div className="flex justify-between items-end">
                              <div className="flex items-center space-x-3">
                                <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 text-slate-600' : idx === 2 ? 'bg-orange-100 text-orange-600' : 'bg-slate-50 text-slate-400'}`}>{idx + 1}</span>
                                <span className="text-[12px] font-black text-slate-800 uppercase tracking-tight">{name}</span>
                              </div>
                              <span className="text-[11px] font-black text-slate-500">KSh {Number(value).toLocaleString()}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-50 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]" style={{ width: `${widthPercent}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
             </div>
          </div>
        )}

        {isSystemDev && currentPortal === 'SYSTEM' && (
          <div className="space-y-10 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-900 p-8 rounded-[2.5rem] border border-emerald-800 shadow-xl flex items-center justify-between">
                   <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Cloud Infrastructure</h3>
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-1">Direct access to the Google Sheets engine</p>
                   </div>
                   <a href={GOOGLE_SHEET_VIEW_URL} target="_blank" rel="noopener noreferrer" className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-[10px] font-black uppercase px-6 py-4 rounded-2xl shadow-xl active:scale-95 transition-all">
                     <i className="fas fa-table mr-2"></i>Open Cloud
                   </a>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-red-50 shadow-xl flex items-center justify-between">
                   <div>
                      <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">System Maintenance</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Danger Zone: Purge ALL cross-device audit history</p>
                   </div>
                   <button onClick={handleClearRecords} className="bg-red-500 hover:bg-red-600 text-white text-[10px] font-black uppercase px-6 py-4 rounded-2xl shadow-xl active:scale-95 transition-all">
                     <i className="fas fa-trash-can mr-2"></i>Global Clear
                   </button>
                </div>
             </div>

             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl">
               <div className="flex items-center justify-between mb-8">
                 <div>
                   <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Security & Activation</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Final reactivation of approved agents</p>
                 </div>
                 <i className="fas fa-terminal text-slate-200 text-2xl"></i>
               </div>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                     <tr><th className="px-6 py-4">Agent Name</th><th className="px-6 py-4">Phone</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-center">Action</th></tr>
                   </thead>
                   <tbody className="divide-y divide-slate-50">
                     {registeredUsers.filter(u => u.status === 'AWAITING_ACTIVATION').length === 0 ? (
                       <tr><td colSpan={4} className="px-6 py-10 text-center text-slate-300 font-bold uppercase text-[10px]">No pending reactivations</td></tr>
                     ) : registeredUsers.filter(u => u.status === 'AWAITING_ACTIVATION').map(user => (
                       <tr key={user.phone}>
                         <td className="px-6 py-4 text-[12px] font-black text-slate-900">{user.name}</td>
                         <td className="px-6 py-4 text-[11px] font-bold text-slate-500">{user.phone}</td>
                         <td className="px-6 py-4"><span className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-[9px] font-black uppercase">Awaiting Activation</span></td>
                         <td className="px-6 py-4 text-center">
                           <button onClick={() => updateUserStatus(user.phone, 'ACTIVE', true)} className="bg-slate-900 hover:bg-black text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl shadow-md">Final Reactivate</button>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                   <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden h-full">
                     <div className="p-8 border-b border-slate-50 bg-slate-50/10"><h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Global Identity Registry</h3><p className="text-[9px] font-bold text-slate-400 uppercase mt-1">All Authenticated System Accounts</p></div>
                     <div className="overflow-x-auto">
                        <table className="w-full text-left">
                          <thead className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest"><tr><th className="px-8 py-4">Full Name</th><th className="px-8 py-4">Role</th><th className="px-8 py-4">Warnings</th><th className="px-8 py-4">Status</th><th className="px-8 py-4">Phone</th></tr></thead>
                          <tbody className="divide-y divide-slate-50">{registeredUsers.map((user, idx) => (<tr key={idx} className="hover:bg-slate-50 transition-colors"><td className="px-8 py-4 text-[12px] font-black text-slate-900">{user.name}</td><td className="px-8 py-4"><span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase">{user.role}</span></td><td className="px-8 py-4 text-[12px] font-bold text-red-500">{user.role === SystemRole.FIELD_AGENT ? (user.warnings || 0) : '—'}</td><td className="px-8 py-4"><span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${user.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>{user.status}</span></td><td className="px-8 py-4 text-[12px] font-bold text-slate-500">{user.phone}</td></tr>))}</tbody>
                        </table>
                     </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-fade-in">
          <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em]">Audit & Integrity Log</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Universal Integrity Audit</p>
            </div>
            <div className="flex flex-wrap items-center gap-6 bg-slate-50 px-6 py-4 rounded-2xl border border-slate-100">
               <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/50">
                 {[7, 14, 21, 30].map(d => (
                   <button key={d} onClick={() => setLogFilterDays(d)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${logFilterDays === d ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>{d} Days</button>
                 ))}
               </div>
               <div className="flex gap-6">
                 <div className="flex flex-col"><span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">{logFilterDays} Days Gross</span><span className="text-[12px] font-black text-slate-900 leading-none mt-0.5">KSh {logStats.totalSales.toLocaleString()}</span></div>
                 <div className="flex flex-col"><span className="text-[7px] font-black text-emerald-500/60 uppercase tracking-widest">{logFilterDays} Days Verified Comm.</span><span className="text-[12px] font-black text-emerald-600 leading-none mt-0.5">KSh {logStats.totalComm.toLocaleString()}</span></div>
               </div>
            </div>
          </div>
          <Table groupedRecords={groupedAndSortedRecords} portal={currentPortal} onStatusUpdate={handleUpdateStatus} onForceSync={handleSingleSync} normalizePhone={normalizePhone} />
        </div>
      </main>
      <footer className="mt-20 text-center pb-12"><p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Agricultural Trust Network • v4.2.1</p></footer>
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
      <thead className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]"><tr><th className="px-8 py-6">Timestamp</th><th className="px-8 py-6">Participants</th><th className="px-8 py-6">Commodity</th><th className="px-8 py-6">Quantity</th><th className="px-8 py-6">Unit Price</th><th className="px-8 py-6">Total Gross</th><th className="px-8 py-6 text-emerald-600">Profit (10%)</th><th className="px-8 py-6">Backup</th><th className="px-8 py-6">Security</th><th className="px-8 py-6 text-center">Status</th><th className="px-8 py-6 text-center">Action</th></tr></thead>
      <tbody className="divide-y divide-slate-50">
        {Object.keys(groupedRecords).length === 0 ? (<tr><td colSpan={11} className="px-8 py-20 text-center text-slate-300 font-black uppercase text-[10px]">No records detected</td></tr>) : Object.keys(groupedRecords).map(cluster => (
          <React.Fragment key={cluster}>
            <tr className="bg-slate-50/50"><td colSpan={11} className="px-8 py-3 text-[10px] font-black uppercase tracking-[0.4em] text-emerald-600 border-y border-slate-100">{cluster} Cluster</td></tr>
            {groupedRecords[cluster].map(r => (
              <tr key={r.id} className="hover:bg-slate-50/30 transition-colors group">
                <td className="px-8 py-6"><div className="flex flex-col"><span className="text-[12px] font-black text-slate-900">{r.date}</span><span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{new Date(r.createdAt).toLocaleTimeString()}</span></div></td>
                <td className="px-8 py-6">
                  <div className="flex flex-col space-y-3 py-2">
                    <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Farmer</p>
                      <p className="text-[11px] font-black text-slate-800 leading-none">{r.farmerName}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{r.farmerPhone}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Customer</p>
                      <p className="text-[11px] font-black text-slate-800 leading-none">{r.customerName}</p>
                      <p className="text-[9px] font-bold text-slate-400 mt-0.5">{r.customerPhone}</p>
                    </div>
                    <div>
                      <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Field Agent</p>
                      <p className="text-[11px] font-black text-emerald-800 leading-none">{r.agentName || 'System'}</p>
                      <p className="text-[9px] font-bold text-emerald-500/60 mt-0.5">{r.agentPhone || 'No ID'}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-6"><span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase">{r.cropType}</span></td>
                <td className="px-8 py-6"><span className="text-[13px] font-black text-slate-900">{r.unitsSold}</span><span className="text-[10px] text-slate-400 ml-2 uppercase font-bold">{r.unitType}</span></td>
                <td className="px-8 py-6 text-[12px] font-bold text-slate-500">KSh {r.unitPrice.toLocaleString()}</td>
                <td className="px-8 py-6 text-[13px] font-black text-slate-900">KSh {r.totalSale.toLocaleString()}</td>
                <td className="px-8 py-6 text-[13px] font-black text-emerald-600 bg-emerald-50/20">KSh {r.coopProfit.toLocaleString()}</td>
                <td className="px-8 py-6"><CloudSyncBadge synced={r.synced} onSync={() => onForceSync?.(r.id)} showSyncBtn={portal === 'SALES'} /></td>
                <td className="px-8 py-6"><SecurityBadge record={r} /></td>
                <td className="px-8 py-6 text-center"><span className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl border shadow-sm ${r.status === RecordStatus.VERIFIED ? 'bg-emerald-900 text-white border-emerald-800' : r.status === RecordStatus.VALIDATED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : r.status === RecordStatus.PAID ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{r.status}</span></td>
                <td className="px-8 py-6 text-center">
                  {portal === 'SALES' && r.status === RecordStatus.DRAFT && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.PAID)} className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md">Forward Finance</button>)}
                  {portal === 'FINANCE' && r.status === RecordStatus.PAID && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.VALIDATED)} className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md">Approve</button>)}
                  {portal === 'AUDIT' && r.status === RecordStatus.VALIDATED && (<button onClick={() => onStatusUpdate?.(r.id, RecordStatus.VERIFIED)} className="bg-emerald-900 hover:bg-black text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md">Verify</button>)}
                </td>
              </tr>
            ))}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  </div>
);

export default App;