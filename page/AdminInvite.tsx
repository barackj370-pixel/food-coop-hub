
import React, { useState } from 'react';
import { SystemRole } from '../types';
import { CLUSTERS } from '../App';

const CLUSTER_ROLES: SystemRole[] = [
  SystemRole.SALES_AGENT,
  SystemRole.SUPPLIER,
  SystemRole.CUSTOMER,
];

const AdminInvite: React.FC = () => {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<SystemRole>(SystemRole.SALES_AGENT);
  const [cluster, setCluster] = useState(CLUSTERS[0]);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/invite-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          cluster: CLUSTER_ROLES.includes(role) ? cluster : null,
          data: { // Pass name in metadata for auto-profile creation
             full_name: fullName
          }
        })
      });

      const result = await response.json();
      
      if (!response.ok) throw new Error(result.error || "Invite failed");
      
      setMessage({ type: 'success', text: `Invitation sent to ${email}` });
      setEmail('');
      setFullName('');
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="w-full max-w-[500px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-12 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-green-400 to-black"></div>
        
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100 shadow-sm">
             <i className="fas fa-paper-plane text-3xl text-black"></i>
          </div>
          <h2 className="text-2xl font-black text-black uppercase tracking-tight mb-2">Send Official Invite</h2>
          <p className="text-sm text-slate-500 font-medium">Send a secure magic link via email. The system will automatically create their profile when they click it.</p>
        </div>

        <form onSubmit={handleInvite} className="space-y-4">
           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Recipient Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all"
                placeholder="name@example.com"
              />
           </div>

           <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Full Name (For Profile)</label>
              <input 
                type="text" 
                required 
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all"
                placeholder="John Doe"
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

           {message && (
             <div className={`p-4 rounded-xl text-xs font-bold ${message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
               {message.text}
             </div>
           )}

           <button 
             disabled={loading}
             className="w-full py-4 bg-black hover:bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-xl active:scale-95 mt-4"
           >
             {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-envelope"></i>}
             Send Invitation
           </button>
        </form>

        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 text-left">
           <h4 className="text-[11px] font-black text-blue-700 uppercase tracking-widest mb-2"><i className="fas fa-info-circle mr-1"></i> How it works</h4>
           <p className="text-xs text-blue-600 leading-relaxed">
             The user will receive an email with a secure link. When they click it, they will be logged in automatically, and their profile will be created with the details you entered above. They can set a password later.
           </p>
        </div>
      </div>
    </div>
  );
};

export default AdminInvite;
