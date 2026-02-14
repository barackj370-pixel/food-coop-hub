
import React, { useState } from 'react';
import { SystemRole } from '../types';
import { CLUSTERS } from '../App';

const CLUSTER_ROLES: SystemRole[] = [
  SystemRole.SALES_AGENT,
  SystemRole.SUPPLIER,
  SystemRole.CUSTOMER,
];

const AdminInvite: React.FC = () => {
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SystemRole>(SystemRole.SALES_AGENT);
  const [cluster, setCluster] = useState(CLUSTERS[0]);
  
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [showCopied, setShowCopied] = useState(false);

  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize phone
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.slice(1);
    if (formattedPhone.startsWith('+')) formattedPhone = formattedPhone.slice(1);

    const baseUrl = window.location.origin;
    const params = new URLSearchParams();
    params.set('mode', 'register');
    params.set('phone', formattedPhone);
    params.set('name', fullName);
    params.set('role', role);
    if (CLUSTER_ROLES.includes(role)) {
      params.set('cluster', cluster);
    }

    const link = `${baseUrl}/?${params.toString()}`;
    setGeneratedLink(link);
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  };

  const sendViaEmail = () => {
    if (generatedLink) {
      const subject = encodeURIComponent("Invitation to KPL Food Coop Market");
      const body = encodeURIComponent(`Hello ${fullName},\n\nYou have been invited to join the KPL Food Coop Market.\n\nClick this secure link to set up your account:\n${generatedLink}\n\nWelcome aboard!`);
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }
  };

  const sendViaWhatsApp = () => {
    if (generatedLink) {
      const text = encodeURIComponent(`Hello ${fullName}, join KPL Food Coop here: ${generatedLink}`);
      window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-[600px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-12 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-black"></div>
        
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-sm">
             <i className="fas fa-link text-3xl text-black"></i>
          </div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tight mb-2">Generate Invite Link</h2>
          <p className="text-sm text-slate-500 font-medium">Create a unique registration link pre-filled with the user's details. Send it via Email or WhatsApp.</p>
        </div>

        <form onSubmit={handleGenerateLink} className="space-y-4">
           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Full Name</label>
              <input 
                type="text" 
                required 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all"
                placeholder="John Doe"
              />
           </div>

           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Phone Number</label>
              <input 
                type="tel" 
                required 
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all"
                placeholder="07..."
              />
           </div>

           <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Role</label>
                <select 
                  value={role}
                  onChange={e => setRole(e.target.value as SystemRole)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all text-xs"
                >
                  {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                </select>
             </div>
             <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Cluster</label>
                <select 
                  value={cluster}
                  onChange={e => setCluster(e.target.value)}
                  disabled={!CLUSTER_ROLES.includes(role)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-4 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all text-xs disabled:opacity-50"
                >
                  {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
             </div>
           </div>

           <button 
             type="submit"
             className="w-full py-4 bg-black hover:bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 mt-4"
           >
             <i className="fas fa-magic"></i> Generate Link
           </button>
        </form>

        {generatedLink && (
          <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 animate-in slide-in-from-bottom-2 duration-500">
             <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2 block">Secure Invite Link</label>
             <div className="bg-white border border-slate-200 rounded-xl p-4 break-all text-xs font-mono text-slate-600 mb-4 select-all">
                {generatedLink}
             </div>
             <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={copyToClipboard} className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${showCopied ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}>
                   {showCopied ? <><i className="fas fa-check"></i> Copied</> : <><i className="fas fa-copy"></i> Copy Link</>}
                </button>
                <button onClick={sendViaEmail} className="flex-1 py-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                   <i className="fas fa-envelope"></i> Email
                </button>
                <button onClick={sendViaWhatsApp} className="flex-1 py-3 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2">
                   <i className="fab fa-whatsapp text-sm"></i> WhatsApp
                </button>
             </div>
          </div>
        )}

        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-left">
           <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest mb-2"><i className="fas fa-info-circle mr-1"></i> How it works</h4>
           <p className="text-xs text-blue-600 leading-relaxed">
             This tool generates a special sign-up link. When the user clicks it, their registration form will be pre-filled with the details you entered. This ensures data accuracy without needing a backend email server.
           </p>
        </div>
      </div>
    </div>
  );
};

export default AdminInvite;
