import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
  accent?: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color, accent = "text-black" }) => {
  return (
    <div className={`${color} p-8 rounded-[2.5rem] border flex flex-col justify-between hover:shadow-2xl transition-all group cursor-default shadow-sm`}>
      <div className="flex justify-between items-start mb-6">
        <div className={`w-12 h-12 rounded-2xl bg-slate-800/50 ${accent} flex items-center justify-center transition-transform group-hover:scale-110 shadow-sm border border-slate-700/30`}>
          <i className={`fas ${icon} text-lg`}></i>
        </div>
        <div className="flex space-x-1 opacity-20 group-hover:opacity-40 transition-opacity">
          <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-slate-400"></div>
          <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-2">{label}</p>
        <p className={`text-3xl font-black ${accent} tracking-tighter leading-none`}>{value}</p>
      </div>
    </div>
  );
};

export default StatCard;