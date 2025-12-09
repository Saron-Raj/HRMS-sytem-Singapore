
import React, { useState, useEffect, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import Attendance from './pages/Attendance';
import AttendanceDetail from './pages/AttendanceDetail';
import Payroll from './pages/Payroll';
import PayrollAdjustmentsPage from './pages/PayrollAdjustmentsPage';
import PayslipViewPage from './pages/PayslipViewPage';
import Expenses from './pages/Expenses';
import ExpensesDetail from './pages/ExpensesDetail';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import AiAssistant from './pages/AiAssistant';
import AdminProfileModal from './components/AdminProfileModal';
import { api } from './services/api';
import { StorageService } from './services/storage';
import { Bell, Search, LogOut, User, AlertCircle, X, Trash2 } from 'lucide-react';
import { differenceInDays, parseISO } from 'date-fns';

interface HeaderProps {
    onLogout: () => void;
    onOpenProfile: () => void;
}

interface NotificationItem {
    uniqueId: string;
    empId: string;
    empName: string;
    type: string;
    expiryDate: string;
    daysLeft: number;
}

const Header: React.FC<HeaderProps> = ({ onLogout, onOpenProfile }) => {
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    
    const dropdownRef = useRef<HTMLDivElement>(null);
    const notifRef = useRef<HTMLDivElement>(null);
    
    const [adminName, setAdminName] = useState('Admin User');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    useEffect(() => {
        const loadData = async () => {
            try {
                const profileRes = await api.auth.getProfile();
                if (profileRes.success) setAdminName(profileRes.data.name);

                const empsRes = await api.employees.getAll('Active');
                if (empsRes.success) {
                    const emps = empsRes.data;
                    const today = new Date();
                    const alerts: NotificationItem[] = [];
                    const hiddenIds = StorageService.getHiddenNotificationIds();
                    
                    emps.forEach(emp => {
                        const checkExpiry = (dateStr: string | undefined, typeLabel: string) => {
                            if (!dateStr) return;
                            const uniqueId = `${emp.id}-${typeLabel}-${dateStr}`;
                            
                            // Check if hidden
                            if (hiddenIds.includes(uniqueId)) return;

                            const diff = differenceInDays(parseISO(dateStr), today);
                            if (diff <= 30) {
                                alerts.push({
                                    uniqueId: uniqueId,
                                    empId: emp.id,
                                    empName: emp.name,
                                    type: typeLabel,
                                    expiryDate: dateStr,
                                    daysLeft: diff
                                });
                            }
                        };
                        checkExpiry(emp.workPermitExpiry, 'Work Permit');
                        checkExpiry(emp.passportExpiry, 'Passport');
                        if (emp.courses) {
                            emp.courses.forEach(c => checkExpiry(c.expiryDate, `Course: ${c.name}`));
                        }
                    });
                    alerts.sort((a, b) => a.daysLeft - b.daysLeft);
                    setNotifications(alerts);
                }
            } catch (e) {
                console.error("Header data load error", e);
            }
        };

        loadData();
        const interval = setInterval(loadData, 10000); 
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setIsNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleNotificationClick = (empId: string) => {
        setIsNotifOpen(false);
        navigate(`/employees/${empId}`);
    };

    const handleClearAll = () => {
        const ids = notifications.map(n => n.uniqueId);
        StorageService.hideAllNotifications(ids);
        setNotifications([]);
    };

    const handleDismiss = (e: React.MouseEvent, uniqueId: string) => {
        e.stopPropagation();
        StorageService.hideNotification(uniqueId);
        setNotifications(prev => prev.filter(n => n.uniqueId !== uniqueId));
    };

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            const term = searchTerm.toLowerCase().trim();
            if (!term) return;

            if (term.includes('payslip')) {
                navigate('/payroll');
                return;
            }

            api.employees.getAll('Active').then(res => {
                if(res.success) {
                    const emps = res.data;
                    const finMatch = emps.find(e => e.fin.toLowerCase() === term);
                    if (finMatch) {
                        navigate(`/employees/${finMatch.id}`);
                        setSearchTerm('');
                        return;
                    }
                    navigate('/employees', { state: { searchTerm: term } });
                }
            });
            setSearchTerm('');
        }
    };

    return (
        <div className="hidden md:flex justify-between items-center py-4 px-8 mb-4 print:hidden relative z-40">
            <div className="flex items-center bg-white rounded-full px-4 py-2.5 shadow-sm border border-slate-200 w-96 transition-all hover:border-blue-300 relative group">
                <Search size={18} className="text-slate-400 absolute left-4 group-focus-within:text-blue-500 transition-colors" />
                <input 
                    type="text" 
                    placeholder="Search payslip, FIN, Name..." 
                    className="bg-transparent border-none outline-none text-sm pl-8 w-full text-black font-bold placeholder:text-slate-400"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleSearch}
                />
            </div>

            <div className="flex items-center gap-6">
                <div className="relative" ref={notifRef}>
                    <button 
                        onClick={() => setIsNotifOpen(!isNotifOpen)}
                        className={`relative p-2 transition-colors ${isNotifOpen ? 'text-blue-600 bg-blue-50 rounded-full' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Bell size={22} />
                        {notifications.length > 0 && (
                            <span className="absolute top-1 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
                        )}
                    </button>
                    {isNotifOpen && (
                        <div className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-fade-in origin-top-right overflow-hidden flex flex-col max-h-[400px]">
                            <div className="px-4 py-3 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Expiry Alerts</p>
                                <div className="flex items-center gap-2">
                                    {notifications.length > 0 && (
                                        <button onClick={handleClearAll} className="text-[10px] font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors">
                                            Clear All
                                        </button>
                                    )}
                                    <button onClick={() => setIsNotifOpen(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
                                {notifications.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <AlertCircle size={24} className="text-slate-300 mb-2" />
                                        <p className="text-xs text-slate-400 font-medium">No alerts right now.</p>
                                    </div>
                                ) : (
                                    notifications.map((notif, i) => (
                                        <div 
                                            key={`${notif.uniqueId}-${i}`}
                                            onClick={() => handleNotificationClick(notif.empId)}
                                            className="p-3 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors border-b border-slate-50 last:border-0 group relative pr-8"
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-slate-800 text-xs truncate max-w-[180px]">{notif.empName}</span>
                                                <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{notif.daysLeft} days</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-1.5 rounded-full ${notif.daysLeft <= 7 ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                                                <p className="text-xs text-slate-500 truncate">{notif.type} expiring</p>
                                            </div>
                                            <button
                                                onClick={(e) => handleDismiss(e, notif.uniqueId)}
                                                className="absolute right-2 top-2 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                                                title="Dismiss alert"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="flex items-center gap-3 hover:bg-slate-100 rounded-full pr-4 pl-2 py-1.5 transition-all border border-transparent hover:border-slate-200"
                    >
                        <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold text-xs shadow-md">
                            {adminName.charAt(0)}
                        </div>
                        <div className="text-left hidden md:block">
                            <p className="text-xs font-bold text-slate-800 leading-tight">{adminName}</p>
                            <p className="text-[10px] text-slate-500 font-medium">Super Admin</p>
                        </div>
                    </button>

                    {isDropdownOpen && (
                        <div className="absolute right-0 top-14 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 animate-fade-in origin-top-right overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">My Account</p>
                            </div>
                            <button onClick={() => { setIsDropdownOpen(false); onOpenProfile(); }} className="w-full text-left px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-3">
                                <User size={16} className="text-blue-500" /> Profile Settings
                            </button>
                            <div className="border-t border-slate-50 my-1"></div>
                            <button onClick={onLogout} className="w-full text-left px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors flex items-center gap-3">
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Check login state on mount
  useEffect(() => {
    const loggedIn = localStorage.getItem('hr_is_logged_in') === 'true';
    setIsAuthenticated(loggedIn);
  }, []);

  const handleLogin = () => {
    localStorage.setItem('hr_is_logged_in', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('hr_is_logged_in');
    setIsAuthenticated(false);
  };

  return (
    <Router>
        <Routes>
            <Route path="/login" element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/" replace />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            <Route path="*" element={
                isAuthenticated ? (
                  <div className="flex min-h-screen bg-[#F8FAFC]">
                    <Sidebar />
                    <div className="flex-1 md:ml-72 flex flex-col min-h-screen relative z-0">
                        <Header onLogout={handleLogout} onOpenProfile={() => setIsProfileModalOpen(true)} />
                        <MobileNav />
                        <main className="flex-1 p-4 md:p-8 overflow-x-hidden w-full max-w-[1600px] mx-auto">
                            <Routes>
                                <Route path="/" element={<Dashboard />} />
                                
                                <Route path="/employees" element={<Employees />} />
                                <Route path="/employees/:id" element={<EmployeeDetail />} />
                                
                                <Route path="/attendance" element={<Attendance />} />
                                <Route path="/attendance/:id" element={<AttendanceDetail />} />
                                
                                <Route path="/payroll" element={<Payroll />} />
                                <Route path="/payroll/adjustments/:employeeId/:month" element={<PayrollAdjustmentsPage />} />
                                <Route path="/payroll/payslip/:employeeId/:month" element={<PayslipViewPage />} />
                                
                                <Route path="/expenses" element={<Expenses />} />
                                <Route path="/expenses/:id" element={<ExpensesDetail />} />
                                
                                <Route path="/reports" element={<Reports />} />
                                <Route path="/settings" element={<Settings />} />
                                <Route path="/ai-assistant" element={<AiAssistant />} />
                                
                                <Route path="*" element={<Navigate to="/" replace />} />
                            </Routes>
                        </main>

                        {isProfileModalOpen && (
                            <AdminProfileModal onClose={() => setIsProfileModalOpen(false)} />
                        )}
                    </div>
                  </div>
                ) : (
                    <Navigate to="/login" replace />
                )
            } />
        </Routes>
    </Router>
  );
};

export default App;