import React, { useMemo, useState } from 'react';
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

interface WeeklyGroup {
  weekLabel: string;
  records: SaleRecord[];
  grandBuying: number;
  grandSelling: number;
  grandCommission: number;
}

const getWeekRange = (dateStr: string) => {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Unknown Week';
    
    // Calculate week of month (1 to 4)
    const dayOfMonth = d.getDate();
    let weekNumber = Math.ceil(dayOfMonth / 7);
    if (weekNumber > 4) weekNumber = 4; // cap at 4 as requested
    
    const monthName = d.toLocaleString('en-US', { month: 'long' });
    return `${monthName} ${d.getFullYear()} - Week ${weekNumber}`;
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sort records descending by date (latest first)
  const sortedRecords = useMemo(() => {
    return [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [data]);

  // Aggregate totals
  const totalBuying = useMemo(() => data.reduce((sum, r) => sum + Number(r.buyingPrice || 0), 0), [data]);
  const totalSelling = useMemo(() => data.reduce((sum, r) => sum + Number(r.totalSale || 0), 0), [data]);
  const totalCommission = useMemo(() => data.reduce((sum, r) => sum + Number(r.coopProfit || 0), 0), [data]);

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

  // Group aggregate data weekly with grand totals
  const weeklyGroups = useMemo<WeeklyGroup[]>(() => {
    const groups: { [weekLabel: string]: SaleRecord[] } = {};
    
    data.forEach(r => {
      const weekLabel = getWeekRange(r.date);
      if (!groups[weekLabel]) groups[weekLabel] = [];
      groups[weekLabel].push(r);
    });
    
    const result: WeeklyGroup[] = Object.entries(groups).map(([weekLabel, weekRecords]) => {
      const grandBuying = weekRecords.reduce((sum, item) => sum + Number(item.buyingPrice || 0), 0);
      const grandSelling = weekRecords.reduce((sum, item) => sum + Number(item.totalSale || 0), 0);
      const grandCommission = weekRecords.reduce((sum, item) => sum + Number(item.coopProfit || 0), 0);
      
      // Sort records by date descending inside the week
      const sortedRecords = [...weekRecords].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      return {
        weekLabel,
        records: sortedRecords,
        grandBuying,
        grandSelling,
        grandCommission
      };
    });
    
    // Sort weeks by their most recent record date
    return result.sort((a, b) => {
      const dateA = a.records[0]?.date || '';
      const dateB = b.records[0]?.date || '';
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [data]);

  const getStatusBadgeColor = (status: string) => {
    if (status === RecordStatus.VERIFIED) return 'bg-green-100 text-green-700 border-green-200';
    if (status === RecordStatus.COMPLETE || status === RecordStatus.PAID) return 'bg-blue-50 text-blue-700 border-blue-200';
    return 'bg-red-50 text-red-600 border-red-200';
  };

  // Helper to check if record is editable
  const isEditable = (r: SaleRecord) => {
    // Only sales agents can edit
    if (agentIdentity?.role !== SystemRole.SALES_AGENT) return false;
    
    // Only if not confirmed receipt (e.g. pending/draft)
    const isPending = r.status === RecordStatus.PENDING || r.status === RecordStatus.DRAFT;
    if (!isPending) return false;
    
    // Check if the current sales agent owns the record
    const normalizePhone = (phone?: string | null) => phone ? phone.replace(/\D/g, '') : '';
    return (normalizePhone(agentIdentity?.phone) === normalizePhone(r.agentPhone));
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
                        <th className="py-2.5 text-center">Status & Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.records.map((record) => (
                        <tr key={record.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-3 text-slate-900 uppercase">{record.cluster || 'Unassigned'}</td>
                          <td className="py-3 text-right text-slate-600">KSh {Number(record.buyingPrice || 0).toLocaleString()}</td>
                          <td className="py-3 text-right text-black font-extrabold">KSh {Number(record.totalSale || 0).toLocaleString()}</td>
                          <td className="py-3 text-right">
                            <div className="font-black text-green-600">
                              KSh {Number(record.coopProfit || 0).toLocaleString()}
                            </div>
                            <div className="text-[8.5px] font-black text-slate-400 uppercase tracking-tighter mt-0.5">
                              {getCommissionRuleLabel(record)}
                            </div>
                            <div className="text-[8.5px] font-black text-slate-400 font-mono mt-0.5">
                              {record.date}
                            </div>
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-3">
                              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${getStatusBadgeColor(record.status)}`}>
                                {record.status}
                              </span>
                              {record.synced === false && (
                                <span className="inline-block text-[8px] text-red-500 font-extrabold uppercase mt-0.5">Pending</span>
                              )}
                              {onEdit && isEditable(record) && (
                                <button 
                                  onClick={(e) => { e.stopPropagation(); onEdit(record); }} 
                                  className="text-slate-300 hover:text-blue-600 transition-all p-2 hover:bg-blue-50 rounded-xl"
                                  title="Edit Entry"
                                >
                                  <i className="fas fa-edit text-[10px]"></i>
                                </button>
                              )}
                              {(agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity?.role === SystemRole.MANAGER) && (
                                confirmDeleteId === record.id ? (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); handleDeleteRecord(record.id); }} 
                                    className="text-white hover:bg-red-700 bg-red-600 transition-all p-2 rounded-xl"
                                    title="Confirm Delete"
                                  >
                                    <i className="fas fa-check text-[10px]"></i>
                                  </button>
                                ) : (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(record.id); }} 
                                    className="text-slate-300 hover:text-red-600 transition-all p-2 hover:bg-red-50 rounded-xl"
                                    title="Delete Record"
                                  >
                                    <i className="fas fa-trash-can text-[10px]"></i>
                                  </button>
                                )
                              )}
                            </div>
                          </td>
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

    </div>
  );
};

export default AuditLogTable;
