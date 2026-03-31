import React, { useState, useMemo } from 'react';
import { ProduceListing } from '../types';
import { Search, ShoppingCart } from 'lucide-react';
import { normalizeProductName } from '../constants';

interface Props {
  produceListings: ProduceListing[];
  onOrderNow: (product: ProduceListing) => void;
}

const ProductsPage: React.FC<Props> = ({ produceListings, onOrderNow }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const groupedProducts = useMemo(() => {
    const available = produceListings.filter(p => p.status === 'AVAILABLE');
    const filtered = available.filter(p => 
      p.cropType.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.cluster.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.supplierName.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const groups: Record<string, ProduceListing[]> = {};

    filtered.forEach(product => {
      const key = normalizeProductName(product.cropType);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(product);
    });

    return groups;
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
        {Object.keys(groupedProducts).length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-slate-100">
            <p className="text-sm font-bold text-slate-400">No products found.</p>
          </div>
        ) : (
          Object.entries(groupedProducts).sort(([a], [b]) => a.localeCompare(b)).map(([cropType, products]) => (
            <div key={cropType} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -z-10"></div>
              
              <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <span className="text-emerald-600 font-black text-lg">{cropType.charAt(0).toUpperCase()}</span>
                </div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">{cropType}</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product, pIdx) => (
                  <div key={pIdx} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 hover:border-emerald-200 transition-colors flex flex-col justify-between h-full">
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 pr-2">
                          <h3 className="text-sm font-black text-slate-800 truncate">{product.cluster}</h3>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate">Supplier: {product.supplierName}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold text-slate-400 mr-1">KSh</span>
                          <span className="text-lg font-black text-emerald-600">{Number(product.sellingPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">per {product.unitType}</p>
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs font-bold text-slate-500">Available:</span>
                        <span className="text-sm font-black text-slate-800">{product.unitsAvailable} {product.unitType}s</span>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => onOrderNow(product)}
                      className="mt-4 w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 mt-auto"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Order Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ProductsPage;
