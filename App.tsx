
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SaleRecord, RecordStatus, OrderStatus, SystemRole, AgentIdentity, AccountStatus, MarketOrder, ProduceListing } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import ProduceForm from './components/ProduceForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, GOOGLE_SHEET_VIEW_URL, COMMODITY_CATEGORIES, CROP_CONFIG } from './constants.ts';
import { analyzeSalesData } from './services/geminiService.ts';
import { 
  syncToGoogleSheets, 
  fetchFromGoogleSheets, 
  syncUserToCloud, 
  fetchUsersFromCloud, 
  deleteRecordFromCloud, 
  deleteUserFromCloud,
  deleteAllUsersFromCloud,
  deleteProduceFromCloud,
  deleteAllProduceFromCloud,
  syncOrderToCloud,
  fetchOrdersFromCloud,
  syncProduceToCloud,
  fetchProduceFromCloud,
  deleteAllOrdersFromCloud,
  deleteAllRecordsFromCloud
} from './services/googleSheetsService.ts';

type PortalType = 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'HOME' | 'ABOUT' | 'CONTACT' | 'LOGIN' | 'NEWS';
type MarketView = 'SUPPLIER' | 'SALES' | 'CUSTOMER';

export const CLUSTERS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana'];

const APP_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000000' d='M160 96c0-17.7-14.3-32-32-32H32C14.3 64 0 78.3 0 96s14.3 32 32 32h73.4l57.1 240.1c5.3 22.3 25.3 37.9 48.2 37.9H436c22.9 0 42.9-15.6 48.2-37.9l39.1-164.2c4.2-17.8-7-35.7-24.9-39.9s-35.7 7-39.9 24.9l-33.9 142.2H198.5l-57.1-240c-2.7-11.2-12.7-19-24.1-19H32z'/%3E%3Ccircle fill='%23dc2626' cx='208' cy='448' r='48'/%3E%3Ccircle fill='%23dc2626' cx='416' cy='448' r='48'/%3E%3Cpath fill='%2322c55e' d='M340 120 C 340 120, 260 140, 260 220 C 260 300, 340 320, 340 320 S 420 300, 420 220 C 420 140, 340 120, 340 120 Z' transform='translate(0, -30)'/%3E%3Cpath fill='none' stroke='%2322c55e' stroke-width='12' stroke-linecap='round' d='M340 320 L 340 360' transform='translate(0, -30)'/%3E%3Cpath fill='white' d='M340 150 L 340 290' stroke='white' stroke-width='4' stroke-linecap='round' transform='translate(0, -30)'/%3E%3C/svg%3E";

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

const normalizePhone = (p: any) => {
  let s = String(p || '').trim();
  const clean = s.replace(/\D/g, '');
  return clean.length >= 9 ? clean.slice(-9) : clean;
};

const normalizePasscode = (p: any) => {
  let s = String(p || '').trim();
  return s.replace(/\D/g, '');
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>([]);
  const [produceListings, setProduceListings] = useState<ProduceListing[]>([]);
  const [users, setUsers] = useState<AgentIdentity[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('HOME');
  const [marketView, setMarketView] = useState<MarketView>('SUPPLIER');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const syncLock = useRef(false);

  const [authForm, setAuthForm] = useState({
    name: '', phone: '', passcode: '', role: SystemRole.FIELD_AGENT, cluster: ''
  });

  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER;

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
      
      setLastSyncTime(new Date());
    } catch (e) { 
      console.error("Global Sync failed:", e); 
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, []);

  useEffect(() => { loadCloudData(); }, [loadCloudData]);

  useEffect(() => {
    const interval = setInterval(() => { loadCloudData(); }, SYNC_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [loadCloudData]);

  const stats = useMemo(() => {
    const totalVolume = records.reduce((a, b) => a + Number(b.totalSale), 0);
    const totalProfit = records.reduce((a, b) => a + Number(b.coopProfit), 0);
    const verified = records.filter(r => r.status === RecordStatus.VERIFIED).length;
    const pending = records.filter(r => r.status !== RecordStatus.VERIFIED).length;
    return { totalVolume, totalProfit, verified, pending };
  }, [records]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const targetPhone = normalizePhone(authForm.phone);
    const targetPass = normalizePasscode(authForm.passcode);

    try {
      const authPool = await fetchUsersFromCloud() || users;
      if (isRegisterMode) {
        const newUser: AgentIdentity = {
          name: authForm.name,
          phone: authForm.phone,
          passcode: targetPass,
          role: authForm.role,
          cluster: authForm.cluster || 'N/A',
          status: 'ACTIVE'
        };
        await syncUserToCloud(newUser);
        setAgentIdentity(newUser);
        persistence.set('agent_session', JSON.stringify(newUser));
        setCurrentPortal('HOME');
      } else {
        const user = authPool.find(u => normalizePhone(u.phone) === targetPhone && normalizePasscode(u.passcode) === targetPass);
        if (user) {
          setAgentIdentity(user);
          persistence.set('agent_session', JSON.stringify(user));
          setCurrentPortal('HOME');
        } else {
          alert("Invalid credentials.");
        }
      }
    } catch (err) {
      alert("Authentication error.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const runAiAudit = async () => {
    setIsAiAnalyzing(true);
    try {
      const report = await analyzeSalesData(records);
      setAiReport(report);
    } catch (e) {
      setAiReport("Failed to generate AI audit.");
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const renderHome = () => (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-12 items-center">
        <div className="flex-1 space-y-6">
          <div className="inline-block bg-green-50 px-4 py-2 rounded-full border border-green-100">
            <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">Bridging the Agricultural Gap</p>
          </div>
          <h2 className="text-5xl font-black uppercase tracking-tight text-black leading-none">Connecting Suppliers with Consumers</h2>
          <p className="text-slate-600 font-medium leading-relaxed text-lg">
            KPL Food Coop Market is a next-generation platform empowering local clusters with real-time trade tools, 
            secure financial auditing, and AI-driven market intelligence.
          </p>
          <div className="flex gap-4 pt-4">
            <button onClick={() => setCurrentPortal('MARKET')} className="bg-black text-white px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-2xl hover:bg-slate-800 transition-all">Enter Market</button>
            <button onClick={() => setCurrentPortal('ABOUT')} className="bg-white text-black border border-slate-200 px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-50 transition-all">Learn More</button>
          </div>
        </div>
        <div className="flex-1 grid grid-cols-2 gap-6 w-full">
           <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
              <p className="text-4xl font-black text-black">{users.length}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2">Active Members</p>
           </div>
           <div className="bg-red-50 p-8 rounded-[2.5rem] border border-red-100">
              <p className="text-4xl font-black text-red-600">{records.length}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2">Trade Records</p>
           </div>
           <div className="bg-green-50 p-8 rounded-[2.5rem] border border-green-100 col-span-2">
              <p className="text-4xl font-black text-green-600">KSh {stats.totalVolume.toLocaleString()}</p>
              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mt-2">Gross Trade Volume</p>
           </div>
        </div>
      </div>
    </div>
  );

  const renderNews = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h2 className="text-3xl font-black uppercase tracking-tight text-black">Coop Feed & Updates</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {[
          { date: 'Oct 24, 2023', title: 'New Maize Pricing Guidelines', content: 'The cooperative board has released new floor prices for grade 1 maize in the Mariwa cluster.' },
          { date: 'Oct 22, 2023', title: 'Audit Portal v2.5 Released', content: 'Our new AI-driven anomaly detection is now live for all Audit Officers.' },
          { date: 'Oct 20, 2023', title: 'Expansion to Kabarnet', content: 'Welcome our newest cluster! Kabarnet suppliers can now list produce on the storefront.' }
        ].map((news, i) => (
          <div key={i} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all">
            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-3">{news.date}</p>
            <h3 className="text-xl font-black text-black uppercase mb-3">{news.title}</h3>
            <p className="text-slate-500 font-medium leading-relaxed">{news.content}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 py-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-black uppercase tracking-tighter text-black">Our Mission</h2>
        <div className="w-20 h-1.5 bg-green-500 mx-auto rounded-full"></div>
      </div>
      <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 space-y-8">
        <p className="text-xl font-medium text-slate-700 leading-loose">
          KPL Food Coop Market was founded to eliminate the inefficiencies in rural agricultural trade. By providing direct digital links between 
          local small-holder farmers and regional consumers, we ensure that producers get fair prices and buyers get the freshest quality.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8">
          <div className="space-y-3">
             <i className="fas fa-shield-alt text-3xl text-red-600"></i>
             <h4 className="font-black uppercase text-sm">Integrity</h4>
             <p className="text-slate-500 text-sm font-medium">Every transaction is audited and verified for absolute transparency.</p>
          </div>
          <div className="space-y-3">
             <i className="fas fa-bolt text-3xl text-green-500"></i>
             <h4 className="font-black uppercase text-sm">Efficiency</h4>
             <p className="text-slate-500 text-sm font-medium">Instant trade committed to cloud storage with zero paperwork.</p>
          </div>
          <div className="space-y-3">
             <i className="fas fa-users text-3xl text-black"></i>
             <h4 className="font-black uppercase text-sm">Community</h4>
             <p className="text-slate-500 text-sm font-medium">Owned and operated by the very clusters it serves.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in duration-500">
      <div className="space-y-8">
        <h2 className="text-4xl font-black uppercase tracking-tighter text-black">Get in Touch</h2>
        <p className="text-lg font-medium text-slate-500">Questions about joining a cluster or using the auditing tools? Our team is here to help.</p>
        <div className="space-y-6">
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm text-black"><i className="fas fa-map-marker-alt"></i></div>
              <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Office</p><p className="font-bold">Mariwa Market Complex, Unit 4</p></div>
           </div>
           <div className="flex items-center gap-6">
              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm text-black"><i className="fas fa-phone"></i></div>
              <div><p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Phone</p><p className="font-bold">+254 700 000 000</p></div>
           </div>
        </div>
      </div>
      <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl">
         <form className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
               <input type="text" placeholder="Your Name" className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none focus:bg-white focus:border-black transition-all font-bold" />
               <input type="email" placeholder="Email Address" className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none focus:bg-white focus:border-black transition-all font-bold" />
            </div>
            <textarea placeholder="Message..." rows={4} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none focus:bg-white focus:border-black transition-all font-bold"></textarea>
            <button type="button" className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase tracking-widest text-[11px] hover:bg-slate-800 transition-all shadow-xl">Send Message</button>
         </form>
      </div>
    </div>
  );

  const renderMarket = () => (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <button onClick={() => setMarketView('SUPPLIER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${marketView === 'SUPPLIER' ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>1. Supplier Hub</button>
        <button onClick={() => setMarketView('SALES')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${marketView === 'SALES' ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>2. Sales Records</button>
        <button onClick={() => setMarketView('CUSTOMER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${marketView === 'CUSTOMER' ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400'}`}>3. Customer Hub</button>
      </div>

      {marketView === 'SUPPLIER' && (
        <div className="space-y-8 animate-in fade-in">
          <ProduceForm userRole={agentIdentity?.role || SystemRole.FIELD_AGENT} onSubmit={(data) => {
            const newProduce: ProduceListing = { ...data, id: `PRO-${Date.now()}`, status: 'AVAILABLE', cluster: agentIdentity?.cluster || 'Unassigned' };
            syncProduceToCloud(newProduce).then(loadCloudData);
          }} />
          <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
             <h4 className="text-sm font-black uppercase mb-6 tracking-tight">Your Active Listings</h4>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {produceListings.filter(p => p.supplierPhone === agentIdentity?.phone).map(p => (
                   <div key={p.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs font-black uppercase">{p.cropType}</p>
                      <p className="text-[10px] font-bold text-slate-400 mt-1">{p.unitsAvailable} {p.unitType} @ KSh {p.sellingPrice}/ea</p>
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {marketView === 'SALES' && (
        <div className="space-y-8 animate-in fade-in">
          <SaleForm clusters={CLUSTERS} produceListings={produceListings} onSubmit={(data) => {
            const totalSale = data.unitsSold * data.unitPrice;
            const newRecord: SaleRecord = { 
              ...data, 
              id: `SAL-${Date.now()}`, 
              totalSale, 
              coopProfit: totalSale * PROFIT_MARGIN, 
              status: RecordStatus.DRAFT,
              createdAt: new Date().toISOString(),
              signature: 'SIGNED-OFF',
              agentPhone: agentIdentity?.phone,
              agentName: agentIdentity?.name
            };
            syncToGoogleSheets(newRecord).then(loadCloudData);
          }} />
          <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200 overflow-x-auto">
            <h3 className="text-sm font-black uppercase mb-8 tracking-widest">Recent Sales Ledger</h3>
            <table className="w-full text-left">
              <thead className="border-b border-slate-100 text-[9px] font-black uppercase text-slate-400">
                <tr><th className="pb-6">Date</th><th className="pb-6">Commodity</th><th className="pb-6">Buyer</th><th className="pb-6">Total</th><th className="pb-6 text-right">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {records.slice(0, 10).map(r => (
                  <tr key={r.id} className="text-[11px] font-bold">
                    <td className="py-6 text-slate-400">{r.date}</td>
                    <td className="py-6 text-black uppercase">{r.cropType}</td>
                    <td className="py-6">{r.customerName}</td>
                    <td className="py-6 font-black">KSh {r.totalSale.toLocaleString()}</td>
                    <td className="py-6 text-right"><span className={`px-4 py-1.5 rounded-full text-[8px] font-black uppercase ${r.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {marketView === 'CUSTOMER' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in">
          {produceListings.filter(p => p.status === 'AVAILABLE').map(p => (
            <div key={p.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-lg flex flex-col justify-between hover:scale-[1.02] transition-all">
              <div className="space-y-4">
                <span className="bg-green-50 text-green-700 text-[8px] font-black uppercase px-3 py-1 rounded-full">{p.cluster}</span>
                <h3 className="text-xl font-black text-black uppercase leading-none">{p.cropType}</h3>
                <p className="text-2xl font-black text-black">KSh {p.sellingPrice.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">/ {p.unitType}</span></p>
                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Supplier: {p.supplierName}</p>
              </div>
              <button className="w-full mt-8 bg-black text-white py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-green-600 transition-all">Order Now</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFinance = () => (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <StatCard label="Gross Volume" value={`KSh ${stats.totalVolume.toLocaleString()}`} icon="fa-coins" color="bg-white" accent="text-black" />
        <StatCard label="Coop Commissions" value={`KSh ${stats.totalProfit.toLocaleString()}`} icon="fa-percentage" color="bg-white" accent="text-green-600" />
        <StatCard label="Pending Payouts" value={`KSh ${(stats.totalProfit * 0.4).toLocaleString()}`} icon="fa-wallet" color="bg-white" accent="text-red-600" />
      </div>
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200">
         <h3 className="text-sm font-black uppercase mb-8">Commission Ledger</h3>
         <div className="space-y-4">
            {records.filter(r => r.coopProfit > 0).slice(0, 10).map(r => (
               <div key={r.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div>
                    <p className="text-[11px] font-black uppercase">{r.cropType} Sale</p>
                    <p className="text-[9px] font-bold text-slate-400">{r.date}</p>
                  </div>
                  <p className="text-[13px] font-black text-green-600">+ KSh {r.coopProfit.toLocaleString()}</p>
               </div>
            ))}
         </div>
      </div>
    </div>
  );

  const renderAudit = () => (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black uppercase tracking-tight text-black">Audit Verification Desk</h2>
        <button 
          onClick={runAiAudit} 
          disabled={isAiAnalyzing}
          className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 disabled:opacity-50"
        >
          {isAiAnalyzing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-robot"></i>}
          AI Anomaly Check
        </button>
      </div>

      {aiReport && (
        <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
          <button onClick={() => setAiReport(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><i className="fas fa-times"></i></button>
          <div className="flex items-center gap-4 mb-6">
             <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-black shadow-lg"><i className="fas fa-brain"></i></div>
             <h3 className="font-black uppercase text-sm tracking-widest">Gemini AI Audit Report</h3>
          </div>
          <div className="prose prose-invert max-w-none text-slate-300 text-sm leading-relaxed whitespace-pre-wrap font-medium">
            {aiReport}
          </div>
        </div>
      )}

      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200">
         <h3 className="text-sm font-black uppercase mb-8">Pending Verification ({stats.pending})</h3>
         <div className="divide-y divide-slate-100">
            {records.filter(r => r.status !== RecordStatus.VERIFIED).map(r => (
               <div key={r.id} className="py-6 flex justify-between items-center group">
                  <div className="space-y-1">
                     <p className="text-[12px] font-black uppercase text-black">{r.cropType} @ KSh {r.totalSale.toLocaleString()}</p>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Agent: {r.agentName || 'System'} | Cluster: {r.cluster}</p>
                  </div>
                  <button onClick={() => {
                    const updated = { ...r, status: RecordStatus.VERIFIED };
                    syncToGoogleSheets(updated).then(loadCloudData);
                  }} className="bg-green-50 text-green-700 px-6 py-3 rounded-xl font-black uppercase text-[9px] hover:bg-green-600 hover:text-white transition-all">Verify Trade</button>
               </div>
            ))}
         </div>
      </div>
    </div>
  );

  const renderBoard = () => (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
         <h2 className="text-4xl font-black uppercase tracking-tighter text-black">Strategic Hub</h2>
         <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em]">Quarterly Performance Analytics</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
         <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200">
            <h3 className="text-sm font-black uppercase mb-8 tracking-widest">Cluster Rankings</h3>
            <div className="space-y-6">
               {CLUSTERS.map((c, i) => {
                 const clusterVolume = records.filter(r => r.cluster === c).reduce((a, b) => a + Number(b.totalSale), 0);
                 const maxVolume = Math.max(...CLUSTERS.map(cl => records.filter(r => r.cluster === cl).reduce((a, b) => a + Number(b.totalSale), 0)), 1);
                 const perc = (clusterVolume / maxVolume) * 100;
                 return (
                   <div key={c} className="space-y-2">
                      <div className="flex justify-between text-[10px] font-black uppercase">
                        <span>{i+1}. {c}</span>
                        <span>KSh {clusterVolume.toLocaleString()}</span>
                      </div>
                      <div className="h-3 bg-slate-50 rounded-full overflow-hidden border border-slate-100">
                         <div className="h-full bg-black transition-all duration-1000" style={{ width: `${perc}%` }}></div>
                      </div>
                   </div>
                 );
               })}
            </div>
         </div>
         <div className="bg-slate-900 text-white p-12 rounded-[3.5rem] shadow-2xl flex flex-col justify-center items-center text-center space-y-6">
            <i className="fas fa-chart-line text-5xl text-green-500"></i>
            <h3 className="text-2xl font-black uppercase leading-tight">Projected Annual Growth</h3>
            <p className="text-slate-400 font-medium">Based on current trade velocity across {CLUSTERS.length} active clusters.</p>
            <p className="text-5xl font-black text-green-400">+ 18.4%</p>
         </div>
      </div>
    </div>
  );

  const renderSystem = () => (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-200">
        <div className="flex justify-between items-center mb-10">
           <h3 className="text-sm font-black uppercase tracking-widest">User Directory ({users.length})</h3>
           <button onClick={() => { if(confirm("Purge all users?")) deleteAllUsersFromCloud().then(loadCloudData); }} className="text-red-600 font-black uppercase text-[10px] tracking-widest flex items-center gap-2 hover:bg-red-50 px-4 py-2 rounded-xl transition-all"><i className="fas fa-trash-alt"></i> Purge Users</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {users.map(u => (
              <div key={u.phone} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-start">
                 <div>
                    <p className="text-sm font-black uppercase">{u.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{u.role} | {u.cluster}</p>
                 </div>
                 <button onClick={() => deleteUserFromCloud(u.phone).then(loadCloudData)} className="text-slate-300 hover:text-red-600 transition-all"><i className="fas fa-times-circle"></i></button>
              </div>
           ))}
        </div>
      </div>
      
      <div className="bg-red-50 border border-red-100 p-12 rounded-[3.5rem] flex flex-col md:flex-row items-center gap-12">
         <div className="flex-1 space-y-4">
            <h3 className="text-2xl font-black text-red-600 uppercase tracking-tight">System Maintenance</h3>
            <p className="text-red-700 font-medium opacity-80">Perform critical database operations and cloud resets. These actions are irreversible.</p>
         </div>
         <div className="flex gap-4">
            <button onClick={() => { if(confirm("Reset all sales records?")) deleteAllRecordsFromCloud().then(loadCloudData); }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-700 shadow-xl transition-all">Clear Trade Data</button>
            <button onClick={() => { if(confirm("Purge all market listings?")) deleteAllProduceFromCloud().then(loadCloudData); }} className="bg-white text-red-600 border border-red-200 px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-50 transition-all">Flush Storefront</button>
         </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-4 gap-6">
          <div className="flex items-center space-x-6">
            <div className="bg-white w-20 h-20 rounded-[2rem] flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden">
              <img src={APP_LOGO} alt="KPL Logo" className="w-12 h-12 object-contain" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-black">KPL Food Coop Market</h1>
              <p className="text-green-600 text-[10px] font-black uppercase tracking-[0.3em] mt-2">Connecting Suppliers with Consumers</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
            {agentIdentity ? (
              <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right w-full lg:w-auto shadow-sm flex items-center justify-end space-x-6">
                   <div className="text-right"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Security Sync</p><p className="text-[10px] font-bold text-black">{isSyncing ? 'Syncing...' : lastSyncTime?.toLocaleTimeString() || '...'}</p></div>
                   <div className="w-10 h-10 bg-black text-white rounded-2xl flex items-center justify-center text-[10px] font-black">{agentIdentity.name.charAt(0)}</div>
                   <button onClick={() => { setAgentIdentity(null); persistence.remove('agent_session'); setCurrentPortal('HOME'); }} className="text-slate-400 hover:text-red-600 transition-all"><i className="fas fa-power-off"></i></button>
              </div>
            ) : (
              <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-3">
                <i className="fas fa-user-shield"></i> Member Login
              </button>
            )}
            <div className="flex gap-6 mt-2">
              <button onClick={() => setCurrentPortal('HOME')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'HOME' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black'}`}>Home</button>
              <button onClick={() => setCurrentPortal('NEWS')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'NEWS' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black'}`}>News</button>
              <button onClick={() => setCurrentPortal('ABOUT')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'ABOUT' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black'}`}>About</button>
              <button onClick={() => setCurrentPortal('CONTACT')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'CONTACT' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black'}`}>Contact</button>
            </div>
          </div>
        </div>
        {agentIdentity && (
          <nav className="container mx-auto px-6 flex flex-wrap gap-3 mt-4 relative z-10">
            {availablePortals.filter(p => !['HOME', 'ABOUT', 'CONTACT', 'NEWS', 'LOGIN'].includes(p)).map(p => (
              <button key={p} onClick={() => setCurrentPortal(p)} className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black'}`}>{p}</button>
            ))}
          </nav>
        )}
      </header>

      <main className="container mx-auto px-6 -mt-8 relative z-20">
        {currentPortal === 'HOME' && renderHome()}
        {currentPortal === 'NEWS' && renderNews()}
        {currentPortal === 'ABOUT' && renderAbout()}
        {currentPortal === 'CONTACT' && renderContact()}
        {currentPortal === 'MARKET' && renderMarket()}
        {currentPortal === 'FINANCE' && renderFinance()}
        {currentPortal === 'AUDIT' && renderAudit()}
        {currentPortal === 'BOARD' && renderBoard()}
        {currentPortal === 'SYSTEM' && renderSystem()}

        {currentPortal === 'LOGIN' && !agentIdentity && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center py-20">
            <div className="w-full max-w-[450px] bg-white border border-slate-200 rounded-[3rem] shadow-2xl p-12 space-y-8">
              <div className="text-center space-y-2">
                <div className="w-16 h-16 bg-black text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl"><i className={`fas ${isRegisterMode ? 'fa-user-plus' : 'fa-lock'}`}></i></div>
                <h2 className="text-2xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Join Coop' : 'Welcome Back'}</h2>
              </div>
              <form onSubmit={handleAuth} className="space-y-4">
                {isRegisterMode && <input type="text" placeholder="Full Name" value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none font-bold" />}
                <input type="tel" placeholder="Phone (07...)" value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none font-bold" />
                <input type="password" placeholder="Passcode" maxLength={4} value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none font-bold text-center tracking-[0.5em] text-2xl" />
                {isRegisterMode && (
                  <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as SystemRole})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none font-bold">
                     {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                )}
                {isRegisterMode && (
                   <select value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-slate-50 p-5 rounded-2xl border border-slate-100 outline-none font-bold">
                      <option value="">Select Cluster</option>
                      {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                   </select>
                )}
                <button type="submit" className="w-full bg-black text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl transition-all active:scale-95">{isAuthLoading ? '...' : (isRegisterMode ? 'Register' : 'Login')}</button>
              </form>
              <button onClick={() => setIsRegisterMode(!isRegisterMode)} className="w-full text-[10px] font-black uppercase text-slate-400 hover:text-black">{isRegisterMode ? 'Back to Login' : 'Create New Member Account'}</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const availablePortals: PortalType[] = ['HOME', 'NEWS', 'ABOUT', 'CONTACT', 'MARKET', 'FINANCE', 'AUDIT', 'BOARD', 'SYSTEM'];

export default App;
