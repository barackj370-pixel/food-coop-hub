import React, { useState, useEffect } from 'react';
import WeatherWidget from './WeatherWidget';
import { CLUSTER_COORDINATES } from '../services/weatherService';

const WeatherCarousel: React.FC = () => {
  const clusters = Object.keys(CLUSTER_COORDINATES);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % clusters.length);
    }, 10000); // 10 seconds per cluster to allow reading
    return () => clearInterval(timer);
  }, [clusters.length]);

  const currentCluster = clusters[currentIndex];

  return (
    <div className="animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center gap-3 mb-4 px-4">
         <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
         <p className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live Weather Tracker</p>
         <div className="h-px bg-red-100 flex-1"></div>
         <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Monitoring {clusters.length} Regions</p>
      </div>
      <WeatherWidget defaultCluster={currentCluster} readOnly={true} />
    </div>
  );
};

export default WeatherCarousel;
