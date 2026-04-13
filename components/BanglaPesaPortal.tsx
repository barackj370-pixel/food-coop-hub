import React, { useState, useEffect, useMemo } from 'react';
import { AgentIdentity } from '../types';
import { Database, ArrowRightLeft, ShieldAlert, History, Wallet, TrendingUp, Plus, ArrowDownRight, ArrowUpRight, CheckCircle2, AlertCircle, Users, Leaf } from 'lucide-react';

interface BanglaTx {
  id: string;
  date: string;
  type: 'WORK_REPORT' | 'SOLIDARITY' | 'LOAN' | 'REPAYMENT' | 'INVESTMENT';
  description: string;
  voucherAmount: number;
  cashAmount: number;
  fromUser?: string;
  toUser?: string;
  basketId?: string;
  status: 'COMPLETED' | 'PENDING';
}

interface Basket {
  id: string;
  name: string;
  type: 'GENERAL' | 'CLUSTER';
  cluster?: string;
  cashBalance: number;
}

interface WalletData {
  voucherBalance: number;
  lockedVouchers: number;
}

export default function BanglaPesaPortal({ 
  agentIdentity, 
  users, 
  clusters 
}: { 
  agentIdentity: AgentIdentity | null; 
  users: AgentIdentity[]; 
  clusters: string[];
}) {
  const [activeTab, setActiveTab] = useState<'NEWS' | 'SOLIDARITY' | 'BASKETS' | 'AUDIT'>('NEWS');
  
  // Prototype State (Persisted in LocalStorage for now)
  const [transactions, setTransactions] = useState<BanglaTx[]>([]);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [wallets, setWallets] = useState<Record<string, WalletData>>({});

  // Form States
  const [workDesc, setWorkDesc] = useState('');
  const [workVoucherValue, setWorkVoucherValue] = useState(0);
  
  const [solidarityTo, setSolidarityTo] = useState('');
  const [solidarityAmount, setSolidarityAmount] = useState(0);
  const [solidarityDesc, setSolidarityDesc] = useState('');

  const [selectedBasket, setSelectedBasket] = useState('GENERAL');
  const [loanAmount, setLoanAmount] = useState(0);
  const [investAmount, setInvestAmount] = useState(0);

  // Load Data
  useEffect(() => {
    const savedTx = localStorage.getItem('bangla_tx');
    const savedBaskets = localStorage.getItem('bangla_baskets');
    const savedWallets = localStorage.getItem('bangla_wallets');

    if (savedTx) setTransactions(JSON.parse(savedTx));
    if (savedWallets) setWallets(JSON.parse(savedWallets));
    
    if (savedBaskets) {
      setBaskets(JSON.parse(savedBaskets));
    } else {
      // Initialize Baskets
      const initialBaskets: Basket[] = [
        { id: 'GENERAL', name: 'General Coop Basket', type: 'GENERAL', cashBalance: 50000 }
      ];
      clusters.forEach(c => {
        if (c !== '-') {
          initialBaskets.push({ id: `CLUSTER_${c}`, name: `${c} Basket`, type: 'CLUSTER', cluster: c, cashBalance: 0 });
        }
      });
      setBaskets(initialBaskets);
    }
  }, [clusters]);

  // Save Data
  useEffect(() => {
    if (baskets.length > 0) {
      localStorage.setItem('bangla_tx', JSON.stringify(transactions));
      localStorage.setItem('bangla_baskets', JSON.stringify(baskets));
      localStorage.setItem('bangla_wallets', JSON.stringify(wallets));
    }
  }, [transactions, baskets, wallets]);

  const getWallet = (userId: string) => wallets[userId] || { voucherBalance: 0, lockedVouchers: 0 };

  const addTx = (tx: Omit<BanglaTx, 'id' | 'date' | 'status'>) => {
    const newTx: BanglaTx = {
      ...tx,
      id: Math.random().toString(36).substring(2, 9),
      date: new Date().toISOString(),
      status: 'COMPLETED'
    };
    setTransactions(prev => [newTx, ...prev]);
  };

  const updateWallet = (userId: string, updates: Partial<WalletData>) => {
    setWallets(prev => ({
      ...prev,
      [userId]: { ...getWallet(userId), ...updates }
    }));
  };

  const updateBasket = (basketId: string, cashDelta: number) => {
    setBaskets(prev => prev.map(b => b.id === basketId ? { ...b, cashBalance: b.cashBalance + cashDelta } : b));
  };

  // Actions
  const handleReportWork = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentIdentity || !agentIdentity.id || workVoucherValue <= 0 || !workDesc) return;
    
    const w = getWallet(agentIdentity.id);
    updateWallet(agentIdentity.id, { voucherBalance: w.voucherBalance + workVoucherValue });
    
    addTx({
      type: 'WORK_REPORT',
      description: workDesc,
      voucherAmount: workVoucherValue,
      cashAmount: 0,
      toUser: agentIdentity.id
    });
    
    setWorkDesc('');
    setWorkVoucherValue(0);
    alert('Work reported and vouchers minted successfully!');
  };

  const handleSolidarity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentIdentity || !agentIdentity.id || solidarityAmount <= 0 || !solidarityTo || !solidarityDesc) return;
    
    const senderWallet = getWallet(agentIdentity.id);
    if (senderWallet.voucherBalance < solidarityAmount) {
      alert('Insufficient voucher balance!');
      return;
    }

    const receiverWallet = getWallet(solidarityTo);
    
    updateWallet(agentIdentity.id, { voucherBalance: senderWallet.voucherBalance - solidarityAmount });
    updateWallet(solidarityTo, { voucherBalance: receiverWallet.voucherBalance + solidarityAmount });
    
    addTx({
      type: 'SOLIDARITY',
      description: solidarityDesc,
      voucherAmount: solidarityAmount,
      cashAmount: 0,
      fromUser: agentIdentity.id,
      toUser: solidarityTo
    });

    setSolidarityAmount(0);
    setSolidarityDesc('');
    setSolidarityTo('');
    alert('Solidarity vouchers sent successfully!');
  };

  const handleInvest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentIdentity || !agentIdentity.id || investAmount <= 0) return;

    updateBasket(selectedBasket, investAmount);
    
    addTx({
      type: 'INVESTMENT',
      description: 'Basket Top-up',
      voucherAmount: 0,
      cashAmount: investAmount,
      fromUser: agentIdentity.id,
      basketId: selectedBasket
    });

    setInvestAmount(0);
    alert('Investment added to basket successfully!');
  };

  const handleTakeLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentIdentity || !agentIdentity.id || loanAmount <= 0) return;

    const basket = baskets.find(b => b.id === selectedBasket);
    if (!basket) return;

    // Rules
    const MAX_LOAN_PERCENT = 0.20; // 20% of basket
    const maxLoan = basket.cashBalance * MAX_LOAN_PERCENT;
    if (loanAmount > maxLoan) {
      alert(`Loan exceeds basket limit. Maximum allowed is KSh ${maxLoan.toLocaleString()}`);
      return;
    }

    const requiredVouchers = loanAmount; // 1:1 Valuation
    const w = getWallet(agentIdentity.id);
    
    if (w.voucherBalance < requiredVouchers) {
      alert(`Insufficient vouchers for collateral. You need ${requiredVouchers} BP.`);
      return;
    }

    updateWallet(agentIdentity.id, { 
      voucherBalance: w.voucherBalance - requiredVouchers,
      lockedVouchers: w.lockedVouchers + requiredVouchers
    });
    
    updateBasket(selectedBasket, -loanAmount);

    addTx({
      type: 'LOAN',
      description: 'Cash Loan against Vouchers',
      voucherAmount: requiredVouchers,
      cashAmount: loanAmount,
      toUser: agentIdentity.id,
      basketId: selectedBasket
    });

    setLoanAmount(0);
    alert('Loan approved and cash disbursed!');
  };

  const handleRepayLoan = (repayCashAmount: number, unlockVouchers: number, basketId: string) => {
    if (!agentIdentity || !agentIdentity.id) return;
    const w = getWallet(agentIdentity.id);
    
    if (w.lockedVouchers < unlockVouchers) return;

    updateWallet(agentIdentity.id, {
      voucherBalance: w.voucherBalance + unlockVouchers,
      lockedVouchers: w.lockedVouchers - unlockVouchers
    });

    updateBasket(basketId, repayCashAmount);

    addTx({
      type: 'REPAYMENT',
      description: 'Loan Repayment',
      voucherAmount: unlockVouchers,
      cashAmount: repayCashAmount,
      fromUser: agentIdentity.id,
      basketId: basketId
    });
    
    alert('Loan repaid and vouchers unlocked!');
  };

  const myWallet = agentIdentity && agentIdentity.id ? getWallet(agentIdentity.id) : null;
  const totalSystemVouchers = Object.values(wallets).reduce((sum, w) => sum + w.voucherBalance + w.lockedVouchers, 0);
  const totalBasketLiquidity = baskets.reduce((sum, b) => sum + b.cashBalance, 0);

  const getUserName = (id?: string) => {
    if (!id) return 'System';
    const u = users.find(u => u.id === id);
    return u ? u.name : 'Unknown User';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-24">
      {/* Header & Stats */}
      <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950 rounded-[3rem] p-10 md:p-16 text-white shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <span className="px-4 py-1.5 bg-indigo-500/30 text-indigo-200 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-400/20">
                Sarafu Network Prototype
              </span>
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter mb-4">Bangla Pesa</h1>
            <p className="text-indigo-200 text-lg max-w-xl leading-relaxed">
              Community Asset Vouchers for labor solidarity, farm activities, and liquidity pools.
            </p>
          </div>

          {myWallet && (
            <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 min-w-[300px]">
              <div className="flex items-center gap-3 mb-2">
                <Wallet className="text-indigo-300" size={24} />
                <h3 className="text-sm font-bold text-indigo-200 uppercase tracking-widest">My Wallet</h3>
              </div>
              <div className="text-5xl font-black mb-2">{myWallet.voucherBalance.toLocaleString()} <span className="text-2xl text-indigo-300">BP</span></div>
              {myWallet.lockedVouchers > 0 && (
                <div className="text-sm font-medium text-amber-300 flex items-center gap-2">
                  <ShieldAlert size={14} />
                  {myWallet.lockedVouchers.toLocaleString()} BP Locked (Collateral)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total System Vouchers</p>
            <p className="text-3xl font-black text-slate-800">{totalSystemVouchers.toLocaleString()} BP</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
            <TrendingUp size={24} />
          </div>
        </div>
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Basket Liquidity</p>
            <p className="text-3xl font-black text-slate-800">KSh {totalBasketLiquidity.toLocaleString()}</p>
          </div>
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Database size={24} />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto hide-scrollbar gap-2 p-2 bg-slate-100 rounded-full">
        {[
          { id: 'NEWS', label: 'Community Work', icon: Leaf },
          { id: 'SOLIDARITY', label: 'Labor Solidarity', icon: Users },
          { id: 'BASKETS', label: 'Liquidity Baskets', icon: Database },
          { id: 'AUDIT', label: 'Universal Audit Log', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-[3rem] p-8 md:p-12 border border-slate-200 shadow-xl">
        
        {/* COMMUNITY NEWS & WORK */}
        {activeTab === 'NEWS' && (
          <div className="space-y-12">
            <div className="bg-indigo-50 rounded-[2rem] p-8 border border-indigo-100">
              <h3 className="text-lg font-black text-indigo-900 mb-6 flex items-center gap-2">
                <Plus size={20} /> Report Work & Mint Vouchers
              </h3>
              <form onSubmit={handleReportWork} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 ml-2">Work Description</label>
                  <input 
                    type="text" 
                    required
                    value={workDesc}
                    onChange={e => setWorkDesc(e.target.value)}
                    placeholder="e.g., Helped clear 2 acres of land at Mariwa farm"
                    className="w-full bg-white border border-indigo-100 rounded-2xl px-6 py-4 font-medium text-slate-800 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 ml-2">Voucher Value (BP)</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    value={workVoucherValue || ''}
                    onChange={e => setWorkVoucherValue(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-indigo-100 rounded-2xl px-6 py-4 font-black text-indigo-600 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all"
                  />
                </div>
                <div className="md:col-span-3 flex justify-end">
                  <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-indigo-200">
                    Submit Report & Claim Vouchers
                  </button>
                </div>
              </form>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 ml-2">Recent Community Work</h3>
              <div className="space-y-4">
                {transactions.filter(t => t.type === 'WORK_REPORT').map(tx => (
                  <div key={tx.id} className="flex items-start justify-between p-6 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white transition-all">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-bold text-slate-900">{getUserName(tx.toUser)}</span>
                        <span className="text-xs text-slate-400">• {new Date(tx.date).toLocaleDateString()}</span>
                      </div>
                      <p className="text-slate-600">{tx.description}</p>
                    </div>
                    <div className="bg-emerald-100 text-emerald-700 px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap">
                      +{tx.voucherAmount} BP
                    </div>
                  </div>
                ))}
                {transactions.filter(t => t.type === 'WORK_REPORT').length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-medium">No work reported yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LABOR SOLIDARITY */}
        {activeTab === 'SOLIDARITY' && (
          <div className="space-y-12">
            <div className="bg-emerald-50 rounded-[2rem] p-8 border border-emerald-100">
              <h3 className="text-lg font-black text-emerald-900 mb-6 flex items-center gap-2">
                <ArrowRightLeft size={20} /> Send Solidarity Vouchers
              </h3>
              <form onSubmit={handleSolidarity} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 ml-2">Recipient (Helped By)</label>
                  <select 
                    required
                    value={solidarityTo}
                    onChange={e => setSolidarityTo(e.target.value)}
                    className="w-full bg-white border border-emerald-100 rounded-2xl px-6 py-4 font-medium text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"
                  >
                    <option value="">Select Member...</option>
                    {users.filter(u => u.id !== agentIdentity?.id).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.cluster})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 ml-2">Amount (BP)</label>
                  <input 
                    type="number" 
                    required
                    min="1"
                    max={myWallet?.voucherBalance || 0}
                    value={solidarityAmount || ''}
                    onChange={e => setSolidarityAmount(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-white border border-emerald-100 rounded-2xl px-6 py-4 font-black text-emerald-600 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 ml-2">Description</label>
                  <input 
                    type="text" 
                    required
                    value={solidarityDesc}
                    onChange={e => setSolidarityDesc(e.target.value)}
                    placeholder="e.g., Thank you for helping with the harvest"
                    className="w-full bg-white border border-emerald-100 rounded-2xl px-6 py-4 font-medium text-slate-800 outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 transition-all"
                  />
                </div>
                <div className="md:col-span-2 flex justify-end">
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-emerald-200">
                    Send Vouchers
                  </button>
                </div>
              </form>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 ml-2">Solidarity Transfers</h3>
              <div className="space-y-4">
                {transactions.filter(t => t.type === 'SOLIDARITY').map(tx => (
                  <div key={tx.id} className="flex items-center justify-between p-6 rounded-2xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <ArrowRightLeft size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">
                          {getUserName(tx.fromUser)} <span className="text-slate-400 font-normal mx-2">sent to</span> {getUserName(tx.toUser)}
                        </div>
                        <p className="text-sm text-slate-500 mt-1">{tx.description}</p>
                      </div>
                    </div>
                    <div className="font-black text-emerald-600">
                      {tx.voucherAmount} BP
                    </div>
                  </div>
                ))}
                {transactions.filter(t => t.type === 'SOLIDARITY').length === 0 && (
                  <div className="text-center py-12 text-slate-400 font-medium">No solidarity transfers yet.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* BASKETS (POOLS) */}
        {activeTab === 'BASKETS' && (
          <div className="space-y-12">
            
            {/* Basket Selector */}
            <div className="flex gap-4 overflow-x-auto pb-4">
              {baskets.map(b => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBasket(b.id)}
                  className={`flex-shrink-0 px-6 py-4 rounded-2xl border text-left transition-all min-w-[200px] ${
                    selectedBasket === b.id 
                      ? 'border-indigo-600 bg-indigo-50 shadow-md' 
                      : 'border-slate-200 bg-white hover:border-indigo-300'
                  }`}
                >
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{b.type}</div>
                  <div className="font-bold text-slate-900 mb-1">{b.name}</div>
                  <div className="text-xl font-black text-indigo-600">KSh {b.cashBalance.toLocaleString()}</div>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Take Loan */}
              <div className="bg-amber-50 rounded-[2rem] p-8 border border-amber-100">
                <h3 className="text-lg font-black text-amber-900 mb-2 flex items-center gap-2">
                  <ArrowDownRight size={20} /> Take Cash Loan
                </h3>
                <p className="text-sm text-amber-700 mb-6">Lock your vouchers as collateral to receive hard cash from the basket.</p>
                
                <div className="bg-white/60 rounded-xl p-4 mb-6 text-sm text-amber-800 space-y-2">
                  <div className="flex justify-between"><span>Valuation:</span> <strong>1 BP = 1 KSh</strong></div>
                  <div className="flex justify-between"><span>Basket Limit:</span> <strong>Max 20% of Liquidity</strong></div>
                  <div className="flex justify-between"><span>Curation:</span> <strong>Auto-Approved (Prototype)</strong></div>
                </div>

                <form onSubmit={handleTakeLoan} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest mb-2 ml-2">Cash Amount Needed (KSh)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={loanAmount || ''}
                      onChange={e => setLoanAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-amber-200 rounded-2xl px-6 py-4 font-black text-amber-700 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100 transition-all"
                    />
                    {loanAmount > 0 && (
                      <p className="text-xs text-amber-600 mt-2 ml-2 font-medium">
                        Requires locking {loanAmount.toLocaleString()} BP as collateral.
                      </p>
                    )}
                  </div>
                  <button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-amber-200">
                    Request Loan
                  </button>
                </form>
              </div>

              {/* Invest / Top Up */}
              <div className="bg-blue-50 rounded-[2rem] p-8 border border-blue-100">
                <h3 className="text-lg font-black text-blue-900 mb-2 flex items-center gap-2">
                  <ArrowUpRight size={20} /> Invest in Basket
                </h3>
                <p className="text-sm text-blue-700 mb-6">Top up the basket with hard cash to provide liquidity for members.</p>

                <form onSubmit={handleInvest} className="space-y-6">
                  <div>
                    <label className="block text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 ml-2">Investment Amount (KSh)</label>
                    <input 
                      type="number" 
                      required
                      min="1"
                      value={investAmount || ''}
                      onChange={e => setInvestAmount(Number(e.target.value))}
                      placeholder="0"
                      className="w-full bg-white border border-blue-200 rounded-2xl px-6 py-4 font-black text-blue-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-lg shadow-blue-200">
                    Add Funds to Basket
                  </button>
                </form>

                {/* Active Loans to Repay */}
                {myWallet && myWallet.lockedVouchers > 0 && (
                  <div className="mt-8 pt-8 border-t border-blue-200">
                    <h4 className="text-sm font-black text-blue-900 mb-4">Active Loans</h4>
                    <div className="bg-white rounded-xl p-4 border border-blue-100 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900">KSh {myWallet.lockedVouchers.toLocaleString()} Owed</div>
                        <div className="text-xs text-slate-500">{myWallet.lockedVouchers.toLocaleString()} BP Locked</div>
                      </div>
                      <button 
                        onClick={() => handleRepayLoan(myWallet.lockedVouchers, myWallet.lockedVouchers, selectedBasket)}
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 transition-all"
                      >
                        Repay Full
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AUDIT LOG */}
        {activeTab === 'AUDIT' && (
          <div>
            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-6 ml-2">Universal Audit Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Description</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">From</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">To / Basket</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Vouchers</th>
                    <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Cash</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {transactions.map(tx => (
                    <tr key={tx.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="py-4 px-4 text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-600">
                          {tx.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-slate-700">{tx.description}</td>
                      <td className="py-4 px-4 font-medium text-slate-900">{getUserName(tx.fromUser) || '-'}</td>
                      <td className="py-4 px-4 font-medium text-slate-900">
                        {tx.basketId ? baskets.find(b => b.id === tx.basketId)?.name : getUserName(tx.toUser) || '-'}
                      </td>
                      <td className="py-4 px-4 text-right font-black text-indigo-600">
                        {tx.voucherAmount > 0 ? `${tx.voucherAmount} BP` : '-'}
                      </td>
                      <td className="py-4 px-4 text-right font-black text-emerald-600">
                        {tx.cashAmount > 0 ? `KSh ${tx.cashAmount.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">No transactions recorded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
