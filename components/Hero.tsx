
import React from 'react';

const Hero: React.FC = () => {
  return (
    <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-200/40 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] bg-blue-200/40 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-[20%] right-[10%] w-[400px] h-[400px] bg-purple-200/30 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-8">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          <span className="text-indigo-700 text-sm font-semibold tracking-wide uppercase">Global Innovation Hub</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-8 max-w-4xl mx-auto">
          Architecting the <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-500">Digital Future</span>, Rooted in Africa
        </h1>
        
        <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-12 leading-relaxed">
          Onedigispot is a world-class digital innovation hub, crafting bespoke software solutions, SEO, and AI-powered marketing tools that drive global growth and top-tier digital presence.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-4">
          <a href="#contact" className="w-full sm:w-auto px-8 py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
            Start Your Project
          </a>
          <a href="#services" className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all">
            Explore Services
          </a>
        </div>

        <div className="mt-20 pt-10 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-8">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">50+</span>
            <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Custom Apps</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">120+</span>
            <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Web Platforms</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">10k+</span>
            <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Hours Coded</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-bold text-slate-900">20+</span>
            <span className="text-slate-500 text-sm font-medium uppercase tracking-wider">Global Clients</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
