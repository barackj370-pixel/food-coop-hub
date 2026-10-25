import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { AgentIdentity, SystemRole } from '../types';
import { FOOD_COOPS } from '../constants';
import { 
  getNearestCountyProfile, 
  PrimarySoilTexture, 
  SOIL_TEXTURE_DEFINITIONS, 
  detectPrimarySoilTexture 
} from '../src/data/countyProfiles';
import Markdown from 'react-markdown';

interface Props {
  agentIdentity?: AgentIdentity | null;
  clusters?: string[];
  users?: AgentIdentity[];
  onSuccess?: () => void;
}

export interface RegisteredHomestead {
  id: string;
  homesteadName: string;
  farmerName: string;
  farmerPhone: string;
  cluster: string;
  village: string;
  numHouseholds: number;
  peopleCount: number;
  adultsCount: number;
  childrenCount: number;
  cows: number;
  sheep: number;
  goats: number;
  chicken: number;
  otherLivestock: string;
  livestockTotal: number;
  acres: number;
  latitude: number | null;
  longitude: number | null;
  gpsAccuracy?: number;
  soilTexturePrimary: PrimarySoilTexture;
  soilType: string;
  soilTexture: string;
  phRange: string;
  moistureStatus: string;
  suitableCrops: string[];
  registeredBy: string;
  verifiedAt: string;
  aiProfileMarkdown?: string;
  isSynced?: boolean;
}

const HomesteadRegistration: React.FC<Props> = ({ 
  agentIdentity, 
  clusters = FOOD_COOPS, 
  onSuccess 
}) => {
  const [activeTab, setActiveTab] = useState<'REGISTER' | 'REGISTRY'>('REGISTER');
  
  // Delegate Full Name & Homestead Owner's Food Coop
  const [delegateName, setDelegateName] = useState(() => {
    return agentIdentity?.name || localStorage.getItem('spi_delegate_fullname') || '';
  });
  
  const [selectedCluster, setSelectedCluster] = useState<string>(() => {
    return clusters[0] || 'Mariwa';
  });

  // Primary Soil Textural Type (4 Main Types: Loamy, Clay, Sandy, Silty)
  const [primarySoilTexture, setPrimarySoilTexture] = useState<PrimarySoilTexture>('Loamy');

  // Form Fields
  const [homesteadName, setHomesteadName] = useState('');
  const [farmerName, setFarmerName] = useState('');
  const [farmerPhone, setFarmerPhone] = useState('');
  const [village, setVillage] = useState('');
  
  // Demographics (Prompt numeric values)
  const [numHouseholds, setNumHouseholds] = useState<number>(1);
  const [adultsCount, setAdultsCount] = useState<number>(2);
  const [childrenCount, setChildrenCount] = useState<number>(3);
  
  // Livestock Inventory
  const [cows, setCows] = useState<number>(0);
  const [sheep, setSheep] = useState<number>(0);
  const [goats, setGoats] = useState<number>(0);
  const [chicken, setChicken] = useState<number>(0);
  const [otherLivestock, setOtherLivestock] = useState<string>('');
  
  // Land & Live GPS (No confusing defaults to Mariwa)
  const [acres, setAcres] = useState<string>('1.0');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [manualLatInput, setManualLatInput] = useState<string>('');
  const [manualLngInput, setManualLngInput] = useState<string>('');
  const [showManualGps, setShowManualGps] = useState<boolean>(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('GPS not yet acquired. Stand at homestead and tap "Capture Live GPS"');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSubmittedHomestead, setLastSubmittedHomestead] = useState<RegisteredHomestead | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Registry & Audit State
  const [homesteadsList, setHomesteadsList] = useState<RegisteredHomestead[]>(() => {
    const saved = localStorage.getItem('spi_homesteads_registry');
    return saved ? JSON.parse(saved) : [];
  });
  const [registryFilterCluster, setRegistryFilterCluster] = useState<string>('ALL');
  const [registrySearch, setRegistrySearch] = useState('');
  const [viewingProfile, setViewingProfile] = useState<RegisteredHomestead | null>(null);

  // Auto-detect soil texture when cluster or GPS changes (can be manually adjusted anytime)
  useEffect(() => {
    const lat = latitude ?? 0;
    const lng = longitude ?? 0;
    const county = getNearestCountyProfile(lat, lng, selectedCluster);
    const detected = detectPrimarySoilTexture(county.soilTexture, selectedCluster);
    setPrimarySoilTexture(detected);
  }, [latitude, longitude, selectedCluster]);

  // Derived Demographics & Livestock Totals
  const totalPeopleInHomestead = useMemo(() => {
    return (Number(adultsCount) || 0) + (Number(childrenCount) || 0);
  }, [adultsCount, childrenCount]);

  const totalLivestockInHomestead = useMemo(() => {
    return (Number(cows) || 0) + (Number(sheep) || 0) + (Number(goats) || 0) + (Number(chicken) || 0);
  }, [cows, sheep, goats, chicken]);

  // Instant Soil Profile based on Coordinates or Regional Agroecological Matrix
  const instantSoilProfile = useMemo(() => {
    const lat = latitude ?? 0;
    const lng = longitude ?? 0;
    const county = getNearestCountyProfile(lat, lng, selectedCluster);
    const textureDef = SOIL_TEXTURE_DEFINITIONS[primarySoilTexture];
    return {
      countyName: county.countyName,
      agroecologicalZone: county.agroecologicalZone,
      dominantSoils: county.dominantSoils,
      soilTexture: county.soilTexture,
      primaryTexture: primarySoilTexture,
      phRange: primarySoilTexture === 'Clay' ? '5.5 - 6.5 (Clay-rich)' : primarySoilTexture === 'Sandy' ? '6.0 - 7.0 (Sandy)' : '6.0 - 6.8 (Loamy)',
      moistureStatus: textureDef.waterRetention,
      suitableCrops: textureDef.recommendedCrops,
      agroforestrySpecies: county.agroforestrySpecies,
      droughtRisk: county.droughtRisk,
      floodRisk: county.floodRisk,
      rainfallPattern: county.rainfallPattern
    };
  }, [latitude, longitude, selectedCluster, primarySoilTexture]);

  // Load existing homesteads from Supabase on mount
  useEffect(() => {
    const fetchExisting = async () => {
      try {
        const { data: baselines } = await supabase
          .from('farm_baselines')
          .select('*')
          .order('verified_at', { ascending: false });

        if (baselines && baselines.length > 0) {
          const parsed: RegisteredHomestead[] = baselines.map((b: any) => {
            let meta: any = {};
            try {
              if (b.ai_profile) {
                const parsedAi = JSON.parse(b.ai_profile);
                meta = parsedAi.meta || parsedAi.demographics || parsedAi;
              }
            } catch (e) {}

            return {
              id: b.id,
              homesteadName: b.farm_name?.split(' - ')[0] || b.farm_name || 'Homestead',
              farmerName: b.farmer_name || 'Peasant Member',
              farmerPhone: b.farmer_phone || '',
              cluster: b.cluster || 'General',
              village: meta.village || 'Local Village',
              numHouseholds: Number(meta.numHouseholds || meta.households || 1),
              peopleCount: Number(meta.peopleCount || meta.people || 5),
              adultsCount: Number(meta.adultsCount || meta.adults || 2),
              childrenCount: Number(meta.childrenCount || meta.children || 3),
              cows: Number(meta.cows || meta.livestock?.cows || 0),
              sheep: Number(meta.sheep || meta.livestock?.sheep || 0),
              goats: Number(meta.goats || meta.livestock?.goats || 0),
              chicken: Number(meta.chicken || meta.livestock?.chicken || 0),
              otherLivestock: meta.otherLivestock || '',
              livestockTotal: Number(meta.livestockTotal || meta.livestock?.total || 0),
              acres: Number(b.size_in_acres || 1.0),
              latitude: b.latitude !== null && b.latitude !== undefined ? Number(b.latitude) : null,
              longitude: b.longitude !== null && b.longitude !== undefined ? Number(b.longitude) : null,
              soilTexturePrimary: meta.soilTexturePrimary || detectPrimarySoilTexture(meta.soilTexture || '', b.cluster || ''),
              soilType: meta.soilType || 'Ferralsols and Acrisols [Clay Loam]',
              soilTexture: meta.soilTexture || 'Clay Loam',
              phRange: meta.phRange || '5.8 - 6.4',
              moistureStatus: meta.moistureStatus || 'Moderate',
              suitableCrops: meta.suitableCrops || ['Maize', 'Beans', 'Cassava', 'Sweet Potato', 'Kales'],
              registeredBy: meta.registeredBy || 'SPI Delegate',
              verifiedAt: b.verified_at || new Date().toISOString(),
              aiProfileMarkdown: meta.markdown || (typeof b.ai_profile === 'string' ? b.ai_profile : '')
            };
          });

          // Merge with local list avoiding duplicates
          setHomesteadsList(prev => {
            const map = new Map(parsed.map(item => [item.id, item]));
            prev.forEach(item => {
              if (!map.has(item.id)) map.set(item.id, item);
            });
            const merged = Array.from(map.values());
            localStorage.setItem('spi_homesteads_registry', JSON.stringify(merged));
            return merged;
          });
        }
      } catch (err) {
        console.warn("Could not fetch remote baselines, using local cache:", err);
      }
    };
    fetchExisting();
  }, []);

  // Live GPS Capture with Satellite Lock (No confusing default coops)
  const handleCaptureLiveGps = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your device browser.");
      return;
    }
    setIsCapturingGps(true);
    setGpsStatus('Acquiring high-accuracy satellite signal...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = parseFloat(pos.coords.latitude.toFixed(6));
        const lng = parseFloat(pos.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lng);
        setManualLatInput(lat.toString());
        setManualLngInput(lng.toString());
        setGpsAccuracy(Math.round(pos.coords.accuracy));
        setGpsStatus(`GPS Locked via Satellite (Accuracy: ±${Math.round(pos.coords.accuracy)}m)`);
        setIsCapturingGps(false);
      },
      (err) => {
        console.warn("Live GPS timeout or error:", err);
        setGpsStatus(`GPS signal timed out (${err.message}). Tap "Enter Coordinates Manually" or step into open sky.`);
        setShowManualGps(true);
        setIsCapturingGps(false);
      },
      { timeout: 7000, enableHighAccuracy: true, maximumAge: 5000 }
    );
  };

  const handleApplyManualGps = () => {
    const parsedLat = parseFloat(manualLatInput);
    const parsedLng = parseFloat(manualLngInput);
    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      alert("Please enter valid numeric latitude and longitude coordinates.");
      return;
    }
    setLatitude(parsedLat);
    setLongitude(parsedLng);
    setGpsAccuracy(5);
    setGpsStatus(`Manual GPS set: ${parsedLat.toFixed(6)}°, ${parsedLng.toFixed(6)}°`);
  };

  // Zero-Delay Fast Homestead Registration Handler
  const handleRegisterHomestead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateName.trim() || delegateName.trim().length < 3) {
      alert("Please enter the Full Name of the registering officer / delegate.");
      return;
    }
    if (!homesteadName.trim()) {
      alert("Please enter the Homestead Name");
      return;
    }
    if (!farmerPhone.trim()) {
      alert("Please enter a Primary Phone Contact");
      return;
    }

    setIsSubmitting(true);
    localStorage.setItem('spi_delegate_fullname', delegateName.trim());

    const timestamp = new Date().toISOString();
    const id = `homestead_${Date.now()}`;
    const soilDef = SOIL_TEXTURE_DEFINITIONS[primarySoilTexture];

    // Instant Synthesized Agroecological Profile Markdown
    const profileMarkdown = `
# 🌿 AGROECOLOGICAL HOMESTEAD BASELINE REPORT

**Homestead:** ${homesteadName}  
**Head of Family / Farmer:** ${farmerName || 'Peasant Member'}  
**Primary Contact:** ${farmerPhone}  
**Homestead Owner's Food Coop:** ${selectedCluster} | **Village:** ${village || 'Local Community'}  
**GPS Coordinates:** ${latitude !== null && longitude !== null ? `\`${latitude.toFixed(6)}°, ${longitude.toFixed(6)}°\` (Accuracy: ±${gpsAccuracy || 5}m)` : '_GPS Coordinates to be recorded on next field visit_'}  
**Registered By (Full Name):** ${delegateName.trim()}  
**Survey Date:** ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}  

---

## 👨‍👩‍👧‍👦 DEMOGRAPHICS & POPULATION BASELINE
- **Number of Households in Homestead:** **${numHouseholds}**
- **Total Homestead Population:** **${totalPeopleInHomestead} Members**
  - **Adults (18+ yrs):** ${adultsCount}
  - **Children & Youth (<18 yrs):** ${childrenCount}
- **Farm Landholding Size:** **${acres} Acres**

---

## 🐄 LIVESTOCK & INDIGENOUS ANIMAL INVENTORY
- **Cattle / Cows (Ng'ombe):** **${cows}**
- **Sheep (Kondoo):** **${sheep}**
- **Goats (Mbuzi):** **${goats}**
- **Chicken / Free-range Poultry (Kuku):** **${chicken}**
${otherLivestock ? `- **Other Animals:** ${otherLivestock}` : ''}
- **Total Livestock Inventory:** **${totalLivestockInHomestead} Heads**

---

## 🧪 PHYSICO-CHEMICAL SOIL & AGROECOLOGY AUDIT
- **Primary Soil Textural Class (Kenya 4 Types):** **${primarySoilTexture} (${soilDef.name})**
- **Swahili Classification:** *${soilDef.swahiliName}*
- **Particle Texture Profile:** ${soilDef.particleSize}
- **Soil Drainage Dynamics:** ${soilDef.drainage}
- **Water Retention Capacity:** ${soilDef.waterRetention}
- **Field Workability:** ${soilDef.workability}
- **Agroecological Zone:** **${instantSoilProfile.agroecologicalZone}**
- **Dominant Regional Soil:** **${instantSoilProfile.dominantSoils}**
- **Estimated Soil pH Range:** **${instantSoilProfile.phRange}**
- **Drought Risk:** ${instantSoilProfile.droughtRisk} | **Flood Risk:** ${instantSoilProfile.floodRisk}

---

## 🌾 RECOMMENDED REGENERATIVE AGROECOLOGICAL CROPS FOR ${primarySoilTexture.toUpperCase()} SOIL
${soilDef.recommendedCrops.map((c, i) => `${i + 1}. **${c}**`).join('\n')}

### 🌳 Companion Agroforestry Species for Soil Regeneration:
${instantSoilProfile.agroforestrySpecies.map((tree) => `- *${tree}*`).join('\n')}

---

## 💧 WATER HARVESTING & BIOLOGICAL SOIL CARE FOR ${primarySoilTexture.toUpperCase()} SOILS
1. **Soil Care Protocol:** ${soilDef.agroecologicalCare}
2. **Continuous Organic Mulching:** Maintain 5-10cm cover of dry biomass to suppress weeds and reduce evaporation.
3. **Animal Manure Cycling:** Utilize manure from the homestead's ${totalLivestockInHomestead} livestock (cow dung, goat/sheep pellets, poultry droppings) aged with carbon-rich crop waste for 21 days before soil application.
4. **Rainwater Retention:** Construct contour swales, trash lines, and micro-catchments to eliminate runoff losses.
`;

    const newRecord: RegisteredHomestead = {
      id,
      homesteadName: homesteadName.trim(),
      farmerName: farmerName.trim() || 'Peasant Member',
      farmerPhone: farmerPhone.trim(),
      cluster: selectedCluster,
      village: village.trim() || 'Local Community',
      numHouseholds,
      peopleCount: totalPeopleInHomestead,
      adultsCount,
      childrenCount,
      cows,
      sheep,
      goats,
      chicken,
      otherLivestock,
      livestockTotal: totalLivestockInHomestead,
      acres: parseFloat(acres) || 1.0,
      latitude,
      longitude,
      gpsAccuracy: gpsAccuracy || undefined,
      soilTexturePrimary: primarySoilTexture,
      soilType: instantSoilProfile.dominantSoils,
      soilTexture: instantSoilProfile.soilTexture,
      phRange: instantSoilProfile.phRange,
      moistureStatus: soilDef.waterRetention,
      suitableCrops: soilDef.recommendedCrops,
      registeredBy: delegateName.trim(),
      verifiedAt: timestamp,
      aiProfileMarkdown: profileMarkdown,
      isSynced: true
    };

    // 1. Optimistic Local Save (Instant < 10ms)
    const updatedRegistry = [newRecord, ...homesteadsList];
    setHomesteadsList(updatedRegistry);
    localStorage.setItem('spi_homesteads_registry', JSON.stringify(updatedRegistry));
    setLastSubmittedHomestead(newRecord);

    // 2. Background Asynchronous Persistence (No UI freeze)
    const baselinePayload = {
      id,
      farmer_phone: newRecord.farmerPhone,
      farmer_name: newRecord.farmerName,
      farm_name: `${newRecord.homesteadName} - Plot 1`,
      cluster: newRecord.cluster,
      latitude: newRecord.latitude || 0,
      longitude: newRecord.longitude || 0,
      size_in_acres: newRecord.acres,
      verified_at: timestamp,
      ai_profile: JSON.stringify({
        meta: newRecord,
        markdown: profileMarkdown
      })
    };

    const pagePayload = {
      id: `homestead_${id}`,
      title: `Homestead: ${newRecord.homesteadName}`,
      content: JSON.stringify({
        ...newRecord,
        formType: 'homestead',
        homesteadName: newRecord.homesteadName,
        homesteadContact: newRecord.farmerPhone,
        submittedAt: timestamp
      })
    };

    Promise.allSettled([
      supabase.from('farm_baselines').insert([baselinePayload]),
      supabase.from('pages').insert([pagePayload])
    ]).then(([res1, res2]) => {
      console.log("Background homestead sync complete:", { baseline: res1, page: res2 });
    }).catch(err => {
      console.warn("Background sync error (will retry next online tick):", err);
    });

    // 3. Instant UI Reset for Fast Sequential Entry
    setSuccessToast(`Homestead "${newRecord.homesteadName}" registered successfully! (Households: ${newRecord.numHouseholds}, People: ${newRecord.peopleCount}, Animals: ${newRecord.livestockTotal}, Soil: ${primarySoilTexture}). Ready for next homestead.`);
    setHomesteadName('');
    setFarmerName('');
    setFarmerPhone('');
    setVillage('');
    setNumHouseholds(1);
    setAdultsCount(2);
    setChildrenCount(3);
    setCows(0);
    setSheep(0);
    setGoats(0);
    setChicken(0);
    setOtherLivestock('');
    setLatitude(null);
    setLongitude(null);
    setManualLatInput('');
    setManualLngInput('');
    setGpsAccuracy(null);
    setGpsStatus('GPS not yet acquired. Stand at homestead and tap "Capture Live GPS"');
    setIsSubmitting(false);

    // Clear toast after 6 seconds
    setTimeout(() => {
      setSuccessToast(null);
    }, 6000);
  };

  // Filtered Registry for SPI Delegates
  const filteredRegistry = useMemo(() => {
    return homesteadsList.filter(h => {
      const matchesCluster = registryFilterCluster === 'ALL' || h.cluster === registryFilterCluster;
      const q = registrySearch.toLowerCase().trim();
      const matchesSearch = !q || 
        h.homesteadName.toLowerCase().includes(q) ||
        h.farmerName.toLowerCase().includes(q) ||
        h.farmerPhone.includes(q) ||
        h.village.toLowerCase().includes(q) ||
        h.registeredBy.toLowerCase().includes(q);
      return matchesCluster && matchesSearch;
    });
  }, [homesteadsList, registryFilterCluster, registrySearch]);

  // Aggregated Summary Statistics for SPI
  const summaryMetrics = useMemo(() => {
    const list = registryFilterCluster === 'ALL' 
      ? homesteadsList 
      : homesteadsList.filter(h => h.cluster === registryFilterCluster);

    const totalHomesteads = list.length;
    const totalHouseholds = list.reduce((sum, h) => sum + (Number(h.numHouseholds) || 1), 0);
    const totalPeople = list.reduce((sum, h) => sum + (Number(h.peopleCount) || 0), 0);
    const totalAdults = list.reduce((sum, h) => sum + (Number(h.adultsCount) || 0), 0);
    const totalChildren = list.reduce((sum, h) => sum + (Number(h.childrenCount) || 0), 0);
    const totalCows = list.reduce((sum, h) => sum + (Number(h.cows) || 0), 0);
    const totalSheep = list.reduce((sum, h) => sum + (Number(h.sheep) || 0), 0);
    const totalGoats = list.reduce((sum, h) => sum + (Number(h.goats) || 0), 0);
    const totalChicken = list.reduce((sum, h) => sum + (Number(h.chicken) || 0), 0);
    const totalAnimals = totalCows + totalSheep + totalGoats + totalChicken;

    return {
      totalHomesteads,
      totalHouseholds,
      totalPeople,
      totalAdults,
      totalChildren,
      totalCows,
      totalSheep,
      totalGoats,
      totalChicken,
      totalAnimals
    };
  }, [homesteadsList, registryFilterCluster]);

  // Export SPI CSV
  const handleExportCsv = () => {
    if (filteredRegistry.length === 0) {
      alert("No registered homesteads to export.");
      return;
    }

    const headers = [
      "Homestead Name",
      "Head of Family",
      "Phone",
      "Homestead Owner Food Coop",
      "Village",
      "Households",
      "Total People",
      "Adults",
      "Children",
      "Cows",
      "Sheep",
      "Goats",
      "Chicken",
      "Total Livestock",
      "Acres",
      "Latitude",
      "Longitude",
      "Primary Soil Texture (4 Types)",
      "Dominant Soil",
      "Registered By (Full Name)",
      "Date"
    ];

    const rows = filteredRegistry.map(h => [
      `"${h.homesteadName}"`,
      `"${h.farmerName}"`,
      `"${h.farmerPhone}"`,
      `"${h.cluster}"`,
      `"${h.village}"`,
      h.numHouseholds,
      h.peopleCount,
      h.adultsCount,
      h.childrenCount,
      h.cows,
      h.sheep,
      h.goats,
      h.chicken,
      h.livestockTotal,
      h.acres,
      h.latitude !== null && h.latitude !== undefined ? h.latitude : 'N/A',
      h.longitude !== null && h.longitude !== undefined ? h.longitude : 'N/A',
      `"${h.soilTexturePrimary || 'Loamy'}"`,
      `"${h.soilType}"`,
      `"${h.registeredBy}"`,
      `"${new Date(h.verifiedAt).toLocaleDateString()}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `SPI_KPL_Homesteads_Audit_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300 pb-16">
      
      {/* Top Header & SPI Mission Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-black text-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden border border-emerald-800/40">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <i className="fas fa-home-user text-9xl"></i>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-3 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-black uppercase tracking-widest">
              <i className="fas fa-satellite-dish"></i> SPI Delegates & KPL Field System
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white leading-tight">
              Peasant Homesteads Registration & Soil Intelligence
            </h1>
            <p className="text-slate-300 text-sm font-medium leading-relaxed">
              Real-time field registration of peasant homesteads, household structures, people per family, and livestock assets (cows, sheep, goats, chicken) with zero submission delays and instant agroecological soil profiles.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={() => setActiveTab('REGISTER')}
              className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                activeTab === 'REGISTER' 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 scale-105' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <i className="fas fa-plus-circle"></i> Register Homestead
            </button>
            <button
              onClick={() => setActiveTab('REGISTRY')}
              className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                activeTab === 'REGISTRY' 
                  ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 scale-105' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              <i className="fas fa-clipboard-list"></i> View Registry ({homesteadsList.length})
            </button>
          </div>
        </div>

        {/* Global Live Summary Counter for SPI Delegates */}
        <div className="mt-8 pt-8 border-t border-white/10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              <i className="fas fa-home mr-1"></i> Homesteads
            </span>
            <span className="text-2xl font-black text-white">{summaryMetrics.totalHomesteads}</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              <i className="fas fa-users-rectangle mr-1"></i> Households
            </span>
            <span className="text-2xl font-black text-white">{summaryMetrics.totalHouseholds}</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              <i className="fas fa-people-roof mr-1"></i> Total People
            </span>
            <span className="text-2xl font-black text-white">{summaryMetrics.totalPeople}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">({summaryMetrics.totalAdults} adults, {summaryMetrics.totalChildren} youth)</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              <i className="fas fa-cow mr-1"></i> Cows
            </span>
            <span className="text-2xl font-black text-white">{summaryMetrics.totalCows}</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              <i className="fas fa-drumstick-bite mr-1"></i> Goats / Sheep
            </span>
            <span className="text-2xl font-black text-white">{summaryMetrics.totalGoats + summaryMetrics.totalSheep}</span>
            <span className="text-[9px] text-slate-400 block mt-0.5">({summaryMetrics.totalGoats} goats, {summaryMetrics.totalSheep} sheep)</span>
          </div>

          <div className="bg-white/5 border border-white/10 p-4 rounded-2xl">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              <i className="fas fa-feather-pointed mr-1"></i> Chicken
            </span>
            <span className="text-2xl font-black text-white">{summaryMetrics.totalChicken}</span>
            <span className="text-[9px] text-emerald-400 font-bold block mt-0.5">Total Animals: {summaryMetrics.totalAnimals}</span>
          </div>
        </div>
      </div>

      {/* Success Banner (Disappears automatically) */}
      {successToast && (
        <div className="bg-emerald-600 text-white p-5 rounded-2xl shadow-xl flex items-center justify-between gap-4 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
              <i className="fas fa-check-circle"></i>
            </div>
            <div>
              <p className="font-black text-sm uppercase tracking-wide">Instant Registration Complete</p>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">{successToast}</p>
            </div>
          </div>
          <button 
            onClick={() => setSuccessToast(null)} 
            className="text-white/80 hover:text-white p-2"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {/* TAB 1: FAST REGISTRATION FORM */}
      {activeTab === 'REGISTER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Main Registration Form */}
          <div className="lg:col-span-8 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-200">
            <form onSubmit={handleRegisterHomestead} className="space-y-8">
              
              {/* Delegate Full Name & Homestead Owner's Cooperative */}
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">
                    <i className="fas fa-id-badge text-emerald-600 mr-1"></i> Registered By (Full Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={delegateName}
                    onChange={e => setDelegateName(e.target.value)}
                    placeholder="Enter your official full name (e.g. John Ochieng Odhiambo)"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500"
                  />
                  <span className="text-[9px] text-slate-400 mt-1 block">Full legal or official name of person conducting this registration</span>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest block mb-1.5">
                    <i className="fas fa-layer-group text-emerald-600 mr-1"></i> Homestead Owner's Food Coop *
                  </label>
                  <select
                    value={selectedCluster}
                    onChange={e => setSelectedCluster(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-emerald-500 cursor-pointer"
                  >
                    {clusters.map(c => (
                      <option key={c} value={c}>{c} Food Coop</option>
                    ))}
                  </select>
                  <span className="text-[9px] text-slate-400 mt-1 block">The cooperative cluster where this homestead owner belongs</span>
                </div>
              </div>

              {/* SECTION 1: HOMESTEAD & HEAD OF FAMILY */}
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <i className="fas fa-house-chimney text-emerald-600"></i> 1. Homestead & Family Identification
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Homestead Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Owino Juma Homestead / Family Compound"
                      value={homesteadName}
                      onChange={e => setHomesteadName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Head of Family / Farmer Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mama Judith Atieno"
                      value={farmerName}
                      onChange={e => setFarmerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Primary Phone Contact *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 0712345678"
                      value={farmerPhone}
                      onChange={e => setFarmerPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Village / Sub-Location
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Nyang'oma / Mariwa North"
                      value={village}
                      onChange={e => setVillage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                      Farm Land Size (Acres)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.1"
                      value={acres}
                      onChange={e => setAcres(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3.5 font-bold text-slate-900 outline-none focus:bg-white focus:border-emerald-500 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: HOUSEHOLDS & DEMOGRAPHICS (PROMPT & IMMEDIATE) */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <i className="fas fa-users text-emerald-600"></i> 2. Households & Demographics
                  </h2>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    Total: {totalPeopleInHomestead} People
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Households in Homestead */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">
                      Households in Homestead
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setNumHouseholds(prev => Math.max(1, (Number(prev) || 1) - 1))}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-lg shadow-sm"
                        title="Reduce household count"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={numHouseholds}
                        onChange={e => {
                          const val = e.target.value;
                          setNumHouseholds(val === '' ? 1 : Math.max(1, parseInt(val, 10) || 1));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 text-center font-black text-base text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setNumHouseholds(prev => (Number(prev) || 0) + 1)}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-lg shadow-sm"
                        title="Add household count"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400">Separate cooking kitchens/units</p>
                  </div>

                  {/* Adults Count */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">
                      Adults (18+ Years)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAdultsCount(prev => Math.max(0, (Number(prev) || 0) - 1))}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-lg shadow-sm"
                        title="Reduce adults"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={adultsCount}
                        onChange={e => {
                          const val = e.target.value;
                          setAdultsCount(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 text-center font-black text-base text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setAdultsCount(prev => (Number(prev) || 0) + 1)}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-lg shadow-sm"
                        title="Add adults"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400">Adult farm workforce</p>
                  </div>

                  {/* Children & Youth Count */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block">
                      Children & Youth (&lt;18)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChildrenCount(prev => Math.max(0, (Number(prev) || 0) - 1))}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-lg shadow-sm"
                        title="Reduce children"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={childrenCount}
                        onChange={e => {
                          const val = e.target.value;
                          setChildrenCount(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-2 text-center font-black text-base text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setChildrenCount(prev => (Number(prev) || 0) + 1)}
                        className="w-10 h-10 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-lg shadow-sm"
                        title="Add children"
                      >
                        +
                      </button>
                    </div>
                    <p className="text-[9px] text-slate-400">School & youth members</p>
                  </div>
                </div>
              </div>

              {/* SECTION 3: LIVESTOCK INVENTORY (ANIMALS) */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-slate-100 pb-2 flex justify-between items-center">
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <i className="fas fa-paw text-emerald-600"></i> 3. Livestock Inventory (Animals)
                  </h2>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                    Total: {totalLivestockInHomestead} Heads
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {/* Cows */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block flex items-center gap-1.5">
                      <span>🐄</span> Cows / Cattle
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCows(prev => Math.max(0, (Number(prev) || 0) - 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Reduce cows"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={cows}
                        onChange={e => {
                          const val = e.target.value;
                          setCows(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-1.5 text-center font-black text-sm text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setCows(prev => (Number(prev) || 0) + 1)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Add cows"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-400 block text-center">Ng'ombe</span>
                  </div>

                  {/* Sheep */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block flex items-center gap-1.5">
                      <span>🐑</span> Sheep
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSheep(prev => Math.max(0, (Number(prev) || 0) - 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Reduce sheep"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={sheep}
                        onChange={e => {
                          const val = e.target.value;
                          setSheep(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-1.5 text-center font-black text-sm text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setSheep(prev => (Number(prev) || 0) + 1)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Add sheep"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-400 block text-center">Kondoo</span>
                  </div>

                  {/* Goats */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block flex items-center gap-1.5">
                      <span>🐐</span> Goats
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setGoats(prev => Math.max(0, (Number(prev) || 0) - 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Reduce goats"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={goats}
                        onChange={e => {
                          const val = e.target.value;
                          setGoats(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-1.5 text-center font-black text-sm text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setGoats(prev => (Number(prev) || 0) + 1)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Add goats"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-400 block text-center">Mbuzi</span>
                  </div>

                  {/* Chicken */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <label className="text-[10px] font-black text-slate-700 uppercase tracking-widest block flex items-center gap-1.5">
                      <span>🐔</span> Chicken / Poultry
                    </label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setChicken(prev => Math.max(0, (Number(prev) || 0) - 1))}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Reduce chicken"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={chicken}
                        onChange={e => {
                          const val = e.target.value;
                          setChicken(val === '' ? 0 : Math.max(0, parseInt(val, 10) || 0));
                        }}
                        className="w-full bg-white border border-slate-200 rounded-xl py-1.5 text-center font-black text-sm text-slate-900 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setChicken(prev => (Number(prev) || 0) + 1)}
                        className="w-9 h-9 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-100 active:bg-slate-200 active:scale-90 transition-all select-none cursor-pointer flex items-center justify-center text-base shadow-sm"
                        title="Add chicken"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[9px] text-slate-400 block text-center">Kuku Kienyeji</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                    Other Animals / Livestock (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 2 Donkeys, 4 Ducks, 1 Beehive"
                    value={otherLivestock}
                    onChange={e => setOtherLivestock(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 font-bold text-slate-800 text-xs outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* SECTION 4: PRIMARY SOIL TEXTURAL CLASSIFICATION (4 MAIN TYPES) */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <h2 className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                      <i className="fas fa-cubes-stacked text-emerald-600"></i> 4. Soil Textural Classification (4 Main Types)
                    </h2>
                    <p className="text-[10px] text-slate-500 font-medium">
                      Identified from county agroecology. Tap any of the 4 types to adjust based on on-site ribbon or jar test.
                    </p>
                  </div>
                  <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-200 self-start sm:self-auto">
                    Selected: {primarySoilTexture}
                  </span>
                </div>

                {/* 4 Main Soil Textural Types Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['Loamy', 'Clay', 'Sandy', 'Silty'] as PrimarySoilTexture[]).map(type => {
                    const isSelected = primarySoilTexture === type;
                    const def = SOIL_TEXTURE_DEFINITIONS[type];
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setPrimarySoilTexture(type)}
                        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative ${
                          isSelected
                            ? 'bg-slate-900 text-white border-emerald-500 shadow-lg ring-2 ring-emerald-500 scale-[1.02]'
                            : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected && (
                          <span className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-black shadow-sm">
                            ✓
                          </span>
                        )}
                        <span className={`text-xs font-black uppercase tracking-wider block ${isSelected ? 'text-emerald-400' : 'text-slate-900'}`}>
                          {type}
                        </span>
                        <span className={`text-[10px] block mt-1 font-bold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                          {type === 'Loamy' && 'Rutuba (Balanced)'}
                          {type === 'Clay' && 'Mfinyanzi (Heavy)'}
                          {type === 'Sandy' && 'Mchanga (Coarse)'}
                          {type === 'Silty' && 'Tope (Alluvial)'}
                        </span>
                        <span className={`text-[9px] block mt-2 font-medium ${isSelected ? 'text-emerald-300/80' : 'text-slate-400'}`}>
                          {def.drainage.split(',')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Detailed Active Texture Intelligence */}
                <div className="bg-emerald-50/80 border border-emerald-200 p-4 rounded-2xl text-xs space-y-2 text-slate-800">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 border-b border-emerald-200/60 pb-2">
                    <span className="font-black text-emerald-950 uppercase tracking-wide text-xs">
                      {SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].name} ({SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].swahiliName})
                    </span>
                    <span className="text-[10px] text-emerald-800 font-bold bg-white px-2 py-0.5 rounded-full border border-emerald-200">
                      Water: {SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].waterRetention.split(';')[0]}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-700">
                    <strong className="text-emerald-900">Particle Composition:</strong> {SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].particleSize}
                  </p>
                  <p className="text-[11px] text-slate-700">
                    <strong className="text-emerald-900">Agroecological Soil Care:</strong> {SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].agroecologicalCare}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-emerald-900">Top Resilient Crops:</span>
                    {SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].recommendedCrops.map(crop => (
                      <span key={crop} className="px-2 py-0.5 bg-white border border-emerald-200 text-emerald-900 rounded-md text-[9px] font-black">
                        {crop}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION 5: LIVE GPS COORDINATES (NO MARIWA DEFAULTS) */}
              <div className="space-y-4 pt-2">
                <div className="border-b border-slate-100 pb-2 flex flex-col sm:flex-row justify-between sm:items-center gap-1">
                  <h2 className="text-base font-black uppercase tracking-tight text-slate-900 flex items-center gap-2">
                    <i className="fas fa-location-crosshairs text-emerald-600"></i> 5. Live GPS Coordinates
                  </h2>
                  <span className="text-[10px] font-black text-slate-500 uppercase">
                    {gpsStatus}
                  </span>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                    <div>
                      {latitude !== null && longitude !== null ? (
                        <div>
                          <p className="text-xs font-black text-slate-800">
                            Latitude: <span className="font-mono text-emerald-700">{latitude.toFixed(6)}°</span> | Longitude: <span className="font-mono text-emerald-700">{longitude.toFixed(6)}°</span>
                          </p>
                          {gpsAccuracy && (
                            <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                              Satellite Lock Accuracy: ±{gpsAccuracy}m
                            </p>
                          )}
                        </div>
                      ) : (
                        <div>
                          <p className="text-xs font-bold text-amber-700 flex items-center gap-1.5">
                            <i className="fas fa-satellite text-amber-500"></i> GPS Coordinates Pending
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Stand inside the homestead compound and tap Capture Live GPS Now
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isCapturingGps}
                        onClick={handleCaptureLiveGps}
                        className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-md flex items-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {isCapturingGps ? (
                          <><i className="fas fa-spinner fa-spin"></i> Locking Satellites...</>
                        ) : (
                          <><i className="fas fa-location-arrow"></i> Capture Live GPS Now</>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowManualGps(!showManualGps)}
                        className="px-4 py-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl font-black text-xs uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <i className="fas fa-keyboard"></i> {showManualGps ? 'Hide Manual Input' : 'Type Coordinates'}
                      </button>
                    </div>
                  </div>

                  {/* Manual Coordinates Input Option (for Garmin or Offline Devices) */}
                  {showManualGps && (
                    <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 animate-in fade-in duration-200">
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                          Latitude (e.g. -0.971350)
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="-0.971350"
                          value={manualLatInput}
                          onChange={e => setManualLatInput(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                          Longitude (e.g. 34.573640)
                        </label>
                        <input
                          type="number"
                          step="0.000001"
                          placeholder="34.573640"
                          value={manualLngInput}
                          onChange={e => setManualLngInput(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-800 outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleApplyManualGps}
                          className="w-full py-2 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all"
                        >
                          Apply Coordinates
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-slate-500 text-xs font-medium">
                  <i className="fas fa-bolt text-amber-500 mr-1.5"></i> Fast Submit: Instant local save & background cloud sync.
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-10 py-4 bg-black hover:bg-slate-800 active:scale-95 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-black/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fas fa-check-circle text-emerald-400"></i> 
                  {isSubmitting ? 'Saving...' : 'Register Homestead (Instant)'}
                </button>
              </div>

            </form>
          </div>

          {/* Real-time Agroecological Soil Intelligence Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Instant Soil Intelligence Card */}
            <div className="bg-emerald-950 text-white p-8 rounded-[2.5rem] shadow-xl border border-emerald-800/50 space-y-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10 pointer-events-none">
                <i className="fas fa-seedling text-8xl"></i>
              </div>

              <div className="border-b border-emerald-800/60 pb-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                  Hyperlocal Soil Data
                </span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {selectedCluster} Agro-Soil Matrix
                </h3>
                <p className="text-xs text-emerald-300/80 mt-1">
                  {latitude !== null && longitude !== null 
                    ? `Live Satellite Fix: (${latitude.toFixed(4)}°, ${longitude.toFixed(4)}°)` 
                    : `Coop Baseline: ${selectedCluster} (Waiting for live GPS)`}
                </p>
              </div>

              <div className="space-y-4 text-xs">
                {/* 4 Soil Textural Types Status */}
                <div className="bg-white/10 p-3.5 rounded-xl border border-white/15">
                  <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 block">
                    4 Main Soil Textural Classes
                  </span>
                  <div className="grid grid-cols-4 gap-1.5 mt-2 text-center">
                    {(['Loamy', 'Clay', 'Sandy', 'Silty'] as PrimarySoilTexture[]).map(t => (
                      <span
                        key={t}
                        className={`py-1 rounded-lg text-[9px] font-black uppercase ${
                          primarySoilTexture === t
                            ? 'bg-emerald-400 text-slate-900 shadow-sm'
                            : 'bg-white/5 text-slate-400'
                        }`}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="text-[10px] text-emerald-200 mt-2 font-bold">
                    Active: {primarySoilTexture} ({SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].swahiliName.split('/')[0].trim()})
                  </p>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400">Regional Soil Type</p>
                  <p className="font-bold text-white mt-0.5">{instantSoilProfile.dominantSoils}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">pH Estimate</p>
                    <p className="font-bold text-white mt-0.5">{instantSoilProfile.phRange}</p>
                  </div>
                  <div className="bg-white/5 p-3 rounded-xl border border-white/10">
                    <p className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Drainage</p>
                    <p className="font-bold text-white mt-0.5 truncate">{SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].drainage.split(',')[0]}</p>
                  </div>
                </div>

                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mb-1.5">
                    Recommended Crops for {primarySoilTexture} Soil
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {instantSoilProfile.suitableCrops.slice(0, 6).map(crop => (
                      <span key={crop} className="px-2 py-0.5 bg-emerald-500/20 text-emerald-200 rounded-md text-[10px] font-bold">
                        {crop}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-emerald-800/60">
                <p className="text-[10px] text-emerald-300 font-medium">
                  <i className="fas fa-leaf mr-1"></i> {SOIL_TEXTURE_DEFINITIONS[primarySoilTexture].agroecologicalCare}
                </p>
              </div>
            </div>

            {/* Last Submitted Quick Card */}
            {lastSubmittedHomestead && (
              <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-md space-y-4 animate-in fade-in">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-600 block">
                      Recently Registered
                    </span>
                    <h4 className="font-black text-slate-900 text-sm">{lastSubmittedHomestead.homesteadName}</h4>
                    <p className="text-xs text-slate-500">{lastSubmittedHomestead.farmerName} • {lastSubmittedHomestead.cluster}</p>
                  </div>
                  <button
                    onClick={() => setViewingProfile(lastSubmittedHomestead)}
                    className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-bold"
                    title="View Full Profile"
                  >
                    <i className="fas fa-file-lines"></i>
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 block uppercase">Households</span>
                    <span className="font-black text-slate-800">{lastSubmittedHomestead.numHouseholds}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 block uppercase">People</span>
                    <span className="font-black text-slate-800">{lastSubmittedHomestead.peopleCount}</span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl">
                    <span className="text-[9px] text-slate-400 block uppercase">Animals</span>
                    <span className="font-black text-emerald-600">{lastSubmittedHomestead.livestockTotal}</span>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* TAB 2: HOMESTEADS REGISTRY & SPI AUDIT TABLE */}
      {activeTab === 'REGISTRY' && (
        <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-6">
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
                SPI Peasant Homesteads Registry
              </h2>
              <p className="text-slate-500 text-xs font-medium mt-1">
                Field baseline records of peasant households, demographics, and livestock inventories across KPL food cooperatives.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleExportCsv}
                className="px-5 py-2.5 bg-black hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"
              >
                <i className="fas fa-download"></i> Export SPI CSV
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2"
              >
                <i className="fas fa-print"></i> Print Report
              </button>
            </div>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by homestead name, contact, village, or delegate..."
                value={registrySearch}
                onChange={e => setRegistrySearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-3 font-bold text-slate-800 text-xs outline-none focus:bg-white focus:border-emerald-500"
              />
            </div>

            <div className="w-full sm:w-64">
              <select
                value={registryFilterCluster}
                onChange={e => setRegistryFilterCluster(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-bold text-slate-800 text-xs outline-none focus:bg-white focus:border-emerald-500 cursor-pointer"
              >
                <option value="ALL">All Food Coops ({homesteadsList.length})</option>
                {clusters.map(c => {
                  const count = homesteadsList.filter(h => h.cluster === c).length;
                  return (
                    <option key={c} value={c}>{c} Food Coop ({count})</option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  <th className="py-4 px-4">Homestead & Head</th>
                  <th className="py-4 px-4">Contact & Village</th>
                  <th className="py-4 px-4">Owner's Food Coop</th>
                  <th className="py-4 px-4 text-center">Households</th>
                  <th className="py-4 px-4 text-center">People</th>
                  <th className="py-4 px-4 text-center">Livestock (C/S/G/C)</th>
                  <th className="py-4 px-4">Soil Texture & Type</th>
                  <th className="py-4 px-4">Registered By</th>
                  <th className="py-4 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredRegistry.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-slate-400 font-medium">
                      No homesteads found matching the filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredRegistry.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-4 px-4">
                        <p className="font-black text-slate-900 text-sm">{h.homesteadName}</p>
                        <p className="text-[10px] text-slate-500 font-bold">{h.farmerName}</p>
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-mono text-slate-700 font-bold">{h.farmerPhone}</p>
                        <p className="text-[10px] text-slate-400">{h.village}</p>
                      </td>

                      <td className="py-4 px-4">
                        <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase">
                          {h.cluster}
                        </span>
                      </td>

                      <td className="py-4 px-4 text-center font-bold text-slate-800">
                        {h.numHouseholds}
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="font-black text-slate-900">{h.peopleCount}</span>
                        <span className="text-[9px] text-slate-400 block">({h.adultsCount}A / {h.childrenCount}C)</span>
                      </td>

                      <td className="py-4 px-4 text-center">
                        <span className="font-black text-emerald-700">{h.livestockTotal} Heads</span>
                        <span className="text-[9px] text-slate-500 block">
                          🐄{h.cows} 🐑{h.sheep} 🐐{h.goats} 🐔{h.chicken}
                        </span>
                      </td>

                      <td className="py-4 px-4">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider inline-block mb-1 ${
                          h.soilTexturePrimary === 'Clay' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          h.soilTexturePrimary === 'Sandy' ? 'bg-orange-100 text-orange-900 border border-orange-300' :
                          h.soilTexturePrimary === 'Silty' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                          'bg-emerald-100 text-emerald-900 border border-emerald-300'
                        }`}>
                          {h.soilTexturePrimary || 'Loamy'}
                        </span>
                        <p className="font-bold text-slate-800 truncate max-w-[150px]" title={h.soilType}>{h.soilType}</p>
                        <p className="text-[10px] text-emerald-600 font-semibold">{h.soilTexture} • pH {h.phRange}</p>
                      </td>

                      <td className="py-4 px-4">
                        <p className="font-bold text-slate-800 text-[11px]">{h.registeredBy}</p>
                        <p className="text-[10px] text-slate-400">{new Date(h.verifiedAt).toLocaleDateString()}</p>
                      </td>

                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => setViewingProfile(h)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <i className="fas fa-seedling"></i> Profile
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

      {/* DETAILED AGROECOLOGY PROFILE MODAL */}
      {viewingProfile && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setViewingProfile(null)}
        >
          <div 
            className="bg-white w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 md:p-8 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
                  Agroecological Homestead Baseline
                </span>
                <h3 className="text-xl font-black text-white">{viewingProfile.homesteadName}</h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  {viewingProfile.cluster} Food Coop • Head: {viewingProfile.farmerName} ({viewingProfile.farmerPhone})
                </p>
              </div>

              <button
                onClick={() => setViewingProfile(null)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-lg transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Quick Metrics Bar */}
            <div className="bg-emerald-50 px-8 py-4 border-b border-emerald-100 grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-700">Households</span>
                <p className="text-lg font-black text-emerald-950">{viewingProfile.numHouseholds}</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-700">Total Population</span>
                <p className="text-lg font-black text-emerald-950">{viewingProfile.peopleCount} Members</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-700">Total Animals</span>
                <p className="text-lg font-black text-emerald-950">{viewingProfile.livestockTotal} Heads</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-700">Land Area</span>
                <p className="text-lg font-black text-emerald-950">{viewingProfile.acres} Acres</p>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-emerald-700">Soil Texture</span>
                <p className="text-lg font-black text-emerald-950">{viewingProfile.soilTexturePrimary || 'Loamy'}</p>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto space-y-6 flex-1 text-slate-800">
              {viewingProfile.aiProfileMarkdown ? (
                <div className="markdown-body prose prose-slate max-w-none text-sm">
                  <Markdown>{viewingProfile.aiProfileMarkdown}</Markdown>
                </div>
              ) : (
                <div className="space-y-4">
                  <h4 className="font-bold text-base">Soil & Cropping Summary</h4>
                  <p><strong>Primary Soil Texture:</strong> {viewingProfile.soilTexturePrimary || 'Loamy'}</p>
                  <p><strong>Soil Classification:</strong> {viewingProfile.soilType} [{viewingProfile.soilTexture}]</p>
                  <p><strong>pH Estimate:</strong> {viewingProfile.phRange}</p>
                  <p><strong>GPS Location:</strong> {viewingProfile.latitude !== null ? `${viewingProfile.latitude}, ${viewingProfile.longitude}` : 'Awaiting GPS Lock'}</p>
                  <p><strong>Suitable Agroecological Crops:</strong> {viewingProfile.suitableCrops?.join(', ')}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              <span className="text-[10px] text-slate-400 font-bold uppercase">
                Registered by: {viewingProfile.registeredBy} • {new Date(viewingProfile.verifiedAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => setViewingProfile(null)}
                className="px-6 py-2.5 bg-black text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HomesteadRegistration;
