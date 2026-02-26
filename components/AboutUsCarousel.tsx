import React, { useState, useEffect } from 'react';
import { ABOUT_US_DATA } from '../constants';

const AboutUsCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % ABOUT_US_DATA.length);
    }, 8000); // Change every 8 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-slate-900 text-white rounded-[3rem] p-10 md:p-16 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 p-12 opacity-5">
        <i className="fas fa-leaf text-9xl"></i>
      </div>
      
      <div className="relative z-10">
        <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-green-400 mb-6 flex items-center gap-3">
          <i className="fas fa-info-circle"></i> About KPL Food Coop
        </h3>
        
        <div className="min-h-[200px] flex flex-col justify-center">
          <div className="transition-opacity duration-500 ease-in-out">
            <h4 className="text-2xl md:text-3xl font-black uppercase tracking-tight mb-4">
              {ABOUT_US_DATA[currentIndex].title}
            </h4>
            <div className="text-slate-300 font-medium leading-relaxed max-w-3xl text-sm md:text-base whitespace-pre-line">
              {ABOUT_US_DATA[currentIndex].content.length > 300 
                ? ABOUT_US_DATA[currentIndex].content.substring(0, 300) + '...' 
                : ABOUT_US_DATA[currentIndex].content}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-8">
          {ABOUT_US_DATA.map((_: any, idx: number) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-8 bg-green-500' : 'w-2 bg-slate-700 hover:bg-slate-500'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AboutUsCarousel;
