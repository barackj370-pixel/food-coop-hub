import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, RecordStatus, CoopStats, UserRole } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { analyzeSalesData } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PROFIT_MARGIN } from './constants.ts';

// Pre-authorized Users
const AUTHORIZED_USERS = ['Barack James', 'Fred Dola', 'CD Otieno'];

// Hardened Persistence - handles blocked cookies/storage in private mode
const persistence = {
  get: (key: string): string | null => {
    try { 
      return localStorage.getItem(key); 
    } catch (e) { 
      console.warn("Storage Get Blocked:", e);
      return null; 
    }
  },
  set: (key: string, val: string) => {
    try { 
      localStorage.setItem(key, val); 
    } catch (e) { 
      console.warn("Storage Set Blocked/Full:", e); 
    }
  }
};

const computeHash = async (record: any): Promise<string> => {
  const msg = `${record.id}-${record.date}-${record.cropType}-${record.unitType}-${record.farmerName}-${record.farmerPhone}-${record.customerName}-${record.customerPhone}-${record.unitsSold}-${record.unitPrice}-${record.createdBy}-${record.agentPhone}-${record.status}-${record.confirmedBy || 'none'}`;
  const cryptoObj = window.crypto || (window as any).msCrypto;
  
  if (!cryptoObj || !cryptoObj.subtle) {
    let hash = 0;
    for (let i = 0; i < msg.length; i++) {
      const char = msg.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `LGC-${Math.abs(hash).toString(16)}`;
  }

  const encoder = new TextEncoder();
  const dataUint8 = encoder.encode(msg);
  try {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', dataUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    return `FBK-${Date.now().toString(16)}`;
  }
};

const generateUUID = (): string => {
  const cryptoObj = window.crypto || (window as any).msCrypto;
  if (cryptoObj && cryptoObj.randomUUID) {
    try { return cryptoObj.randomUUID(); } catch(e) {}
  }
  return 'uuid-' + Math.random().toString(36).substring(2, 10);
};

const ReceiptModal: React.FC<{ record: SaleRecord; onClose: () => void }> = ({ record, onClose }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-10 text-center space-y-4 border-b border-dashed border-slate-200 relative">
          <div className="absolute top-4 right-4">
             <button onClick={onClose} className="text-slate-300 hover:text-slate-500 transition-all"><i className="fas fa-times text-xl"></i></button>
          </div>
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl shadow-inner">
            <i className="fas fa-hand-holding-dollar"></i>
          </div>
          <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Commission Received</h3>
          <p className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">Official Cooperative Receipt</p>
        </div>
        <div className="p-10 space-y-6">
          <div className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400">
             <span>Receipt ID: {record.id.slice(0, 8)}</span>
             <span>{new Date().toLocaleString()}</span>
          </div>
          <div className="bg-slate-50 rounded-3xl p-6 space-y-4 border border-slate-100">
            <div className="flex justify-between items-end border-b border-slate-200 pb-4">
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Commission Amount</p>
                  <p className="text-3xl font-black text-slate-900">KSh {record.coopProfit.toLocaleString()}</p>
               </div>
               <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Sale Basis</p>
                  <p className="text-xs font-black text-slate-800">KSh {record.totalSale.toLocaleString()}</p>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-[11px]">
               <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px]">Field Agent</p>
                  <p className="font-black text-slate-800">{record.createdBy}</p>
               </div>
               <div>
                  <p className="font-bold text-slate-400 uppercase text-[9px]">Accounts Officer</p>
                  <p className="font-black text-blue-600">{record.confirmedBy}</p>
               </div>
            </div>
          </div>
          <div className="pt-2 text-center">
            <p className="text-[8px] font-mono text-slate-400 break-all leading-tight px-4">
              Immutable Trust Signature: {record.signature}
            </p>
          </div>
          <button onClick={onClose} className="w-full bg-slate-900 hover:bg-black text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95">Done & Dismiss</button>
        </div>
      </div>
    </div>
  );
};

const IdentityModal: React.FC<{ currentName: string; currentPhone: string; currentRole: string; onSave: (name: string, phone: string, role: string) => void; onClose: () => void; }> = ({ currentName, currentPhone, currentRole, onSave, onClose }) => {
  const [name, setName] = useState(currentName);
  const [phone, setPhone] = useState(currentPhone);
  const [role, setRole] = useState(currentRole);
  useEffect(() => { if (name === 'CD Otieno') setPhone('0721609699'); }, [name]);
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-8 bg-emerald-950 text-white flex justify-between items-center">
          <div><h3 className="text-xl font-black uppercase tracking-widest">System Access</h3><p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Credentials Terminal</p></div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-8 space-y-6">
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label><input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none" /></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label><input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none" /></div>
          <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Role</label><select value={role} onChange={(e) => setRole(e.target.value)} className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-emerald-500/10 outline-none appearance-none"><option value="agent">Field Agent</option><option value="accounts">Accounts Office</option><option value="analyst">Data Analyst</option><option value="management">Board Director</option><option value="developer">System Developer</option></select></div>
          <div className="pt-4 flex gap-4"><button onClick={onClose} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancel</button><button onClick={() => onSave(name, phone, role)} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">Authorize</button></div>
        </div>
      </div>
    </div>
  );
};

const AuditModal: React.FC<{ record: SaleRecord; onClose: () => void }> = ({ record, onClose }) => {
  const [currentHash, setCurrentHash] = useState<string>('');
  useEffect(() => { computeHash(record).then(setCurrentHash); }, [record]);
  const isSafe = currentHash === record.signature;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className={`p-8 ${isSafe ? 'bg-emerald-600' : 'bg-red-600'} text-white flex justify-between items-start`}>
          <div><h3 className="text-2xl font-black uppercase tracking-tight flex items-center"><i className={`fas ${isSafe ? 'fa-shield-check' : 'fa-triangle-exclamation'} mr-3`}></i>Security Audit Report</h3><p className="text-white/80 text-[10px] font-black uppercase tracking-[0.2em] mt-1">Initial Sign: {record.createdBy} | Confirmation: {record.confirmedBy || 'Pending'}</p></div>
          <button onClick={onClose} className="bg-black/20 hover:bg-black/40 w-10 h-10 rounded-full flex items-center justify-center transition-all"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Original Signed Manifest</h4>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono text-[10px] text-slate-600 space-y-1"><p>Status: {record.status}</p><p>Farmer: {record.farmerName} ({record.farmerPhone})</p><p>Customer: {record.customerName} ({record.customerPhone})</p><p>Value: KSh {record.totalSale.toLocaleString()}</p></div>
              <div className="p-4 bg-slate-950 rounded-xl"><p className="text-[8px] font-black text-slate-500 uppercase mb-2">Immutable Signature</p><p className="text-[9px] font-mono text-emerald-400 break-all">{record.signature}</p></div>
            </div>
            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Live System State</h4>
              <div className={`p-4 rounded-2xl border font-mono text-[10px] space-y-1 ${isSafe ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-200 text-red-700'}`}><p>Status: {record.status}</p><p>Farmer: {record.farmerName} ({record.farmerPhone})</p><p>Customer: {record.customerName} ({record.customerPhone})</p><p>Value: KSh {record.totalSale.toLocaleString()}</p></div>
              <div className={`p-4 rounded-xl ${isSafe ? 'bg-slate-950' : 'bg-red-950 border border-red-800'}`}><p className="text-[8px] font-black text-slate-500 uppercase mb-2">Real-time Checksum</p><p className={`text-[9px] font-mono break-all ${isSafe ? 'text-emerald-400' : 'text-red-400 font-black'}`}>{currentHash}</p></div>
            </div>
          </div>
          <div className="pt-4 flex justify-end"><button onClick={onClose} className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all">Close Audit</button></div>
        </div>
      </div>
    </div>
  );
};

const SecurityCheckBadge: React.FC<{ record: SaleRecord; onClick?: () => void }> = ({ record, onClick }) => {
  const [isSafe, setIsSafe] = useState<boolean | null>(null);
  const verify = async () => {
    const rehashed = await computeHash(record);
    setIsSafe(rehashed === record.signature);
  };
  useEffect(() => { verify(); }, [record]);
  if (isSafe === null) return <i className="fas fa-circle-notch fa-spin text-slate-300 text-[10px]"></i>;
  return (
    <button onClick={onClick} className={`flex items-center space-x-1.5 px-2 py-1 rounded-md border transition-all duration-500 ${isSafe ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-200 text-red-600 animate-pulse'}`}>
      <i className={`fas ${isSafe ? 'fa-check-circle' : 'fa-shield-virus'} text-[10px]`}></i>
      <span className="text-[9px] font-black uppercase tracking-tighter">{isSafe ? 'Secure' : 'Tampered'}</span>
    </button>
  );
};

const getWeekNumber = (d: Date) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'sales' | 'finance' | 'analyst' | 'management'>('sales');
  const [auditRecord, setAuditRecord] = useState<SaleRecord | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<SaleRecord | null>(null);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [showValidatedLedger, setShowValidatedLedger] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const [userName, setUserName] = useState<string>(() => persistence.get('coop_user_name') || 'Field Agent');
  const [userPhone, setUserPhone] = useState<string>(() => persistence.get('coop_user_phone') || '0700000000');
  const [userRole, setUserRole] = useState<string>(() => persistence.get('coop_user_role') || 'agent');
  
  const isPrivilegedUser = AUTHORIZED_USERS.includes(userName);
  const isDeveloper = userRole === 'developer' || isPrivilegedUser;
  
  const canAccessSales = isDeveloper || userRole === 'agent' || userRole === 'analyst' || userRole === 'management';
  const canAccessFinance = isDeveloper || userRole === 'accounts' || userRole === 'analyst' || userRole === 'management';
  const canAccessIntegrity = isDeveloper || userRole === 'analyst' || userRole === 'management';
  const canAccessBoard = isDeveloper || userRole === 'management';

  useEffect(() => {
    if (userRole === 'accounts' && !isDeveloper && activeTab !== 'finance') setActiveTab('finance');
    else if (userRole === 'agent' && !isDeveloper && activeTab !== 'sales') setActiveTab('sales');
  }, [userRole, isDeveloper]);

  useEffect(() => {
    const saved = persistence.get('food_coop_data');
    if (saved) { 
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecords(parsed);
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    setIsSyncing(true);
    persistence.set('food_coop_data', JSON.stringify(records));
    persistence.set('coop_user_name', userName);
    persistence.set('coop_user_phone', userPhone);
    persistence.set('coop_user_role', userRole);
    const timer = setTimeout(() => setIsSyncing(false), 800);
    return () => clearTimeout(timer);
  }, [records, userName, userPhone, userRole]);

  const handleSaveIdentity = (newName: string, newPhone: string, newRole: string) => {
    setUserName(newName);
    setUserPhone(newPhone);
    if (AUTHORIZED_USERS.includes(newName)) {
      if (newName === 'CD Otieno') setUserRole('management');
      else if (newName === 'Barack James') setUserRole('developer');
      else if (newName === 'Fred Dola') setUserRole('analyst');
    } else setUserRole(newRole);
    setIsIdentityModalOpen(false);
  };

  const handleAddRecord = async (data: any) => {
    const id = generateUUID();
    const totalSale = data.unitsSold * data.unitPrice;
    const coopProfit = totalSale * PROFIT_MARGIN;
    const recordToSign = { ...data, id, createdBy: userName, agentPhone: userPhone, status: RecordStatus.DRAFT };
    const signature = await computeHash(recordToSign);
    const newRecord: SaleRecord = { ...data, id, totalSale, coopProfit, status: RecordStatus.DRAFT, signature, createdAt: new Date().toISOString(), createdBy: userName, agentPhone: userPhone };
    setRecords([newRecord, ...records]);
  };

  const handleConfirmPayment = async (id: string) => {
    const updated = await Promise.all(records.map(async r => {
      if (r.id === id) {
        const nextState = { ...r, status: RecordStatus.PAID, confirmedBy: userName };
        const confirmedRecord = { ...nextState, signature: await computeHash(nextState) };
        setSelectedReceipt(confirmedRecord); 
        return confirmedRecord;
      }
      return r;
    }));
    setRecords(updated);
  };

  const handleFinalVerify = async (id: string) => {
    const updated = await Promise.all(records.map(async r => {
      if (r.id === id) {
        const nextState = { ...r, status: RecordStatus.VALIDATED };
        return { ...nextState, signature: await computeHash(nextState) };
      }
      return r;
    }));
    setRecords(updated);
  };

  // --- Context-Aware Stats Logic ---
  const stats = useMemo(() => {
    // 1. Calculate GLOBAL stats for management/all-time views
    let tSales = 0, tFinalizedProfit = 0, tUnits = 0, vCount = 0;
    records.forEach(r => {
      tSales += r.totalSale;
      tUnits += r.unitsSold;
      if (r.status === RecordStatus.VALIDATED) {
        tFinalizedProfit += r.coopProfit;
        vCount += 1;
      }
    });

    const global = {
      totalSales: tSales,
      finalizedProfit: tFinalizedProfit,
      totalUnits: tUnits,
      countValidated: vCount,
      avgUnitPrice: tUnits > 0 ? tSales / tUnits : 0
    };

    // 2. Calculate RECENT stats for current entry focus
    const latest = records[0];
    const recent = latest ? {
      totalSales: latest.totalSale,
      finalizedProfit: tFinalizedProfit, // Commission card ALWAYS shows global finalized total
      totalUnits: latest.unitsSold,
      countValidated: vCount,
      avgUnitPrice: latest.unitPrice
    } : { totalSales: 0, finalizedProfit: tFinalizedProfit, totalUnits: 0, countValidated: vCount, avgUnitPrice: 0 };

    // 3. Decide which to return based on active tab
    const isDashboardContext = activeTab === 'sales' || activeTab === 'finance';
    return isDashboardContext ? recent : global;
  }, [records, activeTab]);

  const chartData = useMemo(() => {
    const crops: Record<string, number> = {};
    records.forEach(r => { crops[r.cropType] = (crops[r.cropType] || 0) + r.totalSale; });
    return Object.entries(crops).map(([name, value]) => ({ name, value }));
  }, [records]);

  const exportToExcel = () => {
    const validated = [...records]
      .filter(r => r.status === RecordStatus.VALIDATED)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (validated.length === 0) { alert("No records to export."); return; }

    const csvRows: any[][] = [["Date", "Crop", "Qty (Unit)", "Total Sales", "Coop Comm (10%)"]];
    let currentMonthStr = "";
    let monthTotalSales = 0;
    let monthTotalComm = 0;

    validated.forEach((r, idx) => {
      const dateObj = new Date(r.date);
      const mStr = dateObj.toLocaleString('default', { month: 'long', year: 'numeric' });

      if (mStr !== currentMonthStr) {
        if (idx > 0) {
          csvRows.push(["", "", `TOTAL FOR ${currentMonthStr.toUpperCase()}`, monthTotalSales.toFixed(2), monthTotalComm.toFixed(2)]);
          csvRows.push(["", "", "", "", ""]); 
          monthTotalSales = 0;
          monthTotalComm = 0;
        }
        currentMonthStr = mStr;
        csvRows.push([`--- ${mStr.toUpperCase()} ---`, "", "", "", ""]);
      }

      csvRows.push([r.date, r.cropType, `${r.unitsSold} ${r.unitType}`, r.totalSale, r.coopProfit]);
      monthTotalSales += r.totalSale;
      monthTotalComm += r.coopProfit;

      if (idx === validated.length - 1) {
        csvRows.push(["", "", `TOTAL FOR ${currentMonthStr.toUpperCase()}`, monthTotalSales.toFixed(2), monthTotalComm.toFixed(2)]);
      }
    });

    const csvContent = csvRows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
    link.download = `Ledger_Export_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const roleLabel = userName === 'CD Otieno' ? 'Senior Director' : userName === 'Barack James' ? 'System Developer' : userName === 'Fred Dola' ? 'Data Analyst' : userRole === 'accounts' ? 'Accounts Office' : userRole === 'analyst' ? 'Data Analyst' : userRole === 'management' ? 'Coop Director' : userRole === 'developer' ? 'System Developer' : 'Field Agent';

  const isRecentView = activeTab === 'sales' || activeTab === 'finance';

  return (
    <div className="min-h-screen pb-12 bg-[#F8FAFC]">
      {auditRecord && <AuditModal record={auditRecord} onClose={() => setAuditRecord(null)} />}
      {selectedReceipt && <ReceiptModal record={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
      {isIdentityModalOpen && <IdentityModal currentName={userName} currentPhone={userPhone} currentRole={userRole} onSave={handleSaveIdentity} onClose={() => setIsIdentityModalOpen(false)} />}
      
      <header className="bg-emerald-950 text-white py-6 shadow-2xl sticky top-0 z-50 border-b border-white/10 backdrop-blur-md">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-5">
            <div className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-colors ${userName === 'CD Otieno' ? 'bg-indigo-500' : 'bg-emerald-500'}`}><i className={`fas ${userName === 'CD Otieno' ? 'fa-user-tie' : isDeveloper ? 'fa-shield-halved' : 'fa-leaf'} text-white text-3xl`}></i></div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-black tracking-tight uppercase">Food Coop Hub</h1>
                <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 transition-opacity duration-500 ${isSyncing ? 'opacity-50' : 'opacity-100'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/60">{isSyncing ? 'Securing Ledger...' : 'Ledger Secured'}</span>
                </div>
              </div>
              <div className="mt-1 flex items-center space-x-2"><p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">{roleLabel}</p><span className="text-white/20">|</span><p className="text-white font-bold text-xs">{userName}</p></div>
            </div>
          </div>
          <nav className="flex space-x-1 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {canAccessSales && <button onClick={() => setActiveTab('sales')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sales' ? 'bg-emerald-500 text-white shadow-lg' : 'text-emerald-400 hover:bg-white/5'}`}>Sales Portal</button>}
            {canAccessFinance && <button onClick={() => setActiveTab('finance')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'finance' ? 'bg-blue-500 text-white shadow-lg' : 'text-blue-400 hover:bg-white/5'}`}>Finance Desk</button>}
            {canAccessIntegrity && <button onClick={() => setActiveTab('analyst')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analyst' ? 'bg-amber-500 text-white shadow-lg' : 'text-amber-400 hover:bg-white/5'}`}>Integrity Portal</button>}
            {canAccessBoard && <button onClick={() => setActiveTab('management')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'management' ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-400 hover:bg-white/5'}`}>Board View</button>}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 mt-8 max-w-7xl">
        <div className="mb-10 p-5 rounded-3xl border bg-white border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${isDeveloper ? 'bg-slate-900' : userRole === 'management' ? 'bg-indigo-600' : userRole === 'accounts' ? 'bg-blue-600' : 'bg-emerald-600'}`}><i className={`fas ${isDeveloper ? 'fa-code' : userRole === 'management' ? 'fa-user-tie' : userRole === 'accounts' ? 'fa-cash-register' : 'fa-user'} text-xl`}></i></div>
            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Authenticated Session</p><p className="text-sm font-black text-slate-800 uppercase tracking-tight">{userName} • {userPhone}</p></div>
          </div>
          <button onClick={() => setIsIdentityModalOpen(true)} className="w-full sm:w-auto px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-white transition-all shadow-sm">Switch Identity</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard label={isRecentView ? "Recent Revenue" : "Total Revenue"} value={`KSh ${stats.totalSales.toLocaleString()}`} icon="fa-sack-dollar" color="bg-slate-700" />
          <StatCard label="Finalized Commission" value={`KSh ${stats.finalizedProfit.toLocaleString()}`} icon="fa-landmark" color="bg-emerald-600" />
          <StatCard label={isRecentView ? "Recent Units" : "Total Units"} value={stats.totalUnits.toLocaleString()} icon="fa-boxes-stacked" color="bg-blue-600" />
          <StatCard label={isRecentView ? "Unit Price" : "Avg Unit Price"} value={`KSh ${Math.round(stats.avgUnitPrice).toLocaleString()}`} icon="fa-tag" color="bg-indigo-600" />
        </div>

        {activeTab === 'sales' && canAccessSales && (
          <div className="animate-fade-in space-y-10">
             <SaleForm onSubmit={handleAddRecord} />
             <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50/50 border-b font-black text-[11px] uppercase tracking-widest text-slate-400">Local Transaction Log</div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-400 font-black uppercase">
                        <tr><th className="px-8 py-5">Stakeholders</th><th className="px-8 py-5">Commodity</th><th className="px-8 py-5 text-center">Qty</th><th className="px-8 py-5">Total Sales</th><th className="px-8 py-5">Coop Comm(10%)</th><th className="px-8 py-5">Security</th><th className="px-8 py-5 text-right">Approval Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.length === 0 ? (
                          <tr><td colSpan={7} className="px-8 py-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">No records available</td></tr>
                        ) : (
                          records.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-8 py-5">
                                <div className="flex flex-col space-y-2">
                                  <div>
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Farmer</p>
                                    <p className="text-xs font-black text-slate-800">{r.farmerName}</p>
                                    <p className="text-[9px] text-emerald-600 font-bold">{r.farmerPhone}</p>
                                  </div>
                                  <div className="pt-1 border-t border-slate-100">
                                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-tighter">Customer</p>
                                    <p className="text-xs font-black text-slate-800">{r.customerName}</p>
                                    <p className="text-[9px] text-blue-600 font-bold">{r.customerPhone}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-8 py-5"><span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-tight">{r.cropType}</span></td>
                              <td className="px-8 py-5 text-center text-xs font-bold text-slate-600">{r.unitsSold} <span className="text-[10px] font-black text-slate-400 uppercase">{r.unitType}</span></td>
                              <td className="px-8 py-5 text-sm font-black text-slate-900">KSh {r.totalSale.toLocaleString()}</td>
                              <td className="px-8 py-5 font-black text-emerald-700">KSh {r.coopProfit.toLocaleString()}</td>
                              <td className="px-8 py-5"><SecurityCheckBadge record={r} onClick={() => setAuditRecord(r)} /></td>
                              <td className="px-8 py-5 text-right"><span className="text-[10px] font-black uppercase text-slate-400">{r.status}</span></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'finance' && canAccessFinance && (
          <div className="animate-fade-in space-y-12">
             <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-8 bg-blue-900 text-white flex justify-between items-center"><div><h3 className="text-xl font-black uppercase tracking-widest">Finance: Commission Handover</h3><p className="text-[10px] text-blue-200 font-bold uppercase mt-2">Incoming field agent cash handovers (10%)</p></div><i className="fas fa-hand-holding-dollar text-2xl"></i></div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {records.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                    <div key={r.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm">
                      <div className="mb-6"><div className="flex justify-between items-start mb-4"><span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-500 uppercase">{r.cropType}</span><p className="text-lg font-black text-blue-600">KSh {r.coopProfit.toLocaleString()}</p></div><div className="space-y-2 text-[11px] font-bold"><p>Farmer: {r.farmerName}</p><p>Agent: {r.createdBy}</p></div></div>
                      <button onClick={() => handleConfirmPayment(r.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 active:scale-95 transition-all">Confirm Payment</button>
                    </div>
                  ))}
                  {records.filter(r => r.status === RecordStatus.DRAFT).length === 0 && <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-100 rounded-[2rem] text-slate-300 font-black uppercase tracking-widest">No pending handovers</div>}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'analyst' && canAccessIntegrity && (
          <div className="animate-fade-in space-y-10">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-200 flex flex-col md:flex-row gap-8 items-center">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner shrink-0"><i className="fas fa-file-excel"></i></div>
               <div className="flex-1 space-y-2 text-center md:text-left">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Master Trust Ledger</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">Cryptographic validation and bulk export console for auditing.</p>
                  <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start">
                    <button onClick={() => setShowValidatedLedger(!showValidatedLedger)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center"><i className="fas fa-eye mr-2"></i> {showValidatedLedger ? 'Hide Records' : 'View Verified Records'}</button>
                    <button onClick={exportToExcel} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100"><i className="fas fa-download mr-2"></i> Export Master CSV</button>
                  </div>
               </div>
            </div>
            {showValidatedLedger && (
              <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 bg-slate-900 text-white"><h3 className="text-xl font-black uppercase tracking-widest">Verified Commission Ledger</h3></div>
                <div className="overflow-x-auto"><table className="w-full text-left"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-6 py-5">Audit Status</th><th className="px-6 py-5">Details</th><th className="px-6 py-5">Confirmation</th><th className="px-6 py-5 text-right">Action</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {records.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition"><td className="px-6 py-5"><SecurityCheckBadge record={r} onClick={() => setAuditRecord(r)} /></td><td className="px-6 py-5"><p className="text-xs font-black text-slate-800">KSh {r.coopProfit.toLocaleString()} Comm</p><p className="text-[9px] text-slate-400 font-bold uppercase mt-1">{r.date} | {r.cropType}</p></td><td className="px-6 py-5 text-[10px] font-black text-blue-600 uppercase">Received by {r.confirmedBy}</td><td className="px-6 py-5 text-right">{r.status === RecordStatus.VALIDATED ? <span className="text-emerald-600 font-black uppercase text-[10px] bg-emerald-50 px-4 py-2 rounded-lg">Validated</span> : <button onClick={() => handleFinalVerify(r.id)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-600/20 active:scale-95 transition-all">Stamp & Verify</button>}</td></tr>
                  ))}
                </tbody></table></div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'management' && canAccessBoard && (
          <div className="animate-fade-in space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl min-h-[400px]">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-8">Revenue Flow</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} dy={10} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 900, fill: '#64748b' }} />
                        <Tooltip cursor={{ fill: '#f8fafc' }} />
                        <Bar dataKey="value" fill="#6366f1" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="bg-indigo-950 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl overflow-hidden">
                  <div className="space-y-8 relative z-10">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Finalized Commission</p>
                      <p className="text-5xl font-black tracking-tighter">KSh {stats.finalizedProfit.toLocaleString()}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 font-bold text-xs uppercase tracking-widest">
                        <p className="text-indigo-300">Verified Batches: {records.filter(r => r.status === RecordStatus.VALIDATED).length}</p>
                        <p className="text-indigo-300">Total Volume: {records.reduce((acc, r) => acc + r.unitsSold, 0).toLocaleString()} units</p>
                    </div>
                  </div>
                  <div className="mt-8 relative z-10">
                    <p className="text-[9px] italic text-indigo-300">"Trust ledger verified and secured."</p>
                  </div>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-24 text-center pb-12">
        <div className="inline-flex items-center space-x-4 bg-white px-8 py-4 rounded-3xl border border-slate-100 shadow-sm">
          <i className="fas fa-shield-check text-emerald-600 text-sm"></i>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Excel Trust Protocol • v3.3.1</span>
        </div>
      </footer>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }.animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }`}</style>
    </div>
  );
};

export default App;