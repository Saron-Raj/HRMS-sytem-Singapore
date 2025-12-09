import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { APP_NAME } from '../constants';
import { Mail, Key, ArrowRight, CheckCircle, ArrowLeft, Lock, AlertCircle } from 'lucide-react';

const ForgotPassword = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await api.auth.sendOTP(email);
            if (res.success) {
                setStep(2);
                setSuccessMsg('OTP sent to your email.');
            } else {
                setError(res.message || "Email not found.");
            }
        } catch (err) {
            setError("Failed to send OTP.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');
        try {
            const res = await api.auth.verifyOTP(email, otp);
            if (res.success) {
                setStep(3);
                setSuccessMsg('');
            } else {
                setError("Invalid OTP code.");
            }
        } catch (err) {
            setError("Verification failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        
        setIsLoading(true);
        setError('');
        try {
            const res = await api.auth.resetPassword(newPassword);
            if (res.success) {
                setSuccessMsg("Password reset successfully!");
                setTimeout(() => navigate('/login'), 2000);
            } else {
                setError("Failed to reset password.");
            }
        } catch (err) {
            setError("Error resetting password.");
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
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center font-bold text-2xl shadow-sm mb-4">
                        <Key size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800">Password Recovery</h1>
                    <p className="text-slate-500 text-sm font-medium mt-1">
                        {step === 1 && "Enter your email to receive a verification code"}
                        {step === 2 && "Enter the 6-digit code sent to your email"}
                        {step === 3 && "Create a new secure password"}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-sm font-bold p-3 rounded-xl flex items-center gap-2 border border-red-100 mb-6 animate-fade-in">
                        <AlertCircle size={16} /> {error}
                    </div>
                )}
                {successMsg && (
                    <div className="bg-emerald-50 text-emerald-600 text-sm font-bold p-3 rounded-xl flex items-center gap-2 border border-emerald-100 mb-6 animate-fade-in">
                        <CheckCircle size={16} /> {successMsg}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={handleSendOTP} className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Admin Email</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input 
                                    type="email" 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                    placeholder="admin@qualityme.sg"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <span className="animate-spin text-white">⌛</span> : <>Send Code <ArrowRight size={18} /></>}
                        </button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleVerifyOTP} className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Verification Code</label>
                            <input 
                                type="text" 
                                required
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 px-4 text-center text-2xl font-bold tracking-widest text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-300"
                                placeholder="000000"
                                maxLength={6}
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <span className="animate-spin text-white">⌛</span> : "Verify Code"}
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setStep(1)}
                            className="w-full text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                        >
                            Resend Code
                        </button>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleResetPassword} className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">New Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                    placeholder="Min 6 characters"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Confirm Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
                                <input 
                                    type="password" 
                                    required
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3.5 pl-11 pr-4 text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                                    placeholder="Confirm password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        </div>
                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-slate-900/20 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <span className="animate-spin text-white">⌛</span> : "Reset Password"}
                        </button>
                    </form>
                )}

                <div className="mt-8 text-center border-t border-slate-100 pt-6">
                    <button 
                        onClick={() => navigate('/login')}
                        className="text-sm font-bold text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        <ArrowLeft size={16} /> Back to Login
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;