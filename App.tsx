import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, CROP_TYPES } from './constants.ts';
import { analyzeSalesData } from './services/geminiService.ts';

type PortalType = 'SALES' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'IDENTITY';

const persistence = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set: (key: string, val: string) => {
    try { localStorage.setItem(key, val); } catch (e) { }
  }
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
    'Agent Name', 'Agent Phone', 'Units Sold', 'Unit Price', 
    'Total Gross', 'Coop Commission', 'Status', 'Digital Signature'
  ];

  const rows = records.map(r => [
    r.id, r.date, r.cropType, r.unitType,
    `"${r.farmerName}"`, r.farmerPhone, `"${r.customerName}"`, r.customerPhone,
    `"${r.agentName || 'System'}"`, r.agentPhone || '', r.unitsSold, r.unitPrice,
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

const CommissionCard: React.FC<{ record: SaleRecord, onApprove: () => void }> = ({ record, onApprove }) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-xl flex flex-col justify-between hover:shadow-2xl transition-all border-l-4 border-l-blue-500">
    <div>
      <div className="flex justify-between items-start mb-4">
        <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">{record.id}</span>
        <span className="text-[10px] font-bold text-slate-400">{record.date}</span>
      </div>
      <h4 className="text-[13px] font-black text-slate-800 uppercase tracking-tight mb-1">{record.farmerName}</h4>
      <p className="text-[10px] text-slate-400 font-bold uppercase mb-4">{record.cropType} • {record.unitsSold} {record.unitType}</p>
      
      <div className="flex items-end justify-between border-t border-slate-50 pt-4 mt-2">
        <div>
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Commission Amount</p>
          <p className="text-[16px] font-black text-slate-900">KSh {record.coopProfit.toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-1">Total Sale</p>
          <p className="text-[11px] font-bold text-slate-500">KSh {record.totalSale.toLocaleString()}</p>
        </div>
      </div>
    </div>
    <button 
      onClick={onApprove}
      className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase py-4 rounded-xl shadow-lg shadow-blue-500/10 active:scale-95 transition-all"
    >
      Approve Receipt
    </button>
  </div>
);

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('SALES');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  
  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT
  });

  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    const saved = persistence.get('food_coop_data');
    if (saved) { try { setRecords(JSON.parse(saved)); } catch (e) { } }
  }, []);

  useEffect(() => {
    persistence.set('food_coop_data', JSON.stringify(records));
    if (agentIdentity) persistence.set('agent_session', JSON.stringify(agentIdentity));
    else localStorage.removeItem('agent_session');
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
    if (!isSystemDev) return [];
    const usersData = persistence.get('coop_users');
    return usersData ? JSON.parse(usersData) as AgentIdentity[] : [];
  }, [isSystemDev, agentIdentity, isAuthLoading]);

  const availablePortals = useMemo(() => {
    const base: PortalType[] = ['SALES'];
    if (isPrivileged) {
      base.push('FINANCE', 'AUDIT', 'BOARD');
    }
    if (isSystemDev) {
      base.push('IDENTITY');
    }
    return base;
  }, [isPrivileged, isSystemDev]);

  useEffect(() => {
    const available = availablePortals;
    if (!available.includes(currentPortal)) {
      setCurrentPortal('SALES');
    }
  }, [agentIdentity, availablePortals]);

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);

    setTimeout(() => {
      const usersData = persistence.get('coop_users');
      let users: AgentIdentity[] = usersData ? JSON.parse(usersData) : [];

      if (isRegisterMode) {
        if (!authForm.name || authForm.phone.length < 10 || authForm.passcode.length !== 4) {
          alert("Validation failed: All fields required including Full Name and 4-digit passcode.");
          setIsAuthLoading(false);
          return;
        }
        
        const exists = users.find(u => u.phone === authForm.phone);
        if (exists) {
          alert("Account already exists with this phone number. Please Log In.");
          setIsRegisterMode(false);
          setIsAuthLoading(false);
          return;
        }

        const newUser: AgentIdentity = { ...authForm };
        users.push(newUser);
        persistence.set('coop_users', JSON.stringify(users));
        setAgentIdentity(newUser);
      } else {
        const user = users.find(u => 
          u.phone === authForm.phone && 
          u.passcode === authForm.passcode
        );
        
        if (user) {
          setAgentIdentity(user);
        } else {
          alert("Authentication failed. Please check your Phone Number and Passcode.");
        }
      }
      setIsAuthLoading(false);
    }, 800);
  };

  const handleUpdateStatus = (id: string, newStatus: RecordStatus) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, status: newStatus } : r));
  };

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = data.unitsSold * data.unitPrice;
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
      agentName: agentIdentity?.name
    };
    
    setRecords([newRecord, ...records]);
    setAiReport(null);
  };

  const handleGenerateReport = async () => {
    if (records.length === 0) return;
    setIsAnalyzing(true);
    try {
      const report = await analyzeSalesData(records);
      setAiReport(report);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const stats = useMemo(() => {
    const relevantRecords = records.filter(r => isPrivileged || r.agentPhone === agentIdentity?.phone);
    const latest = relevantRecords[0];

    if (currentPortal === 'SALES') {
      const due = relevantRecords
        .filter(r => r.status === RecordStatus.DRAFT)
        .reduce((a, b) => a + b.coopProfit, 0);
      
      const approved = relevantRecords
        .filter(r => r.status === RecordStatus.VALIDATED || r.status === RecordStatus.VERIFIED)
        .reduce((a, b) => a + b.coopProfit, 0);

      return {
        revenue: latest?.totalSale || 0,
        commission: `Due: ${due.toLocaleString()} | Appr: ${approved.toLocaleString()}`, 
        units: latest?.unitsSold || 0,
        unitType: latest?.unitType || '',
        price: latest?.unitPrice || 0
      };
    }

    const totalRev = relevantRecords.reduce((a, b) => a + b.totalSale, 0);
    const pending = relevantRecords
      .filter(r => r.status !== RecordStatus.VALIDATED && r.status !== RecordStatus.VERIFIED)
      .reduce((a, b) => a + b.coopProfit, 0);
      
    return {
      revenue: totalRev || 0,
      commission: pending,
      units: relevantRecords.reduce((a, b) => a + b.unitsSold, 0) || 0,
      unitType: '',
      price: latest?.unitPrice || 0
    };
  }, [records, isPrivileged, agentIdentity, currentPortal]);

  const filteredRecords = useMemo(() => {
    let base = records;
    if (!isPrivileged) {
      base = base.filter(r => r.agentPhone === agentIdentity?.phone);
    }
    return base;
  }, [records, isPrivileged, agentIdentity]);

  const financeRecords = useMemo(() => {
    return filteredRecords.filter(r => r.status === RecordStatus.PAID);
  }, [filteredRecords]);

  const boardMetrics = useMemo(() => {
    const approvedVerified = records.filter(r => 
      r.status === RecordStatus.VALIDATED || r.status === RecordStatus.VERIFIED
    );
    const totalCommissionValue = approvedVerified.reduce((acc, r) => acc + r.coopProfit, 0);
    
    // Aggregate Commission by Commodity + Date
    const performanceMap = records.reduce((acc, r) => {
      const label = `${r.cropType} (${r.date})`;
      acc[label] = (acc[label] || 0) + r.coopProfit;
      return acc;
    }, {} as Record<string, number>);

    const performanceData = Object.entries(performanceMap)
      .sort((a, b) => {
        const dateA = a[0].match(/\((.*?)\)/)?.[1] || "";
        const dateB = b[0].match(/\((.*?)\)/)?.[1] || "";
        return new Date(dateA).getTime() - new Date(dateB).getTime();
      })
      .slice(-15); // Show latest 15 combined data points

    return { totalCommission: totalCommissionValue, performanceData };
  }, [records]);

  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-[#022c22] flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2"></div>
        
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-500/20 text-emerald-400 rounded-2xl mb-4 border border-emerald-500/30">
              <i className="fas fa-leaf text-xl"></i>
           </div>
           <h1 className="text-2xl font-black text-white uppercase tracking-tighter">Food Coop Hub</h1>
           <p className="text-emerald-400/60 text-[9px] font-black uppercase tracking-[0.4em] mt-2">Identity & Ledger Portal</p>
        </div>

        <div className="w-full max-w-md bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-fade-in z-10">
          <div className="p-8 space-y-5">
            <div className="flex justify-between items-end">
              <div>
                <h2 className="text-xl font-black text-white uppercase tracking-tight">
                  {isRegisterMode ? 'New Account' : 'Secure Login'}
                </h2>
                <p className="text-[9px] text-emerald-400/80 font-black uppercase tracking-widest mt-1">
                  Verified Identity Required
                </p>
              </div>
              <button 
                onClick={() => setIsRegisterMode(!isRegisterMode)}
                className="text-[9px] font-black uppercase text-white/40 hover:text-emerald-400 transition-colors"
              >
                {isRegisterMode ? 'Login Instead' : 'Register Account'}
              </button>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">Full Name</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Barack James"
                    value={authForm.name}
                    onChange={(e) => setAuthForm({...authForm, name: e.target.value})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-white/10"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">Phone Number</label>
                <input 
                  type="tel" 
                  required
                  placeholder="07..."
                  value={authForm.phone}
                  onChange={(e) => setAuthForm({...authForm, phone: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-white/10"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">4-Digit Passcode</label>
                <input 
                  type="password" 
                  maxLength={4}
                  required
                  placeholder="••••"
                  value={authForm.passcode}
                  onChange={(e) => setAuthForm({...authForm, passcode: e.target.value.replace(/\D/g, '')})}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white tracking-[1.2em] text-center focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-white/10"
                />
              </div>

              {isRegisterMode && (
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-white/30 uppercase ml-2 tracking-widest">System Role</label>
                  <select 
                    value={authForm.role}
                    onChange={(e) => setAuthForm({...authForm, role: e.target.value as SystemRole})}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold text-white focus:ring-4 focus:ring-emerald-500/20 outline-none transition-all appearance-none"
                  >
                    {Object.values(SystemRole).map(role => (
                      <option key={role} value={role} className="bg-slate-900">{role}</option>
                    ))}
                  </select>
                </div>
              )}

              <button 
                disabled={isAuthLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-emerald-950 py-5 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-emerald-500/10 active:scale-95 transition-all mt-4"
              >
                {isAuthLoading ? <i className="fas fa-circle-notch fa-spin"></i> : (isRegisterMode ? 'Create Identity' : 'Authenticate')}
              </button>
            </form>
          </div>
        </div>
        
        <p className="mt-8 text-[9px] font-black text-white/20 uppercase tracking-[0.5em] z-10">Secure Multi-Role Distributed Ledger</p>
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
              <div className="bg-emerald-500/20 w-14 h-14 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                <i className="fas fa-leaf text-2xl text-emerald-400"></i>
              </div>
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none">Food Coop Hub</h1>
                <div className="flex items-center space-x-2 mt-2">
                  <span className="bg-emerald-500/20 text-emerald-400 text-[8px] font-black uppercase px-2 py-0.5 rounded border border-emerald-500/20 tracking-widest">{agentIdentity.role}</span>
                  <span className="text-emerald-400/40 text-[10px] font-black uppercase tracking-[0.3em]">Session Verified</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-xl px-6 py-4 rounded-3xl border border-white/10 text-right w-full lg:w-auto shadow-2xl">
              <p className="text-[8px] font-black uppercase tracking-[0.4em] text-emerald-300/60 mb-1">Authenticated: {agentIdentity.name}</p>
              <p className="text-[13px] font-black tracking-tight">{agentIdentity.phone}</p>
              <button 
                onClick={() => setAgentIdentity(null)}
                className="text-[9px] font-black uppercase text-emerald-400 hover:text-white mt-1.5 flex items-center justify-end w-full group"
              >
                <i className="fas fa-user-gear mr-2 text-[8px] opacity-50 group-hover:opacity-100 transition-opacity"></i>
                Switch User
              </button>
            </div>
          </div>

          <div className="mb-10 flex flex-wrap gap-2 animate-fade-in">
            {availablePortals.map(portal => (
              <button
                key={portal}
                onClick={() => setCurrentPortal(portal)}
                className={`px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${
                  currentPortal === portal 
                    ? 'bg-emerald-500 text-emerald-950 border-emerald-400 shadow-lg shadow-emerald-500/20' 
                    : 'bg-white/5 text-emerald-400/60 border-white/5 hover:bg-white/10'
                }`}
              >
                <i className={`fas ${
                  portal === 'SALES' ? 'fa-cart-shopping' : 
                  portal === 'FINANCE' ? 'fa-chart-line' : 
                  portal === 'AUDIT' ? 'fa-shield-halved' : 
                  portal === 'BOARD' ? 'fa-users' : 'fa-id-card-clip'
                } mr-3`}></i>
                {portal.replace('_', ' ')} Portal
              </button>
            ))}
          </div>
          
          {currentPortal === 'SALES' && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                label="Recent Revenue" 
                value={`KSh ${stats.revenue.toLocaleString()}`} 
                icon="fa-sack-dollar" 
                color="bg-white/5" 
              />
              <StatCard 
                label="Commission Ledger" 
                value={typeof stats.commission === 'string' ? stats.commission : `KSh ${stats.commission.toLocaleString()}`} 
                icon="fa-clock-rotate-left" 
                color="bg-white/5" 
              />
              <StatCard 
                label="Recent Volume" 
                value={stats.units > 0 ? `${stats.units} ${stats.unitType}` : stats.units.toLocaleString()} 
                icon="fa-boxes-stacked" 
                color="bg-white/5" 
              />
              <StatCard 
                label="Unit Price" 
                value={`KSh ${stats.price.toLocaleString()}`} 
                icon="fa-tag" 
                color="bg-white/5" 
              />
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-6 -mt-8 space-y-10 relative z-20">
        
        {currentPortal === 'SALES' && (
          <div className="space-y-10 animate-fade-in">
            <SaleForm onSubmit={handleAddRecord} />
          </div>
        )}

        {currentPortal === 'FINANCE' && (
          <div className="space-y-10 animate-fade-in">
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-lg">
                  <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-6">Financial Summary</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-4 border-b border-slate-50">
                      <span className="text-[11px] font-bold text-slate-600">Total Net Revenue</span>
                      <span className="text-[14px] font-black text-slate-900">KSh {stats.revenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center py-4 border-b border-slate-50">
                      <span className="text-[11px] font-bold text-slate-600">Coop Commission (10%)</span>
                      <span className="text-[14px] font-black text-emerald-600">KSh {(stats.revenue * 0.1).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-emerald-900 p-8 rounded-[2rem] text-white shadow-xl flex flex-col justify-center">
                   <p className="text-[9px] font-black uppercase text-emerald-400/60 tracking-[0.4em] mb-2">Payout Availability</p>
                   <h2 className="text-3xl font-black tracking-tight">KSh {stats.commission.toLocaleString()}</h2>
                   <p className="text-[10px] font-bold text-white/40 mt-4 uppercase">Funds awaiting verification</p>
                </div>
             </div>

             <div className="space-y-6">
               <div className="flex items-center justify-between">
                 <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em]">Forwarded Commissions</h3>
                 <span className="px-4 py-1.5 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase border border-blue-100">{financeRecords.length} Awaiting Receipt</span>
               </div>
               
               {financeRecords.length === 0 ? (
                 <div className="bg-white p-16 rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center">
                   <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 text-slate-200">
                     <i className="fas fa-inbox text-2xl"></i>
                   </div>
                   <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">No pending commissions found</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                   {financeRecords.map(r => (
                     <CommissionCard 
                       key={r.id} 
                       record={r} 
                       onApprove={() => handleUpdateStatus(r.id, RecordStatus.VALIDATED)} 
                     />
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">System Audit</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Distributed Ledger Verification Portal</p>
                </div>
                <div className="flex flex-wrap gap-4">
                  <button 
                    onClick={() => exportToCSV(records)}
                    disabled={records.length === 0}
                    className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-black uppercase px-8 py-5 rounded-2xl transition-all border border-emerald-100 flex items-center shadow-sm"
                  >
                    <i className="fas fa-file-excel mr-3"></i>
                    Download Excel Report
                  </button>
                  <button 
                    onClick={handleGenerateReport}
                    disabled={isAnalyzing || records.length === 0}
                    className="bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase px-10 py-5 rounded-2xl transition-all shadow-xl flex items-center"
                  >
                    {isAnalyzing ? <i className="fas fa-brain fa-spin mr-3"></i> : <i className="fas fa-bolt mr-3"></i>}
                    Run AI Integrity Scan
                  </button>
                </div>
             </div>
             
             {aiReport && (
               <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-2xl prose prose-slate max-w-none prose-headings:uppercase prose-headings:tracking-tighter prose-headings:font-black">
                 <h2 className="text-xl mb-6">AI Audit Findings</h2>
                 <div className="whitespace-pre-wrap font-medium text-slate-600 text-[13px] leading-relaxed">
                   {aiReport}
                 </div>
               </div>
             )}
          </div>
        )}

        {isSystemDev && currentPortal === 'IDENTITY' && (
          <div className="space-y-10 animate-fade-in">
             <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
               <div className="p-8 border-b border-slate-50 bg-slate-50/10">
                 <h3 className="text-[11px] font-black text-emerald-600 uppercase tracking-[0.4em]">Global Identity Registry</h3>
                 <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Authenticated system accounts (System Developer Exclusive View)</p>
               </div>
               <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-4">Full Name</th>
                        <th className="px-8 py-4">Role</th>
                        <th className="px-8 py-4">Phone Number</th>
                        <th className="px-8 py-4">Passcode</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {registeredUsers.map((user, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-4 text-[12px] font-black text-slate-900">{user.name}</td>
                          <td className="px-8 py-4">
                            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[10px] font-black uppercase">{user.role}</span>
                          </td>
                          <td className="px-8 py-4 text-[12px] font-bold text-slate-500">{user.phone}</td>
                          <td className="px-8 py-4 text-[12px] font-mono font-bold text-slate-400">****</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
               </div>
             </div>
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="space-y-10 animate-fade-in">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-xl flex flex-col">
                  <div className="flex justify-between items-center mb-10">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Commodity Performance (Commission)</h3>
                    <button 
                      onClick={() => exportToCSV(records)}
                      disabled={records.length === 0}
                      className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-black uppercase px-6 py-4 rounded-2xl transition-all border border-emerald-100 flex items-center shadow-sm"
                    >
                      <i className="fas fa-file-export mr-3"></i>
                      Export Audit Report
                    </button>
                  </div>
                  
                  {/* Performance Chart - Commission per Commodity & Date with Y-Axis Values */}
                  <div className="flex-1 min-h-[450px] flex items-end justify-between pl-16 pr-6 pb-20 pt-8 border-b border-slate-100 relative">
                    {boardMetrics.performanceData.length === 0 ? (
                      <div className="absolute inset-0 flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest">
                        No commission data points found
                      </div>
                    ) : (
                      <>
                        {/* Vertical Y-Axis Numerical Labels */}
                        {(() => {
                          const maxVal = Math.max(...boardMetrics.performanceData.map(d => d[1]), 1);
                          const intervals = [maxVal, maxVal * 0.75, maxVal * 0.5, maxVal * 0.25, 0];
                          return intervals.map((val, idx) => (
                            <div 
                              key={idx} 
                              className="absolute left-2 text-[8px] font-black text-slate-400 pointer-events-none whitespace-nowrap"
                              style={{ bottom: `calc(80px + ${idx === 4 ? 0 : (100 - (idx * 25)) * 0.75}%)`, transform: 'translateY(50%)' }}
                            >
                              {Math.round(val).toLocaleString()}
                            </div>
                          ));
                        })()}

                        {boardMetrics.performanceData.map(([label, value]) => {
                          const maxVal = Math.max(...boardMetrics.performanceData.map(d => d[1]), 1);
                          const heightPercent = (value / maxVal) * 100;
                          return (
                            <div key={label} className="flex-1 flex flex-col items-center group relative h-full justify-end px-1">
                              <div 
                                className="w-full max-w-[40px] bg-blue-500 rounded-t-xl transition-all duration-700 group-hover:bg-blue-600 relative" 
                                style={{ height: `${heightPercent}%` }}
                              >
                                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 font-black shadow-2xl whitespace-nowrap">
                                  KSh {value.toLocaleString()} Commission
                                </div>
                              </div>
                              <span className="absolute -bottom-16 text-[8px] font-black text-slate-400 uppercase rotate-45 origin-left whitespace-nowrap">
                                {label}
                              </span>
                            </div>
                          );
                        })}
                      </>
                    )}
                    {/* Vertical axis legend label */}
                    <div className="absolute -left-10 top-1/2 -rotate-90 text-[8px] font-black text-slate-300 uppercase tracking-widest pointer-events-none">
                      Commission (KSh)
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="bg-emerald-900 p-8 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-[40px] translate-x-1/2 -translate-y-1/2"></div>
                     <p className="text-[9px] font-black text-emerald-400 uppercase tracking-[0.4em] mb-3">Verified Commissions</p>
                     <h2 className="text-4xl font-black tracking-tight mb-2">KSh {boardMetrics.totalCommission.toLocaleString()}</h2>
                     <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Auditor Verified Total</p>
                  </div>

                  <div className="bg-emerald-50 p-8 rounded-[2rem] border border-emerald-100">
                     <p className="text-[9px] font-black text-emerald-600 uppercase tracking-[0.3em] mb-2">Strategic Insight</p>
                     <p className="text-[12px] font-bold text-emerald-900 leading-relaxed italic">
                       "Commission data visualization indicates cycle performance. Higher peaks represent optimized trade windows within the cooperative ledger."
                     </p>
                  </div>
                  
                  <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
                     <p className="text-[9px] font-black text-white/40 uppercase tracking-[0.3em] mb-4">Board Directives</p>
                     <ul className="space-y-3 text-[11px] font-bold">
                       <li className="flex items-center"><i className="fas fa-check-circle text-emerald-400 mr-3"></i> Approve Q2 Dividend</li>
                       <li className="flex items-center"><i className="fas fa-check-circle text-emerald-400 mr-3"></i> Scale Mobile Agent App</li>
                       <li className="flex items-center text-white/40"><i className="fas fa-circle mr-3"></i> New Hub Acquisition</li>
                     </ul>
                  </div>
                </div>
             </div>
          </div>
        )}

        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden animate-fade-in">
           <div className="p-8 border-b border-slate-50">
             <h3 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.4em]">Transaction Audit Log</h3>
             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">Universal Distributed Ledger Monitoring</p>
           </div>
           <Table records={filteredRecords} portal={currentPortal} role={agentIdentity.role} onStatusUpdate={handleUpdateStatus} />
        </div>

      </main>

      <footer className="mt-20 text-center pb-12">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em]">Agricultural Trust Network • v4.0.2</p>
      </footer>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; }
        select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 1.5rem center; background-size: 1rem; }
      `}</style>
    </div>
  );
};

const Table: React.FC<{ 
  records: SaleRecord[], 
  onStatusUpdate?: (id: string, s: RecordStatus) => void,
  portal?: PortalType,
  role?: SystemRole
}> = ({ records, onStatusUpdate, portal, role }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left min-w-[1200px]">
      <thead className="bg-slate-50/50 text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
        <tr>
          <th className="px-8 py-6">Timestamp</th>
          <th className="px-8 py-6">Participants</th>
          <th className="px-8 py-6">Commodity</th>
          <th className="px-8 py-6">Quantity</th>
          <th className="px-8 py-6">Unit Price</th>
          <th className="px-8 py-6">Total Gross</th>
          <th className="px-8 py-6 text-emerald-600">Profit (10%)</th>
          <th className="px-8 py-6">Security</th>
          <th className="px-8 py-6 text-center">Status</th>
          <th className="px-8 py-6 text-center">Action</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-50">
        {records.length === 0 ? (
          <tr>
            <td colSpan={10} className="px-8 py-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px]">No records detected in this node</td>
          </tr>
        ) : records.map(r => (
          <tr key={r.id} className="hover:bg-slate-50/30 transition-colors group">
            <td className="px-8 py-6">
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-slate-900">{r.date}</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{new Date(r.createdAt).toLocaleTimeString()}</span>
              </div>
            </td>
            <td className="px-8 py-6">
              <div className="flex flex-col space-y-3 py-2">
                <div>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Farmer</p>
                  <p className="text-[11px] font-black text-slate-800 leading-none">{r.farmerName}</p>
                  <p className="text-[9px] font-bold text-slate-400">{r.farmerPhone}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest mb-0.5">Customer</p>
                  <p className="text-[11px] font-black text-slate-800 leading-none">{r.customerName}</p>
                  <p className="text-[9px] font-bold text-slate-400">{r.customerPhone}</p>
                </div>
                <div>
                  <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Field Agent</p>
                  <p className="text-[11px] font-black text-emerald-800 leading-none">{r.agentName || 'System Record'}</p>
                  <p className="text-[9px] font-bold text-emerald-600/60">{r.agentPhone}</p>
                </div>
              </div>
            </td>
            <td className="px-8 py-6">
              <span className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[10px] uppercase tracking-wider">{r.cropType}</span>
            </td>
            <td className="px-8 py-6">
              <span className="text-[13px] font-black text-slate-900">{r.unitsSold}</span>
              <span className="text-[10px] text-slate-400 ml-2 uppercase font-bold">{r.unitType}</span>
            </td>
            <td className="px-8 py-6 text-[12px] font-bold text-slate-500">KSh {r.unitPrice.toLocaleString()}</td>
            <td className="px-8 py-6 text-[13px] font-black text-slate-900">KSh {r.totalSale.toLocaleString()}</td>
            <td className="px-8 py-6 text-[13px] font-black text-emerald-600 bg-emerald-50/20">KSh {r.coopProfit.toLocaleString()}</td>
            <td className="px-8 py-6"><SecurityBadge record={r} /></td>
            <td className="px-8 py-6 text-center">
              <span className={`text-[9px] font-black uppercase px-4 py-2 rounded-xl border shadow-sm ${
                r.status === RecordStatus.VERIFIED ? 'bg-emerald-900 text-white border-emerald-800' :
                r.status === RecordStatus.VALIDATED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                r.status === RecordStatus.PAID ? 'bg-blue-50 text-blue-600 border-blue-100' :
                'bg-amber-50 text-amber-600 border-amber-100'
              }`}>
                {r.status}
              </span>
            </td>
            <td className="px-8 py-6 text-center">
              {portal === 'SALES' && r.status === RecordStatus.DRAFT && (
                <button 
                  onClick={() => onStatusUpdate?.(r.id, RecordStatus.PAID)}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                >
                  Forward to Finance
                </button>
              )}
              {portal === 'FINANCE' && r.status === RecordStatus.PAID && (
                <button 
                  onClick={() => onStatusUpdate?.(r.id, RecordStatus.VALIDATED)}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                >
                  Approve Receipt
                </button>
              )}
              {portal === 'AUDIT' && r.status === RecordStatus.VALIDATED && (
                <button 
                  onClick={() => onStatusUpdate?.(r.id, RecordStatus.VERIFIED)}
                  className="bg-emerald-900 hover:bg-black text-white text-[9px] font-black uppercase px-4 py-2 rounded-xl transition-all shadow-md active:scale-95"
                >
                  Stap & Verify
                </button>
              )}
              {r.status === RecordStatus.VERIFIED && (
                <span className="text-[10px] text-emerald-800 font-bold uppercase tracking-widest italic opacity-80">
                  <i className="fas fa-check-double mr-2"></i>Fully Verified
                </span>
              )}
              {r.status === RecordStatus.PAID && portal !== 'FINANCE' && (
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest italic opacity-50">Pending Approval</span>
              )}
              {r.status === RecordStatus.VALIDATED && portal !== 'AUDIT' && (
                <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest italic opacity-50">Validated</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default App;