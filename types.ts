

export enum SalaryType {
  DAILY = 'Daily',
  MONTHLY = 'Monthly'
}

export enum AttendanceStatus {
  PRESENT = 'Present',
  ABSENT = 'Absent',
  LEAVE = 'Leave',
  MC = 'MC' // Medical Leave
}

export enum DocumentType {
  PASSPORT = 'Passport',
  WORK_PERMIT = 'Work Permit',
  COURSE_CERT = 'Course Certificate',
  MACHINERY_CERT = 'Machinery Certificate',
  PAYSLIP = 'Payslip',
  OTHER = 'Other'
}

// --- API RESPONSE WRAPPERS ---
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    page: number;
    limit: number;
}

// --- FILTERS ---
export interface ExpenseFilter {
    startDate?: string;
    endDate?: string;
    siteName?: string;
    search?: string;
}

export interface ExpenseSummary {
    totalManpowerCost: number;
    totalPremixCost: number;
    totalPremixTon: number;
    totalDieselCost: number;
    totalMaterialBuy: number;
    grandTotal: number;
    projectBudget: number;
    balance: number;
}

export interface DashboardStats {
    totalEmployees: number;
    presentToday: number;
    absentToday: number;
    onLeaveToday: number;
    totalOtHoursToday: number;
    chartData: { day: string; hours: number }[];
    alerts: AlertItem[];
}

export interface AlertItem {
    id: string; 
    name: string;
    type: string; 
    expiryDate: string;
    daysLeft: number;
    severity: 'high' | 'medium'; 
}

// --- ENTITIES ---

export interface WorkerDocument {
  id: string;
  workerId: string;
  name: string; // Filename
  type: DocumentType | string;
  uploadDate: string; // ISO String
  expiryDate?: string; // YYYY-MM-DD
  fileData: string; // Base64 (In real API this might be a URL)
  fileType: string; // MIME type
  size: number; // Bytes
}

export interface OfficeDocument {
  id: string;
  name: string;
  category: string;
  uploadDate: string;
  documentDate?: string; // YYYY-MM-DD - The actual date of the document
  fileData: string; // Base64
  fileType: string;
  size: number;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  logo?: string; // Base64
  stamp?: string; // Base64
  signature?: string; // Base64
}

export interface Course {
  id: string;
  name: string;
  expiryDate: string; // YYYY-MM-DD
  status?: 'Valid' | 'Expired' | 'Expiring Soon';
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  fin: string; // Foreign Identification Number
  companyName: string; // Linked to Company Settings
  position: string;
  salaryType: SalaryType;
  basicSalary: number; // Monthly amount or Daily rate
  joinDate: string;
  workPermitExpiry: string;
  
  // Status Management
  status: 'Active' | 'Cancelled';
  cancellationDate?: string;

  // New Fields
  dob?: string;
  nationality?: string;
  gender?: 'Male' | 'Female';
  sector?: string; // e.g. Construction, PCM, Marine
  passportNo?: string;
  passportExpiry: string;
  photoUrl?: string; // Placeholder
  
  // Export Requirements
  mobileNumber?: string;
  countryOfBirth?: string;
  passType?: 'SG' | 'SPR' | 'WP' | 'SP';
  wpNumber?: string; // Sometimes different from FIN
  reoExpiry?: string; // REO Expiry Date

  courses?: Course[];
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  otHours: number;
  lunchHours: number;
  workDay: number; // 1 for full day, 0 for absent (Calculated automatically)
  siteLocation: string;
  remarks: string; // MC, Leave, etc.
  calculatedDailyPay: number; // Base + OT
}

export interface PayrollRecord {
  employeeId: string;
  month: string; // YYYY-MM
  totalDaysWorked: number;
  totalOtHours: number;
  totalLunchHours: number;
  mcDays: number;
  offDays: number;
  basicPayTotal: number;
  holidayPayTotal: number; // Sunday work
  totalHolidayDays: number; // Count of Sundays/Holidays worked
  otPayTotal: number;
  lunchAllowanceTotal: number; // $1 per hour
  
  // Manual Adjustments
  transportAllowance: number;
  otherAllowances: number;
  housingDeduction: number;
  advanceDeduction: number;

  deductions: number; // General deductions (sum of above usually)
  netSalary: number;
}

export interface PayrollAdjustments {
  id: string; // Format: employeeId-YYYY-MM
  transport: number;
  other: number;
  housing: number;
  advance: number;
  attachedImage?: string; // Base64 string for manual time card
}

export interface PayrollHistoryLog {
  id: string;
  adjustmentId: string; // Links to PayrollAdjustments.id
  timestamp: string; // ISO string
  adminName: string; // Who made the change
  changes: string[]; // List of change descriptions
}

export interface SiteLogRecord {
  id: string;
  date: string; // YYYY-MM-DD
  siteName: string; // e.g. Lentor, Bukit Batok
  
  // Manpower
  paxGw: number; // GW
  paxReo: number; // REO/RES
  
  // Time
  startTime: string;
  endTime: string;
  totalHours: number;
  
  // Manpower Costing
  hourlyRate?: number; // Cost per hour (e.g. 14)
  manpowerCost?: number; // Calculated: (Gw + Reo) * hours * rate

  // Materials & Machinery
  diesel: string; // Details like liters
  dieselCost?: number; // Cost for summation
  
  premixTon: number;
  premixCost: number;
  gradedStone: string; // Cement / Graded Stone
  soilThrow: string; // Soil Out
  
  materialBuy: number; // Material Buy Cost
  remarks: string;
}

export interface ProjectBudget {
    siteName: string;
    budgetAmount: number;
}

export interface AppSettings {
  companyLogo?: string; // Base64
  companyStamp?: string; // Base64
  authorizedSignature?: string; // Base64
  companyName?: string;
  companyAddress?: string;
  
  // New Holiday Settings
  holidayPayMultiplier?: number; // 1.5 or 2.0
  publicHolidays?: Holiday[];
}

export interface AdminProfile {
    email: string;
    password: string; // In real app, this would be hashed
    name: string;
}

export interface OTPRecord {
    email: string;
    code: string;
    expiresAt: number; // Timestamp
}

export const WORK_HOURS_START = "08:00";
export const WORK_HOURS_END_DAILY = "17:00"; // 5 PM
export const OT_START_FIXED = "19:00"; // 7 PM