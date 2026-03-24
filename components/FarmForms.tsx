import React, { useState } from 'react';
import { supabase } from '../services/supabaseClient';

interface FarmFormsProps {
  agentCluster: string;
  dynamicClusters: string[];
}

const FarmForms: React.FC<FarmFormsProps> = ({ agentCluster, dynamicClusters }) => {
  const [activeForm, setActiveForm] = useState<'weekly' | 'solidarity' | 'homestead'>('weekly');
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
            onClick={() => setActiveForm('weekly')}
            className={`px-6 py-3 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all ${activeForm === 'weekly' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            Weekly Farm Activity
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
          {activeForm === 'weekly' && (
            <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-100 mb-6">
              <h3 className="text-sm font-black text-emerald-900 uppercase tracking-widest mb-2">Weekly Farm Activities Capture Form</h3>
              <p className="text-[11px] font-bold text-emerald-700 italic">
                Farm - means Homestead or Household including all the activities like ploughing, weeding etc that goes on in the farm
              </p>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Date of Activity</label>
              <input 
                type="date" 
                required
                defaultValue={new Date().toISOString().split('T')[0]}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Food Coop</label>
              <select 
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all appearance-none"
                defaultValue={agentCluster}
              >
                {dynamicClusters.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {activeForm === 'solidarity' ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Name of Food Coop Production Office</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter production office name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contact of Food Coop Production Office</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter contact number or email"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Type of Work Done</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  {['Ploughing', 'Planting', 'Weeding', 'Harvesting', 'Slashing', 'Washing', 'Sweeping', 'Fetching water', 'Watering crops', 'Feeding animals', 'Other'].map(work => (
                    <label key={work} className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" value={work} className="peer sr-only" />
                        <div className="w-6 h-6 rounded-lg border-2 border-slate-300 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                          <i className="fas fa-check text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{work}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Name of Homestead Visited</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter homestead name"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contact of Homestead Visited</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Enter homestead contact"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Names and Contacts of Participants</label>
                <textarea 
                  rows={5}
                  required
                  placeholder="List the names and contacts of all participants here..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"
                ></textarea>
              </div>
            </div>
          ) : activeForm === 'homestead' ? (
            <div className="space-y-8 animate-in fade-in duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Name of Food Coop Production Officer</label>
                  <input type="text" required placeholder="Enter officer name" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contact of Food Coop Production Officer</label>
                  <input type="text" required placeholder="Enter officer contact" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Name of Homestead Visited</label>
                  <input type="text" required placeholder="Enter homestead name" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Name of Homestead Convener</label>
                  <input type="text" required placeholder="Enter convener name" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Contact of Homestead Convener</label>
                  <input type="text" required placeholder="Enter convener contact" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all" />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Type of Work Done</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                  {['Ploughing', 'Planting', 'Weeding', 'Harvesting', 'Slashing', 'Washing', 'Sweeping', 'Fetching water', 'Watering crops', 'Feeding animals', 'Other'].map(work => (
                    <label key={work} className="flex items-center space-x-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center">
                        <input type="checkbox" value={work} className="peer sr-only" />
                        <div className="w-6 h-6 rounded-lg border-2 border-slate-300 peer-checked:bg-emerald-500 peer-checked:border-emerald-500 transition-all flex items-center justify-center">
                          <i className="fas fa-check text-white text-xs opacity-0 peer-checked:opacity-100 transition-opacity"></i>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900 transition-colors">{work}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Total Number of Participants</label>
                <input type="number" min="1" required placeholder="e.g. 5" className="w-full md:w-1/3 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all" />
              </div>

              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Farm Details</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Types of Soil in Your Farm</label>
                    <textarea rows={3} required placeholder="List soil types..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Source of Water</label>
                    <textarea rows={3} required placeholder="List water sources..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Types of Farm Inputs & Sources</label>
                    <textarea rows={3} required placeholder="List inputs and their sources..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Types of Waste Produced</label>
                    <textarea rows={3} required placeholder="List waste types..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">How do you handle the waste?</label>
                    <textarea rows={3} required placeholder="Describe waste handling..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Products to Supply the Food Coop Market</label>
                    <textarea rows={3} required placeholder="List farm food, processed food, or non-food products..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in duration-300">
              {/* Crops and Livestock Kept */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Crops and Livestock Kept</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Crops grown in my Household or Homestead</label>
                    <textarea rows={3} required placeholder="List crops grown..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Livestock Kept in my Household or Homestead</label>
                    <textarea rows={3} required placeholder="List livestock kept..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                </div>
              </div>

              {/* Weekly Farm Activities and Challenges Faced */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Weekly Farm Activities and Challenges Faced</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">List the weekly farm activities in household or homestead</label>
                    <textarea rows={3} required placeholder="List weekly activities..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">List the challenges faced in conducting the farm activities in household or homestead</label>
                    <textarea rows={3} required placeholder="List challenges faced..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                </div>
              </div>

              {/* Food and None Food Consumption */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Food and None Food Consumption</h3>
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">List the types of Farm Food, Processed Food and None Food Products consumed daily in household or homestead</label>
                    <textarea rows={3} required placeholder="List products consumed daily..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">State the average amount spent on each of types of Farm Food, Processed Food and None Food Products consumed daily in household or homestead</label>
                    <textarea rows={3} required placeholder="State average amount spent..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">State the source of the types of Farm Food, Processed Food and None Food Products consumed daily in household or homestead</label>
                    <textarea rows={3} required placeholder="State source of products..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">List the types of Farm Food, Processed Food and None Food Products consumed daily in household or homestead that you need to be supplied with</label>
                    <textarea rows={3} required placeholder="List products needed for supply..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                </div>
              </div>

              {/* Quantity and Value of Harvested Crops and Livestock Products */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Quantity and Value of Harvested Crops and Livestock Products</h3>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">List the Varieties, Quantities and Value of Harvested Crops and Livestock Products</label>
                  <textarea rows={4} required placeholder="List varieties, quantities and value..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                </div>
              </div>

              {/* Soil Erosion and Conservation */}
              <div className="space-y-6 pt-6 border-t border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-4">Soil Erosion and Conservation</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">List the Type of Soil Erosion Experienced in Household or Homestead</label>
                    <textarea rows={3} required placeholder="List types of soil erosion..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">List the Strategies for Curbing Soil Erosion Experienced in Household or Homestead</label>
                    <textarea rows={3} required placeholder="List strategies for curbing erosion..." className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all resize-none"></textarea>
                  </div>
                </div>
              </div>
            </div>
          )}

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-emerald-600 text-white py-5 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-emerald-700 shadow-xl transition-all disabled:opacity-50 mt-8"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Form'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default FarmForms;
