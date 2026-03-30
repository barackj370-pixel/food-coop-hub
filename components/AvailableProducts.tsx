import React, { useMemo } from 'react';
import { ProduceListing } from '../types';
import { COMMODITY_CATEGORIES } from '../constants';
import { Store, ArrowRight } from 'lucide-react';

interface Props {
  produceListings: ProduceListing[];
  onViewAll: () => void;
}

const AvailableProducts: React.FC<Props> = ({ produceListings, onViewAll }) => {
  const categorizedProducts = useMemo(() => {
    const available = produceListings.filter(p => p.status === 'AVAILABLE');
    
    const categories = {
      'Farm Food Products': [] as ProduceListing[],
      'Food Products': [] as ProduceListing[],
      'Non-food Products': [] as ProduceListing[]
    };

    available.forEach(product => {
      let categoryFound = false;
      for (const [category, items] of Object.entries(COMMODITY_CATEGORIES)) {
        if ((items as readonly string[]).includes(product.cropType)) {
          categories[category as keyof typeof categories].push(product);
          categoryFound = true;
          break;
        }
      }
      if (!categoryFound) {
        // Default to Farm Food Products if not found
        categories['Farm Food Products'].push(product);
      }
    });

    return categories;
  }, [produceListings]);

  if (produceListings.length === 0) return null;

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Object.entries(categorizedProducts).map(([category, products]) => (
          <div key={category} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
            
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-50">
              <Store className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{category}</h3>
            </div>
            
            <div className="space-y-4">
              {products.slice(0, 5).map((product, pIdx) => (
                <div key={pIdx} className="flex justify-between items-center">
                  <div className="flex-1 pr-2">
                    <p className="text-xs font-bold text-slate-700 line-clamp-1">{product.cropType}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{product.cluster}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">KSh</span>
                    <span className="text-sm font-black text-emerald-600">{Number(product.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">per {product.unitType}</p>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2">No products available.</p>
              )}
            </div>
            
            {products.length > 5 && (
              <button 
                onClick={onViewAll}
                className="w-full mt-4 py-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors"
              >
                +{products.length - 5} More
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AvailableProducts;
