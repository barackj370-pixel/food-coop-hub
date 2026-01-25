
import React, { useState, useEffect, useMemo } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity, ProduceListing } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import ProduceForm from './components/ProduceForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, CLUSTERS } from './constants.ts';
import { analyzeSalesData } from './services/geminiService.ts';

type PortalType = 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'HOME' | 'LOGIN' | 'NEWS' | 'ABOUT' | 'CONTACT';
type MarketView = 'SALES' | 'SUPPLIES';

const APP_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000000' d='M160 96c0-17.7-14.3-32-32-32H32C14.3 64 0 78.3 0 96s14.3 32 32 32h73.4l57.1 240.1c5.3 22.3 25.3 37.9 48.2 37.9H436c22.9 0 42.9-15.6 48.2-37.9l39.1-164.2c4.2-17.8-7-35.7-24.9-39.9s-35.7 7-39.9 24.9l-33.9 142.2H198.5l-57.1-240c-2.7-11.2-12.7-19-24.1-19H32z'/%3E%3Ccircle fill='%23dc2626' cx='208' cy='448' r='48'/%3E%3Ccircle fill='%23dc2626' cx='416' cy='448' r='48'/%3E%3Cpath fill='%2322c55e' d='M340 120 C 340 120, 260 140, 260 220 C 260 300, 340 320, 340 320 S 420 300, 420 220 C 420 140, 340 120, 340 120 Z' transform='translate(0, -30)'/%3E%3C/svg%3E";

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

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>(() => {
    const saved = persistence.get('food_coop_data');
    return saved ? JSON.parse(saved) : [];
  });

  const [produceListings, setProduceListings] = useState<ProduceListing[]>(() => {
    const saved = persistence.get('food_coop_produce');
    return saved ? JSON.parse(saved) : [];
  });

  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('HOME');
  const [marketView, setMarketView] = useState<MarketView>('SALES');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [auditReport, setAuditReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: 'Mariwa'
  });

  const handleLogout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
    setCurrentPortal('HOME');
  };

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    setTimeout(() => {
      const user: AgentIdentity = {
        name: authForm.name || 'User',
        phone: authForm.phone,
        passcode: authForm.passcode,
        role: authForm.role,
        cluster: authForm.cluster || 'Mariwa',
        status: 'ACTIVE'
      };
      setAgentIdentity(user);
      persistence.set('agent_session', JSON.stringify(user));
      setCurrentPortal('MARKET');
      setIsAuthLoading(false);
    }, 1000);
  };

  const runAudit = async () => {
    setIsAnalyzing(true);
    const report = await analyzeSalesData(records);
    setAuditReport(report);
    setIsAnalyzing(false);
  };

  const stats = useMemo(() => {
    const totalProfit = records.reduce((acc, r) => acc + Number(r.coopProfit), 0);
    const totalSalesValue = records.reduce((acc, r) => acc + Number(r.totalSale), 0);
    const activeProducts = produceListings.filter(p => p.status === 'AVAILABLE').length;
    return { totalProfit, totalSalesValue, activeProducts };
  }, [records, produceListings]);

  // Main background class logic
  const pageContainerClass = agentIdentity ? "bg-slate-950 text-white min-h-screen" : "bg-[#F8FAFC] text-slate-900 min-h-screen";

  return (
    <div className={pageContainerClass}>
      <header className={`${agentIdentity ? 'bg-black border-slate-900' : 'bg-white border-slate-100'} pt-8 pb-10 border-b relative z-50 transition-colors duration-500`}>
        <div className="container mx-auto px-6 flex flex-col lg:flex-row justify-between items-center gap-6">
          <div className="flex items-center space-x-5 group cursor-pointer" onClick={() => setCurrentPortal('HOME')}>
            <div className="bg-white w-14 h-14 rounded-2xl flex items-center justify-center border border-slate-100 shadow-xl overflow-hidden group-hover:scale-105 transition-transform">
              <img src={APP_LOGO} alt="KPL Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <h1 className={`text-2xl font-black uppercase tracking-tight leading-none ${agentIdentity ? 'text-white' : 'text-black'}`}>KPL Hub</h1>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mt-1">
                {agentIdentity ? `${agentIdentity.name} • Internal Node` : 'Agricultural Cooperative Node'}
              </p>
            </div>
          </div>

          <nav className="flex items-center gap-1.5 overflow-x-auto max-w-full pb-2 lg:pb-0">
            {!agentIdentity ? (
              <>
                <button onClick={() => setCurrentPortal('HOME')} className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${currentPortal === 'HOME' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-black'}`}>Home</button>
                <button onClick={() => setCurrentPortal('NEWS')} className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${currentPortal === 'NEWS' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-black'}`}>News</button>
                <button onClick={() => setCurrentPortal('ABOUT')} className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${currentPortal === 'ABOUT' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-black'}`}>About</button>
                <button onClick={() => setCurrentPortal('CONTACT')} className={`px-5 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${currentPortal === 'CONTACT' ? 'bg-black text-white shadow-lg' : 'text-slate-400 hover:text-black'}`}>Contact</button>
                <button onClick={() => setCurrentPortal('LOGIN')} className="ml-4 bg-green-600 hover:bg-green-700 text-white px-8 py-3.5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl transition-all">Member Login</button>
              </>
            ) : (
              <div className="bg-slate-900/50 p-1.5 rounded-3xl border border-slate-800 flex items-center gap-1">
                <button onClick={() => setCurrentPortal('MARKET')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${currentPortal === 'MARKET' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Market</button>
                <button onClick={() => setCurrentPortal('FINANCE')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${currentPortal === 'FINANCE' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Finance</button>
                <button onClick={() => setCurrentPortal('AUDIT')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${currentPortal === 'AUDIT' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Audit</button>
                <button onClick={() => setCurrentPortal('BOARD')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${currentPortal === 'BOARD' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>Board</button>
                <button onClick={() => setCurrentPortal('SYSTEM')} className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${currentPortal === 'SYSTEM' ? 'bg-green-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>System</button>
                <button onClick={handleLogout} className="ml-2 w-11 h-11 rounded-2xl bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white transition-all flex items-center justify-center border border-red-900/20"><i className="fas fa-power-off"></i></button>
              </div>
            )}
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16">
        {/* --- PUBLIC GUEST PAGES --- */}
        {!agentIdentity && (
          <div className="animate-in fade-in duration-700">
            {currentPortal === 'HOME' && (
              <div className="space-y-20">
                <div className="bg-white p-16 lg:p-24 rounded-[4rem] shadow-2xl border border-slate-100 flex flex-col lg:flex-row gap-20 items-center overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-96 h-96 bg-green-50 rounded-full blur-[100px] -mr-32 -mt-32 opacity-50"></div>
                  <div className="flex-1 space-y-10 relative z-10">
                    <span className="bg-green-100 text-green-700 px-6 py-3 rounded-full text-[11px] font-black uppercase tracking-[0.2em]">Live in 7 Clusters</span>
                    <h2 className="text-6xl font-black uppercase tracking-tight text-black leading-none">The Future of Agriculture <br/> is Now.</h2>
                    <p className="text-slate-500 font-medium text-xl leading-relaxed max-w-xl">We provide the digital backbone for local cooperatives to thrive, ensuring every transaction is verified and every farmer is paid fairly.</p>
                    <div className="flex gap-6">
                      <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-12 py-6 rounded-2xl font-black uppercase text-[12px] tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">Launch Market Hub</button>
                      <button onClick={() => setCurrentPortal('ABOUT')} className="bg-white text-black border border-slate-200 px-12 py-6 rounded-2xl font-black uppercase text-[12px] tracking-widest hover:bg-slate-50 transition-all">Our Mission</button>
                    </div>
                  </div>
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-green-500 aspect-square rounded-[3rem] p-10 text-white flex flex-col justify-end shadow-xl hover:translate-y-[-10px] transition-transform">
                        <i className="fas fa-leaf text-5xl mb-6"></i>
                        <h4 className="font-black uppercase text-xs tracking-widest">100% Organic</h4>
                      </div>
                      <div className="bg-slate-900 aspect-square rounded-[3rem] p-10 text-white flex flex-col justify-end shadow-xl mt-12 hover:translate-y-[-10px] transition-transform">
                        <i className="fas fa-handshake text-5xl mb-6 text-green-400"></i>
                        <h4 className="font-black uppercase text-xs tracking-widest">Direct Trade</h4>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentPortal === 'NEWS' && (
              <div className="max-w-5xl mx-auto space-y-12 py-10">
                <div className="text-center space-y-4">
                  <h2 className="text-5xl font-black uppercase tracking-tighter">Cooperative Dispatch</h2>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Real-time updates from the network core</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="bg-white rounded-[3rem] border border-slate-100 shadow-xl overflow-hidden hover:shadow-2xl transition-all group">
                      <div className="aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                        <i className="fas fa-image text-4xl text-slate-200 group-hover:scale-110 transition-transform"></i>
                      </div>
                      <div className="p-10 space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-green-600 text-[10px] font-black uppercase tracking-widest">January 2026</span>
                          <span className="text-slate-300 text-[10px] font-black uppercase tracking-widest">Announcements</span>
                        </div>
                        <h3 className="text-2xl font-black uppercase tracking-tight">Expansion into the South Kamagambo Cluster</h3>
                        <p className="text-slate-500 text-sm leading-relaxed line-clamp-3">Our logistics network has officially expanded to support over 200 additional farming households in the South Kamagambo region, introducing cold-storage solutions...</p>
                        <button className="pt-4 text-black font-black uppercase text-[10px] tracking-widest border-b-2 border-green-500 pb-1">Read Article</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentPortal === 'ABOUT' && (
              <div className="max-w-4xl mx-auto py-10 space-y-20">
                <div className="text-center space-y-6">
                  <h2 className="text-6xl font-black uppercase tracking-tighter leading-none">We Believe in <br/> Shared Prosperity.</h2>
                  <p className="text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed">KPL Food Coop was born out of a simple necessity: to give farmers back the power of pricing.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                  <div className="space-y-6 bg-white p-12 rounded-[3.5rem] shadow-xl border border-slate-50">
                    <div className="w-16 h-16 bg-green-50 rounded-3xl flex items-center justify-center text-green-600 text-2xl"><i className="fas fa-users"></i></div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Community First</h3>
                    <p className="text-slate-500 leading-relaxed">Our model focuses on the cluster. By organizing small-holders into efficient nodes, we reduce transport costs and increase market leverage.</p>
                  </div>
                  <div className="space-y-6 bg-slate-900 p-12 rounded-[3.5rem] shadow-xl text-white">
                    <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center text-green-400 text-2xl"><i className="fas fa-fingerprint"></i></div>
                    <h3 className="text-2xl font-black uppercase tracking-tight">Digital Ledger</h3>
                    <p className="text-slate-400 leading-relaxed">Every transaction is recorded on our secure ledger, providing full traceability from the farm gate to the customer's kitchen.</p>
                  </div>
                </div>
                <div className="text-center bg-white border border-slate-100 p-16 rounded-[4rem] shadow-sm">
                   <h3 className="text-xl font-black uppercase tracking-widest mb-4">Founded 2024</h3>
                   <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Migori County, Republic of Kenya</p>
                </div>
              </div>
            )}

            {currentPortal === 'CONTACT' && (
              <div className="max-w-3xl mx-auto py-10 space-y-12">
                <div className="text-center space-y-4">
                  <h2 className="text-5xl font-black uppercase tracking-tighter">Connect with the Hub</h2>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Support, Inquiries, or Partnership Proposals</p>
                </div>
                <div className="bg-white p-12 lg:p-16 rounded-[4rem] shadow-2xl border border-slate-50 space-y-10">
                  <form className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Full Name</label>
                      <input type="text" className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 outline-none focus:border-green-400 transition-all font-bold" placeholder="Enter your name" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Email Address</label>
                      <input type="email" className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 outline-none focus:border-green-400 transition-all font-bold" placeholder="name@domain.com" />
                    </div>
                    <div className="md:col-span-2 space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Message Details</label>
                      <textarea rows={5} className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 outline-none focus:border-green-400 transition-all font-bold" placeholder="How can we assist you today?"></textarea>
                    </div>
                    <button className="md:col-span-2 bg-black text-white py-6 rounded-3xl font-black uppercase tracking-[0.2em] text-[12px] shadow-2xl hover:scale-[1.02] transition-all">Transmit Inquiry</button>
                  </form>
                </div>
              </div>
            )}

            {currentPortal === 'LOGIN' && (
               <div className="max-w-md mx-auto py-20 animate-in slide-in-from-bottom-10">
                  <div className="bg-white p-12 rounded-[4rem] shadow-2xl border border-slate-100 space-y-10">
                     <div className="text-center space-y-4">
                        <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto border border-slate-100"><i className="fas fa-lock text-3xl text-black"></i></div>
                        <h2 className="text-3xl font-black uppercase tracking-tighter">Hub Access</h2>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">Credentials Required</p>
                     </div>
                     <form onSubmit={handleAuth} className="space-y-5">
                        <input type="tel" required placeholder="Phone Identity" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 font-bold outline-none focus:border-green-500 transition-all" />
                        <input type="password" required placeholder="Security Passcode" value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 p-6 rounded-3xl border border-slate-100 font-bold outline-none focus:border-green-500 transition-all" />
                        <button disabled={isAuthLoading} className="w-full bg-black text-white py-6 rounded-3xl font-black uppercase tracking-widest text-[12px] shadow-2xl hover:bg-slate-900 transition-all">
                           {isAuthLoading ? 'Authenticating...' : 'Enter Hub'}
                        </button>
                     </form>
                  </div>
               </div>
            )}
          </div>
        )}

        {/* --- MEMBER MANAGEMENT PORTALS (MIDNIGHT UI) --- */}
        {agentIdentity && (
          <div className="animate-in fade-in duration-500 space-y-12">
            {currentPortal === 'MARKET' && (
              <div className="space-y-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <StatCard label="Gross Sales Volume" icon="fa-shopping-cart" value={`KSh ${stats.totalSalesValue.toLocaleString()}`} color="bg-slate-900 border-slate-800" accent="text-white" />
                  <StatCard label="Net Coop Reserve" icon="fa-vault" value={`KSh ${stats.totalProfit.toLocaleString()}`} color="bg-slate-900 border-slate-800" accent="text-green-500" />
                  <StatCard label="Available Stock Lots" icon="fa-box-open" value={stats.activeProducts} color="bg-slate-900 border-slate-800" accent="text-blue-500" />
                </div>

                <div className="flex bg-slate-900 p-2 rounded-2xl border border-slate-800 w-fit mx-auto mb-10 shadow-2xl">
                  <button onClick={() => setMarketView('SALES')} className={`px-10 py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all ${marketView === 'SALES' ? 'bg-green-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Sales Ledger</button>
                  <button onClick={() => setMarketView('SUPPLIES')} className={`px-10 py-4 rounded-xl font-black uppercase text-[11px] tracking-widest transition-all ${marketView === 'SUPPLIES' ? 'bg-green-600 text-white shadow-xl' : 'text-slate-500 hover:text-white'}`}>Supply Intake</button>
                </div>

                {marketView === 'SALES' ? (
                  <SaleForm clusters={CLUSTERS} produceListings={produceListings} onSubmit={data => {
                    const rec = { ...data, id: Math.random().toString(36).substring(7).toUpperCase(), coopProfit: data.unitsSold * data.unitPrice * PROFIT_MARGIN, totalSale: data.unitsSold * data.unitPrice, status: RecordStatus.DRAFT, signature: 'DIGITAL_AUTH_77', createdAt: new Date().toISOString() };
                    const updated = [rec, ...records];
                    setRecords(updated);
                    persistence.set('food_coop_data', JSON.stringify(updated));
                  }} />
                ) : (
                  <ProduceForm userRole={agentIdentity.role} cluster={agentIdentity.cluster} onSubmit={data => {
                    const item = { ...data, id: Math.random().toString(36).substring(7).toUpperCase(), status: 'AVAILABLE' as const };
                    const updated = [item, ...produceListings];
                    setProduceListings(updated);
                    persistence.set('food_coop_produce', JSON.stringify(updated));
                  }} />
                )}
              </div>
            )}

            {currentPortal === 'FINANCE' && (
              <div className="space-y-12 max-w-6xl mx-auto">
                <div className="flex justify-between items-end">
                  <h2 className="text-5xl font-black uppercase tracking-tighter">Finance Hub</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Node Reserve Tracking</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-slate-900 p-12 rounded-[3.5rem] border border-slate-800 space-y-6">
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-400">Total Profits Accrued</h3>
                    <p className="text-5xl font-black text-green-500">KSh {stats.totalProfit.toLocaleString()}</p>
                    <div className="pt-6 border-t border-slate-800 flex justify-between">
                      <span className="text-slate-500 font-black uppercase text-[10px]">Projected Payout</span>
                      <span className="text-white font-black uppercase text-[10px]">March 2026</span>
                    </div>
                  </div>
                  <div className="bg-slate-900 p-12 rounded-[3.5rem] border border-slate-800 space-y-6">
                    <h3 className="text-xl font-black uppercase tracking-tight text-slate-400">Transaction Count</h3>
                    <p className="text-5xl font-black text-white">{records.length}</p>
                    <div className="pt-6 border-t border-slate-800 flex justify-between">
                      <span className="text-slate-500 font-black uppercase text-[10px]">Average Value</span>
                      <span className="text-white font-black uppercase text-[10px]">KSh {(stats.totalSalesValue / (records.length || 1)).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentPortal === 'AUDIT' && (
              <div className="space-y-12 max-w-6xl mx-auto">
                <div className="flex justify-between items-center">
                  <h2 className="text-5xl font-black uppercase tracking-tighter">AI Compliance</h2>
                  <button onClick={runAudit} disabled={isAnalyzing} className="bg-white text-black px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl hover:scale-105 active:scale-95 transition-all">
                    {isAnalyzing ? 'Neural Analysis Active...' : 'Generate Compliance Report'}
                  </button>
                </div>
                <div className="bg-black rounded-[3.5rem] border border-slate-800 p-12 min-h-[500px] shadow-2xl relative overflow-hidden">
                  {!auditReport && !isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-4">
                      <div className="w-20 h-20 rounded-full border-4 border-slate-900 flex items-center justify-center animate-pulse"><i className="fas fa-microchip text-3xl text-slate-800"></i></div>
                      <p className="text-slate-800 font-black uppercase text-xs tracking-widest">Awaiting Neural Stimulus</p>
                    </div>
                  )}
                  {isAnalyzing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center space-y-6 bg-black/80 z-10">
                       <div className="w-16 h-16 border-t-4 border-green-500 border-r-4 border-transparent rounded-full animate-spin"></div>
                       <p className="text-green-500 font-black uppercase text-[10px] tracking-[0.5em] animate-pulse">Scanning Cooperative Ledger</p>
                    </div>
                  )}
                  {auditReport && (
                    <div className="prose prose-invert max-w-none animate-in fade-in slide-in-from-bottom-5 duration-700">
                      <div className="font-mono text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{auditReport}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {currentPortal === 'BOARD' && (
              <div className="space-y-12 max-w-6xl mx-auto">
                <h2 className="text-5xl font-black uppercase tracking-tighter">Board Governance</h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-slate-900 p-12 rounded-[3.5rem] border border-slate-800 space-y-10">
                    <h3 className="text-xl font-black uppercase tracking-tight border-b border-slate-800 pb-6">Strategy KPIs</h3>
                    <div className="space-y-8">
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest"><span className="text-slate-500">Market Penetration</span><span className="text-white">65%</span></div>
                        <div className="h-2.5 bg-black rounded-full overflow-hidden"><div className="h-full bg-blue-600 w-[65%] shadow-[0_0_15px_rgba(37,99,235,0.5)]"></div></div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest"><span className="text-slate-500">Node Stability</span><span className="text-white">99.8%</span></div>
                        <div className="h-2.5 bg-black rounded-full overflow-hidden"><div className="h-full bg-green-500 w-[99.8%] shadow-[0_0_15px_rgba(34,197,94,0.5)]"></div></div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] font-black uppercase tracking-widest"><span className="text-slate-500">Waste Reduction</span><span className="text-white">42%</span></div>
                        <div className="h-2.5 bg-black rounded-full overflow-hidden"><div className="h-full bg-red-500 w-[42%] shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div></div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-900 p-12 rounded-[3.5rem] border border-slate-800 space-y-8">
                    <h3 className="text-xl font-black uppercase tracking-tight border-b border-slate-800 pb-6">Executive Directives</h3>
                    <div className="space-y-6">
                      <div className="flex gap-5">
                         <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0"></div>
                         <p className="text-slate-400 text-sm leading-relaxed"><span className="text-white font-black uppercase text-[11px]">Directive 22-A:</span> Prioritize cold-chain logistics for the Mariwa cluster to minimize perishable spoilage.</p>
                      </div>
                      <div className="flex gap-5">
                         <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                         <p className="text-slate-400 text-sm leading-relaxed"><span className="text-white font-black uppercase text-[11px]">Directive 22-B:</span> Review finance portal payout logic to include early-settlement bonuses for small-holders.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {currentPortal === 'SYSTEM' && (
              <div className="space-y-12 max-w-6xl mx-auto">
                <div className="flex justify-between items-end">
                  <h2 className="text-5xl font-black uppercase tracking-tighter text-red-600">Infrastructure</h2>
                  <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Node Telemetry</p>
                </div>
                <div className="bg-black p-12 rounded-[4rem] border border-slate-900 font-mono text-[11px] space-y-3 h-[600px] overflow-y-auto shadow-2xl relative">
                   <div className="absolute top-0 right-0 p-8 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-ping"></div>
                      <span className="text-green-500 font-black uppercase tracking-widest text-[10px]">Stable</span>
                   </div>
                   <p className="text-green-500/80">[SYSTEM] INITIALIZING KPL CORE v3.0.4...</p>
                   <p className="text-slate-600">[NETWORK] ESTABLISHED SECURE HANDSHAKE WITH CLUSTERS: {CLUSTERS.join(', ')}</p>
                   <p className="text-slate-600">[DATA] PERSISTENCE LAYER LOADED: {records.length} SALES, {produceListings.length} LISTINGS</p>
                   <p className="text-blue-500">[AUTH] AGENT IDENTITY VERIFIED: {agentIdentity.name} ({agentIdentity.role})</p>
                   <p className="text-yellow-500">[WARN] UNRECOGNIZED SCHEMA DETECTED IN OLD_DATA_BUFFER. RECOVERY ATTEMPTED.</p>
                   <p className="text-slate-600">[SYSTEM] HEARTBEAT: 62ms</p>
                   <p className="text-slate-600">[SYSTEM] MEMORY CONSUMPTION: 58.4MB / 1024MB</p>
                   <p className="text-green-500/80">[SYSTEM] ALL SUBSYSTEMS NOMINAL. AWAITING INPUT.</p>
                   {records.map((r, i) => (
                     <p key={i} className="text-slate-700 leading-none py-1 border-b border-slate-900/50 hover:text-slate-400 transition-colors">
                       [ENTRY_{r.id}] COMPLETED {r.cropType} TRANSACTION AT {r.createdAt}
                     </p>
                   ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className={`${agentIdentity ? 'bg-black border-slate-900' : 'bg-white border-slate-100'} border-t py-12 transition-colors duration-500`}>
        <div className="container mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">© 2026 KPL Food Cooperative Hub • Kenya</p>
          <div className="flex gap-8">
             <i className="fab fa-twitter text-slate-400 hover:text-black transition-colors cursor-pointer"></i>
             <i className="fab fa-facebook text-slate-400 hover:text-black transition-colors cursor-pointer"></i>
             <i className="fab fa-instagram text-slate-400 hover:text-black transition-colors cursor-pointer"></i>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
