import React, { useState, useEffect } from 'react';
import { ABOUT_US_DATA } from '../constants';
import { Page } from '../types';
import { fetchPages } from '../services/supabaseService';

const AboutUsCarousel: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pages, setPages] = useState<Page[]>([]);

  useEffect(() => {
    const loadPages = async () => {
      const fetchedPages = await fetchPages();
      if (fetchedPages.length > 0) {
        setPages(fetchedPages);
      } else {
        setPages(ABOUT_US_DATA.map((item, index) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          orderIndex: index
        })));
      }
    };
    loadPages();
  }, []);

  useEffect(() => {
    if (pages.length === 0) return;
    const currentItem = pages[currentIndex];
    const isLongContent = currentItem.content.length > 300;
    const delay = isLongContent ? 15000 : 8000; // 15 seconds for long, 8 seconds for short

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % pages.length);
    }, delay);

    return () => clearTimeout(timer);
  }, [currentIndex, pages]);

  const handleReadMore = (id: string) => {
    const params = new URLSearchParams(window.location.search);
    params.set('section', id);
    window.history.pushState(null, '', '/about?' + params.toString());
    // Dispatch popstate event to trigger routing update in App.tsx
    window.dispatchEvent(new Event('popstate'));
  };

  if (pages.length === 0) return null;

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
              {pages[currentIndex].title}
            </h4>
            <div className="text-slate-300 font-medium leading-relaxed max-w-3xl text-sm md:text-base whitespace-pre-line">
              {pages[currentIndex].content.length > 300 
                ? pages[currentIndex].content.substring(0, 300) + '...' 
                : pages[currentIndex].content}
              {pages[currentIndex].content.length > 300 && (
                <button 
                  onClick={() => handleReadMore(pages[currentIndex].id)}
                  className="ml-2 text-green-400 hover:text-green-300 font-bold underline decoration-2 underline-offset-4"
                >
                  Read more
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-8">
          {pages.map((_: any, idx: number) => (
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
