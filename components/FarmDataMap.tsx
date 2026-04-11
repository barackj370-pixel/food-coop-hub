import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface FarmFormsData {
  id: string;
  formType: 'weekly' | 'solidarity' | 'homestead';
  location: { lat: number; lng: number } | null;
  submittedAt: string;
  agentCluster: string;
  
  // Weekly
  date?: string;
  foodCoop?: string;
  
  // Solidarity
  productionOfficeName?: string;
  productionOfficeContact?: string;
  workDone?: string[];
  homesteadVisitedName?: string;
  homesteadVisitedContact?: string;
  participants?: string;
  
  // Homestead
  productionOfficerName?: string;
  productionOfficerContact?: string;
  convenerName?: string;
  convenerContact?: string;
  totalParticipants?: string;
  soilTypes?: string;
  waterSource?: string;
  farmInputs?: string;
  wasteTypes?: string;
  wasteHandling?: string;
  productsToSupply?: string;
  homesteadName?: string;
  homesteadContact?: string;
  cropsGrown?: string;
  livestockKept?: string;
  weeklyActivities?: string;
  challengesFaced?: string;
  foodConsumed?: string;
  amountSpent?: string;
  foodSource?: string;
  productsNeeded?: string;
  harvestedProducts?: string;
  soilErosion?: string;
  erosionStrategies?: string;
}

interface FarmDataMapProps {
  data: FarmFormsData[];
}

const FarmDataMap: React.FC<FarmDataMapProps> = ({ data }) => {
  const mapCenter = { lat: -1.2921, lng: 36.8219 }; // Default to Nairobi

  return (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">Farm Data Map</h2>
        <div className="h-[500px] rounded-2xl overflow-hidden border border-slate-200">
          <MapContainer center={mapCenter} zoom={6} style={{ height: '100%', width: '100%' }}>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {data.filter(d => d.location).map((d) => (
              <Marker key={d.id} position={[d.location!.lat, d.location!.lng]}>
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-sm mb-1">{d.formType.toUpperCase()} FORM</h3>
                    <p className="text-xs text-slate-600 mb-2">Submitted: {new Date(d.submittedAt).toLocaleDateString()}</p>
                    
                    {d.formType === 'homestead' && (
                      <>
                        <p className="text-xs"><strong>Homestead:</strong> {d.homesteadName}</p>
                        <p className="text-xs"><strong>Coop:</strong> {d.agentCluster}</p>
                        <p className="text-xs"><strong>Soil:</strong> {d.soilTypes}</p>
                      </>
                    )}
                    {d.formType === 'solidarity' && (
                      <>
                        <p className="text-xs"><strong>Homestead Visited:</strong> {d.homesteadVisitedName}</p>
                        <p className="text-xs"><strong>Coop:</strong> {d.agentCluster}</p>
                        <p className="text-xs"><strong>Work Done:</strong> {d.workDone?.join(', ')}</p>
                      </>
                    )}
                    {d.formType === 'weekly' && (
                      <>
                        <p className="text-xs"><strong>Coop:</strong> {d.foodCoop || d.agentCluster}</p>
                        <p className="text-xs"><strong>Date:</strong> {d.date}</p>
                      </>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      </div>

      <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-2xl font-black text-slate-900 mb-6">Submitted Forms Data</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Food Coop</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Homestead</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Details</th>
                <th className="py-4 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">GPS Verified</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="py-4 px-4 text-sm font-bold text-slate-700">{new Date(d.submittedAt).toLocaleDateString()}</td>
                  <td className="py-4 px-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      d.formType === 'weekly' ? 'bg-blue-100 text-blue-700' :
                      d.formType === 'solidarity' ? 'bg-purple-100 text-purple-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {d.formType}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-sm font-bold text-slate-700">{d.foodCoop || d.agentCluster}</td>
                  <td className="py-4 px-4 text-sm font-bold text-slate-700">
                    {d.homesteadName || d.homesteadVisitedName || '-'}
                  </td>
                  <td className="py-4 px-4 text-xs text-slate-600 max-w-xs truncate">
                    {d.formType === 'homestead' && `Soil: ${d.soilTypes || '-'}`}
                    {d.formType === 'solidarity' && `Work: ${d.workDone?.join(', ') || '-'}`}
                    {d.formType === 'weekly' && `Activity Date: ${d.date || '-'}`}
                  </td>
                  <td className="py-4 px-4">
                    {d.location ? (
                      <span className="text-emerald-500"><i className="fas fa-check-circle"></i> Yes</span>
                    ) : (
                      <span className="text-slate-400"><i className="fas fa-times-circle"></i> No</span>
                    )}
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 font-bold">No forms submitted yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FarmDataMap;
