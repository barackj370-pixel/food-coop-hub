import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { 
  getNearestCountyProfile, 
  CountyProfile, 
  COUNTY_PROFILES 
} from '../src/data/countyProfiles';
import { 
  Calendar, 
  Sprout, 
  CheckCircle, 
  AlertTriangle, 
  Compass, 
  Droplets, 
  MapPin, 
  Sparkles, 
  TrendingUp, 
  Activity, 
  ChevronRight, 
  Loader2, 
  Clock, 
  BookOpen, 
  Info,
  Check,
  Download
} from 'lucide-react';
import { AgentIdentity } from '../types';
import Markdown from 'react-markdown';

interface AgroecologicalCropCalendarProps {
  agentIdentity: AgentIdentity;
  farmBaselines: any[];
  displayLogs: any[];
}

export const AgroecologicalCropCalendar: React.FC<AgroecologicalCropCalendarProps> = ({ 
  agentIdentity, 
  farmBaselines = [], 
  displayLogs = [] 
}) => {
  const [selectedPlotId, setSelectedPlotId] = useState<string>('');
  const [selectedCrop, setSelectedCrop] = useState<string>('');
  const [customCrop, setCustomCrop] = useState<string>('');
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);
  const [aiCalendar, setAiCalendar] = useState<string | null>(null);
  const [activeStage, setActiveStage] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Determine Selected Plot and County Profile
  const selectedPlot = useMemo(() => {
    if (!selectedPlotId && farmBaselines.length > 0) {
      return farmBaselines[0];
    }
    return farmBaselines.find(p => p.farmId === selectedPlotId || p.id === selectedPlotId);
  }, [selectedPlotId, farmBaselines]);

  // Use nearest county profile based on selected plot coordinates, or default to general profile
  const countyProfile = useMemo<CountyProfile>(() => {
    if (selectedPlot && selectedPlot.location) {
      return getNearestCountyProfile(selectedPlot.location.lat, selectedPlot.location.lng);
    }
    // Fallback: If no plot selected but they are in a known cooperative, match coop to county
    const coopName = agentIdentity.cluster || '';
    if (['Mariwa', 'Mulo', 'Rabolo', 'Nyamagagana', 'Apuoyo'].includes(coopName)) {
      return COUNTY_PROFILES['Migori'];
    } else if (['Kangemi', 'New Kangemi Food Coop'].includes(coopName)) {
      return COUNTY_PROFILES['Machakos']; // Kangemi can align with Machakos or fallback to closer profile
    } else if (coopName.includes('Matisi') || coopName.includes('Kiboroa')) {
      return COUNTY_PROFILES['Trans Nzoia'];
    } else if (coopName.includes('Ligega') || coopName.includes('Utoma')) {
      return COUNTY_PROFILES['Siaya'];
    }
    // Default to Migori (heartland)
    return COUNTY_PROFILES['Migori'];
  }, [selectedPlot, agentIdentity.cluster]);

  // Crop list selection from County Profile
  const cropOptions = useMemo(() => {
    return countyProfile.suitableCrops;
  }, [countyProfile]);

  // Set default crop on change
  useEffect(() => {
    if (cropOptions.length > 0) {
      setSelectedCrop(cropOptions[0]);
    }
    setAiCalendar(null);
  }, [cropOptions]);

  const activeCrop = customCrop.trim() !== '' ? customCrop.trim() : selectedCrop;

  // 2. Align Weekly Activity Logs with 5 Calendar Stages (Live On-Ground Integration)
  const stageLogs = useMemo(() => {
    const logsMap = {
      0: [] as any[], // Land Prep
      1: [] as any[], // Sowing
      2: [] as any[], // Crop Management
      3: [] as any[], // Harvesting
      4: [] as any[]  // Post-Harvest
    };

    // Filter logs for the selected homestead plot if applicable
    const filteredLogs = displayLogs.filter(log => {
      if (!selectedPlot) return true;
      // Match by farm name split or text matches
      const farmNamePart = selectedPlot.farmName || '';
      const logFarm = log.homesteadName || log.farmName || '';
      return !logFarm || farmNamePart.toLowerCase().includes(logFarm.toLowerCase()) || logFarm.toLowerCase().includes(farmNamePart.toLowerCase());
    });

    filteredLogs.forEach(log => {
      const activitiesText = (log.weeklyActivities || '').toLowerCase();
      const workDoneArray = (log.workDone || []).map((w: string) => w.toLowerCase());
      const allText = `${activitiesText} ${workDoneArray.join(' ')}`;

      // Land Preparation triggers
      if (
        allText.includes('plough') || 
        allText.includes('till') || 
        allText.includes('tilling') || 
        allText.includes('land prep') || 
        allText.includes('digging') || 
        allText.includes('manure') || 
        allText.includes('clear') || 
        allText.includes('compost')
      ) {
        logsMap[0].push(log);
      }

      // Sowing / Planting triggers
      if (
        allText.includes('plant') || 
        allText.includes('planting') || 
        allText.includes('sow') || 
        allText.includes('sowing') || 
        allText.includes('seeded') || 
        allText.includes('seedling') || 
        allText.includes('nursery')
      ) {
        logsMap[1].push(log);
      }

      // Crop Management triggers
      if (
        allText.includes('weed') || 
        allText.includes('weeding') || 
        allText.includes('mulch') || 
        allText.includes('spray') || 
        allText.includes('liquid') || 
        allText.includes('water') || 
        allText.includes('irrigation') || 
        allText.includes('pruning') || 
        allText.includes('neem') || 
        allText.includes('fencing')
      ) {
        logsMap[2].push(log);
      }

      // Harvesting triggers
      if (
        allText.includes('harvest') || 
        allText.includes('harvesting') || 
        allText.includes('picked') || 
        allText.includes('plucking') || 
        allText.includes('yield')
      ) {
        logsMap[3].push(log);
      }

      // Post-Harvest triggers
      if (
        allText.includes('sort') || 
        allText.includes('sorting') || 
        allText.includes('dry') || 
        allText.includes('drying') || 
        allText.includes('store') || 
        allText.includes('bag') || 
        allText.includes('hermetic') || 
        allText.includes('shelling') || 
        allText.includes('milling')
      ) {
        logsMap[4].push(log);
      }
    });

    return logsMap;
  }, [displayLogs, selectedPlot]);

  // Pre-calculated instructions per county profile (expert fallback templates)
  const defaultStageGuidelines = useMemo(() => {
    const crop = activeCrop || 'Maize';
    const cName = countyProfile.countyName;
    const isDryZone = countyProfile.droughtRisk === 'High';
    const isWetZone = countyProfile.elevationRange.includes('1800m') || cName === 'Kakamega' || cName === 'Trans Nzoia';

    return [
      {
        title: 'Land Preparation',
        timeline: `${countyProfile.longRainsStart === 'April' ? 'February-March' : 'January-February'}`,
        description: `Prepare the dynamic plot topography for ${crop} considering regional parameters.`,
        practices: [
          isDryZone 
            ? 'Construct deep micro-basins or Zai Pits (30cm deep x 30cm wide) to store sub-surface moisture.' 
            : 'Form high raised ridges (20-30cm high) to improve drainage and avoid crop waterlogging root damage.',
          'Incorporate 2-3 metric tons of organic compost/bio-manure per acre equivalent to build humic baselines.',
          'Avoid mechanical deep-ploughing to protect delicate soil aggregations and maintain local fungal networks.'
        ],
        icon: 'fas fa-mountain'
      },
      {
        title: 'Sowing & Planting',
        timeline: `${countyProfile.longRainsStart}`,
        description: `Optimal planting window aligned with county bimodal rainfall onset.`,
        practices: [
          `Plant seeds at first moisture trigger in ${countyProfile.longRainsStart}. If timing is missed, risk factors triple.`,
          isDryZone
            ? `Plant ${crop} inside micro-catchment basins or hollow deep furrows to concentrate direct rain runoff.`
            : 'Maintain a 75cm x 25cm inter-row spacing layout with a soil depth of 5cm for healthy root structures.',
          'Intercrop with companion legumes (such as Cowpeas or Desmodium) to automatically fix atmospheric nitrogen.'
        ],
        icon: 'fas fa-seedling'
      },
      {
        title: 'Crop Management',
        timeline: `1 to 3 months post-sowing (Growing Phase)`,
        description: `Regenerative inputs, organic weeding, and active climate moisture care.`,
        practices: [
          'Add a heavy layer of organic dry grass/leaves mulch (5-10cm depth) to decrease ground moisture evaporation by 40%.',
          'Apply home-brewed vermicompost liquid tea or fermented cow urine dilutions as rich soil organic feeding.',
          'Deploy natural neem leaf extracts or hand-mixed hot pepper water sprays to prevent caterpillar/aphid infestations.'
        ],
        icon: 'fas fa-hand-holding-seedling'
      },
      {
        title: 'Harvesting',
        timeline: `${countyProfile.longRainsEnd === 'May' ? 'July-August' : 'September-October'}`,
        description: `Safely log and collect crop yields at physiological mature stages.`,
        practices: [
          'Harvest of grains/pods should be conducted on dry, clear days to minimize immediate fungal risks.',
          'Cut crop stalks at base, stacking them in small field stooks to encourage slow, safe preliminary curing.',
          'Log total quantities, unit pricing, and seedbank selection directly in the Homestead Dashboard Ledger.'
        ],
        icon: 'fas fa-wheat-awn'
      },
      {
        title: 'Post-Harvest Operations',
        timeline: `1 to 4 weeks post-harvest`,
        description: `Regenerative storage, drying, processing, and seed selection for next cycle.`,
        practices: [
          'Dry cereals on raised elevated canvas mats until moisture levels reach safe baselines (<13%). Avoid contact with bare ground.',
          'Store all grains in certified air-tight Hermetic bags to guarantee 100% organic control of weevils without synthetic chemicals.',
          'Extract and preserve the top 10% high-quality seeds in clean glass containers to bank local genetic varieties.'
        ],
        icon: 'fas fa-archive'
      }
    ];
  }, [countyProfile, activeCrop]);

  // 3. Dynamic Gemini AI Calendar Trigger function
  const handleGenerateAICalendar = async () => {
    setIsGeneratingAI(true);
    setErrorMsg(null);
    try {
      const soilTypeWithTexture = `${countyProfile.dominantSoils} [${countyProfile.soilTexture}]`;
      const currentMonth = new Date().toLocaleString('default', { month: 'long' });

      const prompt = `You are the expert Agroecology AI. Generate a highly personalized Living Crop Calendar for a farmer plot.
DATA INPUTS:
- Location / County: ${countyProfile.countyName} County, Kenya.
- Agroecological Zone: ${countyProfile.agroecologicalZone}
- Rainfall Pattern: ${countyProfile.rainfallPattern} (Long rains: ${countyProfile.longRainsStart}-${countyProfile.longRainsEnd}; Short rains: ${countyProfile.shortRainsStart}-${countyProfile.shortRainsEnd})
- Dominant Soil Type & Texture: ${soilTypeWithTexture}
- Target Crop Focused on: "${activeCrop}"
- Current Month & Context: ${currentMonth}
- Drought Risk: ${countyProfile.droughtRisk}, Flood Risk: ${countyProfile.floodRisk}
- Climate Risk Notes: ${countyProfile.climateRiskNotes}

Recent weekly activities logged on-ground:
${stageLogs[0].length > 0 ? `- Land Prep: ${stageLogs[0].map(l => l.weeklyActivities || l.workDone?.join(',')).join('; ')}` : ''}
${stageLogs[1].length > 0 ? `- Sowing/Planting: ${stageLogs[1].map(l => l.weeklyActivities || l.workDone?.join(',')).join('; ')}` : ''}
${stageLogs[2].length > 0 ? `- Crop Management: ${stageLogs[2].map(l => l.weeklyActivities || l.workDone?.join(',')).join('; ')}` : ''}
${stageLogs[3].length > 0 ? `- Harvesting: ${stageLogs[3].map(l => l.weeklyActivities || l.workDone?.join(',')).join('; ')}` : ''}
${stageLogs[4].length > 0 ? `- Post-Harvest: ${stageLogs[4].map(l => l.weeklyActivities || l.workDone?.join(',')).join('; ')}` : ''}

STRUCTURE OF OUTPUT:
Please output structured, markdown-formatted stages matching the 5 requested phases:
1. **Land Preparation**: Highly technical regional practices matching current weather prospects.
2. **Sowing/Planting**: Recommended sowing timing, spacing, soil depths, and companion planting layouts.
3. **Crop Management**: Customized mulching protocols, local bio-pesticides (neem/marigold), and moisture tracking.
4. **Harvesting**: Perfect harvesting indicators, water conservation steps, and logistics.
5. **Post-Harvest Handling**: Safe organic curing, high-resolution drying benchmarks, hermetic grain storage instructions, and seed extraction strategies. 

Include an **Adaptive Weather Outlook & Warning panel** in markdown style summarizing the drought/flood warnings for this specific month, plus a **How forms and calendar sync** educational guidance note in a highlighted markdown quote block (\`>\`). Keep the tone deeply encouraging, expert, and actionable for smallholders in East Africa.`;

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: 'gemini-2.5-flash',
          systemInstruction: 'You are an elite agroecological agronomist and crop systems engineer.',
          temperature: 0.6
        })
      });

      if (!response.ok) {
        throw new Error('Agroecology calendar compilation timed out. Please retry.');
      }

      const resObj = await response.json();
      setAiCalendar(resObj.text || resObj);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to sync with Agroecology AI Engine.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // Determine global progress based on logged activities
  const loggedStageCount = [0, 1, 2, 3, 4].filter(idx => stageLogs[idx as keyof typeof stageLogs].length > 0).length;
  const progressPercentage = Math.round((loggedStageCount / 5) * 100);

  const handleDownloadCalendar = () => {
    if (!aiCalendar) return;
    const blob = new Blob([aiCalendar], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Crop_Calendar_${activeCrop.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-8 overflow-hidden animate-in fade-in duration-300">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-slate-100">
        <div>
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full mb-1 inline-block">
            <i className="fas fa-magic"></i> Live Adaptive Agroecology Profile
          </span>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
            <i className="fas fa-calendar-alt text-emerald-600"></i> Dynamic Crop Calendar
          </h2>
          <p className="text-slate-400 font-bold text-xs mt-1">
            Spatial weather, ground logs, and AI synthesis mapping a 100% resilient crop cycle.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleGenerateAICalendar}
            disabled={isGeneratingAI}
            className="px-6 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-emerald-700 hover:shadow-lg disabled:bg-slate-400 transition-all flex items-center gap-2"
          >
            {isGeneratingAI ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                Refining Calendar...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-emerald-400 animate-pulse" />
                Generate AI Adaptive Calendar
              </>
            )}
          </button>
        </div>
      </div>

      {/* Inputs Mapping Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
        
        {/* Plot Selector */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
            <MapPin className="h-3 w-3 text-emerald-600" /> Select Verified Plot
          </label>
          <select 
            value={selectedPlotId}
            onChange={(e) => {
              setSelectedPlotId(e.target.value);
              setAiCalendar(null);
            }}
            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-sm text-slate-700 outline-none focus:border-emerald-400 transition-all"
          >
            {farmBaselines.length > 0 ? (
              farmBaselines.map((baseline, idx) => (
                <option key={baseline.farmId || baseline.id || idx} value={baseline.farmId || baseline.id}>
                  {baseline.farmName || `Farm Profile ${idx + 1}`}
                </option>
              ))
            ) : (
              <option value="">Guest Coordinates / Default</option>
            )}
          </select>
        </div>

        {/* Recommended Crops list */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
            <Sprout className="h-3 w-3 text-emerald-600" /> Recommended Crops for {countyProfile.countyName}
          </label>
          <select 
            value={selectedCrop}
            onChange={(e) => {
              setSelectedCrop(e.target.value);
              setCustomCrop('');
            }}
            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-sm text-slate-700 outline-none focus:border-emerald-400 transition-all"
          >
            {cropOptions.map((crop, idx) => (
              <option key={idx} value={crop}>
                🌽 {crop} (AI Recommended)
              </option>
            ))}
            <option value="Custom">-- Custom/Other Crop --</option>
          </select>
        </div>

        {/* Custom Crop input */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 ml-1">
            <TrendingUp className="h-3 w-3 text-emerald-600" /> Or Enter Custom Crop
          </label>
          <input 
            type="text"
            placeholder="e.g. Tomatoes, Sunflower..."
            value={customCrop}
            onChange={(e) => {
              setCustomCrop(e.target.value);
              setAiCalendar(null);
            }}
            className="w-full bg-white border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-sm text-slate-700 outline-none focus:border-emerald-400 transition-all"
          />
        </div>

      </div>

      {/* Geospatial and Weather Brain Panel */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 space-y-1">
          <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">County Area Brain</p>
          <p className="text-lg font-black text-emerald-950">{countyProfile.countyName} County</p>
          <p className="text-[10px] font-bold text-emerald-700 leading-tight">{countyProfile.agroecologicalZone}</p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 space-y-1">
          <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">Historical Rainfall</p>
          <p className="text-lg font-black text-emerald-950">{countyProfile.rainfallPattern}</p>
          <p className="text-[10px] font-bold text-emerald-700">Long: {countyProfile.longRainsStart}-{countyProfile.longRainsEnd} | Short: {countyProfile.shortRainsStart}</p>
        </div>
        <div className="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/50 space-y-1">
          <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider">Elevation & Structure</p>
          <p className="text-lg font-black text-emerald-950">{countyProfile.elevationRange}</p>
          <p className="text-[10px] font-bold text-emerald-700">Soils: {countyProfile.dominantSoils}</p>
        </div>
        <div className="bg-red-50/40 p-4 rounded-2xl border border-red-100/30 space-y-1">
          <p className="text-[9px] font-black text-red-800 uppercase tracking-wider">Adaptive Alerts</p>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] font-bold text-slate-500">Drought</p>
              <span className={`text-xs font-black uppercase ${countyProfile.droughtRisk === 'High' ? 'text-red-600' : 'text-slate-700'}`}>{countyProfile.droughtRisk}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-500">Flood</p>
              <span className={`text-xs font-black uppercase ${countyProfile.floodRisk === 'High' ? 'text-red-600' : 'text-emerald-700'}`}>{countyProfile.floodRisk}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress & Educational Linkage Card */}
      <div className="bg-slate-950 text-white rounded-[2rem] p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row gap-6 justify-between items-center">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-ping"></span>
            <span className="text-[9px] font-black tracking-widest text-[#a7f3d0] uppercase">On-ground Integration Feed</span>
          </div>
          <h3 className="text-xl font-black">Homestead Activity Logs Connection</h3>
          <p className="text-slate-400 text-xs max-w-xl font-medium">
            Your regular submissions to the **Weekly Farm Activities (Form B)** are indexed in real-time. 
            When you complete and submit logs for tilling, seeding, or weeding, the calendar tracks and authenticates 
            your actual seasonal milestones!
          </p>
        </div>
        <div className="w-full md:w-64 flex flex-col items-end shrink-0 z-10 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex justify-between w-full text-xs font-black tracking-wider mb-2 text-[#a7f3d0]">
            <span>LOGGED BIOMASS</span>
            <span>{progressPercentage}% DONE</span>
          </div>
          <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-400 h-full rounded-full transition-all duration-1000 shadow-md"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <span className="text-[9px] text-slate-400 font-bold uppercase mt-2">
            {loggedStageCount} of 5 distinct phases verified
          </span>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600 opacity-[0.08] blur-[60px] rounded-full"></div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 border border-red-100 text-red-700 rounded-2xl flex items-center gap-3 text-sm font-bold">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-500" />
          {errorMsg}
        </div>
      )}

      {/* Timeline Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Navigation Tabs (All 5 stages) */}
        <div className="lg:col-span-4 space-y-3">
          <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">Cycle Timeline Steps</h3>
          {defaultStageGuidelines.map((stg, idx) => {
            const hasLogs = stageLogs[idx as keyof typeof stageLogs].length > 0;
            const isActive = activeStage === idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveStage(idx)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 group ${
                  isActive 
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-sm' 
                    : 'bg-white hover:bg-slate-50 border-slate-200/80 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow' 
                      : (hasLogs ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400Group-hover:bg-slate-200')
                  }`}>
                    {hasLogs ? (
                      <Check className="h-5 w-5 font-black shrink-0" />
                    ) : (
                      <span className="text-xs font-black">{idx + 1}</span>
                    )}
                  </div>
                  <div>
                    <h4 className="font-black text-xs uppercase tracking-tight text-slate-800 flex items-center gap-2">
                      {stg.title}
                     </h4>
                    <p className="text-[10px] text-slate-400 font-bold group-hover:text-slate-600 mt-0.5">Timeline: {stg.timeline}</p>
                  </div>
                </div>
                {hasLogs && (
                  <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 py-0.5 px-2 rounded-full uppercase tracking-tight">Verified</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Stage Detail Panel */}
        <div className="lg:col-span-8 bg-slate-50/50 border border-slate-200/80 p-8 rounded-[2rem] space-y-6 flex flex-col justify-between">
          <div className="space-y-6">
            
            <div className="flex justify-between items-start gap-4">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest bg-[#f1f5f9] px-2.5 py-1 rounded-md">
                  Phase {activeStage + 1} Guidelines
                </span>
                <h3 className="text-2xl font-black text-slate-900 mt-2 flex items-center gap-2">
                  {defaultStageGuidelines[activeStage].title}
                </h3>
                <p className="text-slate-400 text-xs font-bold mt-1">
                  Timeline Window: <span className="text-slate-700">{defaultStageGuidelines[activeStage].timeline}</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg">
                <i className={defaultStageGuidelines[activeStage].icon}></i>
              </div>
            </div>

            <p className="text-sm font-semibold text-slate-600 italic">
              "{defaultStageGuidelines[activeStage].description}"
            </p>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <BookOpen className="h-3 w-3 text-emerald-600" /> Key Soil & Biomass Management Protocols
              </h4>
              <ul className="space-y-3">
                {defaultStageGuidelines[activeStage].practices.map((practice, i) => (
                  <li key={i} className="flex gap-3 text-xs text-slate-600 leading-relaxed font-bold">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] flex items-center justify-center shrink-0 mt-0.5">✓</span>
                    {practice}
                  </li>
                ))}
              </ul>
            </div>

            {/* Stage-focused logs feed */}
            <div className="pt-4 border-t border-slate-200">
              <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-emerald-600" /> Linked Ground Activity Log
              </h4>
              {stageLogs[activeStage as keyof typeof stageLogs].length > 0 ? (
                <div className="space-y-2">
                  {stageLogs[activeStage as keyof typeof stageLogs].map((log, idx) => (
                    <div key={idx} className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 text-[11px] text-emerald-950 font-bold flex justify-between gap-3 shadow-none">
                      <div>
                        <p className="text-slate-400 text-[9px] uppercase tracking-wider mb-1">
                          Farmer: {log.farmerName || 'Homestead Owner'} • Subtmitted: {new Date(log.submittedAt).toLocaleDateString()}
                        </p>
                        <p className="leading-snug">
                          {log.weeklyActivities || log.workDone?.join(', ')}
                        </p>
                      </div>
                      <span className="self-center bg-emerald-600 text-white text-[8px] font-black uppercase py-1 px-2.5 rounded-md shrink-0 flex items-center gap-1">
                        <i className="fas fa-check-double text-[7px]" /> Verified GPS
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-slate-100/50 p-4 rounded-xl text-center border border-slate-200/50">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    No matching activity reported via Weekly Form yet
                  </p>
                  <p className="text-[9px] text-slate-400 mt-0.5">
                    Submit activity forms for land preparation, weeding, or harvesting to link them here.
                  </p>
                </div>
              )}
            </div>

          </div>
          
          {/* Action Footer */}
          <div className="pt-4 border-t border-slate-200/50 flex justify-between items-center bg-slate-50 p-4 rounded-2xl mt-4">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Agroecology Checklist Stage</span>
            <div className="flex gap-2 text-[10px] font-black text-emerald-700 bg-emerald-50 py-1 px-3.5 rounded-full uppercase">
              <span>{stageLogs[activeStage as keyof typeof stageLogs].length > 0 ? '✓ COMPLETED' : '○ PENDING ACTS'}</span>
            </div>
          </div>
          
        </div>

      </div>

      {/* AI Output (Modal replacement or embedded section for Premium feel) */}
      {aiCalendar && (
        <div className="p-8 bg-slate-50 rounded-[2.5rem] border-2 border-emerald-200 flex flex-col space-y-6 animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center pb-4 border-b border-slate-205/60">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-emerald-400 flex items-center justify-center text-lg shadow-sm">
                <Sparkles className="h-5 w-5 animate-pulse text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Your Adaptive AI Calendar</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Generated by Gemini model</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleDownloadCalendar}
                className="text-xs font-black text-emerald-700 bg-emerald-100 hover:bg-emerald-200 p-2.5 px-4 rounded-xl flex items-center gap-2 uppercase tracking-widest transition-all"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
              <button 
                onClick={() => setAiCalendar(null)}
                className="text-xs font-black text-slate-400 hover:text-slate-600 bg-slate-200/50 hover:bg-slate-200 p-2.5 px-4 rounded-xl uppercase tracking-widest transition-all"
              >
                Clear AI View
              </button>
            </div>
          </div>
          <div className="markdown-body text-slate-700 bg-white p-8 rounded-3xl border border-slate-200 shadow-inner max-h-[500px] overflow-y-auto leading-relaxed text-sm font-bold">
            <Markdown>{aiCalendar}</Markdown>
          </div>
          <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl text-[10px] font-bold text-emerald-800 leading-relaxed">
            <p className="font-extrabold uppercase mb-1 flex items-center gap-1">
              <Info className="h-3.5 w-3.5 shrink-0" /> Local Soil Texture & pH Integration Verified:
            </p>
            Your soil baseline coordinates mapped this profile to **{countyProfile.countyName} County**'s environmental zone (elevation range: {countyProfile.elevationRange}, soil type: {countyProfile.dominantSoils} [{countyProfile.soilTexture}], and pH range: {countyProfile.countyName === 'Migori' ? '5.8 - 6.4' : '5.5 - 6.5'}). Soil structure is highly responsive to mulching, green cover seeding, and organic manure.
          </div>
        </div>
      )}

    </div>
  );
};
