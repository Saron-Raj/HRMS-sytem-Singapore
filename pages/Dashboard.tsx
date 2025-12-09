
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DashboardStats, AlertItem } from '../types';
import { Clock, Wallet, ArrowRight, Calendar, PlusCircle, AlertTriangle, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts';
import { useNavigate } from 'react-router-dom';

const AttendanceWidget = ({ label, count, color, bg }: { label: string, count: number, color: string, bg: string }) => (
  <div className={`${bg} rounded-2xl p-4 flex flex-col justify-between h-32 transition-transform hover:scale-105 duration-200 cursor-default`}>
    <div className={`text-sm font-semibold ${color} uppercase tracking-wider`}>{label}</div>
    <div className={`text-4xl font-bold ${color}`}>{count < 10 ? `0${count}` : count}</div>
  </div>
);

const QuickAction = ({ icon: Icon, label, onClick, color }: any) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-3 p-3 w-full rounded-xl hover:bg-slate-50 transition-colors group border border-transparent hover:border-slate-100"
  >
    <div className={`w-10 h-10 rounded-full ${color} text-white flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform`}>
      <Icon size={20} />
    </div>
    <span className="font-medium text-slate-700">{label}</span>
    <ArrowRight size={16} className="ml-auto text-slate-300 group-hover:text-slate-500" />
  </button>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const loadDashboardData = async () => {
        try {
            const response = await api.dashboard.getStats();
            if(response.success) {
                setStats(response.data);
            }
        } catch (error) {
            console.error("Failed to load stats", error);
        } finally {
            setLoading(false);
        }
    };

    loadDashboardData();
  }, []);

  const handleAlertClick = (empId: string) => {
      navigate('/employees', { state: { openId: empId } });
  };

  if (loading) {
      return (
          <div className="flex h-[80vh] items-center justify-center">
              <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          </div>
      );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-fade-in pb-20 md:pb-10">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">My Dashboard</h1>
          <p className="text-slate-500 mt-1 flex items-center gap-2">
             <Calendar size={14} /> {format(new Date(), 'EEEE, dd MMMM yyyy')}
          </p>
        </div>
        <div className="bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100 flex items-center gap-2 text-sm font-medium text-slate-600">
           <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
           System Active
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Attendance Summary Widgets */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Attendance Summary</h3>
                <select className="bg-slate-50 border-none text-sm font-medium text-slate-600 rounded-lg px-3 py-1 outline-none cursor-pointer hover:bg-slate-100">
                   <option>Today</option>
                </select>
             </div>
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AttendanceWidget 
                  label="Present" 
                  count={stats.presentToday} 
                  bg="bg-emerald-50" 
                  color="text-emerald-600" 
                />
                <AttendanceWidget 
                  label="Absent" 
                  count={stats.absentToday} 
                  bg="bg-rose-50" 
                  color="text-rose-600" 
                />
                 <AttendanceWidget 
                  label="On Leave/MC" 
                  count={stats.onLeaveToday} 
                  bg="bg-amber-50" 
                  color="text-amber-600" 
                />
                 <AttendanceWidget 
                  label="Total Active" 
                  count={stats.totalEmployees} 
                  bg="bg-blue-50" 
                  color="text-blue-600" 
                />
             </div>
          </div>

          {/* Working Hours Chart */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-6">
               <h3 className="text-xl font-bold text-slate-800">Working Statistics (Current Week)</h3>
               <div className="text-sm font-medium text-slate-400">Total OT Today: <span className="text-slate-800 font-bold">{stats.totalOtHoursToday.toFixed(1)} hrs</span></div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.chartData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{fill: '#94a3b8', fontSize: 12, fontWeight: 'bold'}} 
                    dy={10}
                  />
                  <YAxis 
                     hide 
                  />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 8, 8]}>
                    {stats.chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#3B82F6' : '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN (1/3 width) */}
        <div className="space-y-8">
          
          {/* Quick Actions Card */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
             <h3 className="text-xl font-bold text-slate-800 mb-6">Quick Actions</h3>
             <div className="space-y-2">
               <QuickAction 
                  icon={PlusCircle} 
                  label="Add New Worker" 
                  color="bg-blue-500"
                  onClick={() => navigate('/employees')} 
               />
               <QuickAction 
                  icon={Clock} 
                  label="Enter Daily Attendance" 
                  color="bg-emerald-500"
                  onClick={() => navigate('/attendance')} 
               />
               <QuickAction 
                  icon={Wallet} 
                  label="Generate Payroll" 
                  color="bg-purple-500"
                  onClick={() => navigate('/payroll')} 
               />
             </div>
          </div>

          {/* Expiry Alerts */}
          <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 min-h-[300px]">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-slate-800">Upcoming Expiry Alerts</h3>
                <span className={`px-2 py-1 rounded-full font-bold text-xs ${stats.alerts.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
                    {stats.alerts.length} Items
                </span>
             </div>

             <div className="space-y-3">
               {stats.alerts.length === 0 ? (
                 <div className="flex flex-col items-center justify-center py-8 text-center">
                   <CheckCircle size={32} className="text-emerald-400 mb-2" />
                   <p className="text-slate-400 text-sm">Everything is up to date!</p>
                 </div>
               ) : (
                 <div className="max-h-[400px] overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {stats.alerts.map((alert, idx) => (
                        <div 
                            key={`${alert.id}-${idx}`} 
                            onClick={() => handleAlertClick(alert.id)}
                            className="group cursor-pointer p-3 rounded-xl border transition-all hover:shadow-md border-slate-100 hover:border-blue-100 bg-white"
                        >
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-slate-800 text-sm truncate">{alert.name}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide ${
                                    alert.severity === 'high' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'
                                }`}>
                                    {alert.daysLeft < 0 ? 'Expired' : `${alert.daysLeft} Days Left`}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-500 font-medium truncate max-w-[150px]">{alert.type}</span>
                                <span className={`font-bold ${alert.severity === 'high' ? 'text-red-500' : 'text-orange-500'}`}>
                                    {format(parseISO(alert.expiryDate), 'dd/MM/yyyy')}
                                </span>
                            </div>
                        </div>
                    ))}
                 </div>
               )}
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Dashboard;
