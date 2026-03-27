import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Sparkles, PenTool, Search, Share2, ArrowRight, Video } from 'lucide-react';

const tools = [
  {
    id: 'ai-video',
    title: 'AI Video Generator',
    description: 'Create engaging TikTok and social media videos instantly. Upload your own clips or let AI generate stylish captions and visuals.',
    icon: <Video className="w-8 h-8 text-pink-500" />,
    color: 'bg-pink-50 border-pink-100',
    link: '/tools'
  },
  {
    id: 'ai-logo',
    title: 'AI Logo Designer',
    description: 'Describe your brand vision and get a professional, high-quality logo generated in seconds.',
    icon: <PenTool className="w-8 h-8 text-indigo-500" />,
    color: 'bg-indigo-50 border-indigo-100',
    link: '/tools/logo-designer'
  },
  {
    id: 'ai-content',
    title: 'Smart Content Generator',
    description: 'Generate high-converting blog posts, ad copy, and product descriptions tailored to your brand voice.',
    icon: <Sparkles className="w-8 h-8 text-amber-500" />,
    color: 'bg-amber-50 border-amber-100',
    link: '/tools/content-generator'
  },
  {
    id: 'ai-seo',
    title: 'SEO Keyword Strategist',
    description: 'Discover untapped keywords and generate comprehensive SEO strategies to outrank your competitors.',
    icon: <Search className="w-8 h-8 text-emerald-500" />,
    color: 'bg-emerald-50 border-emerald-100',
    link: '/tools/keyword-generator'
  },
  {
    id: 'ai-social',
    title: 'Automated Social Media',
    description: 'Schedule posts, generate viral captions, and analyze engagement across all your social platforms.',
    icon: <Share2 className="w-8 h-8 text-blue-500" />,
    color: 'bg-blue-50 border-blue-100',
    link: '/tools/social-media'
  }
];

const AIMarketingTools: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % tools.length);
    }, 5000); // 5 seconds per slide
    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-24 bg-slate-900 text-white overflow-hidden relative">
      {/* Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -right-[10%] w-[70%] h-[70%] rounded-full bg-indigo-600/20 blur-[120px]"></div>
        <div className="absolute -bottom-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-blue-600/20 blur-[120px]"></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Next-Gen <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">AI Marketing Tools</span>
          </h2>
          <p className="text-slate-400 text-lg max-w-2xl mx-auto">
            Supercharge your marketing efforts with our suite of intelligent tools designed to save time and boost engagement.
          </p>
        </div>

        <div className="relative max-w-4xl mx-auto overflow-hidden rounded-3xl">
          <motion.div 
            className="flex"
            animate={{ x: `-${currentIndex * 100}%` }}
            transition={{ duration: 0.7, ease: [0.32, 0.72, 0, 1] }}
          >
            {tools.map((tool) => (
              <div key={tool.id} className="w-full flex-shrink-0">
                <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 p-8 md:p-12 h-full flex flex-col md:flex-row items-center gap-8 shadow-2xl">
                  <div className={`w-24 h-24 rounded-2xl flex items-center justify-center shrink-0 ${tool.color} bg-opacity-10 border-opacity-20`}>
                    {tool.icon}
                  </div>
                  
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl font-bold mb-4 text-white">
                      {tool.title}
                    </h3>
                    <p className="text-slate-300 text-lg mb-8 leading-relaxed">
                      {tool.description}
                    </p>
                    <Link 
                      to={tool.link}
                      className="inline-flex items-center text-indigo-400 font-semibold hover:text-indigo-300 transition-colors group"
                    >
                      Try this tool 
                      <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Indicators */}
        <div className="flex justify-center space-x-3 mt-12">
          {tools.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`h-2 rounded-full transition-all duration-500 ${
                currentIndex === index ? 'w-12 bg-indigo-500' : 'w-4 bg-slate-700 hover:bg-slate-600'
              }`}
              aria-label={`Go to tool ${index + 1}`}
            />
          ))}
        </div>
        
        <div className="mt-16 text-center">
          <Link to="/tools" className="inline-block px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20">
            View All AI Tools
          </Link>
        </div>
      </div>
    </section>
  );
};

export default AIMarketingTools;
