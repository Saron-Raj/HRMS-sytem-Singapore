
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Employee, PayrollAdjustments, PayrollHistoryLog } from '../types';
import { ArrowLeft, Save, Trash2, ImageIcon, History, FileEdit, Loader2, Wallet, TrendingDown } from 'lucide-react';
import { format, parse, parseISO } from 'date-fns';

const PayrollAdjustmentsPage = () => {
  const { employeeId, month } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [editingAdj, setEditingAdj] = useState<PayrollAdjustments | null>(null);
  const [originalAdj, setOriginalAdj] = useState<PayrollAdjustments | null>(null);

  const [adjModalTab, setAdjModalTab] = useState<'edit' | 'history'>('edit');
  const [historyLogs, setHistoryLogs] = useState<PayrollHistoryLog[]>([]);

  useEffect(() => {
    if (employeeId && month) {
        fetchData();
    }
  }, [employeeId, month]);

  const fetchData = async () => {
      setLoading(true);
      if(!employeeId || !month) return;

      try {
          const res = await api.payroll.getAdjustmentDetails(employeeId, month);
          if (res.success) {
              setEmployee(res.data.employee);
              setEditingAdj(res.data.adjustments);
              setOriginalAdj(JSON.parse(JSON.stringify(res.data.adjustments))); // Deep copy
              setHistoryLogs(res.data.history);
          } else {
              navigate('/payroll');
          }
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const saveAdjustments = async () => {
    if (editingAdj && originalAdj && employee && month) {
        // In real backend, admin name comes from token.
        const profileRes = await api.auth.getProfile();
        const adminName = profileRes.success ? profileRes.data.name : 'Unknown Admin';
        
        const changes: string[] = [];
        
        const compare = (field: keyof PayrollAdjustments, label: string, isMoney: boolean = true) => {
            const oldVal = originalAdj[field] || 0;
            const newVal = editingAdj[field] || 0;
            
            if (field === 'attachedImage') {
                if (!originalAdj.attachedImage && editingAdj.attachedImage) changes.push("Added Time Card Image");
                else if (originalAdj.attachedImage && !editingAdj.attachedImage) changes.push("Removed Time Card Image");
                else if (originalAdj.attachedImage !== editingAdj.attachedImage) changes.push("Updated Time Card Image");
            } else {
                if (oldVal !== newVal) {
                    changes.push(`${label}: ${isMoney ? '$' : ''}${oldVal} → ${isMoney ? '$' : ''}${newVal}`);
                }
            }
        };

        compare('transport', 'Transport');
        compare('other', 'Other Allowances');
        compare('housing', 'Housing Deduction');
        compare('advance', 'Salary Advance');
        compare('attachedImage', 'Image', false);

        let newLog: PayrollHistoryLog | undefined = undefined;
        if (changes.length > 0) {
            newLog = {
                id: Date.now().toString(),
                adjustmentId: editingAdj.id,
                timestamp: new Date().toISOString(),
                adminName: adminName,
                changes: changes
            };
        }

        setLoading(true);
        await api.payroll.saveAdjustments(editingAdj, newLog);
        setLoading(false);
        navigate('/payroll');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && editingAdj) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = () => {
              setEditingAdj({ ...editingAdj, attachedImage: reader.result as string });
          };
          reader.readAsDataURL(file);
      }
  };

  const removeImage = () => {
      if (editingAdj) {
          setEditingAdj({ ...editingAdj, attachedImage: undefined });
      }
  };

  if (loading && !employee) {
      return (
          <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          </div>
      );
  }

  if (!employee || !editingAdj || !month) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
            <button 
                onClick={() => navigate('/payroll')}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors shadow-sm"
            >
                <ArrowLeft size={20} />
            </button>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    Payroll Adjustments
                </h2>
                <p className="text-slate-500 text-sm">
                    {employee.name} • {format(parse(month, 'yyyy-MM', new Date()), 'MMMM yyyy')}
                </p>
            </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex w-full md:w-fit overflow-x-auto">
            <button 
                onClick={() => setAdjModalTab('edit')}
                className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${adjModalTab === 'edit' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
                <FileEdit size={16} /> Edit Values
            </button>
            <button 
                onClick={() => setAdjModalTab('history')}
                className={`flex-1 md:flex-none px-6 py-2.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${adjModalTab === 'history' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
            >
                <History size={16} /> Change History
            </button>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            {adjModalTab === 'edit' && (
                <div className="p-4 md:p-8 space-y-8 max-w-5xl mx-auto">
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* ALLOWANCES SECTION */}
                        <div className="bg-emerald-50/50 p-6 rounded-2xl border border-emerald-100">
                            <h3 className="text-sm font-bold text-emerald-800 uppercase mb-6 flex items-center gap-2 pb-2 border-b border-emerald-200">
                                <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-600"><Wallet size={16} /></div>
                                Earnings & Allowances
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Transport Allowance ($)</label>
                                    <input type="number" step="0.01" className="w-full border border-slate-200 rounded-xl p-3.5 text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-emerald-700" 
                                        value={editingAdj.transport} onChange={e => setEditingAdj({...editingAdj, transport: parseFloat(e.target.value) || 0})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Other Allowances ($)</label>
                                    <input type="number" step="0.01" className="w-full border border-slate-200 rounded-xl p-3.5 text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-emerald-700" 
                                        value={editingAdj.other} onChange={e => setEditingAdj({...editingAdj, other: parseFloat(e.target.value) || 0})} />
                                </div>
                            </div>
                        </div>

                        {/* DEDUCTIONS SECTION */}
                        <div className="bg-red-50/50 p-6 rounded-2xl border border-red-100">
                            <h3 className="text-sm font-bold text-red-800 uppercase mb-6 flex items-center gap-2 pb-2 border-b border-red-200">
                                <div className="p-1.5 bg-red-100 rounded-lg text-red-600"><TrendingDown size={16} /></div>
                                Deductions
                            </h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Housing Deduction ($)</label>
                                    <input type="number" step="0.01" className="w-full border border-slate-200 rounded-xl p-3.5 text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all text-red-700" 
                                        value={editingAdj.housing} onChange={e => setEditingAdj({...editingAdj, housing: parseFloat(e.target.value) || 0})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Salary Advance ($)</label>
                                    <input type="number" step="0.01" className="w-full border border-slate-200 rounded-xl p-3.5 text-sm bg-white font-bold outline-none focus:ring-2 focus:ring-red-500 transition-all text-red-700" 
                                        value={editingAdj.advance} onChange={e => setEditingAdj({...editingAdj, advance: parseFloat(e.target.value) || 0})} />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="border-t border-slate-100 pt-8">
                        <label className="block text-xs font-bold text-slate-800 uppercase mb-3">Attached Manual Time Card</label>
                        <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 bg-slate-50 text-center relative group hover:border-blue-400 transition-colors min-h-[200px] flex items-center justify-center">
                            {editingAdj.attachedImage ? (
                                <div className="relative w-full">
                                    <img 
                                        src={editingAdj.attachedImage} 
                                        alt="Manual Time Card" 
                                        className="max-h-[400px] mx-auto rounded-lg shadow-sm object-contain"
                                    />
                                    <button 
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 bg-white text-red-500 p-2 rounded-xl shadow-lg hover:bg-red-50 border border-red-100 transition-colors font-bold flex items-center gap-2"
                                    >
                                        <Trash2 size={16} /> Remove
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center cursor-pointer relative w-full h-full py-10">
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        onChange={handleImageUpload}
                                    />
                                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition-transform">
                                        <ImageIcon size={32} />
                                    </div>
                                    <p className="text-base font-bold text-slate-700">Click to upload image</p>
                                    <p className="text-sm text-slate-400 mt-1">Scanned Yellow Card / Manual Sheet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {adjModalTab === 'history' && (
                <div className="p-0 overflow-y-auto bg-slate-50 min-h-[400px]">
                    {historyLogs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                            <History size={48} className="mb-4 opacity-30" />
                            <p className="text-base font-medium">No history recorded yet.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 max-w-4xl mx-auto py-8">
                            {historyLogs.map((log) => (
                                <div key={log.id} className="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 mb-4 mx-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs">
                                                {log.adminName.charAt(0)}
                                            </div>
                                            {log.adminName}
                                        </div>
                                        <div className="text-xs text-slate-400 font-bold bg-slate-100 px-2 py-1 rounded-lg">
                                            {format(parseISO(log.timestamp), 'dd MMM yyyy, HH:mm')}
                                        </div>
                                    </div>
                                    <ul className="text-sm text-slate-600 space-y-2 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        {log.changes.map((change, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <span className="text-blue-500 font-bold mt-1">•</span> {change}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {adjModalTab === 'edit' && (
                <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3 sticky bottom-0">
                    <button 
                        onClick={() => navigate('/payroll')} 
                        disabled={loading}
                        className="px-6 py-3 text-slate-500 hover:bg-white rounded-xl text-sm font-bold border border-transparent hover:border-slate-200 transition-all"
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={saveAdjustments} 
                        disabled={loading}
                        className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default PayrollAdjustmentsPage;
