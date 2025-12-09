import { Employee, AttendanceRecord, SalaryType, AttendanceStatus, PayrollAdjustments, Company, AppSettings, Holiday, WorkerDocument, AdminProfile, OTPRecord, PayrollHistoryLog, SiteLogRecord, ProjectBudget } from '../types';

const STORAGE_KEYS = {
  EMPLOYEES: 'hr_employees',
  ATTENDANCE: 'hr_attendance',
  SETTINGS: 'hr_settings', 
  COMPANIES: 'hr_companies',
  ADJUSTMENTS: 'hr_payroll_adjustments',
  HISTORY: 'hr_payroll_history',
  DOCUMENTS: 'hr_worker_documents',
  ADMIN: 'hr_admin_profile',
  OTP: 'hr_otp_record',
  SITE_LOGS: 'hr_site_logs',
  PROJECT_BUDGETS: 'hr_project_budgets',
  HIDDEN_NOTIFICATIONS: 'hr_hidden_notifications'
};

// Default Admin
const DEFAULT_ADMIN: AdminProfile = {
    email: 'admin@qualityme.sg',
    password: 'admin123',
    name: 'Admin User'
};

// Default Singapore Public Holidays 2024-2025
const DEFAULT_HOLIDAYS: Holiday[] = [
    // 2024
    { id: 'h1', date: '2024-01-01', name: "New Year's Day" },
    { id: 'h2', date: '2024-02-10', name: "Chinese New Year" },
    { id: 'h3', date: '2024-02-11', name: "Chinese New Year" },
    { id: 'h4', date: '2024-03-29', name: "Good Friday" },
    { id: 'h5', date: '2024-04-10', name: "Hari Raya Puasa" },
    { id: 'h6', date: '2024-05-01', name: "Labour Day" },
    { id: 'h7', date: '2024-05-22', name: "Vesak Day" },
    { id: 'h8', date: '2024-06-17', name: "Hari Raya Haji" },
    { id: 'h9', date: '2024-08-09', name: "National Day" },
    { id: 'h10', date: '2024-10-31', name: "Deepavali" },
    { id: 'h11', date: '2024-12-25', name: "Christmas Day" },
    
    // 2025
    { id: 'h12', date: '2025-01-01', name: "New Year's Day" },
    { id: 'h13', date: '2025-01-29', name: "Chinese New Year" },
    { id: 'h14', date: '2025-01-30', name: "Chinese New Year" },
    { id: 'h15', date: '2025-03-31', name: "Hari Raya Puasa" },
    { id: 'h16', date: '2025-04-18', name: "Good Friday" },
    { id: 'h17', date: '2025-05-01', name: "Labour Day" },
    { id: 'h18', date: '2025-05-12', name: "Vesak Day" },
    { id: 'h19', date: '2025-06-07', name: "Hari Raya Haji" },
    { id: 'h20', date: '2025-08-09', name: "National Day" },
    { id: 'h21', date: '2025-10-20', name: "Deepavali" },
    { id: 'h22', date: '2025-12-25', name: "Christmas Day" },
];

// Seed Data
const MOCK_EMPLOYEES: Employee[] = [
  {
    id: '1',
    name: 'Tan Wei Ming',
    fin: 'S1234567A',
    wpNumber: 'S1234567A',
    companyName: 'QUALITY M&E PTE LTD',
    position: 'Site Supervisor',
    salaryType: SalaryType.MONTHLY,
    basicSalary: 3200,
    joinDate: '2022-01-15',
    workPermitExpiry: '2025-06-20',
    passportExpiry: '2026-01-01',
    nationality: 'Singaporean',
    countryOfBirth: 'Singapore',
    dob: '1985-05-12',
    gender: 'Male',
    sector: 'Construction',
    mobileNumber: '91234567',
    passType: 'SG',
    reoExpiry: '2025-12-31',
    status: 'Active',
    courses: [
        { id: 'c1', name: 'Building Safety Supervisor', expiryDate: '2025-01-01', status: 'Valid' },
        { id: 'c2', name: 'Supervise Lifting Operation', expiryDate: '2025-08-15', status: 'Valid' }
    ]
  },
  {
    id: '2',
    name: 'Raju Kumar',
    fin: 'G8765432M',
    wpNumber: 'G8765432M',
    companyName: 'QUALITY M&E PTE LTD',
    position: 'General Worker',
    salaryType: SalaryType.DAILY,
    basicSalary: 80,
    joinDate: '2023-03-10',
    workPermitExpiry: '2024-12-01', // Expiring soon
    passportExpiry: '2025-05-15',
    nationality: 'Indian',
    countryOfBirth: 'India',
    dob: '1990-08-20',
    gender: 'Male',
    sector: 'PCM',
    mobileNumber: '88776655',
    passType: 'WP',
    status: 'Active',
    courses: [
        { id: 'c3', name: 'Safety Course', expiryDate: '2024-11-20', status: 'Expiring Soon' }
    ]
  },
];

export const StorageService = {
  // --- ADMIN MANAGEMENT ---
  getAdminProfile: (): AdminProfile => {
      const data = localStorage.getItem(STORAGE_KEYS.ADMIN);
      if (data) return JSON.parse(data);
      // Initialize default if not exists
      localStorage.setItem(STORAGE_KEYS.ADMIN, JSON.stringify(DEFAULT_ADMIN));
      return DEFAULT_ADMIN;
  },

  saveAdminProfile: (profile: AdminProfile) => {
    localStorage.setItem(STORAGE_KEYS.ADMIN, JSON.stringify(profile));
  },

  verifyLogin: (password: string): boolean => {
      const admin = StorageService.getAdminProfile();
      return admin.password === password;
  },

  updateAdminPassword: (newPassword: string) => {
      const admin = StorageService.getAdminProfile();
      admin.password = newPassword;
      localStorage.setItem(STORAGE_KEYS.ADMIN, JSON.stringify(admin));
  },

  // --- OTP LOGIC ---
  initiatePasswordReset: (email: string): { success: boolean, message: string, code?: string } => {
      const admin = StorageService.getAdminProfile();
      
      if (admin.email.toLowerCase() !== email.toLowerCase()) {
          return { success: false, message: 'Email address not found.' };
      }

      // Generate 6-digit OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes from now

      const record: OTPRecord = { email, code: otpCode, expiresAt };
      localStorage.setItem(STORAGE_KEYS.OTP, JSON.stringify(record));

      // We return the code so the API service can send it via EmailJS
      return { success: true, message: 'OTP Generated', code: otpCode };
  },

  verifyOTP: (code: string): boolean => {
      const data = localStorage.getItem(STORAGE_KEYS.OTP);
      if (!data) return false;

      const record: OTPRecord = JSON.parse(data);
      if (Date.now() > record.expiresAt) {
          return false; // Expired
      }
      
      if (record.code === code) {
          // Consume OTP (delete it) so it can't be reused
          localStorage.removeItem(STORAGE_KEYS.OTP);
          return true;
      }
      return false;
  },

  // --- EMPLOYEE MANAGEMENT ---
  getEmployees: (): Employee[] => {
    const data = localStorage.getItem(STORAGE_KEYS.EMPLOYEES);
    return data ? JSON.parse(data) : MOCK_EMPLOYEES;
  },

  saveEmployee: (employee: Employee) => {
    const employees = StorageService.getEmployees();
    const existingIndex = employees.findIndex(e => e.id === employee.id);
    
    if (existingIndex >= 0) {
      employees[existingIndex] = employee;
    } else {
      employees.push(employee);
    }
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  },

  deleteEmployee: (id: string) => {
    const employees = StorageService.getEmployees().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EMPLOYEES, JSON.stringify(employees));
  },

  getAttendance: (date?: string): AttendanceRecord[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    const allRecords: AttendanceRecord[] = data ? JSON.parse(data) : [];
    if (date) {
      return allRecords.filter(r => r.date === date);
    }
    return allRecords;
  },

  saveAttendance: (record: AttendanceRecord) => {
    const allRecords = StorageService.getAttendance();
    const existingIndex = allRecords.findIndex(r => r.employeeId === record.employeeId && r.date === record.date);

    if (existingIndex >= 0) {
      allRecords[existingIndex] = record;
    } else {
      allRecords.push(record);
    }
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(allRecords));
  },
  
  // Helper to bulk init attendance for a day if not exists
  initDailyAttendance: (date: string) => {
    const employees = StorageService.getEmployees();
    const attendance = StorageService.getAttendance(date);
    
    // Only init for ACTIVE employees
    const activeEmployees = employees.filter(e => e.status !== 'Cancelled');
    
    if (attendance.length === 0 && activeEmployees.length > 0) {
        activeEmployees.forEach(emp => {
            StorageService.saveAttendance({
                id: `${date}-${emp.id}`,
                employeeId: emp.id,
                date: date,
                status: AttendanceStatus.ABSENT, // Default to Absent
                startTime: '', // Empty start time
                endTime: '', // Empty end time
                otHours: 0,
                lunchHours: 0, // Default 0 hour lunch
                workDay: 0,
                siteLocation: '',
                remarks: '',
                calculatedDailyPay: 0
            });
        });
    }
  },

  // Settings for Payslip Images and Holiday Pay
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const settings: AppSettings = data ? JSON.parse(data) : {};
    
    // Default values if not set
    if (settings.holidayPayMultiplier === undefined) {
        settings.holidayPayMultiplier = 1.5;
    }
    if (settings.publicHolidays === undefined) {
        settings.publicHolidays = DEFAULT_HOLIDAYS;
    }
    
    return settings;
  },

  saveSettings: (settings: AppSettings) => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  },

  resetDefaultHolidays: () => {
    const settings = StorageService.getSettings();
    settings.publicHolidays = DEFAULT_HOLIDAYS;
    StorageService.saveSettings(settings);
    return settings;
  },

  // COMPANY MANAGEMENT
  getCompanies: (): Company[] => {
    const data = localStorage.getItem(STORAGE_KEYS.COMPANIES);
    if (data) return JSON.parse(data);
    
    // Default migration if empty: try to use global settings as a company
    const globalSettings = StorageService.getSettings();
    if (globalSettings.companyName) {
        const defaultCompany: Company = {
            id: 'default_1',
            name: globalSettings.companyName,
            address: globalSettings.companyAddress || '',
            logo: globalSettings.companyLogo,
            stamp: globalSettings.companyStamp,
            signature: globalSettings.authorizedSignature
        };
        StorageService.saveCompany(defaultCompany);
        return [defaultCompany];
    }
    return [];
  },

  getCompanyByName: (name: string): Company | undefined => {
    const companies = StorageService.getCompanies();
    // Case-insensitive match for better UX
    return companies.find(c => c.name.toLowerCase().trim() === name.toLowerCase().trim());
  },

  saveCompany: (company: Company) => {
    const companies = StorageService.getCompanies();
    const index = companies.findIndex(c => c.id === company.id);
    if (index >= 0) {
        companies[index] = company;
    } else {
        companies.push(company);
    }
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  },

  deleteCompany: (id: string) => {
    const companies = StorageService.getCompanies().filter(c => c.id !== id);
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(companies));
  },

  // Payroll Adjustments (Transport, Housing, etc)
  getPayrollAdjustments: (employeeId: string, month: string): PayrollAdjustments => {
    const data = localStorage.getItem(STORAGE_KEYS.ADJUSTMENTS);
    const allAdj: PayrollAdjustments[] = data ? JSON.parse(data) : [];
    const id = `${employeeId}-${month}`;
    return allAdj.find(a => a.id === id) || { id, transport: 0, other: 0, housing: 0, advance: 0 };
  },

  savePayrollAdjustments: (adj: PayrollAdjustments) => {
    const data = localStorage.getItem(STORAGE_KEYS.ADJUSTMENTS);
    const allAdj: PayrollAdjustments[] = data ? JSON.parse(data) : [];
    const index = allAdj.findIndex(a => a.id === adj.id);
    if (index >= 0) {
        allAdj[index] = adj;
    } else {
        allAdj.push(adj);
    }
    localStorage.setItem(STORAGE_KEYS.ADJUSTMENTS, JSON.stringify(allAdj));
  },

  // Payroll History Logs
  getPayrollHistoryLogs: (adjustmentId: string): PayrollHistoryLog[] => {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const allLogs: PayrollHistoryLog[] = data ? JSON.parse(data) : [];
      return allLogs.filter(log => log.adjustmentId === adjustmentId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  savePayrollHistoryLog: (log: PayrollHistoryLog) => {
      const data = localStorage.getItem(STORAGE_KEYS.HISTORY);
      const allLogs: PayrollHistoryLog[] = data ? JSON.parse(data) : [];
      allLogs.push(log);
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(allLogs));
  },

  // Worker Documents
  getDocuments: (workerId?: string): WorkerDocument[] => {
    const data = localStorage.getItem(STORAGE_KEYS.DOCUMENTS);
    const allDocs: WorkerDocument[] = data ? JSON.parse(data) : [];
    if (workerId) {
        return allDocs.filter(d => d.workerId === workerId);
    }
    return allDocs;
  },

  saveDocument: (doc: WorkerDocument) => {
    const docs = StorageService.getDocuments();
    docs.push(doc);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  },

  deleteDocument: (id: string) => {
    const docs = StorageService.getDocuments().filter(d => d.id !== id);
    localStorage.setItem(STORAGE_KEYS.DOCUMENTS, JSON.stringify(docs));
  },

  // --- SITE LOGS MANAGEMENT (Replaces generic expenses) ---
  getSiteLogs: (): SiteLogRecord[] => {
      const data = localStorage.getItem(STORAGE_KEYS.SITE_LOGS);
      return data ? JSON.parse(data) : [];
  },

  saveSiteLog: (log: SiteLogRecord) => {
      const logs = StorageService.getSiteLogs();
      const index = logs.findIndex(e => e.id === log.id);
      if (index >= 0) {
          logs[index] = log;
      } else {
          logs.push(log);
      }
      localStorage.setItem(STORAGE_KEYS.SITE_LOGS, JSON.stringify(logs));
  },

  deleteSiteLog: (id: string) => {
      const logs = StorageService.getSiteLogs().filter(e => e.id !== id);
      localStorage.setItem(STORAGE_KEYS.SITE_LOGS, JSON.stringify(logs));
  },

  // --- PROJECT BUDGETS MANAGEMENT ---
  getProjectBudgets: (): ProjectBudget[] => {
      const data = localStorage.getItem(STORAGE_KEYS.PROJECT_BUDGETS);
      return data ? JSON.parse(data) : [];
  },

  getProjectBudget: (siteName: string): number => {
      const budgets = StorageService.getProjectBudgets();
      const budget = budgets.find(b => b.siteName === siteName);
      return budget ? budget.budgetAmount : 0;
  },

  saveProjectBudget: (siteName: string, amount: number) => {
      const budgets = StorageService.getProjectBudgets();
      const index = budgets.findIndex(b => b.siteName === siteName);
      if (index >= 0) {
          budgets[index].budgetAmount = amount;
      } else {
          budgets.push({ siteName, budgetAmount: amount });
      }
      localStorage.setItem(STORAGE_KEYS.PROJECT_BUDGETS, JSON.stringify(budgets));
  },

  // --- NOTIFICATION MANAGEMENT ---
  getHiddenNotificationIds: (): string[] => {
    const data = localStorage.getItem(STORAGE_KEYS.HIDDEN_NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  },

  hideNotification: (id: string) => {
    const ids = StorageService.getHiddenNotificationIds();
    if (!ids.includes(id)) {
        ids.push(id);
        localStorage.setItem(STORAGE_KEYS.HIDDEN_NOTIFICATIONS, JSON.stringify(ids));
    }
  },

  hideAllNotifications: (ids: string[]) => {
    const currentHidden = StorageService.getHiddenNotificationIds();
    // Merge new IDs ensuring uniqueness
    const newHidden = Array.from(new Set([...currentHidden, ...ids]));
    localStorage.setItem(STORAGE_KEYS.HIDDEN_NOTIFICATIONS, JSON.stringify(newHidden));
  }
};