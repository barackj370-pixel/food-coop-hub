
import React, { useState, useEffect, useRef } from 'react';
import { CROP_CONFIG, COMMODITY_CATEGORIES, PROFIT_MARGIN } from '../constants.ts';
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
    images: string[];
  }) => void;
}

const ProduceForm: React.FC<ProduceFormProps> = ({ onSubmit, userRole, defaultSupplierName, defaultSupplierPhone }) => {
  const isSupplier = userRole === SystemRole.SUPPLIER;
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    cropType: 'Maize',
    otherCropType: '',
    unitType: 'Bag',
    unitsAvailable: 0,
    sellingPrice: 0, // Treated as the "Base Price" entered by the user
    supplierName: defaultSupplierName || '',
    supplierPhone: defaultSupplierPhone || '',
    images: [] as string[]
  });

  useEffect(() => {
    const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] as readonly string[];
    if (availableUnits && !availableUnits.includes(formData.unitType)) {
      setFormData(prev => ({ ...prev, unitType: availableUnits[0] }));
    }
  }, [formData.cropType]);

  // Calculate the final market price including the coop commission
  const marketPrice = formData.sellingPrice * (1 + PROFIT_MARGIN);
  const totalValue = formData.unitsAvailable * marketPrice;

  // Helper: Compress and Convert Image to Base64
  const processImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_WIDTH = 800; // Max width for storage efficiency
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7)); // 70% Quality JPEG
        };
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const remainingSlots = 2 - formData.images.length;
      if (remainingSlots <= 0) {
        alert("Maximum 2 images allowed per listing.");
        return;
      }
      
      const files = Array.from(e.target.files).slice(0, remainingSlots);
      const processedImages = await Promise.all(files.map(processImage));
      
      setFormData(prev => ({
        ...prev,
        images: [...prev.images, ...processedImages]
      }));
    }
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const finalCropType = formData.cropType === 'Other' ? formData.otherCropType.trim() : formData.cropType;

    if (formData.unitsAvailable <= 0 || formData.sellingPrice <= 0 || !formData.supplierName || !formData.supplierPhone || (formData.cropType === 'Other' && !finalCropType)) {
      alert("Validation Error: Please provide valid quantity, price, supplier details, and commodity information.");
      return;
    }
    
    const { otherCropType, sellingPrice, ...submissionData } = formData;
    // The submitted sellingPrice now includes the 10% commission
    const finalSellingPrice = sellingPrice * (1 + PROFIT_MARGIN);
    
    onSubmit({ 
      ...submissionData, 
      cropType: finalCropType, 
      sellingPrice: finalSellingPrice 
    });
    
    setFormData({
      ...formData,
      otherCropType: '',
      unitsAvailable: 0,
      sellingPrice: 0,
      images: [],
      supplierName: isSupplier ? (defaultSupplierName || '') : '',
      supplierPhone: isSupplier ? (defaultSupplierPhone || '') : '07'
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const availableUnits = CROP_CONFIG[formData.cropType as keyof typeof CROP_CONFIG] || ['Units'];

  return (
    <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden relative mb-12">
      <div className="flex flex-col lg:flex-row justify-between items-center mb-10 gap-8">
        <div className="text-center lg:text-left">
          <h3 className="text-xl font-black text-black uppercase tracking-tighter">New Supplies Entry</h3>
          <p className="text-[10px] font-black text-green-600 uppercase tracking-[0.3em] mt-1">Listing Harvest for Market Hub</p>
        </div>
        <div className="bg-slate-900 px-10 py-6 rounded-3xl border border-black text-center lg:text-right shadow-xl">
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-2">Estimated Market Value (Incl. 10% Fee)</span>
           <p className="text-[13px] font-black text-white uppercase tracking-tight">
             Subtotal: <span className="text-green-400">KSh {totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Name</label>
          <input 
            type="text" 
            placeholder="Name..."
            readOnly={isSupplier}
            value={formData.supplierName}
            onChange={(e) => setFormData({...formData, supplierName: e.target.value})}
            className={`w-full border rounded-2xl text-[13px] font-bold text-black p-4 outline-none transition-all ${isSupplier ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-green-400'}`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Supplier Phone</label>
          <input 
            type="tel" 
            placeholder="07..."
            readOnly={isSupplier}
            value={formData.supplierPhone}
            onChange={(e) => setFormData({...formData, supplierPhone: e.target.value})}
            className={`w-full border rounded-2xl text-[13px] font-bold text-black p-4 outline-none transition-all ${isSupplier ? 'bg-slate-100 border-slate-200 cursor-not-allowed' : 'bg-slate-50 border-slate-100 focus:bg-white focus:border-green-400'}`}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Qty Available</label>
          <input 
            type="number" 
            placeholder="0"
            value={formData.unitsAvailable || ''}
            onChange={(e) => setFormData({...formData, unitsAvailable: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Asking Price (Base)</label>
          <input 
            type="number" 
            step="0.01"
            placeholder="0.00"
            value={formData.sellingPrice || ''}
            onChange={(e) => setFormData({...formData, sellingPrice: parseFloat(e.target.value) || 0})}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl text-[13px] font-bold text-black p-4 focus:bg-white focus:border-green-400 outline-none transition-all"
          />
          {formData.sellingPrice > 0 && (
            <div className="px-2 py-1.5 bg-green-50 rounded-lg border border-green-100 animate-in fade-in duration-300">
               <p className="text-[9px] font-black text-green-700 uppercase tracking-tight">Market Price: KSh {marketPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
               <p className="text-[8px] font-bold text-slate-400 uppercase leading-none mt-0.5">Incl. 10% Coop Fee</p>
            </div>
          )}
        </div>

        {/* Image Upload Section */}
        <div className="col-span-1 md:col-span-2 lg:col-span-4 xl:col-span-5 border-t border-slate-100 pt-6">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Product Images (Max 2)</label>
           <div className="flex flex-wrap items-center gap-4">
              {formData.images.map((img, idx) => (
                <div key={idx} className="relative group w-24 h-24 rounded-2xl overflow-hidden shadow-md border border-slate-200">
                  <img src={img} alt="Product" className="w-full h-full object-cover" />
                  <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] shadow-sm hover:scale-110 transition-transform">
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
              
              {formData.images.length < 2 && (
                <label className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 hover:border-green-400 hover:bg-green-50 flex flex-col items-center justify-center cursor-pointer transition-all group">
                   <input 
                      ref={fileInputRef}
                      type="file" 
                      accept="image/*" 
                      multiple 
                      className="hidden" 
                      onChange={handleImageUpload} 
                   />
                   <i className="fas fa-camera text-slate-300 group-hover:text-green-500 text-xl mb-1 transition-colors"></i>
                   <span className="text-[9px] font-bold text-slate-400 group-hover:text-green-600 uppercase">Add Photo</span>
                </label>
              )}
           </div>
        </div>

        <div className="flex items-end col-span-1 md:col-span-2 lg:col-span-4 xl:col-span-5">
          <button 
            type="submit"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-black uppercase text-[11px] tracking-[0.3em] py-5 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2"
          >
            <i className="fas fa-seedling"></i> Post Product
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProduceForm;
