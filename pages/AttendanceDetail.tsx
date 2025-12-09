
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { Employee } from '../types';
import { AttendanceCalendar } from '../components/AttendanceCalendar';
import { ArrowLeft, Calendar, User, Clock } from 'lucide-react';

const AttendanceDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState<Employee | null>(null);

  useEffect(() => {
    if (id) {
      const emps = StorageService.getEmployees();
      const found = emps.find(e => e.id === id);
      if (found) {
        setEmployee(found);
      } else {
        navigate('/attendance');
      }
    }
  }, [id, navigate]);

  if (!employee) return null;

  return (
    <div className="space-y-6 animate-fade-in pb-10 h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-slate-200 pb-4 flex-none">
        <button 
            onClick={() => navigate('/attendance')}
            className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors shadow-sm"
        >
            <ArrowLeft size={20} />
        </button>
        <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Attendance Record
            </h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1 font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                    <User size={14} /> {employee.name}
                </span>
                <span className="flex items-center gap-1">
                     <span className="text-slate-300">|</span> {employee.position}
                </span>
            </div>
        </div>
      </div>

      {/* Calendar Component Wrapper */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 md:p-6 flex-1 min-h-0 flex flex-col">
          <div className="flex items-center gap-2 mb-4 text-slate-400 text-xs font-bold uppercase tracking-wider">
              <Calendar size={14} /> Monthly Overview & Editing
          </div>
          <div className="flex-1 min-h-0 relative">
             <div className="absolute inset-0">
                <AttendanceCalendar employeeId={employee.id} editable={true} />
             </div>
          </div>
      </div>
    </div>
  );
};

export default AttendanceDetail;
