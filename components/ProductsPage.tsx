import React, { useState, useMemo } from 'react';
import { ProduceListing } from '../types';
import { Search, ShoppingCart, Plus, Globe, Store } from 'lucide-react';
import { normalizeProductName, FOOD_COOPS, COMMODITY_CATEGORIES } from '../constants';

interface Props {
  produceListings: ProduceListing[];
  foodCoops?: string[];
  onOrderNow: (product: ProduceListing, targetCoop?: string) => void;
  onOrderCustom?: (prefill?: { cluster?: string; cropType?: string }) => void;
}

const ALL_STANDARD_COMMODITIES = Array.from(
  new Set(
    Object.values(COMMODITY_CATEGORIES)
      .flat()
      .filter((item) => item !== 'Other')
  )
);

const ProductsPage: React.FC<Props> = ({
  produceListings,
  foodCoops = FOOD_COOPS,
  onOrderNow,
  onOrderCustom
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCoop, setSelectedCoop] = useState('ALL');

  const { allCoops, productCountsByCoop } = useMemo(() => {
    const counts: Record<string, number> = {};
    produceListings
      .filter(p => p.status === 'AVAILABLE')
      .forEach(p => {
        if (p.cluster) {
          counts[p.cluster] = (counts[p.cluster] || 0) + 1;
        }
      });

    const combined = Array.from(new Set([...foodCoops, ...Object.keys(counts)]))
      .filter(c => c && c !== '-' && c !== 'Unassigned')
      .sort((a, b) => {
        // Show coops with active listings first, then alphabetically
        const diff = (counts[b] || 0) - (counts[a] || 0);
        return diff !== 0 ? diff : a.localeCompare(b);
      });

    return { allCoops: combined, productCountsByCoop: counts };
  }, [produceListings, foodCoops]);

  const query = searchTerm.trim().toLowerCase();

  // Direct stock listed under the selected coop (or all coops when ALL is selected)
  const groupedDirectProducts = useMemo(() => {
    const available = produceListings.filter(p => p.status === 'AVAILABLE');
    const filtered = available.filter(p => {
      const matchesCoop = selectedCoop === 'ALL' || p.cluster === selectedCoop;
      const matchesSearch =
        !query ||
        p.cropType.toLowerCase().includes(query) ||
        p.cluster.toLowerCase().includes(query) ||
        p.supplierName.toLowerCase().includes(query);
      return matchesCoop && matchesSearch;
    });

    const groups: Record<string, ProduceListing[]> = {};
    filtered.forEach(product => {
      const key = normalizeProductName(product.cropType);
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    });
    return groups;
  }, [produceListings, query, selectedCoop]);

  // Network stock from OTHER Food Coops (visible when a specific Food Coop like Rabolo is selected,
  // so e.g. Sugar stocked in Mulo & Apuoyo can be ordered directly for Rabolo)
  const groupedNetworkProducts = useMemo(() => {
    if (selectedCoop === 'ALL') return {};
    const available = produceListings.filter(p => p.status === 'AVAILABLE' && p.cluster !== selectedCoop);
    const filtered = available.filter(p => {
      if (!query) return true;
      return (
        p.cropType.toLowerCase().includes(query) ||
        p.cluster.toLowerCase().includes(query) ||
        p.supplierName.toLowerCase().includes(query)
      );
    });

    const groups: Record<string, ProduceListing[]> = {};
    filtered.forEach(product => {
      const key = normalizeProductName(product.cropType);
      if (!groups[key]) groups[key] = [];
      groups[key].push(product);
    });
    return groups;
  }, [produceListings, query, selectedCoop]);

  // Standard KPL Commodity Catalog available under EVERY Food Coop (even if not yet stocked in DB)
  const catalogCommodities = useMemo(() => {
    const directNames = new Set(
      selectedCoop === 'ALL'
        ? []
        : Object.keys(groupedDirectProducts).map(k => k.toLowerCase())
    );

    return ALL_STANDARD_COMMODITIES.filter(item => {
      if (directNames.has(item.toLowerCase())) return false;
      if (!query) return true;
      return item.toLowerCase().includes(query);
    });
  }, [groupedDirectProducts, query, selectedCoop]);

  const triggerCustomOrder = (cropTypeOverride?: string) => {
    if (!onOrderCustom) return;
    onOrderCustom({
      cluster: selectedCoop !== 'ALL' ? selectedCoop : undefined,
      cropType: cropTypeOverride || searchTerm.trim() || undefined
    });
  };

  const renderProductGroup = (
    cropType: string,
    products: ProduceListing[],
    targetCoop?: string
  ) => (
    <div key={`${targetCoop || 'direct'}-${cropType}`} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10"></div>

      <div className="flex items-center justify-between gap-3 mb-6 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
            <span className="text-emerald-600 font-black text-lg">{cropType.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">{cropType}</h2>
            {targetCoop && (
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                Available across network &bull; Order for {targetCoop}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product, pIdx) => (
          <div key={product.id || pIdx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-emerald-200 transition-colors flex flex-col justify-between h-full">
            <div>
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1 pr-2">
                  <h3 className="text-sm font-black text-slate-800 truncate">
                    {targetCoop ? `Source: ${product.cluster}` : product.cluster}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate">
                    Supplier: {product.supplierName}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 mr-1">KSh</span>
                  <span className="text-lg font-black text-emerald-600">
                    {Number(product.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">per {product.unitType}</p>
                </div>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs font-bold text-slate-500">Available:</span>
                <span className="text-sm font-black text-slate-800">{product.unitsAvailable} {product.unitType}s</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOrderNow(product, targetCoop)}
              className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <ShoppingCart className="w-4 h-4" />
              {targetCoop ? `Order for ${targetCoop}` : 'Order Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const hasDirect = Object.keys(groupedDirectProducts).length > 0;
  const hasNetwork = Object.keys(groupedNetworkProducts).length > 0;
  const hasCatalog = catalogCommodities.length > 0;

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700 max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Available Products</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
            All Products Available Under All {allCoops.length} Food Coops &bull; Counter COP 31 Ready
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <select
            value={selectedCoop}
            onChange={(e) => setSelectedCoop(e.target.value)}
            className="px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          >
            <option value="ALL">All Food Coops ({allCoops.length})</option>
            {allCoops.map(coop => {
              const count = productCountsByCoop[coop] || 0;
              return (
                <option key={coop} value={coop}>
                  {coop} {count > 0 ? `(${count} own + All Network Products)` : '(All Network Products)'}
                </option>
              );
            })}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products (e.g. Sugar)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {onOrderCustom && (
            <button
              type="button"
              onClick={() => triggerCustomOrder()}
              className="px-5 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all shrink-0 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Order Unlisted Product
            </button>
          )}
        </div>
      </div>

      <div className="space-y-10">
        {/* Section 1: Direct Stock for Selected Coop (or All Coops) */}
        {hasDirect && (
          <div className="space-y-6">
            {selectedCoop !== 'ALL' && (
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-600">
                <Store className="w-4 h-4 text-emerald-600" />
                Direct Stock Under {selectedCoop}
              </div>
            )}
            {Object.entries(groupedDirectProducts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cropType, products]) =>
                renderProductGroup(
                  cropType,
                  products,
                  selectedCoop !== 'ALL' ? selectedCoop : undefined
                )
              )}
          </div>
        )}

        {/* Section 2: Network Stock from Other Coops (Orderable Under Selected Coop, e.g., Rabolo ordering Mulo/Apuoyo Sugar) */}
        {selectedCoop !== 'ALL' && hasNetwork && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-emerald-700 shrink-0" />
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-emerald-950">
                    All Network Products Available to Order for {selectedCoop}
                  </h2>
                  <p className="text-xs font-semibold text-emerald-800 mt-0.5">
                    Products stocked by other Food Coops (such as Sugar in Mulo or Apuoyo) can be ordered directly under {selectedCoop}.
                  </p>
                </div>
              </div>
            </div>
            {Object.entries(groupedNetworkProducts)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([cropType, products]) =>
                renderProductGroup(cropType, products, selectedCoop)
              )}
          </div>
        )}

        {/* Section 3: Full KPL Commodity Catalog Available Under Every Food Coop */}
        {onOrderCustom && hasCatalog && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">
                  {selectedCoop !== 'ALL'
                    ? `Full Commodity Catalog for ${selectedCoop}`
                    : 'All KPL Commodities (Order Under Any Food Coop)'}
                </h2>
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  Every product below can be ordered for {selectedCoop !== 'ALL' ? selectedCoop : 'any of the 53+ Food Coops'} even if no supplier stock is listed yet.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {catalogCommodities.map((commodity) => (
                <button
                  key={commodity}
                  type="button"
                  onClick={() => triggerCustomOrder(commodity)}
                  className="bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-2xl p-3.5 text-left transition-all flex flex-col justify-between gap-2 group active:scale-95"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-black text-xs flex items-center justify-center">
                      {commodity.charAt(0)}
                    </span>
                    <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-700" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-800 group-hover:text-emerald-900 truncate">{commodity}</p>
                    <p className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider mt-0.5">
                      {selectedCoop !== 'ALL' ? `Order for ${selectedCoop}` : 'Select Coop'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fallback when search matches nothing */}
        {!hasDirect && !hasNetwork && !hasCatalog && (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-100 shadow-sm space-y-4">
            <p className="text-base font-black text-slate-700">
              No listed or standard commodity matched &ldquo;{searchTerm}&rdquo;.
            </p>
            <p className="text-xs font-bold text-slate-400 max-w-md mx-auto">
              You can still place a Customer or Counter COP 31 order for any product under {selectedCoop !== 'ALL' ? selectedCoop : 'any Food Coop'}.
            </p>
            {onOrderCustom && (
              <button
                type="button"
                onClick={() => triggerCustomOrder()}
                className="inline-flex items-center gap-2 px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                {selectedCoop !== 'ALL'
                  ? `Order "${searchTerm.trim()}" for ${selectedCoop}`
                  : `Place Custom Order for "${searchTerm.trim()}"`}
              </button>
            )}
          </div>
        )}

        {onOrderCustom && (hasDirect || hasNetwork || hasCatalog) && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wider">
                Need Another Product Not Listed Above?
              </h3>
              <p className="text-xs font-bold text-emerald-700 mt-1">
                Agents and members can place an order for any custom product under any of the {allCoops.length} Food Coops.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerCustomOrder()}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-md transition-all shrink-0 flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Order Unlisted Product
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
