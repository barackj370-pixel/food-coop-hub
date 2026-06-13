import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import html2pdf from 'html2pdf.js';
import { FOOD_COOPS } from '../constants';

interface VoucherData {
  serialNumber: string;
  customerName: string;
  foodCoop: string;
}

const VoucherCard: React.FC<VoucherData> = ({ serialNumber, customerName, foodCoop }) => {
  return (
    <div className="w-full max-w-[8.5in] h-[6.5in] border-t-2 border-b-2 border-r-2 border-l-[6px] border-l-green-600 border-dashed border-slate-300 p-6 flex flex-row bg-white relative mb-8 page-break-inside-avoid shadow-sm print:shadow-none">
       {/* Stub portion (stays in booklet) */}
       <div className="w-[30%] border-r-2 border-dashed border-slate-300 pr-6 flex flex-col justify-between">
          <div>
            <h3 className="font-bold flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
              <i className="fas fa-ticket-alt"></i> KPL Stub
            </h3>
            <p className="font-black text-xl mt-2">{serialNumber}</p>
            <p className="text-xs text-slate-400 mt-1 truncate">{foodCoop}</p>
          </div>
          <div className="text-sm space-y-4 mt-2">
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Issued To</p>
              <p className="font-bold border-b border-slate-200 pb-1 text-xs">{customerName || '_________________________'}</p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider mb-1">Date</p>
              <p className="font-bold border-b border-slate-200 pb-1 text-xs">_________________________</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-2 gap-y-2 mt-2">
            <div>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Total Value</p>
              <div className="border-b-2 border-slate-300 w-full h-4 mt-1 flex items-end font-bold text-xs"><span className="text-[7px] text-slate-400 mr-1 pb-0.5">KES</span></div>
            </div>
            <div>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Amount Used</p>
              <div className="border-b-2 border-slate-300 w-full h-4 mt-1 flex items-end font-bold text-xs"><span className="text-[7px] text-slate-400 mr-1 pb-0.5">KES</span></div>
            </div>
            <div>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Balance</p>
              <div className="border-b-2 border-slate-300 w-full h-4 mt-1 flex items-end font-bold text-xs"><span className="text-[7px] text-slate-400 mr-1 pb-0.5">KES</span></div>
            </div>
            <div>
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Repay (+10%)</p>
              <div className="border-b-2 border-slate-300 w-full h-4 mt-1 flex items-end font-bold text-xs"><span className="text-[7px] text-slate-400 mr-1 pb-0.5">KES</span></div>
            </div>
            <div className="col-span-2">
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Due Date <span className="lowercase normal-case tracking-normal">(DD/MM/YYYY)</span></p>
              <div className="border-b-2 border-slate-300 w-full h-4 mt-1 flex items-end"></div>
            </div>
            <div className="col-span-2 pt-1">
              <p className="text-[8px] text-slate-400 uppercase tracking-widest mb-1">Customer Sign</p>
              <div className="border-b-2 border-slate-300 border-dashed w-full h-4 mt-1 flex items-end"></div>
            </div>
          </div>
          
          <div className="mt-4 border-2 border-slate-200 rounded-lg p-3 bg-slate-50 relative z-10 print:bg-white print:border-slate-300">
            <p className="text-[8px] text-slate-500 uppercase tracking-widest font-black text-center mb-1 border-b border-slate-200 pb-1">Repayment Clearance</p>
            <div className="flex items-center gap-2 mt-1.5">
               <div className="w-3.5 h-3.5 border-2 border-slate-400 bg-white"></div>
               <span className="text-[9px] font-black text-slate-700">PAID (CLEARED)</span>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-1">
               <span className="text-[7px] text-slate-500 font-bold uppercase flex-shrink-0">Sign/Date</span>
               <div className="w-full border-b border-slate-400 border-dashed h-2"></div>
            </div>
          </div>
          
          <div className="mt-3 w-full">
             <p className="text-[8px] text-slate-400 font-bold tracking-widest text-left mb-1 uppercase">ChaPesa Agent Stamp</p>
             <div className="border-2 border-dashed border-slate-300 rounded-lg h-20 bg-slate-50/50 print:bg-white w-full"></div>
          </div>
       </div>

       {/* Main voucher portion (tears off to customer) */}
       <div className="w-[70%] pl-8 flex flex-col justify-between relative overflow-hidden">
          <div className="flex justify-between items-start relative z-10">
             <div>
               <h2 className="font-black text-2xl tracking-widest text-green-700">ChaPesa Voucher</h2>
               <p className="text-sm font-bold text-slate-500 mt-1">{foodCoop}</p>
             </div>
             <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
               <QRCodeSVG value={serialNumber} size={64} level="M" />
             </div>
          </div>

          <div className="my-4 relative z-10">
             <div className="mb-4">
               <p className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-1">Issued To</p>
               <p className="font-black text-xl text-slate-800">{customerName || '__________________________________'}</p>
             </div>
             <div className="flex justify-between mt-2 border-b-2 border-slate-100 pb-2">
               <span className="text-slate-500 text-sm font-bold uppercase tracking-wider">Serial No</span>
               <span className="font-black text-slate-800">{serialNumber}</span>
             </div>
          </div>

          <div className="flex justify-between items-start relative z-10 mt-3">
             <div className="flex gap-3 flex-wrap">
               <div>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-1">Total Value</p>
                  <div className="border-b-2 border-slate-300 w-[60px] h-6 mt-1 flex items-end font-bold text-sm"><span className="text-[8px] text-slate-400 mr-0.5 pb-0.5">KES</span></div>
               </div>
               <div>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-1">Amount Used</p>
                  <div className="border-b-2 border-slate-300 w-[60px] h-6 mt-1 flex items-end font-bold text-sm"><span className="text-[8px] text-slate-400 mr-0.5 pb-0.5">KES</span></div>
               </div>
               <div>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-1">Balance</p>
                  <div className="border-b-2 border-slate-300 w-[60px] h-6 mt-1 flex items-end font-bold text-sm"><span className="text-[8px] text-slate-400 mr-0.5 pb-0.5">KES</span></div>
               </div>
               <div>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-1">Repay (+10%)</p>
                  <div className="border-b-2 border-slate-300 w-[60px] h-6 mt-1 flex items-end font-bold text-sm"><span className="text-[8px] text-slate-400 mr-0.5 pb-0.5">KES</span></div>
               </div>
               <div>
                  <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-1">Due Date <span className="lowercase normal-case tracking-normal">(DD/MM/YY)</span></p>
                  <div className="border-b-2 border-slate-300 w-[80px] h-6 mt-1 flex items-end"></div>
               </div>
             </div>
             <div className="text-right text-[7.5px] text-slate-400 font-bold uppercase tracking-wider space-y-1 flex-shrink-0 w-32 pl-2 leading-tight">
               <p><i className="fas fa-check-circle mr-1 text-green-500"></i> Valid at authorized agents only.</p>
               <p><i className="fas fa-ban mr-1 text-red-500"></i> Not exchangeable for cash.</p>
             </div>
          </div>

          <div className="mt-4 relative z-10">
             <div className="flex gap-4 items-end mb-3">
               <div className="flex-1">
                 <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-1">Items Purchased & Comments</p>
                 <div className="border-b border-slate-300 border-dashed w-full h-4"></div>
                 <div className="border-b border-slate-300 border-dashed w-full h-5 mt-1"></div>
               </div>
             </div>
             <div className="flex justify-between items-end gap-6 mb-2">
               <div className="flex-1">
                 <div className="flex items-end gap-2">
                   <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest flex-shrink-0">Customer Sign:</span>
                   <div className="flex-1 border-b border-slate-400 border-dashed h-4"></div>
                 </div>
               </div>
               <div className="w-1/3">
                 <div className="flex items-end gap-2">
                   <span className="text-[8px] text-slate-500 font-bold uppercase tracking-widest flex-shrink-0">Sign Date:</span>
                   <div className="flex-1 border-b border-slate-400 border-dashed h-4"></div>
                 </div>
               </div>
             </div>
             
             <div className="mt-3 w-full">
                <p className="text-[9px] text-slate-400 font-bold tracking-widest text-left mb-1 uppercase">ChaPesa Agent Stamp</p>
                <div className="border-2 border-dashed border-slate-300 rounded-lg h-24 bg-slate-50/50 print:bg-white w-full"></div>
             </div>
          </div>

          {/* Usage Log for partial redemptions */}
          <div className="mt-4 pt-4 border-t-2 border-slate-100 flex justify-between items-end relative z-10 gap-4">
             <div className="flex-1">
               <p className="text-[8px] text-slate-400 uppercase tracking-widest font-bold mb-0.5">Usage Log (For Agent Use)</p>
               <table className="w-full text-left text-[9px] font-bold text-slate-800 border border-slate-200">
                 <thead>
                   <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="p-1 px-2 border-r border-slate-200 w-1/4 uppercase text-[8px] text-slate-400">Date</th>
                      <th className="p-1 px-2 border-r border-slate-200 w-1/4 uppercase text-[8px] text-slate-400">Agent</th>
                      <th className="p-1 px-2 border-r border-slate-200 w-1/4 uppercase text-[8px] text-slate-400">Value Used</th>
                      <th className="p-1 px-2 uppercase text-[8px] text-slate-400">Balance</th>
                   </tr>
                 </thead>
                 <tbody>
                   <tr className="border-b border-slate-200 h-6">
                      <td className="border-r border-slate-200"></td><td className="border-r border-slate-200"></td><td className="border-r border-slate-200"></td><td></td>
                   </tr>
                   <tr className="h-6">
                      <td className="border-r border-slate-200"></td><td className="border-r border-slate-200"></td><td className="border-r border-slate-200"></td><td></td>
                   </tr>
                 </tbody>
               </table>
             </div>
             
             <div className="w-48 border-2 border-slate-200 bg-slate-50 rounded-lg p-3 flex flex-col justify-between print:bg-white print:border-slate-300">
               <p className="text-[8.5px] text-slate-500 uppercase tracking-widest font-black text-center border-b border-slate-200 pb-1 mb-2">Official Clearance</p>
               <div className="flex items-center gap-2 justify-center my-2">
                 <div className="w-4 h-4 border-2 border-slate-400 bg-white shadow-inner"></div>
                 <span className="text-[10px] font-black uppercase text-slate-700">LOAN REPAID</span>
               </div>
               <div className="mt-2 space-y-2.5">
                 <div className="flex items-end gap-1.5">
                   <span className="text-[7.5px] text-slate-400 uppercase font-bold">Agent</span>
                   <div className="flex-1 border-b border-slate-400 border-dashed h-3"></div>
                 </div>
                 <div className="flex items-end gap-1.5">
                   <span className="text-[7.5px] text-slate-400 uppercase font-bold">Date</span>
                   <div className="flex-1 border-b border-slate-400 border-dashed h-3"></div>
                 </div>
               </div>
             </div>
          </div>
          
          <div className="absolute -top-10 -right-10 opacity-[0.03] pointer-events-none z-0">
             <i className="fas fa-leaf text-[15rem]"></i>
          </div>
       </div>
    </div>
  );
};

const PhysicalVoucherGenerator: React.FC = () => {
  const [vouchers, setVouchers] = useState<VoucherData[]>([]);
  
  const [coopCode, setCoopCode] = useState('11');
  const [agentNo, setAgentNo] = useState('1');
  const [monthYear, setMonthYear] = useState(new Date().toLocaleDateString('en-US', { month: '2-digit', year: '2-digit' }).replace('/', ''));
  const [startNo, setStartNo] = useState(1);
  const [customerInitials, setCustomerInitials] = useState('KO');
  const [foodCoop, setFoodCoop] = useState('Rabolo');
  
  const [batchCount, setBatchCount] = useState(5);

  const generateBatch = () => {
    const newVouchers: VoucherData[] = [];
    for (let i = 0; i < batchCount; i++) {
       const voucherNo = (startNo + i).toString().padStart(2, '0');
       // Format: 1101-1-0626KO
       // 11 = Coop code
       // 01 = Voucher No
       // -1 = Agent No
       // -0626 = Month Year
       // KO = Customer Initials
       const sn = `${coopCode}${voucherNo}-${agentNo}-${monthYear}${customerInitials}`;
       newVouchers.push({
         serialNumber: sn,
         customerName: customerInitials === '___' ? '' : '', // Customer name still to be filled by hand mostly
         foodCoop: `${foodCoop} Food Coop`
       });
    }
    setVouchers(newVouchers);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const element = document.getElementById('printable-vouchers-container');
    if (!element) return;
    
    // Temporarily clone the element to preserve print styles directly for html2pdf
    // But html2pdf handles standard rendered HTML. Since we're using tailwind and react,
    // the easiest is to just print the exact visible node.
    const opt = {
      margin:       10,
      filename:     `ChaPesa-Vouchers-${foodCoop || 'Batch'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="container mx-auto px-6 max-w-6xl print:hidden">
        <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-slate-100 mb-12">
           <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
             <i className="fas fa-print text-green-600"></i> Physical Voucher Generator
           </h2>
           <p className="text-slate-500 mb-8 font-medium">Generate a printable booklet of physical vouchers. The serial number follows the format: <strong>[CoopCode][No]-[AgentNo]-[MonthYear][Initials]</strong>. Click generate, then use your browser's print function.</p>
           
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Food Coop</label>
                 <select value={foodCoop} onChange={e => setFoodCoop(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-green-500 outline-none">
                   {FOOD_COOPS.map(coop => (
                     <option key={coop} value={coop}>{coop}</option>
                   ))}
                 </select>
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Coop Code</label>
                 <input type="text" value={coopCode} onChange={e => setCoopCode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. 11" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Starting No</label>
                 <input type="number" min="1" value={startNo} onChange={e => setStartNo(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Agent No</label>
                 <input type="text" value={agentNo} onChange={e => setAgentNo(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. 1" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Month/Year (MMYY)</label>
                 <input type="text" value={monthYear} onChange={e => setMonthYear(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. 0626" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Customer Initials</label>
                 <input type="text" value={customerInitials} onChange={e => setCustomerInitials(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-green-500 outline-none" placeholder="e.g. KO" />
              </div>
              <div>
                 <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Vouchers to Print</label>
                 <input type="number" min="1" max="100" value={batchCount} onChange={e => setBatchCount(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 font-bold focus:ring-2 focus:ring-green-500 outline-none" />
              </div>
           </div>
           
           <div className="flex gap-4">
             <button onClick={generateBatch} className="bg-slate-900 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-slate-800 transition-colors">
               <i className="fas fa-sync-alt mr-2"></i> Generate Batch
             </button>
             <button onClick={handlePrint} disabled={vouchers.length === 0} className="bg-green-600 disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-green-700 transition-colors">
               <i className="fas fa-print mr-2"></i> Print Booklet
             </button>
             <button onClick={handleDownloadPdf} disabled={vouchers.length === 0} className="bg-blue-600 disabled:opacity-50 text-white px-8 py-3.5 rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-blue-700 transition-colors">
               <i className="fas fa-download mr-2"></i> Download PDF
             </button>
           </div>
        </div>
      </div>

      <div className="container mx-auto px-6 max-w-5xl flex flex-col items-center">
        {/* Print Styles */}
        <style dangerouslySetInnerHTML={{__html: `
          @media print {
            body * {
              visibility: hidden;
            }
            .printable-vouchers, .printable-vouchers * {
              visibility: visible;
            }
            .printable-vouchers {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
              padding: 0;
              margin: 0;
              background: white;
            }
            .page-break-inside-avoid {
              page-break-inside: avoid;
            }
          }
        `}} />
        
        <div id="printable-vouchers-container" className="printable-vouchers w-full flex flex-col items-center">
          {vouchers.map((v, idx) => (
             <React.Fragment key={idx}>
                {(idx > 0 && idx % 2 === 0) && <div style={{ pageBreakBefore: 'always', clear: 'both' }}></div>}
                <VoucherCard {...v} />
             </React.Fragment>
          ))}
          {vouchers.length === 0 && (
            <div className="text-center p-12 text-slate-400 font-bold print:hidden">
              <i className="fas fa-ticket-alt text-4xl mb-4 opacity-20"></i>
              <p>No vouchers generated yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhysicalVoucherGenerator;
