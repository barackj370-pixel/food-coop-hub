import React, { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AgentIdentity } from '../types';

interface SolidarityAttendanceLogProps {
  data: any[];
  agentIdentity?: AgentIdentity;
  dynamicClusters?: string[];
}

export const SolidarityAttendanceLog: React.FC<SolidarityAttendanceLogProps> = ({
  data,
  agentIdentity,
  dynamicClusters = []
}) => {
  // Date filter state: default to empty so all historical entries (25th, 26th, 27th, 28th, 29th, etc.) show by default
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedCoop, setSelectedCoop] = useState<string>('ALL');

  // Helper to parse dates robustly
  const parseItemDate = (item: any): string => {
    const raw = item.date || item.submittedAt || item.created_at || item.createdAt || item.timestamp || item.dateOfVisit || item.visitDate || item.date_of_visit || '';
    if (!raw) return '';

    if (typeof raw === 'number') {
      try {
        const d = new Date(raw);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch (e) {}
    }

    if (typeof raw === 'string') {
      const trimmed = raw.trim();
      if (/^\d{10,13}$/.test(trimmed)) {
        try {
          const d = new Date(Number(trimmed));
          if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
        } catch (e) {}
      }
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.substring(0, 10);
      const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
      if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        return `${year}-${month}-${day}`;
      }
    }
    try {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    } catch (e) {}
    return '';
  };

  // Extract coop name robustly
  const getCoopName = (item: any): string => {
    const itemStr = JSON.stringify(item).toLowerCase();

    // Specific record reclassifications based on host, convener, or participant names
    if (
      itemStr.includes('washinton omondi') ||
      itemStr.includes('0727672687') ||
      itemStr.includes('antony kirika') ||
      itemStr.includes('erick sechei') ||
      itemStr.includes('cleaning of the workshop') ||
      itemStr.includes('men articulation')
    ) {
      return 'Men Articulation New Kangemi';
    }

    if (
      itemStr.includes('melanie atieno') ||
      itemStr.includes('susan’s homestead') ||
      itemStr.includes('susans homestead') ||
      itemStr.includes('otieno’s homestead') ||
      itemStr.includes('otienos homestead') ||
      itemStr.includes('wendy agola') ||
      itemStr.includes('michal awuor') ||
      itemStr.includes('0700043146')
    ) {
      return 'Kangemi Food Coop';
    }

    if (
      itemStr.includes('ann tuitoek') ||
      itemStr.includes('0705206742') ||
      itemStr.includes('jackline toroitich') ||
      itemStr.includes('0726051308') ||
      itemStr.includes('eyon kemboi') ||
      itemStr.includes('lincoln rotich') ||
      itemStr.includes('kabarnet')
    ) {
      return 'Kabarnet Food Coop';
    }

    // Explicit food coop fields first
    const explicitCoop =
      item.foodCoop ||
      item.foodCoopName ||
      item.food_coop ||
      item.coop ||
      item.cooperative ||
      item.clusterName;

    if (explicitCoop && typeof explicitCoop === 'string' && explicitCoop.trim().length > 0) {
      const trimmed = explicitCoop.trim();
      if (trimmed.toLowerCase().includes('men articulation')) return 'Men Articulation New Kangemi';
      if (trimmed.toLowerCase().includes('kangemi')) return 'Kangemi Food Coop';
      return trimmed;
    }

    // Agent cluster fields
    const clusterCoop =
      item.agentCluster ||
      item.cluster ||
      item.agentIdentity?.cluster;

    if (clusterCoop && typeof clusterCoop === 'string' && clusterCoop.trim().length > 0) {
      const trimmed = clusterCoop.trim();
      if (trimmed.toLowerCase().includes('men articulation')) return 'Men Articulation New Kangemi';
      if (trimmed.toLowerCase().includes('kangemi')) return 'Kangemi Food Coop';
      return trimmed;
    }

    return 'General Food Coop';
  };

  // Filter solidarity forms by type, date range, and food coop
  const solidarityForms = useMemo(() => {
    return data.filter(item => {
      const formTypeStr = String(item.formType || item.type || item.form_type || '').toLowerCase();
      const titleStr = String(item.title || item.formTitle || item.name || '').toLowerCase();
      const idStr = String(item.id || '').toLowerCase();

      const isSolidarity = 
        formTypeStr.includes('solidarity') || 
        formTypeStr.includes('labour') ||
        formTypeStr.includes('labor') ||
        titleStr.includes('solidarity') ||
        titleStr.includes('labour') ||
        titleStr.includes('labor') ||
        idStr.includes('solidarity') ||
        Boolean(item.participants) ||
        Boolean(item.totalParticipants) ||
        Boolean(item.homesteadVisitedName) ||
        Boolean(item.homesteadVisitedContact) ||
        Boolean(item.convenerName) ||
        Boolean(item.homesteadName && item.workDone);
      
      if (!isSolidarity) return false;

      // Exclude General Food Coop entries as requested by user
      const coop = getCoopName(item);
      if (coop === 'General Food Coop' || coop.toLowerCase().includes('general food coop')) return false;

      // Date check
      const dateStr = parseItemDate(item);
      if (startDate && dateStr && dateStr < startDate) return false;
      if (endDate && dateStr && dateStr > endDate) return false;

      // Food Coop check
      if (selectedCoop !== 'ALL' && coop !== selectedCoop) return false;

      return true;
    });
  }, [data, startDate, endDate, selectedCoop]);

  // Extract unique coops available in data
  const availableCoops = useMemo(() => {
    const coopsSet = new Set<string>();
    data.forEach(item => {
      const formTypeStr = String(item.formType || item.type || item.form_type || '').toLowerCase();
      const titleStr = String(item.title || item.formTitle || item.name || '').toLowerCase();
      const idStr = String(item.id || '').toLowerCase();

      const isSolidarity = 
        formTypeStr.includes('solidarity') || 
        formTypeStr.includes('labour') ||
        formTypeStr.includes('labor') ||
        titleStr.includes('solidarity') ||
        titleStr.includes('labour') ||
        titleStr.includes('labor') ||
        idStr.includes('solidarity') ||
        Boolean(item.participants) ||
        Boolean(item.totalParticipants) ||
        Boolean(item.homesteadVisitedName) ||
        Boolean(item.homesteadVisitedContact) ||
        Boolean(item.convenerName) ||
        Boolean(item.homesteadName && item.workDone);
      
      if (isSolidarity) {
        const c = getCoopName(item);
        if (c && c !== 'General Food Coop' && !c.toLowerCase().includes('general food coop')) coopsSet.add(c);
      }
    });
    dynamicClusters.forEach(c => {
      if (c && typeof c === 'string' && c.trim() !== 'General Food Coop' && !c.toLowerCase().includes('general food coop')) coopsSet.add(c.trim());
    });
    return Array.from(coopsSet).sort();
  }, [data, dynamicClusters]);

  // Group forms by Food Coop for classified reporting
  const groupedByCoop = useMemo(() => {
    const map: Record<string, any[]> = {};
    solidarityForms.forEach(form => {
      const coop = getCoopName(form);
      if (!map[coop]) map[coop] = [];
      map[coop].push(form);
    });
    return map;
  }, [solidarityForms]);

  // Total calculated attendants
  const totalAttendantsCount = useMemo(() => {
    let count = 0;
    solidarityForms.forEach(form => {
      if (form.participants) {
        // Count lines or commas in participants string
        const lines = form.participants.split(/[\n,;]+/).filter((s: string) => s.trim().length > 0);
        count += lines.length > 0 ? lines.length : 1;
      } else if (form.totalParticipants) {
        count += Number(form.totalParticipants) || 1;
      } else {
        count += 1;
      }
    });
    return count;
  }, [solidarityForms]);

  // Generate PDF Document function
  const handleExportPDF = () => {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Header Branding
    doc.setFillColor(16, 185, 129); // Emerald 600
    doc.rect(0, 0, 297, 22, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('FARM LABOUR SOLIDARITY - ATTENDANCE & PARTICIPANTS REPORT', 14, 14);

    // Subheader metadata
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // Slate 700
    doc.text(`Generated On: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 30);
    doc.text(`Date Filter Range: ${startDate || 'Earliest'} to ${endDate || 'Latest'}`, 14, 36);
    doc.text(`Food Cooperative Scope: ${selectedCoop === 'ALL' ? 'All Cooperatives' : selectedCoop}`, 14, 42);
    doc.text(`Total Sessions: ${solidarityForms.length} | Total Attendants Identified: ${totalAttendantsCount}`, 14, 48);

    let startY = 54;

    // Loop through each Food Coop
    Object.keys(groupedByCoop).forEach((coopName, index) => {
      const forms = groupedByCoop[coopName];

      if (startY > 175) {
        doc.addPage();
        startY = 20;
      }

      // Section Heading for Food Coop
      doc.setFillColor(241, 245, 249); // Slate 100
      doc.rect(14, startY, 269, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.text(`FOOD COOP: ${coopName.toUpperCase()} (${forms.length} Sessions)`, 18, startY + 6);

      startY += 12;

      // Table rows for this Coop
      const tableData = forms.map((form, fIdx) => {
        const formDate = form.date || form.submittedAt ? new Date(form.date || form.submittedAt).toLocaleDateString() : 'N/A';
        const host = `${form.homesteadVisitedName || form.homesteadName || 'N/A'}\nPhone: ${form.homesteadVisitedContact || form.homesteadContact || 'N/A'}`;
        const agent = `${form.agentName || 'Agent'}\nPhone: ${form.agentPhone || 'N/A'}`;
        
        let work = '';
        if (Array.isArray(form.workDone)) {
          work = form.workDone.join(', ');
        } else if (form.workDone) {
          work = String(form.workDone);
        } else {
          work = 'Farm Labour Solidarity';
        }
        if (form.otherWork) work += ` (${form.otherWork})`;

        const participantsList = form.participants || `Total Participants: ${form.totalParticipants || 1}`;

        return [
          (fIdx + 1).toString(),
          formDate,
          host,
          agent,
          work,
          participantsList
        ];
      });

      autoTable(doc, {
        startY: startY,
        head: [['#', 'Date', 'Host Homestead & Contact', 'Agent / Convener', 'Work Performed', 'Participants List & Contacts']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [16, 185, 129],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 9
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 41, 59]
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 50 },
          3: { cellWidth: 40 },
          4: { cellWidth: 50 },
          5: { cellWidth: 94 }
        },
        margin: { left: 14, right: 14 },
        didDrawPage: (data) => {
          startY = data.cursor ? data.cursor.y + 10 : 150;
        }
      });

      startY += 6;
    });

    // Save PDF
    const filename = `Solidarity_Attendance_List_${selectedCoop.replace(/\s+/g, '_')}_${startDate}_to_${endDate}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-200 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-3 bg-purple-100 text-purple-700 rounded-2xl">
              <i className="fas fa-users-gear text-xl"></i>
            </span>
            <div>
              <h2 className="text-2xl font-black text-slate-900">Farm Labour Solidarity Attendants List</h2>
              <p className="text-xs font-bold text-slate-500">Filter work sessions by date range and food coop to export PDF reports with participants & contacts.</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleExportPDF}
          disabled={solidarityForms.length === 0}
          className="px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50"
        >
          <i className="fas fa-file-pdf text-lg"></i>
          Export Attendance PDF
        </button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-200">
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 text-xs outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 text-xs outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Filter By Food Coop</label>
          <select
            value={selectedCoop}
            onChange={(e) => setSelectedCoop(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-700 text-xs outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Food Cooperatives</option>
            {availableCoops.map(coop => (
              <option key={coop} value={coop}>{coop}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-5">
          <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Total Work Sessions</span>
          <p className="text-3xl font-black text-purple-900 mt-1">{solidarityForms.length}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
          <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Participants Registered</span>
          <p className="text-3xl font-black text-emerald-900 mt-1">{totalAttendantsCount}</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Active Cooperatives</span>
          <p className="text-3xl font-black text-blue-900 mt-1">{Object.keys(groupedByCoop).length}</p>
        </div>
      </div>

      {/* On-Screen Table Preview */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-100 border-y border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-widest">
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Food Coop</th>
              <th className="py-3 px-4">Host Homestead & Contact</th>
              <th className="py-3 px-4">Work Done</th>
              <th className="py-3 px-4">Attendants & Contacts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
            {solidarityForms.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400 font-bold">
                  No farm labour solidarity records found for the selected date range and cooperative.
                </td>
              </tr>
            ) : (
              solidarityForms.map((form, idx) => {
                const parsedD = parseItemDate(form);
                const dateVal = parsedD ? new Date(parsedD).toLocaleDateString() : (form.date || form.submittedAt || 'N/A');
                const coopVal = getCoopName(form);
                const hostVal = form.homesteadVisitedName || form.homesteadName || 'N/A';
                const phoneVal = form.homesteadVisitedContact || form.homesteadContact || 'N/A';

                return (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-4 font-bold text-slate-900">{dateVal}</td>
                    <td className="py-4 px-4">
                      <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-[10px] font-black uppercase tracking-wider">
                        {coopVal}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-bold text-slate-800">{hostVal}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{phoneVal}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="font-semibold text-slate-700">
                        {Array.isArray(form.workDone) ? form.workDone.join(', ') : form.workDone || 'Solidarity Labour'}
                      </span>
                    </td>
                    <td className="py-4 px-4 whitespace-pre-wrap max-w-xs font-mono text-[11px] text-slate-800">
                      {form.participants || `Participants count: ${form.totalParticipants || 1}`}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default SolidarityAttendanceLog;
