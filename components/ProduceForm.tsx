
import React, { useState, useEffect } from 'react';
import { PRODUCT_CONFIG, COMMODITY_CATEGORIES, PROFIT_MARGIN } from '../constants.ts';
import { SystemRole } from '../types.ts';

interface ProduceFormProps {
  userRole: SystemRole;
  defaultSupplierName?: string;
  defaultSupplierPhone?: string;
  onSubmit: (data: {
    date: string;
    productType: string;
    unitType: string;
    unitsAvailable: number;
    sellingPrice: number;
    supplierName: string;
    supplierPhone: string;
  }) => void;
}

const ProduceForm: React.FC<ProduceFormProps> = ({ onSubmit, userRole, defaultSupplierName, defaultSupplierPhone }) => {
  const isSupplier = userRole === SystemRole.SUPPLIER;
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    productType: 'Maize',
    otherProductType: '',
    unitType: 'Bag',
    unitsAvailable: 0,
    sellingPrice: 0,
    supplierName: defaultSupplierName || '',
    supplierPhone: defaultSupplierPhone || ''
  });

  useEffect(() => {
    const availableUnits = PRODUCT_CONFIG[formData.productType as keyof typeof PRODUCT_CONFIG] as readonly string[];
    if (availableUnits && !availableUnits.includes(formData.unitType)) {
      setFormData(prev => ({ ...prev, unitType: availableUnits[0] }));
    }
  }, [formData.productType]);

  const marketPrice = formData.sellingPrice * (1 + PROFIT_MARGIN);
  const totalValue = formData.unitsAvailable * marketPrice;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalProductType = formData.productType === 'Other' ? formData.otherProductType.trim() : formData.productType;

    if (!formData.supplierName || formData.unitsAvailable <= 0 || formData.sellingPrice <= 0 || (formData.productType === 'Other' && !finalProductType)) {
      alert("Validation Error: Please complete all fields with valid data.");
      return;
    }

    const { otherProductType, ...submissionData } = formData;
    onSubmit({ ...submissionData, productType: finalProductType });
    
    setFormData({
      ...formData,
      otherProductType: '',
      unitsAvailable: 0,
      sellingPrice: 0
    });
  };

  const availableUnits = PRODUCT_CONFIG[formData.productType as keyof typeof PRODUCT_CONFIG] || ['Units'];

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-black text-black uppercase tracking-tighter">New Inventory Listing</h3>
          <p className="text-[10px] font-black text-green-600 uppercase tracking-[0.3em] mt-1">Direct Farmer Input Hub</p>
        </div>
        <div className="bg-slate-50 px-8 py-4 rounded-3xl border border-slate-100 text-right">
           <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Est. Marketplace Value</span>
           <p className="text-sm font-black text-black">KSh {totalValue.toLocaleString()}</p>
        </div>
      </div>
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Listing Date</label>
          <input 
            type="date" 
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Product Category</label>
          <select 
            value={formData.productType}
            onChange={(e) => setFormData({...formData, productType: e.target.value})}
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

        {formData.productType === 'Other' && (
          <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
            <label className="text-[10px] font-black text-red-600 uppercase ml-2 tracking-widest">Specify Item</label>
            <input 
              type="text" 
              placeholder="..."
              value={formData.otherProductType}
              onChange={(e) => setFormData({...formData, otherProductType: e.target.value})}
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
            value={formData.unitsAvailable || ''}
            onChange={(e) => setFormData({...formData, unitsAvailable: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Unit</label>
          <select 
            value={formData.unitType}
            onChange={(e) => setFormData({...formData, unitType: e.target.value})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all appearance-none"
          >
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Price / Unit (KSh)</label>
          <input 
            type="number" 
            placeholder="0.00"
            value={formData.sellingPrice || ''}
            onChange={(e) => setFormData({...formData, sellingPrice: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Name</label>
          <input 
            type="text" 
            placeholder="..."
            readOnly={isSupplier}
            value={formData.supplierName}
            onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
            className={`w-full border rounded-2xl text-[13px] font-bold p-4 outline-none transition-all ${isSupplier ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-100 text-black focus:bg-white focus:border-green-400'}`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Contact</label>
          <input 
            type="tel" 
            placeholder="07..."
            readOnly={isSupplier}
            value={formData.supplierPhone}
            onChange={(e) => setFormData({...formData, supplierPhone: e.target.value})}
            className={`w-full border rounded-2xl text-[13px] font-bold p-4 outline-none transition-all ${isSupplier ? 'bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed' : 'bg-slate-50 border-slate-100 text-black focus:bg-white focus:border-green-400'}`}
          />
        </div>

        <div className="flex items-end">
          <button 
            type="submit"
            className="w-full bg-black hover:bg-slate-900 text-white font-black uppercase text-[11px] tracking-[0.3em] py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fas fa-seedling"></i> Post Harvest
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProduceForm;
