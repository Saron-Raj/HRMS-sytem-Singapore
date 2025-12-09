import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { APP_NAME } from '../constants';
import { Lock, User, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
        const res = await api.auth.login(email, password);
        if (res.success) {
            onLogin();
        } else {
            setError(res.message || 'Invalid email or password');
        }
    } catch (err) {
        setError('Login failed. Please check your connection.');
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 animate-fade-in relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute -top-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-100/50 rounded-full blur-3xl"></div>
          <div className="absolute top-[40%] -left-[10%] w-[40%] h-[40%] bg-purple-100/50 rounded-full blur-3xl"></div>
      </div>

      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-slate-100 relative z-10">
        <div className="text-center mb-10">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-4 transform rotate-3">
                Q
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{APP_NAME}</h1>
            <p className="text-slate-500 text-sm font-medium mt-1">HR Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-xl flex items-center gap-2 border border-red-100 animate-fade-in">
                    <AlertCircle size={16} />
                    {error}
                </div>
            )}

            <div className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Email Address</label>
                    <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input 
                            type="email" 
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            placeholder="admin@qualityme.sg"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Password</label>
                    <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input 
                            type={showPassword ? "text" : "password"} 
                            required
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-12 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                    <div className="text-right mt-2">
                        <button 
                            type="button"
                            onClick={() => navigate('/forgot-password')}
                            className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            Forgot Password?
                        </button>
                    </div>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isLoading}
                className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
            >
                {isLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <>
                        Sign In <ArrowRight size={18} />
                    </>
                )}
            </button>
        </form>
        
        <div className="mt-8 text-center">
            <p className="text-xs text-slate-400 font-medium">
                Admin Access Only • {new Date().getFullYear()} Quality M&E
            </p>
        </div>
      </div>
    </div>
  );
};

export default Login;