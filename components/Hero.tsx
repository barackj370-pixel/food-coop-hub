import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Smartphone, Globe, Cpu, PenTool, Share2, Search, Edit3, ArrowRight } from 'lucide-react';

const slides = [
  {
    id: 'services',
    title: 'Our Core Services',
    subtitle: 'Architecting the Digital Future',
    bgOrb: 'bg-indigo-200/40',
    items: [
      {
        title: 'Custom App Development',
        description: 'Bespoke, high-performance mobile and web applications.',
        icon: <Smartphone className="w-8 h-8 text-indigo-500" />
      },
      {
        title: 'Enterprise Web Platforms',
        description: 'Robust, secure, and scalable enterprise platforms.',
        icon: <Globe className="w-8 h-8 text-blue-500" />
      },
      {
        title: 'AI Integration',
        description: 'Automate workflows and gain predictive insights.',
        icon: <Cpu className="w-8 h-8 text-purple-500" />
      }
    ]
  },
  {
    id: 'ai-tools',
    title: 'AI Marketing Tools',
    subtitle: 'Next-Gen Growth Engine',
    bgOrb: 'bg-pink-200/40',
    items: [
      {
        title: 'High-End Logo Generator',
        description: 'Professional, high-quality logos generated in seconds.',
        icon: <PenTool className="w-8 h-8 text-pink-500" />
      },
      {
        title: 'Social Media AI Master',
        description: 'Schedule posts and generate viral captions effortlessly.',
        icon: <Share2 className="w-8 h-8 text-rose-500" />
      },
      {
        title: 'SEO Keyword Generator',
        description: 'Discover untapped keywords to outrank competitors.',
        icon: <Search className="w-8 h-8 text-emerald-500" />
      },
      {
        title: 'SEO Content Writer',
        description: 'Generate high-converting, SEO-optimized copy.',
        icon: <Edit3 className="w-8 h-8 text-amber-500" />
      }
    ]
  }
];

const Hero: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000); // 8 seconds per slide to allow reading
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="relative pt-24 pb-12 lg:pt-32 lg:pb-16 overflow-hidden min-h-[75vh] flex items-center">
      {/* Background Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10 overflow-hidden">
        <AnimatePresence mode="popLayout">
          <motion.div
            key={slides[currentSlide].id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className={`absolute top-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full blur-3xl animate-blob ${slides[currentSlide].bgOrb}`}
          />
        </AnimatePresence>
        <div className="absolute bottom-[10%] right-[-10%] w-[500px] h-[500px] bg-slate-200/40 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center space-x-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="text-indigo-700 text-sm font-semibold tracking-wide uppercase">Global Innovation Hub</span>
          </div>
        </div>

        <div className="relative w-full overflow-hidden rounded-3xl bg-white/40 backdrop-blur-md border border-white/60 shadow-xl">
          <motion.div 
            className="flex"
            animate={{ x: `-${currentSlide * 100}%` }}
            transition={{ duration: 0.8, ease: [0.32, 0.72, 0, 1] }}
          >
            {slides.map((slide) => (
              <div key={slide.id} className="w-full flex-shrink-0 p-8 md:p-12">
                <div className="text-center mb-10">
                  <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-4">
                    {slide.subtitle}
                  </h2>
                  <p className="text-xl text-indigo-600 font-semibold uppercase tracking-wider">
                    {slide.title}
                  </p>
                </div>

                <div className={`grid gap-6 ${slide.items.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
                  {slide.items.map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: currentSlide === slides.indexOf(slide) ? 1 : 0, y: currentSlide === slides.indexOf(slide) ? 0 : 20 }}
                      transition={{ duration: 0.5, delay: 0.2 + (idx * 0.1) }}
                      className="bg-white/80 p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow"
                    >
                      <div className="mb-4 inline-block p-3 bg-slate-50 rounded-xl">
                        {item.icon}
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 mb-2">{item.title}</h3>
                      <p className="text-slate-600 text-sm leading-relaxed">{item.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between mt-8 px-4">
          <div className="flex space-x-3 mb-6 sm:mb-0">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`h-2 rounded-full transition-all duration-500 ${
                  currentSlide === index ? 'w-12 bg-indigo-600' : 'w-4 bg-slate-300 hover:bg-slate-400'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
          
          <div className="flex space-x-4">
            <a href="#contact" className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center group">
              Start Project
              <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
