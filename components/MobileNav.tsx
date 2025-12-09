
import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { NAV_ITEMS, APP_NAME } from '../constants';
import { Menu, X, LogOut, User } from 'lucide-react';

const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
      localStorage.removeItem('hr_is_logged_in');
      // Force reload or redirect logic handled by parent state, but we can navigate to login
      window.location.reload(); 
  };

  return (
    <div className="lg:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md print:hidden">
      <div className="font-bold text-xl text-blue-400 flex items-center gap-2">
         <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-lg">Q</div>
         {APP_NAME}
      </div>
      <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-slate-300 hover:text-white">
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div className="absolute top-[64px] left-0 w-full bg-slate-900 shadow-2xl border-t border-slate-800 animate-fade-in-down h-[calc(100vh-64px)] overflow-y-auto">
          <nav className="flex flex-col p-4 space-y-2 pb-20">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4">Navigation</div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-4 rounded-xl transition-all ${
                    isActive ? 'bg-blue-600 text-white font-bold shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            <div className="border-t border-slate-800 my-4 pt-4">
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 px-4">Account</div>
                 <button 
                    onClick={() => {
                        setIsOpen(false);
                        navigate('/settings');
                    }}
                    className="flex w-full items-center space-x-3 px-4 py-4 rounded-xl text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                 >
                     <User size={20} />
                     <span>Profile Settings</span>
                 </button>
                 <button 
                    onClick={handleLogout}
                    className="flex w-full items-center space-x-3 px-4 py-4 rounded-xl text-red-400 hover:bg-red-900/20 transition-all font-bold"
                 >
                     <LogOut size={20} />
                     <span>Sign Out</span>
                 </button>
            </div>
          </nav>
        </div>
      )}
    </div>
  );
};

export default MobileNav;