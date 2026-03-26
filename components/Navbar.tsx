
import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isHome = location.pathname === '/';

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${scrolled || !isHome ? 'bg-white/90 backdrop-blur-md shadow-sm py-3' : 'bg-transparent py-5'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <Link to="/" className="flex items-center space-x-2">
            <img src="/logo.png" alt="Onedigispot" className="h-16 w-auto object-contain" />
          </Link>
          
          <div className="hidden md:flex items-center space-x-8">
            {isHome ? (
              <>
                <a href="#services" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Services</a>
                <a href="#projects" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Projects</a>
                <a href="#innovation-lab" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Innovation Lab</a>
              </>
            ) : (
              <Link to="/" className="text-slate-600 hover:text-indigo-600 font-medium transition-colors">Home</Link>
            )}
            <Link to="/tools" className="text-indigo-600 font-bold hover:text-indigo-700 transition-colors flex items-center gap-1">
              <span className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Free AI Tools
            </Link>
            <a href={isHome ? "#contact" : "/#contact"} className="bg-indigo-600 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg">
              Contact Us
            </a>
          </div>
          
          <div className="md:hidden">
            <button className="text-slate-900 focus:outline-none">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
