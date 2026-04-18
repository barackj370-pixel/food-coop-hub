import React, { useMemo } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity } from '../types';

export const AuditLogTable = ({ data, title, onEdit, groupBy = 'cluster', isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord }: { data: SaleRecord[], title: string, onEdit?: (r: SaleRecord) => void, groupBy?: 'cluster' | 'date' | 'cluster_and_date', isSystemDev: boolean, agentIdentity: AgentIdentity | null, currentPortal: string, marketView: string, handleDeleteRecord: (id: string) => void }) => {
    // Explicitly type groupedData with useMemo to fix "Property ... does not exist on type 'unknown'"
    const groupedData = useMemo<Record<string, SaleRecord[]>>(() => data.reduce((acc: Record<string, SaleRecord[]>, r) => {
        let key = r.cluster || 'Unassigned';
        if (groupBy === 'date') {
          key = r.date || 'Unknown Date';
        } else if (groupBy === 'cluster_and_date') {
          key = `${r.cluster || 'Unassigned'} | ${r.date || 'Unknown Date'}`;
        }
        if (!acc[key]) acc[key] = [];
        acc[key].push(r);
        return acc;
      }, {} as Record<string, SaleRecord[]>), [data, groupBy]);
    
    // Convert to keys array to ensure safe iteration, sort dates descending if grouped by date
    const groups = Object.keys(groupedData).sort((a, b) => {
      if (groupBy === 'date') {
        return new Date(b).getTime() - new Date(a).getTime();
      }
      if (groupBy === 'cluster_and_date') {
        const [clusterA, dateA] = a.split(' | ');
        const [clusterB, dateB] = b.split(' | ');
        if (clusterA !== clusterB) return clusterA.localeCompare(clusterB);
        return new Date(dateB).getTime() - new Date(dateA).getTime();
      }
      return a.localeCompare(b);
    });

    const grandTotalVolume = useMemo(() => data.reduce((sum, r) => sum + Number(r.totalSale), 0), [data]);
    const grandTotalCommission = useMemo(() => data.reduce((sum, r) => sum + Number(r.coopProfit), 0), [data]);

    const getStatusBadgeColor = (status: string) => {
      if (status === RecordStatus.VERIFIED) return 'bg-green-100 text-green-700';
      if (status === RecordStatus.COMPLETE || status === RecordStatus.PAID) return 'bg-blue-50 text-blue-700'; // Order Complete
      return 'bg-red-50 text-red-600'; // Pending Order / Draft
    };

    // Helper to check if record is editable
    const isEditable = (r: SaleRecord) => {
      // Only pending orders can be edited
      const isPending = r.status === RecordStatus.PENDING || r.status === RecordStatus.DRAFT;
      
      if (!isPending) return false;

      // If pending, allow System Dev or the Original Agent (using normalized phone check)
      const normalizePhone = (phone?: string | null) => phone ? phone.replace(/\D/g, '') : '';
      return isSystemDev || (normalizePhone(agentIdentity?.phone) === normalizePhone(r.agentPhone));
    };

    return (
      <div className="space-y-12">
        <h3 className="text-sm font-black text-black uppercase tracking-tighter ml-2">{title} ({data.length})</h3>
        {groups.map((groupKey) => {
          const records = groupedData[groupKey];
          const groupTotalGross = records.reduce((sum, r) => sum + Number(r.totalSale), 0);
          const groupTotalComm = records.reduce((sum, r) => sum + Number(r.coopProfit), 0);

          return (
            <div key={groupKey} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg overflow-x-auto">
              <h4 className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-6 border-b border-red-50 pb-3 flex items-center justify-between">
                <span>
                  {groupBy === 'date' ? <i className="fas fa-calendar-alt mr-2"></i> : <i className="fas fa-map-marker-alt mr-2"></i>}
                  {groupBy === 'date' ? 'Date: ' : groupBy === 'cluster_and_date' ? 'Food Coop & Date: ' : 'Food Coop: '} {groupKey}
                </span>
                <span className="text-slate-400 font-bold">{records.length} Transactions</span>
              </h4>
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <tr><th className="pb-6">{groupBy === 'date' ? 'Food Coop' : groupBy === 'cluster_and_date' ? 'Date' : 'Date'}</th><th className="pb-6">Participants</th><th className="pb-6">Commodity</th><th className="pb-6">Qty Sold</th><th className="pb-6">Unit Price</th><th className="pb-6">Gross Sale</th><th className="pb-6">Coop Commission (10%)</th><th className="pb-6 text-right">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(r => (
                    <tr key={r.id} className="text-[11px] font-bold group hover:bg-slate-50/50">
                      <td className="py-6 text-slate-400">
                        {groupBy === 'date' ? (r.cluster || 'Unassigned') : r.date}
                        {r.synced === false && (
                          <span className="block text-[8px] text-red-500 font-black uppercase mt-1">Pending Sync</span>
                        )}
                      </td>
                      <td className="py-6">
                        <div className="space-y-1">
                          <p className="text-black font-black uppercase text-[10px]">Agent: {r.agentName} ({r.agentPhone})</p>
                          <p className="text-slate-500 font-bold text-[9px]">Supplier: {r.farmerName} ({r.farmerPhone})</p>
                          <p className="text-slate-500 font-bold text-[9px]">Buyer: {r.customerName} ({r.customerPhone})</p>
                        </div>
                      </td>
                      <td className="py-6 text-black uppercase">{r.cropType}</td>
                      <td className="py-6 text-black font-medium">{r.unitsSold} {r.unitType}</td>
                      <td className="py-6 text-black font-medium">KSh {Number(r.unitPrice).toLocaleString()}</td>
                      <td className="py-6 font-black text-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                      <td className="py-6 font-black text-green-600">KSh {Number(r.coopProfit).toLocaleString()}</td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${getStatusBadgeColor(r.status)}`}>{r.status}</span>
                          
                          {onEdit && currentPortal === 'MARKET' && marketView === 'SALES' && isEditable(r) && (
                             <button onClick={(e) => { e.stopPropagation(); onEdit(r); }} className="text-slate-300 hover:text-blue-600 transition-colors p-1">
                               <i className="fas fa-edit text-[10px]"></i>
                             </button>
                          )}
                          {(agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity?.role === SystemRole.MANAGER) && (
                             <button onClick={(e) => { e.stopPropagation(); handleDeleteRecord(r.id); }} className="text-slate-300 hover:text-red-600 transition-colors p-1 ml-2">
                               <i className="fas fa-trash-can text-[10px]"></i>
                             </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end items-center gap-8">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{groupBy === 'date' ? 'Daily' : groupBy === 'cluster_and_date' ? 'Daily Food Coop' : 'Food Coop'} Sales Volume</p>
                  <p className="text-sm font-black text-black">KSh {groupTotalGross.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Commission</p>
                  <p className="text-sm font-black text-green-600">KSh {groupTotalComm.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Ledger Grand Totals */}
        {data.length > 0 && (
            <div className="bg-slate-900 rounded-[2rem] p-8 border border-black shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h4 className="text-white text-lg font-black uppercase tracking-tight">Ledger Grand Totals</h4>
                    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Aggregate across all Food Coops</p>
                </div>
                <div className="flex gap-8">
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Sales Volume</p>
                        <p className="text-2xl font-black text-white">KSh {grandTotalVolume.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] font-black text-green-400 uppercase tracking-widest mb-1">Total Commission</p>
                        <p className="text-2xl font-black text-green-500">KSh {grandTotalCommission.toLocaleString()}</p>
                    </div>
                </div>
            </div>
        )}
      </div>
    );
  };
export default AuditLogTable;
