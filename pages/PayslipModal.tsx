import React, { useEffect, useState, useRef } from 'react';
import { Employee, PayrollRecord, AttendanceRecord, SalaryType, Company } from '../types';
import { StorageService } from '../services/storage';
import { X, Download } from 'lucide-react';
import { eachDayOfInterval, endOfMonth, format, addMonths } from 'date-fns';
import subMonths from 'date-fns/subMonths';
import setDate from 'date-fns/setDate';
import startOfMonth from 'date-fns/startOfMonth';
import parse from 'date-fns/parse';
import { getWorkingDaysInMonth, calculateMonthlyPayroll } from '../utils/calculations';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
    employee: Employee;
    data: PayrollRecord;
    onClose: () => void;
}

interface MonthlyData {
    month: string;
    payroll: PayrollRecord;
    dailyRecords: {date: string, dayName: string, record?: AttendanceRecord}[];
    dailyRate: number;
    attachedImage?: string;
}

const PayslipModal: React.FC<Props> = ({ employee, data: initialData, onClose }) => {
  const [company, setCompany] = useState<Company | undefined>(undefined);
  
  const [startMonth, setStartMonth] = useState(initialData.month);
  const [endMonth, setEndMonth] = useState(initialData.month);
  
  // View Mode: Controls what is seen on screen
  const [viewMode, setViewMode] = useState<'full' | 'payslip' | 'timecard'>('full');
  
  const [monthlyDataList, setMonthlyDataList] = useState<MonthlyData[]>([]);
  const payslipContainerRef = useRef<HTMLDivElement>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    const companies = StorageService.getCompanies();
    let found;
    
    // 1. Try exact match (case-insensitive)
    if (employee.companyName) {
        found = companies.find(c => c.name.toLowerCase().trim() === employee.companyName.toLowerCase().trim());
    }
    
    // 2. Fallback: If no company found yet and only 1 exists, use it
    if (!found && companies.length === 1) {
        found = companies[0];
    }
    
    // 3. Fallback: Take the first one (most common for single-tenant use)
    if (!found && companies.length > 0) {
        found = companies[0];
    }
    
    setCompany(found);
  }, [employee]);

  useEffect(() => {
    const calculateRangeData = () => {
        const start = parse(startMonth, 'yyyy-MM', new Date());
        const end = parse(endMonth, 'yyyy-MM', new Date());

        if (start > end) {
            setMonthlyDataList([]); 
            return;
        }

        const months: string[] = [];
        let current = start;
        while (current <= end) {
            months.push(format(current, 'yyyy-MM'));
            current = addMonths(current, 1);
        }

        const allAttendance = StorageService.getAttendance();
        const settings = StorageService.getSettings();

        const calculatedList: MonthlyData[] = months.map(monthStr => {
            const adjustments = StorageService.getPayrollAdjustments(employee.id, monthStr);
            const payroll = calculateMonthlyPayroll(employee, monthStr, allAttendance, adjustments, settings);
            
            const monthDate = parse(monthStr, 'yyyy-MM', new Date());
            const empAttendance = allAttendance.filter(r => 
                r.employeeId === employee.id && 
                r.date.startsWith(monthStr)
            );

            const days = eachDayOfInterval({
                start: startOfMonth(monthDate),
                end: endOfMonth(monthDate)
            });

            const dailyRecords = days.map(day => {
                const dateStr = format(day, 'yyyy-MM-dd');
                return {
                    date: dateStr,
                    dayName: format(day, 'EEEE'),
                    record: empAttendance.find(r => r.date === dateStr)
                };
            });

            const totalWorkingDaysInMonth = getWorkingDaysInMonth(monthDate);
            let dailyRate = 0;
            if (employee.salaryType === SalaryType.DAILY) {
                 dailyRate = employee.basicSalary;
            } else {
                 dailyRate = totalWorkingDaysInMonth > 0 ? (employee.basicSalary / totalWorkingDaysInMonth) : 0;
            }

            return {
                month: monthStr,
                payroll,
                dailyRecords,
                dailyRate,
                attachedImage: adjustments.attachedImage
            };
        });

        calculatedList.sort((a, b) => a.month.localeCompare(b.month));
        setMonthlyDataList(calculatedList);
    };

    calculateRangeData();
  }, [startMonth, endMonth, employee]);

  const handlePresetRange = (months: number) => {
      const end = new Date();
      const start = subMonths(end, months - 1); 
      setEndMonth(format(end, 'yyyy-MM'));
      setStartMonth(format(start, 'yyyy-MM'));
  };

  const handleDownloadPDF = async (type: 'full' | 'payslip' | 'timecard') => {
    if (!payslipContainerRef.current) return;
    setIsGenerating(true);
    
    // Small delay to allow UI state to settle if needed
    await new Promise(resolve => setTimeout(resolve, 500));

    const pdf = new jsPDF('p', 'mm', 'a4');
    const originalPages = payslipContainerRef.current.querySelectorAll('.payslip-page');
    
    // Create a hidden container for cloning
    const hiddenContainer = document.createElement('div');
    hiddenContainer.style.position = 'absolute';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.style.top = '0';
    hiddenContainer.style.width = '210mm'; 
    document.body.appendChild(hiddenContainer);

    try {
        for (let i = 0; i < originalPages.length; i++) {
            const originalPage = originalPages[i] as HTMLElement;
            const clonedPage = originalPage.cloneNode(true) as HTMLElement;
            
            // Elements
            const payslipCol = clonedPage.querySelector('.payslip-col') as HTMLElement;
            const timecardCol = clonedPage.querySelector('.timecard-col') as HTMLElement;
            const imageSection = clonedPage.querySelector('.attached-image-section') as HTMLElement;
            const netPayBox = clonedPage.querySelector('.net-pay-section') as HTMLElement;

            // 1. Reset Visibility (Ensure everything is potentially visible first)
            if (payslipCol) {
                payslipCol.classList.remove('hidden', 'w-full', 'w-[50%]');
                payslipCol.style.display = 'flex'; 
            }
            if (timecardCol) {
                timecardCol.classList.remove('hidden', 'w-full', 'w-[50%]');
                timecardCol.style.display = 'flex'; 
            }
            if (imageSection) {
                imageSection.classList.remove('hidden');
                imageSection.style.display = 'flex';
            }

            // 2. Apply Download Logic per Type
            if (type === 'payslip') {
                // Remove Time Card
                if (timecardCol) timecardCol.remove();
                // Make Payslip Full Width
                if (payslipCol) payslipCol.classList.add('w-full');
                
                // IMPORTANT: Hide Image for separate download
                if (imageSection) imageSection.remove();
                
                // Force Net Pay to bottom
                if (netPayBox) {
                    netPayBox.classList.remove('mt-4');
                    netPayBox.classList.add('mt-auto');
                }

            } else if (type === 'timecard') {
                // Remove Payslip
                if (payslipCol) payslipCol.remove();
                // Make Time Card Full Width
                if (timecardCol) timecardCol.classList.add('w-full');
            
            } else {
                // Full View: Both 50%
                if (payslipCol) payslipCol.classList.add('w-[50%]');
                if (timecardCol) timecardCol.classList.add('w-[50%]');
                
                // Handle Image Logic for "Both"
                // If image exists in DOM (it does if created), keep it visible.
                // Net Pay positioning:
                if (imageSection) {
                    // If image is present, keep Net Pay near content (mt-4) to allow image space
                    if (netPayBox) {
                        netPayBox.classList.remove('mt-auto');
                        netPayBox.classList.add('mt-4');
                    }
                } else {
                    // No image, push Net Pay to bottom
                    if (netPayBox) {
                        netPayBox.classList.remove('mt-4');
                        netPayBox.classList.add('mt-auto');
                    }
                }
            }

            hiddenContainer.appendChild(clonedPage);
            
            const canvas = await html2canvas(clonedPage, {
                scale: 2,
                logging: false,
                useCORS: true,
                windowWidth: 1200
            });
            
            const imgData = canvas.toDataURL('image/png');
            const imgWidth = 210;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
            
            hiddenContainer.removeChild(clonedPage);
        }
        
        let filenameSuffix = type === 'full' ? 'Full_Document' : type === 'payslip' ? 'Payslip' : 'TimeCard';
        pdf.save(`${filenameSuffix}_${employee.name}_${startMonth}_to_${endMonth}.pdf`);
        
    } catch (e) {
        console.error(e);
        alert("Error generating PDF");
    } finally {
        document.body.removeChild(hiddenContainer);
        setIsGenerating(false);
    }
  };

  const renderTimeCardRows = (dailyRecords: MonthlyData['dailyRecords']) => {
      const rows = [];
      for (let i = 1; i <= 31; i++) {
          const dayData = dailyRecords.find(d => parseInt(format(parse(d.date, 'yyyy-MM-dd', new Date()), 'd')) === i);
          const isSundayRow = dayData?.dayName === 'Sunday';
          
          rows.push(
              <tr key={i} className={`border-b border-black h-[23px] ${isSundayRow ? 'bg-slate-300 print:bg-slate-300' : ''}`}>
                  <td className="border-r border-black text-center font-bold">{i}</td>
                  <td className="border-r border-black text-center font-medium">
                      {dayData ? format(parse(dayData.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yy') : ''}
                  </td>
                  <td className="border-r border-black text-center font-medium uppercase">
                      {dayData ? dayData.dayName.substring(0,3) : ''}
                  </td>
                  <td className="border-r border-black text-center font-medium">
                      {dayData?.record?.startTime || ''}
                  </td>
                  <td className="border-r border-black text-center font-medium">
                      {dayData?.record?.endTime || ''}
                  </td>
                  <td className="border-r border-black text-center font-bold">
                      {dayData?.record?.otHours ? dayData.record.otHours : ''}
                  </td>
                  <td className="border-r border-black text-center font-medium">
                      {dayData?.record?.lunchHours ? dayData.record.lunchHours : ''}
                  </td>
                  <td className="px-1 text-left truncate font-medium">
                      {dayData?.record?.remarks === 'MC' ? 'MC' : 
                       dayData?.record?.remarks === 'OFF' ? 'OFF' : 
                       dayData?.record?.siteLocation}
                  </td>
              </tr>
          );
      }
      return rows;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex flex-col items-center justify-start overflow-y-auto print:bg-white print:overflow-visible print:absolute print:inset-0">
       
       {/* CONTROLS HEADER */}
       <div className="w-full max-w-7xl bg-white m-4 p-4 rounded-2xl shadow-2xl flex flex-col gap-4 print:hidden shrink-0 z-50 border border-slate-200">
           <div className="flex flex-col lg:flex-row justify-between items-center gap-4">
               {/* Left: Info */}
               <div className="flex items-center gap-4">
                  <div>
                      <h3 className="font-bold text-slate-900 text-lg">Payslip Generator</h3>
                      <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs font-bold text-slate-500 uppercase bg-slate-100 px-2 py-0.5 rounded">{employee.name}</span>
                      </div>
                  </div>
               </div>

               {/* Center: Date Selection */}
               <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-200 shadow-inner">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                        <input 
                            type="month" 
                            value={startMonth}
                            onChange={(e) => setStartMonth(e.target.value)}
                            className="bg-transparent text-slate-900 text-xs font-bold outline-none cursor-pointer"
                        />
                    </div>
                    <div className="w-4 h-[2px] bg-slate-300 rounded-full"></div>
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                        <input 
                            type="month" 
                            value={endMonth}
                            onChange={(e) => setEndMonth(e.target.value)}
                            className="bg-transparent text-slate-900 text-xs font-bold outline-none cursor-pointer"
                        />
                    </div>
                    <div className="w-px h-6 bg-slate-300 mx-2"></div>
                    <button onClick={() => handlePresetRange(6)} className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-xs font-bold rounded-lg text-slate-600 transition shadow-sm">6 Months</button>
                    <button onClick={() => handlePresetRange(12)} className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-xs font-bold rounded-lg text-slate-600 transition shadow-sm">1 Year</button>
               </div>

               {/* Right: View Toggles */}
               <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button 
                        onClick={() => setViewMode('payslip')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'payslip' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                    >
                         Payslip
                    </button>
                    <button 
                        onClick={() => setViewMode('timecard')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'timecard' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}
                    >
                         Time Card
                    </button>
                    <button 
                        onClick={() => setViewMode('full')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'full' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                    >
                         Full
                    </button>
               </div>
           </div>

           <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-100 pt-3">
               <div className="flex items-center gap-2">
                   <button 
                        onClick={() => handleDownloadPDF('payslip')}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                    >
                        <Download size={16} /> Download Payslip Only
                    </button>
                    <button 
                        onClick={() => handleDownloadPDF('timecard')}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
                    >
                        <Download size={16} /> Download Time Card Only
                    </button>
                    <button 
                        onClick={() => handleDownloadPDF('full')}
                        disabled={isGenerating}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-lg shadow-slate-900/20 disabled:opacity-50"
                    >
                        <Download size={16} /> Download Both
                    </button>
               </div>
               <button onClick={onClose} className="p-2 ml-4 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition-colors">
                   <X size={20} />
               </button>
           </div>
       </div>

       {/* DOCUMENT PREVIEW */}
       <div ref={payslipContainerRef} className="pb-20 print:pb-0 print:w-full">
           {monthlyDataList.map((mItem) => {
               const monthDate = parse(mItem.month, 'yyyy-MM', new Date());
               const periodStart = startOfMonth(monthDate);
               const periodEnd = endOfMonth(monthDate);
               // Calculate Payment Date: 7th of the NEXT month
               const paymentDate = setDate(addMonths(monthDate, 1), 7);
               
               const hasImage = !!mItem.attachedImage;
               
               return (
               <div 
                  key={mItem.month} 
                  className="payslip-page bg-white w-[210mm] min-h-[297mm] mx-auto mb-8 shadow-2xl p-[8mm] relative flex flex-col text-black print:shadow-none print:mb-0 print:break-after-page box-border print:w-full font-sans border border-slate-200 print:border-none"
               >
                   {/* HEADER */}
                   <div className="text-center mb-2">
                       <h1 className="text-xl font-extrabold uppercase tracking-wide text-black">{company?.name || 'QUALITY M&E PTE LTD'}</h1>
                       <p className="text-sm font-bold mt-0.5 text-black">Singapore</p>
                   </div>

                   {/* EMPLOYEE INFO BOX */}
                   <div className="border-2 border-black mb-2">
                       <div className="grid grid-cols-2 border-b border-black">
                           <div className="border-r border-black px-2 py-1.5">
                               <div className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-0.5">EMPLOYEE NAME / POSITION</div>
                               <div className="font-bold text-sm uppercase leading-tight">{employee.name} <span className="text-xs font-bold text-slate-700">({employee.position})</span></div>
                           </div>
                           <div className="px-2 py-1.5">
                               <div className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-0.5">FIN NO</div>
                               <div className="font-bold text-sm uppercase leading-tight">{employee.fin}</div>
                           </div>
                       </div>
                       <div className="grid grid-cols-2">
                           <div className="border-r border-black px-2 py-1.5">
                               <div className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-0.5">PAY PERIOD</div>
                               <div className="font-bold text-sm uppercase leading-tight">
                                   {format(periodStart, 'dd MMM yyyy')} - {format(periodEnd, 'dd MMM yyyy')}
                               </div>
                           </div>
                           <div className="px-2 py-1.5">
                               <div className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-0.5">DATE OF PAYMENT</div>
                               <div className="font-bold text-sm uppercase leading-tight">
                                   {format(paymentDate, 'dd/MM/yyyy')}
                               </div>
                           </div>
                       </div>
                   </div>

                   {/* COLUMNS CONTAINER */}
                   <div className="flex gap-4 items-start flex-1 min-h-0">
                       
                       {/* LEFT: PAYSLIP COLUMN */}
                       <div className={`payslip-col border-2 border-black h-full flex flex-col transition-all ${viewMode === 'timecard' ? 'hidden' : 'flex'} ${viewMode === 'full' ? 'w-[50%]' : 'w-full'}`}>
                           <div className="bg-slate-200 text-center font-bold border-b-2 border-black py-1.5 text-sm tracking-widest text-black">PAYSLIP</div>
                           
                           <div className="p-3 text-xs flex-1 flex flex-col leading-relaxed">
                               <div className="font-bold mb-4 uppercase text-[10px] tracking-wide text-slate-700 border-b border-black pb-1">MODE: BANK TRANSFER</div>

                               {/* A. BASIC PAY */}
                               <div className="flex justify-between items-end mb-1">
                                   <span className="font-bold">BASIC PAY (A)</span>
                                   <span className="font-bold text-lg w-24 text-right">${mItem.payroll.basicPayTotal.toFixed(2)}</span>
                               </div>
                               <div className="border-b border-black mb-3"></div>

                               {/* B. ALLOWANCES */}
                               <div className="font-bold mb-1">ALLOWANCES (B)</div>
                               <div className="pl-2 space-y-2 mb-2">
                                   <div className="flex justify-between items-end">
                                       <span>Transport</span>
                                       <span className="w-24 text-right">{mItem.payroll.transportAllowance ? `$${mItem.payroll.transportAllowance.toFixed(2)}` : '-'}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                       <span>Lunch Hrs Working Pay ($1/hr)</span>
                                       <span className="w-24 text-right">${mItem.payroll.lunchAllowanceTotal.toFixed(2)}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                       <span>Other Allowances</span>
                                       <span className="w-24 text-right">{mItem.payroll.otherAllowances ? `$${mItem.payroll.otherAllowances.toFixed(2)}` : '-'}</span>
                                   </div>
                               </div>
                               <div className="border-b border-black mb-3"></div>

                               {/* C. DEDUCTIONS */}
                               <div className="font-bold mb-1">DEDUCTIONS (C)</div>
                               <div className="pl-2 space-y-2 mb-2">
                                   <div className="flex justify-between items-end">
                                       <span>Housing / Amenities</span>
                                       <span className="w-24 text-right">{mItem.payroll.housingDeduction ? `$${mItem.payroll.housingDeduction.toFixed(2)}` : '-'}</span>
                                   </div>
                                   <div className="flex justify-between items-end">
                                       <span>Salary Advance</span>
                                       <span className="w-24 text-right">{mItem.payroll.advanceDeduction ? `$${mItem.payroll.advanceDeduction.toFixed(2)}` : '-'}</span>
                                   </div>
                               </div>
                               <div className="border-b border-black mb-3"></div>

                               {/* D. OVERTIME & ATTENDANCE */}
                               <div className="font-bold mb-1">OVERTIME & ATTENDANCE (D)</div>
                               <div className="pl-2 space-y-2 mb-2">
                                   <div className="flex justify-between items-end">
                                       <span>OT Pay ({mItem.payroll.totalOtHours}h)</span>
                                       <span className="w-24 text-right">${mItem.payroll.otPayTotal.toFixed(2)}</span>
                                   </div>
                                   <div className="flex justify-between items-end text-slate-600">
                                       <span>MC ({mItem.payroll.mcDays} days)</span>
                                       <span className="w-24 text-right">-</span>
                                   </div>
                                   <div className="flex justify-between items-end text-slate-600">
                                       <span>OFF ({mItem.payroll.offDays} days)</span>
                                       <span className="w-24 text-right">-</span>
                                   </div>
                               </div>
                               <div className="border-b border-black mb-3"></div>

                               {/* E. HOLIDAY PAY */}
                               <div className="font-bold mb-1">HOLIDAY PAY (E)</div>
                               <div className="pl-2 space-y-2 mb-2">
                                   <div className="flex justify-between items-end">
                                       <span>Holiday/Sun Pay ({mItem.payroll.totalHolidayDays}d)</span>
                                       <span className="w-24 text-right">${mItem.payroll.holidayPayTotal.toFixed(2)}</span>
                                   </div>
                               </div>
                               
                               {/* NET PAY BOX */}
                               {/* Positioning: If in full view with image, use mt-4 (top). If separate view or no image, use mt-auto (bottom). */}
                               <div className={`net-pay-section border-2 border-black p-2 bg-slate-50 ${hasImage && viewMode === 'full' ? 'mt-4' : 'mt-auto'}`}>
                                   <div className="flex justify-between items-center">
                                       <span className="font-extrabold text-sm uppercase">NET PAY (A+B-C+D+E)</span>
                                       <span className="font-extrabold text-xl">${mItem.payroll.netSalary.toFixed(2)}</span>
                                   </div>
                               </div>

                               {/* ATTACHED IMAGE (Manual Time Card) */}
                               {/* Only render in DOM if it exists. Hide via CSS if not in full view so we can remove/unhide during PDF generation */}
                               {mItem.attachedImage && (
                                   <div className={`attached-image-section mt-4 flex-1 flex items-center justify-center p-1 border border-dashed border-slate-200 min-h-[80px] ${viewMode !== 'full' ? 'hidden' : ''}`}>
                                       <img src={mItem.attachedImage} className="w-full h-full object-contain max-h-[150px]" alt="Attached Card" />
                                   </div>
                               )}
                           </div>
                       </div>

                       {/* RIGHT: TIME CARD COLUMN */}
                       <div className={`timecard-col border-2 border-black flex flex-col h-full transition-all ${viewMode === 'payslip' ? 'hidden' : 'flex'} ${viewMode === 'full' ? 'w-[50%]' : 'w-full'}`}>
                            <div className="bg-slate-200 text-center font-bold border-b-2 border-black py-1.5 text-sm tracking-widest text-black">TIME CARD</div>
                            <table className="w-full text-[10px] text-center leading-none border-collapse">
                               <thead>
                                   <tr className="border-b border-black bg-slate-100 h-6">
                                       <th className="border-r border-black w-6 font-bold">No</th>
                                       <th className="border-r border-black w-14 font-bold">Date</th>
                                       <th className="border-r border-black w-8 font-bold">Day</th>
                                       <th className="border-r border-black w-10 font-bold">IN</th>
                                       <th className="border-r border-black w-10 font-bold">OUT</th>
                                       <th className="border-r border-black w-8 font-bold">OT</th>
                                       <th className="border-r border-black w-6 font-bold">Lun</th>
                                       <th className="font-bold">Site/Rem</th>
                                   </tr>
                               </thead>
                               <tbody>
                                   {renderTimeCardRows(mItem.dailyRecords)}
                               </tbody>
                            </table>
                            <div className="mt-auto border-t-2 border-black p-2 flex justify-between text-[10px] font-bold bg-slate-100">
                                <span className="uppercase">TOTALS</span>
                                <span>Work Days: {mItem.payroll.totalDaysWorked}</span>
                                <span>OT Hrs: {mItem.payroll.totalOtHours}</span>
                                <span>Lunch: {mItem.payroll.totalLunchHours}</span>
                            </div>
                       </div>
                   </div>

                   {/* FOOTER SIGNATURES - BOXED MODEL (ADJUSTED HEIGHTS) */}
                   <div className="mt-[5px] border-2 border-black flex text-xs flex-none">
                        {/* Left Side: Authorized Sign & Stamp */}
                        <div className="flex-1 border-r-2 border-black flex flex-col">
                            {/* Top Section: Authorized Signature - HEIGHT INCREASED FOR 100px IMAGES */}
                            <div className="px-2 pt-1 pb-1 flex-1 relative flex flex-col justify-between h-[120px]">
                                 <div className="font-bold text-[10px] text-slate-500 uppercase leading-none">AUTHORIZED SIGNATURE & STAMP</div>
                                 <div className="flex-1 flex items-end justify-center gap-4">
                                      {/* Signature */}
                                      {company?.signature && (
                                          <img 
                                              src={company.signature} 
                                              className="max-h-[100px] w-auto object-contain mix-blend-multiply" 
                                              alt="Signature" 
                                          />
                                      )}
                                      {/* Stamp */}
                                      {company?.stamp && (
                                          <img 
                                              src={company.stamp} 
                                              className="max-h-[100px] w-auto object-contain mix-blend-multiply opacity-90" 
                                              alt="Stamp" 
                                          />
                                      )}
                                 </div>
                            </div>
                            {/* Bottom Section: Employer Text - HEIGHT 23px */}
                            <div className="border-t-2 border-black h-[23px] flex items-center justify-center bg-slate-50">
                                <span className="font-bold text-xs uppercase text-black">EMPLOYER</span>
                            </div>
                        </div>

                        {/* Right Side: Employee Signature */}
                        <div className="flex-1 flex flex-col">
                             {/* Top Section: Acknowledged By - HEIGHT INCREASED TO MATCH */}
                            <div className="px-2 pt-1 pb-1 flex-1 relative h-[120px]">
                                 <div className="font-bold text-[10px] text-slate-500 uppercase leading-none">ACKNOWLEDGED BY</div>
                            </div>
                             {/* Bottom Section: Employee Signature Text - HEIGHT 23px */}
                            <div className="border-t-2 border-black h-[23px] flex items-center justify-center bg-slate-50">
                                <span className="font-bold text-xs uppercase text-black">EMPLOYEE SIGNATURE</span>
                            </div>
                        </div>
                   </div>

               </div>
               );
           })}
       </div>
    </div>
  );
};

export default PayslipModal;