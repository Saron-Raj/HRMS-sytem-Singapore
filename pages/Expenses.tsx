
import React, { useState, useEffect } from 'react';
import { api } from '../services/api'; // Use new API Service
import { SiteLogRecord, ExpenseSummary } from '../types';
import { Plus, Search, Trash2, FileSpreadsheet, Construction, Wallet, Edit2, Check, Fuel, Users, HardHat, DollarSign, Loader2 } from 'lucide-react';
import { format, endOfMonth, parseISO, startOfMonth } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { utils, writeFile } from 'xlsx';

const Expenses = () => {
  const navigate = useNavigate();
  
  // Data State
  const [logs, setLogs] = useState<SiteLogRecord[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>({
      totalManpowerCost: 0, totalPremixCost: 0, totalPremixTon: 0, 
      totalDieselCost: 0, totalMaterialBuy: 0, grandTotal: 0, projectBudget: 0, balance: 0
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedSite, setSelectedSite] = useState<string>('All');
  
  // Dropdown list
  const [uniqueSites, setUniqueSites] = useState<string[]>([]);

  // Budget Edit State
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [tempBudget, setTempBudget] = useState<string>('0');

  // Load Unique Sites for dropdown (Initial load only)
  useEffect(() => {
      const loadSites = async () => {
          // Optimization: Ideally the API has a separate endpoint for "sites list", 
          // but for now we fetch all logs once or assume we have a list. 
          // Here we default to filtering on the result.
          const res = await api.expenses.getLogs({}); // Get all to find sites
          if(res.success) {
              const sites = Array.from(new Set(res.data.map(l => l.siteName))).sort();
              setUniqueSites(sites);
          }
      };
      loadSites();
  }, []);

  // Main Data Fetcher
  useEffect(() => {
    fetchData();
  }, [searchTerm, startDate, endDate, selectedSite]); // Re-fetch when filters change

  const fetchData = async () => {
      setLoading(true);
      const filter = { startDate, endDate, siteName: selectedSite, search: searchTerm };
      
      try {
          // Parallel Fetching for performance
          const [logsRes, summaryRes] = await Promise.all([
              api.expenses.getLogs(filter),
              api.expenses.getSummary(filter)
          ]);

          if(logsRes.success) setLogs(logsRes.data);
          if(summaryRes.success) {
              setSummary(summaryRes.data);
              setTempBudget(summaryRes.data.projectBudget.toString());
          }
      } catch (e) {
          console.error("API Error", e);
      } finally {
          setLoading(false);
      }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.confirm("Delete this site log record?")) {
          await api.expenses.deleteLog(id);
          fetchData(); // Refresh data
      }
  };

  const handleSaveBudget = async () => {
      if (selectedSite === 'All') return;
      const amount = parseFloat(tempBudget) || 0;
      await api.expenses.saveBudget(selectedSite, amount);
      setIsEditingBudget(false);
      fetchData(); // Refresh summary to update balance
  };

  const handleExportExcel = () => {
      const headers = [
         "Sno", "DATE", "SITE", "NUMBER OF PAX", "", "TIME", "", "HRS", "RATE", "MANPOWER COST",
         "PREMIX BUY", "", "GRADED CEMENT/STONE", "DIESEL", "", "SOIL(OUT)/THROW", "MATERIAL BUY", "REMARKS"
      ];
      
      const subHeaders = [
          "", "", "", "GW", "REO/RES", "Start", "End", "", "($)", "($)", "TON", "Cost ($)", "", "Amt ($)", "Details", "", "($)", ""
      ];

      const dataRows = logs.map((log, index) => [
          index + 1,
          format(parseISO(log.date), 'dd/MM/yyyy'),
          log.siteName,
          log.paxGw || '',
          log.paxReo || '',
          log.startTime,
          log.endTime,
          log.totalHours,
          log.hourlyRate,
          log.manpowerCost,
          log.premixTon || '',
          log.premixCost || '',
          log.gradedStone,
          log.dieselCost || '',
          log.diesel || '',
          log.soilThrow,
          log.materialBuy || '',
          log.remarks
      ]);

      const ws_data = [headers, subHeaders, ...dataRows];
      const ws = utils.aoa_to_sheet(ws_data);
      const wscols = [
        {wch:5}, {wch:12}, {wch:15}, {wch:6}, {wch:6}, {wch:8}, {wch:8}, {wch:6}, {wch:6}, {wch:15},
        {wch:8}, {wch:10}, {wch:20}, {wch:10}, {wch:15}, {wch:20}, {wch:15}, {wch:30}
      ];
      ws['!cols'] = wscols;
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Site Log");
      writeFile(wb, `Site_Log_${startDate}_to_${endDate}.xlsx`);
  };

  const SummaryCard = ({ title, amount, icon: Icon, color, subValue }: any) => (
      <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-full min-h-[110px]">
          <div className="flex justify-between items-start">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{title}</span>
             <div className={`p-1.5 rounded-lg ${color.bg} ${color.text}`}>
                 <Icon size={16} />
             </div>
          </div>
          <div className="mt-2">
             <div className="text-2xl font-extrabold text-slate-800">${amount.toLocaleString()}</div>
             {subValue && (
                 <div className="text-xs font-bold text-slate-500 mt-1">{subValue}</div>
             )}
          </div>
      </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Location Expenses</h2>
          <p className="text-slate-500 font-medium">Manage project budgets, manpower costs, and daily logs.</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
            <button 
                onClick={handleExportExcel} 
                disabled={logs.length === 0}
                className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition shadow-sm border border-emerald-100 flex items-center gap-2 font-bold text-sm disabled:opacity-50 flex-1 md:flex-none justify-center"
            >
                <FileSpreadsheet size={20} /> <span className="hidden sm:inline">Export</span> Excel
            </button>
            <button 
                onClick={() => navigate('/expenses/new')}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex-1 md:flex-none justify-center"
            >
                <Plus size={20} /> Add <span className="hidden sm:inline">Daily</span> Log
            </button>
        </div>
      </div>

      {/* FILTERS SECTION */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div className="flex flex-col xl:flex-row gap-4 items-center">
                   <div className="relative flex-1 w-full xl:w-auto">
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                        <input 
                        type="text" 
                        placeholder="Search logs..." 
                        className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        />
                   </div>
                   <div className="flex items-center gap-2 w-full xl:w-auto">
                        <select 
                                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 w-full xl:w-48"
                                value={selectedSite}
                                onChange={(e) => setSelectedSite(e.target.value)}
                        >
                            <option value="All">All Locations</option>
                            {uniqueSites.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                   </div>
                   <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 w-full xl:w-auto">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100 flex-1 md:flex-none">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="outline-none text-xs font-bold text-slate-700 bg-transparent w-full" />
                        </div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg shadow-sm border border-slate-100 flex-1 md:flex-none">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
                            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="outline-none text-xs font-bold text-slate-700 bg-transparent w-full" />
                        </div>
                   </div>
          </div>
      </div>

      {loading ? (
           <div className="py-20 flex justify-center">
               <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
           </div>
      ) : (
      <>
        {/* DETAILED SUMMARY ROW */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 animate-fade-in">
                <SummaryCard 
                    title="Manpower" 
                    amount={summary.totalManpowerCost} 
                    icon={Users} 
                    color={{bg: 'bg-blue-50', text: 'text-blue-600'}} 
                />
                <SummaryCard 
                    title="Premix" 
                    amount={summary.totalPremixCost} 
                    subValue={`Qty: ${summary.totalPremixTon.toFixed(1)} Tons`}
                    icon={Construction} 
                    color={{bg: 'bg-amber-50', text: 'text-amber-600'}} 
                />
                <SummaryCard 
                    title="Diesel" 
                    amount={summary.totalDieselCost} 
                    icon={Fuel} 
                    color={{bg: 'bg-purple-50', text: 'text-purple-600'}} 
                />
                <SummaryCard 
                    title="Materials" 
                    amount={summary.totalMaterialBuy} 
                    icon={HardHat} 
                    color={{bg: 'bg-emerald-50', text: 'text-emerald-600'}} 
                />
                
                {/* Grand Total */}
                <div className="bg-slate-800 p-4 rounded-xl shadow-md flex flex-col justify-between h-full text-white min-h-[110px] col-span-2 sm:col-span-1">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Grand Total</span>
                        <div className="p-1.5 rounded-lg bg-slate-700 text-white">
                            <DollarSign size={16} />
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="text-2xl font-extrabold text-white">${summary.grandTotal.toLocaleString()}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Total Expenses</div>
                    </div>
                </div>

                {/* Budget Balance */}
                <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between h-full relative group min-h-[110px] col-span-2 sm:col-span-1">
                    <div className="flex justify-between items-start">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Project Balance</span>
                        <div className={`p-1.5 rounded-lg ${summary.balance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            <Wallet size={16} />
                        </div>
                    </div>
                    
                    {selectedSite === 'All' ? (
                        <div className="mt-auto pt-2">
                            <div className="text-xs font-medium text-slate-400 leading-tight">
                                Select a location above to manage budget.
                            </div>
                        </div>
                    ) : isEditingBudget ? (
                        <div className="flex items-center gap-1 mt-auto pt-2">
                            <input 
                                type="number" 
                                className="w-full border-b-2 border-blue-500 font-bold text-lg outline-none bg-white text-black py-1"
                                value={tempBudget}
                                onChange={(e) => setTempBudget(e.target.value)}
                                autoFocus
                                placeholder="Amount"
                            />
                            <button onClick={handleSaveBudget} className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition"><Check size={16} /></button>
                        </div>
                    ) : (
                        <div className="mt-2 flex flex-col h-full justify-end">
                            {summary.projectBudget > 0 ? (
                                <>
                                    <div className={`text-2xl font-extrabold ${summary.balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                        ${summary.balance.toLocaleString()}
                                    </div>
                                    <div className="flex justify-between items-center mt-1">
                                        <div className="text-[10px] text-slate-400 font-bold">
                                            Budget: ${summary.projectBudget.toLocaleString()}
                                        </div>
                                        <button 
                                            onClick={() => setIsEditingBudget(true)} 
                                            className="text-blue-500 hover:text-blue-700 p-1 bg-blue-50 rounded"
                                            title="Edit Budget"
                                        >
                                            <Edit2 size={12} />
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <button 
                                    onClick={() => setIsEditingBudget(true)}
                                    className="w-full py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 mt-auto"
                                >
                                    <Plus size={14} /> Set Project Budget
                                </button>
                            )}
                        </div>
                    )}
                </div>
        </div>

        {/* Site Log Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden animate-fade-in">
            <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                <tr>
                    <th className="px-4 py-3 whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 whitespace-nowrap">Site Name</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Hours</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Pax (GW/REO)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Manpower ($)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Premix ($)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Diesel ($)</th>
                    <th className="px-4 py-3 text-right whitespace-nowrap">Material ($)</th>
                    <th className="px-4 py-3 whitespace-nowrap">Remarks</th>
                    <th className="px-4 py-3 text-center whitespace-nowrap">Action</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {logs.length === 0 && (
                        <tr>
                            <td colSpan={10} className="px-6 py-10 text-center text-slate-400">
                                <div className="flex flex-col items-center">
                                    <Construction size={32} className="mb-2 opacity-30" />
                                    <p>No logs found. Add a new record to get started.</p>
                                </div>
                            </td>
                        </tr>
                    )}
                    {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50 group transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-700 whitespace-nowrap">
                                {format(parseISO(log.date), 'dd MMM yyyy')}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                                {log.siteName}
                                <div className="text-[10px] text-slate-400">{log.startTime} - {log.endTime}</div>
                            </td>
                            <td className="px-4 py-3 text-center font-bold text-slate-600">
                                {log.totalHours}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                                <span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-bold mr-1">{log.paxGw}</span>
                                <span className="bg-purple-50 text-purple-700 px-1.5 py-0.5 rounded text-[10px] font-bold">{log.paxReo}</span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-700">
                                ${log.manpowerCost?.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                                {log.premixCost ? `$${log.premixCost.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                                {log.dieselCost ? `$${log.dieselCost.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-slate-500">
                                {log.materialBuy ? `$${log.materialBuy.toFixed(2)}` : '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 max-w-[150px] truncate" title={log.remarks}>
                                {log.remarks || '-'}
                            </td>
                            <td className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        onClick={() => navigate(`/expenses/${log.id}`)}
                                        className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={14} />
                                    </button>
                                    <button 
                                        onClick={(e) => handleDelete(log.id, e)}
                                        className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
      </>
      )}
    </div>
  );
};

export default Expenses;
