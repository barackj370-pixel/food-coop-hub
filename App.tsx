import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, RecordStatus, CoopStats, UserRole } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { analyzeSalesData } from './services/geminiService.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PROFIT_MARGIN } from './constants.ts';

// Pre-authorized Developers & Directors with Full Access
const AUTHORIZED_USERS = ['Barack James', 'Fred Dola', 'CD Otieno'];

const computeHash = async (record: any): Promise<string> => {
  const msg = `${record.id}-${record.date}-${record.cropType}-${record.unitType}-${record.farmerName}-${record.farmerPhone}-${record.customerName}-${record.customerPhone}-${record.unitsSold}-${record.unitPrice}-${record.createdBy}-${record.agentPhone}-${record.status}-${record.confirmedBy || 'none'}`;
  
  // Safety fallback if crypto.subtle is not available (e.g. non-HTTPS)
  if (!window.crypto || !window.crypto.subtle) {
    console.warn("Crypto Subtle not available, using fallback hashing");
    // Extremely basic fallback hash for development/insecure contexts
    let hash = 0;
    for (let i = 0; i < msg.length; i++) {
      const char = msg.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `FB-${Math.abs(hash).toString(16)}-${Date.now().toString(16)}`;
  }

  const encoder = new TextEncoder();
  const dataUint8 = encoder.encode(msg);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [activeTab, setActiveTab] = useState<'sales' | 'finance' | 'analyst' | 'management'>('sales');
  const [auditRecord, setAuditRecord] = useState<SaleRecord | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<SaleRecord | null>(null);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [showValidatedLedger, setShowValidatedLedger] = useState(false);
  
  const [userName, setUserName] = useState<string>(() => localStorage.getItem('coop_user_name') || 'Field Agent');
  const [userPhone, setUserPhone] = useState<string>(() => localStorage.getItem('coop_user_phone') || '0700000000');
  const [userRole, setUserRole] = useState<string>(() => localStorage.getItem('coop_user_role') || 'agent');
  
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
    const saved = localStorage.getItem('food_coop_data');
    if (saved) { 
      try { 
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setRecords(parsed);
      } catch (e) { 
        console.error("Corrupted record data, resetting:", e); 
        localStorage.removeItem('food_coop_data');
      } 
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('food_coop_data', JSON.stringify(records));
    localStorage.setItem('coop_user_name', userName);
    localStorage.setItem('coop_user_phone', userPhone);
    localStorage.setItem('coop_user_role', userRole);
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
    const id = crypto.randomUUID();
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

  const stats = useMemo(() => {
    let tSales = 0;
    let tFinalizedProfit = 0;
    let tUnits = 0;
    let vCount = 0;
    records.forEach(r => {
      tSales += r.totalSale;
      tUnits += r.unitsSold;
      if (r.status === RecordStatus.VALIDATED) {
        tFinalizedProfit += r.coopProfit;
        vCount += 1;
      }
    });
    return { totalSales: tSales, finalizedProfit: tFinalizedProfit, totalUnits: tUnits, countValidated: vCount, avgUnitPrice: tUnits > 0 ? tSales / tUnits : 0 };
  }, [records]);

  const exportToExcel = () => {
    const validated = [...records]
      .filter(r => r.status === RecordStatus.VALIDATED)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
    if (validated.length === 0) { alert("No validated records to export."); return; }
    
    const headers = ["Date", "Crop Type", "Qty & Unit", "Price Per Unit", "Total Sales", "Commission"];
    const rows = validated.map(r => [
      r.date, 
      `"${r.cropType}"`, 
      `"${r.unitsSold} ${r.unitType}"`, 
      r.unitPrice, 
      r.totalSale, 
      r.coopProfit
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `FoodCoop_Master_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const chartData = useMemo(() => {
    const crops: Record<string, number> = {};
    records.forEach(r => { crops[r.cropType] = (crops[r.cropType] || 0) + r.totalSale; });
    return Object.entries(crops).map(([name, value]) => ({ name, value }));
  }, [records]);

  const roleLabel = userName === 'CD Otieno' ? 'Senior Director' : userName === 'Barack James' ? 'System Developer' : userName === 'Fred Dola' ? 'Data Analyst' : userRole === 'accounts' ? 'Accounts Office' : userRole === 'analyst' ? 'Data Analyst' : userRole === 'management' ? 'Coop Director' : userRole === 'developer' ? 'System Developer' : 'Field Agent';

  const ValidatedLedgerView = () => {
    const validatedRecords = [...records]
      .filter(r => r.status === RecordStatus.VALIDATED)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
    return (
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden mt-6 animate-fade-in">
        <div className="p-4 bg-emerald-50 border-b border-emerald-100 flex justify-between items-center">
          <h4 className="text-[10px] font-black uppercase text-emerald-800 tracking-widest">Master Validated Ledger (Live View)</h4>
          <button onClick={() => setShowValidatedLedger(false)} className="text-emerald-600 hover:text-emerald-800"><i className="fas fa-times"></i></button>
        </div>
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400">
              <tr><th className="px-6 py-3">Date</th><th className="px-6 py-3">Commodity</th><th className="px-6 py-3">Qty Sold</th><th className="px-6 py-3">Total Sale</th><th className="px-6 py-3">Comm</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {validatedRecords.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">No validated records found</td></tr>
              ) : (
                validatedRecords.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 transition">
                    <td className="px-6 py-3 text-[10px] font-bold text-slate-600">{r.date}</td>
                    <td className="px-6 py-3 text-[10px] font-black text-slate-800">{r.cropType}</td>
                    <td className="px-6 py-3 text-[10px] font-bold text-slate-600">{r.unitsSold} <span className="text-[9px] text-slate-400 uppercase">{r.unitType}</span></td>
                    <td className="px-6 py-3 text-[10px] font-black text-slate-900">KSh {r.totalSale.toLocaleString()}</td>
                    <td className="px-6 py-3 text-[10px] font-black text-emerald-600">KSh {r.coopProfit.toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-12 bg-[#F8FAFC]">
      {auditRecord && <AuditModal record={auditRecord} onClose={() => setAuditRecord(null)} />}
      {selectedReceipt && <ReceiptModal record={selectedReceipt} onClose={() => setSelectedReceipt(null)} />}
      {isIdentityModalOpen && <IdentityModal currentName={userName} currentPhone={userPhone} currentRole={userRole} onSave={handleSaveIdentity} onClose={() => setIsIdentityModalOpen(false)} />}
      
      <header className="bg-emerald-950 text-white py-6 shadow-2xl sticky top-0 z-50 border-b border-white/5">
        <div className="container mx-auto px-6 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-5">
            <div className={`w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-colors ${userName === 'CD Otieno' ? 'bg-indigo-500' : 'bg-emerald-500'}`}><i className={`fas ${userName === 'CD Otieno' ? 'fa-user-tie' : isDeveloper ? 'fa-shield-halved' : 'fa-leaf'} text-white text-3xl`}></i></div>
            <div><h1 className="text-2xl font-black tracking-tight uppercase">Food Coop Hub</h1><div className="mt-1 flex items-center space-x-2"><p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">{roleLabel}</p><span className="text-white/20">|</span><p className="text-white font-bold text-xs">{userName}</p></div></div>
          </div>
          <nav className="flex space-x-1 bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md overflow-x-auto">
            {canAccessSales && <button onClick={() => setActiveTab('sales')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'sales' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-emerald-400 hover:bg-white/5'}`}>Sales Portal</button>}
            {canAccessFinance && <button onClick={() => setActiveTab('finance')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'finance' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'text-blue-400 hover:bg-white/5'}`}>Finance Desk</button>}
            {canAccessIntegrity && <button onClick={() => setActiveTab('analyst')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'analyst' ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-amber-400 hover:bg-white/5'}`}>Integrity Portal</button>}
            {canAccessBoard && <button onClick={() => setActiveTab('management')} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'management' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-indigo-400 hover:bg-white/5'}`}>Board View</button>}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 mt-8 max-w-7xl">
        <div className="mb-10 p-5 rounded-3xl border bg-white border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${isDeveloper ? 'bg-slate-900' : userRole === 'management' ? 'bg-indigo-600' : userRole === 'accounts' ? 'bg-blue-600' : 'bg-emerald-600'}`}><i className={`fas ${isDeveloper ? 'fa-code' : userRole === 'management' ? 'fa-user-tie' : userRole === 'accounts' ? 'fa-cash-register' : 'fa-user'} text-xl`}></i></div>
            <div><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Authenticated Session</p><p className="text-sm font-black text-slate-800 uppercase tracking-tight">{userName} • {userPhone}</p></div>
          </div>
          <button onClick={() => setIsIdentityModalOpen(true)} className="w-full sm:w-auto px-5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-white hover:border-emerald-500 hover:text-emerald-600 transition-all shadow-sm">Switch Identity</button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
          <StatCard label="Total Revenue" value={`KSh ${stats.totalSales.toLocaleString()}`} icon="fa-sack-dollar" color="bg-slate-700" />
          <StatCard label="Finalized Commission" value={`KSh ${stats.finalizedProfit.toLocaleString()}`} icon="fa-landmark" color="bg-emerald-600" />
          <StatCard label="Total Units Sold" value={stats.totalUnits.toLocaleString()} icon="fa-boxes-stacked" color="bg-blue-600" />
          <StatCard label="Avg. Price / Unit" value={`KSh ${Math.round(stats.avgUnitPrice).toLocaleString()}`} icon="fa-tag" color="bg-indigo-600" />
        </div>

        {activeTab === 'sales' && canAccessSales && (
          <div className="animate-fade-in space-y-10">
             <SaleForm onSubmit={handleAddRecord} />
             <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50/50 border-b font-black text-[11px] uppercase tracking-widest text-slate-400">Local Ledger Entry Log</div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-white border-b text-[10px] text-slate-400 font-black uppercase">
                        <tr><th className="px-8 py-5">Stakeholders</th><th className="px-8 py-5">Commodity</th><th className="px-8 py-5 text-center">Qty & Unit</th><th className="px-8 py-5">Finance</th><th className="px-8 py-5">Coop Comm</th><th className="px-8 py-5">Security</th><th className="px-8 py-5 text-right">Approval Status</th></tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.length === 0 ? (
                          <tr><td colSpan={7} className="px-8 py-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">No local records available</td></tr>
                        ) : (
                          records.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50/50 transition">
                              <td className="px-8 py-5">
                                <div className="space-y-1">
                                  <p className="text-xs font-black text-slate-800"><span className="text-[9px] text-slate-400 uppercase tracking-tighter mr-1">F:</span>{r.farmerName}</p>
                                  <p className="text-[10px] text-emerald-600 font-bold ml-3">{r.farmerPhone}</p>
                                  <div className="h-[1px] w-full bg-slate-50 my-1"></div>
                                  <p className="text-xs font-black text-slate-800"><span className="text-[9px] text-blue-400 uppercase tracking-tighter mr-1">C:</span>{r.customerName}</p>
                                  <p className="text-[10px] text-blue-600 font-bold ml-3">{r.customerPhone}</p>
                                </div>
                              </td>
                              <td className="px-8 py-5"><span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-tight">{r.cropType}</span></td>
                              <td className="px-8 py-5 text-center"><p className="text-xs font-bold text-slate-600">{r.unitsSold} <span className="text-[10px] font-black text-slate-400 uppercase">{r.unitType}</span></p></td>
                              <td className="px-8 py-5"><p className="text-sm font-black text-slate-900">KSh {r.totalSale.toLocaleString()}</p><p className="text-[9px] font-black text-slate-400 uppercase">@ KSh {r.unitPrice}</p></td>
                              <td className="px-8 py-5"><div className={`px-3 py-1.5 rounded-xl border inline-block ${r.status === RecordStatus.VALIDATED ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}><p className={`text-xs font-black ${r.status === RecordStatus.VALIDATED ? 'text-emerald-700' : 'text-slate-400'}`}>KSh {r.coopProfit.toLocaleString()}{r.status === RecordStatus.VALIDATED && <i className="fas fa-stamp ml-2 text-[10px]"></i>}</p></div></td>
                              <td className="px-8 py-5"><SecurityCheckBadge record={r} onClick={() => setAuditRecord(r)} /></td>
                              <td className="px-8 py-5 text-right"><div className="flex items-center justify-end space-x-2"><span className={`w-2 h-2 rounded-full ${r.status === RecordStatus.VALIDATED ? 'bg-emerald-500' : r.status === RecordStatus.PAID ? 'bg-blue-500' : 'bg-slate-200'}`}></span><span className="text-[10px] font-black uppercase text-slate-400">{r.status}</span></div></td>
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
                <div className="p-8 bg-blue-900 text-white flex justify-between items-center"><div><h3 className="text-xl font-black uppercase tracking-widest">Finance: Commission Reception</h3><p className="text-[10px] text-blue-200 font-bold uppercase mt-2">Incoming field agent commission handovers (10%)</p></div><div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-blue-200"><i className="fas fa-hand-holding-dollar text-xl"></i></div></div>
                <div className="p-8">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {records.filter(r => r.status === RecordStatus.DRAFT).length === 0 ? (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-slate-100 rounded-[2rem]"><i className="fas fa-box-open text-slate-200 text-5xl mb-4"></i><p className="text-slate-300 font-black uppercase tracking-widest text-sm">No Pending Commissions</p></div>
                      ) : (
                        records.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                          <div key={r.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200 flex flex-col justify-between shadow-sm hover:border-blue-300 transition-all">
                             <div><div className="flex justify-between items-start mb-4"><span className="bg-white px-3 py-1 rounded-lg border border-slate-200 text-[10px] font-black text-slate-500 uppercase">{r.cropType}</span><div className="text-right"><p className="text-[9px] font-black text-slate-400 uppercase">Commission Due</p><p className="text-lg font-black text-blue-600">KSh {r.coopProfit.toLocaleString()}</p></div></div><div className="space-y-3 mb-6"><div className="flex justify-between text-[11px]"><span className="font-bold text-slate-400 uppercase">Basis (Sale)</span><span className="font-black text-slate-800">KSh {r.totalSale.toLocaleString()}</span></div><div className="flex justify-between text-[11px]"><span className="font-bold text-slate-400 uppercase">Field Agent</span><span className="font-black text-slate-800">{r.createdBy}</span></div></div></div>
                             <button onClick={() => handleConfirmPayment(r.id)} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95">Confirm Commission Received</button>
                          </div>
                        ))
                      )}
                   </div>
                </div>
             </div>
             <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 bg-slate-50/50 border-b flex justify-between items-center"><h4 className="font-black text-[11px] uppercase tracking-widest text-slate-400">Commission History (Today)</h4><span className="px-3 py-1 bg-white border rounded-full text-[9px] font-black text-blue-600 uppercase">Awaiting Auditor Ledger Update</span></div>
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead className="bg-white border-b text-[9px] text-slate-400 font-black uppercase"><tr><th className="px-8 py-4">Transaction ID</th><th className="px-8 py-4">Field Agent</th><th className="px-8 py-4 text-center">Commission Received</th><th className="px-8 py-4 text-right">Documentation</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {records.filter(r => r.status === RecordStatus.PAID && r.confirmedBy === userName).length === 0 ? (
                           <tr><td colSpan={4} className="px-8 py-10 text-center text-[10px] text-slate-300 font-bold uppercase tracking-widest">No commissions received in this session</td></tr>
                        ) : (
                          records.filter(r => r.status === RecordStatus.PAID && r.confirmedBy === userName).map(r => (
                            <tr key={r.id} className="hover:bg-blue-50/20 transition"><td className="px-8 py-4 font-mono text-[10px] text-slate-400">#{r.id.slice(0, 8)}</td><td className="px-8 py-4"><p className="text-xs font-black text-slate-800">{r.createdBy}</p><p className="text-[9px] text-slate-400 font-bold">{r.agentPhone}</p></td><td className="px-8 py-4 text-center"><p className="text-sm font-black text-slate-900">KSh {r.coopProfit.toLocaleString()}</p></td><td className="px-8 py-4 text-right"><button onClick={() => setSelectedReceipt(r)} className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[9px] font-black text-blue-600 uppercase hover:bg-blue-50 transition-all"><i className="fas fa-file-invoice mr-2"></i>View Receipt</button></td></tr>
                          ))
                        )}
                      </tbody>
                   </table>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'analyst' && canAccessIntegrity && (
          <div className="animate-fade-in space-y-10">
            <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-200 flex flex-col md:flex-row gap-8 items-center">
               <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-[2rem] flex items-center justify-center text-4xl shadow-inner shrink-0"><i className="fas fa-file-excel"></i></div>
               <div className="flex-1 space-y-2 text-center md:text-left">
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Excel Master Ledger</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">The Master Ledger contains **all validated entries** since you started using this hub, sorted by date.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Step 1</p><p className="text-[9px] font-bold text-slate-600 uppercase leading-tight">Review cryptographic security signatures for all entries.</p></div>
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Step 2</p><p className="text-[9px] font-bold text-slate-600 uppercase leading-tight">Click 'Update Official Ledger' to move commission to validated status.</p></div>
                     <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Step 3</p><p className="text-[9px] font-bold text-slate-600 uppercase leading-tight">View live or download the sorted CSV history for accounting.</p></div>
                  </div>
                  <div className="pt-4 flex flex-wrap gap-4 justify-center md:justify-start">
                    <button onClick={() => setShowValidatedLedger(!showValidatedLedger)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center"><i className={`fas ${showValidatedLedger ? 'fa-eye-slash' : 'fa-eye'} mr-2`}></i> {showValidatedLedger ? 'Hide Master Ledger' : 'View Master Ledger'}</button>
                    <button onClick={() => exportToExcel()} className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:underline flex items-center px-4 py-2.5 bg-emerald-50 rounded-xl border border-emerald-100 transition-all"><i className="fas fa-download mr-2"></i> Download All Validated Records (Excel)</button>
                  </div>
               </div>
            </div>
            {showValidatedLedger && <ValidatedLedgerView />}
            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
               <div className="p-8 bg-slate-900 text-white flex justify-between items-center"><div><h3 className="text-xl font-black uppercase tracking-widest">Auditor: Commission Integrity Console</h3><p className="text-[10px] text-amber-400 font-bold uppercase mt-2">Post verified commission cash to the official cooperative ledger</p></div></div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400"><tr><th className="px-6 py-5">Security Check</th><th className="px-6 py-5">Commission Details</th><th className="px-6 py-5">Finance Confirmation</th><th className="px-6 py-5 text-right">Ledger Validation</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50 transition">
                          <td className="px-6 py-5"><SecurityCheckBadge record={r} onClick={() => setAuditRecord(r)} /></td>
                          <td className="px-6 py-5"><p className="text-xs font-black text-slate-800">KSh {r.coopProfit.toLocaleString()} Commission</p><p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{r.date} | {r.cropType} | {r.unitsSold} {r.unitType} @ KSh {r.unitPrice}</p></td>
                          <td className="px-6 py-5"><div className="flex items-center space-x-2"><i className="fas fa-cash-register text-blue-500 text-xs"></i><span className="text-[10px] font-black text-blue-600 uppercase">Held by {r.confirmedBy}</span></div></td>
                          <td className="px-6 py-5 text-right">{r.status === RecordStatus.VALIDATED ? (<div className="flex items-center justify-end space-x-3"><i className="fas fa-check-circle text-emerald-500"></i><span className="text-emerald-600 font-black uppercase text-[10px] bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">Validated</span></div>) : (<button onClick={() => handleFinalVerify(r.id)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center ml-auto"><i className="fas fa-stamp mr-2"></i> Update Official Ledger</button>)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'management' && canAccessBoard && (
          <div className="animate-fade-in space-y-12">
             <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
               <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-200"><h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-12">Crop Distribution Analytics</h3><div className="h-96 bg-slate-50 rounded-[2.5rem] p-8"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 900}} /><YAxis tick={{fontSize: 10, fontWeight: 900}} /><Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} /><Bar dataKey="value" fill="#10b981" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
               <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-200">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase mb-6">Excel Master Archive</h3>
                  <div className="bg-slate-950 rounded-[2rem] h-[400px] overflow-hidden flex flex-col items-center justify-center p-12 text-center">
                     <i className="fas fa-database text-emerald-500 text-5xl mb-6"></i><p className="text-white font-black uppercase tracking-widest text-[11px] mb-4">Master Ledger Sync</p><p className="text-slate-500 text-xs font-medium max-w-xs leading-relaxed mb-6">View or Download the complete history of all validated cooperative transactions recorded on this device.</p>
                     <div className="flex flex-col w-full gap-4">
                        <button onClick={() => setShowValidatedLedger(!showValidatedLedger)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all w-full flex items-center justify-center"><i className="fas fa-eye mr-2"></i> {showValidatedLedger ? 'Hide Master Ledger' : 'View Validated Ledger'}</button>
                        <button onClick={() => exportToExcel()} className="bg-white hover:bg-slate-100 text-slate-900 px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all w-full flex items-center justify-center"><i className="fas fa-download mr-2"></i> Download Master CSV</button>
                     </div>
                  </div>
               </div>
             </div>
             {showValidatedLedger && <div className="mt-8"><ValidatedLedgerView /></div>}
          </div>
        )}
      </main>

      <footer className="mt-24 text-center"><div className="inline-flex items-center space-x-4 bg-white px-8 py-4 rounded-3xl border border-slate-100 shadow-sm"><i className="fas fa-shield-check text-emerald-600 text-sm"></i><span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em]">Excel Trust Protocol • v3.2.3</span></div></footer>
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }.animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }`}</style>
    </div>
  );
};

export default App;