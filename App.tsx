
import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, RecordStatus, CoopStats, UserRole, UserProfile } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { analyzeSalesData } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { PROFIT_MARGIN, CROP_TYPES } from './constants.ts';

// Pre-authorized Staff - These names are whitelisted for specific roles
const AUTHORIZED_USERS = ['Barack James', 'Fred Dola', 'CD Otieno'];

const CHART_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#f43f5e'];

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
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black uppercase tracking-widest">Official Receipt</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Transaction Verified</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-8 space-y-6">
          <div className="flex justify-between items-end border-b pb-4 border-slate-100">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Receipt ID</p>
              <p className="text-xs font-mono text-slate-600">#{record.id.substring(0, 13)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Date</p>
              <p className="text-xs font-bold text-slate-800">{record.date}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between"><span className="text-xs font-bold text-slate-500">Commodity</span><span className="text-xs font-black text-slate-900 uppercase">{record.cropType}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold text-slate-500">Quantity</span><span className="text-xs font-black text-slate-900">{record.unitsSold} {record.unitType}</span></div>
            <div className="flex justify-between"><span className="text-xs font-bold text-slate-500">Unit Price</span><span className="text-xs font-black text-slate-900">KSh {record.unitPrice.toLocaleString()}</span></div>
            <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm font-black text-slate-400 uppercase">Total Sale</span>
              <span className="text-2xl font-black text-emerald-600 tracking-tighter">KSh {record.totalSale.toLocaleString()}</span>
            </div>
          </div>
          <div className="bg-slate-50 p-4 rounded-2xl space-y-2">
            <div className="flex justify-between items-center"><span className="text-[9px] font-black text-slate-400 uppercase">Farmer</span><span className="text-[10px] font-bold text-slate-800">{record.farmerName}</span></div>
            <div className="flex justify-between items-center"><span className="text-[9px] font-black text-slate-400 uppercase">Buyer</span><span className="text-[10px] font-bold text-slate-800">{record.customerName}</span></div>
          </div>
          <div className="pt-2"><button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all">Print Digital Receipt</button></div>
        </div>
      </div>
    </div>
  );
};

const CloudSetupModal: React.FC<{ onClose: () => void; url: string; onSave: (url: string) => void }> = ({ onClose, url, onSave }) => {
  const [localUrl, setLocalUrl] = useState(url);
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-8 bg-indigo-900 text-white flex justify-between items-center">
          <div><h3 className="text-xl font-black uppercase tracking-widest">Cloud Sync Setup</h3><p className="text-[10px] text-indigo-300 font-bold uppercase mt-1">Google Sheets Integration</p></div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-8 space-y-6">
          <input type="text" value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} placeholder="Webhook URL" className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-xs font-bold outline-none" />
          <div className="pt-4 flex gap-4">
             <button onClick={onClose} className="flex-1 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Cancel</button>
             <button onClick={() => { onSave(localUrl); onClose(); }} className="flex-1 bg-indigo-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase">Connect Sheet</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const IdentityModal: React.FC<{ 
  onAuthorize: (user: UserProfile) => void; 
  registry: UserProfile[];
}> = ({ onAuthorize, registry }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<UserRole>('agent');
  const [error, setError] = useState('');

  const handleAction = () => {
    setError('');
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedPhone || pin.length < 4) {
      setError("Please fill in all fields (Name, Phone, and 4-digit PIN).");
      return;
    }
    
    if (mode === 'register') {
      const existing = registry.find(u => u.name.toLowerCase() === trimmedName.toLowerCase() || u.phone === trimmedPhone);
      if (existing) {
        setError(`Warning: The identity "${trimmedName}" or this phone number is already registered. Please Login.`);
        return;
      }
      
      let finalRole = role;
      if (AUTHORIZED_USERS.includes(trimmedName)) {
        if (trimmedName === 'CD Otieno') finalRole = 'management';
        else if (trimmedName === 'Barack James') finalRole = 'developer';
        else if (trimmedName === 'Fred Dola') finalRole = 'analyst';
      }

      onAuthorize({ name: trimmedName, phone: trimmedPhone, role: finalRole, pin });
    } else {
      const user = registry.find(u => u.name.toLowerCase() === trimmedName.toLowerCase() && u.phone === trimmedPhone);
      if (!user) {
        setError("Identity Not Found: Please register your account first.");
        return;
      }
      if (user.pin !== pin) {
        setError("ACCESS DENIED: Incorrect passcode for this identity.");
        return;
      }
      onAuthorize(user);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
        <div className="p-8 bg-emerald-950 text-white text-center">
          <i className="fas fa-shield-halved text-4xl mb-4 text-emerald-400"></i>
          <h3 className="text-xl font-black uppercase tracking-widest">Coop Trust Protocol</h3>
          <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest mt-1">Identity Management Terminal</p>
        </div>
        
        <div className="flex border-b">
           <button onClick={() => { setMode('login'); setError(''); }} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'login' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 bg-slate-50'}`}>Log In</button>
           <button onClick={() => { setMode('register'); setError(''); }} className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${mode === 'register' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-slate-400 bg-slate-50'}`}>Register Account</button>
        </div>

        <div className="p-8 space-y-5">
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-[10px] font-black uppercase text-red-600 flex items-start animate-pulse">
              <i className="fas fa-triangle-exclamation mt-0.5 mr-3"></i>
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Barack James" className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07..." className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-bold focus:ring-4 focus:ring-emerald-500/10 outline-none" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">4-Digit PIN</label>
            <input type="password" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="****" className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-xl font-black tracking-[1em] text-center focus:ring-4 focus:ring-emerald-500/10 outline-none" />
          </div>

          {mode === 'register' && (
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">System Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full bg-slate-50 border-slate-200 rounded-2xl p-4 text-sm font-bold appearance-none outline-none">
                <option value="agent">Field Agent</option>
                <option value="accounts">Accounts Office</option>
                <option value="analyst">Data Analyst</option>
                <option value="management">Board Director</option>
                <option value="developer">System Developer</option>
              </select>
            </div>
          )}

          <div className="pt-4">
            <button onClick={handleAction} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-600/20 active:scale-95 transition-all">
              {mode === 'login' ? 'Authenticate Access' : 'Create Secured Profile'}
            </button>
          </div>
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
          <div><h3 className="text-2xl font-black uppercase tracking-tight flex items-center"><i className={`fas ${isSafe ? 'fa-check-circle' : 'fa-triangle-exclamation'} mr-3`}></i>Audit Check</h3></div>
          <button onClick={onClose} className="bg-black/20 w-10 h-10 rounded-full flex items-center justify-center transition-all"><i className="fas fa-times"></i></button>
        </div>
        <div className="p-8">
           <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-mono text-[10px] break-all text-slate-500">{record.signature}</div>
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
    <button onClick={onClick} className={`flex items-center space-x-1.5 px-2 py-1 rounded-md border transition-all ${isSafe ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-200 text-red-600 animate-pulse'}`}>
      <i className={`fas ${isSafe ? 'fa-check-circle' : 'fa-shield-virus'} text-[10px]`}></i>
      <span className="text-[9px] font-black uppercase tracking-tighter">{isSafe ? 'Secure' : 'Tampered'}</span>
    </button>
  );
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [registry, setRegistry] = useState<UserProfile[]>(() => {
    const saved = persistence.get('coop_user_registry');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    const saved = persistence.get('coop_active_session');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'sales' | 'finance' | 'analyst' | 'management'>('sales');
  const [auditRecord, setAuditRecord] = useState<SaleRecord | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<SaleRecord | null>(null);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [showValidatedLedger, setShowValidatedLedger] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [sheetWebhook, setSheetWebhook] = useState<string>(() => persistence.get('coop_sheet_webhook') || '');
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const userName = currentUser?.name || 'Guest';
  const userPhone = currentUser?.phone || '';
  const userRole = currentUser?.role || 'agent';
  const isDeveloper = userRole === 'developer' || userName === 'Barack James';

  const canAccessSales = isDeveloper || userRole === 'agent' || userRole === 'analyst' || userRole === 'management';
  const canAccessFinance = isDeveloper || userRole === 'accounts' || userRole === 'analyst' || userRole === 'management';
  const canAccessIntegrity = isDeveloper || userRole === 'analyst' || userRole === 'management';
  const canAccessBoard = isDeveloper || userRole === 'management';

  useEffect(() => {
    const saved = persistence.get('food_coop_data');
    if (saved) { try { setRecords(JSON.parse(saved)); } catch(e) {} }
  }, []);

  useEffect(() => {
    setIsSyncing(true);
    persistence.set('food_coop_data', JSON.stringify(records));
    persistence.set('coop_user_registry', JSON.stringify(registry));
    persistence.set('coop_active_session', JSON.stringify(currentUser));
    persistence.set('coop_sheet_webhook', sheetWebhook);
    const timer = setTimeout(() => setIsSyncing(false), 800);
    return () => clearTimeout(timer);
  }, [records, registry, currentUser, sheetWebhook]);

  const handleAuthorizeUser = (profile: UserProfile) => {
    const exists = registry.find(u => u.name === profile.name && u.phone === profile.phone);
    if (!exists) { setRegistry([...registry, profile]); }
    setCurrentUser(profile);
    if (profile.role === 'accounts' && !isDeveloper) setActiveTab('finance');
    else if (profile.role === 'agent' && !isDeveloper) setActiveTab('sales');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    persistence.remove('coop_active_session');
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

  const handleRunAiAudit = async () => {
    if (records.length === 0) return alert("No sales data available for audit.");
    setIsAnalyzing(true);
    try {
      const report = await analyzeSalesData(records);
      setAiAnalysis(report);
    } catch (err) {
      setAiAnalysis("Analysis failed.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const syncToCloudSheet = async () => {
    if (!sheetWebhook) { setIsCloudModalOpen(true); return; }
    const validated = records.filter(r => r.status === RecordStatus.VALIDATED);
    if (validated.length === 0) { alert("No validated records to sync."); return; }
    setIsCloudSyncing(true);
    try {
      await fetch(sheetWebhook, { method: 'POST', mode: 'no-cors', body: JSON.stringify({ records: validated }) });
      alert("Ledger transmitted to Cloud Sheet.");
    } catch (e) {
      alert("Sync Failed.");
    } finally { setIsCloudSyncing(false); }
  };

  const stats = useMemo(() => {
    let tSales = 0, tFinalizedProfit = 0, tUnits = 0;
    records.forEach(r => {
      tSales += r.totalSale;
      tUnits += r.unitsSold;
      if (r.status === RecordStatus.VALIDATED) tFinalizedProfit += r.coopProfit;
    });
    return { totalSales: tSales, finalizedProfit: tFinalizedProfit, totalUnits: tUnits, avgUnitPrice: tUnits > 0 ? tSales / tUnits : 0 };
  }, [records]);

  const commodityChartData = useMemo(() => {
    const totals: Record<string, { name: string; value: number }> = {};
    records.forEach(r => { if (!totals[r.cropType]) totals[r.cropType] = { name: r.cropType, value: 0 }; totals[r.cropType].value += r.totalSale; });
    return Object.values(totals).sort((a, b) => b.value - a.value);
  }, [records]);

  const exportToExcel = () => {
    const validated = records.filter(r => r.status === RecordStatus.VALIDATED);
    if (validated.length === 0) { alert("No records."); return; }
    const csvContent = validated.map(r => `${r.date},${r.cropType},${r.unitsSold},${r.totalSale}`).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csvContent], { type: 'text/csv' }));
    link.download = `Ledger.csv`;
    link.click();
  };

  const roleLabel = userName === 'CD Otieno' ? 'Senior Director' : userName === 'Barack James' ? 'System Developer' : userName === 'Fred Dola' ? 'Data Analyst' : userRole === 'accounts' ? 'Accounts Office' : userRole === 'analyst' ? 'Data Analyst' : userRole === 'management' ? 'Coop Director' : userRole === 'developer' ? 'System Developer' : 'Field Agent';

  return (
    <div className="min-h-screen pb-12 bg-[#F8FAFC]">
      {!currentUser && <IdentityModal registry={registry} onAuthorize={handleAuthorizeUser} />}
      {auditRecord && <AuditModal record={auditRecord} onClose={() => setAuditRecord(null)} />}
      {selectedReceipt && <ReceiptModal record={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
      {isCloudModalOpen && <CloudSetupModal url={sheetWebhook} onSave={setSheetWebhook} onClose={() => setIsCloudModalOpen(false)} />}
      
      <header className="bg-emerald-950 text-white py-6 shadow-2xl sticky top-0 z-50 border-b border-white/10 backdrop-blur-md">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-5">
            <div className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-colors ${userName === 'CD Otieno' ? 'bg-indigo-500' : 'bg-emerald-500'}`}><i className={`fas ${userName === 'CD Otieno' ? 'fa-user-tie' : isDeveloper ? 'fa-shield-halved' : 'fa-leaf'} text-white text-3xl`}></i></div>
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-2xl font-black tracking-tight uppercase">Food Coop Hub</h1>
                <div className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-full border border-white/10 bg-white/5 transition-opacity duration-500 ${isSyncing ? 'opacity-50' : 'opacity-100'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${isSyncing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}></div>
                  <span className="text-[8px] font-black uppercase tracking-widest text-white/60">{isSyncing ? 'Securing...' : 'Secured'}</span>
                </div>
              </div>
              <div className="mt-1 flex items-center space-x-2"><p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">{roleLabel}</p><span className="text-white/20">|</span><p className="text-white font-bold text-xs">{userName}</p></div>
            </div>
          </div>
          <nav className="flex space-x-1 bg-white/5 p-1.5 rounded-2xl border border-white/10">
            {canAccessSales && <button onClick={() => setActiveTab('sales')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sales' ? 'bg-emerald-500 text-white shadow-lg' : 'text-emerald-400 hover:bg-white/5'}`}>Sales</button>}
            {canAccessFinance && <button onClick={() => setActiveTab('finance')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'finance' ? 'bg-blue-500 text-white shadow-lg' : 'text-blue-400 hover:bg-white/5'}`}>Finance</button>}
            {canAccessIntegrity && <button onClick={() => setActiveTab('analyst')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analyst' ? 'bg-amber-500 text-white shadow-lg' : 'text-amber-400 hover:bg-white/5'}`}>Integrity</button>}
            {canAccessBoard && <button onClick={() => setActiveTab('management')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'management' ? 'bg-indigo-500 text-white shadow-lg' : 'text-indigo-400 hover:bg-white/5'}`}>Board</button>}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 mt-8 max-w-7xl">
        <div className="mb-10 p-5 rounded-3xl border bg-white border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${isDeveloper ? 'bg-slate-900' : 'bg-emerald-600'}`}><i className={`fas ${isDeveloper ? 'fa-shield-halved' : 'fa-user'} text-xl`}></i></div>
            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Authenticated Session</p><p className="text-sm font-black text-slate-800 uppercase tracking-tight">{userName} • {userPhone}</p></div>
          </div>
          <button onClick={handleLogout} className="w-full sm:w-auto px-5 py-2.5 bg-red-50 border border-red-100 rounded-xl text-[10px] font-black uppercase text-red-600 hover:bg-white transition-all shadow-sm">Logout / Switch User</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard label="Total Revenue" value={`KSh ${stats.totalSales.toLocaleString()}`} icon="fa-sack-dollar" color="bg-slate-700" />
          <StatCard label="Commission" value={`KSh ${stats.finalizedProfit.toLocaleString()}`} icon="fa-landmark" color="bg-emerald-600" />
          <StatCard label="Total Units" value={stats.totalUnits.toLocaleString()} icon="fa-boxes-stacked" color="bg-blue-600" />
          <StatCard label="Avg Price" value={`KSh ${Math.round(stats.avgUnitPrice).toLocaleString()}`} icon="fa-tag" color="bg-indigo-600" />
        </div>

        {activeTab === 'sales' && canAccessSales && (
          <div className="animate-fade-in space-y-10">
             <SaleForm onSubmit={handleAddRecord} />
             <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50/50 border-b font-black text-[11px] uppercase tracking-widest text-slate-400">Transaction Log</div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-400 font-black uppercase">
                        <tr><th className="px-8 py-5">Date</th><th className="px-8 py-5">Stakeholders</th><th className="px-8 py-5">Commodity</th><th className="px-8 py-5">Security</th><th className="px-8 py-5 text-right">Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.map(r => (
                          <tr key={r.id} className="hover:bg-slate-50/50 transition">
                            <td className="px-8 py-5 text-xs font-black text-slate-600">{r.date}</td>
                            <td className="px-8 py-5"><p className="text-xs font-black text-slate-800">{r.farmerName} → {r.customerName}</p></td>
                            <td className="px-8 py-5"><span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase">{r.cropType}</span></td>
                            <td className="px-8 py-5"><SecurityCheckBadge record={r} onClick={() => setAuditRecord(r)} /></td>
                            <td className="px-8 py-5 text-right text-[10px] font-black uppercase text-slate-400">{r.status}</td>
                          </tr>
                        ))}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'finance' && canAccessFinance && (
          <div className="animate-fade-in space-y-12">
             <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-8 bg-blue-900 text-white flex justify-between items-center"><div><h3 className="text-xl font-black uppercase tracking-widest">Commission Vault</h3></div><i className="fas fa-hand-holding-dollar text-2xl"></i></div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {records.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                    <div key={r.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                      <p className="text-lg font-black text-blue-600 mb-4">KSh {r.coopProfit.toLocaleString()}</p>
                      <button onClick={() => handleConfirmPayment(r.id)} className="w-full bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase">Confirm</button>
                    </div>
                  ))}
                </div>
             </div>
          </div>
        )}

        {activeTab === 'analyst' && canAccessIntegrity && (
          <div className="animate-fade-in space-y-10">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-200 flex flex-col md:flex-row gap-8 items-center">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner shrink-0"><i className="fas fa-microchip"></i></div>
               <div className="flex-1 space-y-2 text-center md:text-left">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Audit Console</h3>
                  <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start">
                    <button onClick={() => setShowValidatedLedger(!showValidatedLedger)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest">Audit List</button>
                    <button onClick={handleRunAiAudit} disabled={isAnalyzing} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">
                      {isAnalyzing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-sparkles"></i>} AI Sales Audit
                    </button>
                  </div>
               </div>
               {userName === 'Barack James' && (
                 <div className="md:border-l pl-8 flex gap-2">
                    <button onClick={syncToCloudSheet} disabled={isCloudSyncing} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase">Sync Sheet</button>
                    <button onClick={() => setIsCloudModalOpen(true)} className="bg-slate-100 w-10 h-10 rounded-xl flex items-center justify-center"><i className="fas fa-cog"></i></button>
                 </div>
               )}
            </div>
            {aiAnalysis && (
              <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-200 animate-fade-in">
                <div className="prose prose-slate max-w-none text-sm text-slate-600 font-medium leading-relaxed whitespace-pre-wrap">{aiAnalysis}</div>
              </div>
            )}
            {showValidatedLedger && (
              <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                  {records.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 transition"><td className="px-6 py-5"><SecurityCheckBadge record={r} onClick={() => setAuditRecord(r)} /></td><td className="px-6 py-5"><p className="text-xs font-black text-slate-800">KSh {r.coopProfit.toLocaleString()} Comm</p></td><td className="px-6 py-5 text-right">{r.status === RecordStatus.VALIDATED ? <span className="text-emerald-600 font-black uppercase text-[10px] bg-emerald-50 px-4 py-2 rounded-lg">Validated</span> : <button onClick={() => handleFinalVerify(r.id)} className="bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase">Verify</button>}</td></tr>
                  ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'management' && canAccessBoard && (
          <div className="animate-fade-in space-y-10">
            <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-4">
               <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">Executive Intelligence</h3>
               <div className="flex gap-3">
                 <button onClick={handleRunAiAudit} disabled={isAnalyzing} className="bg-indigo-50 text-indigo-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase flex items-center gap-2">{isAnalyzing ? <i className="fas fa-circle-notch fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>} Strategic Report</button>
                 <button onClick={exportToExcel} className="bg-indigo-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20">Audit CSV</button>
               </div>
            </div>
            {aiAnalysis && (
              <div className="bg-indigo-900 rounded-[2.5rem] p-10 shadow-2xl border border-indigo-800 animate-fade-in text-white/90">
                <div className="prose prose-invert max-w-none text-sm whitespace-pre-wrap">{aiAnalysis}</div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
               <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl min-h-[400px]">
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={commodityChartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 900 }} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 900 }} />
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }} />
                        <Bar dataKey="value" radius={[10, 10, 0, 0]}>
                           {commodityChartData.map((entry, index) => ( <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} /> ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
               </div>
               <div className="bg-indigo-950 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-2">Validated Commission</p>
                    <p className="text-5xl font-black tracking-tighter">KSh {stats.finalizedProfit.toLocaleString()}</p>
                  </div>
                  <p className="text-[9px] italic text-indigo-300">"Verified under Excel Trust Protocol."</p>
               </div>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-24 text-center pb-12">
        <div className="inline-flex items-center space-x-4 bg-white px-8 py-4 rounded-3xl border border-slate-100 shadow-sm">
          <i className="fas fa-shield-check text-emerald-600 text-sm"></i>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Excel Trust Protocol • v3.5.0</span>
        </div>
      </footer>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }.animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }`}</style>
    </div>
  );
};

export default App;
