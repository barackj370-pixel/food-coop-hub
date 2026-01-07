
import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, icon, color }) => {
  return (
    <div className={`${color} p-6 rounded-[1.5rem] border border-white/10 flex flex-col justify-between hover:bg-white/10 transition-all group cursor-default`}>
      <div className="flex justify-between items-start mb-4">
        <div className="w-10 h-10 rounded-xl bg-white/5 text-emerald-300 flex items-center justify-center transition-transform group-hover:scale-110 shadow-inner">
          <i className={`fas ${icon} text-lg`}></i>
        </div>
      </div>
      <div>
        <p className="text-[9px] font-black text-emerald-300/40 uppercase tracking-[0.3em] mb-1.5">{label}</p>
        <p className="text-xl font-black text-white tracking-tight leading-none">{value}</p>
      </div>
    </div>
  );
};

export default StatCard;
