import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { AgentIdentity } from '../types';
import { motion } from 'motion/react';
import { database } from '../src/db';
import { Q } from '@nozbe/watermelondb';
import Markdown from 'react-markdown';

import { generateAgroecologyProfile, calculateAreaFromCorners } from '../services/geminiService';
import { AgroecologicalCropCalendar } from './AgroecologicalCropCalendar';

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
  const [viewingHomestead, setViewingHomestead] = useState<string | null>(null);

  // Group all homesteads from all users
  const groupedGlobalHomesteads = useMemo(() => {
    const groups: Record<string, any[]> = {};
    farmFormsData
      .filter((f: any) => f.formType === 'homestead')
      .forEach((f: any) => {
        const coop = f.foodCoop || f.agentCluster || 'Unassigned Cooperative';
        if (!groups[coop]) groups[coop] = [];
        
        // Use homesteadName or farmName as key
        const nameKey = f.homesteadName || f.farmName || 'Unknown Homestead';
        
        // Prevent duplicates (prefer baselines over pages if both exist)
        const existingIdx = groups[coop].findIndex(e => 
           (e.homesteadName || e.farmName || 'Unknown') === nameKey
        );
        
        if (existingIdx === -1) {
          groups[coop].push(f);
        } else if (!f.fromPages && groups[coop][existingIdx].fromPages) {
           groups[coop][existingIdx] = f;
        }
      });
    return groups;
  }, [farmFormsData]);

  // Precision 4-Corner Survey States
  const [useCorners, setUseCorners] = useState(false);
  const [cornerA, setCornerA] = useState({ lat: '', lng: '' });
  const [cornerB, setCornerB] = useState({ lat: '', lng: '' });
  const [cornerC, setCornerC] = useState({ lat: '', lng: '' });
  const [cornerD, setCornerD] = useState({ lat: '', lng: '' });
  const [isCapturingCorner, setIsCapturingCorner] = useState<string | null>(null);

  const handleCaptureCorner = (cornerKey: 'A' | 'B' | 'C' | 'D') => {
    setIsCapturingCorner(cornerKey);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const update = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) };
        if (cornerKey === 'A') setCornerA(update);
        else if (cornerKey === 'B') setCornerB(update);
        else if (cornerKey === 'C') setCornerC(update);
        else if (cornerKey === 'D') setCornerD(update);
        setIsCapturingCorner(null);
      },
      (err) => {
        alert(`Error capturing corner GPS: ${err.message}. Ensure location services are enabled.`);
        setIsCapturingCorner(null);
      },
      { timeout: 15000, enableHighAccuracy: true }
    );
  };

  const liveArea = useMemo(() => {
    const latA = parseFloat(cornerA.lat);
    const lngA = parseFloat(cornerA.lng);
    const latB = parseFloat(cornerB.lat);
    const lngB = parseFloat(cornerB.lng);
    const latC = parseFloat(cornerC.lat);
    const lngC = parseFloat(cornerC.lng);
    const latD = parseFloat(cornerD.lat);
    const lngD = parseFloat(cornerD.lng);
    
    // Check if at least A, B, and C are valid for a triangle
    if (!isNaN(latA) && !isNaN(lngA) && !isNaN(latB) && !isNaN(lngB) && !isNaN(latC) && !isNaN(lngC)) {
      const arr = [
        { lat: latA, lng: lngA },
        { lat: latB, lng: lngB },
        { lat: latC, lng: lngC }
      ];
      // If D is valid, add it
      if (!isNaN(latD) && !isNaN(lngD)) {
        arr.push({ lat: latD, lng: lngD });
      }
      return calculateAreaFromCorners(arr);
    }
    return null;
  }, [cornerA, cornerB, cornerC, cornerD]);

  const parsedViewingProfileText = useMemo(() => {
    if (!viewingProfile) return "";
    if (viewingProfile === 'loading') return 'loading';
    
    let content = viewingProfile;
    
    // If it's already an object (e.g. from Supabase jsonb)
    if (typeof content === 'object') {
       if ((content as any).markdown) {
           content = (content as any).markdown;
       } else if ((content as any).error) {
           content = "Agroecology analysis is currently unavailable. Please try again later.";
       } else {
           content = JSON.stringify(content);
       }
    }
    
    if (typeof content === 'string') {
        try {
          const parsed = JSON.parse(content);
          if (parsed && typeof parsed === 'object') {
            if (parsed.markdown) {
              content = parsed.markdown;
            } else if (parsed.error) {
              content = "Agroecology analysis is currently unavailable. Please try again later.";
            }
          }
        } catch {
          // plain text Legacy
        }
    }
    
    if (typeof content === 'string' && (content.includes('PERMISSION_DENIED') || content.includes('API key was reported as leaked'))) {
      content = "Agroecology analysis is currently unavailable. Please try again later.";
    }
    
    return content;
  }, [viewingProfile]);
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

  // Unique Homesteads
  const uniqueHomesteads = useMemo(() => {
    const list = new Set<string>();
    
    // Add current default homestead
    if (currentIdentity.homesteadName) {
      list.add(currentIdentity.homesteadName);
    }
    
    // Add all implicit homesteads from plot names
    farmProfiles.forEach(fp => {
      // If it originated as a pure homestead registration (lat 0, lng 0)
      if (fp.location.lat === 0 && fp.location.lng === 0) {
        list.add(fp.farmName);
      } else {
        const parts = fp.farmName.split(' - ');
        if (parts.length > 1) {
          list.add(parts[0]); // Extrapolate Homestead from Homestead - Plot
        } else {
          list.add(fp.farmName);
        }
      }
    });

    return Array.from(list);
  }, [currentIdentity.homesteadName, farmProfiles]);

  // Ensure we filter plots by the currently viewed homestead context
  const filteredFarmProfiles = useMemo(() => {
    if (!viewingHomestead) return [];
    return farmProfiles.filter(fp => {
      // Exact match for the base registration
      if (fp.farmName === viewingHomestead && fp.location.lat === 0 && fp.location.lng === 0) return false; // Hide the base homestead marker
      return fp.farmName.startsWith(viewingHomestead + ' - ') || fp.farmName === viewingHomestead;
    });
  }, [farmProfiles, viewingHomestead]);

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
      let cornersArray: { lat: number; lng: number }[] | undefined = undefined;
      let acresFloat = parseFloat(newFarmAcres) || 0;

      if (useCorners) {
        const latA = parseFloat(cornerA.lat);
        const lngA = parseFloat(cornerA.lng);
        const latB = parseFloat(cornerB.lat);
        const lngB = parseFloat(cornerB.lng);
        const latC = parseFloat(cornerC.lat);
        const lngC = parseFloat(cornerC.lng);
        const latD = parseFloat(cornerD.lat);
        const lngD = parseFloat(cornerD.lng);

        if (isNaN(latA) || isNaN(lngA) || isNaN(latB) || isNaN(lngB) || isNaN(latC) || isNaN(lngC)) {
          alert("Please complete the information for at least 3 corners (A, B, C) for a triangle, or turn off 'GPS Area Survey'.");
          setIsRegistering(false);
          return;
        }

        cornersArray = [
          { lat: latA, lng: lngA },
          { lat: latB, lng: lngB },
          { lat: latC, lng: lngC }
        ];
        if (!isNaN(latD) && !isNaN(lngD)) {
          cornersArray.push({ lat: latD, lng: lngD });
        }

        const calculated = calculateAreaFromCorners(cornersArray);
        if (calculated) {
          acresFloat = parseFloat(calculated.acres.toFixed(3));
          setNewFarmAcres(acresFloat.toString());
        }
      }

      console.log("Attempting Anchor GPS capture...");
      const location = await new Promise<{ lat: number; lng: number }>((resolve, reject) => {
        // If they provided corner coordinates, let's use Corner A as the primary anchor!
        if (cornersArray && cornersArray.length > 0) {
          resolve({ lat: cornersArray[0].lat, lng: cornersArray[0].lng });
        } else {
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
        }
      });

      const farmId = `farm_baseline_${currentIdentity.phone}_${newFarmName.replace(/\s+/g, '_').toLowerCase()}`;
      
      const resolvedHomesteadName = viewingHomestead || currentIdentity.homesteadName;
      console.log("Generating Agroecology AI Profile...");
      const aiProfileContent = await generateAgroecologyProfile(resolvedHomesteadName, newFarmName, location.lat, location.lng, cornersArray);
      
      // We serialize both the survey corners and the markdown report into aiProfile
      const aiProfileObj = {
        corners: cornersArray || null,
        markdown: aiProfileContent
      };
      const aiProfileString = JSON.stringify(aiProfileObj);

      // Save to WatermelonDB (Offline First)
      let localRecord: any;
      await database.write(async () => {
        localRecord = await database.get('farm_baselines').create((row: any) => {
          row.farmerPhone = currentIdentity.phone;
          row.farmerName = currentIdentity.name;
          row.farmName = `${resolvedHomesteadName} - ${newFarmName}`;
          row.cluster = currentIdentity.cluster;
          row.latitude = location.lat;
          row.longitude = location.lng;
          row.sizeInAcres = acresFloat;
          row.verifiedAt = new Date().toISOString();
          row.isSynced = false;
          row.aiProfile = aiProfileString;
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
          // Store serialized aiProfile in pages table to avoid missing column in farm_baselines
          await supabase.from('pages').upsert({
             id: `ai_profile_${farmId}`,
             title: `AI Profile - ${homesteadName} - ${newFarmName}`,
             content: aiProfileString
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
        farmName: `${resolvedHomesteadName} - ${newFarmName}`,
        location,
        verifiedAt: localRecord.verifiedAt,
        cluster: currentIdentity.cluster,
        aiProfile: aiProfileString
      }]);
      
      // Clean states
      setNewFarmName('');
      setNewFarmAcres('');
      setUseCorners(false);
      setCornerA({ lat: '', lng: '' });
      setCornerB({ lat: '', lng: '' });
      setCornerC({ lat: '', lng: '' });
      setCornerD({ lat: '', lng: '' });

      alert(`Plot Registered!\n\nHomestead: ${resolvedHomesteadName}\nPlot: ${newFarmName}\nOwner: ${currentIdentity?.name || 'Unknown'}\nCooperative: ${currentIdentity?.cluster || 'General'}\n\nBoundary & coordinates verified and captured.`);
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
        
        {uniqueHomesteads.map(homesteadName => (
          <button 
            key={homesteadName}
            onClick={() => setViewingHomestead(homesteadName)}
            className="w-full bg-white border-2 border-emerald-500 rounded-[2rem] p-8 text-left hover:bg-emerald-50 transition-all flex items-start gap-4 shadow-sm hover:shadow-md mb-4"
          >
            <div className="bg-emerald-100 text-emerald-800 p-4 rounded-full mt-1 shrink-0">
              <i className="fas fa-home text-3xl"></i>
            </div>
            <div>
              <h3 className="text-2xl font-black text-emerald-900">{homesteadName}</h3>
              <p className="text-slate-500 font-bold text-sm mt-2">
                Manage your farming lands, add plots, register GPS coordinates, and access your soil agroecology profile.
              </p>
              <div className="flex items-center gap-2 mt-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                <i className="fas fa-arrow-right"></i> Open Homestead Dashboard
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      {/* Header Profile */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setViewingHomestead(null)} className="bg-slate-100 hover:bg-slate-200 text-slate-500 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
              <i className="fas fa-arrow-left"></i>
            </button>
            <div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-4 py-1.5 rounded-full mb-2 inline-block">
                Welcome to {viewingHomestead}
              </span>
              <h1 className="text-3xl font-black text-slate-900 leading-none mb-2">Homestead Dashboard</h1>
              <p className="text-slate-500 font-bold flex items-center gap-2">
                <i className="fas fa-store"></i> Food Coop: {currentIdentity.cluster}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2 w-full">
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
                disabled={useCorners}
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
            <p className="text-[10px] font-bold text-slate-400 italic mt-1">Stand on your plot to register accurate GPS. Acreage helps verify future submissions.</p>

            <div className="w-full mt-4 flex flex-col items-start border-t border-slate-100 pt-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={useCorners} 
                  onChange={(e) => setUseCorners(e.target.checked)}
                  className="w-4.5 h-4.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-400"
                />
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1">
                  <i className="fas fa-drafting-compass text-emerald-500"></i> Define 4-Corner Boundary Survey Nodes (Optional)
                </span>
              </label>

              {useCorners && (
                <div className="w-full mt-4 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-4 text-left space-y-4 animate-in fade-in duration-200">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-white border border-slate-100 p-3 rounded-2xl">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      How it works: Stand at each corner of the plot and capture live coordinates, or enter them directly.
                    </p>
                    {liveArea && (
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider shrink-0">
                        📐 Computed: {liveArea.hectares.toFixed(3)} Ha (~{liveArea.acres.toFixed(2)} Acres)
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {/* Corner A */}
                    <div className="bg-white p-3 rounded-xl border border-slate-150 flex flex-col gap-2">
                      <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Corner A (North-West)</span>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Latitude"
                        value={cornerA.lat}
                        onChange={(e) => setCornerA(prev => ({ ...prev, lat: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Longitude"
                        value={cornerA.lng}
                        onChange={(e) => setCornerA(prev => ({ ...prev, lng: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <button 
                        onClick={() => handleCaptureCorner('A')}
                        disabled={isCapturingCorner !== null}
                        className="bg-emerald-50 text-emerald-750 hover:bg-emerald-100 px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                      >
                        {isCapturingCorner === 'A' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-map-marker-alt"></i>}
                        {isCapturingCorner === 'A' ? "Capturing..." : "📍 Get Live GPS"}
                      </button>
                    </div>

                    {/* Corner B */}
                    <div className="bg-white p-3 rounded-xl border border-slate-150 flex flex-col gap-2">
                      <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Corner B (North-East)</span>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Latitude"
                        value={cornerB.lat}
                        onChange={(e) => setCornerB(prev => ({ ...prev, lat: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Longitude"
                        value={cornerB.lng}
                        onChange={(e) => setCornerB(prev => ({ ...prev, lng: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <button 
                        onClick={() => handleCaptureCorner('B')}
                        disabled={isCapturingCorner !== null}
                        className="bg-emerald-50 text-emerald-750 hover:bg-emerald-100 px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                      >
                        {isCapturingCorner === 'B' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-map-marker-alt"></i>}
                        {isCapturingCorner === 'B' ? "Capturing..." : "📍 Get Live GPS"}
                      </button>
                    </div>

                    {/* Corner C */}
                    <div className="bg-white p-3 rounded-xl border border-slate-150 flex flex-col gap-2">
                      <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Corner C (South-East)</span>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Latitude"
                        value={cornerC.lat}
                        onChange={(e) => setCornerC(prev => ({ ...prev, lat: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Longitude"
                        value={cornerC.lng}
                        onChange={(e) => setCornerC(prev => ({ ...prev, lng: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <button 
                        onClick={() => handleCaptureCorner('C')}
                        disabled={isCapturingCorner !== null}
                        className="bg-emerald-50 text-emerald-750 hover:bg-emerald-100 px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                      >
                        {isCapturingCorner === 'C' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-map-marker-alt"></i>}
                        {isCapturingCorner === 'C' ? "Capturing..." : "📍 Get Live GPS"}
                      </button>
                    </div>

                    {/* Corner D */}
                    <div className="bg-white p-3 rounded-xl border border-slate-150 flex flex-col gap-2">
                      <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider">Corner D (South-West) [Optional for Triangle]</span>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Latitude"
                        value={cornerD.lat}
                        onChange={(e) => setCornerD(prev => ({ ...prev, lat: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <input 
                        type="number" 
                        step="any"
                        placeholder="Longitude"
                        value={cornerD.lng}
                        onChange={(e) => setCornerD(prev => ({ ...prev, lng: e.target.value }))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-emerald-400"
                      />
                      <button 
                        onClick={() => handleCaptureCorner('D')}
                        disabled={isCapturingCorner !== null}
                        className="bg-emerald-50 text-emerald-750 hover:bg-emerald-100 px-3 py-2 rounded-lg font-black text-[9px] uppercase tracking-wider transition-colors flex items-center justify-center gap-1"
                      >
                        {isCapturingCorner === 'D' ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-map-marker-alt"></i>}
                        {isCapturingCorner === 'D' ? "Capturing..." : "📍 Get Live GPS"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AgroecologicalCropCalendar 
        agentIdentity={agentIdentity} 
        farmBaselines={filteredFarmProfiles} 
        displayLogs={displayLogs} 
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Farm List */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3">
            <i className="fas fa-map-marked-alt text-emerald-600"></i> My Registered Plots ({filteredFarmProfiles.length})
          </h2>
          {filteredFarmProfiles.length > 0 ? filteredFarmProfiles.map((plot, idx) => (
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
              {(() => {
                if (!plot.aiProfile) return null;
                try {
                  const parsed = JSON.parse(plot.aiProfile);
                  if (parsed && typeof parsed === 'object' && parsed.corners && parsed.corners.length === 4) {
                    return (
                      <div className="mt-1 mb-3 bg-emerald-50/40 border border-emerald-100 p-3 rounded-2xl">
                        <p className="text-[9px] font-black text-emerald-800 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                          <i className="fas fa-satellite text-emerald-600"></i> Boundary Survey Verified (4 Corners)
                        </p>
                        <div className="grid grid-cols-2 gap-1.5 text-[9px] font-mono font-bold text-slate-500">
                          <div>A: Lat {parsed.corners[0].lat.toFixed(5)}, Lng {parsed.corners[0].lng.toFixed(5)}</div>
                          <div>B: Lat {parsed.corners[1].lat.toFixed(5)}, Lng {parsed.corners[1].lng.toFixed(5)}</div>
                          <div>C: Lat {parsed.corners[2].lat.toFixed(5)}, Lng {parsed.corners[2].lng.toFixed(5)}</div>
                          <div>D: Lat {parsed.corners[3].lat.toFixed(5)}, Lng {parsed.corners[3].lng.toFixed(5)}</div>
                        </div>
                      </div>
                    );
                  }
                } catch {
                  // legacy
                }
                return null;
              })()}
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
          By registering your baseline coordinates, you enable the Agroecology AI Engine to cross-reference satellite data via Copernicus (CDSE) / openEO and RCMRD layers (with SoilGrids as a fallback) alongside your on-ground soil reports. 
          This ensures we provide the most accurate organic input advice specifically for your micro-climate, powered by Gemini AI.
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
            <p className="text-[11px] text-slate-600 font-bold">Get Weekly Activities Report Logs.</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-200/50">
            <i className="fas fa-chart-line text-emerald-600 mb-4 text-xl"></i>
            <h4 className="font-black text-xs uppercase mb-2">Step 3</h4>
            <p className="text-[11px] text-slate-600 font-bold">Receive AI soil health and market advice.</p>
          </div>
        </div>
      </div>

      {/* Global Registered Homesteads Section */}
      <div className="bg-slate-900 p-8 rounded-[2.5rem] mt-12 shadow-2xl">
        <div className="flex items-center gap-4 mb-8 border-b border-slate-700 pb-6">
          <div className="bg-emerald-500/20 p-3 rounded-full text-emerald-400">
             <i className="fas fa-globe-africa text-2xl"></i>
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Registered Homesteads Directory</h2>
            <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Classified by Food Cooperative</p>
          </div>
        </div>

        {Object.keys(groupedGlobalHomesteads).length > 0 ? (
          <div className="space-y-8">
            {Object.entries(groupedGlobalHomesteads).map(([coop, homesteads]) => (
              <div key={coop} className="bg-slate-800/50 rounded-3xl p-6 border border-slate-700/50">
                <h3 className="text-lg font-black text-emerald-400 uppercase tracking-widest flex items-center gap-3 mb-6">
                  <i className="fas fa-store"></i> {coop}
                  <span className="bg-emerald-500/10 text-emerald-400 text-[10px] px-3 py-1 rounded-full">{homesteads.length} Homesteads</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {homesteads.map((h: any, idx: number) => (
                    <div key={idx} className="bg-slate-800 p-5 rounded-2xl border border-slate-700 hover:border-emerald-500/50 transition-colors group">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-black text-white text-sm group-hover:text-emerald-400 transition-colors">
                          {h.homesteadName || h.farmName || 'Unknown Homestead'}
                        </h4>
                        {h.gpsVerified && <i className="fas fa-satellite text-emerald-500 text-[10px]" title="GPS Verified"></i>}
                      </div>
                      <div className="space-y-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                         <p className="flex items-center gap-2 block truncate">
                           <i className="fas fa-user text-slate-500 w-3"></i> 
                           {h.farmerName || h.farmer_name || h.homesteadContact || 'Unknown Owner'}
                         </p>
                         <p className="flex items-center gap-2 block truncate">
                           <i className="fas fa-calendar-alt text-slate-500 w-3"></i> 
                           {new Date(h.submittedAt).toLocaleDateString()}
                         </p>
                         <div className="pt-3 flex gap-2 flex-wrap">
                            {!h.fromPages && <span className="bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded uppercase text-[8px] tracking-wider">Base Plot</span>}
                            {h.fromPages && <span className="bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded uppercase text-[8px] tracking-wider">Form Profile</span>}
                         </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <i className="fas fa-home text-4xl text-slate-700 mb-4"></i>
            <p className="font-black text-slate-500 uppercase tracking-widest text-xs">No Homesteads Registered Yet</p>
          </div>
        )}
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
                 <Markdown>{parsedViewingProfileText}</Markdown>
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
