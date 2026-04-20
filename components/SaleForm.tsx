
import React, { useState, useEffect } from 'react';
import { CROP_CONFIG, PROFIT_MARGIN, COMMODITY_CATEGORIES, TEN_PERCENT_COOPS } from '../constants';
import { ProduceListing, SystemRole } from '../types';

interface SaleFormProps {
  clusters: string[];
  produceListings: ProduceListing[];
  agentCluster?: string;
  userRole?: SystemRole;
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
  }) => void;
}

const SaleForm: React.FC<SaleFormProps> = ({ onSubmit, initialData, clusters, produceListings, agentCluster, userRole }: SaleFormProps) => {
  const [formData, setFormData] = useState(() => {
    const isPrivileged = userRole === SystemRole.SYSTEM_DEVELOPER || userRole === SystemRole.SALES_MANAGER || userRole === SystemRole.MANAGER;
    const defaultCluster = isPrivileged ? '' : (agentCluster || '');
    const defaultCropType = '';
    const matches = produceListings.filter(p => 
      p.cluster === defaultCluster && 
      p.cropType === defaultCropType &&
      p.unitsAvailable > 0 && 
      p.status === 'AVAILABLE'
    );
    
    let defaultFarmer = 'Food Coop';
    let defaultPhone = 'COOP-INTERNAL';
    let defaultPrice = 0;
    let defaultUnit = '2kg Tin';
    let defaultProduceId = undefined;

    if (matches.length > 0 && defaultCluster !== '' && defaultCropType !== '') {
      const bestMatch = matches.sort((a, b) => {
        if (a.sellingPrice !== b.sellingPrice) return a.sellingPrice - b.sellingPrice;
        return b.unitsAvailable - a.unitsAvailable;
      })[0];
      defaultFarmer = bestMatch.supplierName;
      defaultPhone = bestMatch.supplierPhone;
      defaultPrice = bestMatch.sellingPrice;
      defaultUnit = bestMatch.unitType;
      defaultProduceId = bestMatch.id;
    }

    return {
      date: new Date().toISOString().split('T')[0],
      cropType: defaultCropType,
      otherCropType: '',
      unitType: defaultUnit,
      farmerName: defaultCluster === '' || defaultCropType === '' ? '' : defaultFarmer,
      farmerPhone: defaultCluster === '' || defaultCropType === '' ? '' : defaultPhone,
      customerName: '',
      customerPhone: '',
      unitsSold: 0,
      unitPrice: defaultPrice,
      cluster: defaultCluster,
      produceId: defaultProduceId
    };
  });

  const [isAutoFilled, setIsAutoFilled] = useState(() => {
    const isPrivileged = userRole === SystemRole.SYSTEM_DEVELOPER || userRole === SystemRole.SALES_MANAGER || userRole === SystemRole.MANAGER;
    const defaultCluster = isPrivileged ? '' : (agentCluster || '');
    if (defaultCluster === '') return false;
    const matches = produceListings.filter(p => 
      p.cluster === defaultCluster && 
      p.cropType === '' &&
      p.unitsAvailable > 0 && 
      p.status === 'AVAILABLE'
    );
    return matches.length > 0;
  });

  // Auto-fill logic based on Cluster and Commodity
  useEffect(() => {
    // Determine the current commodity type
    const currentCropType = formData.cropType === 'Other' ? formData.otherCropType.trim() : formData.cropType;
    
    if (!currentCropType) {
      setIsAutoFilled(false);
      return;
    }

    // Search for matching suppliers in the SAME cluster
    const matches = produceListings.filter(p => 
      p.cluster === formData.cluster && 
      p.cropType === currentCropType &&
      p.unitsAvailable > 0 && 
      p.status === 'AVAILABLE'
    );

    if (matches.length > 0) {
      // Pick the best (lowest) price, then highest quantity
      const bestMatch = matches.sort((a, b) => {
        if (a.sellingPrice !== b.sellingPrice) {
          return a.sellingPrice - b.sellingPrice;
        }
        return b.unitsAvailable - a.unitsAvailable;
      })[0];
      
      // Check if we actually need to update the state to prevent infinite loops / unnecessary re-renders
      if (
        formData.farmerName !== bestMatch.supplierName ||
        formData.unitPrice !== bestMatch.sellingPrice ||
        formData.unitType !== bestMatch.unitType
      ) {
        setFormData(prev => ({
          ...prev,
          farmerName: bestMatch.supplierName,
          farmerPhone: bestMatch.supplierPhone,
          unitPrice: bestMatch.sellingPrice,
          unitType: bestMatch.unitType,
          produceId: bestMatch.id
        }));
        setIsAutoFilled(true);
      }
    } else {
      if (formData.cluster === '') {
         setFormData(prev => ({
          ...prev,
          farmerName: '',
          farmerPhone: '',
          unitPrice: 0,
          produceId: undefined
        }));
        setIsAutoFilled(false);
      } else if (formData.farmerName !== 'Food Coop' || isAutoFilled) {
        // No supplier in cluster: Default to Food Coop
        setFormData(prev => ({
          ...prev,
          farmerName: 'Food Coop',
          farmerPhone: 'COOP-INTERNAL',
          unitPrice: isAutoFilled ? 0 : prev.unitPrice,
          produceId: undefined
        }));
        setIsAutoFilled(false);
      }
    }
  }, [formData.cluster, formData.cropType, formData.otherCropType, produceListings, formData.farmerName, formData.unitPrice, formData.unitType, isAutoFilled]);

  // Handle manual field synchronization from initialData (e.g. when fulfilling an order)
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        cropType: initialData.cropType !== undefined ? initialData.cropType : prev.cropType,
        unitsSold: initialData.unitsSold !== undefined ? initialData.unitsSold : prev.unitsSold,
        unitType: initialData.unitType !== undefined ? initialData.unitType : prev.unitType,
        customerName: initialData.customerName !== undefined ? initialData.customerName : prev.customerName,
        customerPhone: initialData.customerPhone !== undefined ? initialData.customerPhone : prev.customerPhone,
        farmerName: initialData.farmerName !== undefined ? initialData.farmerName : prev.farmerName,
        farmerPhone: initialData.farmerPhone !== undefined ? initialData.farmerPhone : prev.farmerPhone,
        unitPrice: initialData.unitPrice !== undefined ? initialData.unitPrice : prev.unitPrice,
        cluster: initialData.cluster !== undefined ? initialData.cluster : prev.cluster,
        produceId: initialData.produceId !== undefined ? initialData.produceId : prev.produceId
      }));
    }
  }, [initialData]);

  useEffect(() => {
    const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] as readonly string[];
    if (availableUnits && !availableUnits.includes(formData.unitType)) {
      setFormData(prev => ({ ...prev, unitType: availableUnits[0] }));
    }
  }, [formData.cropType]);

  const totalSale = formData.unitsSold * formData.unitPrice;
  let ourShare = totalSale * PROFIT_MARGIN;
  
  const isProfitPerItem = !TEN_PERCENT_COOPS.includes(formData.cluster || agentCluster || '');
  if (isProfitPerItem && formData.produceId) {
    const produce = produceListings.find(p => p.id === formData.produceId);
    if (produce && produce.wholesalePrice !== undefined) {
      const totalProfit = (formData.unitPrice - produce.wholesalePrice) * formData.unitsSold;
      if ((formData.farmerName || '').toLowerCase() !== 'food coop') {
        ourShare = totalProfit * 0.10 + 1;
      } else {
        ourShare = totalProfit;
      }
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCropType = formData.cropType === 'Other' ? formData.otherCropType.trim() : formData.cropType;

    if (!formData.cluster) {
      alert("Validation Error: Please select a Food Coop.");
      return;
    }

    if (!formData.farmerName || !formData.customerName || formData.unitsSold <= 0 || formData.unitPrice <= 0 || (formData.cropType === 'Other' && !finalCropType)) {
      alert("Validation Error: Please complete all required fields including a valid price.");
      return;
    }
    
    const { otherCropType, ...submissionData } = formData;
    onSubmit({ 
      ...submissionData, 
      cropType: finalCropType, 
      orderId: initialData?.orderId,
      produceId: formData.produceId,
      deliveryFee: initialData?.deliveryFee
    });
    
    setFormData({
      ...formData,
      otherCropType: '',
      farmerName: '',
      farmerPhone: '',
      customerName: '',
      customerPhone: '',
      unitsSold: 0,
      unitPrice: 0
    });
    setIsAutoFilled(false);
  };

  const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] || ['Units'];

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative">
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-8">
        <div className="text-center lg:text-left">
          <h3 className="text-xl font-black text-black uppercase tracking-tighter">New Sales Entry</h3>
          <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.3em] mt-1">Audit Verification Required</p>
        </div>
        <div className="bg-slate-900 px-10 py-6 rounded-3xl border border-black text-center lg:text-right shadow-xl">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2">Real-time Calculation { (initialData?.orderId || initialData?.produceId || isAutoFilled) && "(System Match)"}</span>
           <p className="text-[13px] font-black text-white uppercase tracking-tight">
             Total: KSh {totalSale.toLocaleString()} {initialData?.deliveryFee ? `(+ KSh ${initialData.deliveryFee} Delivery)` : ''} | Commission: <span className="text-green-400">KSh {ourShare.toLocaleString()}</span>
           </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {/* Sales Agent Inputs */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Trade Date</label>
          <input 
            type="date" 
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        {(userRole === SystemRole.SYSTEM_DEVELOPER || userRole === SystemRole.SALES_MANAGER || userRole === SystemRole.MANAGER) && clusters.length > 0 && (
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
        )}
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Commodity</label>
          <select 
            value={formData.cropType}
            onChange={(e) => setFormData({...formData, cropType: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all appearance-none"
          >
            <option value="" disabled>Select Commodity...</option>
            {Object.entries(COMMODITY_CATEGORIES).map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map(item => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        {formData.cropType === 'Other' && (
          <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-black text-red-600 uppercase ml-2 tracking-widest">Details</label>
            <input 
              type="text" 
              placeholder="..."
              value={formData.otherCropType}
              onChange={(e) => setFormData({...formData, otherCropType: e.target.value})}
              className="w-full bg-red-50/30 border border-red-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-red-400 outline-none transition-all shadow-sm"
              required
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Quantity</label>
          <input 
            type="number" 
            placeholder="0"
            value={formData.unitsSold || ''}
            onChange={(e) => setFormData({...formData, unitsSold: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Unit Type</label>
          <select 
            value={formData.unitType}
            onChange={(e) => setFormData(prev => ({...prev, unitType: e.target.value, unitPrice: 0}))}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all appearance-none"
          >
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Customer Name</label>
          <input 
            type="text" 
            placeholder="..."
            value={formData.customerName}
            onChange={(e) => setFormData({...formData, customerName: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Customer Contact</label>
          <input 
            type="tel" 
            placeholder="07..."
            value={formData.customerPhone}
            onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        {/* Auto-filled / Conditional Inputs */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Name</label>
          <input 
            type="text" 
            placeholder="..."
            readOnly={isAutoFilled}
            value={formData.farmerName}
            onChange={(e) => setFormData({...formData, farmerName: e.target.value})}
            className={`w-full border rounded-2xl text-[13px] font-bold p-4 outline-none transition-all ${isAutoFilled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-100 text-black focus:bg-white focus:border-green-400'}`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Contact</label>
          <input 
            type="tel" 
            placeholder="..."
            readOnly={isAutoFilled}
            value={formData.farmerPhone}
            onChange={(e) => setFormData({...formData, farmerPhone: e.target.value})}
            className={`w-full border rounded-2xl text-[13px] font-bold p-4 outline-none transition-all ${isAutoFilled ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-100 text-black focus:bg-white focus:border-green-400'}`}
          />
        </div>

        <div className="space-y-1.5">
          <label className={`text-[10px] font-black uppercase ml-2 tracking-widest ${isAutoFilled ? 'text-green-600' : 'text-red-600'}`}>
            Unit Price (KSh) {isAutoFilled ? '- Auto Suggested' : '- Manual'}
          </label>
          <input 
            type="number" 
            step="0.01"
            placeholder="0.00"
            // ALWAYS EDITABLE to allow agent to override bulk pricing for retail sales
            readOnly={false} 
            value={formData.unitPrice || ''}
            onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})}
            className={`w-full border rounded-2xl text-[13px] font-bold p-4 outline-none transition-all ${isAutoFilled ? 'bg-green-50 border-green-200 text-black focus:bg-white focus:border-green-400' : 'bg-red-50 border-red-200 text-black focus:bg-white focus:border-red-400'}`}
          />
        </div>

        <div className="flex items-end">
          <button 
            type="submit"
            className="w-full bg-black hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.3em] py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fas fa-file-contract"></i> Commit Entry
          </button>
        </div>
      </form>
      
      {!isAutoFilled && formData.unitsSold > 0 && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3">
          <i className="fas fa-info-circle text-red-600"></i>
          <p className="text-[10px] font-bold text-red-700 uppercase tracking-tight">
            No supplier matches found in Food Coop <span className="underline">{formData.cluster}</span> for this quantity. Transaction defaulting to Food Coop internal pool. Please enter current market price.
          </p>
        </div>
      )}
    </div>
  );
};

export default SaleForm;
