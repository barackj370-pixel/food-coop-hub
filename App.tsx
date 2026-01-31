
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SaleRecord, RecordStatus, OrderStatus, SystemRole, AgentIdentity, AccountStatus, MarketOrder, ProduceListing } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import ProduceForm from './components/ProduceForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, GOOGLE_SHEET_VIEW_URL, CLUSTERS } from './constants.ts';
import { 
  syncToGoogleSheets, 
  fetchFromGoogleSheets, 
  fetchUsersFromCloud, 
  syncOrderToCloud,
  fetchOrdersFromCloud,
  syncProduceToCloud,
  fetchProduceFromCloud,
  deleteAllOrdersFromCloud,
  deleteAllRecordsFromCloud,
  deleteAllUsersFromCloud,
  deleteAllProduceFromCloud,
  deleteRecordFromCloud
} from './services/googleSheetsService.ts';
import { supabase } from './services/supabaseClient.ts';
import { signIn, signUp, signOut, getSession } from './services/authService.ts';
import { analyzeSalesData } from './services/geminiService.ts';

type PortalType = 'HOME' | 'NEWS' | 'ABOUT' | 'CONTACT' | 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'LOGIN';
type MarketView = 'CUSTOMER' | 'SUPPLIER' | 'SALES';

const APP_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000000' d='M160 96c0-17.7-14.3-32-32-32H32C14.3 64 0 78.3 0 96s14.3 32 32 32h73.4l57.1 240.1c5.3 22.3 25.3 37.9 48.2 37.9H436c22.9 0 42.9-15.6 48.2-37.9l39.1-164.2c4.2-17.8-7-35.7-24.9-39.9s-35.7 7-39.9 24.9l-33.9 142.2H198.5l-57.1-240c-2.7-11.2-12.7-19-24.1-19H32z'/%3E%3Ccircle fill='%23dc2626' cx='208' cy='448' r='48'/%3E%3Ccircle fill='%23dc2626' cx='416' cy='448' r='48'/%3E%3Cpath fill='%2322c55e' d='M340 120 C 340 120, 260 140, 260 220 C 260 300, 340 320, 340 320 S 420 300, 420 220 C 420 140, 340 120, 340 120 Z' transform='translate(0, -30)'/%3E%3Cpath fill='none' stroke='%2322c55e' stroke-width='12' stroke-linecap='round' d='M340 320 L 340 360' transform='translate(0, -30)'/%3E%3Cpath fill='white' d='M340 150 L 340 290' stroke='white' stroke-width='4' stroke-linecap='round' transform='translate(0, -30)'/%3E%3C/svg%3E";

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

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>([]);
  const [produceListings, setProduceListings] = useState<ProduceListing[]>([]);
  const [users, setUsers] = useState<AgentIdentity[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(null);
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('HOME');
  const [marketView, setMarketView] = useState<MarketView>('CUSTOMER');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncLock = useRef(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: ''
  });

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
      
      if (cloudUsers) setUsers(cloudUsers);
      if (cloudRecords) setRecords(cloudRecords);
      if (cloudOrders) setMarketOrders(cloudOrders);
      if (cloudProduce) setProduceListings(cloudProduce);
    } catch (e) { console.error("Global Sync failed:", e); } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, []);

  useEffect(() => {
    const checkSession = async () => {
      const session = await getSession();
      if (session?.user) {
        const latestUsers = await fetchUsersFromCloud();
        if (latestUsers) {
          const matched = latestUsers.find(u => normalizePhone(u.phone) === normalizePhone(session.user.email?.split('@')[0]));
          if (matched) setAgentIdentity(matched);
        }
      }
    };
    checkSession();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
           const latestUsers = await fetchUsersFromCloud();
           if (latestUsers) {
             const matched = latestUsers.find(u => normalizePhone(u.phone) === normalizePhone(session.user.email?.split('@')[0]));
             if (matched) setAgentIdentity(matched);
           }
        } else if (event === 'SIGNED_OUT') {
           setAgentIdentity(null);
           setCurrentPortal('HOME');
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  useEffect(() => { loadCloudData(); }, [loadCloudData]);

  useEffect(() => {
    const interval = setInterval(() => { loadCloudData(); }, SYNC_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [loadCloudData]);

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
    
    let base = [...loggedInBase];
    if (agentIdentity.role === SystemRole.FINANCE_OFFICER) base.splice(4, 0, 'FINANCE');
    else if (agentIdentity.role === SystemRole.AUDITOR) base.splice(4, 0, 'AUDIT');
    else if (agentIdentity.role === SystemRole.MANAGER) base.splice(4, 0, 'FINANCE', 'AUDIT', 'BOARD');
    return base;
  }, [agentIdentity, isSystemDev]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const targetPhone = normalizePhone(authForm.phone);
    const targetPasscode = normalizePasscode(authForm.passcode);
    try {
      if (isRegisterMode) {
        if (authForm.role !== SystemRole.SYSTEM_DEVELOPER && !authForm.cluster) { 
          alert("Registration Error: Cluster selection is mandatory."); setIsAuthLoading(false); return; 
        }
        const newUser: AgentIdentity = { 
          name: authForm.name.trim(), phone: targetPhone, passcode: targetPasscode, 
          role: authForm.role, cluster: (authForm.role === SystemRole.SYSTEM_DEVELOPER || authForm.role === SystemRole.FINANCE_OFFICER || authForm.role === SystemRole.AUDITOR || authForm.role === SystemRole.MANAGER) ? '-' : (authForm.cluster || 'System'), 
          status: 'ACTIVE' 
        };
        await signUp(newUser);
        alert("Registration Successful!");
        setCurrentPortal('HOME');
      } else {
        await signIn(targetPhone, targetPasscode);
        setCurrentPortal('HOME');
      }
    } catch (err: any) { alert(err.message || "Auth Failed."); } finally { setIsAuthLoading(false); }
  };

  const handleUpdateRecordStatus = async (id: string, newStatus: RecordStatus) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const updated = { ...record, status: newStatus };
    await syncToGoogleSheets(updated);
    await loadCloudData();
  };

  const handleGenerateAudit = async () => {
    setIsAnalyzing(true);
    try {
      const report = await analyzeSalesData(records);
      setAuditReport(report);
    } catch (e) { alert("AI Analysis failed."); } finally { setIsAnalyzing(false); }
  };

  const handlePurge = async (type: 'RECORDS' | 'USERS' | 'ORDERS' | 'PRODUCE') => {
    if (!confirm(`Confirm PURGE of all ${type}? This cannot be undone.`)) return;
    if (type === 'RECORDS') await deleteAllRecordsFromCloud();
    else if (type === 'USERS') await deleteAllUsersFromCloud();
    else if (type === 'ORDERS') await deleteAllOrdersFromCloud();
    else if (type === 'PRODUCE') await deleteAllProduceFromCloud();
    await loadCloudData();
  };

  const handleAddProduce = async (data: any) => {
    const id = 'PRD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    const newProduce: ProduceListing = {
      id, ...data, cluster: agentIdentity?.cluster || 'Mariwa', status: 'AVAILABLE'
    };
    await syncProduceToCloud(newProduce);
    await loadCloudData();
  };

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
    const newRecord: SaleRecord = {
      ...data, id, totalSale, coopProfit: totalSale * PROFIT_MARGIN, 
      status: RecordStatus.DRAFT, signature: 'SIG-' + id,
      createdAt: new Date().toISOString(), agentPhone: agentIdentity?.phone, agentName: agentIdentity?.name,
      cluster: data.cluster || agentIdentity?.cluster || 'Unassigned'
    };
    await syncToGoogleSheets(newRecord);
    await loadCloudData();
  };

  const handlePlaceOrder = async (listing: ProduceListing) => {
    const qty = prompt(`Enter quantity for ${listing.cropType} (${listing.unitType}):`, "1");
    if (!qty) return;
    const order: MarketOrder = {
      id: 'ORD-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: new Date().toISOString().split('T')[0],
      cropType: listing.cropType,
      unitsRequested: parseFloat(qty),
      unitType: listing.unitType,
      customerName: agentIdentity?.name || 'Guest',
      customerPhone: agentIdentity?.phone || '0700000000',
      status: OrderStatus.OPEN,
      agentPhone: '',
      cluster: listing.cluster
    };
    await syncOrderToCloud(order);
    alert("Order recorded. Please proceed to fulfillment.");
    await loadCloudData();
  };

  const stats = useMemo(() => {
    const verified = records.filter(r => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const pending = records.filter(r => r.status !== RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const volume = records.reduce((a, b) => a + Number(b.totalSale), 0);
    return { verified, pending, volume };
  }, [records]);

  const clusterMetrics = useMemo(() => {
    const map: Record<string, { volume: number, profit: number }> = {};
    records.forEach(r => {
      const c = r.cluster || 'Unknown';
      if (!map[c]) map[c] = { volume: 0, profit: 0 };
      map[c].volume += Number(r.totalSale);
      map[c].profit += Number(r.coopProfit);
    });
    return Object.entries(map).sort((a, b) => b[1].profit - a[1].profit);
  }, [records]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20 font-sans">
      <header className="bg-white text-black pt-10 pb-8 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-5 group cursor-pointer" onClick={() => setCurrentPortal('HOME')}>
            <img src={APP_LOGO} alt="KPL Logo" className="w-14 h-14 object-contain group-hover:rotate-12 transition-transform" />
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight leading-none">KPL Food Coop</h1>
              <p className="text-slate-400 text-[9px] font-black uppercase tracking-[0.3em] mt-2">
                {agentIdentity ? `${agentIdentity.name} | ${agentIdentity.role}` : 'Market Hub Access'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex gap-6">
              {['HOME', 'NEWS', 'ABOUT', 'CONTACT'].map((p: any) => (
                <button key={p} onClick={() => setCurrentPortal(p)} className={`text-[10px] font-black uppercase tracking-widest transition-colors ${currentPortal === p ? 'text-black' : 'text-slate-400 hover:text-black'}`}>{p}</button>
              ))}
            </div>
            {agentIdentity ? (
              <button onClick={() => signOut()} className="bg-red-50 text-red-600 px-6 py-3 rounded-2xl font-black uppercase text-[9px] tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all">Logout</button>
            ) : (
              <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all">Login</button>
            )}
          </div>
        </div>
        <nav className="container mx-auto px-6 flex flex-wrap gap-2 mt-8">
          {availablePortals.filter(p => !['HOME', 'ABOUT', 'CONTACT', 'NEWS', 'LOGIN'].includes(p)).map(p => (
            <button key={p} onClick={() => setCurrentPortal(p)} className={`px-6 py-3 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? 'bg-black text-white border-black' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black'}`}>{p}</button>
          ))}
        </nav>
      </header>

      <main className="container mx-auto px-6 mt-12 space-y-12">
        {currentPortal === 'LOGIN' && !agentIdentity && (
          <div className="flex flex-col items-center py-12">
            <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-[3rem] shadow-2xl p-12 space-y-8 animate-in zoom-in-95 duration-500">
              <div className="flex justify-between items-end">
                <h2 className="text-3xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Identity' : 'Secure Entry'}</h2>
                <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="text-[10px] font-black uppercase text-green-600 underline tracking-widest">
                  {isRegisterMode ? 'Back to Login' : 'Create One'}
                </button>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 font-bold outline-none focus:bg-white focus:border-black transition-all" />}
                <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 font-bold outline-none focus:bg-white focus:border-black transition-all" />
                <input type="password" placeholder="Passcode" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-5 font-bold text-center outline-none focus:bg-white focus:border-black transition-all tracking-[1em]" />
                {isRegisterMode && (
                  <div className="grid grid-cols-2 gap-4">
                    <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-slate-5