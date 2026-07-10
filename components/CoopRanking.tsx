import React, { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CoopRankingProps {
  records: any[]; // The universal ledger records
}

const HISTORICAL_SALES_VOLUME: Record<string, number> = {
  'New Kangemi Food Coop': 7442,
  'New Kangemi': 7442,
  'Kangemi': 3099,
  'Red Hill': 807,
  'New Grassroots Food Coop': 465,
  'New Grassroots': 465,
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
  'Utoma Widows': 1798,
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

const COOP_REGIONS: Record<string, string> = {
  'New Kangemi Food Coop': 'Central',
  'New Kangemi': 'Central',
  'Kangemi': 'Central',
  'Red Hill': 'Central',
  'New Grassroots Food Coop': 'Central',
  'New Grassroots': 'Central',
  'Wages': 'Central',
  'Kithoni': 'Central',
  'Hope': 'Central',
  'Bethel Parental': 'Central',
  'Uwezo': 'Central',
  'Bottomline LEF': 'Central',
  'Smart Ladies': 'Central',
  'Ladies Star': 'Central',
  'Nyeri Sisters': 'Central',
  'Upendo Women': 'Central',
  'Litaala Pap': 'Central',
  'Kina Mama': 'Central',
  'Maya': 'Central',
  'Rabolo': 'South Western',
  'Mariwa': 'South Western',
  'Utoma Widows Food coop': 'South Western',
  'Utoma Widows': 'South Western',
  'Mulo': 'South Western',
  'Nyamagagana': 'South Western',
  'Komasincha': 'South Western',
  'Angaza Youth': 'South Western',
  'Angaza Food Coop': 'South Western',
  'Kabarnet': 'North Western',
  'Apuoyo': 'North Western',
  'Ligega': 'North Western',
  'Muchukwo/Kolbai': 'North Western',
  'Muchukwo': 'North Western',
  'Ndere Women': 'North Western',
  'Sibembe Muoyomulayi': 'Western Region',
  'Sibembe': 'Western Region',
  'Anointed': 'Western Region',
  'Nalondo': 'Western Region',
  'Dero Kenya': 'Western Region',
  'Dero': 'Western Region',
  'Njete': 'Western Region',
  'Sisimkha': 'Western Region',
  'Maeni Self Help': 'Western Region',
  'Maeni': 'Western Region',
  'Webtan': 'Western Region',
  'Kona Mbaaya': 'Western Region',
  'Kona Mbaya': 'Western Region',
  'Matisi B Block 5': 'Western Region',
  'Matisi B': 'Western Region',
  'Mima Self Help': 'Western Region',
  'Mima': 'Western Region',
  'Shalom Youth': 'Western Region',
  'Sibembe Elders': 'Western Region',
  'Trafah': 'Western Region',
  'Trafar': 'Western Region',
  'Kiabi Food Coop': 'Western Region',
  'Kiabi': 'Western Region',
  'Macho self Help': 'Western Region',
  'Macho': 'Western Region',
  'Kiboroa Amani': 'Western Region',
  'Eninga': 'Western Region',
  'Faith Worship': 'Western Region',
  'Boresha': 'Western Region',
  'Hekima': 'Western Region',
  'Sibembe Widows': 'Western Region',
};

const isJulyWeek1 = (dateStr: string) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d.getMonth() === 6 && d.getDate() <= 7;
};

const CoopRanking: React.FC<CoopRankingProps> = ({ records }) => {
  const [viewMode, setViewMode] = useState<'NATIONAL' | 'REGIONAL'>('NATIONAL');
  const [selectedRegion, setSelectedRegion] = useState<string>('Central');

  const { ranking, regionalStats } = useMemo(() => {
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
    const combinedTotals: { cluster: string; region: string; totalVolume: number; platformVolume: number; historicalVolume: number }[] = [];
    
    // Merge both to get all clusters
    const allClusters = new Set([...Object.keys(coopTotals), ...Object.keys(HISTORICAL_SALES_VOLUME)]);

    allClusters.forEach(cluster => {
      const pVol = coopTotals[cluster] || 0;
      const hVol = HISTORICAL_SALES_VOLUME[cluster] || 0;
      const region = COOP_REGIONS[cluster] || 'Unknown';
      
      combinedTotals.push({
        cluster,
        region,
        platformVolume: pVol,
        historicalVolume: hVol,
        totalVolume: pVol + hVol
      });
    });

    const sortedRanking = combinedTotals.sort((a, b) => b.totalVolume - a.totalVolume);

    // Calculate regional summaries
    const regTotals: Record<string, { region: string; totalVolume: number; platformVolume: number; historicalVolume: number }> = {};
    sortedRanking.forEach(c => {
      if (!regTotals[c.region]) {
         regTotals[c.region] = { region: c.region, totalVolume: 0, platformVolume: 0, historicalVolume: 0 };
      }
      regTotals[c.region].totalVolume += c.totalVolume;
      regTotals[c.region].platformVolume += c.platformVolume;
      regTotals[c.region].historicalVolume += c.historicalVolume;
    });

    const regionalStatsList = Object.values(regTotals).sort((a, b) => b.totalVolume - a.totalVolume);

    return { ranking: sortedRanking, regionalStats: regionalStatsList };
  }, [records]);

  const displayedRanking = viewMode === 'NATIONAL' 
    ? ranking 
    : ranking.filter(c => c.region === selectedRegion);

  const availableRegions = useMemo(() => Array.from(new Set(ranking.map(r => r.region).filter(r => r !== 'Unknown'))).sort(), [ranking]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-6">
          <div>
            <h2 className="text-3xl font-black text-slate-900">Food Coops <span className="text-emerald-600 block text-sm tracking-widest">{viewMode === 'NATIONAL' ? 'Global Ranking' : `${selectedRegion} Regional Ranking`}</span></h2>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 items-center bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <div className="flex gap-2">
              <button 
                onClick={() => setViewMode('NATIONAL')}
                className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${viewMode === 'NATIONAL' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                National
              </button>
              <button 
                onClick={() => setViewMode('REGIONAL')}
                className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${viewMode === 'REGIONAL' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}
              >
                Regional
              </button>
            </div>
            
            {viewMode === 'REGIONAL' && (
              <select 
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-black text-slate-700 outline-none focus:border-emerald-500"
              >
                {availableRegions.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {viewMode === 'NATIONAL' && regionalStats.length > 0 && (
          <div className="mb-16">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Regional Performance Summary</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={regionalStats}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                  <XAxis 
                    dataKey="region" 
                    tick={{ fontSize: 10, fontWeight: 'bold' }} 
                  />
                  <YAxis 
                    tickFormatter={(value) => `KSh ${(value / 1000).toFixed(0)}k`} 
                    tick={{ fontSize: 10, fontWeight: 'bold' }} 
                    width={80}
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
                    fill="#3b82f6" 
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
          </div>
        )}

        {displayedRanking.length > 0 && (
          <div className="mb-12 h-96 w-full">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Cooperative Breakdown</h3>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={displayedRanking.slice(0, viewMode === 'NATIONAL' ? 15 : undefined)}
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
                  tickFormatter={(value) => `KSh ${(value / 1000).toFixed(0)}k`} 
                  tick={{ fontSize: 10, fontWeight: 'bold' }} 
                  width={80}
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

        <div className="space-y-4 mt-8">
          {displayedRanking.map((coop, index) => (
            <div key={coop.cluster} className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center gap-6 transition-all ${index === 0 ? 'bg-amber-50 border-amber-200' : index === 1 ? 'bg-slate-50 border-slate-200' : index === 2 ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex shrink-0 items-center justify-center font-black text-lg ${index === 0 ? 'bg-amber-400 text-white shadow-lg shadow-amber-400/20' : index === 1 ? 'bg-slate-300 text-white shadow-lg shadow-slate-300/20' : index === 2 ? 'bg-orange-300 text-white shadow-lg shadow-orange-300/20' : 'bg-slate-100 text-slate-400'}`}>
                  {index + 1}
                </div>
                <div className="md:hidden flex-1">
                   <h3 className="font-black text-slate-800 text-lg">{coop.cluster}</h3>
                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{coop.region}</p>
                </div>
              </div>
              <div className="flex-1 hidden md:block">
                <h3 className="font-black text-slate-800 text-lg">{coop.cluster}</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{coop.region}</p>
                {coop.historicalVolume > 0 && (
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                    Platform: KSh {coop.platformVolume.toLocaleString()} | Historical: KSh {coop.historicalVolume.toLocaleString()}
                  </p>
                )}
              </div>
              <div className="text-left md:text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales Volume</p>
                <p className={`text-2xl font-black ${index === 0 ? 'text-amber-600' : 'text-slate-700'}`}>KSh {coop.totalVolume.toLocaleString()}</p>
              </div>
            </div>
          ))}
          
          {displayedRanking.length === 0 && (
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
