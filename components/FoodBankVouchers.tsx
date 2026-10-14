import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient'; 
import { Save, Plus, ArrowRight, MessageSquare, CreditCard, RefreshCw, X, Loader } from 'lucide-react';

const calculateInitialVoucher = (totalContribution: number): number => totalContribution * 0.5;
const calculateRepaymentDue = (amountUsed: number): number => amountUsed * 1.10;

interface Contributor {
  id: string;
  name: string;
  phone: string;
  totalContribution: number;
  currentVoucherLimit: number;
  currentBalance: number;
  outstandingLoan: number;
}

export default function FoodBankVouchers() {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [rawText, setRawText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Transaction Modal State
  const [selectedContributor, setSelectedContributor] = useState<Contributor | null>(null);
  const [transactMode, setTransactMode] = useState<'USE' | 'REPAY' | null>(null);
  const [amount, setAmount] = useState<number | ''>('');
  
  // SMS State
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState('');

  useEffect(() => {
    fetchContributors();
  }, []);

  const fetchContributors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pages')
        .select('id, content')
        .eq('title', 'FoodBankVouchers_v1');
        
      if (error) throw error;
      
      if (data && data.length > 0) {
        let parsed = typeof data[0].content === 'string' ? JSON.parse(data[0].content) : data[0].content;
        setContributors(parsed.list || []);
      }
    } catch (err) {
      console.error('Error fetching contributors:', err);
    }
    setLoading(false);
  };

  const saveContributors = async (newList: Contributor[]) => {
    try {
      const { data: existing } = await supabase
        .from('pages')
        .select('id')
        .eq('title', 'FoodBankVouchers_v1');
        
      if (existing && existing.length > 0) {
        await supabase.from('pages').update({ content: { list: newList } }).eq('id', existing[0].id);
      } else {
        await supabase.from('pages').insert([{ title: 'FoodBankVouchers_v1', content: { list: newList } }]);
      }
      setContributors(newList);
    } catch (err) {
      console.error('Error saving contributors:', err);
    }
  };

  const handleProcessRawText = () => {
    const lines = rawText.split('\n');
    const newContributors: Contributor[] = [];
    
    lines.forEach(line => {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 3) {
        const name = parts[0];
        const phone = parts[1];
        const contribution = parseInt(parts[2].replace(/[^0-9]/g, '')) || 0;
        
        const initialVoucher = calculateInitialVoucher(contribution);
        
        newContributors.push({
          id: Math.random().toString(36).substr(2, 9),
          name,
          phone,
          totalContribution: contribution,
          currentVoucherLimit: initialVoucher,
          currentBalance: initialVoucher,
          outstandingLoan: 0
        });
      }
    });
    
    if (newContributors.length > 0) {
      const merged = [...contributors, ...newContributors];
      saveContributors(merged);
      setRawText('');
      setIsUploading(false);
    }
  };

  const handleTransaction = () => {
    if (!selectedContributor || !amount || typeof amount !== 'number') return;
    
    const updatedList = contributors.map(c => {
      if (c.id === selectedContributor.id) {
        let updated = { ...c };
        if (transactMode === 'USE') {
          if (amount > updated.currentBalance) {
            alert('Amount exceeds available balance!');
            return c;
          }
          updated.currentBalance -= amount;
          updated.outstandingLoan += calculateRepaymentDue(amount);
        } else if (transactMode === 'REPAY') {
          if (amount >= updated.outstandingLoan) {
              const surplus = amount - updated.outstandingLoan;
              updated.outstandingLoan = 0;
              updated.currentVoucherLimit += amount; 
              updated.currentBalance = updated.currentVoucherLimit; 
          } else {
              updated.outstandingLoan -= amount;
              updated.currentVoucherLimit += amount; 
              updated.currentBalance += amount;
          }
        }
        return updated;
      }
      return c;
    });
    
    saveContributors(updatedList);
    setTransactMode(null);
    setAmount('');
  };

  const sendSMS = async () => {
    setSmsSending(true);
    setSmsResult('');
    try {
      let successCount = 0;
      for (const c of contributors) {
        if (!c.phone) continue;
        const msg = `Hello ${c.name}, your total food bank contribution is Ksh ${c.totalContribution}. Your available voucher value is Ksh ${c.currentBalance}. You can use this at the food coop market.`;
        
        await fetch('/api/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumbers: [c.phone], message: msg })
        });
        successCount++;
      }
      setSmsResult(`Successfully sent SMS to ${successCount} contributors.`);
    } catch (err: any) {
      setSmsResult(`Error sending SMS: ${err.message}`);
    }
    setSmsSending(false);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-300">
      
      <div className="flex justify-between items-end bg-white/50 backdrop-blur-md p-8 rounded-[2rem] border border-slate-200">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Men's Food Bank Vouchers</h2>
          <p className="text-slate-500 mt-2 text-lg">Manage contributions, issue vouchers, and track 10% interest repayments.</p>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setIsUploading(!isUploading)} className="px-6 py-3 bg-white border-2 border-slate-200 hover:border-black rounded-full font-bold text-slate-700 flex items-center gap-2 transition-all">
            <Plus size={18} /> Add Contributors
          </button>
          <button onClick={sendSMS} disabled={smsSending} className="px-6 py-3 bg-black hover:bg-slate-800 text-white rounded-full font-bold flex items-center gap-2 transition-all shadow-lg shadow-black/20">
            {smsSending ? <Loader className="animate-spin" size={18} /> : <MessageSquare size={18} />} 
            {smsSending ? 'Sending SMS...' : 'Send SMS Blast'}
          </button>
        </div>
      </div>

      {smsResult && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl font-medium">
          {smsResult}
        </div>
      )}

      {isUploading && (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-lg text-slate-800">Paste Contributor List</h3>
          <p className="text-sm text-slate-500">Format: Name, Phone Number, Total Contribution (e.g., John Doe, +254712345678, 1800)</p>
          <textarea
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-black outline-none"
            placeholder="John Doe, +254712345678, 1800&#10;Peter Kamau, 0722000000, 1500"
          />
          <button onClick={handleProcessRawText} className="px-8 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full font-bold transition-all shadow-lg shadow-emerald-500/30">
            Process List
          </button>
        </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 font-medium">Loading contributors...</div>
        ) : contributors.length === 0 ? (
          <div className="p-12 text-center text-slate-400 font-medium">No contributors added yet. Click 'Add Contributors' to start.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-widest">
                <th className="p-6 font-bold">Name & Contact</th>
                <th className="p-6 font-bold">Total Contribution</th>
                <th className="p-6 font-bold">Voucher Limit</th>
                <th className="p-6 font-bold text-emerald-600">Available Balance</th>
                <th className="p-6 font-bold text-rose-600">Outstanding Loan (10% incl)</th>
                <th className="p-6 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {contributors.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-6">
                    <div className="font-bold text-slate-800">{c.name}</div>
                    <div className="text-sm text-slate-400">{c.phone}</div>
                  </td>
                  <td className="p-6 font-medium text-slate-600">Ksh {c.totalContribution}</td>
                  <td className="p-6 font-medium text-slate-800">Ksh {c.currentVoucherLimit}</td>
                  <td className="p-6 font-bold text-emerald-600">Ksh {c.currentBalance}</td>
                  <td className="p-6 font-bold text-rose-600">Ksh {c.outstandingLoan}</td>
                  <td className="p-6 text-right space-x-2">
                    <button 
                      onClick={() => { setSelectedContributor(c); setTransactMode('USE'); }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-sm font-bold transition-colors"
                      disabled={c.currentBalance <= 0}
                    >
                      Use Voucher
                    </button>
                    <button 
                      onClick={() => { setSelectedContributor(c); setTransactMode('REPAY'); }}
                      className="px-4 py-2 bg-black hover:bg-slate-800 text-white rounded-full text-sm font-bold transition-colors shadow-sm"
                      disabled={c.outstandingLoan <= 0}
                    >
                      Repay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {transactMode && selectedContributor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setTransactMode(null)} className="absolute top-6 right-6 text-slate-400 hover:text-black">
              <X size={24} />
            </button>
            <h3 className="text-2xl font-black mb-2 text-slate-800">
              {transactMode === 'USE' ? 'Use Voucher' : 'Log Repayment'}
            </h3>
            <p className="text-slate-500 mb-6">
              {transactMode === 'USE' 
                ? `Available Balance: Ksh ${selectedContributor.currentBalance}`
                : `Outstanding Loan: Ksh ${selectedContributor.outstandingLoan}`
              }
            </p>
            
            <div className="space-y-4 mb-8">
              <label className="block text-sm font-bold text-slate-700 uppercase tracking-wider">Amount (Ksh)</label>
              <input 
                type="number" 
                value={amount}
                onChange={e => setAmount(Number(e.target.value))}
                className="w-full px-6 py-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-lg font-bold outline-none focus:border-black focus:ring-4 focus:ring-black/5"
                placeholder="0.00"
              />
              {transactMode === 'USE' && typeof amount === 'number' && amount > 0 && (
                <div className="p-4 bg-rose-50 text-rose-800 rounded-2xl text-sm font-medium">
                  Repayment amount due (incl. 10% interest): <strong>Ksh {calculateRepaymentDue(amount)}</strong>
                </div>
              )}
            </div>

            <button onClick={handleTransaction} className="w-full py-4 bg-black hover:bg-slate-800 text-white rounded-full font-bold transition-colors shadow-lg shadow-black/20 text-lg">
              Confirm Transaction
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
