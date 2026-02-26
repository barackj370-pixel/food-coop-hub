import React, { useEffect, useState } from 'react';
import { fetchWeather, WeatherData, getWeatherDescription, getAgroAdvice, CLUSTER_COORDINATES } from '../services/weatherService';

interface WeatherWidgetProps {
  defaultCluster: string;
  readOnly?: boolean;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ defaultCluster, readOnly = false }) => {
  const [cluster, setCluster] = useState(defaultCluster);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const slidesCount = 4;

  useEffect(() => {
    setCluster(defaultCluster);
    setCurrentSlide(0);
  }, [defaultCluster]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slidesCount);
    }, 6000); // 6 seconds per slide
    return () => clearInterval(timer);
  }, [slidesCount]);

  useEffect(() => {
    // Validate cluster name, fallback to Mariwa if unknown
    const safeCluster = Object.keys(CLUSTER_COORDINATES).includes(cluster) ? cluster : 'Mariwa';
    
    const loadData = async () => {
      setLoading(true);
      const data = await fetchWeather(safeCluster);
      setWeather(data);
      setLoading(false);
    };
    loadData();
  }, [cluster]);

  const handleClusterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCluster(e.target.value);
    setCurrentSlide(0);
  };

  if (loading && !weather) {
    return (
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl flex items-center justify-center min-h-[300px]">
        <div className="text-center animate-pulse">
           <i className="fas fa-satellite-dish text-4xl text-slate-300 mb-4"></i>
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Contacting Weather Satellite...</p>
        </div>
      </div>
    );
  }

  if (!weather) {
    return (
      <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl flex items-center justify-center min-h-[300px]">
        <div className="text-center">
           <i className="fas fa-cloud-slash text-4xl text-red-300 mb-4"></i>
           <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Weather Data Unavailable Offline</p>
           {!readOnly && <button onClick={() => setCluster(cluster)} className="mt-4 px-6 py-2 bg-slate-100 rounded-full text-[10px] font-black uppercase tracking-widest">Retry</button>}
        </div>
      </div>
    );
  }

  const currentDesc = getWeatherDescription(weather.current_weather.weathercode);
  const todayMax = weather.daily.temperature_2m_max[0];
  const todayPrecip = weather.daily.precipitation_probability_max[0];
  const advice = getAgroAdvice(todayPrecip, todayMax);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Controls */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
           <h3 className="text-xl font-black text-black uppercase tracking-tighter">Agro-Weather Department</h3>
           <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-1">Localized Forecast for Prior Planning</p>
        </div>
        <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
           <div className="w-8 h-8 rounded-xl bg-white flex items-center justify-center shadow-sm"><i className="fas fa-map-marker-alt text-red-500 text-xs"></i></div>
           {readOnly ? (
             <span className="bg-transparent text-[11px] font-black uppercase tracking-widest text-black px-2 py-1">
               {cluster} Cluster
             </span>
           ) : (
             <select 
               value={cluster} 
               onChange={handleClusterChange}
               className="bg-transparent text-[11px] font-black uppercase tracking-widest text-black outline-none cursor-pointer pr-4"
             >
               {Object.keys(CLUSTER_COORDINATES).map(c => (
                 <option key={c} value={c}>{c} Cluster</option>
               ))}
             </select>
           )}
        </div>
      </div>

      <div className="relative group mt-8 pb-8">
        <div className="overflow-hidden rounded-[2.5rem]">
          <div 
             className="transition-transform duration-700 ease-in-out flex items-stretch" 
             style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {/* Slide 1: Current Conditions Card */}
            <div className="w-full shrink-0 px-2">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 rounded-[2.5rem] p-10 text-white shadow-2xl relative overflow-hidden h-full">
                 <div className="absolute top-0 right-0 p-8 opacity-10"><i className={`fas ${currentDesc.icon} text-9xl`}></i></div>
                 <div className="relative z-10">
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[9px] font-black uppercase tracking-widest">Now</span>
                    <div className="mt-6">
                       <h1 className="text-6xl font-black tracking-tighter">{weather.current_weather.temperature}°</h1>
                       <p className="text-lg font-bold opacity-90 mt-2 flex items-center gap-2"><i className={`fas ${currentDesc.icon}`}></i> {currentDesc.label}</p>
                    </div>
                    <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 gap-4">
                       <div>
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Wind</p>
                          <p className="text-xl font-bold">{weather.current_weather.windspeed} <span className="text-xs">km/h</span></p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black uppercase tracking-widest opacity-60">Rain Prob.</p>
                          <p className="text-xl font-bold">{todayPrecip}%</p>
                       </div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Slide 2: Advisory Card */}
            <div className="w-full shrink-0 px-2">
              <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl flex flex-col justify-center relative overflow-hidden h-full">
                 <div className="absolute top-0 left-0 w-2 h-full bg-green-500"></div>
                 <div className="mb-6 w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center"><i className="fas fa-leaf text-xl"></i></div>
                 <h4 className="text-lg font-black text-black uppercase tracking-tight mb-4">Farmer's Advisory</h4>
                 <p className="text-sm font-medium text-slate-600 leading-relaxed italic">"{advice}"</p>
                 <div className="mt-auto pt-6">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Source: Open-Meteo Analysis</p>
                 </div>
              </div>
            </div>

            {/* Slide 3: 3-Day Lookahead (Compact) */}
            <div className="w-full shrink-0 px-2">
              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl flex flex-col justify-between h-full">
                 <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">Upcoming Trend</h4>
                 <div className="space-y-6">
                    {[1, 2, 3].map(i => {
                       const desc = getWeatherDescription(weather.daily.weathercode[i]);
                       const date = new Date(weather.daily.time[i]).toLocaleDateString('en-US', { weekday: 'short' });
                       return (
                         <div key={i} className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                               <span className="text-xs font-black uppercase w-8 text-slate-500">{date}</span>
                               <i className={`fas ${desc.icon} ${desc.color} w-6 text-center`}></i>
                            </div>
                            <div className="flex gap-4 text-xs font-bold">
                               <span className="text-blue-400">{weather.daily.precipitation_probability_max[i]}% Rain</span>
                               <span>{weather.daily.temperature_2m_max[i]}° / <span className="text-slate-500">{weather.daily.temperature_2m_min[i]}°</span></span>
                            </div>
                         </div>
                       );
                    })}
                 </div>
              </div>
            </div>

            {/* Slide 4: Full 7-Day Forecast Table */}
            <div className="w-full shrink-0 px-2">
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden p-8 h-full">
                 <h4 className="text-sm font-black text-black uppercase tracking-widest mb-6 ml-2">7-Day Planning Forecast</h4>
                 <div className="overflow-x-auto">
                    <div className="flex justify-between min-w-[600px] gap-2">
                       {weather.daily.time.map((time, i) => {
                          const desc = getWeatherDescription(weather.daily.weathercode[i]);
                          const date = new Date(time);
                          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                          const dayNum = date.getDate();
                          const isToday = i === 0;

                          return (
                            <div key={i} className={`flex-1 p-4 rounded-3xl flex flex-col items-center text-center gap-3 transition-all hover:bg-slate-50 ${isToday ? 'bg-slate-50 border border-slate-100 ring-1 ring-slate-200' : ''}`}>
                               <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">{dayName} {dayNum}</p>
                               <i className={`fas ${desc.icon} text-2xl my-2 ${desc.color}`}></i>
                               <p className="text-sm font-black text-black">{weather.daily.temperature_2m_max[i]}°</p>
                               <div className="text-[9px] font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-full">
                                  {weather.daily.precipitation_probability_max[i]}%
                               </div>
                            </div>
                          );
                       })}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Indicators */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {Array.from({ length: slidesCount }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlide(idx)}
              className={`w-2 h-2 rounded-full transition-all ${idx === currentSlide ? 'bg-blue-500 w-8' : 'bg-slate-300 hover:bg-slate-400'}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default WeatherWidget;
