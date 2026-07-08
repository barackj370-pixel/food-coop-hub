import React, { useMemo } from 'react';

interface CoopRankingProps {
  records: any[]; // The universal ledger records
}

const HISTORICAL_SALES_VOLUME: Record<string, number> = {
  // To be filled later when KPL provides the historical data
};

const CoopRanking: React.FC<CoopRankingProps> = ({ records }) => {
  const ranking = useMemo(() => {
    const coopTotals: Record<string, number> = {};

    // Calculate current platform totals
    records.forEach(r => {
      // Only include valid sales records (completed or paid aggregates)
      if ((r.isAggregate === true || r.cropType === 'AGGREGATE (Weekly)') && (r.status === 'PAID' || r.status === 'COMPLETE')) {
        const cluster = r.cluster || 'Unknown';
        const saleAmount = Number(r.totalSale) || 0;
        if (!coopTotals[cluster]) {
          coopTotals[cluster] = 0;
        }
        coopTotals[cluster] += saleAmount;
      }
    });

    // Add historical offset
    const combinedTotals: { cluster: string; totalVolume: number; platformVolume: number; historicalVolume: number }[] = [];
    
    // First, process all known clusters from the platform
    Object.keys(coopTotals).forEach(cluster => {
      const historical = HISTORICAL_SALES_VOLUME[cluster] || 0;
      combinedTotals.push({
        cluster,
        platformVolume: coopTotals[cluster],
        historicalVolume: historical,
        totalVolume: coopTotals[cluster] + historical
      });
    });

    // Then, add any historical clusters not present in platform records
    Object.keys(HISTORICAL_SALES_VOLUME).forEach(cluster => {
      if (coopTotals[cluster] === undefined) {
        combinedTotals.push({
          cluster,
          platformVolume: 0,
          historicalVolume: HISTORICAL_SALES_VOLUME[cluster],
          totalVolume: HISTORICAL_SALES_VOLUME[cluster]
        });
      }
    });

    // Sort by total volume descending
    return combinedTotals.sort((a, b) => b.totalVolume - a.totalVolume);
  }, [records]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="flex justify-between items-center mb-12">
          <h2 className="text-3xl font-black text-slate-900">Food Coops <span className="text-emerald-600 block text-sm tracking-widest">Global Ranking</span></h2>
          <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
            <i className="fas fa-trophy text-2xl"></i>
          </div>
        </div>

        <div className="space-y-4">
          {ranking.map((coop, index) => (
            <div key={coop.cluster} className={`p-6 rounded-2xl border flex items-center gap-6 transition-all ${index === 0 ? 'bg-amber-50 border-amber-200' : index === 1 ? 'bg-slate-50 border-slate-200' : index === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg ${index === 0 ? 'bg-amber-400 text-white shadow-lg shadow-amber-400/20' : index === 1 ? 'bg-slate-300 text-white shadow-lg shadow-slate-300/20' : index === 2 ? 'bg-orange-300 text-white shadow-lg shadow-orange-300/20' : 'bg-slate-100 text-slate-400'}`}>
                {index + 1}
              </div>
              <div className="flex-1">
                <h3 className="font-black text-slate-800 text-lg">{coop.cluster}</h3>
                {coop.historicalVolume > 0 && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Platform: KSh {coop.platformVolume.toLocaleString()} | Historical: KSh {coop.historicalVolume.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales Volume</p>
                <p className={`text-2xl font-black ${index === 0 ? 'text-amber-600' : 'text-slate-700'}`}>KSh {coop.totalVolume.toLocaleString()}</p>
              </div>
            </div>
          ))}
          
          {ranking.length === 0 && (
            <div className="py-12 text-center text-slate-400 font-medium text-sm">
              No sales records available yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoopRanking;
