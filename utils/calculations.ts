import { Employee, SalaryType, WORK_HOURS_END_DAILY, OT_START_FIXED, PayrollRecord, AttendanceRecord, PayrollAdjustments, AppSettings } from '../types';
import { WORKING_DAYS_PER_MONTH, HOURS_PER_DAY, OT_MULTIPLIER } from '../constants';
import { differenceInMinutes, format, endOfMonth, eachDayOfInterval, isSunday, parse, startOfMonth, parseISO } from 'date-fns';

/**
 * Calculates OT Hours based on employee type and checkout time.
 */
export const calculateOtHours = (
  salaryType: SalaryType,
  endTime: string // HH:mm
): number => {
  if (!endTime) return 0;

  const today = new Date();
  const dateStr = format(today, 'yyyy-MM-dd');
  
  const thresholdTimeStr = salaryType === SalaryType.DAILY ? WORK_HOURS_END_DAILY : OT_START_FIXED;
  
  const outTimeDate = parse(`${dateStr} ${endTime}`, 'yyyy-MM-dd HH:mm', new Date());
  const thresholdDate = parse(`${dateStr} ${thresholdTimeStr}`, 'yyyy-MM-dd HH:mm', new Date());

  if (outTimeDate <= thresholdDate) {
    return 0;
  }

  const diffMinutes = differenceInMinutes(outTimeDate, thresholdDate);
  const hours = diffMinutes / 60;
  
  return parseFloat(hours.toFixed(2));
};

/**
 * Calculates OT Pay Amount based on the formulas provided.
 */
export const calculateOtPay = (
  employee: Employee,
  otHours: number
): number => {
  if (otHours <= 0) return 0;

  let hourlyRate = 0;

  if (employee.salaryType === SalaryType.DAILY) {
    // Formula: (Per Day Salary / 8) * 1.5 * OT Hours
    hourlyRate = (employee.basicSalary / 8);
  } else {
    // Formula: (Monthly Salary / (26 * 8)) * 1.5 * OT Hours
    hourlyRate = (employee.basicSalary / (WORKING_DAYS_PER_MONTH * HOURS_PER_DAY));
  }

  return parseFloat((hourlyRate * OT_MULTIPLIER * otHours).toFixed(2));
};

/**
 * Returns the number of working days in a month (excluding Sundays).
 */
export const getWorkingDaysInMonth = (date: Date): number => {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const days = eachDayOfInterval({ start, end });
    return days.filter(day => !isSunday(day)).length;
};

/**
 * Calculates daily earning (Base + OT) for display in attendance logs
 */
export const calculateDailyTotal = (
    employee: Employee,
    otHours: number,
    workDay: number,
    date: Date,
    settings: AppSettings
): number => {
    // Determine Daily Rate
    let dailyRate = 0;
    
    if (employee.salaryType === SalaryType.DAILY) {
        dailyRate = employee.basicSalary;
    } else {
        // For monthly, calculate rate based on this month's working days
        const workingDays = getWorkingDaysInMonth(date);
        dailyRate = workingDays > 0 ? (employee.basicSalary / workingDays) : 0;
    }
    
    const multiplier = settings.holidayPayMultiplier || 1.5;
    const holidays = settings.publicHolidays || [];
    
    // Check for Sunday OR Public Holiday
    let basePayMultiplier = 1;
    const dateStr = format(date, 'yyyy-MM-dd');
    const isPublicHoliday = holidays.some(h => h.date === dateStr);
    
    if (isSunday(date) || isPublicHoliday) {
        basePayMultiplier = multiplier;
    }

    const basePay = (dailyRate * workDay) * basePayMultiplier;
    const otPay = calculateOtPay(employee, otHours);

    return parseFloat((basePay + otPay).toFixed(2));
};

/**
 * Calculates Full Monthly Payroll Record
 */
export const calculateMonthlyPayroll = (
    employee: Employee, 
    monthStr: string,
    attendanceRecords: AttendanceRecord[],
    adjustments: PayrollAdjustments,
    settings: AppSettings
): PayrollRecord => {
    const monthDate = parse(monthStr, 'yyyy-MM', new Date());
    const totalWorkingDaysInMonth = getWorkingDaysInMonth(monthDate);

    // Filter attendance for this employee and month
    const empAttendance = attendanceRecords.filter(r => 
        r.employeeId === employee.id && 
        r.date.startsWith(monthStr)
    );

    const totalDaysWorked = empAttendance.reduce((acc, curr) => acc + (curr.workDay || 0), 0);
    const totalOtHours = empAttendance.reduce((acc, curr) => acc + (curr.otHours || 0), 0);
    const totalLunchHours = empAttendance.reduce((acc, curr) => acc + (curr.lunchHours || 0), 0);
    const mcDays = empAttendance.filter(r => r.remarks === 'MC').length;
    const offDays = empAttendance.filter(r => r.remarks === 'OFF').length;

    let dailyRate = 0;
    if (employee.salaryType === SalaryType.MONTHLY) {
        dailyRate = totalWorkingDaysInMonth > 0 ? (employee.basicSalary / totalWorkingDaysInMonth) : 0;
    } else {
        dailyRate = employee.basicSalary;
    }

    // Settings for Multiplier
    const multiplier = settings.holidayPayMultiplier || 1.5;
    const holidays = settings.publicHolidays || [];

    let basicPayTotal = 0;
    let holidayPayTotal = 0;
    let totalHolidayDays = 0;

    empAttendance.forEach(record => {
        const recordDate = parseISO(record.date);
        const dayPay = dailyRate * (record.workDay || 0);

        const isPublicHoliday = holidays.some(h => h.date === record.date);

        if ((isSunday(recordDate) || isPublicHoliday) && record.workDay > 0) {
            // Holiday/Sunday Pay = Multiplier * Day Rate
            holidayPayTotal += (dayPay * multiplier);
            totalHolidayDays += record.workDay;
        } else {
            // Normal Day
            basicPayTotal += dayPay;
        }
    });

    const otPayTotal = calculateOtPay(employee, totalOtHours);
    const lunchAllowanceTotal = totalLunchHours * 1.0;
    const totalManualAllowances = (adjustments.transport || 0) + (adjustments.other || 0);
    const totalDeductions = (adjustments.housing || 0) + (adjustments.advance || 0);
    
    const netSalary = basicPayTotal + holidayPayTotal + otPayTotal + lunchAllowanceTotal + totalManualAllowances - totalDeductions;

    return {
        employeeId: employee.id,
        month: monthStr,
        totalDaysWorked,
        totalOtHours,
        totalLunchHours,
        mcDays,
        offDays,
        basicPayTotal,
        holidayPayTotal, // Sunday + Public Holiday Pay
        totalHolidayDays, // Count of holidays worked
        otPayTotal,
        lunchAllowanceTotal, 
        deductions: totalDeductions,
        transportAllowance: adjustments.transport,
        otherAllowances: adjustments.other,
        housingDeduction: adjustments.housing,
        advanceDeduction: adjustments.advance,
        netSalary
    };
};

/**
 * Formats a 24-hour time string (HH:mm) to 12-hour format (hh:mm AM/PM)
 */
export const formatTime12Hour = (time24: string | undefined | null): string => {
    if (!time24) return '';
    const parts = time24.split(':');
    if (parts.length < 2) return time24;
    
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    
    return `${hours}:${minutes} ${ampm}`;
};