
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Employee, AttendanceRecord, AttendanceStatus, AppSettings } from '../types';
import { calculateDailyTotal, calculateOtHours } from '../utils/calculations';
import { format, addDays, isSunday, subDays, parseISO } from 'date-fns';
import { Calendar, CheckCircle, ChevronLeft, ChevronRight, ChevronDown, Loader2, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Custom TimePicker Component ---
const TimePicker = ({ value, onChange, className, label }: { value: string, onChange: (val: string) => void, className?: string, label?: string }) => {
    // 24h HH:mm -> 12h hh:mm a
    const to12h = (time24: string) => {
        if (!time24) return { h: '', m: '', p: 'AM' };
        const [h, m] = time24.split(':').map(Number);
        if (isNaN(h) || isNaN(m)) return { h: '', m: '', p: 'AM' };
        const p = h >= 12 ? 'PM' : 'AM';
        let h12 = h % 12;
        if (h12 === 0) h12 = 12;
        return { h: h12.toString(), m: m.toString().padStart(2, '0'), p };
    };

    const [localState, setLocalState] = useState(to12h(value));

    useEffect(() => {
        setLocalState(to12h(value));
    }, [value]);

    const emit = (h: string, m: string, p: string) => {
        const hInt = parseInt(h);
        const mInt = parseInt(m);
        if (!h || !m || isNaN(hInt) || isNaN(mInt)) return;

        let h24 = hInt;
        if (p === 'PM' && hInt !== 12) h24 += 12;
        if (p === 'AM' && hInt === 12) h24 = 0;
        
        onChange(`${h24.toString().padStart(2, '0')}:${mInt.toString().padStart(2, '0')}`);
    };

    const updateH = (val: string) => {
        val = val.replace(/\D/g, '').slice(0, 2);
        if (parseInt(val) > 12) val = val.slice(-1); // Simple clamp
        const newState = { ...localState, h: val };
        setLocalState(newState);
        if (val && localState.m) emit(val, localState.m, localState.p);
    };

    const updateM = (val: string) => {
        val = val.replace(/\D/g, '').slice(0, 2);
        const newState = { ...localState, m: val };
        setLocalState(newState);
        if (localState.h && val) emit(localState.h, val, localState.p);
    };

    const updateP = (val: string) => {
        const newState = { ...localState, p: val };
        setLocalState(newState);
        if (localState.h && localState.m) emit(localState.h, localState.m, val);
    };

    return (
        <div className={`flex flex-col ${className}`}>
            {label && <span className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</span>}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1.5 shadow-sm w-full">
                <input 
                    type="text" 
                    className="w-7 text-center text-sm font-bold outline-none bg-transparent p-0 placeholder:text-slate-300" 
                    placeholder="HH"
                    value={localState.h}
                    onChange={e => updateH(e.target.value)}
                    onBlur={() => {
                    if(localState.h.length === 1 && parseInt(localState.h) > 0) updateH(localState.h.padStart(2, '0'));
                    }}
                />
                <span className="text-slate-400 font-bold text-xs">:</span>
                <input 
                    type="text" 
                    className="w-7 text-center text-sm font-bold outline-none bg-transparent p-0 placeholder:text-slate-300" 
                    placeholder="MM"
                    value={localState.m}
                    onChange={e => updateM(e.target.value)}
                    onBlur={() => {
                    if(localState.m.length === 1) updateM(localState.m.padStart(2, '0'));
                    }}
                />
                <button
                    type="button"
                    onClick={() => updateP(localState.p === 'AM' ? 'PM' : 'AM')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded ml-auto cursor-pointer select-none transition-colors border border-transparent hover:border-slate-200 ${localState.p === 'AM' ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                >
                    {localState.p}
                </button>
            </div>
        </div>
    );
};

const Attendance = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [settings, setSettings] = useState<AppSettings>({});
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    fetchDailyData();
  }, [selectedDate]);

  const fetchDailyData = async () => {
      setIsLoading(true);
      try {
          const settingsRes = await api.settings.get();
          if (settingsRes.success) setSettings(settingsRes.data);

          const dailyRes = await api.attendance.getDaily(selectedDate);
          if (dailyRes.success) {
              setEmployees(dailyRes.data.employees);
              setAttendance(dailyRes.data.records);
          }
      } catch (e) {
          console.error(e);
      } finally {
          setIsLoading(false);
      }
  };

  const handlePrevDay = () => setSelectedDate(format(subDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));
  const handleNextDay = () => setSelectedDate(format(addDays(parseISO(selectedDate), 1), 'yyyy-MM-dd'));

  const updateRecord = async (employeeId: string, field: keyof AttendanceRecord, value: any) => {
    // Optimistic UI Update
    setAttendance(prev => {
        const newRecords = prev.map(record => {
            if (record.employeeId !== employeeId) return record;

            let updatedRecord = { ...record, [field]: value };
            const employee = employees.find(e => e.id === employeeId);
            if (!employee) return updatedRecord;

            let newWorkDay = record.workDay;
            let newStatus = record.status;

            // Logic for auto-calculating status/workday/pay
            if (field === 'startTime' || field === 'endTime') {
                const sTime = field === 'startTime' ? value : record.startTime;
                const eTime = field === 'endTime' ? value : record.endTime;
                
                if (updatedRecord.remarks !== 'MC' && updatedRecord.remarks !== 'OFF') {
                   if (sTime && eTime && sTime !== eTime) {
                      newWorkDay = 1.0;
                      newStatus = AttendanceStatus.PRESENT;
                   } else {
                      newWorkDay = 0;
                      newStatus = AttendanceStatus.ABSENT;
                   }
                }
                let newOtHours = record.otHours;
                if (eTime) {
                    newOtHours = calculateOtHours(employee.salaryType, eTime);
                }
                updatedRecord = { ...updatedRecord, workDay: newWorkDay, otHours: newOtHours, status: newStatus };
            }
            
            if (field === 'remarks') {
                if (value === 'MC') { newWorkDay = 1.0; newStatus = AttendanceStatus.MC; } 
                else if (value === 'OFF') { newWorkDay = 0.0; newStatus = AttendanceStatus.LEAVE; } 
                else {
                    if (record.startTime && record.endTime && record.startTime !== record.endTime) {
                        newWorkDay = 1.0; newStatus = AttendanceStatus.PRESENT;
                    } else {
                        newWorkDay = 0.0; newStatus = AttendanceStatus.ABSENT;
                    }
                }
                updatedRecord = { ...updatedRecord, workDay: newWorkDay, status: newStatus };
            }
            
            if (field === 'otHours') updatedRecord = { ...updatedRecord, [field]: parseFloat(value) || 0 };
            if (field === 'lunchHours') updatedRecord = { ...updatedRecord, [field]: isNaN(parseInt(value)) ? 0 : parseInt(value) };

            const newPay = calculateDailyTotal(employee, updatedRecord.otHours, updatedRecord.workDay, parseISO(selectedDate), settings);
            updatedRecord = { ...updatedRecord, calculatedDailyPay: newPay };

            // Fire and forget save
            api.attendance.save(updatedRecord);
            return updatedRecord;
        });
        return newRecords;
    });
    setLastSaved(new Date());
  };

  const inputClass = "px-3 py-2 w-full text-center rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-slate-800 transition-all shadow-sm";
  const currentHoliday = (settings.publicHolidays || []).find(h => h.date === selectedDate);
  const isHolidayDate = !!currentHoliday;
  const isSundayDate = isSunday(parseISO(selectedDate));
  
  return (
    <div className="space-y-6 animate-fade-in pb-20 md:pb-10">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Attendance</h2>
          <p className="text-slate-500 mt-1">Editing: <span className="font-bold text-blue-600">{format(parseISO(selectedDate), 'EEEE, dd MMM yyyy')}</span></p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <div className="flex items-center bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full sm:w-auto">
                <button onClick={handlePrevDay} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronLeft size={20} /></button>
                <div className="px-2 border-x border-slate-100 flex items-center relative flex-1 sm:flex-none justify-center">
                    <Calendar size={16} className="text-blue-500 absolute left-3 pointer-events-none" />
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-9 pr-2 py-1 outline-none bg-white text-black font-bold text-sm cursor-pointer w-full sm:w-[140px]" />
                </div>
                <button onClick={handleNextDay} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"><ChevronRight size={20} /></button>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-green-50 text-green-700 border border-green-200 text-xs font-bold shadow-sm whitespace-nowrap w-full sm:w-auto justify-center">
                <CheckCircle size={14} /> {lastSaved ? `Auto-Saved ${format(lastSaved, 'HH:mm:ss')}` : 'Ready'}
            </div>
        </div>
      </div>
      
      {(isHolidayDate || isSundayDate) && (
          <div className="bg-purple-100 border border-purple-200 rounded-xl p-4 flex items-center gap-3 text-purple-900 shadow-sm animate-fade-in">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-purple-600 shadow-sm font-bold text-xl flex-none">!</div>
              <div>
                  <h4 className="font-bold text-sm uppercase tracking-wide">{isHolidayDate ? `Public Holiday: ${currentHoliday?.name}` : 'Sunday Work Rate'}</h4>
                  <p className="text-xs text-purple-700">Work done on this date is calculated at <b>{settings.holidayPayMultiplier || 1.5}x</b> pay rate automatically.</p>
              </div>
          </div>
      )}

      {/* DESKTOP TABLE VIEW */}
      <div className="hidden xl:block bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[1200px]">
            <thead className="bg-slate-50/50 text-slate-500 uppercase text-xs font-bold tracking-wider">
              <tr>
                <th className="px-6 py-5 min-w-[200px]">Employee Name</th>
                <th className="px-4 py-5 text-center w-48 min-w-[150px]">In Time</th>
                <th className="px-4 py-5 text-center w-48 min-w-[150px]">Out Time</th>
                <th className="px-2 py-5 text-center w-20 min-w-[80px]">OT (Hrs)</th>
                <th className="px-2 py-5 text-center w-20 min-w-[80px]">Lunch (Hrs)</th>
                <th className="px-4 py-5 min-w-[160px]">Site Location</th>
                <th className="px-4 py-5 min-w-[140px]">Remarks (MC/OFF)</th>
                <th className="px-6 py-5 text-right min-w-[100px]">Est. Pay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                  <tr><td colSpan={8} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></td></tr>
              ) : employees.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-slate-400">No active employees found.</td></tr>
              ) : (
                attendance.map((record) => {
                    const emp = employees.find(e => e.id === record.employeeId);
                    if (!emp) return null;
                    return (
                    <tr key={record.id} className="hover:bg-blue-50/30 transition-colors group">
                        <td className="px-6 py-4">
                            <button onClick={() => navigate(`/attendance/${emp.id}`)} className="text-left group/btn">
                                <div className="font-bold text-slate-800 text-sm group-hover/btn:text-blue-600 group-hover/btn:underline transition-all">{emp.name}</div>
                                <div className="text-[10px] uppercase font-bold text-slate-400 mt-1 flex items-center gap-1">{emp.position} <span className="opacity-0 group-hover/btn:opacity-100 transition-opacity">📅 View Calendar</span></div>
                            </button>
                        </td>
                        <td className="px-4 py-4 text-center">
                            <TimePicker 
                                value={record.startTime || ''} 
                                onChange={(val) => updateRecord(emp.id, 'startTime', val)} 
                            />
                        </td>
                        <td className="px-4 py-4 text-center">
                            <TimePicker 
                                value={record.endTime || ''} 
                                onChange={(val) => updateRecord(emp.id, 'endTime', val)} 
                            />
                        </td>
                        <td className="px-2 py-4 text-center"><input type="number" step="0.5" min="0" className={inputClass} value={record.otHours} onChange={(e) => updateRecord(emp.id, 'otHours', e.target.value)} /></td>
                        <td className="px-2 py-4 text-center">
                            <select className={`${inputClass} appearance-none cursor-pointer`} value={record.lunchHours !== undefined ? record.lunchHours : 0} onChange={(e) => updateRecord(emp.id, 'lunchHours', e.target.value)}>
                                <option value="0">0</option><option value="1">1</option>
                            </select>
                        </td>
                        <td className="px-4 py-4"><input type="text" className={`${inputClass} text-left w-full`} placeholder="Site Name..." value={record.siteLocation || ''} onChange={(e) => updateRecord(emp.id, 'siteLocation', e.target.value)} /></td>
                        <td className="px-4 py-4 relative">
                            <div className="relative">
                                <select className={`w-full appearance-none cursor-pointer pl-4 pr-10 py-2.5 rounded-xl border font-bold text-sm outline-none transition-all shadow-sm focus:ring-2 focus:ring-blue-500 ${record.remarks === 'MC' ? 'bg-amber-50 text-amber-700 border-amber-200' : record.remarks === 'OFF' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white text-slate-800 border-slate-200 hover:border-blue-300'}`} value={record.remarks || ''} onChange={(e) => updateRecord(emp.id, 'remarks', e.target.value)}>
                                    <option value="" className="bg-white text-slate-800">Working</option><option value="MC" className="bg-white text-amber-600">MC (Paid)</option><option value="OFF" className="bg-white text-slate-600">OFF (Unpaid)</option><option value="Other" className="bg-white text-blue-600">Other</option>
                                </select>
                                <ChevronDown size={16} className={`absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none ${record.remarks === 'MC' ? 'text-amber-400' : 'text-slate-400'}`} />
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right"><div className="font-bold text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg inline-block min-w-[80px]">${record.calculatedDailyPay.toFixed(2)}</div></td>
                    </tr>
                    );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE CARD VIEW */}
      <div className="xl:hidden flex flex-col gap-4">
        {isLoading ? (
            <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500"/></div>
        ) : employees.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-white rounded-xl">No active employees found.</div>
        ) : (
            attendance.map((record) => {
                const emp = employees.find(e => e.id === record.employeeId);
                if (!emp) return null;
                return (
                    <div key={record.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4 relative">
                        {/* Header: Name and Pay */}
                        <div className="flex justify-between items-start">
                            <div>
                                <button onClick={() => navigate(`/attendance/${emp.id}`)} className="font-bold text-slate-900 text-base hover:text-blue-600 underline-offset-2 hover:underline">{emp.name}</button>
                                <div className="text-xs text-slate-500 mt-0.5">{emp.position}</div>
                            </div>
                            <div className="text-right">
                                <div className="font-bold text-slate-900 bg-slate-100 px-2 py-1 rounded text-sm">${record.calculatedDailyPay.toFixed(2)}</div>
                            </div>
                        </div>

                        {/* Row 1: Time Pickers */}
                        <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                             <TimePicker 
                                label="In Time"
                                value={record.startTime || ''} 
                                onChange={(val) => updateRecord(emp.id, 'startTime', val)} 
                            />
                             <TimePicker 
                                label="Out Time"
                                value={record.endTime || ''} 
                                onChange={(val) => updateRecord(emp.id, 'endTime', val)} 
                            />
                        </div>

                        {/* Row 2: OT / Lunch / Site */}
                        <div className="grid grid-cols-3 gap-3">
                             <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">OT (Hrs)</label>
                                 <input type="number" step="0.5" min="0" className={inputClass} value={record.otHours} onChange={(e) => updateRecord(emp.id, 'otHours', e.target.value)} />
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Lunch</label>
                                 <select className={`${inputClass} appearance-none`} value={record.lunchHours !== undefined ? record.lunchHours : 0} onChange={(e) => updateRecord(emp.id, 'lunchHours', e.target.value)}>
                                    <option value="0">0h</option><option value="1">1h</option>
                                </select>
                             </div>
                             <div>
                                 <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Status</label>
                                 <select className={`w-full appearance-none cursor-pointer px-2 py-2 rounded-xl border font-bold text-xs outline-none transition-all shadow-sm ${record.remarks === 'MC' ? 'bg-amber-50 text-amber-700 border-amber-200' : record.remarks === 'OFF' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-white text-slate-800 border-slate-200'}`} value={record.remarks || ''} onChange={(e) => updateRecord(emp.id, 'remarks', e.target.value)}>
                                    <option value="" className="text-slate-800">Working</option><option value="MC" className="text-amber-600">MC</option><option value="OFF" className="text-slate-600">OFF</option><option value="Other" className="text-blue-600">Other</option>
                                </select>
                             </div>
                        </div>

                        {/* Row 3: Site Location */}
                        <div>
                             <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block flex items-center gap-1"><MapPin size={10} /> Site Location</label>
                             <input type="text" className={`${inputClass} text-left w-full`} placeholder="Site Name..." value={record.siteLocation || ''} onChange={(e) => updateRecord(emp.id, 'siteLocation', e.target.value)} />
                        </div>
                    </div>
                )
            })
        )}
      </div>
    </div>
  );
};

export default Attendance;
