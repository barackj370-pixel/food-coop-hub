import React, { useState } from 'react';
import { ProduceListing, AgentIdentity, MarketOrder, OrderStatus, SystemRole } from '../types';
import { CROP_CONFIG, FOOD_COOPS } from '../constants';
import { X, MapPin, Package, Truck, Info, UserCheck, Calendar, Sparkles, Store } from 'lucide-react';

interface Props {
  product: ProduceListing | null;
  agentIdentity: AgentIdentity;
  clusters?: string[];
  prefill?: {
    cluster?: string;
    cropType?: string;
  };
  onClose: () => void;
  onSubmit: (order: MarketOrder) => void;
}

const OrderModal: React.FC<Props> = ({ product, agentIdentity, clusters = FOOD_COOPS, prefill, onClose, onSubmit }) => {
  const isAgentOrManager =
    agentIdentity.role === SystemRole.SALES_AGENT ||
    agentIdentity.role === SystemRole.YOUTH_AGENT ||
    agentIdentity.role === SystemRole.SALES_MANAGER ||
    agentIdentity.role === SystemRole.MANAGER ||
    agentIdentity.role === SystemRole.SYSTEM_DEVELOPER;

  const isCustomMode = !product;
  const allCoops = clusters.length > 0 ? clusters : FOOD_COOPS;

  const [orderForCustomer, setOrderForCustomer] = useState<boolean>(isAgentOrManager);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAffiliation, setCustomerAffiliation] = useState('');
  const [isCounterCop31, setIsCounterCop31] = useState<boolean>(true);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [quantity, setQuantity] = useState<number>(1);

  // Custom / Unlisted product fields (when product is null)
  const [customCluster, setCustomCluster] = useState<string>(
    (prefill?.cluster && prefill.cluster !== 'ALL' ? prefill.cluster : '') || agentIdentity.cluster || allCoops[0] || ''
  );
  const [customCrop, setCustomCrop] = useState<string>(prefill?.cropType || '');
  const [customUnitType, setCustomUnitType] = useState<string>('Kg');
  const [customUnitPrice, setCustomUnitPrice] = useState<string>('');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');

  const resolvedCluster = product ? product.cluster : customCluster;
  const resolvedUnitPrice = product ? Number(product.sellingPrice || 0) : (parseFloat(customUnitPrice) || 0);
  const resolvedUnitType = product ? product.unitType : (customUnitType.trim() || 'Unit');
  const resolvedCropType = product ? product.cropType : customCrop.trim();

  // Delivery fee logic:
  // Counter COP 31 orders ALWAYS have KSh 0 delivery fee (national gathering, no delivery charge).
  // Otherwise: Free if customer's cluster matches product's cluster, else Ksh 200.
  const deliveryFee = isCounterCop31
    ? 0
    : (agentIdentity.cluster === resolvedCluster ? 0 : 200);

  const subtotal = resolvedUnitPrice * quantity;
  const totalCost = subtotal + deliveryFee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (isCustomMode) {
      if (!resolvedCluster) {
        alert('Please select the supplying Food Coop.');
        return;
      }
      if (!resolvedCropType) {
        alert('Please enter the product name.');
        return;
      }
      if (resolvedUnitPrice <= 0) {
        alert('Please enter a valid unit price (KSh).');
        return;
      }
    } else if (product && (quantity <= 0 || quantity > product.unitsAvailable)) {
      alert(`Please enter a valid quantity up to ${product.unitsAvailable}`);
      return;
    }

    if (quantity <= 0) {
      alert('Quantity must be at least 1.');
      return;
    }

    const finalCustomerName = orderForCustomer ? customerName.trim() : agentIdentity.name;
    const finalCustomerPhone = orderForCustomer ? (customerPhone.trim() || 'Walk-in Customer') : agentIdentity.phone;

    if (orderForCustomer && !finalCustomerName) {
      alert("Please enter the customer's name.");
      return;
    }

    if (!isCounterCop31 && !deliveryAddress.trim()) {
      alert("Please enter a delivery address for standard delivery.");
      return;
    }

    const resolvedAddress = isCounterCop31
      ? (deliveryAddress.trim()
          ? `Counter COP 31 - ${deliveryAddress.trim()}`
          : 'Counter COP 31 National Event Pickup (Nov 17-21)')
      : deliveryAddress.trim();

    const orderIdPrefix = isCounterCop31 ? 'cop31-ord' : 'dir-ord';

    const newOrder: MarketOrder = {
      id: `${orderIdPrefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      date: new Date().toISOString(),
      cropType: resolvedCropType,
      unitsRequested: quantity,
      unitType: resolvedUnitType,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      status: OrderStatus.OPEN,
      agentPhone: agentIdentity.phone,
      cluster: resolvedCluster,
      synced: false,
      deliveryAddress: resolvedAddress,
      deliveryFee,
      supplierName: product ? product.supplierName : (customSupplierName.trim() || `${resolvedCluster} Food Coop`),
      supplierPhone: product ? product.supplierPhone : '',
      produceId: product?.id,
      isDirectOrder: true,
      customerFoodCoop: orderForCustomer
        ? (customerAffiliation.trim() || (isCounterCop31 ? 'Counter COP 31 Customer' : agentIdentity.cluster))
        : agentIdentity.cluster,
      eventTag: isCounterCop31 ? 'COUNTER_COP_31' : undefined,
      unitPrice: resolvedUnitPrice,
      totalAmount: totalCost,
      placedByName: agentIdentity.name,
      placedByRole: agentIdentity.role
    };

    onSubmit(newOrder);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
        <div className="bg-emerald-700 p-5 flex justify-between items-center text-white shrink-0">
          <div>
            <h2 className="text-xl font-black tracking-tight">
              {isCustomMode ? 'Order Unlisted / Custom Product' : 'Place Order'}
            </h2>
            <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest mt-1">
              {isCustomMode ? 'Order from any Food Coop (Even if not listed online)' : `${agentIdentity.role} Assisted / Direct Order`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 bg-emerald-800/60 hover:bg-emerald-800 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden flex-1">
          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {product ? (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
                <h3 className="font-black text-slate-800 text-lg">{product.cropType}</h3>
                <p className="text-xs font-bold text-slate-500 mt-1">
                  Food Coop: <span className="text-slate-800">{product.cluster}</span> &bull; Supplier: {product.supplierName}
                </p>
                <div className="mt-3 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600">Unit Price:</span>
                  <span className="font-black text-emerald-600">KSh {Number(product.sellingPrice).toLocaleString()} / {product.unitType}</span>
                </div>
                <div className="mt-1 flex justify-between items-center">
                  <span className="text-sm font-bold text-slate-600">Available Stock:</span>
                  <span className="font-black text-slate-800">{product.unitsAvailable} {product.unitType}s</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Store className="w-4 h-4 text-emerald-600" /> Product & Food Coop Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Supplying Food Coop *</label>
                    <select
                      value={customCluster}
                      onChange={e => setCustomCluster(e.target.value)}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      required
                    >
                      <option value="">-- Select Food Coop --</option>
                      {allCoops.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Product Name *</label>
                    <input
                      type="text"
                      list="order-modal-crops"
                      value={customCrop}
                      onChange={e => setCustomCrop(e.target.value)}
                      placeholder="e.g. Cassava, Honey, Beans"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      required
                    />
                    <datalist id="order-modal-crops">
                      {Object.keys(CROP_CONFIG).map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Unit Type *</label>
                    <input
                      type="text"
                      value={customUnitType}
                      onChange={e => setCustomUnitType(e.target.value)}
                      placeholder="Kg, Bunch, Tin, Bag..."
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Unit Price (KSh) *</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={customUnitPrice}
                      onChange={e => setCustomUnitPrice(e.target.value)}
                      placeholder="e.g. 200"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Supplier / Farmer Name (Optional)</label>
                    <input
                      type="text"
                      value={customSupplierName}
                      onChange={e => setCustomSupplierName(e.target.value)}
                      placeholder="e.g. Coop Stall / Farmer Name"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Event Selector: Counter COP 31 vs Standard */}
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                <Calendar className="w-4 h-4" /> Order Category / Delivery Mode
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsCounterCop31(true)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all ${
                    isCounterCop31
                      ? 'border-emerald-600 bg-emerald-50/80 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Counter COP 31
                    </span>
                    <span className="text-[10px] font-black bg-emerald-600 text-white px-2 py-0.5 rounded-full">
                      FREE DELIVERY
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-600 mt-1">
                    Nov 17–21 National Event. KSh 0 delivery fee for all Food Coops.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCounterCop31(false)}
                  className={`p-3 rounded-2xl border-2 text-left transition-all ${
                    !isCounterCop31
                      ? 'border-slate-800 bg-slate-50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-slate-600" />
                      Standard Delivery
                    </span>
                    <span className="text-[10px] font-black bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">
                      {agentIdentity.cluster === resolvedCluster ? 'FREE' : 'KSh 200'}
                    </span>
                  </div>
                  <p className="text-[11px] font-semibold text-slate-500 mt-1">
                    Regular delivery outside the event (KSh 200 cross-coop fee).
                  </p>
                </button>
              </div>
            </div>

            {/* Agent / Account Ordering On Behalf of Customer vs Myself */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <UserCheck className="w-4 h-4 text-emerald-600" /> Ordering For
                </span>
                <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setOrderForCustomer(true)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      orderForCustomer ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Customer
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderForCustomer(false)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      !orderForCustomer ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Myself
                  </button>
                </div>
              </div>

              {orderForCustomer && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer Name *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder="e.g. Jane Wanjiku"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer Phone</label>
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="e.g. 0712345678"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer Group / Location (Optional)</label>
                    <input
                      type="text"
                      value={customerAffiliation}
                      onChange={e => setCustomerAffiliation(e.target.value)}
                      placeholder={isCounterCop31 ? "e.g. Counter COP 31 Delegate / Guest" : "e.g. Customer Coop or Estate"}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quantity & Delivery Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  <Package className="w-4 h-4" /> Quantity ({resolvedUnitType}s)
                </label>
                <input
                  type="number"
                  min="1"
                  max={product ? product.unitsAvailable : undefined}
                  value={quantity}
                  onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  <MapPin className="w-4 h-4" /> {isCounterCop31 ? 'Pickup Stall / Note (Optional)' : 'Delivery Address *'}
                </label>
                <input
                  type="text"
                  value={deliveryAddress}
                  onChange={e => setDeliveryAddress(e.target.value)}
                  placeholder={isCounterCop31 ? "e.g. Counter COP 31 Main Tent" : "Enter delivery location..."}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                  required={!isCounterCop31}
                />
              </div>
            </div>
          </div>

          <div className="p-5 pt-3 shrink-0 space-y-3 bg-white border-t border-slate-100">
            <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-100 space-y-1.5">
              <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                <span>Subtotal ({quantity} × KSh {resolvedUnitPrice.toLocaleString()}):</span>
                <span>KSh {subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-slate-600">
                <span className="flex items-center gap-1"><Truck className="w-4 h-4" /> Delivery Fee:</span>
                <span className={deliveryFee === 0 ? 'text-emerald-700 font-black' : ''}>
                  {deliveryFee === 0 ? (isCounterCop31 ? 'FREE (Counter COP 31)' : 'FREE') : `KSh ${deliveryFee}`}
                </span>
              </div>
              {deliveryFee > 0 && (
                <p className="text-[10px] text-emerald-700/80 font-bold flex items-start gap-1 mt-1">
                  <Info className="w-3 h-3 shrink-0 mt-0.5" />
                  Select "Counter COP 31" above if this order is for the Nov 17–21 event (zero delivery fee).
                </p>
              )}
              <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                <span className="font-black text-slate-800">Total Order Value:</span>
                <span className="text-xl font-black text-emerald-700">KSh {totalCost.toLocaleString()}</span>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-[0.15em] shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              {isCounterCop31 ? 'Confirm Counter COP 31 Order' : 'Confirm Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OrderModal;
