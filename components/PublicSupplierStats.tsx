import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { SaleRecord, RecordStatus } from '../types';

interface StatsPayload {
  totalSales: number;
  coopProfit: number;
  clusterShare: number;
  transactionCount: number;
}

interface TimeframeStats {
  weekly: StatsPayload;
  monthly: StatsPayload;
  allTime: StatsPayload;
}

const PublicSupplierStats: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 'records' now holds the ENTIRE CLUSTER'S records
  const [clusterRecords, setClusterRecords] = useState<SaleRecord[]>([]);
  
  const [supplierName, setSupplierName] = useState('');
  const [supplierCluster, setSupplierCluster] = useState('');
  const [view, setView] = useState<'INPUT' | 'STATS'>('INPUT');

  // Helper to normalize phone for search
  const normalizePhone = (p: string | null | undefined) => {
    if (!p) return '';
    let s = p.trim().replace(/\D/g, '');
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
      const searchTerm = normalizePhone(phone);
      let foundName = "Supplier";
      let foundCluster = "";

      // 1. Identify the Supplier & Cluster
      // Check Sales Records first
      const { data: salesIdentity, error: salesError } = await supabase
        .from('records')
        .select('farmer_name, cluster')
        .or(`farmer_phone.ilike.%${searchTerm}%,farmer_phone.eq.${phone}`)
        .limit(1);

      if (salesError) throw salesError;

      if (salesIdentity && salesIdentity.length > 0) {
        foundName = salesIdentity[0].farmer_name;
        foundCluster = salesIdentity[0].cluster;
      } else {
        // If not in sales, check Produce Listings
        const { data: produceIdentity, error: produceError } = await supabase
          .from('produce')
          .select('supplier_name, cluster')
          .or(`supplier_phone.ilike.%${searchTerm}%,supplier_phone.eq.${phone}`)
          .limit(1);
        
        if (produceError) throw produceError;

        if (produceIdentity && produceIdentity.length > 0) {
          foundName = produceIdentity[0].supplier_name;
          foundCluster = produceIdentity[0].cluster;
        }
      }

      if (!foundCluster) {
        alert("No records found. You may not be assigned to a cluster yet.");
        setLoading(false);
        return;
      }

      setSupplierName(foundName);
      setSupplierCluster(foundCluster);

      // 2. Fetch ALL records for the identified Cluster
      const { data: clusterData, error: clusterError } = await supabase
        .from('records')
        .select('*')
        .eq('cluster', foundCluster) // Fetching whole cluster
        .order('date', { ascending: false });

      if (clusterError) throw clusterError;

      // Map DB fields to TypeScript Interface
      const mappedRecords: SaleRecord[] = (clusterData || []).map((r: any) => ({
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

      // Filter for valid financial records (Paid/Verified/Validated/Complete)
      const validRecords = mappedRecords.filter(r => 
        r.status === RecordStatus.PAID || 
        r.status === RecordStatus.COMPLETE ||
        r.status === RecordStatus.VERIFIED || 
        r.status === RecordStatus.VALIDATED
      );

      setClusterRecords(validRecords);
      setView('STATS');

    } catch (err) {
      console.error(err);
      alert("Network Error: Could not fetch records.");
    } finally {
      setLoading(false);
    }
  };

  const calculatePayload = (data: SaleRecord[]): StatsPayload => {
    const totalSales = data.reduce((sum, r) => sum + r.totalSale, 0);
    const coopProfit = data.reduce((sum, r) => sum + r.coopProfit, 0);
    // 60% of Coop Profit goes to Cluster Share
    const clusterShare = coopProfit * 0.60; 

    return {
      totalSales,
      coopProfit,
      clusterShare,
      transactionCount: data.length
    };
  };

  const getStats = (dataSet: SaleRecord[]): TimeframeStats => {
    const now = new Date();
    
    // Weekly (Start of week Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0,0,0,0);

    // Monthly (Start of Month)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const weeklyRecords = dataSet.filter(r => new Date(r.date) >= startOfWeek);
    const monthlyRecords = dataSet.filter(r => new Date(r.date) >= startOfMonth);

    return {
      weekly: calculatePayload(weeklyRecords),
      monthly: calculatePayload(monthlyRecords),
      allTime: calculatePayload(dataSet)
    };
  };

  // Derive stats
  const clusterStats = view === 'STATS' ? getStats(clusterRecords) : null;
  const myRecords = view === 'STATS' ? clusterRecords.filter(r => normalizePhone(r.farmerPhone) === normalizePhone(phone)) : [];
  const myStats = view === 'STATS' ? getStats(myRecords) : null;

  /* ───────── RENDER: INPUT VIEW ───────── */
  if (view === 'INPUT') {
    return (
      <div className="fixed inset-0 z-50 bg-[#F8FAFC] flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
        <div className="w-full max-w-md bg-white rounded-[3rem] shadow-2xl border border-slate-200 overflow-hidden relative">
          <div className="bg-black p-8 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-green-500 to-green-300"></div>
             <h2 className="text-2xl font-black text-white uppercase tracking-tight">Supplier Portal</h2>
             <p className="text-[10px] font-black text-green-400 uppercase tracking-widest mt-2">Community Fund Tracker</p>
             <button onClick={onBack} className="absolute top-6 left-6 text-white/50 hover:text-white transition-colors">
               <i className="fas fa-arrow-left text-xl"></i>
             </button>
          </div>
          
          <div className="p-10 space-y-8">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto text-green-600 border border-green-100 shadow-sm">
                <i className="fas fa-users text-3xl"></i>
              </div>
              <p className="text-slate-500 font-bold text-sm leading-relaxed">
                Enter your phone number to view the <span className="text-black font-black">Community Fund</span> status for your cluster.
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
                View Cluster Data
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
             <h2 className="text-xl font-black text-black uppercase tracking-tight">{supplierCluster} Cluster</h2>
             <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">
                <i className="fas fa-user mr-1"></i> {supplierName}
             </p>
          </div>
        </div>

        <div className="w-full max-w-2xl space-y-8 pb-20">
          
          {/* Main Hero Card - CLUSTER STATS */}
          <div className="bg-black rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden">
             <div className="absolute top-0 right-0 p-12 opacity-10"><i className="fas fa-users text-9xl"></i></div>
             <div className="relative z-10 space-y-6">
                <div>
                   <p className="text-[10px] font-black text-green-400 uppercase tracking-[0.3em] mb-2">Total Community Fund</p>
                   <h1 className="text-5xl font-black tracking-tighter">KSh {clusterStats?.allTime.clusterShare.toLocaleString()}</h1>
                   <p className="text-xs font-bold text-slate-400 mt-2">
                     This is the <span className="text-white">60% Profit Share</span> available for {supplierCluster} community projects.
                   </p>
                </div>
                
                <div className="h-px bg-white/10 w-full"></div>

                <div className="grid grid-cols-2 gap-8">
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Cluster Sales</p>
                      <p className="text-xl font-bold">KSh {clusterStats?.allTime.totalSales.toLocaleString()}</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Transactions</p>
                      <p className="text-xl font-bold">{clusterStats?.allTime.transactionCount}</p>
                   </div>
                </div>
             </div>
          </div>

          {/* Weekly & Monthly Cluster Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekly */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-2 h-full bg-blue-500"></div>
               <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center"><i className="fas fa-calendar-week"></i></div>
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest">This Week</span>
               </div>
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cluster Fund Growth</p>
                  <p className="text-3xl font-black text-black">KSh {clusterStats?.weekly.clusterShare.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">Total Sales: KSh {clusterStats?.weekly.totalSales.toLocaleString()}</p>
               </div>
            </div>

            {/* Monthly */}
            <div className="bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-2 h-full bg-purple-500"></div>
               <div className="flex justify-between items-start mb-6">
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-500 flex items-center justify-center"><i className="fas fa-calendar-alt"></i></div>
                  <span className="px-3 py-1 bg-purple-50 text-purple-600 rounded-full text-[9px] font-black uppercase tracking-widest">This Month</span>
               </div>
               <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Cluster Fund Growth</p>
                  <p className="text-3xl font-black text-black">KSh {clusterStats?.monthly.clusterShare.toLocaleString()}</p>
                  <p className="text-[10px] font-bold text-slate-400 mt-2">Total Sales: KSh {clusterStats?.monthly.totalSales.toLocaleString()}</p>
               </div>
            </div>
          </div>

          {/* Personal Contribution Card */}
          <div className="bg-green-50 rounded-[2.5rem] p-8 border border-green-100 shadow-inner flex items-center gap-6">
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-green-600 shadow-sm shrink-0">
               <i className="fas fa-hand-holding-dollar text-2xl"></i>
             </div>
             <div>
                <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Your Contribution</p>
                <p className="text-2xl font-black text-slate-900">KSh {myStats?.allTime.clusterShare.toLocaleString()}</p>
                <p className="text-[10px] font-bold text-slate-500 mt-1">
                  You generated this amount for the {supplierCluster} fund.
                </p>
             </div>
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
