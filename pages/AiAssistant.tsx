
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { api } from '../services/api'; // Switched to API for fresh data
import { StorageService } from '../services/storage';
import { Employee } from '../types';
import { Bot, Send, User, Download, FileText, Loader2, ArrowRight, Sparkles, Navigation, MapPin, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PayslipModal from './PayslipModal';
import { calculateMonthlyPayroll } from '../utils/calculations';
import { format } from 'date-fns';

interface SearchResult {
    id: string;
    name: string;
    reason: string;
}

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
    action?: {
        type: 'download_payslip' | 'navigate';
        payload: any;
    };
    searchResults?: SearchResult[];
}

const SUGGESTIONS = [
    "Who is absent today?",
    "Show me the expenses for Lentor",
    "Generate payslip for Tan Wei Ming",
    "Who has expiring work permits?",
    "Go to Settings page"
];

const AiAssistant = () => {
    const navigate = useNavigate();
    const [messages, setMessages] = useState<Message[]>([
        { id: 'init', role: 'model', text: 'Hello! I am your HR & Admin Assistant. I have access to your Employee records, Today\'s Attendance, and recent Site Expenses.\n\nHow can I help you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Modal State for Payslip
    const [payslipModalOpen, setPayslipModalOpen] = useState(false);
    const [targetPayslipEmployee, setTargetPayslipEmployee] = useState<Employee | null>(null);
    const [targetPayslipData, setTargetPayslipData] = useState<any>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = async (e?: React.FormEvent, overrideText?: string) => {
        if (e) e.preventDefault();
        const textToSend = overrideText || input;
        
        if (!textToSend.trim() || isLoading) return;

        const userMsg: Message = { id: Date.now().toString(), role: 'user', text: textToSend };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            // 1. GATHER CONTEXT (Real-time DB Data)
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const readableDate = format(new Date(), 'EEEE, d MMMM yyyy');

            const [empRes, attRes, expRes] = await Promise.all([
                api.employees.getAll('Active'),
                api.attendance.getDaily(todayStr),
                api.expenses.getLogs({}) // Get recent logs
            ]);

            const employees = empRes.success ? empRes.data : [];
            const attendance = attRes.success ? attRes.data.records : [];
            const expenses = expRes.success ? expRes.data.slice(0, 15) : []; // Limit to top 15 for context window

            // Prepare Enriched Context
            const empContext = employees.map(e => {
                const att = attendance.find(a => a.employeeId === e.id);
                return {
                    id: e.id,
                    name: e.name,
                    position: e.position,
                    fin: e.fin,
                    status: e.status,
                    pass: e.passType,
                    permits: { wp: e.workPermitExpiry, passport: e.passportExpiry },
                    attendanceToday: att ? (att.remarks || (att.workDay > 0 ? 'Present' : 'Absent')) : 'No Record',
                    checkIn: att?.startTime || 'N/A',
                    checkOut: att?.endTime || 'N/A',
                    siteToday: att?.siteLocation || 'N/A'
                };
            });

            const expenseContext = expenses.map(l => ({
                date: l.date,
                site: l.siteName,
                manpowerCost: l.manpowerCost,
                totalCost: (l.manpowerCost || 0) + (l.premixCost || 0) + (l.dieselCost || 0) + (l.materialBuy || 0),
                remarks: l.remarks
            }));

            const systemInstruction = `
            You are an advanced AI Assistant for "QUALITY M&E".
            
            CURRENT CONTEXT:
            - Date: ${readableDate}
            - Employees & Attendance Today: ${JSON.stringify(empContext)}
            - Recent Site Expenses (Last 15 logs): ${JSON.stringify(expenseContext)}
            
            CAPABILITIES:
            1. **Query Data**: Answer questions about who is present/absent, employee details (expiry, roles), and site expenses.
            2. **Navigation**: If the user wants to go to a page, return ACTION:NAVIGATE:<path>.
               - Paths: /employees, /attendance, /payroll, /expenses, /reports, /settings, /dashboard
            3. **Payslips**: If asked for a payslip, find the employee and return ACTION:DOWNLOAD_PAYSLIP:<ID>:<NAME>.
            
            RULES:
            - Be concise.
            - If listing multiple items (e.g. "Who is absent?"), use a bulleted list.
            - If data is missing (e.g. attendance for today not entered), say so politely.
            - For Expenses, summarize totals if asked (e.g. "Total diesel cost").
            - If multiple employees match a name (e.g. "Tan"), list them using ACTION:SEARCH_RESULTS format:
              ACTION:SEARCH_RESULTS:[{"id":"...","name":"...","reason":"Matched 'Tan'"}]
            `;

            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: textToSend,
                config: {
                    systemInstruction: systemInstruction,
                }
            });

            const replyText = response.text || "I didn't catch that. Could you repeat?";
            
            // Parse Response Actions
            let finalRole: 'model' = 'model';
            let finalAction = undefined;
            let finalSearchResults: SearchResult[] | undefined = undefined;
            let finalText = replyText;

            // CHECK: NAVIGATE
            if (replyText.includes('ACTION:NAVIGATE:')) {
                const parts = replyText.split('ACTION:NAVIGATE:');
                finalText = parts[0].trim();
                const path = parts[1].trim().split(/\s+/)[0]; // Take first token
                finalAction = {
                    type: 'navigate' as const,
                    payload: path
                };
            }
            // CHECK: PAYSLIP
            else if (replyText.includes('ACTION:DOWNLOAD_PAYSLIP:')) {
                const parts = replyText.split('ACTION:DOWNLOAD_PAYSLIP:');
                finalText = parts[0].trim();
                const actionPart = parts[1].trim().split('\n')[0]; 
                const [empId, ...nameParts] = actionPart.split(':');
                finalAction = {
                    type: 'download_payslip' as const,
                    payload: { employeeId: empId.trim(), employeeName: nameParts.join(':').trim() }
                };
            }
            // CHECK: SEARCH RESULTS
            else if (replyText.includes('ACTION:SEARCH_RESULTS:')) {
                const parts = replyText.split('ACTION:SEARCH_RESULTS:');
                finalText = parts[0].trim();
                try {
                    let jsonStr = parts[1].trim();
                    jsonStr = jsonStr.replace(/^```json/, '').replace(/^```/, '').replace(/```$/, '').trim();
                    finalSearchResults = JSON.parse(jsonStr);
                } catch (e) { console.error(e); }
            }

            setMessages(prev => [...prev, { 
                id: Date.now().toString(), 
                role: finalRole, 
                text: finalText || (finalAction ? "Sure, taking you there..." : "Here is the info:"),
                action: finalAction,
                searchResults: finalSearchResults
            }]);

        } catch (error) {
            console.error("AI Error:", error);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "I'm having trouble accessing the database right now. Please try again later." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const openPayslipModal = (employeeId: string) => {
        // We need to fetch full employee object and data
        api.employees.getById(employeeId).then(res => {
            if (res.success && res.data) {
                const emp = res.data;
                const currentMonth = format(new Date(), 'yyyy-MM');
                const attendance = StorageService.getAttendance(); // Fallback to storage for bulk calc or fetch API
                const adjustments = StorageService.getPayrollAdjustments(emp.id, currentMonth);
                const settings = StorageService.getSettings();
                
                const payroll = calculateMonthlyPayroll(emp, currentMonth, attendance, adjustments, settings);
                setTargetPayslipEmployee(emp);
                setTargetPayslipData(payroll);
                setPayslipModalOpen(true);
            } else {
                alert("Employee not found.");
            }
        });
    };

    const handleActionClick = (action: Message['action']) => {
        if (!action) return;
        if (action.type === 'download_payslip') {
            openPayslipModal(action.payload.employeeId);
        } else if (action.type === 'navigate') {
            navigate(action.payload);
        }
    };

    return (
        // Adjusted height to account for mobile navbar differences
        <div className="h-[calc(100dvh-100px)] md:h-[calc(100dvh-140px)] flex flex-col gap-4 md:gap-6 animate-fade-in">
            <div className="print:hidden space-y-4 md:space-y-6 flex flex-col h-full">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Sparkles className="text-blue-500 fill-blue-100" /> AI Assistant
                    </h2>
                    <p className="text-slate-500 font-medium">Smart insights from your HR & Project data.</p>
                </div>

                <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden relative">
                    
                    {/* Chat Area */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 bg-slate-50/30">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`w-10 h-10 rounded-full flex-none flex items-center justify-center shadow-sm ${msg.role === 'model' ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                                    {msg.role === 'model' ? <Bot size={20} /> : <User size={20} />}
                                </div>
                                
                                <div className={`max-w-[85%] space-y-3`}>
                                    {/* Text Bubble */}
                                    <div className={`p-4 rounded-2xl shadow-sm text-sm font-medium leading-relaxed whitespace-pre-wrap ${msg.role === 'model' ? 'bg-white text-slate-700 border border-slate-100 rounded-tl-none' : 'bg-blue-600 text-white rounded-tr-none'}`}>
                                        {msg.text}
                                    </div>
                                    
                                    {/* ACTION: NAVIGATE */}
                                    {msg.action && msg.action.type === 'navigate' && (
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 animate-fade-in w-fit">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Navigation size={18} /></div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">Navigate App</div>
                                                    <div className="text-xs text-slate-500">Go to {msg.action.payload}</div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleActionClick(msg.action)} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition">Go Now</button>
                                        </div>
                                    )}

                                    {/* ACTION: DOWNLOAD PAYSLIP */}
                                    {msg.action && msg.action.type === 'download_payslip' && (
                                        <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between gap-4 animate-fade-in w-fit">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-purple-50 text-purple-600 p-2 rounded-lg"><FileText size={18} /></div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{msg.action.payload.employeeName}</div>
                                                    <div className="text-xs text-slate-500">Ready to generate payslip</div>
                                                </div>
                                            </div>
                                            <button onClick={() => handleActionClick(msg.action)} className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1"><Download size={14} /> Open</button>
                                        </div>
                                    )}

                                    {/* SEARCH RESULTS */}
                                    {msg.searchResults && msg.searchResults.length > 0 && (
                                        <div className="grid grid-cols-1 gap-2 animate-fade-in w-full min-w-[300px]">
                                            {msg.searchResults.map((result, idx) => (
                                                <div key={idx} className="bg-white p-3 rounded-xl border border-slate-200 hover:border-blue-300 transition-colors shadow-sm flex items-center justify-between group">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">{idx + 1}</div>
                                                        <div>
                                                            <div className="font-bold text-slate-800 text-sm">{result.name}</div>
                                                            <div className="text-xs text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5">{result.reason}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button onClick={() => openPayslipModal(result.id)} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors" title="Payslip"><FileText size={18} /></button>
                                                        <button onClick={() => navigate(`/employees/${result.id}`)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Profile"><ArrowRight size={18} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        {isLoading && (
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-sm"><Bot size={20} /></div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-100 rounded-tl-none shadow-sm flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin text-blue-500" />
                                    <span className="text-xs font-bold text-slate-400">Analyzing live database...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggestions & Input Area */}
                    <div className="bg-white border-t border-slate-100 p-4">
                        {messages.length < 3 && (
                            <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
                                {SUGGESTIONS.map((s, i) => (
                                    <button 
                                        key={i} 
                                        onClick={() => handleSendMessage(undefined, s)}
                                        className="whitespace-nowrap px-4 py-2 bg-slate-50 hover:bg-blue-50 text-slate-600 hover:text-blue-600 border border-slate-200 hover:border-blue-200 rounded-full text-xs font-bold transition-all"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                        
                        <form onSubmit={(e) => handleSendMessage(e)} className="relative max-w-4xl mx-auto">
                            <input 
                                type="text" 
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Ask me anything..." 
                                className="w-full pl-6 pr-14 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all shadow-sm"
                                autoFocus
                            />
                            <button 
                                type="submit" 
                                disabled={!input.trim() || isLoading}
                                className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-all shadow-md"
                            >
                                <Send size={20} />
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {payslipModalOpen && targetPayslipEmployee && targetPayslipData && (
                <PayslipModal 
                    employee={targetPayslipEmployee} 
                    data={targetPayslipData} 
                    onClose={() => setPayslipModalOpen(false)} 
                />
            )}
        </div>
    );
};

export default AiAssistant;
