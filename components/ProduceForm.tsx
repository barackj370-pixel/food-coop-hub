import React, { useState, useEffect } from 'react';
import { CROP_CONFIG, COMMODITY_CATEGORIES } from '../constants.ts';

interface ProduceFormProps {
  supplierName: string;
  supplierPhone: string;
  onSubmit: (data: {
    date: string;
    cropType: string;
    unitType: string;
    unitsAvailable: number;
    sellingPrice: number;
  }) => void;
}

const ProduceForm: React.FC<ProduceFormProps> = ({ onSubmit, supplierName, supplierPhone }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cropType: 'Maize',
    otherCropType: '',
    unitType: 'Bag',
    unitsAvailable: 0,
    sellingPrice: 0
  });

  useEffect(() => {
    const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] as readonly string[];
    if (availableUnits && !availableUnits.includes(formData.unitType)) {
      setFormData(prev => ({ ...prev, unitType: availableUnits[0] }));
    }
  }, [formData.cropType]);

  const totalValue = formData.unitsAvailable * formData.sellingPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCropType = formData.cropType === 'Other' ? formData.otherCropType.trim() : formData.cropType;

    if (formData.unitsAvailable <= 0 || formData.sellingPrice <= 0 || (formData.cropType === 'Other' && !finalCropType)) {
      alert("Validation Error: Please provide valid quantity, price, and details.");
      return;
    }
    
    const { otherCropType, ...submissionData } = formData;
    onSubmit({ ...submissionData, cropType: finalCropType });
    
    setFormData({
      ...formData,
      otherCropType: '',
      unitsAvailable: 0,
      sellingPrice: 0
    });
  };

  const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] || ['Units'];

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative mb-12">
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-8">
        <div className="text-center lg:text-left">
          <h3 className="text-xl font-black text-black uppercase tracking-tighter">New Supplies Entry</h3>
          <p className="text-[10px] font-black text-green-600 uppercase tracking-[0.3em] mt-1">Listing Harvest for Cluster Agents</p>
        </div>
        <div className="bg-slate-900 px-10 py-6 rounded-3xl border border-black text-center lg:text-right shadow-xl">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2">Estimated Market Value</span>
           <p className="text-[13px] font-black text-white uppercase tracking-tight">
             Subtotal: <span className="text-green-400">KSh {totalValue.toLocaleString()}</span>
           </p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Entry Date</label>
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
              <optgroup key={category} label={category} className="font-bold text-black bg-slate-50">
                {items.map(item => (
                  <option key={item} value={item} className="text-black bg-white">{item}</option>
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
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Profile</label>
          <div className="bg-slate-100/50 border border-slate-200 rounded-2xl p-4">
             <p className="text-[11px] font-black text-black uppercase truncate">{supplierName}</p>
             <p className="text-[9px] font-bold text-slate-500 font-mono">{supplierPhone}</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Quantity Avail.</label>
          <input 
            type="number" 
            placeholder="0"
            value={formData.unitsAvailable || ''}
            onChange={(e) => setFormData({...formData, unitsAvailable: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Asking Price (KSh)</label>
          <input 
            type="number" 
            step="0.01"
            placeholder="0.00"
            value={formData.sellingPrice || ''}
            onChange={(e) => setFormData({...formData, sellingPrice: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="flex items-end">
          <button 
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[11px] tracking-[0.3em] py-5 rounded-2xl transition-all shadow-xl active:scale-95"
          >
            Post Harvest
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProduceForm;