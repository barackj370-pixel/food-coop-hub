import React, { useState, useEffect } from 'react';
import { ProduceListing, SystemRole, isSuperAgent } from '../types';

interface SaleFormProps {
  clusters: string[];
  produceListings: ProduceListing[];
  agentCluster?: string;
  userRole?: SystemRole;
  agentPhone?: string;
  initialData?: {
    cropType?: string;
    unitsSold?: number;
    unitType?: string;
    customerName?: string;
    customerPhone?: string;
    orderId?: string;
    produceId?: string;
    farmerName?: string;
    farmerPhone?: string;
    unitPrice?: number;
    cluster?: string;
    deliveryFee?: number;
  };
  onSubmit: (data: {
    date: string;
    cropType: string;
    unitType: string;
    farmerName: string;
    farmerPhone: string;
    customerName: string;
    customerPhone: string;
    unitsSold: number;
    unitPrice: number;
    cluster: string;
    orderId?: string;
    produceId?: string;
    deliveryFee?: number;
    isAggregate?: boolean;
    coopProfit?: number;
    buyingPrice?: number;
  }) => void;
}

const SaleForm: React.FC<SaleFormProps> = ({ onSubmit, clusters, agentCluster, userRole, agentPhone }: SaleFormProps) => {
  const isSuper = userRole === SystemRole.SYSTEM_DEVELOPER || userRole === SystemRole.SALES_MANAGER || userRole === SystemRole.MANAGER || isSuperAgent(agentPhone);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cluster: isSuper ? '' : (agentCluster || ''),
  });

  const [aggregateBuyingPrice, setAggregateBuyingPrice] = useState<number>(0);
  const [aggregateSellingPrice, setAggregateSellingPrice] = useState<number>(0);
  
  const [commissionType, setCommissionType] = useState<'gross_sale_10' | 'gross_profit_10_plus_1' | 'profit_100'>('gross_profit_10_plus_1');

  // Automatically update the default commission type when the food coop is chosen
  useEffect(() => {
    if (formData.cluster) {
      setCommissionType('gross_profit_10_plus_1');
    }
  }, [formData.cluster]);

  const aggTotalProfit = Math.max(0, aggregateSellingPrice - aggregateBuyingPrice);
  
  let ourShare = 0;
  if (commissionType === 'gross_sale_10') {
    ourShare = aggregateSellingPrice * 0.10;
  } else if (commissionType === 'gross_profit_10_plus_1') {
    ourShare = aggTotalProfit * 0.10 + 1;
  } else if (commissionType === 'profit_100') {
    ourShare = aggTotalProfit;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCluster = formData.cluster || agentCluster;
    if (!finalCluster) {
      alert("Validation Error: Please select a Food Coop.");
      return;
    }

    if (aggregateSellingPrice <= 0 || aggregateBuyingPrice <= 0) {
      alert("Validation Error: Please enter valid aggregate prices.");
      return;
    }
    if (aggregateSellingPrice < aggregateBuyingPrice) {
      alert("Validation Error: Aggregate Selling Price cannot be less than Buying Price.");
      return;
    }

    onSubmit({
      date: formData.date,
      cropType: 'AGGREGATE (Weekly)',
      unitType: 'Total Volume',
      farmerName: 'Multiple Farmers',
      farmerPhone: 'N/A',
      customerName: 'Multiple Customers',
      customerPhone: 'N/A',
      unitsSold: 1,
      unitPrice: aggregateSellingPrice,
      cluster: finalCluster,
      isAggregate: true,
      coopProfit: ourShare,
      buyingPrice: aggregateBuyingPrice
    });

    setAggregateBuyingPrice(0);
    setAggregateSellingPrice(0);
  };

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative">
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-8">
        <div className="text-center lg:text-left space-y-4">
          <div>
            <h3 className="text-xl font-black text-black uppercase tracking-tighter">New Sales Entry</h3>
            <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mt-1">Quick Weekly Aggregate Only</p>
          </div>
        </div>
        <div className="bg-slate-900 px-10 py-6 rounded-3xl border border-black text-center lg:text-right shadow-xl">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2">Real-time Calculation</span>
           <p className="text-[13px] font-black text-white uppercase tracking-tight">
             Total Sales: <span className="text-white">KSh {aggregateSellingPrice.toLocaleString()}</span> | Buying: <span className="text-slate-300">KSh {aggregateBuyingPrice.toLocaleString()}</span> | Commission: <span className="text-green-400">KSh {ourShare.toLocaleString()}</span>
           </p>
           <p className="text-[9.5px] font-bold text-slate-400 uppercase mt-2">
             Gross Profit: KSh {aggTotalProfit.toLocaleString()}
           </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {/* Trade Date */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Trade Date</label>
          <input 
            type="date" 
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        {/* Selected Food Coop */}
        {(isSuper && clusters.length > 0) ? (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Food Coop</label>
            <select 
              value={formData.cluster}
              onChange={(e) => setFormData({...formData, cluster: e.target.value})}
              className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all appearance-none"
            >
              <option value="" disabled>Select Food Coop...</option>
              {clusters.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        ) : (
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Food Coop</label>
            <input 
              type="text" 
              readOnly 
              value={formData.cluster || agentCluster || 'Unassigned'} 
              className="w-full bg-slate-100 border border-slate-200 rounded-2xl text-[13px] font-bold text-slate-500 p-4" 
            />
          </div>
        )}

        {/* Aggregate Buying Price */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Aggregate Buying Price (KSh)</label>
          <input 
            type="number" 
            min="0"
            step="0.01"
            placeholder="0.00"
            value={aggregateBuyingPrice || ''}
            onChange={(e) => setAggregateBuyingPrice(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        {/* Aggregate Selling Price */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Aggregate Selling Price (KSh)</label>
          <input 
            type="number" 
            min="0"
            step="0.01"
            placeholder="0.00"
            value={aggregateSellingPrice || ''}
            onChange={(e) => setAggregateSellingPrice(parseFloat(e.target.value) || 0)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        {/* Commission Calculation Rule Selector */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Commission Rule</label>
          <select 
            value={commissionType}
            onChange={(e) => setCommissionType(e.target.value as any)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all appearance-none"
          >
            <option value="gross_sale_10">10% of Aggregate Gross Sale</option>
            <option value="gross_profit_10_plus_1">10% + 1 of Aggregate Gross Profit</option>
            <option value="profit_100">100% of Profit</option>
          </select>
        </div>

        <div className="flex items-end col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-5 mt-4">
          <button 
            type="submit"
            className="w-full bg-black hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.3em] py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fas fa-file-contract"></i> Commit Aggregate Entry
          </button>
        </div>
      </form>
    </div>
  );
};

export default SaleForm;
