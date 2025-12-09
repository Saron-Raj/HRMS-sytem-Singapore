
import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { NAV_ITEMS, APP_NAME } from '../constants';
import { Menu, X } from 'lucide-react';

const MobileNav = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-md print:hidden">
      <div className="font-bold text-xl text-blue-400">{APP_NAME}</div>
      <button onClick={() => setIsOpen(!isOpen)} className="p-1">
        {isOpen ? <X /> : <Menu />}
      </button>

      {isOpen && (
        <div className="absolute top-16 left-0 w-full bg-slate-900 shadow-xl border-t border-slate-800 animate-fade-in-down">
          <nav className="flex flex-col p-4 space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg ${
                    isActive ? 'bg-blue-600 text-white' : 'text-slate-300'
                  }`}
                >
                  <Icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
};

export default MobileNav;
