import React, { useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Store } from 'lucide-react';
import { SaleRecord, ProduceListing } from '../types';

interface Props {
  records: SaleRecord[];
  produceListings: ProduceListing[];
}

const RetailPriceCarousel: React.FC<Props> = ({ records, produceListings }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { current } = scrollRef;
      const scrollAmount = direction === 'left' ? -300 : 300;
      current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const coopData = useMemo(() => {
    // 1. Get all available listings
    const availableListings = produceListings.filter(p => p.status === 'AVAILABLE');
    
    // 2. Group by cluster
    const clusters = Array.from(new Set(availableListings.map(p => p.cluster).filter(Boolean)));
    
    const data = clusters.map(cluster => {
      // Get listings for this cluster
      const clusterListings = availableListings.filter(p => p.cluster === cluster);
      
      // Calculate sales for each cropType in this cluster
      const productSales = clusterListings.map(listing => {
        const salesForProduct = records.filter(r => r.cluster === cluster && r.cropType === listing.cropType);
        const totalSold = salesForProduct.reduce((sum, r) => sum + r.unitsSold, 0);
        return {
          ...listing,
          totalSold
        };
      });

      // Sort by totalSold descending, take top 5
      // If multiple listings have the same cropType, we might want to deduplicate, 
      // but assuming each cropType has one active listing or we just show the top 5 listings.
      // Let's deduplicate by cropType just in case.
      const uniqueProducts = Array.from(new Map(productSales.map(p => [p.cropType, p])).values());
      
      const top5 = uniqueProducts
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 5);

      return {
        cluster,
        topProducts: top5
      };
    });

    // Filter out clusters with no products
    return data.filter(d => d.topProducts.length > 0);
  }, [records, produceListings]);

  if (coopData.length === 0) return null;

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700 mb-12">
      <div className="flex items-center gap-3 mb-4 px-4">
         <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
         <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Top Selling Products by Food Coop</p>
         <div className="h-px bg-emerald-100 flex-1"></div>
         <div className="flex gap-2">
           <button onClick={() => scroll('left')} className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
             <ChevronLeft className="w-4 h-4 text-slate-600" />
           </button>
           <button onClick={() => scroll('right')} className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
             <ChevronRight className="w-4 h-4 text-slate-600" />
           </button>
         </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex overflow-x-auto gap-4 px-4 pb-4 snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {coopData.map((coop, idx) => (
          <div key={idx} className="min-w-[280px] md:min-w-[320px] bg-white rounded-3xl p-6 border border-slate-100 shadow-sm snap-start flex-shrink-0 relative overflow-hidden group hover:shadow-md transition-all">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
            
            <div className="flex items-center gap-2 mb-4">
              <Store className="w-5 h-5 text-emerald-500" />
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight line-clamp-1">{coop.cluster}</h3>
            </div>
            
            <div className="space-y-3">
              {coop.topProducts.map((product, pIdx) => (
                <div key={pIdx} className="flex justify-between items-center border-b border-slate-50 pb-2 last:border-0 last:pb-0">
                  <div className="flex-1 pr-2">
                    <p className="text-xs font-bold text-slate-700 line-clamp-1">{product.cropType}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{product.totalSold} {product.unitType}s sold</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">KSh</span>
                    <span className="text-sm font-black text-emerald-600">{Number(product.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">per {product.unitType}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RetailPriceCarousel;
