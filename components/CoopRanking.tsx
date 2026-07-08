import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CoopRankingProps {
  records: any[]; // The universal ledger records
}

const HISTORICAL_SALES_VOLUME: Record<string, number> = {
  'New Kangemi Food Coop': 7442,
  'Kangemi': 3099,
  'Red Hill': 807,
  'New Grassroots Food Coop': 465,
  'Wages': 454,
  'Kithoni': 396,
  'Hope': 247,
  'Bethel Parental': 219,
  'Uwezo': 104,
  'Bottomline LEF': 78,
  'Smart Ladies': 51,
  'Ladies Star': 51,
  'Nyeri Sisters': 50,
  'Upendo Women': 27,
  'Litaala Pap': 25,
  'Kina Mama': 18,
  'Maya': 15,
  'Rabolo': 4333,
  'Mariwa': 1980,
  'Utoma Widows Food coop': 1798,
  'Mulo': 1672,
  'Nyamagagana': 1537,
  'Komasincha': 598,
  'Angaza Youth': 447,
  'Angaza Food Coop': 447,
  'Kabarnet': 2643,
  'Apuoyo': 2225,
  'Ligega': 1452,
  'Muchukwo/Kolbai': 305,
  'Muchukwo': 305,
  'Ndere Women': 171,
  'Sibembe Muoyomulayi': 1684,
  'Sibembe': 1684,
  'Anointed': 535,
  'Nalondo': 415,
  'Dero Kenya': 280,
  'Dero': 280,
  'Njete': 280,
  'Sisimkha': 280,
  'Maeni Self Help': 245,
  'Maeni': 245,
  'Webtan': 194,
  'Kona Mbaaya': 171,
  'Kona Mbaya': 171,
  'Matisi B Block 5': 160,
  'Matisi B': 160,
  'Mima Self Help': 160,
  'Mima': 160,
  'Shalom Youth': 160,
  'Sibembe Elders': 140,
  'Trafah': 135,
  'Trafar': 135,
  'Kiabi Food Coop': 115,
  'Kiabi': 115,
  'Macho self Help': 110,
  'Macho': 110,
  'Kiboroa Amani': 100,
  'Eninga': 80,
  'Faith Worship': 60,
  'Boresha': 15,
  'Hekima': 10,
  'Sibembe Widows': 5,
};

const isJulyWeek1 = (dateStr: string) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getMonth() === 6 && d.getDate() <= 7;
};

const CoopRanking: React.FC<CoopRankingProps> = ({ records }) => {
  const ranking = useMemo(() => {
    const coopTotals: Record<string, number> = {};

    // Calculate current platform totals
    records.forEach(r => {
      // Only include valid sales records (completed or paid aggregates) from Week 1 of July
      if ((r.isAggregate === true || r.cropType === 'AGGREGATE (Weekly)') && (r.status === 'PAID' || r.status === 'COMPLETE') && isJulyWeek1(r.date)) {
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

        {ranking.length > 0 && (
          <div className="mb-12 h-96 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={ranking.slice(0, 15)}
                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                <XAxis 
                  dataKey="cluster" 
                  angle={-45} 
                  textAnchor="end" 
                  height={80} 
                  interval={0}
                  tick={{ fontSize: 9, fontWeight: 'bold' }} 
                />
                <YAxis 
                  tickFormatter={(value) => `KSh ${value.toLocaleString()}`} 
                  tick={{ fontSize: 10, fontWeight: 'bold' }} 
                  width={100}
                />
                <Tooltip 
                  formatter={(value: number) => [`KSh ${value.toLocaleString()}`, 'Volume']}
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                />
                <Legend verticalAlign="top" height={36} />
                <Bar 
                  dataKey="historicalVolume" 
                  name="Historical Volume" 
                  stackId="a" 
                  fill="#94a3b8" 
                />
                <Bar 
                  dataKey="platformVolume" 
                  name="Platform Volume" 
                  stackId="a" 
                  fill="#10b981" 
                  radius={[4, 4, 0, 0]} 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

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
