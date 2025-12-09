import { 
    Employee, AttendanceRecord, SiteLogRecord, ProjectBudget, 
    ApiResponse, ExpenseFilter, ExpenseSummary, DashboardStats, 
    AlertItem, WorkerDocument, AppSettings, AdminProfile, PayrollRecord, 
    PayrollAdjustments, PayrollHistoryLog, Company, SalaryType
} from '../types';
import { supabase } from './supabaseClient';
import { StorageService } from './storage'; 
import { differenceInDays, endOfWeek, eachDayOfInterval, format, addMonths, endOfMonth, isSunday } from 'date-fns';
import startOfWeek from 'date-fns/startOfWeek';
import parseISO from 'date-fns/parseISO';
import parse from 'date-fns/parse';
import startOfMonth from 'date-fns/startOfMonth';
import { calculateMonthlyPayroll, calculateDailyTotal, calculateOtHours, getWorkingDaysInMonth, calculateOtPay } from '../utils/calculations';
import emailjs from '@emailjs/browser';

const success = <T>(data: T): ApiResponse<T> => ({ success: true, data });
const error = <T>(message: string): ApiResponse<T> => ({ success: false, data: {} as T, message });

export const api = {
    
    // --- AUTH MODULE ---
    auth: {
        login: async (email: string, password: string): Promise<ApiResponse<boolean>> => {
             const { data, error: dbError } = await supabase
                .from('admin_profile')
                .select('*')
                .limit(1)
                .single();

            // Auto-initialize if table is empty or missing row
            if (!data) {
                const defaultEmail = 'admin@qualityme.sg';
                const defaultPass = 'admin123';
                if (email.toLowerCase() === defaultEmail && password === defaultPass) {
                     // Create default admin in DB
                     await supabase.from('admin_profile').upsert({ id: 1, name: 'Admin User', email: defaultEmail, password: defaultPass });
                     return success(true);
                }
                return error('Invalid email or password');
            }

            if (data.email.toLowerCase() === email.toLowerCase() && data.password === password) {
                return success(true);
            }
            return error('Invalid email or password');
        },
        getProfile: async (): Promise<ApiResponse<AdminProfile>> => {
             const { data } = await supabase.from('admin_profile').select('*').single();
             if (data) return success(data as AdminProfile);
             // Return default object if db is empty (will be created on login/update)
             return success({ name: 'Admin User', email: 'admin@qualityme.sg', password: 'admin123' });
        },
        updateProfile: async (profile: AdminProfile): Promise<ApiResponse<AdminProfile>> => {
            const { data, error: err } = await supabase
                .from('admin_profile')
                .upsert({ id: 1, ...profile })
                .select()
                .single();
            if (err) return error(err.message);
            return success(data as AdminProfile);
        },
        sendOTP: async (email: string): Promise<ApiResponse<boolean>> => {
            const { data: admin } = await supabase.from('admin_profile').select('*').single();
            const adminEmail = admin ? admin.email : 'admin@qualityme.sg';
            
            if (adminEmail.toLowerCase() !== email.toLowerCase()) {
                return error('Email address not found.');
            }

            const result = StorageService.initiatePasswordReset(email);
            if (!result.success) return error(result.message);
            
            // Send via EmailJS
            try {
                await emailjs.send("service_m97b7n9", "template_lsoblbp", {
                    to_email: email,
                    otp_code: result.code,
                    to_name: admin ? admin.name : 'Admin'
                }, "JPxXCiYN0RM03jDQg");
                return success(true);
            } catch (err) {
                return error("Failed to send email.");
            }
        },
        verifyOTP: async (email: string, code: string): Promise<ApiResponse<boolean>> => {
            return StorageService.verifyOTP(code) ? success(true) : error("Invalid or expired OTP.");
        },
        resetPassword: async (password: string): Promise<ApiResponse<boolean>> => {
            const { error: err } = await supabase.from('admin_profile').update({ password }).eq('id', 1);
            if (err) return error(err.message);
            return success(true);
        }
    },

    // --- DASHBOARD MODULE ---
    dashboard: {
        getStats: async (): Promise<ApiResponse<DashboardStats>> => {
            const { data: emps, error: empError } = await supabase
                .from('employees')
                .select('*')
                .neq('status', 'Cancelled');

            if (empError || !emps) return error(empError?.message || 'Failed to fetch employees');

            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const { data: attendance, error: attError } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', todayStr);

            if (attError) return error(attError.message);

            const present = attendance?.filter(r => r.workDay > 0 && r.remarks !== 'MC').length || 0;
            const mc = attendance?.filter(r => r.remarks === 'MC').length || 0;
            const absent = Math.max(0, emps.length - present - mc);
            const totalOt = attendance?.reduce((acc, curr) => acc + (curr.otHours || 0), 0) || 0;

            const startOfCurrentWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
            const endOfCurrentWeek = endOfWeek(new Date(), { weekStartsOn: 1 });
            const startStr = format(startOfCurrentWeek, 'yyyy-MM-dd');
            const endStr = format(endOfCurrentWeek, 'yyyy-MM-dd');

            const { data: weekAttendance } = await supabase
                .from('attendance')
                .select('*')
                .gte('date', startStr)
                .lte('date', endStr);

            const weekDays = eachDayOfInterval({ start: startOfCurrentWeek, end: endOfCurrentWeek });
            const chartData = weekDays.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const dayRecords = weekAttendance?.filter(r => r.date === dayStr) || [];
                const totalHours = dayRecords.reduce((acc, curr) => acc + ((curr.workDay || 0) * 8) + (curr.otHours || 0), 0);
                return { day: format(day, 'EEE'), hours: parseFloat(totalHours.toFixed(1)) };
            });

            const alerts: AlertItem[] = [];
            const today = new Date();
            const hiddenIds = StorageService.getHiddenNotificationIds();

            emps.forEach((emp: Employee) => {
                const check = (date: string | undefined, type: string) => {
                    if(!date) return;
                    const diff = differenceInDays(parseISO(date), today);
                    if(diff <= 30) {
                         const uniqueId = `${emp.id}-${type}-${date}`;
                         if(!hiddenIds.includes(uniqueId)) {
                             alerts.push({
                                 id: emp.id, name: emp.name, type, expiryDate: date, daysLeft: diff,
                                 severity: diff <= 7 ? 'high' : 'medium'
                             });
                         }
                    }
                };
                check(emp.workPermitExpiry, 'Work Permit');
                check(emp.passportExpiry, 'Passport');
                if (Array.isArray(emp.courses)) {
                    emp.courses.forEach((c: any) => check(c.expiryDate, `Course: ${c.name}`));
                }
            });
            alerts.sort((a,b) => a.daysLeft - b.daysLeft);

            return success({
                totalEmployees: emps.length,
                presentToday: present,
                absentToday: absent,
                onLeaveToday: mc,
                totalOtHoursToday: totalOt,
                chartData,
                alerts
            });
        }
    },

    // --- EMPLOYEES MODULE ---
    employees: {
        getAll: async (status: 'Active' | 'Cancelled' | 'All' = 'All'): Promise<ApiResponse<Employee[]>> => {
            let query = supabase.from('employees').select('*');
            
            if (status !== 'All') {
                query = query.eq('status', status);
            }

            const { data, error: err } = await query;
            if (err) return error(err.message);
            return success(data as Employee[]);
        },
        getById: async (id: string): Promise<ApiResponse<Employee | null>> => {
            const { data, error: err } = await supabase
                .from('employees')
                .select('*')
                .eq('id', id)
                .single();
            
            if (err) return error(err.message);
            return success(data as Employee);
        },
        create: async (emp: Employee): Promise<ApiResponse<Employee>> => {
            const { data, error: err } = await supabase
                .from('employees')
                .insert(emp)
                .select()
                .single();
                
            if (err) return error(err.message);
            return success(data as Employee);
        },
        update: async (emp: Employee): Promise<ApiResponse<Employee>> => {
            const { data, error: err } = await supabase
                .from('employees')
                .update(emp)
                .eq('id', emp.id)
                .select()
                .single();

            if (err) return error(err.message);
            return success(data as Employee);
        },
        delete: async (id: string): Promise<ApiResponse<boolean>> => {
            const { error: err } = await supabase
                .from('employees')
                .delete()
                .eq('id', id);
            
            if (err) return error(err.message);
            return success(true);
        }
    },

    // --- ATTENDANCE MODULE ---
    attendance: {
        getDaily: async (date: string): Promise<ApiResponse<{records: AttendanceRecord[], employees: Employee[]}>> => {
            const { data: emps, error: empErr } = await supabase
                .from('employees')
                .select('*')
                .neq('status', 'Cancelled');

            if (empErr || !emps) return error(empErr?.message || 'Error fetching employees');

            const { data: records, error: attErr } = await supabase
                .from('attendance')
                .select('*')
                .eq('date', date);

            if (attErr) return error(attErr.message);

            const existingIds = new Set(records?.map(r => r.employeeId));
            const missingEmps = emps.filter(e => !existingIds.has(e.id));
            
            if (missingEmps.length > 0) {
                const newRecords = missingEmps.map(emp => ({
                    id: `${date}-${emp.id}`,
                    employeeId: emp.id,
                    date: date,
                    status: 'Absent',
                    otHours: 0,
                    lunchHours: 0,
                    workDay: 0,
                    calculatedDailyPay: 0,
                    remarks: '',
                    startTime: '',
                    endTime: '',
                    siteLocation: ''
                }));

                const { error: insertErr } = await supabase.from('attendance').insert(newRecords);
                if (!insertErr) {
                    records?.push(...(newRecords as any));
                }
            }

            return success({ records: records as AttendanceRecord[], employees: emps });
        },
        getByEmployee: async (employeeId: string): Promise<ApiResponse<AttendanceRecord[]>> => {
            const { data, error: err } = await supabase
                .from('attendance')
                .select('*')
                .eq('employeeId', employeeId);
            
            if (err) return error(err.message);
            return success(data as AttendanceRecord[]);
        },
        save: async (record: AttendanceRecord): Promise<ApiResponse<AttendanceRecord>> => {
            const { data, error: err } = await supabase
                .from('attendance')
                .upsert(record)
                .select()
                .single();

            if (err) return error(err.message);
            return success(data as AttendanceRecord);
        }
    },

    // --- PAYROLL MODULE ---
    payroll: {
        getMonthlyReport: async (month: string): Promise<ApiResponse<{records: PayrollRecord[], employees: Employee[]}>> => {
            const { data: emps } = await supabase
                .from('employees')
                .select('*')
                .neq('status', 'Cancelled');

            if (!emps) return error("No employees found");

            const startStr = `${month}-01`;
            const endStr = `${month}-31`;
            
            const { data: allAttendance } = await supabase
                .from('attendance')
                .select('*')
                .gte('date', startStr)
                .lte('date', endStr);
            
            const { data: allAdjustments } = await supabase
                .from('payroll_adjustments')
                .select('*')
                .like('id', `%-${month}`);

            const { data: settings } = await supabase.from('app_settings').select('*').single();
            const appSettings = settings || {};

            const records: PayrollRecord[] = emps.map(emp => {
                const empAttendance = (allAttendance as AttendanceRecord[])?.filter(r => r.employeeId === emp.id) || [];
                const adjustment = (allAdjustments as PayrollAdjustments[])?.find(a => a.id === `${emp.id}-${month}`) || { id: '', transport: 0, other: 0, housing: 0, advance: 0 };
                
                return calculateMonthlyPayroll(emp, month, empAttendance, adjustment, appSettings);
            });
            
            return success({ records, employees: emps });
        },

        getAdjustmentDetails: async (employeeId: string, month: string): Promise<ApiResponse<{
            employee: Employee, 
            adjustments: PayrollAdjustments, 
            history: PayrollHistoryLog[]
        }>> => {
            const { data: emp } = await supabase.from('employees').select('*').eq('id', employeeId).single();
            if (!emp) return error("Employee not found");

            const adjId = `${employeeId}-${month}`;
            
            let { data: adj } = await supabase.from('payroll_adjustments').select('*').eq('id', adjId).single();
            if (!adj) {
                adj = { id: adjId, transport: 0, other: 0, housing: 0, advance: 0 };
            }

            const { data: history } = await supabase
                .from('payroll_history_logs')
                .select('*')
                .eq('adjustmentId', adjId)
                .order('timestamp', { ascending: false });

            return success({ employee: emp, adjustments: adj, history: history || [] });
        },

        saveAdjustments: async (
            adj: PayrollAdjustments, 
            log?: PayrollHistoryLog
        ): Promise<ApiResponse<boolean>> => {
            const { error: adjErr } = await supabase.from('payroll_adjustments').upsert(adj);
            if (adjErr) return error(adjErr.message);

            if(log) {
                await supabase.from('payroll_history_logs').insert(log);
            }
            return success(true);
        },

        getPayslipRange: async (employeeId: string, startMonth: string, endMonth: string): Promise<ApiResponse<{
            employee: Employee,
            company?: Company,
            monthlyData: any[]
        }>> => {
            const { data: emp } = await supabase.from('employees').select('*').eq('id', employeeId).single();
            if(!emp) return error("Employee not found");

            // Improved Company Fetching Logic
            let company;
            const { data: allCompanies } = await supabase.from('companies').select('*');
            
            if (allCompanies && allCompanies.length > 0) {
                 // 1. Exact match (case insensitive)
                 if (emp.companyName) {
                     company = allCompanies.find((c: Company) => c.name.trim().toLowerCase() === emp.companyName.trim().toLowerCase());
                 }
                 // 2. Fallback: If no company found yet and only 1 exists, use it
                 if (!company && allCompanies.length === 1) {
                     company = allCompanies[0];
                 }
                 // 3. Fallback: If still no company, just use the first one (assuming single tenant)
                 if (!company) {
                     company = allCompanies[0];
                 }
            }

            const { data: settings } = await supabase.from('app_settings').select('*').single();
            const appSettings = settings || {};

            const start = parse(startMonth, 'yyyy-MM', new Date());
            const end = parse(endMonth, 'yyyy-MM', new Date());
            
            const monthlyData = [];
            let current = start;

            while (current <= end) {
                const mStr = format(current, 'yyyy-MM');
                
                const { data: attendance } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employeeId', employeeId)
                    .like('date', `${mStr}%`);

                let { data: adj } = await supabase
                    .from('payroll_adjustments')
                    .select('*')
                    .eq('id', `${employeeId}-${mStr}`)
                    .single();
                
                if (!adj) adj = { id: `${employeeId}-${mStr}`, transport: 0, other: 0, housing: 0, advance: 0 };

                const payroll = calculateMonthlyPayroll(emp, mStr, attendance as AttendanceRecord[] || [], adj as PayrollAdjustments, appSettings);

                const monthDate = parse(mStr, 'yyyy-MM', new Date());
                const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });
                 
                const dailyRecords = days.map(day => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    return {
                        date: dateStr,
                        dayName: format(day, 'EEEE'),
                        record: attendance?.find((r:any) => r.date === dateStr)
                    };
                });
                
                monthlyData.push({
                    month: mStr,
                    payroll,
                    dailyRecords,
                    dailyRate: 0,
                    attachedImage: adj?.attachedImage
                });
                
                current = addMonths(current, 1);
            }

            return success({ employee: emp, company, monthlyData });
        }
    },

    // --- EXPENSES MODULE ---
    expenses: {
        getLogs: async (filter: ExpenseFilter): Promise<ApiResponse<SiteLogRecord[]>> => {
            let query = supabase.from('site_logs').select('*');

            if (filter.startDate) query = query.gte('date', filter.startDate);
            if (filter.endDate) query = query.lte('date', filter.endDate);
            if (filter.siteName && filter.siteName !== 'All') query = query.eq('siteName', filter.siteName);
            
            const { data, error: err } = await query.order('date', { ascending: false });
            if (err) return error(err.message);

            let logs = data as SiteLogRecord[];
            if (filter.search) {
                const term = filter.search.toLowerCase();
                logs = logs.filter(l => l.siteName.toLowerCase().includes(term) || l.remarks?.toLowerCase().includes(term));
            }
            return success(logs);
        },

        getSummary: async (filter: ExpenseFilter): Promise<ApiResponse<ExpenseSummary>> => {
            const { data: logs } = await api.expenses.getLogs(filter);
            const records = logs || [];

            const totalManpowerCost = records.reduce((s, l) => s + (l.manpowerCost || 0), 0);
            const totalPremixCost = records.reduce((s, l) => s + (l.premixCost || 0), 0);
            const totalPremixTon = records.reduce((s, l) => s + (l.premixTon || 0), 0);
            const totalDieselCost = records.reduce((s, l) => s + (l.dieselCost || 0), 0);
            const totalMaterialBuy = records.reduce((s, l) => s + (l.materialBuy || 0), 0);
            const grandTotal = totalManpowerCost + totalPremixCost + totalDieselCost + totalMaterialBuy;

            let projectBudget = 0;
            if (filter.siteName && filter.siteName !== 'All') {
                const { data: budget } = await supabase.from('project_budgets').select('budgetAmount').eq('siteName', filter.siteName).single();
                if (budget) projectBudget = budget.budgetAmount;
            }

            return success({
                totalManpowerCost, totalPremixCost, totalPremixTon, totalDieselCost,
                totalMaterialBuy, grandTotal, projectBudget,
                balance: projectBudget - grandTotal
            });
        },

        saveBudget: async (siteName: string, amount: number): Promise<ApiResponse<boolean>> => {
            await supabase.from('project_budgets').upsert({ siteName, budgetAmount: amount });
            return success(true);
        },

        createLog: async (log: SiteLogRecord): Promise<ApiResponse<SiteLogRecord>> => {
            const { data, error: err } = await supabase.from('site_logs').upsert(log).select().single();
            if (err) return error(err.message);
            return success(data as SiteLogRecord);
        },
        deleteLog: async (id: string): Promise<ApiResponse<boolean>> => {
            await supabase.from('site_logs').delete().eq('id', id);
            return success(true);
        }
    },
    
    // --- COMPANIES MODULE ---
    companies: {
        getAll: async (): Promise<ApiResponse<Company[]>> => {
            const { data } = await supabase.from('companies').select('*');
            return success(data as Company[]);
        },
        save: async (company: Company): Promise<ApiResponse<Company>> => {
            const { data, error: err } = await supabase.from('companies').upsert(company).select().single();
            if (err) return error(err.message);
            return success(data as Company);
        },
        delete: async (id: string): Promise<ApiResponse<boolean>> => {
            await supabase.from('companies').delete().eq('id', id);
            return success(true);
        }
    },

    // --- DOCUMENTS MODULE ---
    documents: {
        getAll: async (workerId?: string): Promise<ApiResponse<WorkerDocument[]>> => {
            let query = supabase.from('worker_documents').select('*');
            if (workerId) query = query.eq('workerId', workerId);
            const { data } = await query;
            return success(data as WorkerDocument[]);
        },
        save: async (doc: WorkerDocument): Promise<ApiResponse<WorkerDocument>> => {
            const { data, error: err } = await supabase.from('worker_documents').insert(doc).select().single();
            if (err) return error(err.message);
            return success(data as WorkerDocument);
        },
        delete: async (id: string): Promise<ApiResponse<boolean>> => {
            await supabase.from('worker_documents').delete().eq('id', id);
            return success(true);
        }
    },

    // --- SETTINGS ---
    settings: {
        get: async (): Promise<ApiResponse<AppSettings>> => {
            const { data } = await supabase.from('app_settings').select('*').single();
            return success(data || {});
        },
        update: async (settings: AppSettings): Promise<ApiResponse<AppSettings>> => {
            const { data, error: err } = await supabase.from('app_settings').upsert({ id: 1, ...settings }).select().single();
            if(err) return error(err.message);
            return success(data as AppSettings);
        }
    }
};