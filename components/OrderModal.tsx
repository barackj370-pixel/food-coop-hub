import React, { useState } from 'react';
import { ProduceListing, AgentIdentity, MarketOrder, OrderStatus } from '../types';
import { X, MapPin, Package, Truck, Info } from 'lucide-react';

interface Props {
  product: ProduceListing;
  agentIdentity: AgentIdentity;
  onClose: () => void;
  onSubmit: (order: MarketOrder) => void;
}

const OrderModal: React.FC<Props> = ({ product, agentIdentity, onClose, onSubmit }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [deliveryAddress, setDeliveryAddress] = useState('');

  // Delivery fee logic: Free if customer's cluster matches product's cluster, else Ksh 200
  const deliveryFee = agentIdentity.cluster === product.cluster ? 0 : 200;
  const totalCost = (product.sellingPrice * quantity) + deliveryFee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quantity <= 0 || quantity > product.unitsAvailable) {
      alert(`Please enter a valid quantity up to ${product.unitsAvailable}`);
      return;
    }
    if (!deliveryAddress.trim()) {
      alert("Please enter a delivery address");
      return;
    }

    const newOrder: MarketOrder = {
      id: `dir-ord-${Date.now()}`,
      date: new Date().toISOString(),
      cropType: product.cropType,
      unitsRequested: quantity,
      unitType: product.unitType,
      customerName: agentIdentity.name,
      customerPhone: agentIdentity.phone,
      status: OrderStatus.OPEN,
      agentPhone: '', // Will be claimed by a sales agent
      cluster: product.cluster, // The order belongs to the product's cluster for fulfillment
      synced: false,
      deliveryAddress,
      deliveryFee,
      supplierName: product.supplierName,
      supplierPhone: product.supplierPhone,
      produceId: product.id,
      isDirectOrder: true,
      customerFoodCoop: agentIdentity.cluster
    };

    onSubmit(newOrder);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-emerald-600 p-6 flex justify-between items-center text-white">
          <div>
            <h2 className="text-xl font-black tracking-tight">Place Order</h2>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">Direct from Supplier</p>
          </div>
          <button onClick={onClose} className="p-2 bg-emerald-700/50 hover:bg-emerald-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
            <h3 className="font-black text-slate-800 text-lg">{product.cropType}</h3>
            <p className="text-xs font-bold text-slate-500 mt-1">From: {product.supplierName} ({product.cluster})</p>
            <div className="mt-3 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Price:</span>
              <span className="font-black text-emerald-600">KSh {product.sellingPrice} / {product.unitType}</span>
            </div>
            <div className="mt-1 flex justify-between items-center">
              <span className="text-sm font-bold text-slate-600">Available:</span>
              <span className="font-black text-slate-800">{product.unitsAvailable} {product.unitType}s</span>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">
                <Package className="w-4 h-4" /> Quantity ({product.unitType}s)
              </label>
              <input 
                type="number" 
                min="1" 
                max={product.unitsAvailable}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                required
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">
                <MapPin className="w-4 h-4" /> Delivery Address
              </label>
              <textarea 
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Enter specific delivery instructions..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none h-24"
                required
              />
            </div>
          </div>

          <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 space-y-2">
            <div className="flex justify-between items-center text-sm font-bold text-slate-600">
              <span>Subtotal:</span>
              <span>KSh {product.sellingPrice * quantity}</span>
            </div>
            <div className="flex justify-between items-center text-sm font-bold text-slate-600">
              <span className="flex items-center gap-1"><Truck className="w-4 h-4" /> Delivery Fee:</span>
              <span>{deliveryFee === 0 ? 'FREE' : `KSh ${deliveryFee}`}</span>
            </div>
            {deliveryFee > 0 && (
              <p className="text-[10px] text-emerald-600/80 font-bold flex items-start gap-1 mt-1">
                <Info className="w-3 h-3 shrink-0 mt-0.5" />
                Delivery is free within your registered Food Coop ({agentIdentity.cluster}). Ksh 200 applies for outside deliveries.
              </p>
            )}
            <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
              <span className="font-black text-slate-800">Total to Pay:</span>
              <span className="text-xl font-black text-emerald-600">KSh {totalCost}</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mt-2">Payment on Delivery</p>
          </div>

          <button 
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-black uppercase text-xs tracking-[0.15em] shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
          >
            Confirm Order
          </button>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;
