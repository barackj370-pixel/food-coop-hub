import React, { useState, useEffect } from 'react';
import WeatherWidget from './WeatherWidget';
import { CLUSTER_COORDINATES } from '../services/weatherService';

const WeatherCarousel: React.FC = () => {
  const clusters = Object.keys(CLUSTER_COORDINATES);
  const [currentCluster, setCurrentCluster] = useState(clusters[0]);

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-3 mb-4 px-4">
         <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
         <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live Weather Tracker</p>
         <div className="h-px bg-red-100 flex-1"></div>
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monitoring {clusters.length} Regions</p>
      </div>
      <WeatherWidget defaultCluster={currentCluster} readOnly={false} />
    </div>
  );
};

export default WeatherCarousel;
