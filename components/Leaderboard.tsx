import React from 'react';
import { FoodCoopMetric } from '../types';

interface LeaderboardProps {
  clusterPerformance: [string, FoodCoopMetric][];
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ clusterPerformance }) => {
  // Get top 5 food coops by sales volume
  const topByVolume = [...clusterPerformance]
    .sort((a, b) => b[1].volume - a[1].volume)
    .slice(0, 5);

  // Get top 5 food coops by coop commission
  const topByCommission = [...clusterPerformance]
    .sort((a, b) => b[1].profit - a[1].profit)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Top by Sales Volume */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shadow-lg">
            <i className="fas fa-chart-line text-xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Top 5 Food Coops</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">By Sales Volume</p>
          </div>
        </div>
        <div className="space-y-4">
          {topByVolume.map(([cluster, stats], index) => (
            <div key={cluster} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] ${index === 0 ? 'bg-yellow-400 text-yellow-900' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                  #{index + 1}
                </div>
                <span className="font-black uppercase text-[11px] text-slate-900">{cluster}</span>
              </div>
              <span className="font-black text-sm text-slate-900">KSh {stats.volume.toLocaleString()}</span>
            </div>
          ))}
          {topByVolume.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">No data available yet.</p>
          )}
        </div>
      </div>

      {/* Top by Commission */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-500/20">
            <i className="fas fa-coins text-xl"></i>
          </div>
          <div>
            <h3 className="text-xl font-black uppercase tracking-tight text-slate-900">Top 5 Food Coops</h3>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">By Coop Commission</p>
          </div>
        </div>
        <div className="space-y-4">
          {topByCommission.map(([cluster, stats], index) => (
            <div key={cluster} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-300 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] ${index === 0 ? 'bg-yellow-400 text-yellow-900' : index === 1 ? 'bg-slate-300 text-slate-700' : index === 2 ? 'bg-amber-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>
                  #{index + 1}
                </div>
                <span className="font-black uppercase text-[11px] text-slate-900">{cluster}</span>
              </div>
              <span className="font-black text-sm text-green-600">KSh {stats.profit.toLocaleString()}</span>
            </div>
          ))}
          {topByCommission.length === 0 && (
            <p className="text-center text-slate-400 text-sm py-4">No data available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};
