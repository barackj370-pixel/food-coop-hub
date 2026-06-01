import React, { useMemo } from 'react';
import { SaleRecord, RecordStatus, SystemRole, AgentIdentity } from '../types';

interface AuditLogTableProps {
  data: SaleRecord[];
  title: string;
  onEdit?: (r: SaleRecord) => void;
  groupBy?: 'cluster' | 'date' | 'cluster_and_date';
  isSystemDev: boolean;
  agentIdentity: AgentIdentity | null;
  currentPortal: string;
  marketView: string;
  handleDeleteRecord: (id: string) => void;
}

interface WeeklyCoopSummary {
  cluster: string;
  buyingTotal: number;
  sellingTotal: number;
  commissionTotal: number;
  entryCount: number;
}

interface WeeklyGroup {
  weekLabel: string;
  coops: WeeklyCoopSummary[];
  grandBuying: number;
  grandSelling: number;
  grandCommission: number;
}

const getWeekRange = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown Week';
    const day = d.getDay();
    // getDay() is 0 for Sunday, 1 for Monday, etc. Adjust properly:
    const diff = d.getDate() - (day === 0 ? 6 : day - 1);
    const monday = new Date(d);
    monday.setDate(diff);
    
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    
    const formatDate = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const dayVal = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayVal}`;
    };
    return `Week of ${formatDate(monday)} to ${formatDate(sunday)}`;
  } catch (e) {
    return 'Unknown Week';
  }
};

export const AuditLogTable: React.FC<AuditLogTableProps> = ({ 
  data, 
  title, 
  onEdit, 
  isSystemDev, 
  agentIdentity, 
  currentPortal, 
  marketView, 
  handleDeleteRecord 
}) => {
  // Sort records descending by date (latest first)
  const sortedRecords = useMemo(() => {
    return [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  // Aggregate totals
  const totalBuying = useMemo(() => data.reduce((sum, r) => sum + Number(r.buyingPrice || 0), 0), [data]);
  const totalSelling = useMemo(() => data.reduce((sum, r) => sum + Number(r.totalSale || 0), 0), [data]);
  const totalCommission = useMemo(() => data.reduce((sum, r) => sum + Number(r.coopProfit || 0), 0), [data]);

  // Group aggregate data weekly with grand totals and coop level summaries
  const weeklyGroups = useMemo<WeeklyGroup[]>(() => {
    const groups: { [weekLabel: string]: { [cluster: string]: WeeklyCoopSummary } } = {};
    
    data.forEach(r => {
      const weekLabel = getWeekRange(r.date);
      const cluster = r.cluster || 'Unassigned';
      
      if (!groups[weekLabel]) {
        groups[weekLabel] = {};
      }
      
      if (!groups[weekLabel][cluster]) {
        groups[weekLabel][cluster] = {
          cluster,
          buyingTotal: 0,
          sellingTotal: 0,
          commissionTotal: 0,
          entryCount: 0
        };
      }
      
      groups[weekLabel][cluster].buyingTotal += Number(r.buyingPrice || 0);
      groups[weekLabel][cluster].sellingTotal += Number(r.totalSale || 0);
      groups[weekLabel][cluster].commissionTotal += Number(r.coopProfit || 0);
      groups[weekLabel][cluster].entryCount += 1;
    });
    
    const result: WeeklyGroup[] = Object.entries(groups).map(([weekLabel, coopsMap]) => {
      const coopsList = Object.values(coopsMap);
      
      const grandBuying = coopsList.reduce((sum, item) => sum + item.buyingTotal, 0);
      const grandSelling = coopsList.reduce((sum, item) => sum + item.sellingTotal, 0);
      const grandCommission = coopsList.reduce((sum, item) => sum + item.commissionTotal, 0);
      
      return {
        weekLabel,
        coops: coopsList,
        grandBuying,
        grandSelling,
        grandCommission
      };
    });
    
    return result.sort((a, b) => b.weekLabel.localeCompare(a.weekLabel));
  }, [data]);

  const getStatusBadgeColor = (status: string) => {
    if (status === RecordStatus.VERIFIED) return 'bg-green-100 text-green-700 border-green-200';
    if (status === RecordStatus.COMPLETE || status === RecordStatus.PAID) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-red-50 text-red-600 border-red-200';
  };

  // Helper to check if record is editable
  const isEditable = (r: SaleRecord) => {
    const isPending = r.status === RecordStatus.PENDING || r.status === RecordStatus.DRAFT;
    if (!isPending) return false;
    const normalizePhone = (phone?: string | null) => phone ? phone.replace(/\D/g, '') : '';
    return isSystemDev || (normalizePhone(agentIdentity?.phone) === normalizePhone(r.agentPhone));
  };

  const getCommissionRuleLabel = (r: SaleRecord) => {
    const buying = r.buyingPrice || 0;
    const selling = r.totalSale || 0;
    const profit = Math.max(0, selling - buying);
    const comm = r.coopProfit;

    if (Math.abs(comm - (selling * 0.10)) < 0.5) {
      return '10% of Gross Sale';
    }
    if (Math.abs(comm - (profit * 0.10 + 1)) < 0.5) {
      return '10% + 1 of Profit';
    }
    if (Math.abs(comm - profit) < 0.5) {
      return '100% of Profit';
    }
    return 'Manual Custom Rate';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black text-black uppercase tracking-tight flex items-center gap-2">
          <i className="fas fa-file-invoice-dollar text-slate-400"></i>
          {title} <span className="text-[11px] font-bold text-slate-400">({data.length} Entries)</span>
        </h3>
      </div>

      {/* Weekly Market-Day Aggregates Performance Dashboard */}
      {data.length > 0 && weeklyGroups.length > 0 && (
        <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-200/80 shadow-md space-y-6">
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-green-100 text-green-700 rounded-2xl">
              <i className="fas fa-calendar-alt text-sm"></i>
            </span>
            <div>
              <h4 className="text-xs font-black text-black uppercase tracking-widest">Weekly Performance Dashboard</h4>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Weekly Aggregate Totals by Food Coops</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-6">
            {weeklyGroups.map((group) => (
              <div key={group.weekLabel} className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden p-6 space-y-4">
                <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-4 py-1.5 rounded-full uppercase tracking-wider font-mono">
                    {group.weekLabel}
                  </span>
                  <span className="text-[9px] font-extrabold text-green-600 uppercase tracking-widest">
                    Agreed Commission Breakdown
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[11px] font-bold border-collapse">
                    <thead>
                      <tr className="text-[8px] font-black text-slate-400 uppercase tracking-wider border-b border-slate-100">
                        <th className="py-2.5">Food Coop</th>
                        <th className="py-2.5 text-right">Aggregate Buying</th>
                        <th className="py-2.5 text-right">Aggregate Selling</th>
                        <th className="py-2.5 text-right">Coop Commission</th>
                        <th className="py-2.5 text-center">Entries</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.coops.map((coop) => (
                        <tr key={coop.cluster} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 text-slate-900 uppercase">{coop.cluster}</td>
                          <td className="py-3 text-right text-slate-600">KSh {coop.buyingTotal.toLocaleString()}</td>
                          <td className="py-3 text-right text-black font-extrabold">KSh {coop.sellingTotal.toLocaleString()}</td>
                          <td className="py-3 text-right text-green-600">KSh {coop.commissionTotal.toLocaleString()}</td>
                          <td className="py-3 text-center text-slate-400 font-mono">{coop.entryCount}</td>
                        </tr>
                      ))}
                      
                      {/* Weekly Grand Totals */}
                      <tr className="bg-slate-900 text-white font-black text-[11px] tracking-wide">
                        <td className="py-4 px-3 rounded-l-2xl uppercase text-slate-300">Week's Grand Totals</td>
                        <td className="py-4 text-right font-mono text-slate-200">KSh {group.grandBuying.toLocaleString()}</td>
                        <td className="py-4 text-right font-mono text-white">KSh {group.grandSelling.toLocaleString()}</td>
                        <td className="py-4 text-right font-mono text-green-400">KSh {group.grandCommission.toLocaleString()}</td>
                        <td className="py-4 rounded-r-2xl text-center text-slate-500 font-mono">-</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <th className="py-5 px-8">Date</th>
                <th className="py-5 px-6">Food Coop</th>
                <th className="py-5 px-6 text-right">Aggregate Buying Price</th>
                <th className="py-5 px-6 text-right">Aggregate Selling Price</th>
                <th className="py-5 px-6 text-right">Coop Commission</th>
                <th className="py-5 px-8 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11.5px] font-bold">
              {sortedRecords.length > 0 && (
                sortedRecords.map((r) => {
                  const buyingVal = r.buyingPrice || 0;
                  const ruleLabel = getCommissionRuleLabel(r);
                  return (
                    <tr key={r.id} className="group hover:bg-slate-50/40 transition-colors">
                      {/* Date */}
                      <td className="py-5 px-8 text-black">
                        <div className="font-mono">{r.date}</div>
                        {r.synced === false && (
                          <span className="inline-block text-[8px] text-red-500 font-extrabold uppercase mt-0.5">Pending Sync</span>
                        )}
                      </td>
                      {/* Food Coop */}
                      <td className="py-5 px-6 text-slate-900 uppercase">
                        {r.cluster || 'Unassigned'}
                      </td>
                      {/* Aggregate Buying Price */}
                      <td className="py-5 px-6 text-right text-slate-600 font-black">
                        KSh {buyingVal.toLocaleString()}
                      </td>
                      {/* Aggregate Selling Price */}
                      <td className="py-5 px-6 text-right text-black font-black">
                        KSh {Number(r.totalSale).toLocaleString()}
                      </td>
                      {/* Calculated Coop Commission */}
                      <td className="py-5 px-6 text-right">
                        <div className="font-black text-green-600">
                          KSh {Number(r.coopProfit).toLocaleString()}
                        </div>
                        <div className="text-[8.5px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">
                          {ruleLabel}
                        </div>
                      </td>
                      {/* Status + Actions */}
                      <td className="py-5 px-8">
                        <div className="flex items-center justify-center gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusBadgeColor(r.status)}`}>
                            {r.status}
                          </span>
                          
                          {/* Inline Edit Buttons */}
                          {onEdit && currentPortal === 'MARKET' && marketView === 'SALES' && isEditable(r) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onEdit(r); }} 
                              className="text-slate-300 hover:text-blue-600 transition-all p-2 hover:bg-blue-50 rounded-xl"
                              title="Edit Entry"
                            >
                              <i className="fas fa-edit text-[10px]"></i>
                            </button>
                          )}
                          {(agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity?.role === SystemRole.MANAGER) && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleDeleteRecord(r.id); }} 
                              className="text-slate-300 hover:text-red-600 transition-all p-2 hover:bg-red-50 rounded-xl"
                              title="Delete Record"
                            >
                              <i className="fas fa-trash-can text-[10px]"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {/* Weekly Aggregated Totals at the bottom */}
            {data.length > 0 && (
              <tfoot>
                <tr className="bg-slate-900 text-white font-black text-[12px] uppercase border-t border-black">
                  <td colSpan={2} className="py-7 px-8 tracking-wider text-slate-300">
                    Weekly Aggregated Totals
                  </td>
                  <td className="py-7 px-6 text-right font-mono text-slate-200 font-extrabold">
                    KSh {totalBuying.toLocaleString()}
                  </td>
                  <td className="py-7 px-6 text-right font-mono text-white font-black">
                    KSh {totalSelling.toLocaleString()}
                  </td>
                  <td className="py-7 px-6 text-right font-mono text-green-400 font-black">
                    KSh {totalCommission.toLocaleString()}
                  </td>
                  <td colSpan={1} className="py-7 px-8 text-center text-slate-500 text-[10px] tracking-widest font-bold">
                    VERIFIED LEDGER
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default AuditLogTable;
