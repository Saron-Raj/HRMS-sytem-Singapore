
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { StorageService } from '../services/storage';
import { SiteLogRecord } from '../types';
import { ArrowLeft, Save, Users, Construction, CheckSquare, Trash2, MapPin } from 'lucide-react';
import { format, differenceInMinutes, parse } from 'date-fns';

const SINGAPORE_LOCATIONS = [
    "Ang Mo Kio", "Bedok", "Bishan", "Boon Lay", "Bukit Batok", "Bukit Merah", "Bukit Panjang", 
    "Bukit Timah", "Central Water Catchment", "Changi", "Changi Bay", "Choa Chu Kang", "Clementi", 
    "Downtown Core", "Geylang", "Hougang", "Jurong East", "Jurong West", "Kallang", "Lim Chu Kang", 
    "Mandai", "Marina East", "Marina South", "Marine Parade", "Museum", "Newton", "Novena", 
    "Orchard", "Outram", "Pasir Ris", "Paya Lebar", "Pioneer", "Punggol", "Queenstown", "River Valley", 
    "Rochor", "Seletar", "Sembawang", "Sengkang", "Serangoon", "Simpang", "Singapore River", 
    "Southern Islands", "Straits View", "Sungei Kadut", "Tampines", "Tanglin", "Tengah", "Toa Payoh", 
    "Tuas", "Western Islands", "Western Water Catchment", "Woodlands", "Yishun", "Lentor", "Bidadari"
];

const ExpensesDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = !id || id === 'new';
    
    const defaultFormState: Partial<SiteLogRecord> = {
        date: format(new Date(), 'yyyy-MM-dd'),
        siteName: '',
        paxGw: 0,
        paxReo: 0,
        startTime: '08:00',
        endTime: '17:00',
        totalHours: 9,
        hourlyRate: 14,
        manpowerCost: 0,
        diesel: '',
        dieselCost: 0,
        premixTon: 0,
        premixCost: 0,
        gradedStone: '',
        soilThrow: '',
        materialBuy: 0,
        remarks: ''
    };

    const [formData, setFormData] = useState<Partial<SiteLogRecord>>(defaultFormState);

    // Load existing data
    useEffect(() => {
        if (!isNew && id) {
            const logs = StorageService.getSiteLogs();
            const found = logs.find(l => l.id === id);
            if (found) {
                setFormData(found);
            } else {
                navigate('/expenses');
            }
        }
    }, [id, isNew, navigate]);

    // Auto-calculate Hours
    useEffect(() => {
        if (formData.startTime && formData.endTime) {
            const start = parse(formData.startTime, 'HH:mm', new Date());
            const end = parse(formData.endTime, 'HH:mm', new Date());
            
            let diff = differenceInMinutes(end, start) / 60;
            // If negative, it might mean overnight, or user is just typing. 
            // For simple day shift:
            if (diff < 0) diff = 0;
            
            // Only update if value is different to avoid loops
            if (formData.totalHours !== parseFloat(diff.toFixed(1))) {
                setFormData(prev => ({ ...prev, totalHours: parseFloat(diff.toFixed(1)) }));
            }
        }
    }, [formData.startTime, formData.endTime]);

    // Auto-calculate Manpower Cost
    useEffect(() => {
        const hours = formData.totalHours || 0;
        const rate = formData.hourlyRate || 0;
        const pax = (formData.paxGw || 0) + (formData.paxReo || 0);
        
        const cost = pax * hours * rate;
        if (formData.manpowerCost !== parseFloat(cost.toFixed(2))) {
            setFormData(prev => ({ ...prev, manpowerCost: parseFloat(cost.toFixed(2)) }));
        }
    }, [formData.totalHours, formData.hourlyRate, formData.paxGw, formData.paxReo]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        
        const newLog: SiteLogRecord = {
            id: (!isNew && id) ? id : Date.now().toString(),
            date: formData.date!,
            siteName: formData.siteName || 'Unknown Location',
            paxGw: Number(formData.paxGw) || 0,
            paxReo: Number(formData.paxReo) || 0,
            startTime: formData.startTime!,
            endTime: formData.endTime!,
            totalHours: Number(formData.totalHours) || 0,
            hourlyRate: Number(formData.hourlyRate) || 0,
            manpowerCost: Number(formData.manpowerCost) || 0,
            diesel: formData.diesel || '',
            dieselCost: Number(formData.dieselCost) || 0,
            premixTon: Number(formData.premixTon) || 0,
            premixCost: Number(formData.premixCost) || 0,
            gradedStone: formData.gradedStone || '',
            soilThrow: formData.soilThrow || '',
            materialBuy: Number(formData.materialBuy) || 0,
            remarks: formData.remarks || ''
        };

        StorageService.saveSiteLog(newLog);
        navigate('/expenses');
    };

    const handleDelete = () => {
        if (!isNew && id && window.confirm("Are you sure you want to delete this log?")) {
            StorageService.deleteSiteLog(id);
            navigate('/expenses');
        }
    };

    const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm";
    const labelClass = "block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1";

    return (
        <div className="space-y-6 animate-fade-in pb-10">
            {/* Header */}
            <div className="flex items-center gap-4 border-b border-slate-200 pb-4">
                <button 
                    onClick={() => navigate('/expenses')}
                    className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-500 transition-colors shadow-sm"
                >
                    <ArrowLeft size={20} />
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                        {isNew ? 'Add Daily Site Log' : 'Edit Site Log'}
                    </h2>
                    <p className="text-slate-500 text-sm">
                        {isNew ? 'Create a new expense and manpower record' : `Editing record for ${formData.siteName} on ${formData.date}`}
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 md:p-8">
                <form id="log-form" onSubmit={handleSave} className="space-y-8 max-w-4xl mx-auto">
                    
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className={labelClass}>Date</label>
                            <input type="date" required className={inputClass} value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
                        </div>
                        <div className="relative">
                            <label className={labelClass}>Site Name</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                                <input 
                                    type="text" 
                                    required 
                                    className={`${inputClass} pl-10`} 
                                    placeholder="Type to search location..." 
                                    list="sg-locations"
                                    value={formData.siteName} 
                                    onChange={e => setFormData({...formData, siteName: e.target.value})} 
                                />
                                <datalist id="sg-locations">
                                    {SINGAPORE_LOCATIONS.map(loc => (
                                        <option key={loc} value={loc} />
                                    ))}
                                </datalist>
                            </div>
                        </div>
                    </div>

                    {/* Manpower & Time Section */}
                    <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
                         <h4 className="text-sm font-bold text-blue-600 uppercase mb-4 flex items-center gap-2">
                            <Users size={16} /> Manpower & Time
                         </h4>
                         
                         <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                                <label className={labelClass}>Pax (GW)</label>
                                <input type="number" className={inputClass} value={formData.paxGw} onChange={e => setFormData({...formData, paxGw: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className={labelClass}>Pax (REO)</label>
                                <input type="number" className={inputClass} value={formData.paxReo} onChange={e => setFormData({...formData, paxReo: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className={labelClass}>Start Time</label>
                                <input type="time" className={inputClass} value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                            </div>
                            <div>
                                <label className={labelClass}>End Time</label>
                                <input type="time" className={inputClass} value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Total Hours</label>
                                <input type="number" step="0.5" className={inputClass} value={formData.totalHours} onChange={e => setFormData({...formData, totalHours: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className={labelClass}>Hourly Rate ($)</label>
                                <input type="number" step="0.5" className={inputClass} value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: parseFloat(e.target.value) || 0})} />
                            </div>
                            <div>
                                <label className={labelClass}>Total Cost ($)</label>
                                <input type="number" step="0.01" readOnly className={`${inputClass} bg-slate-200 text-slate-500`} value={formData.manpowerCost} />
                            </div>
                         </div>
                    </div>

                    {/* Materials & Machinery */}
                    <div className="bg-amber-50/50 p-6 rounded-2xl border border-amber-100">
                         <h4 className="text-sm font-bold text-amber-600 uppercase mb-4 flex items-center gap-2">
                            <Construction size={16} /> Materials & Machinery
                         </h4>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <label className={labelClass}>Diesel Usage</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" placeholder="Litres / Details" className={inputClass} value={formData.diesel} onChange={e => setFormData({...formData, diesel: e.target.value})} />
                                    <input type="number" placeholder="Cost ($)" step="0.01" className={inputClass} value={formData.dieselCost} onChange={e => setFormData({...formData, dieselCost: parseFloat(e.target.value) || 0})} />
                                </div>
                            </div>
                             <div>
                                <label className={labelClass}>Premix</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="number" placeholder="Tons" step="0.1" className={inputClass} value={formData.premixTon} onChange={e => setFormData({...formData, premixTon: parseFloat(e.target.value) || 0})} />
                                    <input type="number" placeholder="Cost ($)" step="0.01" className={inputClass} value={formData.premixCost} onChange={e => setFormData({...formData, premixCost: parseFloat(e.target.value) || 0})} />
                                </div>
                            </div>
                         </div>

                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className={labelClass}>Graded Stone / Cement</label>
                                <input type="text" className={inputClass} value={formData.gradedStone} onChange={e => setFormData({...formData, gradedStone: e.target.value})} />
                            </div>
                             <div>
                                <label className={labelClass}>Soil Out / Throw</label>
                                <input type="text" className={inputClass} value={formData.soilThrow} onChange={e => setFormData({...formData, soilThrow: e.target.value})} />
                            </div>
                             <div>
                                <label className={labelClass}>Material Buy ($)</label>
                                <input type="number" step="0.01" className={inputClass} value={formData.materialBuy} onChange={e => setFormData({...formData, materialBuy: parseFloat(e.target.value) || 0})} />
                            </div>
                         </div>
                    </div>

                    {/* Remarks */}
                    <div>
                         <label className={labelClass}>Remarks</label>
                         <textarea rows={3} className={inputClass} value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} placeholder="Additional notes..." />
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 flex-col sm:flex-row">
                        <button type="button" onClick={() => navigate('/expenses')} className="px-6 py-3 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition order-2 sm:order-1">Cancel</button>
                        {!isNew && (
                            <button type="button" onClick={handleDelete} className="px-6 py-3 rounded-xl text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 transition flex items-center justify-center gap-2 order-3 sm:order-2">
                                <Trash2 size={16} /> Delete
                            </button>
                        )}
                        <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 transition-all order-1 sm:order-3">
                            <CheckSquare size={16} /> Save Record
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default ExpensesDetail;
