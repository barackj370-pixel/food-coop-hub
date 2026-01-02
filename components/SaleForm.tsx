import React, { useState, useEffect } from 'react';
import { CROP_TYPES, CROP_CONFIG, PROFIT_MARGIN } from '../constants.ts';

interface SaleFormProps {
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
    createdBy: string;
  }) => void;
}

const SaleForm: React.FC<SaleFormProps> = ({ onSubmit }) => {
  const [isSigning, setIsSigning] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cropType: CROP_TYPES[0],
    unitType: CROP_CONFIG[CROP_TYPES[0] as keyof typeof CROP_CONFIG][0],
    farmerName: '',
    farmerPhone: '',
    customerName: '',
    customerPhone: '',
    unitsSold: 0,
    unitPrice: 0,
    createdBy: localStorage.getItem('coop_user_name') || 'Field Agent'
  });

  useEffect(() => {
    const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] as readonly string[];
    if (availableUnits && !availableUnits.includes(formData.unitType)) {
      setFormData(prev => ({ ...prev, unitType: availableUnits[0] }));
    }
  }, [formData.cropType]);

  const totalSale = formData.unitsSold * formData.unitPrice;
  const ourShare = totalSale * PROFIT_MARGIN;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.farmerName || !formData.customerName || formData.unitsSold <= 0 || formData.unitPrice <= 0) {
      alert("Please fill in the farmer, customer, and correct amounts.");
      return;
    }
    
    setIsSigning(true);
    await new Promise(resolve => setTimeout(resolve, 600));
    
    onSubmit(formData);
    setFormData({
      ...formData,
      farmerName: '',
      farmerPhone: '',
      customerName: '',
      customerPhone: '',
      unitsSold: 0,
      unitPrice: 0
    });
    setIsSigning(false);
  };

  const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] || ['Units'];

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-8 overflow-hidden relative">
      {isSigning && (
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-pulse"></div>
      )}
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">New Sale Entry</h3>
        <div className="flex items-center space-x-3">
          <div className="flex flex-col items-end">
             <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Calculated Total</span>
             <p className="text-[11px] font-black text-emerald-600">Sale: KSh {totalSale.toLocaleString()} | Food Coop Commission: KSh {ourShare.toLocaleString()}</p>
          </div>
          <div className="h-6 w-[1px] bg-slate-100 mx-1"></div>
          <i className="fas fa-check-circle text-emerald-500 text-[10px]"></i>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-10 gap-4">
        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Date</label>
          <input 
            type="date" 
            value={formData.date}
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>
        
        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Crop</label>
          <select 
            value={formData.cropType}
            onChange={(e) => setFormData({...formData, cropType: e.target.value})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          >
            {CROP_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Unit</label>
          <select 
            value={formData.unitType}
            onChange={(e) => setFormData({...formData, unitType: e.target.value})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          >
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>

        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Farmer</label>
          <input 
            type="text" 
            placeholder="Farmer name..."
            value={formData.farmerName}
            onChange={(e) => setFormData({...formData, farmerName: e.target.value})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Farmer Tel</label>
          <input 
            type="tel" 
            placeholder="07..."
            value={formData.farmerPhone}
            onChange={(e) => setFormData({...formData, farmerPhone: e.target.value})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Customer</label>
          <input 
            type="text" 
            placeholder="Buyer name..."
            value={formData.customerName}
            onChange={(e) => setFormData({...formData, customerName: e.target.value})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Customer Tel</label>
          <input 
            type="tel" 
            placeholder="07..."
            value={formData.customerPhone}
            onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
          <input 
            type="number" 
            placeholder="0"
            value={formData.unitsSold || ''}
            onChange={(e) => setFormData({...formData, unitsSold: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="space-y-1 xl:col-span-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase">Price</label>
          <input 
            type="number" 
            placeholder="0.00"
            value={formData.unitPrice || ''}
            onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border-slate-200 rounded-lg text-sm text-slate-900 p-2.5 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
          />
        </div>

        <div className="flex items-end xl:col-span-1">
          <button 
            type="submit"
            disabled={isSigning}
            className="w-full bg-slate-900 hover:bg-black text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-lg transition-all shadow-md active:scale-95 flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {isSigning ? (
              <><i className="fas fa-spinner fa-spin"></i></>
            ) : (
              <><i className="fas fa-plus-circle"></i></>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SaleForm;