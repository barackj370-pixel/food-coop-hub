import React, { useState, useMemo } from 'react';
import { MarketOrder, ProduceListing, AgentIdentity, OrderStatus, SystemRole } from '../types';
import { ShoppingBag, Sparkles, CheckCircle2, Trash2, Plus, Search, Truck, User, MapPin, Store, X, Package } from 'lucide-react';
import { CROP_CONFIG } from '../constants';

interface OrdersDashboardProps {
  orders: MarketOrder[];
  produceListings: ProduceListing[];
  agentIdentity: AgentIdentity;
  clusters: string[];
  onCreateOrder: (order: MarketOrder) => Promise<void>;
  onFulfillOrder: (order: MarketOrder) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  allowCreation?: boolean;
  title?: string;
}

const isCop31Order = (o: MarketOrder): boolean =>
  o.eventTag === 'COUNTER_COP_31' ||
  Boolean(o.id?.startsWith('cop31-')) ||
  Boolean(o.deliveryAddress?.toLowerCase().includes('counter cop 31'));

export const OrdersDashboard: React.FC<OrdersDashboardProps> = ({
  orders,
  produceListings,
  agentIdentity,
  clusters,
  onCreateOrder,
  onFulfillOrder,
  onDeleteOrder,
  allowCreation = true,
  title = 'Customer & Counter COP 31 Orders'
}) => {
  const [eventFilter, setEventFilter] = useState<'ALL' | 'COP31' | 'STANDARD'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [coopFilter, setCoopFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Quick Order Modal State (for Sales Agents & Youth Agents to place orders directly)
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'LISTED' | 'CUSTOM'>('LISTED');
  const [selectedProduceId, setSelectedProduceId] = useState<string>('');
  const [customCrop, setCustomCrop] = useState<string>('Tomatoes');
  const [customUnitType, setCustomUnitType] = useState<string>('Kg');
  const [customCoop, setCustomCoop] = useState<string>(agentIdentity.cluster || clusters[0] || '');
  const [customUnitPrice, setCustomUnitPrice] = useState<string>('');
  const [customSupplierName, setCustomSupplierName] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [isCounterCop31, setIsCounterCop31] = useState<boolean>(true);
  const [pickupNote, setPickupNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isPrivileged =
    agentIdentity.role === SystemRole.MANAGER ||
    agentIdentity.role === SystemRole.SYSTEM_DEVELOPER ||
    agentIdentity.role === SystemRole.FINANCE_OFFICER ||
    agentIdentity.role === SystemRole.AUDITOR ||
    agentIdentity.role === SystemRole.SALES_MANAGER;

  const canPlaceOrder =
    allowCreation &&
    agentIdentity.role !== SystemRole.SUPPLIER;

  // Enrich orders with unit price and total amount (KSh)
  const enrichedOrders = useMemo(() => {
    return orders.map(o => {
      const matchedProduce =
        (o.produceId ? produceListings.find(p => p.id === o.produceId) : undefined) ||
        produceListings.find(
          p =>
            p.cropType?.toLowerCase() === o.cropType?.toLowerCase() &&
            p.cluster?.toLowerCase() === o.cluster?.toLowerCase()
        );

      const unitPrice = o.unitPrice ?? matchedProduce?.sellingPrice ?? 0;
      const cop31 = isCop31Order(o);
      const deliveryFee = cop31 ? 0 : (o.deliveryFee ?? 0);
      const subtotal = unitPrice * Number(o.unitsRequested || 0);
      const computedTotal = o.totalAmount ?? (subtotal + deliveryFee);

      return {
        ...o,
        isCop31: cop31,
        resolvedUnitPrice: unitPrice,
        resolvedDeliveryFee: deliveryFee,
        resolvedSubtotal: subtotal,
        resolvedTotal: computedTotal
      };
    });
  }, [orders, produceListings]);

  // Visibility: Counter COP 31 orders are national event orders visible across all coops & agents;
  // Standard orders follow cluster scoping unless placed by current user or privileged role.
  const visibleOrders = useMemo(() => {
    const filtered = enrichedOrders.filter(o => {
      if (isPrivileged) return true;
      if (o.isCop31) return true;
      if (o.cluster === agentIdentity.cluster) return true;
      if (o.agentPhone && agentIdentity.phone && o.agentPhone.slice(-9) === agentIdentity.phone.slice(-9)) return true;
      return false;
    });

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [enrichedOrders, isPrivileged, agentIdentity]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return visibleOrders.filter(o => {
      if (eventFilter === 'COP31' && !o.isCop31) return false;
      if (eventFilter === 'STANDARD' && o.isCop31) return false;
      if (statusFilter !== 'ALL' && o.status !== statusFilter) return false;
      if (coopFilter !== 'ALL' && o.cluster !== coopFilter) return false;
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const match =
          (o.cropType || '').toLowerCase().includes(q) ||
          (o.customerName || '').toLowerCase().includes(q) ||
          (o.customerPhone || '').toLowerCase().includes(q) ||
          (o.cluster || '').toLowerCase().includes(q) ||
          (o.id || '').toLowerCase().includes(q) ||
          (o.supplierName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [visibleOrders, eventFilter, statusFilter, coopFilter, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const cop31Orders = visibleOrders.filter(o => o.isCop31);
    const cop31Total = cop31Orders.reduce((sum, o) => sum + o.resolvedTotal, 0);
    const allTotal = visibleOrders.reduce((sum, o) => sum + o.resolvedTotal, 0);
    const openTotal = visibleOrders.filter(o => o.status === OrderStatus.OPEN).reduce((sum, o) => sum + o.resolvedTotal, 0);
    const fulfilledTotal = visibleOrders.filter(o => o.status === OrderStatus.FULFILLED).reduce((sum, o) => sum + o.resolvedTotal, 0);
    const filteredTotal = filteredOrders.reduce((sum, o) => sum + o.resolvedTotal, 0);

    // Coop Breakdown for currently filtered view (great for knowing each Food Coop's order total)
    const byCoop: Record<string, { count: number; total: number; openCount: number }> = {};
    filteredOrders.forEach(o => {
      const c = o.cluster || 'Unspecified';
      if (!byCoop[c]) byCoop[c] = { count: 0, total: 0, openCount: 0 };
      byCoop[c].count += 1;
      byCoop[c].total += o.resolvedTotal;
      if (o.status === OrderStatus.OPEN) byCoop[c].openCount += 1;
    });

    const coopBreakdown = Object.entries(byCoop).sort((a, b) => b[1].total - a[1].total);

    return {
      cop31Count: cop31Orders.length,
      cop31Total,
      allCount: visibleOrders.length,
      allTotal,
      openCount: visibleOrders.filter(o => o.status === OrderStatus.OPEN).length,
      openTotal,
      fulfilledCount: visibleOrders.filter(o => o.status === OrderStatus.FULFILLED).length,
      fulfilledTotal,
      filteredTotal,
      coopBreakdown
    };
  }, [visibleOrders, filteredOrders]);

  const availableCoopsInOrders = useMemo(() => {
    return Array.from(new Set(visibleOrders.map(o => o.cluster).filter(Boolean))).sort();
  }, [visibleOrders]);

  const availableProducts = useMemo(() => {
    return produceListings.filter(p => p.status === 'AVAILABLE' && p.unitsAvailable > 0);
  }, [produceListings]);

  const selectedProduct = useMemo(() => {
    return availableProducts.find(p => p.id === selectedProduceId) || null;
  }, [availableProducts, selectedProduceId]);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      alert('Please enter the customer name.');
      return;
    }
    if (quantity <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    let orderCrop = '';
    let orderUnit = '';
    let orderCluster = '';
    let orderUnitPrice = 0;
    let orderSupplierName = '';
    let orderSupplierPhone = '';
    let orderProduceId: string | undefined = undefined;

    if (entryType === 'LISTED') {
      if (!selectedProduct) {
        alert('Please select a product from the repository (or switch to Custom Event Item).');
        return;
      }
      if (quantity > selectedProduct.unitsAvailable) {
        alert(`Only ${selectedProduct.unitsAvailable} ${selectedProduct.unitType}s available.`);
        return;
      }
      orderCrop = selectedProduct.cropType;
      orderUnit = selectedProduct.unitType;
      orderCluster = selectedProduct.cluster;
      orderUnitPrice = Number(selectedProduct.sellingPrice || 0);
      orderSupplierName = selectedProduct.supplierName;
      orderSupplierPhone = selectedProduct.supplierPhone;
      orderProduceId = selectedProduct.id;
    } else {
      const priceNum = parseFloat(customUnitPrice);
      if (!customCrop.trim() || !customCoop.trim() || isNaN(priceNum) || priceNum <= 0) {
        alert('Please fill in the product, Food Coop, and valid unit price.');
        return;
      }
      orderCrop = customCrop.trim();
      orderUnit = customUnitType;
      orderCluster = customCoop;
      orderUnitPrice = priceNum;
      orderSupplierName = customSupplierName.trim() || `${customCoop} Coop`;
      orderSupplierPhone = '';
    }

    const deliveryFee = isCounterCop31
      ? 0
      : (agentIdentity.cluster === orderCluster ? 0 : 200);

    const totalAmount = orderUnitPrice * quantity + deliveryFee;
    const prefix = isCounterCop31 ? 'cop31-ord' : 'dir-ord';
    const address = isCounterCop31
      ? (pickupNote.trim() ? `Counter COP 31 - ${pickupNote.trim()}` : 'Counter COP 31 National Event Pickup (Nov 17-21)')
      : (pickupNote.trim() || `${orderCluster} Delivery`);

    const newOrder: MarketOrder = {
      id: `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      date: new Date().toISOString(),
      cropType: orderCrop,
      unitsRequested: quantity,
      unitType: orderUnit,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim() || 'Walk-in Customer',
      status: OrderStatus.OPEN,
      agentPhone: agentIdentity.phone,
      cluster: orderCluster,
      synced: false,
      deliveryAddress: address,
      deliveryFee,
      supplierName: orderSupplierName,
      supplierPhone: orderSupplierPhone,
      produceId: orderProduceId,
      isDirectOrder: true,
      customerFoodCoop: isCounterCop31 ? 'Counter COP 31 Customer' : agentIdentity.cluster,
      eventTag: isCounterCop31 ? 'COUNTER_COP_31' : undefined,
      unitPrice: orderUnitPrice,
      totalAmount,
      placedByName: agentIdentity.name,
      placedByRole: agentIdentity.role
    };

    setIsSubmitting(true);
    try {
      await onCreateOrder(newOrder);
      setIsQuickModalOpen(false);
      setCustomerName('');
      setCustomerPhone('');
      setQuantity(1);
      setPickupNote('');
      setCustomUnitPrice('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 border border-slate-200 shadow-xl space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-100 pb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center shrink-0">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
              <span className="bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Counter COP 31 (Nov 17–21)
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
              National Food Coop Orders &bull; Real-Time Order Totals &bull; Free Delivery for Counter COP 31
            </p>
          </div>
        </div>

        {canPlaceOrder && (
          <button
            type="button"
            onClick={() => {
              if (availableProducts.length > 0 && !selectedProduceId) {
                setSelectedProduceId(availableProducts[0].id);
              }
              setIsQuickModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" /> Log Customer / COP 31 Order
          </button>
        )}
      </div>

      {/* KPI Totals Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-800 to-slate-900 text-white p-6 rounded-3xl shadow-md">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Counter COP 31 Total</p>
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black mt-2">KSh {metrics.cop31Total.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-emerald-200/80 mt-1">
            {metrics.cop31Count} event order{metrics.cop31Count === 1 ? '' : 's'} &bull; KSh 0 Delivery Fee
          </p>
        </div>

        <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-md">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">All Orders Grand Total</p>
          <p className="text-2xl sm:text-3xl font-black mt-2">KSh {metrics.allTotal.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-slate-400 mt-1">
            {metrics.allCount} total order{metrics.allCount === 1 ? '' : 's'} recorded
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Open / Pending Fulfillment</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-950 mt-2">KSh {metrics.openTotal.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-amber-700 mt-1">
            {metrics.openCount} order{metrics.openCount === 1 ? '' : 's'} awaiting pickup/delivery
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Fulfilled Orders Value</p>
          <p className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2">KSh {metrics.fulfilledTotal.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-emerald-700 mt-1">
            {metrics.fulfilledCount} completed order{metrics.fulfilledCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {/* Food Coop Breakdown Strip */}
      {metrics.coopBreakdown.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-600" /> Orders Value by Participating Food Coop (Filtered View: KSh {metrics.filteredTotal.toLocaleString()})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {metrics.coopBreakdown.map(([coop, info]) => (
              <button
                key={coop}
                type="button"
                onClick={() => setCoopFilter(coopFilter === coop ? 'ALL' : coop)}
                className={`px-3.5 py-2 rounded-xl text-left border transition-all ${
                  coopFilter === coop
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-800 border-slate-200 hover:border-emerald-400'
                }`}
              >
                <span className="text-[11px] font-black uppercase block">{coop}</span>
                <span className={`text-[10px] font-bold ${coopFilter === coop ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  KSh {info.total.toLocaleString()} ({info.count})
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex flex-wrap gap-2">
          {(['ALL', 'COP31', 'STANDARD'] as const).map(ev => (
            <button
              key={ev}
              type="button"
              onClick={() => setEventFilter(ev)}
              className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                eventFilter === ev ? 'bg-black text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {ev === 'ALL' ? 'All Events' : ev === 'COP31' ? 'Counter COP 31' : 'Standard Orders'}
            </button>
          ))}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value={OrderStatus.OPEN}>Open / Pending</option>
            <option value={OrderStatus.FULFILLED}>Fulfilled</option>
          </select>
          <select
            value={coopFilter}
            onChange={e => setCoopFilter(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 outline-none"
          >
            <option value="ALL">All Food Coops</option>
            {availableCoopsInOrders.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search customer, crop, coop..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Orders List / Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-10 text-center border border-slate-100">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-black text-slate-600 uppercase tracking-wider">No matching orders found</p>
          <p className="text-xs text-slate-400 mt-1">
            Sales Agents and Youth Agents can log Counter COP 31 or customer orders from here or from the Marketplace.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map(order => {
            const canDelete =
              isPrivileged ||
              (order.agentPhone && agentIdentity.phone && order.agentPhone.slice(-9) === agentIdentity.phone.slice(-9));

            return (
              <div
                key={order.id}
                className={`rounded-2xl p-5 border flex flex-col justify-between transition-all ${
                  order.isCop31
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-black text-slate-900">{order.cropType}</h3>
                        {order.isCop31 && (
                          <span className="px-2.5 py-0.5 bg-emerald-600 text-white rounded-full text-[9px] font-black uppercase tracking-wider">
                            Counter COP 31 &bull; Free Delivery
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mt-1">
                        Qty: {order.unitsRequested} {order.unitType}(s) &bull; Food Coop: <span className="text-slate-800">{order.cluster}</span>
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest shrink-0 ${
                        order.status === OrderStatus.FULFILLED
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {order.status === OrderStatus.FULFILLED ? 'Fulfilled' : 'Pending'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-slate-600 mb-4 bg-white/80 p-3.5 rounded-xl border border-slate-100">
                    <p className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{order.customerName} ({order.customerPhone})</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <Store className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">Supplier: {order.supplierName || order.cluster}</span>
                    </p>
                    <p className="flex items-center gap-1.5 truncate">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{order.deliveryAddress || 'Event Pickup'}</span>
                    </p>
                    <p className="flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>
                        Delivery: {order.resolvedDeliveryFee === 0 ? 'FREE (KSh 0)' : `KSh ${order.resolvedDeliveryFee}`}
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1 mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      {new Date(order.date).toLocaleDateString()}
                      {order.placedByName ? ` • Placed by ${order.placedByName}` : (order.agentPhone ? ` • Agent ${order.agentPhone}` : '')}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-slate-400 uppercase block">Order Total</span>
                      <span className="text-lg font-black text-emerald-700">
                        {order.resolvedTotal > 0 ? `KSh ${order.resolvedTotal.toLocaleString()}` : 'Price Pending'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {order.status === OrderStatus.OPEN && (
                    <button
                      type="button"
                      onClick={() => onFulfillOrder(order)}
                      className="flex-1 bg-black hover:bg-slate-800 text-white py-2.5 px-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Mark Fulfilled
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => onDeleteOrder(order.id)}
                      className="bg-red-50 hover:bg-red-100 text-red-600 py-2.5 px-3.5 rounded-xl font-black uppercase text-[10px] tracking-widest transition-colors flex items-center justify-center gap-1"
                      title="Delete Order"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Order Modal for Sales & Youth Agents */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-lg font-black tracking-tight">Log Customer Order</h3>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                  By {agentIdentity.name} ({agentIdentity.role})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickModalOpen(false)}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Counter COP 31 Toggle */}
              <div className="flex items-center justify-between p-4 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70">
                <div>
                  <p className="text-xs font-black uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-emerald-600" /> Counter COP 31 Order (Nov 17–21)
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">
                    {isCounterCop31
                      ? 'Customers are NOT charged delivery fees (KSh 0).'
                      : 'Standard cross-coop delivery fee (KSh 200) may apply.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCounterCop31(!isCounterCop31)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                    isCounterCop31 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCounterCop31 ? 'COP 31: ON' : 'COP 31: OFF'}
                </button>
              </div>

              {/* Product Source Switch */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setEntryType('LISTED')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    entryType === 'LISTED' ? 'bg-white text-black shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Select Listed Product ({availableProducts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('CUSTOM')}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                    entryType === 'CUSTOM' ? 'bg-white text-black shadow-sm' : 'text-slate-500'
                  }`}
                >
                  Custom Event Item
                </button>
              </div>

              {entryType === 'LISTED' ? (
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    Select Product (Any Food Coop)
                  </label>
                  <select
                    value={selectedProduceId}
                    onChange={e => setSelectedProduceId(e.target.value)}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
                    required
                  >
                    <option value="">-- Choose Produce --</option>
                    {availableProducts.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.cropType} ({p.cluster} • {p.supplierName}) — KSh {p.sellingPrice}/{p.unitType} [{p.unitsAvailable} avail]
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Supplying Food Coop *</label>
                    <select
                      value={customCoop}
                      onChange={e => setCustomCoop(e.target.value)}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800"
                      required
                    >
                      {clusters.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Product Name *</label>
                    <input
                      type="text"
                      list="cop31-crop-suggestions"
                      value={customCrop}
                      onChange={e => setCustomCrop(e.target.value)}
                      placeholder="e.g. Cassava, Honey, Beans"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800"
                      required
                    />
                    <datalist id="cop31-crop-suggestions">
                      {Object.keys(CROP_CONFIG).map(c => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Unit Type</label>
                    <input
                      type="text"
                      value={customUnitType}
                      onChange={e => setCustomUnitType(e.target.value)}
                      placeholder="Kg, Bunch, Tin, Bag..."
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800"
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
                      placeholder="e.g. 150"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Supplier / Stall Name (Optional)</label>
                    <input
                      type="text"
                      value={customSupplierName}
                      onChange={e => setCustomSupplierName(e.target.value)}
                      placeholder="e.g. Mariwa Farmers Stall"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Customer Info & Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    placeholder="Full name"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer Phone</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="07XXXXXXXX"
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Package className="w-3 h-3" /> Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={entryType === 'LISTED' && selectedProduct ? selectedProduct.unitsAvailable : undefined}
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                    {isCounterCop31 ? 'Event Notes (Optional)' : 'Delivery Address'}
                  </label>
                  <input
                    type="text"
                    value={pickupNote}
                    onChange={e => setPickupNote(e.target.value)}
                    placeholder={isCounterCop31 ? 'Booth / Pickup note' : 'Location'}
                    className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                  />
                </div>
              </div>

              {/* Total Preview */}
              {(() => {
                const unitPrice = entryType === 'LISTED'
                  ? Number(selectedProduct?.sellingPrice || 0)
                  : (parseFloat(customUnitPrice) || 0);
                const clusterName = entryType === 'LISTED' ? (selectedProduct?.cluster || '') : customCoop;
                const fee = isCounterCop31 ? 0 : (agentIdentity.cluster === clusterName ? 0 : 200);
                const total = unitPrice * quantity + fee;
                return (
                  <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 flex justify-between items-center">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                        Delivery: {fee === 0 ? 'FREE (KSh 0)' : `KSh ${fee}`}
                      </p>
                      <p className="text-xs font-bold text-slate-600 mt-0.5">
                        {quantity} × KSh {unitPrice.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-slate-400 block">Order Total</span>
                      <span className="text-xl font-black text-emerald-800">KSh {total.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })()}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Saving Order...' : (isCounterCop31 ? 'Record Counter COP 31 Order' : 'Record Customer Order')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersDashboard;
