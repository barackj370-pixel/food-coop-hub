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
  formType: 'weekly' | 'solidarity' | 'homestead' | 'youth_assessment';
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
  users?: any[];
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
  } else if (farm.formType === 'youth_assessment') {
    color = '#f97316'; // Orange
  } else if (farm.formType === 'homestead') {
    color = '#2563eb'; // Blue (Verified Base)
  }

  const icon = farm.formType === 'homestead' ? 'home' : farm.formType === 'youth_assessment' ? 'child' : 'leaf';

  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="background-color: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><i class="fas fa-${icon}" style="color: white; font-size: 10px;"></i></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
  });
};

const FarmDataMap: React.FC<FarmDataMapProps> = ({ data, isSystemDev, users = [], onRefresh }) => {
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
        </div>

        <div className="h-[500px] rounded-[2rem] overflow-hidden border border-slate-200 relative group">
          <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
            <MapResizer />
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
            {data.filter(d => d.location && d.formType === 'homestead').map((d) => (
              <Marker 
                key={d.id} 
                position={[d.location!.lat, d.location!.lng]}
                icon={getMarkerIcon(d)}
              >
                <Popup autoPan={false}>
                  <div className="p-2 min-w-[220px]">
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-black text-xs uppercase tracking-widest text-emerald-700">
                        {d.formType === 'weekly' ? 'Weekly Activity' : d.formType === 'homestead' && !d.fromPages ? 'Plot Base' : d.formType === 'homestead' ? 'Homestead Details' : d.formType === 'youth_assessment' ? 'Youth Assessment' : d.formType.toUpperCase()}
                      </h3>
                      {d.gpsVerified ? (
                        <span className="text-[8px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full uppercase shrink-0 ml-2">Verified GPS</span>
                      ) : (
                        <span className="text-[8px] font-black bg-amber-100 text-amber-600 px-2 py-0.5 rounded-full uppercase shrink-0 ml-2">Manual</span>
                      )}
                    </div>
                    
                    <div className="space-y-1.5 mt-3">
                      <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase leading-none mb-1">Homestead Name</p>
                        <p className="text-[11px] font-black text-slate-800">{(d as any).householdName || d.homesteadName || d.homesteadVisitedName || d.farmName || 'General Plot'}</p>
                      </div>

                      <div className="flex justify-between gap-4 mt-2">
                        <div>
                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Farmer</p>
                          <p className="text-[10px] font-bold text-slate-700">
                             {(() => {
                              const phone = d.farmerPhone || d.homesteadContact || (d as any).parentPhone || (d as any).farmer_phone;
                               const user = users.find(u => u.phone === phone);
                               if (user && user.name) return user.name;
                               return (d as any).parentName || (d as any).parentNameField || d.farmerName || d.farmer_name || d.homesteadVisitedContact || 'Member';
                             })()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-slate-400 uppercase leading-none">Cooperative</p>
                          <p className="text-[10px] font-bold text-slate-700">{(d as any).foodCoopName || d.foodCoop || d.agentCluster}</p>
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
          {/* Overlay to inform users they are looking at 3D satellite imagery */}
          <div className="pointer-events-none absolute bottom-4 left-4 z-[400] bg-black/50 backdrop-blur border border-white/10 px-4 py-2 rounded-xl flex items-center gap-2 text-white shadow-xl">
             <i className="fas fa-satellite text-emerald-400"></i>
             <span className="text-[10px] font-black uppercase tracking-widest">Hi-Res Satellite Layer</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">Submitted Forms Registry</h2>
        <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 mb-8 border-b border-slate-100 pb-4">
          Categorized Reports
        </p>
        
        {/* HOMES / PLOT BASELINES */}
        <div className="mb-12">
          <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 mb-4">
             <i className="fas fa-home"></i> Homes (Registered Farm Baselines)
          </h3>
          <RegistryTable 
             items={data.filter(d => d.formType === 'homestead' && !d.fromPages)}
             isSystemDev={isSystemDev}
             handleDeleteRecord={handleDeleteRecord}
             typeLabel="Plot Base"
             users={users}
          />
        </div>

        {/* FARM ACTIVITIES */}
        <div className="mb-12">
          <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 mb-4">
             <i className="fas fa-leaf"></i> Farm Activities (Weekly Reports)
          </h3>
          <RegistryTable 
             items={data.filter(d => d.formType === 'weekly')}
             isSystemDev={isSystemDev}
             handleDeleteRecord={handleDeleteRecord}
             typeLabel="Daily Update"
             users={users}
          />
        </div>

        {/* LABOR SOLIDARITY */}
        <div className="mb-12">
          <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 mb-4">
             <i className="fas fa-users"></i> Labor Solidarity
          </h3>
          <RegistryTable 
             items={data.filter(d => d.formType === 'solidarity')}
             isSystemDev={isSystemDev}
             handleDeleteRecord={handleDeleteRecord}
             typeLabel="Solidarity"
             users={users}
          />
        </div>

        {/* YOUTH ASSESSMENT (FORM C) */}
        <div className="mb-12">
          <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 mb-4">
             <i className="fas fa-child"></i> National Youth Assessment (Form C)
          </h3>
          <RegistryTable 
             items={data.filter(d => d.formType === 'youth_assessment')}
             isSystemDev={isSystemDev}
             handleDeleteRecord={handleDeleteRecord}
             typeLabel="Youth Assessment"
             users={users}
          />
        </div>

        {/* HOMESTEAD FARMER */}
        <div className="mb-4">
          <h3 className="text-sm font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2 mb-4">
             <i className="fas fa-user-circle"></i> Homestead Data
          </h3>
          <RegistryTable 
             items={data.filter(d => d.formType === 'homestead' && d.fromPages)}
             isSystemDev={isSystemDev}
             handleDeleteRecord={handleDeleteRecord}
             typeLabel="Homestead Details"
             users={users}
          />
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

// Helper component to keep the file cleaner
const RegistryTable = ({ items, isSystemDev, handleDeleteRecord, typeLabel, users = [] }: any) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingAttendees, setViewingAttendees] = useState<any>(null);
  return (
        <div className="overflow-x-auto border border-slate-100 rounded-2xl">
          <table className="w-full text-left border-collapse bg-white">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Homestead</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cooperative</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">GPS Status</th>
                {isSystemDev && <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((d: any) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-slate-700">{new Date(d.submittedAt).toLocaleDateString()}</span>
                    <span className={`block mt-1 px-2 py-0.5 w-fit rounded-full text-[8px] font-black uppercase tracking-widest ${
                      d.formType === 'weekly' ? 'bg-emerald-100 text-emerald-700' :
                      d.formType === 'solidarity' ? 'bg-purple-100 text-purple-700' :
                      d.formType === 'youth_assessment' ? 'bg-orange-100 text-orange-700' :
                      typeLabel === 'Plot Base' ? 'bg-blue-100 text-blue-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {typeLabel}
                    </span>
                  </td>
                  <td className="py-4 px-4 min-w-[200px]">
                    <div className="flex flex-col">
                      <span className="text-sm font-black text-slate-900">{d.householdName || d.homesteadName || d.homesteadVisitedName || d.farmName || 'General Plot'}</span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                        {(() => {
                          const phone = d.farmerPhone || d.homesteadContact || (d as any).parentPhone || (d as any).farmer_phone;
                          const user = users.find((u: any) => u.phone === phone);
                          if (user && user.name) return user.name;
                          return (d as any).parentName || (d as any).parentNameField || d.farmerName || (d as any).farmer_name || d.homesteadVisitedContact || 'Member';
                        })()}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-sm font-bold text-slate-700">{d.foodCoopName || d.foodCoop || d.agentCluster}</td>
                  <td className="py-4 px-4 min-w-[250px]">
                    <div className={`text-[10px] text-slate-600 leading-relaxed ${expandedId === d.id ? "" : "line-clamp-3"}`}>
                      {d.formType === 'youth_assessment' ? (
                        <>
                          <span className="font-black text-emerald-600 block">Assessment: {d.householdName || 'Household'} ({d.foodCoopName || d.foodCoop || 'No Coop'})</span>
                          <span className="block mt-0.5"><b>Parent:</b> {d.parentNameField || d.parentName || 'N/A'} | <b>Phone:</b> {d.parentPhone || 'N/A'}</span>
                          {d.youthList && d.youthList.length > 0 && (
                            <span className="block mt-0.5 text-slate-500">
                              <b>Youth ({d.youthList.length}):</b> {d.youthList.map((y: any) => `${y.name} (${y.grade})`).join(', ')}
                            </span>
                          )}
                          {d.seedsList && d.seedsList.length > 0 && (
                            <span className="block mt-0.5 text-emerald-500">
                              <b>Seeds:</b> {d.seedsList.map((s: any) => s.cropSeed).filter(Boolean).join(', ')}
                            </span>
                          )}
                          {(d.parentName || d.parentNameField) && (
                            <span className="block mt-1 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                              <i className="fas fa-signature text-blue-500"></i> Digitally Signed by {d.parentName || d.parentNameField}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          {d.soilTypes && <span className="font-black text-emerald-600 block">Soil: {d.soilTypes}</span>}
                          {d.weeklyActivities && <span className="block mt-0.5">Activities: {d.weeklyActivities}</span>}
                          {d.agentName && <span className="block mt-0.5 text-indigo-600 font-bold text-[10px]">Data Entry Agent: {d.agentName} {d.agentPhone ? `(${d.agentPhone})` : ''}</span>}
                          {d.workDone && <span className="block mt-0.5">Work: {d.workDone?.join(', ')}</span>}
                          {d.productionOfficerName && <span className="block mt-0.5 text-slate-500 italic">Officer: {d.productionOfficerName}</span>}
                          {d.totalParticipants && <span className="block mt-1 text-[11px] text-blue-800 font-bold uppercase tracking-widest"><i className="fas fa-users"></i> Total Attendees: {d.totalParticipants}</span>}
                          {d.participants && (
                            <button 
                              onClick={() => setViewingAttendees(d)}
                              className="block mt-2 text-[10px] bg-blue-50 text-blue-600 font-bold px-3 py-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100 w-fit text-left"
                            >
                              <i className="fas fa-list-ul"></i> Click to View All Attendees
                            </button>
                          )}
                          {d.workDone && <span className="block mt-0.5 font-bold text-[10px] text-slate-600">Work Done: {Array.isArray(d.workDone) ? d.workDone.join(', ') : d.workDone}</span>}
                          {d.otherWork && <span className="block mt-0.5 font-bold text-[10px] text-slate-600">Other Work: {d.otherWork}</span>}
                          {d.solidarityPic1Url && (
                            <div className="mt-2">
                              <img src={d.solidarityPic1Url} alt="Solidarity Evidence" className="w-16 h-16 object-cover rounded-md border border-slate-200" />
                            </div>
                          )}

                        </>
                      )}
                    </div>
                    {/* Show More Button if content is likely truncated */}
                    {((d.participants && d.participants.length > 50) || (d.youthList && d.youthList.length > 3)) && (
                      <button 
                        onClick={() => setExpandedId(expandedId === d.id ? null : d.id)} 
                        className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-2 hover:text-emerald-800 transition-colors bg-emerald-50 px-2 py-1 rounded"
                      >
                        {expandedId === d.id ? "Show Less" : "View All Details"}
                      </button>
                    )}
                  </td>
                  <td className="py-4 px-4 whitespace-nowrap">
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
              {items.length === 0 && (
                <tr key="empty-row">
                  <td colSpan={isSystemDev ? 6 : 5} className="py-8 text-center text-slate-400 font-bold uppercase text-[10px] tracking-widest">No forms submitted in this category yet.</td>
                </tr>
              )}
            </tbody>
          </table>
      {viewingAttendees && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-black text-slate-800 mb-4 flex items-center gap-2">
              <i className="fas fa-users text-emerald-600"></i> Attendees List
            </h3>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap text-sm text-slate-700 font-medium">
              {viewingAttendees.participants}
            </div>
            <div className="mt-6 flex justify-end">
              <button 
                onClick={() => setViewingAttendees(null)}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors"
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

export default FarmDataMap;
