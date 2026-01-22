import React, { useState, useEffect } from 'react';
import { CROP_CONFIG, PROFIT_MARGIN, COMMODITY_CATEGORIES } from '../constants.ts';

interface SaleFormProps {
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
    orderId?: string;
    produceId?: string;
  }) => void;
}

const SaleForm: React.FC<SaleFormProps> = ({ onSubmit, initialData }: SaleFormProps) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cropType: 'Maize',
    otherCropType: '',
    unitType: '2kg Tin',
    farmerName: '',
    farmerPhone: '',
    customerName: '',
    customerPhone: '',
    unitsSold: 0,
    unitPrice: 0.00
  });

  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        // Using nullish coalescing (??) instead of logical OR (||) 
        // to ensure 0 and "" are correctly processed as intended values.
        cropType: initialData.cropType ?? prev.cropType,
        unitsSold: initialData.unitsSold ?? prev.unitsSold,
        unitType: initialData.unitType ?? prev.unitType,
        customerName: initialData.customerName ?? prev.customerName,
        customerPhone: initialData.customerPhone ?? prev.customerPhone,
        farmerName: initialData.farmerName ?? prev.farmerName,
        farmerPhone: initialData.farmerPhone ?? prev.farmerPhone,
        unitPrice: initialData.unitPrice ?? prev.unitPrice
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
  const ourShare = totalSale * PROFIT_MARGIN;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCropType = formData.cropType === 'Other' ? formData.otherCropType.trim() : formData.cropType;

    if (!formData.farmerName || !formData.customerName || formData.unitsSold <= 0 || formData.unitPrice <= 0 || (formData.cropType === 'Other' && !finalCropType)) {
      alert("Validation Error: Please complete all fields.");
      return;
    }
    
    const { otherCropType, ...submissionData } = formData;
    onSubmit({ 
      ...submissionData, 
      cropType: finalCropType, 
      orderId: initialData?.orderId,
      produceId: initialData?.produceId 
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
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2">Real-time Calculation { (initialData?.orderId || initialData?.produceId) && "(Linked Source)"}</span>
           <p className="text-[13px] font-black text-white uppercase tracking-tight">
             Total: KSh {totalSale.toLocaleString()} | Commission: <span className="text-green-400">KSh {ourShare.toLocaleString()}</span>
           </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Trade Date</label>
          <input 
            type="date" 
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>
        
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Commodity</label>
          <select 
            value={formData.cropType}
            onChange={(e) => setFormData({...formData, cropType: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all appearance-none"
          >
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
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Unit Type</label>
          <select 
            value={formData.unitType}
            onChange={(e) => setFormData({...formData, unitType: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all appearance-none"
          >
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Name</label>
          <input 
            type="text" 
            placeholder="..."
            value={formData.farmerName}
            onChange={(e) => setFormData({...formData, farmerName: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Contact</label>
          <input 
            type="tel" 
            placeholder="07..."
            value={formData.farmerPhone}
            onChange={(e) => setFormData({...formData, farmerPhone: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
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
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Unit Price (KSh)</label>
          <input 
            type="number" 
            step="0.01"
            placeholder="0.00"
            value={formData.unitPrice || ''}
            onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
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
    </div>
  );
};

export default SaleForm;