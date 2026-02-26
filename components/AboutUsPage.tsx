import React, { useState, useEffect } from 'react';
import { ABOUT_US_DATA } from '../constants';

const AboutUsPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    return section && ABOUT_US_DATA.some(s => s.id === section) ? section : ABOUT_US_DATA[0].id;
  });

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (section && ABOUT_US_DATA.some(s => s.id === section)) {
        setActiveSection(section);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSectionClick = (id: string) => {
    setActiveSection(id);
    const params = new URLSearchParams(window.location.search);
    params.set('section', id);
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString() + window.location.hash);
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 max-w-6xl mx-auto flex flex-col md:flex-row gap-12">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-1/3 border-r border-slate-100 pr-0 md:pr-8">
          <h2 className="text-3xl font-black uppercase tracking-tight text-black mb-8">About Us</h2>
          <nav className="flex flex-col gap-2">
            {ABOUT_US_DATA.map((section: any) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className={`text-left px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeSection === section.id
                    ? 'bg-black text-white shadow-lg scale-105'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-black'
                }`}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="w-full md:w-2/3">
          {ABOUT_US_DATA.map((section: any) => (
            activeSection === section.id && (
              <div key={section.id} className="animate-in fade-in slide-in-from-right-4 duration-300">
                <h3 className="text-3xl font-black uppercase tracking-tight text-green-600 mb-6 border-b border-slate-100 pb-4">
                  {section.title}
                </h3>
                <div className="text-slate-600 font-medium leading-relaxed space-y-4 whitespace-pre-line text-lg">
                  {section.content}
                </div>
              </div>
            )
          ))}
        </div>

      </div>
    </div>
  );
};

export default AboutUsPage;
