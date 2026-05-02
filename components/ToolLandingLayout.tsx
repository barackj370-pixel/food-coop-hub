import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import OptinModal from './OptinModal';

interface PricingPlan {
  name: string;
  price: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  ctaText: string;
  ctaLink: string;
}

interface ToolLandingLayoutProps {
  title: string;
  subtitle: string;
  badge: string;
  heroImage?: string;
  appLink: string;
  features: { title: string; description: string; icon: React.ReactNode }[];
  howItWorks: { step: string; title: string; description: string }[];
  pricing: PricingPlan[];
  faq: { question: string; answer: string }[];
}

const ToolLandingLayout: React.FC<ToolLandingLayoutProps> = ({
  title,
  subtitle,
  badge,
  appLink,
  features,
  howItWorks,
  pricing,
  faq
}) => {
  const [isOptinOpen, setIsOptinOpen] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState(appLink);
  const navigate = useNavigate();

  const handleActionClick = (e: React.MouseEvent, targetLink: string) => {
    // If it's an upgrade link, let them pass directly to payment wall
    if (targetLink.includes('upgrade=true')) {
      e.preventDefault();
      navigate(targetLink);
      return;
    }
    
    // Otherwise open Opt-in capture Modal
    e.preventDefault();
    setRedirectTarget(targetLink);
    setIsOptinOpen(true);
  };

  return (
    <div className="bg-slate-50 min-h-screen">
      <OptinModal 
        isOpen={isOptinOpen} 
        onClose={() => setIsOptinOpen(false)} 
        toolName={title}
        redirectUrl={redirectTarget}
      />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        <div className="inline-block bg-indigo-100 text-indigo-700 px-4 py-1.5 rounded-full text-sm font-bold mb-6">
          {badge}
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-8 tracking-tight">
          {title}
        </h1>
        <p className="text-xl text-slate-600 max-w-3xl mx-auto mb-10 leading-relaxed">
          {subtitle}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a 
            href={appLink} 
            onClick={(e) => handleActionClick(e, appLink)}
            className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-xl flex items-center justify-center cursor-pointer"
          >
            Start Using for Free <ArrowRight className="ml-2 w-5 h-5" />
          </a>
          <a href="#pricing" className="bg-white text-slate-900 border border-slate-200 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center">
            View Pricing
          </a>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Everything you need to succeed</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">Powerful features designed to save you time and drive results.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div key={idx} className="p-8 rounded-2xl bg-slate-50 border border-slate-100 hover:shadow-lg transition-all">
                <div className="w-14 h-14 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-6">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto">Get started in three simple steps.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 text-center">
            {howItWorks.map((step, idx) => (
              <div key={idx} className="relative">
                {idx !== 2 && <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-[2px] bg-slate-800"></div>}
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-6 relative z-10">
                  {step.step}
                </div>
                <h3 className="text-xl font-bold mb-3">{step.title}</h3>
                <p className="text-slate-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">Start for free, upgrade when you need more power.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {pricing.map((plan, idx) => (
              <div key={idx} className={`bg-white rounded-3xl p-8 border ${plan.isPopular ? 'border-indigo-600 shadow-2xl relative' : 'border-slate-200 shadow-sm'}`}>
                {plan.isPopular && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-indigo-600 text-white px-4 py-1 rounded-full text-sm font-bold">
                    Most Popular
                  </div>
                )}
                <h3 className="text-2xl font-bold text-slate-900 mb-2">{plan.name}</h3>
                <p className="text-slate-500 mb-6">{plan.description}</p>
                <div className="mb-8">
                  <span className="text-5xl font-extrabold text-slate-900">{plan.price}</span>
                  {plan.price !== 'Free' && <span className="text-slate-500">/month</span>}
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, fIdx) => (
                    <li key={fIdx} className="flex items-start">
                      <CheckCircle2 className="w-6 h-6 text-green-500 mr-3 flex-shrink-0" />
                      <span className="text-slate-700">{feature}</span>
                    </li>
                  ))}
                </ul>
                <a 
                  href={plan.ctaLink}
                  onClick={(e) => handleActionClick(e, plan.ctaLink)} 
                  className={`block w-full py-4 rounded-xl font-bold text-center transition-all cursor-pointer ${plan.isPopular ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
                >
                  {plan.ctaText}
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-8">
            {faq.map((item, idx) => (
              <div key={idx} className="border-b border-slate-100 pb-8">
                <h3 className="text-xl font-bold text-slate-900 mb-3">{item.question}</h3>
                <p className="text-slate-600 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ToolLandingLayout;
