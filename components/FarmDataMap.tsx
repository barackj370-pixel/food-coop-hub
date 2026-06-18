import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import AIAnalysisModal from './AIAnalysisModal';
import { database } from '../src/db';
import { Q } from '@nozbe/watermelondb';
import { supabase } from '../services/supabaseClient';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const MapResizer = () => {
  const map = useMap();
  useEffect(() => {
    // Delay slightly to ensure container is fully rendered including any CSS transitions
    const timeout = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timeout);
  }, [map]);
  return null;
};

interface FarmFormsData {
  id: string;
  fromPages?: boolean;
  dbRowId?: string;
  formType: 'weekly' | 'solidarity' | 'homestead';
  location: { lat: number; lng: number } | null;
  gpsVerified?: boolean;
  submittedAt: string;
  agentCluster: string;
  farmerName?: string;
  farmerPhone?: string;
  farmName?: string;
  farmer_name?: string;
  
  // Weekly (Merged)
  date?: string;
  foodCoop?: string;
  homesteadName?: string;
  homesteadContact?: string;
  productionOfficerName?: string;
  convenerName?: string;
  convenerContact?: string;
  indigenousPractices?: string;
  organicInputs?: string;
  pestControl?: string;
  waterManagement?: string;
  cropsGrown?: string;
  livestockKept?: string;
  soilTypes?: string;
  waterSource?: string;
  wasteTypes?: string;
  wasteHandling?: string;
  weeklyActivities?: string;
  challengesFaced?: string;
  productsToSupply?: string;
  harvestedProducts?: string;
  soilErosion?: string;
  erosionStrategies?: string;

  // Solidarity
  productionOfficeName?: string;
  productionOfficeContact?: string;
  workDone?: string[];
  homesteadVisitedName?: string;
  homesteadVisitedContact?: string;
  participants?: string;
}

interface FarmDataMapProps {
  data: FarmFormsData[];
  isSystemDev?: boolean;
  onRefresh?: () => void;
}

const getMarkerIcon = (farm: FarmFormsData) => {
  let color = '#94a3b8'; // Default slate
  
  if (farm.formType === 'weekly' || farm.formType as any === 'homestead') {
    const hasAgro = farm.organicInputs || farm.indigenousPractices || farm.pestControl;
    const hasSoil = farm.soilTypes;
    
    if (hasAgro && hasSoil) {
      color = '#10b981'; // Green (Active Agroecology)
    } else if (hasAgro || hasSoil) {
      color = '#f59e0b'; // Amber (Transitioning)
    } else {
      color = '#ef4444'; // Red (Convention/Unknown)
    }
  } else if (farm.formType === 'solidarity') {
    color = '#8b5cf6'; // Purple
  } else if (farm.formType === 'homestead') {
    color = '#2563eb'; // Blue (Verified Base)
  }

  const icon = farm.formType === 'homestead' ? 'home' : 'leaf';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><i class="fas fa-${icon}" style="color: white; font-size: 10px;"></i></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const FarmDataMap: React.FC<FarmDataMapProps> = ({ data, isSystemDev, onRefresh }) => {
  const mapCenter = { lat: -1.2921, lng: 36.8219 }; // Default to Nairobi
  const [selectedFarmForAI, setSelectedFarmForAI] = useState<FarmFormsData | null>(null);

  const handleDeleteRecord = async (record: FarmFormsData) => {
    try {
      if (record.fromPages) {
        const { error } = await supabase
          .from('pages')
          .delete()
          .eq('id', record.dbRowId || record.id);
        
        if (error) throw error;
      } else {
        const dbTable = record.formType === 'homestead' ? 'farm_baselines' : 'farm_activity_logs';
        
        // 1. Delete from Supabase
        const { error } = await supabase
          .from(dbTable)
          .delete()
          .eq('id', record.id);
        
        if (error) throw error;

        // 2. Delete from Local WatermelonDB
        const localTable = record.formType === 'homestead' ? 'farm_baselines' : 'activity_logs';
        await database.write(async () => {
          const localRecords = await database.get(localTable)
            .query(Q.where('id', record.id))
            .fetch();
          
          if (localRecords.length > 0) {
            await localRecords[0].destroyPermanently();
          }
        });
      }

      console.log('Record deleted successfully.');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">Farm Data & Soil Health Map</h2>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Active Agroecology</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Transitioning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Convention/Attention Needed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-purple-500"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Solidarity Mission</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">Verified Homestead Base</span>
          </div>
        </div>

        <div className="h-[500px] rounded-2xl overflow-hidden border border-slate-200">
          <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
            <MapResizer />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {data.filter(d => d.location).map((d) => (
              <Marker 
                key={d.id} 
                position={[d.location!.lat, d.location!.lng]}
                icon={getMarkerIcon(d)}
              >
                <Popup autoPan={false}>
                  <div className="p-2 min-w-[220px]">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-black text-xs uppercase tracking-widest text-emerald-700">
                        {d.formType === 'weekly' ? 'Weekly Activity' : d.formType.toUpperCase()}
                      </h3>
                      {d.gpsVerified ? (
                        <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase">Verified GPS</span>
                      ) : (
                        <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase">Manual Location</span>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 mt-3">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Homestead Name</p>
                        <p className="text-[11px] font-black text-slate-800">{d.homesteadName || d.homesteadVisitedName || d.farmName || 'General Plot'}</p>
                      </div>

                      <div className="flex justify-between gap-4 mt-2">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Owner/Farmer</p>
                          <p className="text-[10px] font-bold text-slate-700">{d.farmerName || 'Registered Member'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Cooperative</p>
                          <p className="text-[10px] font-bold text-slate-700">{d.foodCoop || d.agentCluster}</p>
                        </div>
                      </div>
                      
                      {d.organicInputs && (
                        <div className="mt-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
                          <p className="text-[10px] font-black text-emerald-800 uppercase">Organic Inputs</p>
                          <p className="text-[11px] text-emerald-700 italic leading-tight">{d.organicInputs}</p>
                        </div>
                      )}

                      {d.harvestedProducts && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-[10px] font-black text-blue-800 uppercase">Harvest Details</p>
                          <p className="text-[11px] text-blue-700 truncate leading-tight">{d.harvestedProducts}</p>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFarmForAI(d);
                      }}
                      className="mt-4 w-full bg-slate-900 hover:bg-black text-white py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg"
                    >
                      <i className="fas fa-brain"></i>
                      Agroecology AI Engine
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">Submitted Forms Registry</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Homestead & Owner</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cooperative</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Soil/Activities Log</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">GPS Status</th>
                {isSystemDev && <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-slate-700">{new Date(d.submittedAt).toLocaleDateString()}</td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      d.formType === 'weekly' ? 'bg-emerald-100 text-emerald-700' :
                      d.formType === 'solidarity' ? 'bg-purple-100 text-purple-700' :
                      d.formType === 'homestead' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {d.formType === 'weekly' ? 'Daily Update' : d.formType === 'homestead' ? 'Plot Base' : d.formType}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">{d.homesteadName || d.homesteadVisitedName || d.farmName || 'General Plot'}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Owner: {d.farmerName || d.farmer_name || 'Member'}</span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm font-bold text-slate-700">{d.foodCoop || d.agentCluster}</td>
                  <td className="py-4 px-4 max-w-xs transition-all cursor-default group relative">
                    <div className="text-[10px] text-slate-600 line-clamp-2 leading-relaxed">
                      {d.soilTypes && <span className="font-black text-emerald-600 block">Soil: {d.soilTypes}</span>}
                      {d.weeklyActivities && <span>Activities: {d.weeklyActivities}</span>}
                      {d.workDone && <span>Work: {d.workDone?.join(', ')}</span>}
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    {d.location ? (
                      <div className="flex flex-col">
                        <span className={d.gpsVerified ? "text-emerald-600 font-bold text-[10px]" : "text-amber-500 font-bold text-[10px]"}>
                          <i className={d.gpsVerified ? "fas fa-check-circle" : "fas fa-map-marker-alt"}></i> {d.gpsVerified ? 'VERIFIED' : 'MANUAL'}
                        </span>
                        <span className="text-[8px] text-slate-400 font-mono tracking-tighter">{d.location.lat.toFixed(4)}, {d.location.lng.toFixed(4)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-[10px] font-bold"><i className="fas fa-times-circle"></i> NO COORDS</span>
                    )}
                  </td>
                  {isSystemDev && (
                    <td className="py-4 px-4 text-right">
                      <button 
                        onClick={() => handleDeleteRecord(d)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Record"
                      >
                        <i className="fas fa-trash-alt"></i>
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {data.length === 0 && (
                <tr key="empty-row">
                  <td colSpan={isSystemDev ? 7 : 6} className="py-8 text-center text-slate-500 font-bold">No forms submitted yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedFarmForAI && (
        <AIAnalysisModal 
          farm={selectedFarmForAI} 
          onClose={() => setSelectedFarmForAI(null)} 
        />
      )}
    </div>
  );
};

export default FarmDataMap;
