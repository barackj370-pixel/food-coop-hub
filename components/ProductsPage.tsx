import React, { useState, useMemo } from 'react';
import { ProduceListing } from '../types';
import { COMMODITY_CATEGORIES } from '../constants';
import { Search, Store } from 'lucide-react';

interface Props {
  produceListings: ProduceListing[];
}

const ProductsPage: React.FC<Props> = ({ produceListings }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const categorizedProducts = useMemo(() => {
    const available = produceListings.filter(p => p.status === 'AVAILABLE');
    const filtered = available.filter(p => 
      p.cropType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cluster.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const categories = {
      'Farm Food Products': [] as ProduceListing[],
      'Food Products': [] as ProduceListing[],
      'Non-food Products': [] as ProduceListing[]
    };

    filtered.forEach(product => {
      let categoryFound = false;
      for (const [category, items] of Object.entries(COMMODITY_CATEGORIES)) {
        if ((items as readonly string[]).includes(product.cropType)) {
          categories[category as keyof typeof categories].push(product);
          categoryFound = true;
          break;
        }
      }
      if (!categoryFound) {
        categories['Farm Food Products'].push(product);
      }
    });

    return categories;
  }, [produceListings, searchTerm]);

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Available Products</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">Browse all repository products</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search products or coops..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
        </div>
      </div>

      <div className="space-y-12">
        {Object.entries(categorizedProducts).map(([category, products]) => (
          <div key={category}>
            <div className="flex items-center gap-3 mb-6">
              <Store className="w-6 h-6 text-emerald-500" />
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">{category}</h2>
              <div className="h-px bg-slate-200 flex-1 ml-4"></div>
            </div>
            
            {products.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-100">
                <p className="text-sm font-bold text-slate-400">No products found in this category.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {products.map((product, pIdx) => (
                  <div key={pIdx} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:scale-110 transition-transform"></div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-black text-slate-800 line-clamp-1">{product.cropType}</h3>
                        <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mt-1">{product.cluster}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-2 border-b border-slate-50">
                        <span className="text-xs font-bold text-slate-500">Available</span>
                        <span className="text-sm font-black text-slate-800">{product.unitsAvailable} {product.unitType}s</span>
                      </div>
                      
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-xs font-bold text-slate-500">Retail Price</span>
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 mr-1">KSh</span>
                          <span className="text-lg font-black text-emerald-600">{Number(product.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">per {product.unitType}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsPage;
