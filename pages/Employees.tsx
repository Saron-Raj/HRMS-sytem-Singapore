
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Employee, SalaryType } from '../types';
import { Plus, Search, Trash2, Edit2, User, FileSpreadsheet, RotateCcw, Ban, Calendar, Loader2 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { utils, writeFile } from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

const Employees = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'active' | 'cancelled'>('active');
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    refreshEmployees();
  }, [viewMode]);

  const refreshEmployees = async () => {
      setIsLoading(true);
      const status = viewMode === 'active' ? 'Active' : 'Cancelled';
      try {
          const res = await api.employees.getAll(status);
          if(res.success) {
             setEmployees(res.data);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  useEffect(() => {
    if (location.state && location.state.openId) {
        navigate(`/employees/${location.state.openId}`);
    }
  }, [location, navigate]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to PERMANENTLY delete this employee? This cannot be undone.')) {
      await api.employees.delete(id);
      refreshEmployees();
    }
  };

  const handleCancelWorker = async (emp: Employee) => {
      if (window.confirm(`Are you sure you want to CANCEL ${emp.name}? \n\nThey will be moved to the Cancelled Workers list immediately.`)) {
          // Optimistic update: Remove from UI immediately for instant feedback
          setEmployees(prev => prev.filter(e => e.id !== emp.id));

          const updatedEmp: Employee = {
              ...emp,
              status: 'Cancelled',
              cancellationDate: new Date().toISOString()
          };
          
          try {
            await api.employees.update(updatedEmp);
            // No need to refreshEmployees() as we already updated the UI locally
          } catch(e) {
            console.error("Failed to cancel worker", e);
            refreshEmployees(); // Revert on error
            alert("An error occurred while cancelling the worker.");
          }
      }
  };

  const handleReactivateWorker = async (emp: Employee) => {
      if (window.confirm(`Reactivate ${emp.name}? \n\nThey will reappear in Active lists.`)) {
           const updatedEmp: Employee = {
              ...emp,
              status: 'Active',
              cancellationDate: undefined
          };
          await api.employees.update(updatedEmp);
          refreshEmployees();
          setViewMode('active');
      }
  };

  const exportData = (exportType: 'xlsx' | 'pdf') => {
      const dataToExport = employees; // Already filtered by viewMode from API
      
      if (exportType === 'pdf') {
           const doc = new jsPDF('l', 'mm', 'a3');
           const headers = [ "SN", "Full Name", "Nationality", "DOB", "Pass", "NRIC/FIN", "WP No", "WP Exp", "Mobile", "Position", "Status", "Cancelled On" ];

           const rows = dataToExport.map((emp, index) => [
              index + 1, emp.name, emp.nationality || '-', emp.dob || '-', emp.passType || '-',
              emp.fin, emp.wpNumber || '-', emp.workPermitExpiry || '-', emp.mobileNumber || '-',
              emp.position || '-', emp.status, emp.cancellationDate ? format(new Date(emp.cancellationDate), 'dd/MM/yyyy') : '-'
           ]);

           doc.text(`${viewMode === 'active' ? 'Active' : 'Cancelled'} Worker List`, 14, 15);
           autoTable(doc, { head: [headers], body: rows, startY: 20, styles: { fontSize: 8, cellPadding: 2 }, headStyles: { fillColor: [15, 23, 42] } });
           doc.save(`Worker_List_${viewMode}.pdf`);
           return;
      }

      const headers = [
          "SN", "Full Name", "Nationality", "Country of Birth", "DOB", "SG/SPR/WP/SP", "NRIC/FIN", "WP Number", "WP Expiry Date", 
          "Passport No", "Passport Expiry Date", "REO Expiry Date", "Safety Course Expiry", "Boom Lift Expiry", "Scissor Lift Expiry",
          "Rigger & Signalman", "Supervise Lifting Operation", "Basic Traffic Controller Course", "Mobile Number", "Designation", "Status", "Cancellation Date"
      ];

      const getCourseExpiry = (emp: Employee, keywords: string[]) => {
          if (!emp.courses) return '-';
          const found = emp.courses.find(c => keywords.some(k => c.name.toLowerCase().includes(k.toLowerCase())));
          return found ? found.expiryDate : '-';
      };

      const rows = dataToExport.map((emp, index) => [
          index + 1, emp.name, emp.nationality || '-', emp.countryOfBirth || '-', emp.dob || '-', emp.passType || '-',
          emp.fin, emp.wpNumber || emp.fin || '-', emp.workPermitExpiry || '-', emp.passportNo || '-', emp.passportExpiry || '-',
          emp.reoExpiry || '-', getCourseExpiry(emp, ['Safety', 'CSOC', 'BCSS']), getCourseExpiry(emp, ['Boom Lift']),
          getCourseExpiry(emp, ['Scissor Lift']), getCourseExpiry(emp, ['Rigger', 'Signalman']), getCourseExpiry(emp, ['Supervise Lifting', 'Lifting Operation']),
          getCourseExpiry(emp, ['Traffic Controller']), emp.mobileNumber || '-', emp.position || '-', emp.status,
          emp.cancellationDate ? format(new Date(emp.cancellationDate), 'dd-MM-yyyy') : '-'
      ]);

      const ws = utils.aoa_to_sheet([headers, ...rows]);
      const wb = utils.book_new();
      utils.book_append_sheet(wb, ws, "Worker Details");
      ws['!cols'] = headers.map(() => ({ wch: 20 }));
      writeFile(wb, `Worker_List_${viewMode}.xlsx`);
  };

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.fin.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Employees</h2>
          <p className="text-slate-500 font-medium">Manage your workforce, contracts, and documents.</p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
             <button onClick={() => setViewMode('active')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'active' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                 <User size={16} /> Active
             </button>
             <button onClick={() => setViewMode('cancelled')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${viewMode === 'cancelled' ? 'bg-white text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                 <Trash2 size={16} /> Cancelled
             </button>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => exportData('xlsx')} className="p-3 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition shadow-sm border border-emerald-100" title="Export Excel"><FileSpreadsheet size={20} /></button>
            <button onClick={() => navigate('/employees/new')} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 active:scale-95"><Plus size={20} /> Add Worker</button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
           <div className="relative">
             <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-800" size={20} />
             <input type="text" placeholder="Search by name or FIN number..." className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
           </div>
        </div>

        <div className="overflow-x-auto">
          {/* Added min-w-[1000px] to force horizontal scroll on mobile if content is too wide */}
          <table className="w-full text-sm text-left min-w-[1000px]">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-4">Name / Position</th>
                <th className="px-6 py-4">ID Details</th>
                <th className="px-6 py-4">Salary Type</th>
                <th className="px-6 py-4">Pass Status</th>
                <th className="px-6 py-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                  <tr><td colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></td></tr>
              ) : filteredEmployees.length === 0 ? (
                  <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center">
                              <User size={40} className="mb-2 opacity-50" />
                              <p>No {viewMode} employees found.</p>
                          </div>
                      </td>
                  </tr>
              ) : (
                filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white shadow-md ${emp.status === 'Cancelled' ? 'bg-slate-400' : 'bg-gradient-to-br from-blue-500 to-blue-600'}`}>
                                {emp.name.charAt(0)}
                            </div>
                            <div>
                                <div className="font-bold text-slate-800 text-base flex items-center gap-2">
                                    {emp.name}
                                    {emp.status === 'Cancelled' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full border border-red-200 uppercase tracking-wide">Inactive</span>}
                                </div>
                                <div className="text-slate-500 text-xs flex items-center gap-1">{emp.position}</div>
                                {emp.status === 'Cancelled' && emp.cancellationDate && (
                                    <div className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1 bg-red-50 px-1.5 py-0.5 rounded w-fit">
                                        <Calendar size={10} /> Cancelled: {format(new Date(emp.cancellationDate), 'dd MMM yyyy')}
                                    </div>
                                )}
                            </div>
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="font-mono text-slate-700 font-bold">{emp.fin}</div>
                        <div className="text-xs text-slate-400">WP: {emp.wpNumber || '-'}</div>
                    </td>
                    <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${emp.salaryType === SalaryType.MONTHLY ? 'bg-purple-50 text-purple-700 border border-purple-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                            {emp.salaryType}
                        </span>
                        <div className="text-xs font-bold text-slate-600 mt-1">${emp.basicSalary}</div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">{emp.passType}</span>
                            {emp.workPermitExpiry && <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Exp: {emp.workPermitExpiry}</span>}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => navigate(`/employees/${emp.id}`)} className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold border border-blue-100" title="Edit Details"><Edit2 size={14} /> Edit</button>
                            {viewMode === 'active' ? (
                                <button onClick={() => handleCancelWorker(emp)} className="p-2 text-red-500 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-100 rounded-lg transition-colors" title="Cancel Worker"><Ban size={16} /></button>
                            ) : (
                                <>
                                    <button onClick={() => handleReactivateWorker(emp)} className="p-2 text-emerald-500 bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-100 rounded-lg transition-colors" title="Reactivate"><RotateCcw size={16} /></button>
                                    <button onClick={() => handleDelete(emp.id)} className="p-2 text-red-600 bg-white border border-slate-200 hover:bg-red-50 hover:border-red-100 rounded-lg transition-colors" title="Delete Permanently"><Trash2 size={16} /></button>
                                </>
                            )}
                        </div>
                    </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Employees;
