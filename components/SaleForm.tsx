import React, { useState, useEffect } from 'react';
import { CROP_CONFIG, PROFIT_MARGIN, COMMODITY_CATEGORIES } from '../constants.ts';
import { ProduceListing } from '../types.ts';

interface SaleFormProps {
  clusters: string[];
  produceListings: ProduceListing[];
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
  }) => void;
}

const SaleForm: React.FC<SaleFormProps> = ({ onSubmit, clusters, produceListings }: SaleFormProps) => {
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
    unitPrice: 0.00,
    cluster: clusters[0] || 'Mariwa'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCropType = formData.cropType === 'Other' ? formData.otherCropType.trim() : formData.cropType;
    if (formData.unitsSold <= 0 || formData.unitPrice <= 0) {
      alert("Validation Error.");
      return;
    }
    const { otherCropType, ...submissionData } = formData;
    onSubmit({ ...submissionData, cropType: finalCropType });
    setFormData({ ...formData, unitsSold: 0, unitPrice: 0 });
  };

  const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] || ['Units'];

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200">
      <h3 className="text-xl font-black text-black uppercase tracking-tighter mb-8">New Sales Entry</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Commodity</label>
          <select value={formData.cropType} onChange={(e) => setFormData({...formData, cropType: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold text-black outline-none">
            {Object.entries(COMMODITY_CATEGORIES).map(([category, items]) => (
              <optgroup key={category} label={category}>{items.map(item => <option key={item} value={item}>{item}</option>)}</optgroup>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Quantity</label>
          <input type="number" value={formData.unitsSold || ''} onChange={(e) => setFormData({...formData, unitsSold: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold" />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Unit Price</label>
          <input type="number" value={formData.unitPrice || ''} onChange={(e) => setFormData({...formData, unitPrice: parseFloat(e.target.value) || 0})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold" />
        </div>
        <button type="submit" className="bg-black text-white font-black uppercase text-[11px] tracking-[0.3em] py-5 rounded-2xl shadow-xl">Commit Entry</button>
      </form>
    </div>
  );
};

export default SaleForm;