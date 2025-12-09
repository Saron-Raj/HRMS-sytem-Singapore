
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Employee, SalaryType, Course, PayrollRecord } from '../types';
import { Trash2, User, FileText, BookOpen, History, CheckSquare, ArrowLeft, Loader2 } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateMonthlyPayroll } from '../utils/calculations';
import { format } from 'date-fns';

// Helper Component for Form Inputs
const InputField = ({ label, type = "text", value, onChange, placeholder, required = false, options = [], disabled = false, className = "" }: any) => {
    return (
        <div className={`flex flex-col w-full ${className}`}>
            <div className="flex items-center mb-2 h-5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate w-full leading-none" title={label}>
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            </div>
            {type === 'select' ? (
                <div className="relative h-11 w-full">
                    <select
                        className="w-full h-full bg-slate-50 border border-slate-200 rounded-lg px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm appearance-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                    >
                        {options.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                </div>
            ) : (
                <input
                    type={type}
                    className="w-full h-11 bg-slate-50 border border-slate-200 rounded-lg px-4 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                />
            )}
        </div>
    );
};

const EmployeeDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';
  
  const [activeTab, setActiveTab] = useState<'personal' | 'documents' | 'courses' | 'payroll'>('personal');
  const [historyPayrollData, setHistoryPayrollData] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const defaultFormState: Partial<Employee> = {
    name: '',
    fin: '',
    wpNumber: '',
    companyName: '',
    position: '',
    salaryType: SalaryType.DAILY,
    basicSalary: 0,
    joinDate: '',
    workPermitExpiry: '',
    passportExpiry: '',
    reoExpiry: '',
    nationality: '',
    countryOfBirth: '',
    dob: '',
    gender: 'Male',
    sector: '',
    passportNo: '',
    mobileNumber: '',
    passType: 'WP',
    status: 'Active',
    courses: []
  };

  const [formData, setFormData] = useState<Partial<Employee>>(defaultFormState);
  const [originalEmp, setOriginalEmp] = useState<Employee | null>(null);

  useEffect(() => {
    if (!isNew && id) {
        setIsLoading(true);
        api.employees.getById(id).then(res => {
            if (res.success && res.data) {
                const found = res.data;
                setFormData({ ...found, courses: found.courses || [] });
                setOriginalEmp(found);
                loadPayrollHistory(found.id);
            } else {
                navigate('/employees');
            }
            setIsLoading(false);
        });
    } else {
        setFormData(defaultFormState);
    }
  }, [id, isNew, navigate]);

  const loadPayrollHistory = async (empId: string) => {
      // Fetch data for the last 6 months to generate history
      // Note: This can be resource intensive, so for now we might show empty or limited data
      // Optimized way: create a backend endpoint for history.
      // Current simulation:
      // We will skip heavy calculation here to keep UI fast, as this is just a detail view.
      // If needed, we can implement `api.payroll.getHistory(empId)` later.
      setHistoryPayrollData([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const newEmployee: Employee = {
      ...formData as Employee,
      id: (!isNew && id) ? id : Date.now().toString(),
      status: formData.status || 'Active'
    };

    let response;
    if (isNew) {
        response = await api.employees.create(newEmployee);
    } else {
        response = await api.employees.update(newEmployee);
    }

    setIsSaving(false);
    
    if (response.success) {
        navigate('/employees');
    } else {
        alert("Failed to save employee: " + response.message);
    }
  };

  const handleCancelWorker = async () => {
      if (originalEmp && window.confirm(`Are you sure you want to CANCEL ${originalEmp.name}? \n\nThey will be moved to the Cancelled Workers list immediately.`)) {
          setIsSaving(true);
          const updatedEmp: Employee = {
              ...originalEmp,
              status: 'Cancelled',
              cancellationDate: new Date().toISOString()
          };
          const res = await api.employees.update(updatedEmp);
          setIsSaving(false);
          if (res.success) {
            navigate('/employees');
          } else {
            alert("Failed to cancel worker");
          }
      }
  };

  const handlePrintProfile = () => {
       if (!formData.name) return;
       
       const doc = new jsPDF('p', 'mm', 'a4');
       const singleEmployee = formData as Employee;
       
       // Single Profile Export
       doc.setFontSize(22);
       doc.setFont('helvetica', 'bold');
       doc.text(`EMPLOYEE PROFILE`, 105, 20, { align: 'center' });
       
       doc.setFontSize(10);
       doc.setFont('helvetica', 'normal');
       doc.text(`Generated: ${format(new Date(), 'dd MMM yyyy HH:mm')}`, 105, 26, { align: 'center' });
       
       const getCourseExpiry = (emp: Employee, keywords: string[]) => {
            if (!emp.courses) return '-';
            const found = emp.courses.find(c => 
                keywords.some(k => c.name.toLowerCase().includes(k.toLowerCase()))
            );
            return found ? found.expiryDate : '-';
        };

       const profileData = [
           ['Personal Information', ''],
           ['Full Name', singleEmployee.name],
           ['Nationality', singleEmployee.nationality || '-'],
           ['Country of Birth', singleEmployee.countryOfBirth || '-'],
           ['Date of Birth', singleEmployee.dob || '-'],
           ['Gender', singleEmployee.gender || '-'],
           ['Mobile Number', singleEmployee.mobileNumber || '-'],
           ['Employment Details', ''],
           ['Company Name', singleEmployee.companyName || '-'],
           ['Position', singleEmployee.position || '-'],
           ['Pass Type', singleEmployee.passType || '-'],
           ['FIN / NRIC', singleEmployee.fin],
           ['WP Number', singleEmployee.wpNumber || '-'],
           ['WP Expiry', singleEmployee.workPermitExpiry || '-'],
           ['Passport No', singleEmployee.passportNo || '-'],
           ['Passport Expiry', singleEmployee.passportExpiry || '-'],
           ['REO Expiry', singleEmployee.reoExpiry || '-'],
           ['Join Date', singleEmployee.joinDate || '-'],
           ['Salary Details', ''],
           ['Salary Type', singleEmployee.salaryType],
           ['Basic Salary', `$${singleEmployee.basicSalary.toFixed(2)}`],
           ['Course Qualifications', ''],
           ['Safety Course', getCourseExpiry(singleEmployee, ['Safety', 'CSOC', 'BCSS'])],
           ['Supervise Lifting', getCourseExpiry(singleEmployee, ['Supervise Lifting', 'Lifting Operation'])],
           ['Boom Lift', getCourseExpiry(singleEmployee, ['Boom Lift'])],
           ['Scissor Lift', getCourseExpiry(singleEmployee, ['Scissor Lift'])],
       ];

       autoTable(doc, {
           body: profileData,
           startY: 35,
           theme: 'grid',
           styles: { fontSize: 11, cellPadding: 5, lineColor: [203, 213, 225] },
           columnStyles: { 
               0: { fontStyle: 'bold', cellWidth: 70, fillColor: [241, 245, 249], textColor: [51, 65, 85] },
               1: { cellWidth: 'auto', textColor: [15, 23, 42], fontStyle: 'bold' }
           },
           didParseCell: (data: any) => {
               if (data.row.raw[1] === '') {
                    data.cell.colSpan = 2;
                    data.cell.styles.fillColor = [30, 41, 59]; 
                    data.cell.styles.textColor = [255, 255, 255];
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.halign = 'left';
                    data.cell.styles.fontSize = 12;
                    data.cell.styles.cellPadding = 3;
               }
           }
       });
       
       doc.save(`Profile_${singleEmployee.name.replace(/\s+/g, '_')}.pdf`);
  };

  const handleAddCourse = (presetName?: string) => {
      const newCourse: Course = {
          id: Date.now().toString(),
          name: presetName || '',
          expiryDate: '',
          status: 'Valid'
      };
      setFormData({
          ...formData,
          courses: [...(formData.courses || []), newCourse]
      });
  };

  const handleUpdateCourse = (id: string, field: keyof Course, value: string) => {
      const updatedCourses = (formData.courses || []).map(c => {
          if (c.id === id) return { ...c, [field]: value };
          return c;
      });
      setFormData({ ...formData, courses: updatedCourses });
  };

  const handleRemoveCourse = (id: string) => {
      const updatedCourses = (formData.courses || []).filter(c => c.id !== id);
      setFormData({ ...formData, courses: updatedCourses });
  };

  if (isLoading) {
      return <div className="flex justify-center items-center h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-10">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
            <button 
                onClick={() => navigate('/employees')}
                className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors shadow-sm"
            >
                <ArrowLeft size={20} />
            </button>
            <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    {isNew ? 'Register New Employee' : (
                        <>
                            <span>Edit: {formData.name}</span>
                            {formData.status === 'Cancelled' && (
                                <span className="text-sm font-bold bg-red-100 text-red-600 px-3 py-1 rounded-full border border-red-200 uppercase tracking-wider">
                                    Inactive
                                </span>
                            )}
                        </>
                    )}
                </h2>
                <p className="text-slate-500 text-sm">
                    {isNew ? 'Create a new worker profile' : 'Update details, documents, and courses'}
                </p>
            </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-2 flex flex-wrap gap-2">
            {[
                { id: 'personal', label: 'Personal', icon: User },
                { id: 'documents', label: 'Documents', icon: FileText },
                { id: 'courses', label: 'Courses', icon: BookOpen },
                { id: 'payroll', label: 'Payroll History', icon: History },
            ].map((tab) => (
                 <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 sm:flex-none px-4 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 whitespace-nowrap ${
                        activeTab === tab.id 
                        ? 'bg-blue-600 text-white shadow-md' 
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                 >
                    <tab.icon size={18} />
                    <span className="hidden sm:inline">{tab.label}</span>
                    <span className="sm:hidden">{tab.label.slice(0,3)}</span>
                 </button>
            ))}
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-8">
            <form id="employee-form" onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto">
                
                {/* TAB: PERSONAL DETAILS */}
                {activeTab === 'personal' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 animate-fade-in items-start">
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 mb-2">
                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Basic Info</h4>
                        </div>

                        <InputField 
                            label="Full Name" 
                            value={formData.name} 
                            onChange={(e: any) => setFormData({...formData, name: e.target.value})} 
                            placeholder="Full Name" 
                            required
                            className="lg:col-span-1"
                        />
                        <InputField 
                            label="Nationality" 
                            value={formData.nationality} 
                            onChange={(e: any) => setFormData({...formData, nationality: e.target.value})} 
                            placeholder="Nationality" 
                        />
                        <InputField 
                            label="Country of Birth" 
                            value={formData.countryOfBirth} 
                            onChange={(e: any) => setFormData({...formData, countryOfBirth: e.target.value})} 
                            placeholder="Country" 
                        />
                        <InputField 
                            label="Date of Birth" 
                            type="date"
                            value={formData.dob} 
                            onChange={(e: any) => setFormData({...formData, dob: e.target.value})} 
                        />
                        <InputField 
                            label="Gender" 
                            type="select"
                            value={formData.gender} 
                            onChange={(e: any) => setFormData({...formData, gender: e.target.value})} 
                            options={[
                                { value: 'Male', label: 'Male' },
                                { value: 'Female', label: 'Female' }
                            ]}
                        />
                        <InputField 
                            label="Mobile Number" 
                            value={formData.mobileNumber} 
                            onChange={(e: any) => setFormData({...formData, mobileNumber: e.target.value})} 
                            placeholder="8123 4567" 
                        />

                        <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4 mb-2">
                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Employment & Pass</h4>
                        </div>

                        <InputField 
                            label="Company Name" 
                            value={formData.companyName} 
                            onChange={(e: any) => setFormData({...formData, companyName: e.target.value})} 
                            placeholder="Company Name" 
                        />
                        <InputField 
                            label="Pass Type" 
                            type="select"
                            value={formData.passType} 
                            onChange={(e: any) => setFormData({...formData, passType: e.target.value})} 
                            options={[
                                { value: 'WP', label: 'Work Permit (WP)' },
                                { value: 'SP', label: 'S Pass (SP)' },
                                { value: 'SG', label: 'Singaporean (SG)' },
                                { value: 'SPR', label: 'Singapore PR (SPR)' }
                            ]}
                        />
                        <InputField 
                            label="Position / Designation" 
                            value={formData.position} 
                            onChange={(e: any) => setFormData({...formData, position: e.target.value})} 
                            placeholder="Position" 
                            required
                        />
                        <InputField 
                            label="Salary Type" 
                            type="select"
                            value={formData.salaryType} 
                            onChange={(e: any) => setFormData({...formData, salaryType: e.target.value})} 
                            options={[
                                { value: SalaryType.DAILY, label: 'Daily Rated' },
                                { value: SalaryType.MONTHLY, label: 'Monthly Rated' }
                            ]}
                        />
                        <InputField 
                            label="Basic Salary ($)" 
                            type="number"
                            value={formData.basicSalary} 
                            onChange={(e: any) => setFormData({...formData, basicSalary: parseFloat(e.target.value) || 0})} 
                            placeholder="0.00" 
                            required
                        />
                        <InputField 
                            label="Join Date" 
                            type="date"
                            value={formData.joinDate} 
                            onChange={(e: any) => setFormData({...formData, joinDate: e.target.value})} 
                            required
                        />
                    </div>
                )}

                {/* TAB: DOCUMENTS (ID Details) */}
                {activeTab === 'documents' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-6 animate-fade-in items-start">
                        <div className="col-span-1 md:col-span-2 lg:col-span-3 mb-2">
                            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100">Identification Details</h4>
                        </div>
                        
                        <InputField 
                            label="NRIC / FIN No" 
                            value={formData.fin} 
                            onChange={(e: any) => setFormData({...formData, fin: e.target.value})} 
                            placeholder="S1234567A" 
                            required
                        />
                        <InputField 
                            label="WP Number" 
                            value={formData.wpNumber} 
                            onChange={(e: any) => setFormData({...formData, wpNumber: e.target.value})} 
                            placeholder="WP No." 
                        />
                        <InputField 
                            label="Work Permit Expiry" 
                            type="date"
                            value={formData.workPermitExpiry} 
                            onChange={(e: any) => setFormData({...formData, workPermitExpiry: e.target.value})} 
                        />
                        <InputField 
                            label="Passport Number" 
                            value={formData.passportNo} 
                            onChange={(e: any) => setFormData({...formData, passportNo: e.target.value})} 
                            placeholder="Passport No." 
                        />
                        <InputField 
                            label="Passport Expiry" 
                            type="date"
                            value={formData.passportExpiry} 
                            onChange={(e: any) => setFormData({...formData, passportExpiry: e.target.value})} 
                        />
                        <InputField 
                            label="REO Expiry" 
                            type="date"
                            value={formData.reoExpiry} 
                            onChange={(e: any) => setFormData({...formData, reoExpiry: e.target.value})} 
                        />
                    </div>
                )}

                {/* TAB: COURSES */}
                {activeTab === 'courses' && (
                        <div className="space-y-6 animate-fade-in">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
                                <div>
                                <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Safety & Skill Courses</h4>
                                <p className="text-xs text-slate-500">Track worker certifications and expiry dates</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => handleAddCourse('CSOC')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded-lg text-slate-600 transition shadow-sm">+ CSOC</button>
                                <button type="button" onClick={() => handleAddCourse('BCSS')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded-lg text-slate-600 transition shadow-sm">+ BCSS</button>
                                <button type="button" onClick={() => handleAddCourse('Supervise Lifting')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-xs font-bold rounded-lg text-slate-600 transition shadow-sm">+ Lifting</button>
                                <button type="button" onClick={() => handleAddCourse()} className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-xs font-bold rounded-lg text-blue-600 transition shadow-sm">+ Custom</button>
                                </div>
                            </div>
                            
                            {(formData.courses?.length === 0) && (
                                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl bg-slate-50/50">
                                    <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    <p>No courses added yet.</p>
                                    <p className="text-xs">Use the buttons above to add courses.</p>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                            {formData.courses?.map((course, idx) => (
                                <div key={course.id} className="grid grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-xl border border-slate-100 hover:border-blue-100 transition-colors">
                                    <div className="col-span-12 sm:col-span-6 md:col-span-7">
                                        <InputField 
                                            label="Course Name"
                                            value={course.name}
                                            onChange={(e: any) => handleUpdateCourse(course.id, 'name', e.target.value)}
                                            placeholder="Course Name"
                                        />
                                    </div>
                                    <div className="col-span-10 sm:col-span-5 md:col-span-4">
                                        <InputField 
                                            label="Expiry Date"
                                            type="date"
                                            value={course.expiryDate}
                                            onChange={(e: any) => handleUpdateCourse(course.id, 'expiryDate', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2 sm:col-span-1 md:col-span-1 flex justify-end pb-1">
                                        <button 
                                            type="button" 
                                            onClick={() => handleRemoveCourse(course.id)}
                                            className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Remove"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            </div>
                        </div>
                )}

                {/* TAB: PAYROLL HISTORY */}
                {activeTab === 'payroll' && (
                        <div className="space-y-4 animate-fade-in">
                            {!isNew ? (
                                <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                                            <tr>
                                                <th className="px-4 py-3 whitespace-nowrap">Month</th>
                                                <th className="px-4 py-3 text-center whitespace-nowrap">Days</th>
                                                <th className="px-4 py-3 text-center whitespace-nowrap">OT Hours</th>
                                                <th className="px-4 py-3 text-right whitespace-nowrap">Net Pay</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 bg-white">
                                            {historyPayrollData.length === 0 ? (
                                                <tr><td colSpan={4} className="p-8 text-center text-slate-400">Payroll history not loaded.</td></tr>
                                            ) : (
                                                historyPayrollData.map((rec, i) => (
                                                <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 font-bold text-slate-700">{rec.month}</td>
                                                    <td className="px-4 py-3 text-center font-medium">{rec.totalDaysWorked}</td>
                                                    <td className="px-4 py-3 text-center font-medium">{rec.totalOtHours}</td>
                                                    <td className="px-4 py-3 text-right font-bold text-slate-900">${rec.netSalary.toFixed(2)}</td>
                                                </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
                                    <History className="w-10 h-10 mx-auto mb-2 opacity-20" />
                                    <p>Save the employee first to view payroll history.</p>
                                </div>
                            )}
                        </div>
                )}
            </form>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 sticky bottom-4 z-20">
             <div className="flex gap-2 w-full sm:w-auto">
                 {!isNew && (
                     <>
                        <button 
                            type="button"
                            onClick={handleCancelWorker}
                            disabled={isSaving}
                            className="flex-1 sm:flex-none px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap"
                        >
                            <Trash2 size={16} /> Cancel
                        </button>
                        <button 
                             type="button"
                             onClick={handlePrintProfile}
                             disabled={isSaving}
                             className="flex-1 sm:flex-none px-4 py-2.5 text-slate-600 hover:bg-slate-50 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 border border-slate-200 disabled:opacity-50 whitespace-nowrap"
                        >
                            <FileText size={16} /> Print
                        </button>
                     </>
                 )}
             </div>
             
             <div className="flex gap-3 w-full sm:w-auto">
                 <button 
                    type="button"
                    onClick={() => navigate('/employees')}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition"
                    disabled={isSaving}
                 >
                     Cancel
                 </button>
                 <button 
                    type="submit"
                    form="employee-form"
                    disabled={isSaving}
                    className="flex-1 sm:flex-none px-8 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                 >
                     {isSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckSquare size={16} />}
                     {isNew ? 'Register' : 'Save'}
                 </button>
             </div>
        </div>
    </div>
  );
};

export default EmployeeDetail;
