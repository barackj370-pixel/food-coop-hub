import React from 'react';
import { FoodCoopMetric } from '../types';

interface LeaderboardProps {
  clusterPerformance: [string, FoodCoopMetric][];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ clusterPerformance }) => {
  // Get top food coops by sales volume
  const topCoops = [...clusterPerformance]
    .sort((a, b) => b[1].volume - a[1].volume)
    .slice(0, 5);

  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg">
          <i className="fas fa-trophy text-xl"></i>
        </div>
        <div>
          <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Top 5 Food Coops</h3>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">By Sales Volume & Commission</p>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
            <tr>
              <th className="pb-4 pl-4">Rank</th>
              <th className="pb-4">Food Coop</th>
              <th className="pb-4 text-right">Sales Volume</th>
              <th className="pb-4 text-right pr-4">Coop Commission</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {topCoops.map(([cluster, stats], index) => (
              <tr key={cluster} className="hover:bg-slate-50 transition-colors group">
                <td className="py-4 pl-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] ${index === 0 ? 'bg-yellow-400 text-yellow-900' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    #{index + 1}
                  </div>
                </td>
                <td className="py-4">
                  <span className="font-black uppercase text-[11px] text-slate-900">{cluster}</span>
                </td>
                <td className="py-4 text-right">
                  <span className="font-black text-sm text-slate-900">KSh {stats.volume.toLocaleString()}</span>
                </td>
                <td className="py-4 text-right pr-4">
                  <span className="font-black text-sm text-green-600">KSh {stats.profit.toLocaleString()}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {topCoops.length === 0 && (
          <p className="text-center text-slate-400 text-sm py-8">No data available yet.</p>
        )}
      </div>
    </div>
  );
};
