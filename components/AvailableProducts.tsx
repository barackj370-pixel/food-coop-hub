import React, { useMemo } from 'react';
import { ProduceListing } from '../types';
import { ShoppingCart, ArrowRight } from 'lucide-react';
import { normalizeProductName } from '../constants';

interface Props {
  produceListings: ProduceListing[];
  onViewAll: () => void;
  onOrderNow: (product: ProduceListing) => void;
}

const AvailableProducts: React.FC<Props> = ({ produceListings, onViewAll, onOrderNow }) => {
  const groupedProducts = useMemo(() => {
    const available = produceListings.filter(p => p.status === 'AVAILABLE');
    
    const groups: Record<string, ProduceListing[]> = {};

    available.forEach(product => {
      const key = normalizeProductName(product.cropType);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(product);
    });

    return groups;
  }, [produceListings]);

  if (produceListings.length === 0) return null;

  // Take the first 3 crop types to show on the home page
  const topCropTypes = Object.entries(groupedProducts)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 3);

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700 mb-12 px-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
          <h2 className="text-sm font-black text-emerald-600 uppercase tracking-widest">Available Products</h2>
        </div>
        <button 
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-bold text-emerald-600 hover:text-emerald-700 transition-colors"
        >
          View All <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topCropTypes.map(([cropType, products]) => (
          <div key={cropType} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all flex flex-col h-full">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
            
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-50">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                <span className="text-emerald-600 font-black text-sm">{cropType.charAt(0).toUpperCase()}</span>
              </div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight truncate">{cropType}</h3>
            </div>
            
            <div className="flex-grow space-y-4 flex flex-col">
              {products.slice(0, 3).map((product, pIdx) => (
                <div key={pIdx} className="bg-slate-50 rounded-xl p-3 border border-slate-100 flex flex-col gap-2 flex-grow justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 pr-2">
                      <p className="text-xs font-bold text-slate-800 truncate">{product.cluster}</p>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5 truncate">{product.supplierName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-[10px] font-bold text-slate-400 mr-1">KSh</span>
                      <span className="text-sm font-black text-emerald-600">{Number(product.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">per {product.unitType}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onOrderNow(product)}
                    className="w-full bg-emerald-100 hover:bg-emerald-200 text-emerald-700 py-2 rounded-lg font-black uppercase text-[9px] tracking-[0.1em] transition-colors flex items-center justify-center gap-1 mt-auto"
                  >
                    <ShoppingCart className="w-3 h-3" />
                    Order Now
                  </button>
                </div>
              ))}
            </div>
            
            {products.length > 3 && (
              <button 
                onClick={onViewAll}
                className="w-full mt-4 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors shrink-0"
              >
                +{products.length - 3} More Suppliers
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailableProducts;
