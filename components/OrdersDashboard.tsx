import React, { useState, useMemo } from 'react';
import { MarketOrder, ProduceListing, AgentIdentity, OrderStatus, SystemRole } from '../types';
import {
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  Trash2,
  Plus,
  Search,
  Truck,
  User,
  MapPin,
  Store,
  X,
  Package,
  Award,
  Calculator
} from 'lucide-react';
import { CROP_CONFIG, COMMODITY_CATEGORIES, FOOD_COOPS } from '../constants';

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

const isCop31EventWindowOrder = (o: MarketOrder): boolean => {
  if (!o || !o.date) return false;
  const d = new Date(o.date);
  if (isNaN(d.getTime())) return false;
  let nairobiDate = '';
  try {
    nairobiDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(d);
  } catch {
    nairobiDate = d.toISOString().slice(0, 10);
  }
  if (nairobiDate > '2026-11-21') return true;
  return isCop31Order(o) && nairobiDate >= '2026-11-17' && nairobiDate <= '2026-11-21';
};

const QUALITY_OPTIONS = [
  'Grade A (Prime Organic)',
  'Grade B (Standard Fair)',
  'Grade C (Economy)',
  'Fresh Harvest',
  'Dried / Cured',
  'Processed / Packaged',
  'Custom Quality...'
];

const ALL_COMMODITY_SUGGESTIONS = Array.from(
  new Set([
    ...Object.values(COMMODITY_CATEGORIES).flat().filter(c => c !== 'Other'),
    ...Object.keys(CROP_CONFIG).filter(c => c !== 'Other')
  ])
).sort((a, b) => a.localeCompare(b));

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

  // Complete list of ALL Food Coops sorted alphabetically (never missing any coop)
  const allFoodCoops = useMemo(() => {
    return Array.from(
      new Set([
        ...FOOD_COOPS,
        ...clusters,
        ...orders.map(o => o.cluster).filter((c): c is string => Boolean(c))
      ])
    )
      .filter(c => c && c !== '-' && c !== 'Unassigned')
      .sort((a, b) => a.localeCompare(b));
  }, [clusters, orders]);

  const defaultUserCoop =
    agentIdentity.cluster && agentIdentity.cluster !== '-' && agentIdentity.cluster !== 'Unassigned'
      ? agentIdentity.cluster
      : (allFoodCoops[0] || 'Mariwa');

  // Make / Record Order Modal State
  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [entryType, setEntryType] = useState<'CUSTOM' | 'LISTED'>('CUSTOM');
  const [selectedProduceId, setSelectedProduceId] = useState<string>('');
  const [selectedFoodCoop, setSelectedFoodCoop] = useState<string>(defaultUserCoop);
  const [customNewFoodCoop, setCustomNewFoodCoop] = useState<string>('');
  const [customCrop, setCustomCrop] = useState<string>('Maize');
  const [customUnitType, setCustomUnitType] = useState<string>('Kg');
  const [qualityOption, setQualityOption] = useState<string>('Grade A (Prime Organic)');
  const [customQualityText, setCustomQualityText] = useState<string>('');
  const [pricingMode, setPricingMode] = useState<'AGGREGATE' | 'UNIT'>('AGGREGATE');
  const [unitBuyingPrice, setUnitBuyingPrice] = useState<string>('');
  const [unitSellingPrice, setUnitSellingPrice] = useState<string>('');
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

  const isAgentRole =
    agentIdentity.role === SystemRole.SALES_AGENT ||
    agentIdentity.role === SystemRole.YOUTH_AGENT;

  const canPlaceOrder = allowCreation;

  // Enrich orders with unit price, buying price, profit, amount to submit (10% + 1), and total amount (KSh)
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
      const buyingPrice = o.buyingPrice ?? matchedProduce?.wholesalePrice;
      const cop31 = isCop31Order(o);
      const deliveryFee = cop31 ? 0 : (o.deliveryFee ?? 0);
      const qty = Number(o.unitsRequested || 0);
      const subtotal = Math.round(unitPrice * qty * 100) / 100;
      const computedTotal = o.totalAmount ?? (subtotal + deliveryFee);

      const totalBuying = buyingPrice !== undefined ? Math.round(buyingPrice * qty * 100) / 100 : undefined;
      const resolvedProfit =
        o.profit !== undefined
          ? o.profit
          : (totalBuying !== undefined ? Math.max(0, subtotal - totalBuying) : undefined);

      const resolvedAmountToSubmit =
        o.amountToSubmit !== undefined
          ? o.amountToSubmit
          : (resolvedProfit !== undefined
              ? (resolvedProfit > 0 ? Math.round((resolvedProfit * 0.10 + 1) * 100) / 100 : 0)
              : undefined);

      return {
        ...o,
        isCop31: cop31,
        resolvedUnitPrice: unitPrice,
        resolvedBuyingPrice: buyingPrice,
        resolvedTotalBuying: totalBuying,
        resolvedProfit,
        resolvedAmountToSubmit,
        resolvedDeliveryFee: deliveryFee,
        resolvedSubtotal: subtotal,
        resolvedTotal: computedTotal
      };
    });
  }, [orders, produceListings]);

  // Visibility (restricted to valid COP 31 Nov 17-21 event orders)
  const visibleOrders = useMemo(() => {
    const myPhone9 = (agentIdentity.phone || '').replace(/\D/g, '').slice(-9);
    const matchesPhone = (p?: string) => Boolean(myPhone9 && p && p.replace(/\D/g, '').slice(-9) === myPhone9);

    const filtered = enrichedOrders.filter(o => {
      if (!isCop31EventWindowOrder(o)) return false;
      if (isPrivileged) return true;
      if (matchesPhone(o.agentPhone) || matchesPhone(o.customerPhone) || matchesPhone(o.supplierPhone)) return true;
      if (isAgentRole && (o.isCop31 || o.cluster === agentIdentity.cluster)) return true;
      return false;
    });

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [enrichedOrders, isPrivileged, isAgentRole, agentIdentity]);

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
          (o.quality || '').toLowerCase().includes(q) ||
          (o.id || '').toLowerCase().includes(q) ||
          (o.supplierName || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [visibleOrders, eventFilter, statusFilter, coopFilter, searchTerm]);

  // Order count per coop for filter dropdown labels
  const orderCountByCoop = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleOrders.forEach(o => {
      if (o.cluster) counts[o.cluster] = (counts[o.cluster] || 0) + 1;
    });
    return counts;
  }, [visibleOrders]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const cop31Orders = visibleOrders.filter(o => o.isCop31);
    const cop31Total = cop31Orders.reduce((sum, o) => sum + o.resolvedTotal, 0);
    const allTotal = visibleOrders.reduce((sum, o) => sum + o.resolvedTotal, 0);
    const openTotal = visibleOrders.filter(o => o.status === OrderStatus.OPEN).reduce((sum, o) => sum + o.resolvedTotal, 0);
    const fulfilledTotal = visibleOrders.filter(o => o.status === OrderStatus.FULFILLED).reduce((sum, o) => sum + o.resolvedTotal, 0);
    const filteredTotal = filteredOrders.reduce((sum, o) => sum + o.resolvedTotal, 0);

    const totalProfit = filteredOrders.reduce((sum, o) => sum + (o.resolvedProfit || 0), 0);
    const totalToSubmit = filteredOrders.reduce((sum, o) => sum + (o.resolvedAmountToSubmit || 0), 0);

    const byCoop: Record<string, { count: number; total: number; profit: number; submit: number; openCount: number }> = {};
    filteredOrders.forEach(o => {
      const c = o.cluster || 'Unspecified';
      if (!byCoop[c]) byCoop[c] = { count: 0, total: 0, profit: 0, submit: 0, openCount: 0 };
      byCoop[c].count += 1;
      byCoop[c].total += o.resolvedTotal;
      byCoop[c].profit += o.resolvedProfit || 0;
      byCoop[c].submit += o.resolvedAmountToSubmit || 0;
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
      totalProfit,
      totalToSubmit,
      coopBreakdown
    };
  }, [visibleOrders, filteredOrders]);

  const availableProducts = useMemo(() => {
    return produceListings.filter(p => p.status === 'AVAILABLE' && p.unitsAvailable > 0);
  }, [produceListings]);

  const selectedProduct = useMemo(() => {
    return availableProducts.find(p => p.id === selectedProduceId) || null;
  }, [availableProducts, selectedProduceId]);

  const handleSelectListedProduct = (produceId: string) => {
    setSelectedProduceId(produceId);
    const prod = availableProducts.find(p => p.id === produceId);
    if (prod) {
      const multiplier = pricingMode === 'AGGREGATE' ? Math.max(1, quantity) : 1;
      setUnitSellingPrice(prod.sellingPrice ? String(prod.sellingPrice * multiplier) : '');
      setUnitBuyingPrice(prod.wholesalePrice ? String(prod.wholesalePrice * multiplier) : '');
    }
  };

  const openMakeOrderModal = (mode: 'CUSTOM' | 'LISTED' = 'CUSTOM') => {
    setEntryType(mode);
    if (mode === 'LISTED' && availableProducts.length > 0 && !selectedProduceId) {
      handleSelectListedProduct(availableProducts[0].id);
    }
    setIsQuickModalOpen(true);
  };

  // Live pricing calculations in modal (supports both Aggregate Batch Totals and Per-Unit Prices)
  const resolvedCoopName =
    selectedFoodCoop === '__OTHER__' ? customNewFoodCoop.trim() : selectedFoodCoop;
  const parsedSelling = parseFloat(unitSellingPrice);
  const parsedBuying = parseFloat(unitBuyingPrice);
  const hasValidSelling = !isNaN(parsedSelling) && parsedSelling > 0;
  const hasValidBuying = unitBuyingPrice.trim() !== '' && !isNaN(parsedBuying) && parsedBuying >= 0;

  const totalSellingValue = hasValidSelling
    ? Math.round((pricingMode === 'AGGREGATE' ? parsedSelling : parsedSelling * quantity) * 100) / 100
    : 0;
  const totalBuyingCost = hasValidBuying
    ? Math.round((pricingMode === 'AGGREGATE' ? parsedBuying : parsedBuying * quantity) * 100) / 100
    : 0;

  const effectiveSellingUnit = quantity > 0 ? Number((totalSellingValue / quantity).toFixed(6)) : totalSellingValue;
  const effectiveBuyingUnit = quantity > 0 ? Number((totalBuyingCost / quantity).toFixed(6)) : totalBuyingCost;

  const rawProfit = totalSellingValue - totalBuyingCost;
  const computedProfit = hasValidBuying && hasValidSelling ? Math.max(0, Math.round(rawProfit * 100) / 100) : 0;
  const computedAmountToSubmit =
    hasValidBuying && hasValidSelling && computedProfit > 0
      ? Math.round((computedProfit * 0.10 + 1) * 100) / 100
      : 0;
  const deliveryFeePreview = isCounterCop31 ? 0 : (agentIdentity.cluster === resolvedCoopName ? 0 : 200);
  const totalOrderWithDelivery = totalSellingValue + deliveryFeePreview;

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedCoopName) {
      alert('Please select a Food Coop.');
      return;
    }
    if (pricingMode === 'UNIT' && !customerName.trim()) {
      alert('Please enter the customer name.');
      return;
    }
    if (quantity <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }
    if (!hasValidSelling) {
      alert(pricingMode === 'AGGREGATE' ? 'Please enter a valid Aggregate Selling Price (KSh).' : 'Please enter a valid Selling Price (KSh).');
      return;
    }
    if (!hasValidBuying) {
      alert(pricingMode === 'AGGREGATE' ? 'Please enter a valid Aggregate Buying Price (KSh) to calculate profit and 10% + 1 submission.' : 'Please enter a valid Buying Price (KSh) to calculate profit and 10% + 1 submission.');
      return;
    }
    if (totalSellingValue < totalBuyingCost) {
      alert('Selling Price cannot be lower than Buying Price.');
      return;
    }

    const resolvedQuality =
      qualityOption === 'Custom Quality...'
        ? (customQualityText.trim() || 'Standard')
        : qualityOption;

    let orderCrop = '';
    let orderUnit = '';
    let orderSupplierName = '';
    let orderSupplierPhone = '';
    let orderProduceId: string | undefined = undefined;

    if (entryType === 'LISTED') {
      if (!selectedProduct) {
        alert('Please select a product from listed stock or switch to Commodity Entry.');
        return;
      }
      if (quantity > selectedProduct.unitsAvailable) {
        alert(`Only ${selectedProduct.unitsAvailable} ${selectedProduct.unitType}s available.`);
        return;
      }
      orderCrop = selectedProduct.cropType;
      orderUnit = selectedProduct.unitType;
      orderSupplierName =
        selectedProduct.cluster !== resolvedCoopName
          ? `${selectedProduct.supplierName} (${selectedProduct.cluster})`
          : selectedProduct.supplierName;
      orderSupplierPhone = selectedProduct.supplierPhone;
      orderProduceId = selectedProduct.id;
    } else {
      if (!customCrop.trim()) {
        alert('Please enter the commodity name.');
        return;
      }
      orderCrop = customCrop.trim();
      orderUnit = customUnitType.trim() || 'Kg';
      orderSupplierName = customSupplierName.trim() || `${resolvedCoopName} Food Coop`;
      orderSupplierPhone = '';
    }

    const deliveryFee = isCounterCop31
      ? 0
      : (agentIdentity.cluster === resolvedCoopName ? 0 : 200);

    const crossCoopSuffix =
      entryType === 'LISTED' && selectedProduct && selectedProduct.cluster !== resolvedCoopName
        ? ` (Stock from ${selectedProduct.cluster})`
        : '';

    const totalAmount = totalSellingValue + deliveryFee;
    const prefix = isCounterCop31 ? 'cop31-ord' : 'dir-ord';
    const address = isCounterCop31
      ? (pickupNote.trim()
          ? `Counter COP 31 - ${pickupNote.trim()}${crossCoopSuffix}`
          : `Counter COP 31 National Event Pickup (Nov 17-21)${crossCoopSuffix}`)
      : `${pickupNote.trim() || `${resolvedCoopName} Delivery`}${crossCoopSuffix}`;

    const finalCustomerName =
      pricingMode === 'AGGREGATE'
        ? `${resolvedCoopName} Aggregate Batch`
        : customerName.trim();
    const finalCustomerPhone =
      pricingMode === 'AGGREGATE'
        ? 'Aggregate'
        : (customerPhone.trim() || 'Walk-in Customer');

    const newOrder: MarketOrder = {
      id: `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      date: new Date().toISOString(),
      cropType: orderCrop,
      unitsRequested: quantity,
      unitType: orderUnit,
      customerName: finalCustomerName,
      customerPhone: finalCustomerPhone,
      status: OrderStatus.OPEN,
      agentPhone: agentIdentity.phone,
      cluster: resolvedCoopName,
      synced: false,
      deliveryAddress: address,
      deliveryFee,
      supplierName: orderSupplierName,
      supplierPhone: orderSupplierPhone,
      produceId: orderProduceId,
      isDirectOrder: true,
      customerFoodCoop: isCounterCop31 ? 'Counter COP 31 Customer' : resolvedCoopName,
      eventTag: isCounterCop31 ? 'COUNTER_COP_31' : undefined,
      unitPrice: effectiveSellingUnit,
      buyingPrice: effectiveBuyingUnit,
      quality: resolvedQuality,
      profit: computedProfit,
      amountToSubmit: computedAmountToSubmit,
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
      setUnitBuyingPrice('');
      setUnitSellingPrice('');
      setCustomNewFoodCoop('');
      setCustomQualityText('');
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
              All {allFoodCoops.length} Food Coops &bull; Profit &amp; 10% + 1 Submission Calculator &bull; Free Delivery for COP 31
            </p>
          </div>
        </div>

        {canPlaceOrder && (
          <div className="flex flex-wrap gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => openMakeOrderModal('CUSTOM')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3.5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" /> Make / Record Order
            </button>
          </div>
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
            {metrics.allCount} order{metrics.allCount === 1 ? '' : 's'} ({metrics.openCount} pending, {metrics.fulfilledCount} fulfilled)
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-3xl">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Amount to Submit (10% + 1)</p>
            <Calculator className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-950 mt-2">KSh {metrics.totalToSubmit.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-emerald-700 mt-1">
            Gross Profit: KSh {metrics.totalProfit.toLocaleString()} (Filtered)
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700">Open / Pending Fulfillment</p>
          <p className="text-2xl sm:text-3xl font-black text-amber-950 mt-2">KSh {metrics.openTotal.toLocaleString()}</p>
          <p className="text-[11px] font-bold text-amber-700 mt-1">
            Fulfilled Value: KSh {metrics.fulfilledTotal.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Food Coop Breakdown Strip */}
      {metrics.coopBreakdown.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-emerald-600" /> Orders Value by Participating Food Coop (Filtered: KSh {metrics.filteredTotal.toLocaleString()})
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
                <span className={`text-[10px] font-bold block ${coopFilter === coop ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  KSh {info.total.toLocaleString()} ({info.count})
                  {info.submit > 0 ? ` • Submit: KSh ${info.submit.toLocaleString()}` : ''}
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
            className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-slate-700 outline-none max-w-[240px]"
          >
            <option value="ALL">All Food Coops ({allFoodCoops.length})</option>
            {allFoodCoops.map(c => {
              const cnt = orderCountByCoop[c] || 0;
              return (
                <option key={c} value={c}>
                  {c}{cnt > 0 ? ` (${cnt})` : ''}
                </option>
              );
            })}
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

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-slate-50 rounded-3xl p-10 text-center border border-slate-100 space-y-4">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
          <div>
            <p className="text-sm font-black text-slate-600 uppercase tracking-wider">No matching orders found</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &ldquo;Make / Record Order&rdquo; to select any Food Coop, record commodity, quality, buying &amp; selling prices, and auto-calculate Profit and 10% + 1 submission.
            </p>
          </div>
          {canPlaceOrder && (
            <button
              type="button"
              onClick={() => openMakeOrderModal('CUSTOM')}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-md"
            >
              <Plus className="w-4 h-4" /> Make / Record Order
            </button>
          )}
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
                        {order.quality && (
                          <span className="px-2.5 py-0.5 bg-slate-800 text-white rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                            <Award className="w-2.5 h-2.5 text-amber-400" /> {order.quality}
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold text-slate-600 mb-3 bg-white/80 p-3.5 rounded-xl border border-slate-100">
                    <p className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">
                        {order.customerPhone === 'Aggregate'
                          ? `${order.customerName} (Aggregate Totals)`
                          : `${order.customerName} (${order.customerPhone})`}
                      </span>
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

                  {/* Profit & 10% + 1 Submission Breakdown when Buying Price / Profit recorded */}
                  {(order.resolvedBuyingPrice !== undefined || order.resolvedProfit !== undefined) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-emerald-50/90 border border-emerald-200/80 rounded-xl p-2.5 mb-3 text-center">
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">Buying</span>
                        <span className="text-xs font-black text-slate-800">
                          KSh {(order.resolvedTotalBuying ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-slate-500 block">Selling</span>
                        <span className="text-xs font-black text-slate-800">
                          KSh {order.resolvedSubtotal.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-700 block">Profit</span>
                        <span className="text-xs font-black text-emerald-800">
                          KSh {(order.resolvedProfit ?? 0).toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] font-black uppercase text-emerald-800 block">Submit (10%+1)</span>
                        <span className="text-xs font-black text-emerald-950">
                          KSh {(order.resolvedAmountToSubmit ?? 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs px-1 mb-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                      {new Date(order.date).toLocaleDateString()}
                      {order.placedByName ? ` • By ${order.placedByName}` : (order.agentPhone ? ` • Agent ${order.agentPhone}` : '')}
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

      {/* Make / Record Order Modal */}
      {isQuickModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-slate-900 p-5 flex justify-between items-center text-white shrink-0">
              <div>
                <h3 className="text-lg font-black tracking-tight">Make / Record Customer Order</h3>
                <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                  Recorded by {agentIdentity.name} ({agentIdentity.role}) &bull; Auto 10% + 1 Calculation
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
              <div className="flex items-center justify-between p-3.5 rounded-2xl border-2 border-emerald-500 bg-emerald-50/70">
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
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shrink-0 ${
                    isCounterCop31 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {isCounterCop31 ? 'COP 31: ON' : 'COP 31: OFF'}
                </button>
              </div>

              {/* 1. Food Coop Selector (All 53+ Sorted A-Z + Custom) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                  <Store className="w-3.5 h-3.5 text-emerald-600" /> 1. Select Food Coop ({allFoodCoops.length} Available) *
                </label>
                <select
                  value={selectedFoodCoop}
                  onChange={e => setSelectedFoodCoop(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 outline-none focus:border-emerald-500"
                  required
                >
                  <option value="">-- Select Food Coop --</option>
                  {allFoodCoops.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                  <option value="__OTHER__">+ Other / Add Food Coop...</option>
                </select>
                {selectedFoodCoop === '__OTHER__' && (
                  <input
                    type="text"
                    value={customNewFoodCoop}
                    onChange={e => setCustomNewFoodCoop(e.target.value)}
                    placeholder="Enter Food Coop name..."
                    className="w-full bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 outline-none focus:border-emerald-600"
                    required
                  />
                )}
              </div>

              {/* 2. Pricing Entry Mode + Customer Details (Customer Name/Phone hidden in Aggregate mode) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-600" /> 2. Order Type &amp; Customer
                  </span>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setPricingMode('AGGREGATE')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        pricingMode === 'AGGREGATE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Aggregate Totals
                    </button>
                    <button
                      type="button"
                      onClick={() => setPricingMode('UNIT')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        pricingMode === 'UNIT' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Individual Customer
                    </button>
                  </div>
                </div>

                {pricingMode === 'AGGREGATE' ? (
                  <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    Aggregate batch entry selected — no individual customer name or phone number needed.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (customerName === agentIdentity.name) {
                            setCustomerName('');
                            setCustomerPhone('');
                          }
                        }}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                          customerName !== agentIdentity.name ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        For a Customer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerName(agentIdentity.name);
                          setCustomerPhone(agentIdentity.phone);
                        }}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                          customerName === agentIdentity.name ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        For Myself
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer Name *</label>
                        <input
                          type="text"
                          required={pricingMode === 'UNIT'}
                          value={customerName}
                          onChange={e => setCustomerName(e.target.value)}
                          placeholder="Full name"
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Customer Phone</label>
                        <input
                          type="tel"
                          value={customerPhone}
                          onChange={e => setCustomerPhone(e.target.value)}
                          placeholder="07XXXXXXXX"
                          className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* 3. Commodity, Quality, Quantity & Prices */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5 text-emerald-600" /> 3. Commodity, Quality &amp; Pricing
                  </span>
                  <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEntryType('CUSTOM')}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        entryType === 'CUSTOM' ? 'bg-slate-900 text-white' : 'text-slate-500'
                      }`}
                    >
                      Record Any Commodity
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEntryType('LISTED');
                        if (availableProducts.length > 0 && !selectedProduceId) {
                          handleSelectListedProduct(availableProducts[0].id);
                        }
                      }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        entryType === 'LISTED' ? 'bg-slate-900 text-white' : 'text-slate-500'
                      }`}
                    >
                      From Stock ({availableProducts.length})
                    </button>
                  </div>
                </div>

                {entryType === 'LISTED' ? (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      Choose Listed Stock Item *
                    </label>
                    <select
                      value={selectedProduceId}
                      onChange={e => handleSelectListedProduct(e.target.value)}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Commodity *</label>
                      <input
                        type="text"
                        list="sales-commodity-suggestions"
                        value={customCrop}
                        onChange={e => setCustomCrop(e.target.value)}
                        placeholder="e.g. Sugar, Maize, Beans, Tomatoes"
                        className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                        required
                      />
                      <datalist id="sales-commodity-suggestions">
                        {ALL_COMMODITY_SUGGESTIONS.map(c => (
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
                        placeholder="Kg, 2kg Tin, Bag, Crate, Bunch..."
                        className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-1">
                      <Award className="w-3 h-3 text-amber-600" /> Quality *
                    </label>
                    <select
                      value={qualityOption}
                      onChange={e => setQualityOption(e.target.value)}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-800"
                    >
                      {QUALITY_OPTIONS.map(q => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                    {qualityOption === 'Custom Quality...' && (
                      <input
                        type="text"
                        value={customQualityText}
                        onChange={e => setCustomQualityText(e.target.value)}
                        placeholder="Specify quality..."
                        className="w-full mt-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
                        required
                      />
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity *</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      max={entryType === 'LISTED' && selectedProduct ? selectedProduct.unitsAvailable : undefined}
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, Number(e.target.value)))}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                      {isCounterCop31 ? 'Pickup / Stall Note' : 'Delivery Address'}
                    </label>
                    <input
                      type="text"
                      value={pickupNote}
                      onChange={e => setPickupNote(e.target.value)}
                      placeholder={isCounterCop31 ? 'Optional booth note' : 'Location'}
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-800"
                    />
                  </div>
                </div>

                {/* Aggregate vs Per-Unit Price Mode Switch + Buying & Selling Prices */}
                <div className="pt-2 border-t border-slate-200/80 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                      Pricing Entry Mode
                    </span>
                    <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setPricingMode('AGGREGATE')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                          pricingMode === 'AGGREGATE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Aggregate Prices (Total)
                      </button>
                      <button
                        type="button"
                        onClick={() => setPricingMode('UNIT')}
                        className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                          pricingMode === 'UNIT' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        Per-Unit Prices
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest ml-1">
                        {pricingMode === 'AGGREGATE'
                          ? 'Aggregate Buying Price (Total KSh) *'
                          : `Buying Price (KSh / ${entryType === 'LISTED' && selectedProduct ? selectedProduct.unitType : (customUnitType || 'unit')}) *`}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={unitBuyingPrice}
                        onChange={e => setUnitBuyingPrice(e.target.value)}
                        placeholder={pricingMode === 'AGGREGATE' ? 'e.g. 4500' : 'e.g. 100'}
                        className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 focus:border-emerald-500 outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest ml-1">
                        {pricingMode === 'AGGREGATE'
                          ? 'Aggregate Selling Price (Total KSh) *'
                          : `Selling Price (KSh / ${entryType === 'LISTED' && selectedProduct ? selectedProduct.unitType : (customUnitType || 'unit')}) *`}
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        value={unitSellingPrice}
                        onChange={e => setUnitSellingPrice(e.target.value)}
                        placeholder={pricingMode === 'AGGREGATE' ? 'e.g. 6200' : 'e.g. 150'}
                        className="w-full mt-1 bg-white border border-emerald-300 rounded-xl px-3.5 py-2.5 text-sm font-black text-emerald-800 focus:border-emerald-600 outline-none"
                        required
                      />
                    </div>
                  </div>
                  {pricingMode === 'AGGREGATE' && quantity > 1 && hasValidSelling && (
                    <p className="text-[10px] font-bold text-slate-500 ml-1">
                      Average per {entryType === 'LISTED' && selectedProduct ? selectedProduct.unitType : (customUnitType || 'unit')}: Buying KSh {(totalBuyingCost / quantity).toFixed(2)} &bull; Selling KSh {(totalSellingValue / quantity).toFixed(2)}
                    </p>
                  )}
                </div>

                {entryType === 'CUSTOM' && (
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Supplier / Farmer Name (Optional)</label>
                    <input
                      type="text"
                      value={customSupplierName}
                      onChange={e => setCustomSupplierName(e.target.value)}
                      placeholder="e.g. Mama Mboga / Local Coop Stall"
                      className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-bold text-slate-800"
                    />
                  </div>
                )}
              </div>

              {/* Live Calculation: Profit & Amount to Submit (10% + 1) */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 flex items-center gap-1.5">
                    <Calculator className="w-3.5 h-3.5" /> Profit &amp; Submission Calculation (10% + 1)
                  </span>
                  <span className="text-[10px] font-bold text-slate-300">
                    Delivery: {deliveryFeePreview === 0 ? 'FREE (KSh 0)' : `KSh ${deliveryFeePreview}`}
                  </span>
                </div>

                {hasValidBuying && hasValidSelling && effectiveSellingUnit < effectiveBuyingUnit && (
                  <div className="bg-red-500/20 border border-red-400 rounded-xl px-3 py-2 text-xs font-bold text-red-200">
                    Selling price is lower than buying price. Increase selling price to compute profit.
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Total Buying</span>
                    <span className="text-sm font-black text-slate-200">KSh {totalBuyingCost.toLocaleString()}</span>
                  </div>
                  <div className="bg-white/5 rounded-xl p-2.5">
                    <span className="text-[9px] font-black uppercase text-slate-400 block">Total Selling</span>
                    <span className="text-sm font-black text-white">KSh {totalOrderWithDelivery.toLocaleString()}</span>
                  </div>
                  <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-2.5">
                    <span className="text-[9px] font-black uppercase text-emerald-300 block">Profit</span>
                    <span className="text-sm font-black text-emerald-300">KSh {computedProfit.toLocaleString()}</span>
                  </div>
                  <div className="bg-emerald-600 rounded-xl p-2.5 shadow-md">
                    <span className="text-[9px] font-black uppercase text-emerald-100 block">Submit (10% + 1)</span>
                    <span className="text-base font-black text-white">KSh {computedAmountToSubmit.toLocaleString()}</span>
                  </div>
                </div>

                {hasValidBuying && hasValidSelling && computedProfit > 0 && (
                  <p className="text-[10px] font-semibold text-slate-300 text-center">
                    Formula: (Profit KSh {computedProfit.toLocaleString()} &times; 10%) + 1 ={' '}
                    <strong className="text-emerald-300">KSh {computedAmountToSubmit.toLocaleString()}</strong> to be submitted
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Saving Order...' : (isCounterCop31 ? 'Save Counter COP 31 Order' : 'Save Customer Order')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersDashboard;
