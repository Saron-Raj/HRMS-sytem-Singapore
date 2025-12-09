import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS } from '../constants';
import { Settings as SettingsIcon } from 'lucide-react';
import { api } from '../services/api';

const Sidebar = () => {
  const location = useLocation();
  const [adminName, setAdminName] = useState('Admin User');
  const [adminEmail, setAdminEmail] = useState('admin@qualityme.sg');

  useEffect(() => {
    // In a real app, you might subscribe to an auth context
    api.auth.getProfile().then(res => {
        if(res.success) {
            setAdminName(res.data.name);
            setAdminEmail(res.data.email);
        }
    });
  }, []);

  return (
    <div className="hidden lg:flex flex-col w-72 bg-[#0F172A] h-screen fixed left-0 top-0 text-white shadow-2xl z-50 rounded-r-3xl my-0 print:hidden">
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-lg text-xl">
                Q
            </div>
            <div>
                <h1 className="text-lg font-bold tracking-tight text-white leading-tight">QUALITY M&E</h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-widest uppercase">HR Management</p>
            </div>
        </div>
      
      <nav className="flex-1 space-y-2">
        <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Main Menu</div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 translate-x-1' 
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
              }`}
            >
              <Icon size={20} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
        
        <div className="pt-6">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 px-2">Configuration</div>
            <Link
            to="/settings"
            className={`flex items-center space-x-3 px-4 py-3.5 rounded-2xl transition-all duration-300 group ${
                location.pathname === '/settings' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50 translate-x-1' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white hover:translate-x-1'
            }`}
            >
                <SettingsIcon size={20} className={location.pathname === '/settings' ? 'text-white' : 'text-slate-400 group-hover:text-white'} />
                <span className="font-medium text-sm">Settings</span>
            </Link>
        </div>
      </nav>
      </div>

      <div className="mt-auto p-6 m-4 bg-slate-800/50 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
           <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-500 to-pink-500 flex items-center justify-center font-bold text-xs shadow-inner border-2 border-slate-800">AD</div>
           <div className="flex-1 min-w-0">
             <p className="text-sm font-bold text-white truncate">{adminName}</p>
             <p className="text-xs text-slate-400 truncate">{adminEmail}</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;