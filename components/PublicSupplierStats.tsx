
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { SaleRecord, RecordStatus } from '../types';
import { PROFIT_MARGIN } from '../constants';

interface SupplierStats {
  period: string;
  totalSales: number;
  coopProfit: number;
  clusterShare: number;
  transactionCount: number;
}

const PublicSupplierStats: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [supplierName, setSupplierName] = useState('');
  const [view, setView] = useState<'INPUT' | 'STATS'>('INPUT');

  // Helper to normalize phone for search
  const normalizePhone = (p: string) => {
    let s = p.trim().replace(/\D/g, '');
    // Handle Kenyan formats casually (07xx -> 7xx, 2547xx -> 7xx) for loose matching if needed, 
    // but strict E.164 is better for DB. 
    // Here we'll rely on the user typing what matches the DB record (usually 07... or +254...)
    // A simple approach is searching with the last 9 digits.
    return s.length >= 9 ? s.slice(-9) : s;
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (phone.length < 9) {
      alert("Please enter a valid phone number.");
      return;
    }

    setLoading(true);
    try {
      // Fetch all records where the farmer phone contains the input digits (last 9)
      // This allows '0712...' to match '+254712...'
      const searchTerm = normalizePhone(phone);
      
      const { data, error } = await supabase
        .from('records')
        .select('*')
        .or(`farmer_phone.ilike.%${searchTerm}%,farmer_phone.eq.${phone}`)
        .order('date', { ascending: false });

      if (error) throw error;

      if (!data || data.length === 0) {
        alert("No records found for this number.");
        setLoading(false);
        return;
      }

      // Map DB fields to TypeScript Interface
      const mappedRecords: SaleRecord[] = data.map((r: any) => ({
        id: r.id,
        date: r.date,
        cropType: r.crop_type,
        unitType: r.unit_type,
        farmerName: r.farmer_name,
        farmerPhone: r.farmer_phone,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        unitsSold: Number(r.units_sold),
        unitPrice: Number(r.unit_price),
        totalSale: Number(r.total_sale),
        coopProfit: Number(r.coop_profit),
        status: r.status,
        signature: r.signature,
        createdAt: r.created_at,
        agentPhone: r.agent_phone,
        agentName: r.agent_name,
        cluster: r.cluster,
        synced: true
      }));

      // Filter for valid financial records (Paid/Verified/Validated)
      // We exclude DRAFT to show realized gains, or keep them to show potential?
      // Let's keep verified/paid for "Real Money" and validated for "Pending".
      const validRecords = mappedRecords.filter(r => 
        r.status === RecordStatus.PAID || 
        r.status === RecordStatus.VERIFIED || 
        r.status === RecordStatus.VALIDATED
      );

      if (validRecords.length > 0) {
        setSupplierName(validRecords[0].farmerName);
      } else {
        setSupplierName("Supplier");
      }

      setRecords(validRecords);
      setView('STATS');
    } catch (err) {
      console.error(err);
      alert("Network Error: Could not fetch records.");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (filteredRecords: SaleRecord[]): SupplierStats => {
    const totalSales = filteredRecords.reduce((sum, r) => sum + r.totalSale, 0);
    const coopProfit = filteredRecords.reduce((sum, r) => sum + r.coopProfit, 0);
    // 60% of Coop Profit goes to Cluster Share
    const clusterShare = coopProfit * 0.60; 

    return {
      period: '',
      totalSales,
      coopProfit,
      clusterShare,
      transactionCount: filteredRecords.length
    };
  };

  const getTimeframes = () => {
    const now = new Date();
    
    // Weekly (Start of week Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    // Monthly (Start of Month)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const weeklyRecords = records.filter(r => new Date(r.date) >= startOfWeek);
    const monthlyRecords = records.filter(r => new Date(r.date) >= startOfMonth);

    return {
      weekly: calculateStats(weeklyRecords),
      monthly: calculateStats(monthlyRecords),
      allTime: calculateStats(records)
    };
  };

  const stats = view === 'STATS' ? getTimeframes() : null;

  /* ───────── RENDER: INPUT VIEW ───────── */
  if (view === 'INPUT') {
    return (
      <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden relative">
          <div className="bg-black p-8 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-300"></div>
             <h2 className="text-2xl font-black text-white uppercase tracking-tight">Supplier Portal</h2>
             <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mt-2">Check Your Cluster Shares</p>
             <button onClick={onBack} className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors">
               <i className="fas fa-arrow-left text-xl"></i>
             </button>
          </div>
          
          <div className="p-10 space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600 border border-green-100 shadow-sm">
                <i className="fas fa-hand-holding-dollar text-3xl"></i>
              </div>
              <p className="text-slate-500 font-bold text-sm leading-relaxed">
                Enter your phone number to see your total sales and your contribution to the community cluster fund.
              </p>
            </div>

            <form onSubmit={handleSearch} className="space-y-6">
              <div className="relative">
                <i className="fas fa-phone absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 text-xl"></i>
                <input 
                  type="tel" 
                  autoFocus
                  placeholder="07..." 
                  className="w-full bg-slate-50 border border-slate-200 rounded-3xl py-6 pl-16 pr-6 text-2xl font-black text-black outline-none focus:bg-white focus:border-green-500 transition-all placeholder:text-slate-300 tracking-widest"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-6 rounded-3xl font-black uppercase text-sm tracking-[0.2em] shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-search"></i>}
                Check My Records
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  /* ───────── RENDER: STATS VIEW ───────── */
  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] overflow-y-auto animate-in slide-in-from-bottom-10 duration-500">
      <div className="min-h-full p-4 md:p-8 flex flex-col items-center">
        
        {/* Header */}
        <div className="w-full max-w-2xl flex items-center justify-between mb-8">
          <button onClick={() => setView('INPUT')} className="bg-white w-12 h-12 rounded-2xl border border-slate-200 shadow-lg flex items-center justify-center text-slate-400 hover:text-black hover:scale-105 transition-all">
            <i className="fas fa-arrow-left text-lg"></i>
          </button>
          <div className="text-right">
             <h2 className="text-xl font-black text-black uppercase tracking-tight">{supplierName}</h2>
             <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">Verified Stakeholder</p>
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-8 pb-20">
          
          {/* Main Hero Card - All Time */}
          <div className="bg-black rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-12 opacity-10"><i className="fas fa-coins text-9xl"></i></div>
             <div className="relative z-10 space-y-6">
                <div>
                   <p className="text-[10px] font-black text-green-400 uppercase tracking-[0.3em] mb-2">Total Community Contribution</p>
                   <h1 className="text-5xl font-black tracking-tighter">KSh {stats?.allTime.clusterShare.toLocaleString()}</h1>
                   <p className="text-xs font-bold text-slate-400 mt-2">This is the 60% share generated for your cluster from your sales.</p>
                </div>
                
                <div className="h-px bg-white/10 w-full"></div>

                <div className="grid grid-cols-2 gap-8">
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Sales Volume</p>
                      <p className="text-xl font-bold">KSh {stats?.allTime.totalSales.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Transactions</p>
                      <p className="text-xl font-bold">{stats?.allTime.transactionCount}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Weekly & Monthly Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Weekly Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
               <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center"><i className="fas fa-calendar-week"></i></div>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">This Week</span>
               </div>
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cluster Share Generated</p>
                  <p className="text-3xl font-black text-black">KSh {stats?.weekly.clusterShare.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">From KSh {stats?.weekly.totalSales.toLocaleString()} sales</p>
               </div>
            </div>

            {/* Monthly Card */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
               <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center"><i className="fas fa-calendar-alt"></i></div>
                  <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black uppercase tracking-widest">This Month</span>
               </div>
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cluster Share Generated</p>
                  <p className="text-3xl font-black text-black">KSh {stats?.monthly.clusterShare.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">From KSh {stats?.monthly.totalSales.toLocaleString()} sales</p>
               </div>
            </div>

          </div>

          {/* Explanation / Footer */}
          <div className="bg-slate-50 rounded-[2rem] p-8 border border-slate-200 text-center">
             <i className="fas fa-info-circle text-slate-300 text-2xl mb-4"></i>
             <p className="text-xs font-bold text-slate-500 leading-relaxed">
               As a stakeholder, your produce contributes to the strength of your cluster. 
               <br/>60% of the profits generated by your sales are reinvested into your local community cluster.
             </p>
          </div>

          <button onClick={onBack} className="w-full bg-slate-200 hover:bg-slate-300 text-slate-600 py-6 rounded-3xl font-black uppercase text-xs tracking-widest transition-all">
            Close Portal
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicSupplierStats;
