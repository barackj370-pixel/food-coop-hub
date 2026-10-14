import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabaseClient';
import { AgentIdentity, SystemRole } from '../types';

interface BankingEntry {
  id: string;
  collection_date: string;
  cluster: string;
  submission_type: string;
  amount_total: number;
  submitted_by: string;
  created_at?: string;
  status?: string;
  source: 'table_banking_contributions' | 'records';
}

interface FoodBankingLedgerProps {
  agentIdentity: AgentIdentity;
  isSystemDev: boolean;
  clusters: string[];
}

const FoodBankingLedger: React.FC<FoodBankingLedgerProps> = ({ agentIdentity, isSystemDev, clusters }) => {
  const [entries, setEntries] = useState<BankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCluster, setSelectedCluster] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchBankingRecords = async () => {
    setLoading(true);
    try {
      const unified: BankingEntry[] = [];

      // 1. Fetch from table_banking_contributions
      try {
        const { data: tbData, error: tbError } = await supabase
          .from('table_banking_contributions')
          .select('*')
          .order('collection_date', { ascending: false });

        if (!tbError && tbData) {
          tbData.forEach((row: any) => {
            unified.push({
              id: row.id,
              collection_date: row.collection_date || row.created_at?.split('T')[0] || '',
              cluster: row.cluster || 'General',
              submission_type: row.submission_type || 'WEEKLY',
              amount_total: Number(row.amount_total || 0),
              submitted_by: row.submitted_by || 'Agent',
              created_at: row.created_at,
              status: 'VERIFIED',
              source: 'table_banking_contributions'
            });
          });
        }
      } catch (err) {
        console.warn('Could not fetch table_banking_contributions:', err);
      }

      // 2. Fetch any legacy table banking records stored in records table
      try {
        const { data: recData, error: recError } = await supabase
          .from('records')
          .select('*')
          .ilike('crop_type', 'Table Banking%')
          .order('date', { ascending: false });

        if (!recError && recData) {
          recData.forEach((row: any) => {
            // Avoid duplicate if already exists
            const alreadyExists = unified.some(
              u => u.collection_date === row.date && u.cluster === row.cluster && u.amount_total === Number(row.total_sale || row.unit_price || 0)
            );
            if (!alreadyExists) {
              const subType = (row.crop_type || '').includes('DAILY')
                ? 'DAILY'
                : (row.crop_type || '').includes('MONTHLY')
                ? 'MONTHLY'
                : 'WEEKLY';

              unified.push({
                id: row.id,
                collection_date: row.date || '',
                cluster: row.cluster || 'General',
                submission_type: subType,
                amount_total: Number(row.total_sale || row.unit_price || 0),
                submitted_by: row.agent_name ? `${row.agent_name} (${row.agent_phone || ''})` : (row.agent_phone || 'Agent'),
                created_at: row.created_at,
                status: row.status === 'VERIFIED' ? 'VERIFIED' : 'RECORDED',
                source: 'records'
              });
            }
          });
        }
      } catch (err) {
        console.warn('Could not fetch legacy records:', err);
      }

      // Sort descending by date
      unified.sort((a, b) => new Date(b.collection_date).getTime() - new Date(a.collection_date).getTime());
      setEntries(unified);
    } catch (err) {
      console.error('Error loading food banking ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankingRecords();

    const handleUpdate = () => {
      fetchBankingRecords();
    };
    window.addEventListener('food-banking-updated', handleUpdate);
    return () => window.removeEventListener('food-banking-updated', handleUpdate);
  }, []);

  const handleDelete = async (entry: BankingEntry) => {
    if (!window.confirm(`Delete banking contribution record of KSh ${entry.amount_total.toLocaleString()} from ${entry.cluster}?`)) {
      return;
    }
    setDeletingId(entry.id);
    try {
      if (entry.source === 'table_banking_contributions') {
        await supabase.from('table_banking_contributions').delete().eq('id', entry.id);
      } else {
        await supabase.from('records').delete().eq('id', entry.id);
      }
      setEntries(prev => prev.filter(e => e.id !== entry.id));
    } catch (err) {
      console.error('Failed to delete entry:', err);
      alert('Failed to delete record.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      const matchCluster = selectedCluster === 'ALL' || e.cluster.toLowerCase() === selectedCluster.toLowerCase();
      const matchSearch =
        !searchTerm ||
        e.cluster.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.submitted_by.toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.collection_date.includes(searchTerm) ||
        e.submission_type.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCluster && matchSearch;
    });
  }, [entries, selectedCluster, searchTerm]);

  // Aggregate stats
  const totalSavings = useMemo(() => {
    return filteredEntries.reduce((sum, e) => sum + e.amount_total, 0);
  }, [filteredEntries]);

  const uniqueCoops = useMemo(() => {
    return new Set(filteredEntries.map(e => e.cluster)).size;
  }, [filteredEntries]);

  return (
    <div className="bg-white/90 backdrop-blur-md p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-xl space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-3 bg-emerald-100 text-emerald-800 rounded-2xl">
              <i className="fas fa-piggy-bank text-xl"></i>
            </span>
            <div>
              <h3 className="text-2xl font-black text-slate-900 tracking-tight">Food Banking Contributions Ledger</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                Mutual Aid Savings & Peer-to-Peer Cooperative Funds
              </p>
            </div>
          </div>
        </div>

        <button 
          onClick={fetchBankingRecords}
          disabled={loading}
          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all"
        >
          <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i> Refresh Ledger
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-emerald-50/70 border border-emerald-100 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Total Banked Savings</p>
          <p className="text-3xl font-black text-emerald-900 mt-2 font-mono">
            KSh {totalSavings.toLocaleString()}
          </p>
          <p className="text-[10px] font-bold text-emerald-600 mt-1">Across all filtered contributions</p>
        </div>

        <div className="bg-slate-50 border border-slate-200/80 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Total Collections Logged</p>
          <p className="text-3xl font-black text-slate-900 mt-2 font-mono">
            {filteredEntries.length}
          </p>
          <p className="text-[10px] font-bold text-slate-400 mt-1">Contribution sessions recorded</p>
        </div>

        <div className="bg-blue-50/70 border border-blue-100 p-6 rounded-3xl">
          <p className="text-[10px] font-black uppercase tracking-widest text-blue-700">Active Contributing Coops</p>
          <p className="text-3xl font-black text-blue-900 mt-2 font-mono">
            {uniqueCoops}
          </p>
          <p className="text-[10px] font-bold text-blue-500 mt-1">Clusters with active savings pools</p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 shrink-0">Filter Coop:</label>
          <select 
            value={selectedCluster} 
            onChange={e => setSelectedCluster(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Food Coops</option>
            {clusters.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="w-full sm:w-72">
          <input 
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Search date, coop, agent..."
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs font-bold text-slate-700 outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-slate-400 font-bold text-xs uppercase tracking-widest">
            <i className="fas fa-spinner fa-spin text-2xl text-emerald-600 block mb-3"></i>
            Loading Food Banking Contributions...
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-bold text-sm">
            <i className="fas fa-piggy-bank text-4xl text-slate-200 block mb-3"></i>
            No food banking contributions found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-widest">
                  <th className="py-4 px-6">Collection Date</th>
                  <th className="py-4 px-6">Food Coop Cluster</th>
                  <th className="py-4 px-6">Collection Frequency</th>
                  <th className="py-4 px-6 text-right">Banked Amount</th>
                  <th className="py-4 px-6">Recorded By</th>
                  <th className="py-4 px-6 text-center">Status</th>
                  {(isSystemDev || agentIdentity?.role === SystemRole.MANAGER) && (
                    <th className="py-4 px-6 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-4 px-6 font-mono font-bold text-slate-700">
                      {entry.collection_date}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-900 uppercase">
                      {entry.cluster}
                    </td>
                    <td className="py-4 px-6">
                      <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {entry.submission_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right font-mono font-black text-emerald-600 text-sm">
                      KSh {entry.amount_total.toLocaleString()}
                    </td>
                    <td className="py-4 px-6 text-slate-600 font-medium text-xs">
                      {entry.submitted_by}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-[9px] font-black uppercase tracking-widest">
                        {entry.status || 'RECORDED'}
                      </span>
                    </td>
                    {(isSystemDev || agentIdentity?.role === SystemRole.MANAGER) && (
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={deletingId === entry.id}
                          className="text-slate-300 hover:text-red-600 p-2 rounded-lg transition-colors"
                          title="Delete Banking Record"
                        >
                          <i className={`fas ${deletingId === entry.id ? 'fa-spinner fa-spin' : 'fa-trash-alt'} text-xs`}></i>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default FoodBankingLedger;
