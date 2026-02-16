
import React, { useState, useEffect } from 'react';
import { ProduceListing, AgentIdentity, SystemRole } from '../types';
import { CROP_CONFIG } from '../constants';

interface OrderModalProps {
  listing: ProduceListing;
  agent: AgentIdentity;
  onClose: () => void;
  onSubmit: (data: {
    quantity: number;
    unitType: string;
    targetPrice: number;
    customerName: string;
    customerPhone: string;
  }) => void;
}

const OrderModal: React.FC<OrderModalProps> = ({ listing, agent, onClose, onSubmit }) => {
  const [quantity, setQuantity] = useState<string>('1');
  const [unitType, setUnitType] = useState(listing.unitType);
  const [targetPrice, setTargetPrice] = useState<string>(String(listing.sellingPrice));
  const [isSelfOrder, setIsSelfOrder] = useState(true);
  const [customerName, setCustomerName] = useState(agent.name);
  const [customerPhone, setCustomerPhone] = useState(agent.phone);

  const availableUnits = CROP_CONFIG[listing.cropType as keyof typeof CROP_CONFIG] || ['Units'];

  useEffect(() => {
    if (isSelfOrder) {
      setCustomerName(agent.name);
      setCustomerPhone(agent.phone);
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  }, [isSelfOrder, agent]);

  const handleUnitChange = (newUnit: string) => {
    setUnitType(newUnit);
    // If returning to original unit, suggest original price. Otherwise clear/zero for manual entry.
    if (newUnit === listing.unitType) {
      setTargetPrice(String(listing.sellingPrice));
    } else {
      setTargetPrice('0');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    const price = parseFloat(targetPrice);

    if (!qty || qty <= 0) {
      alert("Please enter a valid quantity.");
      return;
    }
    if (isNaN(price) || price < 0) {
      alert("Please enter a valid unit price.");
      return;
    }
    if (!customerName || !customerPhone) {
      alert("Please provide customer details.");
      return;
    }
    onSubmit({
      quantity: qty,
      unitType,
      targetPrice: price,
      customerName,
      customerPhone
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-black text-black uppercase tracking-tight">Place Order</h3>
            <p className="text-[10px] font-black text-green-600 uppercase tracking-widest">{listing.cropType} from {listing.cluster}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 transition-all flex items-center justify-center">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Identity Section */}
          {agent.role === SystemRole.SALES_AGENT && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <label className="flex items-center gap-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={isSelfOrder} 
                  onChange={(e) => setIsSelfOrder(e.target.checked)} 
                  className="w-5 h-5 accent-black rounded-lg"
                />
                <span className="text-xs font-black uppercase text-slate-600 tracking-wider">Order for myself ({agent.name})</span>
              </label>
            </div>
          )}

          {!isSelfOrder && (
            <div className="grid grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Customer Name</label>
                <input 
                  required
                  type="text" 
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-sm text-black outline-none focus:border-green-400 transition-all"
                  placeholder="Name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Customer Phone</label>
                <input 
                  required
                  type="tel" 
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-sm text-black outline-none focus:border-green-400 transition-all"
                  placeholder="07..."
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Quantity</label>
                <input 
                  required
                  type="number" 
                  step="0.1"
                  value={quantity}
                  onChange={e => setQuantity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-xl text-black outline-none focus:border-green-400 transition-all"
                />
             </div>
             <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Unit Type</label>
                <select 
                  value={unitType}
                  onChange={e => handleUnitChange(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 font-bold text-sm text-black outline-none focus:border-green-400 transition-all appearance-none"
                >
                  {availableUnits.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
             </div>
          </div>

          <div className="space-y-1">
             <label className={`text-[9px] font-black uppercase tracking-widest ml-2 ${targetPrice === '0' || unitType !== listing.unitType ? 'text-red-600' : 'text-slate-400'}`}>
                Unit Price (KSh) {unitType !== listing.unitType ? '(Manual)' : '(Listing)'}
             </label>
             <input 
               type="number" 
               step="0.01"
               value={targetPrice}
               onChange={e => setTargetPrice(e.target.value)}
               className={`w-full border rounded-2xl px-4 py-3 font-bold text-lg outline-none focus:border-green-400 transition-all ${unitType !== listing.unitType ? 'bg-red-50 border-red-100 text-black' : 'bg-slate-50 border-slate-100 text-black'}`}
               placeholder="0.00"
             />
             {unitType !== listing.unitType && (
               <p className="text-[9px] font-bold text-red-500 mt-1 ml-2">
                 * You changed units. Please confirm unit price.
               </p>
             )}
          </div>

          <div className="pt-4">
             <button type="submit" className="w-full bg-black text-white py-4 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-800 shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">
               Confirm Order <i className="fas fa-arrow-right"></i>
             </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;
