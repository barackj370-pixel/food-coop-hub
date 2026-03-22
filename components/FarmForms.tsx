import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface FarmFormsProps {
  agentCluster: string;
  dynamicClusters: string[];
}

const FarmForms: React.FC<FarmFormsProps> = ({ agentCluster, dynamicClusters }) => {
  const [activeForm, setActiveForm] = useState<'daily' | 'solidarity' | 'homestead'>('daily');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Placeholder for actual form submission logic
    // We will save this to Supabase once we know the exact fields
    setTimeout(() => {
      alert('Form submitted successfully! (This is a placeholder until we add the exact fields from your Google Forms)');
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">Farm Activity & Solidarity Forms</h2>
        
        <div className="flex flex-wrap gap-4 mb-8">
          <button 
            onClick={() => setActiveForm('daily')}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === 'daily' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Daily Farm Activity
          </button>
          <button 
            onClick={() => setActiveForm('solidarity')}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === 'solidarity' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Labor Solidarity (Form A)
          </button>
          <button 
            onClick={() => setActiveForm('homestead')}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === 'homestead' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Homestead Owner (Form B)
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-6">
            <p className="text-emerald-800 font-medium text-sm">
              <i className="fas fa-info-circle mr-2"></i>
              Please provide the exact fields from your Google Forms so we can build the native inputs here. The Food Coop list is already dynamically linked!
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Food Coop</label>
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all appearance-none"
              defaultValue={agentCluster}
            >
              {dynamicClusters.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Placeholder for actual fields */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date of Activity</label>
            <input 
              type="date" 
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Notes / Description</label>
            <textarea 
              rows={4}
              placeholder="Enter details here..."
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
            ></textarea>
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 shadow-xl transition-all disabled:opacity-50"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Form'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FarmForms;
