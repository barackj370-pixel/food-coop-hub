import React, { useState, useEffect } from 'react';
import { AgentIdentity } from '../types';
import { Camera, QrCode, ArrowDownLeft, ArrowUpRight, ShieldAlert, History, Wallet, CheckCircle2, X } from 'lucide-react';

interface CoopPesaTx {
  id: string;
  date: string;
  type: 'transfer' | 'topup' | 'withdrawal' | 'loan_disbursement' | 'loan_repayment' | 'collateral_lock';
  description: string;
  amount: number;
  fromUser?: string;
  toUser?: string;
  currency: 'COOP_PESA' | 'KES';
  status: 'completed' | 'pending';
}

interface WalletData {
  coopPesaBalance: number;
  kesLoanBalance: number;
  lockedCollateral: number;
}

export default function CoopPesaPortal({ 
  agentIdentity, 
  users,
  clusters
}: { 
  agentIdentity: AgentIdentity | null; 
  users: AgentIdentity[]; 
  clusters: string[];
}) {
  const [wallet, setWallet] = useState<WalletData>({
    coopPesaBalance: 12450,
    kesLoanBalance: 2800,
    lockedCollateral: 4000
  });

  const [transactions, setTransactions] = useState<CoopPesaTx[]>([
    {
      id: 'tx1', date: new Date().toISOString(), type: 'transfer', description: 'Farm Labor', amount: 200, fromUser: 'John', toUser: agentIdentity?.name, currency: 'COOP_PESA', status: 'completed'
    },
    {
      id: 'tx2', date: new Date(Date.now() - 86400000).toISOString(), type: 'transfer', description: 'Fertilizer Purchase', amount: 1500, fromUser: agentIdentity?.name, toUser: 'AgriShop', currency: 'COOP_PESA', status: 'completed'
    }
  ]);

  const [showQRModal, setShowQRModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [showLoanModal, setShowLoanModal] = useState(false);

  if (!agentIdentity) {
    return <div className="p-8 text-center text-gray-500">Please log in to access your CoopPesa Wallet.</div>;
  }

  const handleBorrow = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this matches the borrow_kes RPC logic
    alert('Loan request initiated. 70% LTV applies.');
    setShowLoanModal(false);
  };

  const handleMockScan = () => {
    // Mocking scanning a QR code to send funds
    const amount = prompt("Scanned User 'Alice'. Enter amount of CoopPesa to send:");
    if (amount && !isNaN(Number(amount))) {
      setWallet(prev => ({...prev, coopPesaBalance: prev.coopPesaBalance - Number(amount)}));
      setTransactions(prev => [{
        id: Math.random().toString(),
        date: new Date().toISOString(),
        type: 'transfer',
        description: 'QR Transfer',
        amount: Number(amount),
        fromUser: agentIdentity.name,
        toUser: 'Alice',
        currency: 'COOP_PESA',
        status: 'completed'
      }, ...prev]);
      alert(`Successfully sent ${amount} CP to Alice!`);
    }
    setShowScanner(false);
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 pb-20 font-sans">
      
      {/* Header */}
      <div className="bg-green-700 text-white p-6 rounded-b-3xl shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-40 h-40 bg-green-600 rounded-full opacity-50 blur-2xl"></div>
        
        <div className="flex justify-between items-center mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white text-green-700 rounded-full flex items-center justify-center font-bold text-lg">
              {agentIdentity.name.charAt(0)}
            </div>
            <div>
              <p className="text-sm text-green-100">Hi, {agentIdentity.name}!</p>
              <p className="text-xs text-green-200">Reputation: 100 PTS</p>
            </div>
          </div>
          <button onClick={() => setShowScanner(true)} className="p-2 bg-green-600 rounded-full hover:bg-green-500 transition">
            <Camera size={20} />
          </button>
        </div>

        <div className="text-center relative z-10 mb-8">
          <p className="text-sm text-green-100 uppercase tracking-wider mb-1">Wallet Balance</p>
          <h1 className="text-5xl font-black mb-2">{wallet.coopPesaBalance.toLocaleString()} <span className="text-2xl font-semibold">CP</span></h1>
          <p className="text-sm text-green-200">≈ {wallet.coopPesaBalance.toLocaleString()} KES Value (Pegged 1:1)</p>
        </div>

        <div className="flex gap-4 relative z-10">
          <button 
            onClick={() => setShowQRModal(true)}
            className="flex-1 bg-white text-green-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100"
          >
            <ArrowDownLeft size={18} /> Receive
          </button>
          <button 
            onClick={() => setShowScanner(true)}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-green-500 hover:bg-green-500"
          >
            <ArrowUpRight size={18} /> Send
          </button>
        </div>
      </div>

      {/* Liquidity & Loans Block */}
      <div className="px-4 -mt-4 relative z-20">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <ShieldAlert size={14} /> Liquidity & Loans (BLF)
          </h2>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs text-blue-600 mb-1">Locked Collateral</p>
              <p className="font-bold text-blue-900">{wallet.lockedCollateral.toLocaleString()} CP</p>
            </div>
            <div className="bg-orange-50 rounded-xl p-3 border border-orange-100">
              <p className="text-xs text-orange-600 mb-1">Active KES Loan</p>
              <p className="font-bold text-orange-900">{wallet.kesLoanBalance.toLocaleString()} KES</p>
              <p className="text-[10px] text-orange-500 mt-1">Due in 5 days</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="flex-1 text-sm bg-gray-100 text-gray-700 font-bold py-2 rounded-lg hover:bg-gray-200">
              Repay Loan
            </button>
            <button 
              onClick={() => setShowLoanModal(true)}
              className="flex-1 text-sm bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700"
            >
              Borrow KES
            </button>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="px-4">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
          <History size={14} /> Recent Transactions
        </h2>
        
        <div className="space-y-3">
          {transactions.map(tx => (
            <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${tx.toUser === agentIdentity.name ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                  {tx.toUser === agentIdentity.name ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-900">{tx.description}</p>
                  <p className="text-xs text-gray-500">
                    {tx.toUser === agentIdentity.name ? `From ${tx.fromUser}` : `To ${tx.toUser}`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold ${tx.toUser === agentIdentity.name ? 'text-green-600' : 'text-gray-900'}`}>
                  {tx.toUser === agentIdentity.name ? '+' : '-'}{tx.amount.toLocaleString()} CP
                </p>
                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-400 mt-0.5">
                  <CheckCircle2 size={10} className="text-green-500" /> {tx.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* QR Modal (Receive) */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center sm:items-center">
          <div className="bg-white w-full sm:w-96 rounded-t-3xl sm:rounded-3xl p-6 pb-12 animate-in slide-in-from-bottom-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Receive CoopPesa</h3>
              <button onClick={() => setShowQRModal(false)} className="bg-gray-100 p-2 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-2xl border border-gray-200">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=kpl://wallet/${agentIdentity.id}`} alt="QR Code" className="w-[200px] h-[200px]" referrerPolicy="no-referrer" />
              <p className="mt-6 text-sm text-center text-gray-500">Scan this code to pay {agentIdentity.name}.</p>
            </div>
          </div>
        </div>
      )}

      {/* Scanner Mock Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center">
          <div className="absolute top-6 right-6 z-50">
            <button onClick={() => setShowScanner(false)} className="bg-white/20 text-white p-2 rounded-full"><X size={24}/></button>
          </div>
          <div className="w-64 h-64 border-2 border-white/50 rounded-3xl relative mb-8">
            <div className="absolute inset-0 bg-black/20"></div>
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl-xl mt-[-2px] ml-[-2px]"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr-xl mt-[-2px] mr-[-2px]"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl-xl mb-[-2px] ml-[-2px]"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br-xl mb-[-2px] mr-[-2px]"></div>
            <div className="h-full flex items-center justify-center text-white">Camera View Here</div>
          </div>
          <button onClick={handleMockScan} className="bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg">
            Simulate Successful Scan
          </button>
        </div>
      )}

      {/* Borrow Modal */}
      {showLoanModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6">
             <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Borrow KES (BLF)</h3>
              <button onClick={() => setShowLoanModal(false)} className="bg-gray-100 p-2 rounded-full"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleBorrow}>
              <p className="text-sm text-gray-600 mb-4">
                You can borrow hard KES by locking your CoopPesa as collateral. 
                <strong> The required collateral ratio is 70% LTV.</strong>
              </p>
              
              <div className="mb-4">
                <label className="block text-xs font-bold text-gray-500 mb-1">Requested Amount (KES)</label>
                <input type="number" required placeholder="e.g. 1000" className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 font-bold" />
              </div>
              
              <div className="bg-blue-50 p-3 rounded-xl border border-blue-100 mb-6">
                 <p className="text-xs text-blue-800">Required Lock: <span className="font-bold">~1,428 CP</span></p>
                 <p className="text-xs text-blue-800 mt-1">Interest: <span className="font-bold">5% (30 days)</span></p>
              </div>

              <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl">
                Confirm & Lock Collateral
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
