import React, { useState, useEffect } from 'react';

interface HeroCarouselProps {
  welcomeCard: React.ReactNode;
  newsArticles: any[];
  onReadNews: (article: any) => void;
}

const HeroCarousel: React.FC<HeroCarouselProps> = ({ welcomeCard, newsArticles, onReadNews }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  // Total slides: 1 (Welcome) + up to 2 News Articles
  const slidesCount = 1 + Math.min(newsArticles.length, 2);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slidesCount);
    }, 8000); // 8 seconds per slide
    return () => clearInterval(timer);
  }, [slidesCount]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative group">
      <div className="overflow-hidden rounded-[3rem] shadow-xl border border-slate-100 bg-white">
        <div 
           className="transition-transform duration-700 ease-in-out flex" 
           style={{ transform: `translateX(-${currentIndex * 100}%)` }}
        >
          {/* Slide 1: Welcome Card */}
          <div className="w-full shrink-0">
             {welcomeCard}
          </div>

          {/* Slide 2 & 3: News Articles */}
          {newsArticles.slice(0, 2).map((article, idx) => (
             <div key={article.id} className="w-full shrink-0 relative bg-white min-h-[400px] flex flex-col md:flex-row">
                <div className="flex-1 p-12 flex flex-col justify-center space-y-6">
                   <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[9px] font-black uppercase tracking-widest">Latest News</span>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{article.date}</span>
                   </div>
                   <h2 className="text-3xl md:text-4xl font-black text-black uppercase leading-tight line-clamp-3">
                      {article.title}
                   </h2>
                   <p className="text-slate-600 font-medium leading-relaxed line-clamp-3">
                      {article.summary}
                   </p>
                   <div>
                     <button 
                       onClick={() => onReadNews(article)} 
                       className="bg-black text-white px-8 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2"
                     >
                        Read Full Story <i className="fas fa-arrow-right"></i>
                     </button>
                   </div>
                </div>
                <div className="flex-1 relative min-h-[250px] md:min-h-full">
                   <img src={article.image} alt={article.title} className="absolute inset-0 w-full h-full object-cover" />
                   <div className="absolute inset-0 bg-gradient-to-r from-white via-transparent to-transparent md:bg-gradient-to-r md:from-white md:via-white/20 md:to-transparent"></div>
                </div>
             </div>
          ))}
        </div>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {Array.from({ length: slidesCount }).map((_, idx) => (
          <button
            key={idx}
            onClick={() => goToSlide(idx)}
            className={`w-2 h-2 rounded-full transition-all ${idx === currentIndex ? 'bg-black w-8' : 'bg-slate-300 hover:bg-slate-400'}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroCarousel;
