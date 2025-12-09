
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AttendanceRecord, AppSettings, Employee, SalaryType, AttendanceStatus } from '../types';
import { calculateOtHours, calculateDailyTotal } from '../utils/calculations';
import { 
  format, addMonths, endOfMonth, 
  eachDayOfInterval, endOfWeek, isSameMonth, 
  isSunday, isToday 
} from 'date-fns';
import subMonths from 'date-fns/subMonths';
import startOfMonth from 'date-fns/startOfMonth';
import startOfWeek from 'date-fns/startOfWeek';
import parseISO from 'date-fns/parseISO';
import { Calendar, ChevronLeft, ChevronRight, List, Grid, Save, CheckCircle } from 'lucide-react';

interface Props {
    employeeId: string;
    compact?: boolean; 
    editable?: boolean; 
}

const TimePicker = ({ value, onChange, className }: { value: string, onChange: (val: string) => void, className?: string }) => {
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
        if (parseInt(val) > 12) val = val.slice(-1); 
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
        <div className={`flex items-center gap-1 bg-white border border-slate-200 rounded p-1 shadow-sm w-full ${className}`}>
            <input 
                type="text" 
                className="w-5 text-center text-xs font-bold outline-none bg-transparent p-0 placeholder:text-slate-300" 
                placeholder="HH"
                value={localState.h}
                onChange={e => updateH(e.target.value)}
                onBlur={() => { if(localState.h.length === 1 && parseInt(localState.h) > 0) updateH(localState.h.padStart(2, '0')); }}
            />
            <span className="text-slate-400 font-bold text-[10px]">:</span>
            <input 
                type="text" 
                className="w-5 text-center text-xs font-bold outline-none bg-transparent p-0 placeholder:text-slate-300" 
                placeholder="MM"
                value={localState.m}
                onChange={e => updateM(e.target.value)}
                onBlur={() => { if(localState.m.length === 1) updateM(localState.m.padStart(2, '0')); }}
            />
            <button
                type="button"
                onClick={() => updateP(localState.p === 'AM' ? 'PM' : 'AM')}
                className={`text-[9px] font-bold px-1 py-0.5 rounded ml-auto cursor-pointer select-none transition-colors border border-transparent hover:border-slate-200 ${localState.p === 'AM' ? 'text-orange-600 bg-orange-50 hover:bg-orange-100' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
            >
                {localState.p}
            </button>
        </div>
    );
};

export const AttendanceCalendar = ({ employeeId, compact = false, editable = false }: Props) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [settings, setSettings] = useState<AppSettings>({});
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [saveStatus, setSaveStatus] = useState<string>('');

  useEffect(() => {
    // Load Employee
    api.employees.getById(employeeId).then(res => {
        if(res.success) setEmployee(res.data);
    });
    
    // Load Settings
    api.settings.get().then(res => {
        if(res.success) setSettings(res.data);
    });

    loadData();
  }, [employeeId, currentMonth]);

  const loadData = () => {
    api.attendance.getByEmployee(employeeId).then(res => {
        if(res.success) setAttendance(res.data);
    });
  };

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  // --- Date Calculation ---
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const gridDays = eachDayOfInterval({ start: startDate, end: endDate });
  const listDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // --- Manual Edit Logic ---
  const handleUpdateRecord = async (dateStr: string, field: keyof AttendanceRecord, value: any) => {
      if (!employee) return;

      const existing = attendance.find(r => r.date === dateStr);
      let record = existing || {
          id: `${dateStr}-${employee.id}`,
          employeeId: employee.id,
          date: dateStr,
          status: AttendanceStatus.ABSENT,
          startTime: '',
          endTime: '',
          otHours: 0,
          lunchHours: 0,
          workDay: 0,
          siteLocation: '',
          remarks: '',
          calculatedDailyPay: 0
      };

      record = { ...record, [field]: value };

      let newWorkDay = record.workDay;
      let newStatus = record.status;

      if (field === 'startTime' || field === 'endTime') {
          if (record.remarks !== 'MC' && record.remarks !== 'OFF') {
              if (record.startTime && record.endTime && record.startTime !== record.endTime) {
                  newWorkDay = 1.0;
                  newStatus = AttendanceStatus.PRESENT;
              } else {
                  newWorkDay = 0;
                  newStatus = AttendanceStatus.ABSENT;
              }
          }
          if (field === 'endTime' && value) {
              record.otHours = calculateOtHours(employee.salaryType, value);
          }
      }
      
      if (field === 'remarks') {
          if (value === 'MC') { newWorkDay = 1.0; newStatus = AttendanceStatus.MC; }
          else if (value === 'OFF') { newWorkDay = 0.0; newStatus = AttendanceStatus.LEAVE; }
          else {
              if (record.startTime && record.endTime) { newWorkDay = 1.0; newStatus = AttendanceStatus.PRESENT; }
              else { newWorkDay = 0.0; newStatus = AttendanceStatus.ABSENT; }
          }
          record.workDay = newWorkDay;
          record.status = newStatus;
      }

      record.calculatedDailyPay = calculateDailyTotal(employee, record.otHours, record.workDay, parseISO(dateStr), settings);

      await api.attendance.save(record);
      
      setAttendance(prev => {
          const idx = prev.findIndex(r => r.date === dateStr);
          if (idx >= 0) {
              const newArr = [...prev];
              newArr[idx] = record;
              return newArr;
          }
          return [...prev, record];
      });
      
      setSaveStatus('Saved');
      setTimeout(() => setSaveStatus(''), 1000);
  };

  const currentMonthRecords = attendance.filter(r => isSameMonth(parseISO(r.date), currentMonth));
  const stats = {
      present: currentMonthRecords.filter(r => r.workDay > 0 && r.remarks !== 'MC').length,
      absent: currentMonthRecords.filter(r => r.workDay === 0 && r.remarks !== 'MC' && r.remarks !== 'OFF').length,
      mc: currentMonthRecords.filter(r => r.remarks === 'MC').length,
  };

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const record = attendance.find(r => r.date === dateStr);
    const holiday = (settings.publicHolidays || []).find(h => h.date === dateStr);

    if (record?.remarks === 'MC') return { type: 'MC', label: 'MC', color: 'bg-amber-100 text-amber-800 border-amber-200' };
    if (record?.remarks === 'OFF') return { type: 'LEAVE', label: 'OFF', color: 'bg-slate-200 text-slate-600 border-slate-300' };
    
    if (record) {
      if (record.workDay > 0) return { type: 'PRESENT', label: 'Present', color: 'bg-green-100 text-green-800 border-green-200', holidayName: holiday?.name };
      if (record.workDay === 0) return { type: 'ABSENT', label: 'Absent', color: 'bg-red-100 text-red-800 border-red-200', holidayName: holiday?.name };
    }

    if (holiday) return { type: 'HOLIDAY', label: holiday.name, color: 'bg-purple-50 text-purple-600 border-purple-200 font-bold', holidayName: holiday.name };
    if (isSunday(date)) return { type: 'SUNDAY', label: 'Sun', color: 'bg-slate-50 text-slate-400 border-slate-100' };
    return { type: 'NONE', label: '', color: 'bg-white text-slate-300' };
  };

  const StatBadge = ({ label, value, color }: { label: string, value: number, color: string }) => (
      <div className={`flex flex-col items-center justify-center p-2 rounded-lg bg-slate-50 border border-slate-100 min-w-[70px]`}>
          <span className={`text-xl font-bold ${color}`}>{value}</span>
          <span className="text-[10px] uppercase font-bold text-slate-400">{label}</span>
      </div>
  );

  const inputClass = "w-full text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none";

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl">
        {!compact && (
            <div className="bg-white px-2 py-4 flex flex-wrap gap-3 border-b border-slate-100 justify-between items-center">
                <div className="flex items-center gap-2">
                    <button onClick={handlePrevMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronLeft size={20} /></button>
                    <h4 className="text-lg font-bold text-slate-800 w-32 text-center">{format(currentMonth, 'MMM yyyy')}</h4>
                    <button onClick={handleNextMonth} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"><ChevronRight size={20} /></button>
                </div>
                
                <div className="flex gap-2">
                    <StatBadge label="Present" value={stats.present} color="text-green-600" />
                    <StatBadge label="Absent" value={stats.absent} color="text-red-600" />
                    <StatBadge label="MC" value={stats.mc} color="text-amber-600" />
                </div>
            </div>
        )}

        {editable && (
            <div className="flex items-center justify-between p-2 bg-slate-50 border-b border-slate-100">
                <div className="flex gap-1 bg-white rounded-lg p-1 border border-slate-200">
                    <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Calendar View"><Grid size={16} /></button>
                    <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-slate-400 hover:text-slate-600'}`} title="Manual Entry List"><List size={16} /></button>
                </div>
                {saveStatus && (<span className="text-xs font-bold text-green-600 flex items-center gap-1 animate-fade-in"><CheckCircle size={12} /> {saveStatus}</span>)}
            </div>
        )}

        {viewMode === 'grid' && (
            <div className="flex-1 overflow-y-auto bg-slate-50/50 rounded-xl p-4">
            <div className="grid grid-cols-7 gap-3 mb-3">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (<div key={day} className="text-center text-xs font-bold text-slate-400 uppercase tracking-wider">{day}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-3">
                {gridDays.map((day) => {
                const status = getDayStatus(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isTodayDate = isToday(day);

                return (
                    <div key={day.toISOString()} title={status.holidayName || status.label} className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm font-bold border transition-all cursor-default relative group shadow-sm ${status.color} ${!isCurrentMonth ? 'opacity-30 grayscale' : ''} ${isTodayDate ? 'ring-2 ring-blue-500 ring-offset-2 z-10' : ''}`}>
                    <span className={`${isTodayDate ? 'text-blue-600' : ''}`}>{format(day, 'd')}</span>
                    {status.holidayName && (<span className="absolute top-1 right-1 bg-purple-600 text-white text-[8px] w-3.5 h-3.5 flex items-center justify-center rounded-full shadow-sm">H</span>)}
                    </div>
                );
                })}
            </div>
            </div>
        )}

        {viewMode === 'list' && (
            <div className="flex-1 overflow-y-auto bg-white">
                <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200 sticky top-0 z-10">
                        <tr><th className="px-3 py-2 w-16">Date</th><th className="px-1 py-2 text-center w-28">In</th><th className="px-1 py-2 text-center w-28">Out</th><th className="px-2 py-2 w-14 text-center">OT</th><th className="px-2 py-2 w-12 text-center">Lun</th><th className="px-3 py-2">Site / Remarks</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {listDays.map(day => {
                            const dateStr = format(day, 'yyyy-MM-dd');
                            const record: Partial<AttendanceRecord> = attendance.find(r => r.date === dateStr) || {};
                            const isSun = isSunday(day);
                            const holiday = (settings.publicHolidays || []).find(h => h.date === dateStr);
                            
                            return (
                                <tr key={dateStr} className={`hover:bg-slate-50 ${isSun || holiday ? 'bg-slate-50/50' : ''}`}>
                                    <td className="px-3 py-2"><div className="font-bold text-slate-700">{format(day, 'dd MMM')}</div><div className="text-[10px] text-slate-400 uppercase font-bold">{format(day, 'EEE')}</div>{holiday && <div className="text-[9px] text-purple-600 font-bold truncate max-w-[60px]">{holiday.name}</div>}</td>
                                    <td className="px-1 py-2 text-center">
                                        <TimePicker value={record.startTime || ''} onChange={val => handleUpdateRecord(dateStr, 'startTime', val)} />
                                    </td>
                                    <td className="px-1 py-2 text-center">
                                        <TimePicker value={record.endTime || ''} onChange={val => handleUpdateRecord(dateStr, 'endTime', val)} />
                                    </td>
                                    <td className="px-1 py-2"><input type="number" step="0.5" className={inputClass} value={record.otHours || ''} onChange={e => handleUpdateRecord(dateStr, 'otHours', e.target.value)} /></td>
                                    <td className="px-1 py-2"><select className={inputClass} value={record.lunchHours || 0} onChange={e => handleUpdateRecord(dateStr, 'lunchHours', e.target.value)}><option value="0">0</option><option value="1">1</option></select></td>
                                    <td className="px-1 py-2 flex gap-1"><input type="text" placeholder="Site Name" className={`${inputClass} text-left`} value={record.siteLocation || ''} onChange={e => handleUpdateRecord(dateStr, 'siteLocation', e.target.value)} /><select className="w-16 text-center bg-white border border-slate-200 rounded px-1 py-1 text-xs font-bold text-slate-600 outline-none" value={record.remarks || ''} onChange={e => handleUpdateRecord(dateStr, 'remarks', e.target.value)}><option value="">-</option><option value="MC">MC</option><option value="OFF">OFF</option></select></td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        )}
    </div>
  );
};
