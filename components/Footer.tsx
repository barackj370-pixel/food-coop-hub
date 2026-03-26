
import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="bg-white border-t border-slate-100 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 lg:col-span-1">
            <div className="flex items-center space-x-2 mb-6">
              <img src="/logo.png" alt="Onedigispot" className="h-12 w-auto" />
            </div>
            <p className="text-slate-500 mb-6 leading-relaxed">
              Kenya's premier digital innovation hub. We craft world-class custom applications and web platforms for global-minded organizations.
            </p>
            <div className="flex space-x-4">
              {['Twitter', 'LinkedIn', 'Github', 'Dribbble'].map((social) => (
                <a key={social} href="#" className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center hover:bg-indigo-600 hover:text-white transition-all text-slate-600">
                  <span className="sr-only">{social}</span>
                  <div className="w-5 h-5 bg-current mask-icon"></div>
                </a>
              ))}
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Services</h4>
            <ul className="space-y-4 text-slate-500">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Custom App Dev</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Web Development</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Digital Strategy</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">UI/UX Design</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Company</h4>
            <ul className="space-y-4 text-slate-500">
              <li><a href="#" className="hover:text-indigo-600 transition-colors">About Onedigispot</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Portfolio</a></li>
              <li><a href="#" className="hover:text-indigo-600 transition-colors">Careers</a></li>
              <li><a href={import.meta.env.VITE_PRIVACY_POLICY_URL || "#"} className="hover:text-indigo-600 transition-colors">Privacy Policy</a></li>
              <li><a href={import.meta.env.VITE_TERMS_OF_SERVICE_URL || "#"} className="hover:text-indigo-600 transition-colors">Terms of Service</a></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Contact</h4>
            <ul className="space-y-4 text-slate-500">
              <li className="flex items-start">
                <span className="mr-3">📍</span>
                Innovation Towers, Waiyaki Way<br />Nairobi, Kenya
              </li>
              <li className="flex items-center">
                <span className="mr-3">📧</span>
                hello@digispot.co.ke
              </li>
              <li className="flex items-center">
                <span className="mr-3">📞</span>
                +254 (0) 700 000 000
              </li>
            </ul>
          </div>
        </div>
        
        <div className="pt-10 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center text-slate-400 text-sm">
          <p>© {new Date().getFullYear()} Onedigispot Digital Innovations Hub. All rights reserved.</p>
          <div className="flex space-x-6 mt-4 md:mt-0">
            <a href={import.meta.env.VITE_TERMS_OF_SERVICE_URL || "#"} className="hover:text-slate-600">Terms</a>
            <a href={import.meta.env.VITE_PRIVACY_POLICY_URL || "#"} className="hover:text-slate-600">Privacy</a>
            <a href="#" className="hover:text-slate-600">Cookies</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
