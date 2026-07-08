import React, { useMemo } from 'react';
import { AgentIdentity } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface YouthAssessmentLogProps {
  data: any[];
  isSystemDev: boolean;
  agentIdentity: AgentIdentity;
}

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#14b8a6'];

const YouthAssessmentLog: React.FC<YouthAssessmentLogProps> = ({ data, isSystemDev, agentIdentity }) => {
  const youthForms = useMemo(() => {
    return data.filter(d => d.formType === 'youth_assessment' || d.title === 'FarmForm_youth_assessment');
  }, [data]);

  const totalHouseholds = youthForms.length;
  
  const totalYouth = useMemo(() => {
    return youthForms.reduce((acc, form) => acc + (form.youthList ? form.youthList.length : 0), 0);
  }, [youthForms]);

  const totalOtherMembers = useMemo(() => {
    return youthForms.reduce((acc, form) => acc + (form.otherMemberList ? form.otherMemberList.length : 0), 0);
  }, [youthForms]);

  const chartData = useMemo(() => {
    const coopMap: Record<string, number> = {};
    youthForms.forEach(form => {
      const coop = form.foodCoopName || form.cluster || 'Unknown';
      if (!coopMap[coop]) coopMap[coop] = 0;
      coopMap[coop] += (form.youthList ? form.youthList.length : 0);
    });
    return Object.keys(coopMap).map(key => ({
      name: key,
      value: coopMap[key]
    })).sort((a, b) => b.value - a.value);
  }, [youthForms]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-200">
        <h2 className="text-3xl font-black text-slate-900 mb-8">Youth Assessment <span className="text-emerald-600 block text-sm tracking-widest">Universal Log (Form C)</span></h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
            <h3 className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">Total Households</h3>
            <p className="text-4xl font-black text-emerald-900">{totalHouseholds}</p>
          </div>
          <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
            <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Total Youth Enrolled</h3>
            <p className="text-4xl font-black text-blue-900">{totalYouth}</p>
          </div>
          <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
            <h3 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">Other Dependents</h3>
            <p className="text-4xl font-black text-purple-900">{totalOtherMembers}</p>
          </div>
        </div>

        {chartData.length > 0 && (
          <div className="mb-12">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6">Youth Enrolled per Food Coop</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: 'bold' }}
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-100">
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Coop Name</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Household Name</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parent Name</th>
                <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Youth Count</th>
              </tr>
            </thead>
            <tbody>
              {youthForms.map((form, idx) => (
                <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 text-xs font-medium text-slate-500">
                    {new Date(form.submittedAt || form.date).toLocaleDateString()}
                  </td>
                  <td className="py-4 px-6 text-xs font-bold text-slate-900">
                    {form.foodCoopName || form.cluster || 'Unknown'}
                  </td>
                  <td className="py-4 px-6 text-xs font-bold text-slate-900">
                    {form.householdName || 'N/A'}
                  </td>
                  <td className="py-4 px-6 text-xs font-medium text-slate-500">
                    {form.parentName || 'N/A'}
                  </td>
                  <td className="py-4 px-6 text-xs font-bold text-blue-600 bg-blue-50/50 rounded-lg">
                    {form.youthList ? form.youthList.length : 0}
                  </td>
                </tr>
              ))}
              {youthForms.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 font-medium text-sm">
                    No Youth Assessment records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default YouthAssessmentLog;
