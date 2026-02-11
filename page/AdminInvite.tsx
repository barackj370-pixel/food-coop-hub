
import React, { useState } from 'react';

const AdminInvite: React.FC = () => {
  const [copied, setCopied] = useState(false);
  
  // Create a direct registration link
  const inviteLink = typeof window !== 'undefined' 
    ? `${window.location.protocol}//${window.location.host}/?mode=register`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareWhatsApp = () => {
    const text = `Join the KPL Food Coop Market. Create your account securely here: ${inviteLink}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-[500px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-12 space-y-8 relative overflow-hidden text-center">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-black"></div>
        
        <div>
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-sm">
             <i className="fas fa-user-plus text-3xl text-black"></i>
          </div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tight mb-2">Invite New Members</h2>
          <p className="text-sm text-slate-500 font-medium">Share the secure access link below with new Suppliers, Agents, or Customers.</p>
        </div>

        <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 flex flex-col gap-4">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Direct Registration Link</p>
           <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl p-3">
              <code className="flex-1 text-left text-xs font-bold text-slate-700 truncate">{inviteLink}</code>
              <button 
                onClick={handleCopy}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${copied ? 'bg-green-500 text-white' : 'bg-black text-white hover:bg-slate-800'}`}
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
           </div>
           
           <button 
             onClick={handleShareWhatsApp}
             className="w-full py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-md active:scale-95"
           >
             <i className="fab fa-whatsapp text-lg"></i> Share via WhatsApp
           </button>
        </div>

        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-left">
           <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest mb-2"><i className="fas fa-info-circle mr-1"></i> Note</h4>
           <p className="text-xs text-blue-600 leading-relaxed">
             New accounts will be set to <strong>Active</strong> by default. <span className="opacity-80">Administrator access is required to modify user permissions or suspend accounts later.</span>
           </p>
        </div>
      </div>
    </div>
  );
};

export default AdminInvite;
