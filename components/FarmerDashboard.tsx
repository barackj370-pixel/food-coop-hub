import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { AgentIdentity } from '../types';
import { motion } from 'motion/react';
import { database } from '../src/db';
import { Q } from '@nozbe/watermelondb';
import Markdown from 'react-markdown';

import { generateAgroecologyProfile } from '../services/geminiService';

interface FarmerDashboardProps {
  agentIdentity: AgentIdentity;
  farmFormsData: any[];
  dynamicClusters: string[];
  onIdentityUpdate?: (identity: AgentIdentity) => void;
}

const FarmerDashboard: React.FC<FarmerDashboardProps> = ({ agentIdentity, farmFormsData, dynamicClusters, onIdentityUpdate }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [farmProfiles, setFarmProfiles] = useState<any[]>([]);
  const [localActivityLogs, setLocalActivityLogs] = useState<any[]>([]);
  const [newFarmName, setNewFarmName] = useState('');
  const [newFarmAcres, setNewFarmAcres] = useState('');
  const [viewingHomestead, setViewingHomestead] = useState(false);
  const getLatestIdentity = () => {
    try {
      const saved = localStorage.getItem('agent_session');
      return saved ? JSON.parse(saved) : agentIdentity;
    } catch {
      return agentIdentity;
    }
  };
  const currentIdentity = getLatestIdentity();
  
  const [homesteadName, setHomesteadName] = useState(currentIdentity?.homesteadName || '');
  const [homesteadContact, setHomesteadContact] = useState('');
  const [selectedCoop, setSelectedCoop] = useState(currentIdentity?.cluster || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch from Local WatermelonDB
        const localFarms = await database.get('farm_baselines')
          .query(Q.where('farmer_phone', currentIdentity.phone))
          .fetch();
        
        if (localFarms.length > 0) {
          setFarmProfiles(localFarms.map((b: any) => ({
            farmId: b.id,
            farmName: b.farmName,
            location: { lat: b.latitude, lng: b.longitude },
            verifiedAt: b.verifiedAt,
            cluster: b.cluster,
            aiProfile: b.aiProfile
          })));
        } else {
          // Fallback to Supabase if local is empty (initial load after reinstall)
          const { data: baselines } = await supabase
            .from('farm_baselines')
            .select('*')
            .eq('farmer_phone', currentIdentity.phone);
          
          if (baselines) {
            // Seed local database
            await database.write(async () => {
              for (const b of baselines) {
                await database.get('farm_baselines').create((row: any) => {
                  row.farmerPhone = b.farmer_phone;
                  row.farmerName = b.farmer_name;
                  row.farmName = b.farm_name;
                  row.cluster = b.cluster;
                  row.latitude = b.latitude;
                  row.longitude = b.longitude;
                  row.verifiedAt = b.verified_at;
                  row.isSynced = true;
                  row.aiProfile = b.ai_profile;
                });
              }
            });

            setFarmProfiles(baselines.map(b => ({
              farmId: b.id,
              farmName: b.farm_name,
              location: { lat: b.latitude, lng: b.longitude },
              verifiedAt: b.verified_at,
              cluster: b.cluster,
              aiProfile: b.ai_profile
            })));
          }
        }

        // Fetch Local Activity Logs from WatermelonDB
        const activityLogs = await database.get('activity_logs')
          .query(Q.where('farmer_phone', currentIdentity.phone))
          .fetch();
        
        const decodedLogs = activityLogs.map((log: any) => ({
          ...JSON.parse(log.data),
          id: log.id,
          isSynced: log.isSynced,
          submittedAt: log.submittedAt,
          formType: log.formType
        })).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
        
        setLocalActivityLogs(decodedLogs);

      } catch (err) {
        console.error("Local DB fetch failed:", err);
      }
      setLoading(false);
    };
    fetchData();
  }, [currentIdentity.phone]);

  const handleSetHomestead = () => {
    if (!homesteadName.trim()) {
      alert('Please enter your Homestead/Household Name');
      return;
    }
    // Persist to agent identity
    const updatedIdentity = { ...currentIdentity, homesteadName, cluster: selectedCoop, phone: homesteadContact || currentIdentity.phone };
    localStorage.setItem('agent_session', JSON.stringify(updatedIdentity)); // Update in localStorage
    if (onIdentityUpdate) onIdentityUpdate(updatedIdentity);
  };

  const handleRegisterFarm = async () => {
    if (!newFarmName.trim()) {
      alert('Please give this farm/plot a name (e.g. Main Farm, River Plot)');
      return;
    }
    setIsRegistering(true);
    try {
      console.log("Attempting GPS capture...");
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            console.log("GPS Success:", pos.coords);
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          (err) => {
            console.error("GPS Failure:", err);
            reject(new Error(`GPS_FAILED: ${err.message}`));
          },
          { timeout: 30000, enableHighAccuracy: true, maximumAge: 0 }
        );
      });

      const farmId = `farm_baseline_${currentIdentity.phone}_${newFarmName.replace(/\s+/g, '_').toLowerCase()}`;
      
      console.log("Generating Agroecology AI Profile...");
      const aiProfile = await generateAgroecologyProfile(homesteadName, newFarmName, location.lat, location.lng);
      
      // Save to WatermelonDB (Offline First)
      let localRecord: any;
      const acresFloat = parseFloat(newFarmAcres) || 0;
      await database.write(async () => {
        localRecord = await database.get('farm_baselines').create((row: any) => {
          row.farmerPhone = currentIdentity.phone;
          row.farmerName = currentIdentity.name;
          row.farmName = `${homesteadName} - ${newFarmName}`;
          row.cluster = currentIdentity.cluster;
          row.latitude = location.lat;
          row.longitude = location.lng;
          row.sizeInAcres = acresFloat;
          row.verifiedAt = new Date().toISOString();
          row.isSynced = false;
          row.aiProfile = aiProfile;
        });
      });

      // Attempt Sync to Supabase
      const payload = {
        id: farmId,
        farmer_phone: currentIdentity.phone,
        farmer_name: currentIdentity.name,
        farm_name: `${homesteadName} - ${newFarmName}`,
        cluster: currentIdentity.cluster,
        latitude: location.lat,
        longitude: location.lng,
        size_in_acres: acresFloat,
        verified_at: localRecord.verifiedAt
      };

      try {
        const { error } = await supabase.from('farm_baselines').upsert(payload);
        if (!error) {
          // Store aiProfile in pages table to avoid missing column in farm_baselines
          await supabase.from('pages').upsert({
             id: `ai_profile_${farmId}`,
             title: `AI Profile - ${homesteadName} - ${newFarmName}`,
             content: aiProfile
          });
          
          await database.write(async () => {
            await localRecord.update((row: any) => row.isSynced = true);
          });
        }
      } catch (syncErr) {
        console.warn("Cloud sync failed, will retry later:", syncErr);
      }

      setFarmProfiles(prev => [...prev, {
        farmId: localRecord.id,
        farmName: `${homesteadName} - ${newFarmName}`,
        location,
        verifiedAt: localRecord.verifiedAt,
        cluster: currentIdentity.cluster,
        aiProfile
      }]);
      setNewFarmName('');
      alert(`Homestead Registered!\n\nHomestead: ${homesteadName}\nPlot: ${newFarmName}\nOwner: ${currentIdentity?.name || 'Unknown'}\nCooperative: ${currentIdentity?.cluster || 'General'}\n\nVerified GPS captured successfully.`);
    } catch (err: any) {
      console.error("Plot Registration Failed:", err);
      alert(`Registration failed: ${err.message}`);
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
    </div>
  );

  // Merge local logs with props logs for redundant safety, avoiding duplicates by timestamp
  const displayLogs = [...localActivityLogs];
  farmFormsData.filter(f => f.farmerPhone === currentIdentity.phone).forEach(propLog => {
    if (!displayLogs.find(l => l.submittedAt === propLog.submittedAt)) {
      displayLogs.push(propLog);
    }
  });
  displayLogs.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  if (!currentIdentity.homesteadName) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20 mt-12 animate-in fade-in duration-300">
        <div className="bg-white p-12 rounded-[2.5rem] shadow-xl border border-emerald-100 flex flex-col items-center text-center">
          <i className="fas fa-home text-7xl text-emerald-500 mb-6"></i>
          <h2 className="text-3xl font-black text-slate-900 mb-4">Welcome to Farm Dashboard</h2>
          <p className="text-slate-500 mb-8 max-w-xl">You must register your homestead/household first before adding your individual farming lands or plots.</p>
          
          <div className="w-full max-w-md space-y-4">
            <div className="text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 bg-white px-2">Homestead Name</label>
              <input 
                type="text" 
                value={homesteadName}
                onChange={e => setHomesteadName(e.target.value)}
                placeholder="Give your homestead a name"
                className="w-full mt-2 bg-slate-50/50 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 outline-none focus:bg-white focus:border-emerald-400 transition-all"
              />
            </div>
            <button 
              onClick={handleSetHomestead}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-xl font-black text-[12px] uppercase tracking-widest transition-colors w-full shadow-md hover:shadow-lg"
            >
              Add Homestead
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!viewingHomestead) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 pb-20 mt-12 animate-in fade-in duration-300">
        <h2 className="text-3xl font-black text-slate-900 mb-6">Farm Dashboard</h2>
        <p className="text-slate-500 mb-6 font-bold">Select your homestead to manage farming lands and view data.</p>
        <button 
          onClick={() => setViewingHomestead(true)}
          className="w-full bg-white border-2 border-emerald-500 rounded-[2rem] p-8 text-left hover:bg-emerald-50 transition-all flex items-start gap-4 shadow-sm hover:shadow-md"
        >
          <div className="bg-emerald-100 text-emerald-800 p-4 rounded-full mt-1">
            <i className="fas fa-home text-3xl"></i>
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-900">{currentIdentity.homesteadName}</h3>
            <p className="text-slate-500 font-bold text-sm mt-2">
              Manage your farming lands, add plots, register GPS coordinates, and access your soil agroecology profile.
            </p>
            <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              <i className="fas fa-arrow-right"></i> Open Homestead Dashboard
            </div>
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header Profile */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewingHomestead(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
              <i className="fas fa-arrow-left"></i>
            </button>
            <div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-1.5 rounded-full mb-2 inline-block">
                Welcome to {currentIdentity.homesteadName}
              </span>
              <h1 className="text-3xl font-black text-slate-900 leading-none mb-2">Homestead Dashboard</h1>
              <p className="text-slate-500 font-bold flex items-center gap-2">
                <i className="fas fa-store"></i> Food Coop: {currentIdentity.cluster}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full md:auto">
            <div className="w-full flex gap-2">
              <input 
                type="text" 
                value={newFarmName}
                onChange={(e) => setNewFarmName(e.target.value)}
                placeholder="Plot Name (e.g. River Plot)"
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-emerald-400"
              />
              <input 
                type="number" 
                value={newFarmAcres}
                onChange={(e) => setNewFarmAcres(e.target.value)}
                placeholder="Size (Acres)"
                className="w-28 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:border-emerald-400"
              />
              <button 
                onClick={handleRegisterFarm}
                disabled={isRegistering}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl shadow-lg transition-all disabled:opacity-50 whitespace-nowrap"
              >
                {isRegistering ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-plus"></i>}
                <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Register Plot</span>
              </button>
            </div>
            <p className="text-[10px] font-bold text-slate-400 italic mt-1">Stand on your plot to register accurate GPS. Acrage helps verify future submissions.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Farm List */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
            <i className="fas fa-map-marked-alt text-emerald-600"></i> My Registered Plots ({farmProfiles.length})
          </h2>
          {farmProfiles.length > 0 ? farmProfiles.map((plot, idx) => (
            <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-black text-slate-900">{plot.farmName}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verified: {new Date(plot.verifiedAt).toLocaleDateString()}</p>
                </div>
                <div className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">Active Baseline</div>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Lat</p>
                  <p className="text-xs font-mono font-bold text-slate-700">{plot.location.lat.toFixed(5)}</p>
                </div>
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[9px] font-black text-slate-400 uppercase">Lng</p>
                  <p className="text-xs font-mono font-bold text-slate-700">{plot.location.lng.toFixed(5)}</p>
                </div>
              </div>
              <button 
                onClick={async () => {
                  if (plot.aiProfile) {
                    setViewingProfile(plot.aiProfile);
                  } else {
                    setViewingProfile('loading');
                    const { data } = await supabase.from('pages').select('content').eq('id', `ai_profile_${plot.farmId}`).maybeSingle();
                    if (data && data.content) {
                      setViewingProfile(data.content);
                    } else {
                      setViewingProfile("Agroecology Profile is currently unavailable for this plot. Ensure you have synced your data or internet connection.");
                    }
                  }
                }}
                className="w-full bg-slate-900 text-white font-bold text-[10px] py-3 rounded-xl uppercase tracking-widest hover:bg-slate-800 transition-colors shadow flex items-center justify-center gap-2 mt-2"
              >
                <i className="fas fa-leaf text-emerald-400"></i> View Agroecology Profile
              </button>
            </div>
          )) : (
            <div className="bg-white p-12 rounded-[2.5rem] border-2 border-dashed border-slate-200 text-center">
              <i className="fas fa-map-signs text-slate-200 text-5xl mb-4"></i>
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No plots registered yet.</p>
            </div>
          )}
        </div>

        {/* Activity Summary */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
            <i className="fas fa-history text-emerald-600"></i> Local Activity Logs
          </h2>
          <p className="text-[10px] text-slate-400 font-bold mb-4 uppercase tracking-wider">
            This history displays your recent weekly activity reports and solidarity mission logs recorded under your profile.
          </p>
          <div className="bg-white p-2 rounded-[2.5rem] shadow-xl border border-slate-200 max-h-[600px] overflow-y-auto">
            {displayLogs.length > 0 ? (
              displayLogs.map((form, idx) => (
                  <div key={idx} className="p-6 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-all rounded-2xl">
                    <div className="flex justify-between items-start mb-2">
                       <div className="flex flex-col gap-1">
                         <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full uppercase tracking-tighter self-start">
                          Homestead: {form.homesteadName || form.farmName || 'General Plot'}
                         </span>
                         <div className="flex items-center gap-2">
                           <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                             <i className="fas fa-store text-emerald-600"></i> Coop: {form.foodCoop || form.agentCluster}
                           </span>
                           {form.isSynced === false && (
                             <span className="text-[8px] font-black text-red-500 uppercase flex items-center gap-1">
                               <i className="fas fa-cloud-upload-alt"></i> Pending Sync
                             </span>
                           )}
                         </div>
                       </div>
                       <span className="text-[10px] font-bold text-slate-400">{new Date(form.submittedAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-xs font-black text-slate-800 mb-2 py-1 px-3 bg-slate-50 rounded-lg inline-block">
                      {form.formType === 'weekly' ? 'Weekly Update' : 'Solidarity Work'}
                    </p>
                    <div className="space-y-2 mt-2">
                      <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Activities & Work Log</p>
                        <p className="text-[11px] text-slate-700 font-bold leading-relaxed">
                          {form.weeklyActivities || (form.workDone && form.workDone.join(', ')) || 'No detailed log.'}
                        </p>
                      </div>
                      
                      {form.soilTypes && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Soil Type:</span>
                          <span className="text-[10px] font-bold text-emerald-700">{form.soilTypes}</span>
                        </div>
                      )}
                      
                      {form.cropsGrown && (
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase">Crops:</span>
                          <span className="text-[10px] font-bold text-slate-600">{form.cropsGrown}</span>
                        </div>
                      )}

                      {form.challengesFaced && (
                        <div className="bg-red-50/50 p-2 rounded-lg border border-red-100/50">
                           <p className="text-[9px] font-black text-red-600 uppercase mb-0.5">Challenges</p>
                           <p className="text-[10px] text-slate-600 font-medium italic">{form.challengesFaced}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center py-20">
                <i className="fas fa-clipboard-list text-slate-100 text-6xl mb-4"></i>
                <p className="text-slate-300 font-black uppercase text-xs">No activity logs found</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Guidance */}
      <div className="bg-emerald-50 p-8 rounded-[2.5rem] border border-emerald-100">
        <h3 className="text-xl font-black text-emerald-900 mb-4 uppercase tracking-tight">Your Agroecology Journey</h3>
        <p className="text-emerald-800 text-sm font-bold leading-relaxed mb-6">
          By registering your baseline coordinates, you enable the Agroecology AI Engine to cross-reference satellite data with your on-ground soil reports. 
          This ensures we provide the most accurate organic input advice specifically for your micro-climate.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200/50">
            <i className="fas fa-satellite-dish text-emerald-600 mb-4 text-xl"></i>
            <h4 className="font-black text-xs uppercase mb-2">Step 1</h4>
            <p className="text-[11px] text-slate-600 font-bold">Register farm baseline once while on-site.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200/50">
            <i className="fas fa-edit text-emerald-600 mb-4 text-xl"></i>
            <h4 className="font-black text-xs uppercase mb-2">Step 2</h4>
            <p className="text-[11px] text-slate-600 font-bold">Submit Weekly logs even if you are at the coop.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200/50">
            <i className="fas fa-chart-line text-emerald-600 mb-4 text-xl"></i>
            <h4 className="font-black text-xs uppercase mb-2">Step 3</h4>
            <p className="text-[11px] text-slate-600 font-bold">Receive AI soil health and market advice.</p>
          </div>
        </div>
      </div>
      {viewingProfile && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white max-w-2xl w-full rounded-[2.5rem] shadow-2xl my-8 overflow-hidden flex flex-col">
            <div className="bg-emerald-600 p-6 flex justify-between items-center text-white shrink-0">
               <h3 className="font-black text-xl flex items-center gap-2"><i className="fas fa-leaf"></i> Agroecology Profile</h3>
               <button onClick={() => setViewingProfile(null)} className="w-10 h-10 rounded-full hover:bg-white/20 transition-colors flex items-center justify-center"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="p-8 pb-12 markdown-body text-slate-800 space-y-4 overflow-y-auto max-h-[70vh]">
               {viewingProfile === 'loading' ? (
                 <div className="flex flex-col items-center justify-center py-20">
                   <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600 mb-4"></div>
                   <p className="font-bold text-slate-600 text-sm">Generating Profile with AI...</p>
                 </div>
               ) : (
                 <Markdown>{viewingProfile}</Markdown>
               )}
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-4 shrink-0">
               <button onClick={() => window.print()} className="px-6 py-3 bg-white text-slate-800 border border-slate-200 rounded-xl font-bold uppercase tracking-widest text-xs hover:text-black hover:border-slate-400 shadow-sm transition-all flex items-center gap-2"><i className="fas fa-file-pdf"></i> Download PDF</button>
               <button onClick={() => setViewingProfile(null)} className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors">Close Profile</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarmerDashboard;
