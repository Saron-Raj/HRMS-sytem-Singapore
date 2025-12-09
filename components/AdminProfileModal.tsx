import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { AdminProfile } from '../types';
import { User, Mail, Lock, X, CheckCircle, Save } from 'lucide-react';

interface Props {
  onClose: () => void;
}

const AdminProfileModal: React.FC<Props> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [profile, setProfile] = useState<AdminProfile>({ name: '', email: '', password: '' });
  
  // Form States
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  useEffect(() => {
    // Async fetch from DB
    api.auth.getProfile().then(res => {
        if(res.success) {
            setProfile(res.data);
            setName(res.data.name);
            setEmail(res.data.email);
        }
    });
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) {
      setStatus({ type: 'error', message: 'All fields are required.' });
      return;
    }

    const updatedProfile = { ...profile, name, email };
    
    // Save to DB
    const res = await api.auth.updateProfile(updatedProfile);
    if(res.success) {
        setProfile(res.data);
        setStatus({ type: 'success', message: 'Profile details updated successfully.' });
    } else {
        setStatus({ type: 'error', message: res.message || 'Failed to update.' });
    }
    
    // Clear message after 2s
    setTimeout(() => setStatus({ type: null, message: '' }), 2000);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setStatus({ type: 'error', message: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setStatus({ type: 'error', message: 'Passwords do not match.' });
      return;
    }

    const updatedProfile = { ...profile, password: newPassword };
    const res = await api.auth.updateProfile(updatedProfile);

    if (res.success) {
        setProfile(res.data);
        setStatus({ type: 'success', message: 'Password updated successfully.' });
        setNewPassword('');
        setConfirmPassword('');
    } else {
        setStatus({ type: 'error', message: res.message || 'Failed to update.' });
    }

    // Clear message after 2s
    setTimeout(() => setStatus({ type: null, message: '' }), 2000);
  };

  const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm";
  const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1";

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden ring-1 ring-white/20">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div>
            <h3 className="text-xl font-bold text-slate-800">Admin Account</h3>
            <p className="text-xs font-medium text-slate-500 mt-1">Manage credentials and recovery email</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-6">
            <button
                onClick={() => { setActiveTab('profile'); setStatus({ type: null, message: '' }); }}
                className={`flex-1 pb-3 pt-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Profile & Email
            </button>
            <button
                onClick={() => { setActiveTab('security'); setStatus({ type: null, message: '' }); }}
                className={`flex-1 pb-3 pt-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'security' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Security
            </button>
        </div>

        {/* Body */}
        <div className="p-6 bg-slate-50/50">
            {status.message && (
                <div className={`mb-4 p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${status.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {status.type === 'success' ? <CheckCircle size={16} /> : <X size={16} />}
                    {status.message}
                </div>
            )}

            {activeTab === 'profile' && (
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <div>
                        <label className={labelClass}>Admin Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text" 
                                className={`${inputClass} pl-10`} 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Recovery Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="email" 
                                className={`${inputClass} pl-10`} 
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                            />
                        </div>
                         <p className="text-[10px] text-slate-400 mt-1 ml-1">Used for OTP password reset.</p>
                    </div>
                    <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 mt-2">
                        <Save size={18} /> Update Profile
                    </button>
                </form>
            )}

            {activeTab === 'security' && (
                 <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <div className="bg-amber-50 text-amber-800 p-3 rounded-xl text-xs font-medium mb-4 border border-amber-100">
                        Ensure you use a strong password to protect employee and payroll data.
                    </div>
                    <div>
                        <label className={labelClass}>New Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                className={`${inputClass} pl-10`} 
                                value={newPassword} 
                                onChange={(e) => setNewPassword(e.target.value)} 
                                placeholder="Min 6 characters"
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Confirm Password</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="password" 
                                className={`${inputClass} pl-10`} 
                                value={confirmPassword} 
                                onChange={(e) => setConfirmPassword(e.target.value)} 
                                placeholder="Re-enter password"
                            />
                        </div>
                    </div>
                    <button type="submit" className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 mt-2">
                        <Save size={18} /> Update Password
                    </button>
                 </form>
            )}
        </div>
      </div>
    </div>
  );
};

export default AdminProfileModal;