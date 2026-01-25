
import React, { useState, useEffect } from 'react';
import { CROP_CONFIG, COMMODITY_CATEGORIES } from '../constants.ts';
import { SystemRole } from '../types.ts';

interface ProduceFormProps {
  userRole: SystemRole;
  cluster: string;
  defaultSupplierName?: string;
  defaultSupplierPhone?: string;
  onSubmit: (data: {
    date: string;
    cropType: string;
    unitType: string;
    unitsAvailable: number;
    sellingPrice: number;
    supplierName: string;
    supplierPhone: string;
    cluster: string;
  }) => void;
}

const ProduceForm: React.FC<ProduceFormProps> = ({ onSubmit, userRole, cluster, defaultSupplierName, defaultSupplierPhone }) => {
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cropType: 'Maize',
    otherCropType: '',
    unitType: 'Bag',
    unitsAvailable: 0,
    sellingPrice: 0,
    supplierName: defaultSupplierName || '',
    supplierPhone: defaultSupplierPhone || '',
    cluster: cluster
  });

  useEffect(() => {
    const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] as readonly string[];
    if (availableUnits && !availableUnits.includes(formData.unitType)) {
      setFormData(prev => ({ ...prev, unitType: availableUnits[0] }));
    }
  }, [formData.cropType]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCropType = formData.cropType === 'Other' ? formData.otherCropType.trim() : formData.cropType;
    if (formData.unitsAvailable <= 0 || formData.sellingPrice <= 0 || !formData.supplierName || !formData.supplierPhone) {
      alert("Please fill all fields.");
      return;
    }
    const { otherCropType, ...submissionData } = formData;
    onSubmit({ ...submissionData, cropType: finalCropType });
    setFormData({ ...formData, unitsAvailable: 0, sellingPrice: 0 });
  };

  const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] || ['Units'];

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 mb-12">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h3 className="text-xl font-black text-black uppercase tracking-tighter">New Supplies Entry</h3>
          <p className="text-[10px] font-black text-green-600 uppercase tracking-[0.3em] mt-1">Direct from Cluster: {cluster}</p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-6">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date</label>
          <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[13px] font-bold" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Commodity</label>
          <select value={formData.cropType} onChange={e => setFormData({...formData, cropType: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[13px] font-bold">
            {Object.entries(COMMODITY_CATEGORIES).map(([cat, items]) => (
              <optgroup key={cat} label={cat}>{items.map(i => <option key={i} value={i}>{i}</option>)}</optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Qty</label>
          <input type="number" placeholder="0" value={formData.unitsAvailable || ''} onChange={e => setFormData({...formData, unitsAvailable: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[13px] font-bold" />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Unit</label>
          <select value={formData.unitType} onChange={e => setFormData({...formData, unitType: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[13px] font-bold">
            {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Unit Price (KSh)</label>
          <input type="number" placeholder="0.00" value={formData.sellingPrice || ''} onChange={e => setFormData({...formData, sellingPrice: parseFloat(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-2xl border border-slate-100 text-[13px] font-bold" />
        </div>
        <div className="flex items-end">
          <button type="submit" className="w-full bg-green-600 hover:bg-green-700 text-white p-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-lg transition-all active:scale-95">Post Product</button>
        </div>
      </form>
    </div>
  );
};

export default ProduceForm;
