
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { SaleRecord, RecordStatus, OrderStatus, SystemRole, AgentIdentity, MarketOrder, ProduceListing } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import ProduceForm from './components/ProduceForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, PRODUCT_CONFIG, PRODUCT_TYPES } from './constants.ts';
import { analyzeSalesData } from './services/geminiService.ts';
import {
  saveRecord,
  fetchRecords,
  saveUser,
  fetchUsers,
  deleteRecord,
  saveOrder,
  fetchOrders,
  saveProduce,
  fetchProduce,
  deleteProduce
} from './services/supabaseService.ts';

type PortalType = 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'HOME' | 'LOGIN' | 'INVENTORY';
type MarketView = 'SALES' | 'SUPPLIER' | 'CUSTOMER';

export const CLUSTERS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana'];

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
  // --- State Management ---
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>([]);
  const [produceListings, setProduceListings] = useState<ProduceListing[]>([]);
  const [users, setUsers] = useState<AgentIdentity[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('HOME');
  const [marketView, setMarketView] = useState<MarketView>('SALES');
  const [loginForm, setLoginForm] = useState({ phone: '', passcode: '' });
  const [isSyncing, setIsSyncing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Data Sync Logic ---
  const syncAll = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const [r, u, o, p] = await Promise.all([
        fetchRecords(),
        fetchUsers(),
        fetchOrders(),
        fetchProduce()
      ]);
      setRecords(r);
      setUsers(u);
      setMarketOrders(o);
      setProduceListings(p);
    } catch (err) {
      console.error("Sync Error:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    syncAll();
    const timer = setInterval(syncAll, SYNC_POLLING_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  // --- Auth Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = users.find(u => u.phone === loginForm.phone && u.passcode === loginForm.passcode);
    if (user) {
      setAgentIdentity(user);
      persistence.set('agent_session', JSON.stringify(user));
      setCurrentPortal('MARKET');
    } else {
      alert("Invalid Credentials. Please check your phone number and passcode.");
    }
  };

  const logout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
    setCurrentPortal('HOME');
  };

  // --- Business Logic Handlers ---
  const handleSaleSubmit = async (data: any) => {
    if (!agentIdentity) return;
    const newRecord: SaleRecord = {
      ...data,
      id: `SALE-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      status: RecordStatus.DRAFT,
      totalSale: data.unitsSold * data.unitPrice,
      coopProfit: (data.unitsSold * data.unitPrice) * PROFIT_MARGIN,
      signature: `AGENT-${agentIdentity.phone.slice(-4)}`,
      createdAt: new Date().toISOString(),
      agentPhone: agentIdentity.phone,
      agentName: agentIdentity.name,
      cluster: agentIdentity.cluster,
      synced: true
    };

    const success = await saveRecord(newRecord);
    if (success) {
      setRecords(prev => [newRecord, ...prev]);
      // If it was linked to an order, update order status logic could go here
      alert("Sale Record Committed Successfully.");
    }
  };

  const handleProduceSubmit = async (data: any) => {
    const newProduce: ProduceListing = {
      ...data,
      id: `PRD-${Date.now()}`,
      cluster: agentIdentity?.cluster || CLUSTERS[0],
      status: 'AVAILABLE'
    };
    const success = await saveProduce(newProduce);
    if (success) {
      setProduceListings(prev => [newProduce, ...prev]);
      alert("Inventory Listing Posted.");
    }
  };

  const generateReport = async () => {
    setIsAnalyzing(true);
    const report = await analyzeSalesData(records);
    setAiReport(report);
    setIsAnalyzing(false);
  };

  // --- Computed Stats ---
  const stats = useMemo(() => {
    const totalVolume = records.reduce((sum, r) => sum + r.totalSale, 0);
    const totalProfit = records.reduce((sum, r) => sum + r.coopProfit, 0);
    const activeSuppliers = new Set(produceListings.map(p => p.supplierPhone)).size;
    const openOrders = marketOrders.filter(o => o.status === OrderStatus.OPEN).length;
    return { totalVolume, totalProfit, activeSuppliers, openOrders };
  }, [records, produceListings, marketOrders]);

  // --- Render Helpers ---
  const renderHeader = () => (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 px-6 py-4">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCurrentPortal('HOME')}>
          <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
            <i className="fas fa-shopping-basket text-white text-sm"></i>
          </div>
          <div>
            <h1 className="text-sm font-black tracking-tighter uppercase">KPL Food Coop</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Market Hub</p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {['HOME', 'MARKET', 'FINANCE', 'AUDIT'].map(p => (
            <button 
              key={p}
              onClick={() => setCurrentPortal(p as PortalType)}
              className={`text-[10px] font-black uppercase tracking-[0.2em] transition-all ${currentPortal === p ? 'text-green-600' : 'text-slate-400 hover:text-black'}`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          {agentIdentity ? (
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <p className="text-[10px] font-black uppercase">{agentIdentity.name}</p>
                <p className="text-[9px] font-bold text-slate-400 uppercase">{agentIdentity.role}</p>
              </div>
              <button onClick={logout} className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center hover:bg-red-50 hover:text-red-600 transition-all">
                <i className="fas fa-sign-out-alt"></i>
              </button>
            </div>
          ) : (
            <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
              Login
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  const renderHome = () => (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard label="Total Trade Volume" value={`KSh ${stats.totalVolume.toLocaleString()}`} icon="fa-chart-line" color="bg-white" accent="text-black" />
        <StatCard label="Coop Revenue" value={`KSh ${stats.totalProfit.toLocaleString()}`} icon="fa-hand-holding-usd" color="bg-green-50/30" accent="text-green-700" />
        <StatCard label="Active Suppliers" value={stats.activeSuppliers} icon="fa-users" color="bg-white" />
        <StatCard label="Pending Orders" value={stats.openOrders} icon="fa-clock" color="bg-red-50/30" accent="text-red-700" />
      </div>

      <div className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="relative z-10 max-w-2xl">
          <h2 className="text-4xl font-black tracking-tighter mb-6 leading-tight">Empowering Communities Through Transparent Trade.</h2>
          <p className="text-slate-400 text-sm font-medium leading-relaxed mb-8">
            KPL Food Coop connects small-scale producers with verified consumers. 
            Our digital ledger ensures every transaction is audited, fair, and profitable for the local ecosystem.
          </p>
          <div className="flex gap-4">
            <button onClick={() => setCurrentPortal('MARKET')} className="bg-green-500 hover:bg-green-400 text-black px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">
              Enter Market
            </button>
            <button onClick={() => setCurrentPortal('LOGIN')} className="border border-slate-700 hover:bg-slate-800 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">
              Agent Access
            </button>
          </div>
        </div>
        <i className="fas fa-seedling absolute -right-20 -bottom-20 text-[20rem] text-white/5 rotate-12"></i>
      </div>
    </div>
  );

  const renderMarket = () => (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl w-full md:w-auto">
          {(['SALES', 'SUPPLIER', 'CUSTOMER'] as MarketView[]).map(v => (
            <button 
              key={v}
              onClick={() => setMarketView(v)}
              className={`flex-1 md:flex-none px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${marketView === v ? 'bg-white text-black shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {marketView === 'SALES' && (
        <div className="space-y-10">
          {agentIdentity && (agentIdentity.role === SystemRole.FIELD_AGENT || agentIdentity.role === SystemRole.SYSTEM_DEVELOPER) && (
            <SaleForm clusters={CLUSTERS} produceListings={produceListings} onSubmit={handleSaleSubmit} />
          )}
          <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xs font-black uppercase tracking-widest">Recent Sales Ledger</h3>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`}></div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">{isSyncing ? 'Syncing...' : 'Synced'}</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['Date', 'Product', 'Customer', 'Qty', 'Total', 'Status', 'Agent'].map(h => (
                      <th key={h} className="px-8 py-6 text-[9px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-6 text-[11px] font-bold text-slate-500">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="px-8 py-6">
                        <span className="text-[11px] font-black text-black">{r.productType}</span>
                        <p className="text-[9px] font-bold text-slate-400">{r.unitType}</p>
                      </td>
                      <td className="px-8 py-6">
                        <p className="text-[11px] font-bold text-black">{r.customerName}</p>
                        <p className="text-[9px] text-slate-400">{r.customerPhone}</p>
                      </td>
                      <td className="px-8 py-6 text-[11px] font-black">{r.unitsSold}</td>
                      <td className="px-8 py-6 text-[11px] font-black text-green-600">KSh {r.totalSale.toLocaleString()}</td>
                      <td className="px-8 py-6">
                        <span className={`text-[8px] font-black px-2 py-1 rounded-md uppercase tracking-tighter ${r.status === RecordStatus.PAID ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-8 py-6 text-[10px] font-bold text-slate-400 uppercase">{r.agentName || 'System'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {marketView === 'SUPPLIER' && (
        <div className="space-y-10">
          {agentIdentity && (agentIdentity.role === SystemRole.SUPPLIER || agentIdentity.role === SystemRole.SYSTEM_DEVELOPER) && (
            <ProduceForm 
              userRole={agentIdentity.role} 
              defaultSupplierName={agentIdentity.name}
              defaultSupplierPhone={agentIdentity.phone}
              onSubmit={handleProduceSubmit} 
            />
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {produceListings.map(p => (
              <div key={p.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div className="bg-green-50 text-green-700 px-3 py-1 rounded-lg text-[9px] font-black uppercase">{p.productType}</div>
                  <div className="text-right">
                    <p className="text-[14px] font-black text-black">KSh {p.sellingPrice}</p>
                    <p className="text-[9px] font-bold text-slate-400 uppercase">per {p.unitType}</p>
                  </div>
                </div>
                <h4 className="text-sm font-black mb-1">{p.supplierName}</h4>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-4">{p.cluster} Cluster</p>
                <div className="flex justify-between items-center pt-6 border-t border-slate-50">
                  <div>
                    <p className="text-[10px] font-black uppercase text-slate-400">Available</p>
                    <p className="text-sm font-black">{p.unitsAvailable} {p.unitType}s</p>
                  </div>
                  <button className="bg-black text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all">
                    Order Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const renderLogin = () => (
    <div className="max-w-md mx-auto mt-20 px-6">
      <div className="bg-white p-12 rounded-[3rem] shadow-2xl border border-slate-100 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm border border-slate-100">
          <i className="fas fa-shield-alt text-2xl text-black"></i>
        </div>
        <h2 className="text-2xl font-black uppercase tracking-tighter mb-2">Agent Portal</h2>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Restricted Access Environment</p>
        
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="text-left space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Phone Number</label>
            <input 
              type="tel" 
              placeholder="07..."
              value={loginForm.phone}
              onChange={(e) => setLoginForm({...loginForm, phone: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-black outline-none transition-all"
              required
            />
          </div>
          <div className="text-left space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Security Passcode</label>
            <input 
              type="password" 
              placeholder="••••"
              value={loginForm.passcode}
              onChange={(e) => setLoginForm({...loginForm, passcode: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-black outline-none transition-all"
              required
            />
          </div>
          <button type="submit" className="w-full bg-black text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-[0.3em] shadow-xl hover:bg-slate-900 transition-all">
            Unlock Portal
          </button>
        </form>
      </div>
    </div>
  );

  const renderAudit = () => (
    <div className="max-w-7xl mx-auto px-6 py-12 space-y-10">
      <div className="bg-white p-12 rounded-[3rem] border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">AI Compliance Audit</h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time Anomaly Detection</p>
          </div>
          <button 
            onClick={generateReport}
            disabled={isAnalyzing || records.length === 0}
            className={`px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${isAnalyzing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-black text-white shadow-xl hover:bg-slate-900'}`}
          >
            {isAnalyzing ? (
              <><div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div> Thinking...</>
            ) : (
              <><i className="fas fa-robot"></i> Run Market Analysis</>
            )}
          </button>
        </div>

        {aiReport ? (
          <div className="prose prose-slate max-w-none prose-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-slate-50 p-10 rounded-[2.5rem] border border-slate-100 whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-slate-700">
              {aiReport}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 border-2 border-dashed border-slate-100 rounded-[3rem]">
            <i className="fas fa-chart-pie text-4xl text-slate-100 mb-6"></i>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Generate a report to see market insights</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      {renderHeader()}
      
      <main>
        {currentPortal === 'HOME' && renderHome()}
        {currentPortal === 'MARKET' && renderMarket()}
        {currentPortal === 'LOGIN' && renderLogin()}
        {currentPortal === 'AUDIT' && renderAudit()}
        {currentPortal === 'FINANCE' && (
           <div className="max-w-7xl mx-auto px-6 py-12 text-center">
             <div className="bg-white p-20 rounded-[3rem] border border-slate-200 shadow-sm">
                <i className="fas fa-vault text-4xl text-slate-200 mb-8"></i>
                <h2 className="text-xl font-black uppercase tracking-tighter">Finance Hub</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Disbursement modules are coming soon.</p>
             </div>
           </div>
        )}
      </main>

      {/* Persistent Sync Status */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-black/90 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 flex items-center gap-4 shadow-2xl z-50">
        <div className={`w-2 h-2 rounded-full ${isSyncing ? 'bg-green-500 animate-pulse' : 'bg-green-500/50'}`}></div>
        <span className="text-[9px] font-black text-white uppercase tracking-widest">{isSyncing ? 'Syncing Cloud Ledger' : 'Ledger Verified'}</span>
        <div className="w-[1px] h-3 bg-white/20"></div>
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{records.length} Transactions</span>
      </div>
    </div>
  );
};

export default App;
