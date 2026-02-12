
import React, { useState } from 'react';
import { saveContactMessage } from '../services/supabaseService';

const ContactForm: React.FC = () => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const result = await saveContactMessage({
      ...formData,
      date: new Date().toISOString(),
      status: 'NEW'
    });

    if (result) {
      setSuccess(true);
      setFormData({ name: '', phone: '', email: '', subject: '', message: '' });
      setTimeout(() => setSuccess(false), 5000);
    } else {
      alert("Failed to send message. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 h-full">
      <h3 className="text-lg font-black text-black uppercase tracking-tight mb-6">Send us a Message</h3>
      {success ? (
        <div className="bg-green-100 text-green-700 p-6 rounded-2xl text-center animate-in fade-in h-full flex flex-col justify-center">
          <i className="fas fa-check-circle text-4xl mb-3"></i>
          <p className="font-bold text-sm">Message Sent Successfully!</p>
          <p className="text-xs mt-1">We'll get back to you shortly.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Name</label>
              <input 
                type="text" required 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-black transition-all"
                placeholder="Your Name"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Phone</label>
              <input 
                type="tel" required 
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-black transition-all"
                placeholder="07..."
              />
            </div>
          </div>
          <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Email (Optional)</label>
              <input 
                type="email"
                value={formData.email}
                onChange={e => setFormData({...formData, email: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-black transition-all"
                placeholder="email@example.com"
              />
          </div>
          <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Subject</label>
              <input 
                type="text" required
                value={formData.subject}
                onChange={e => setFormData({...formData, subject: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-bold text-sm outline-none focus:border-black transition-all"
                placeholder="Inquiry Topic"
              />
          </div>
          <div className="space-y-1">
              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-2">Message</label>
              <textarea 
                required
                rows={4}
                value={formData.message}
                onChange={e => setFormData({...formData, message: e.target.value})}
                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 font-medium text-sm outline-none focus:border-black transition-all resize-none"
                placeholder="How can we help you?"
              />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95"
          >
            {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
            Send Message
          </button>
        </form>
      )}
    </div>
  );
}

export default ContactForm;
