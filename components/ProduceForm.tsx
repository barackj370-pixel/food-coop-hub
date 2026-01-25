import React, { useState, useEffect } from 'react';
import { CROP_CONFIG, COMMODITY_CATEGORIES } from '../constants.ts';
import { SystemRole } from '../types.ts';

interface ProduceFormProps {
  userRole: SystemRole;
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
  }) => void;
}

const ProduceForm: React.FC<ProduceFormProps> = ({ onSubmit, userRole, defaultSupplierName, defaultSupplierPhone }) => {
  const isSupplier = userRole === SystemRole.SUPPLIER;
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cropType: 'Maize',
    otherCropType: '',
    unitType: 'Bag',
    unitsAvailable: 0,
    sellingPrice: 0,
    supplierName: defaultSupplierName || '',
    supplierPhone: defaultSupplierPhone || ''
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
      <h3 className="text-xl font-black mb-6">New Supplies Entry</h3>
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="bg-slate-50 p-4 rounded-2xl border" />
        <select value={formData.cropType} onChange={e => setFormData({...formData, cropType: e.target.value})} className="bg-slate-50 p-4 rounded-2xl border">
          {Object.entries(COMMODITY_CATEGORIES).map(([cat, items]) => (
            <optgroup key={cat} label={cat}>{items.map(i => <option key={i} value={i}>{i}</option>)}</optgroup>
          ))}
        </select>
        <input type="number" placeholder="Qty" value={formData.unitsAvailable || ''} onChange={e => setFormData({...formData, unitsAvailable: parseFloat(e.target.value)})} className="bg-slate-50 p-4 rounded-2xl border" />
        <input type="number" placeholder="Price" value={formData.sellingPrice || ''} onChange={e => setFormData({...formData, sellingPrice: parseFloat(e.target.value)})} className="bg-slate-50 p-4 rounded-2xl border" />
        <button type="submit" className="bg-green-600 text-white p-4 rounded-2xl font-bold">Post Product</button>
      </form>
    </div>
  );
};

export default ProduceForm;