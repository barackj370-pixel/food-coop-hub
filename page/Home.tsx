import React from 'react';
import Hero from '../components/Hero';
import Services from '../components/Services';
import InnovationLab from '../components/InnovationLab';
import Portfolio from '../components/Portfolio';
import LogoGenerator from '../components/LogoGenerator';

const Home: React.FC = () => {
  return (
    <>
      <Hero />
      <Services />
      <Portfolio />
      <InnovationLab />
      <LogoGenerator />
      
      {/* CTA Section */}
      <section id="contact" className="py-24 bg-indigo-600 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white to-transparent"></div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <h2 className="text-white text-4xl md:text-5xl font-extrabold mb-8">Ready to Build the Future?</h2>
          <p className="text-indigo-100 text-xl max-w-2xl mx-auto mb-12">
            Whether you have a fully scoped project or just a seed of an idea, let's talk about how Onedigispot can bring it to life.
          </p>
          <div className="bg-white p-2 rounded-2xl max-w-xl mx-auto shadow-2xl flex flex-col sm:flex-row gap-2">
            <input 
              type="email" 
              placeholder="Enter your work email" 
              className="flex-1 px-6 py-4 rounded-xl focus:outline-none text-slate-900"
            />
            <button className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold hover:bg-indigo-700 transition-all">
              Book a Consultation
            </button>
          </div>
          <p className="mt-6 text-indigo-200 text-sm">Join 20+ organizations already innovating with us.</p>
        </div>
      </section>
    </>
  );
};

export default Home;
