
import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { Employee, PayrollRecord, AttendanceRecord, Company } from '../types';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { format, endOfMonth, addMonths, parse, setDate, startOfMonth } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { formatTime12Hour } from '../utils/calculations';

interface MonthlyData {
    month: string;
    payroll: PayrollRecord;
    dailyRecords: {date: string, dayName: string, record?: AttendanceRecord}[];
    dailyRate: number;
    attachedImage?: string;
}

const PayslipViewPage = () => {
    const { employeeId, month } = useParams();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [company, setCompany] = useState<Company | undefined>(undefined);
    
    const [startMonth, setStartMonth] = useState('');
    const [endMonth, setEndMonth] = useState('');
    
    const [viewMode, setViewMode] = useState<'full' | 'payslip' | 'timecard'>('full');
    const [monthlyDataList, setMonthlyDataList] = useState<MonthlyData[]>([]);
    const payslipContainerRef = useRef<HTMLDivElement>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    useEffect(() => {
        if (employeeId && month) {
            setStartMonth(month);
            setEndMonth(month);
        } else {
            navigate('/payroll');
        }
    }, [employeeId, month, navigate]);

    useEffect(() => {
        if (!employeeId || !startMonth || !endMonth) return;

        const fetchData = async () => {
            setIsLoading(true);
            try {
                const res = await api.payroll.getPayslipRange(employeeId, startMonth, endMonth);
                if (res.success) {
                    setEmployee(res.data.employee);
                    setCompany(res.data.company);
                    setMonthlyDataList(res.data.monthlyData);
                } else {
                    alert("Failed to load payslip data");
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [employeeId, startMonth, endMonth]);

    const handleDownloadPDF = async (type: 'full' | 'payslip' | 'timecard') => {
        if (!payslipContainerRef.current) return;
        setIsGenerating(true);
        
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdf = new jsPDF('p', 'mm', 'a4');
        const originalPages = payslipContainerRef.current.querySelectorAll('.payslip-page');
        
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
                
                const payslipCol = clonedPage.querySelector('.payslip-col') as HTMLElement;
                const timecardCol = clonedPage.querySelector('.timecard-col') as HTMLElement;
                const imageSection = clonedPage.querySelector('.attached-image-section') as HTMLElement;
                const netPayBox = clonedPage.querySelector('.net-pay-section') as HTMLElement;

                // Ensure all parts are potentially visible first
                if (payslipCol) { payslipCol.classList.remove('hidden', 'w-full', 'w-[50%]'); payslipCol.style.display = 'flex'; }
                if (timecardCol) { timecardCol.classList.remove('hidden', 'w-full', 'w-[50%]'); timecardCol.style.display = 'flex'; }
                if (imageSection) { imageSection.classList.remove('hidden'); imageSection.style.display = 'flex'; }

                if (type === 'payslip') {
                    if (timecardCol) timecardCol.remove();
                    if (payslipCol) payslipCol.classList.add('w-full');
                    if (imageSection) imageSection.remove();
                    if (netPayBox) { netPayBox.classList.remove('mt-4'); netPayBox.classList.add('mt-auto'); }
                } else if (type === 'timecard') {
                    if (payslipCol) payslipCol.remove();
                    if (timecardCol) timecardCol.classList.add('w-full');
                } else {
                    if (payslipCol) payslipCol.classList.add('w-[50%]');
                    if (timecardCol) timecardCol.classList.add('w-[50%]');
                    if (!imageSection && netPayBox) { netPayBox.classList.remove('mt-4'); netPayBox.classList.add('mt-auto'); }
                    else if (imageSection && netPayBox) { netPayBox.classList.remove('mt-auto'); netPayBox.classList.add('mt-4'); }
                }

                hiddenContainer.appendChild(clonedPage);
                
                const canvas = await html2canvas(clonedPage, { scale: 2, logging: false, useCORS: true, windowWidth: 1200 });
                const imgData = canvas.toDataURL('image/png');
                const imgWidth = 210;
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                
                if (i > 0) pdf.addPage();
                pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
                
                hiddenContainer.removeChild(clonedPage);
            }
            let filenameSuffix = type === 'full' ? 'Full' : type === 'payslip' ? 'Payslip' : 'TimeCard';
            pdf.save(`${filenameSuffix}_${employee!.name}_${startMonth}.pdf`);
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
                    <td className="border-r border-black text-center font-medium">{dayData ? format(parse(dayData.date, 'yyyy-MM-dd', new Date()), 'dd/MM/yy') : ''}</td>
                    <td className="border-r border-black text-center font-medium uppercase">{dayData ? dayData.dayName.substring(0,3) : ''}</td>
                    <td className="border-r border-black text-center font-medium">{dayData?.record?.startTime || ''}</td>
                    <td className="border-r border-black text-center font-medium">{dayData?.record?.endTime || ''}</td>
                    <td className="border-r border-black text-center font-bold">{dayData?.record?.otHours ? dayData.record.otHours : ''}</td>
                    <td className="border-r border-black text-center font-medium">{dayData?.record?.lunchHours ? dayData.record.lunchHours : ''}</td>
                    <td className="px-1 text-left truncate font-medium">{dayData?.record?.remarks === 'MC' ? 'MC' : dayData?.record?.remarks === 'OFF' ? 'OFF' : dayData?.record?.siteLocation}</td>
                </tr>
            );
        }
        return rows;
    };

    if (isLoading && !employee) return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="w-10 h-10 text-blue-500 animate-spin" /></div>;
    if (!employee) return null;

    return (
        <div className="space-y-6 animate-fade-in pb-20 md:pb-10">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 sticky top-0 z-20 print:hidden">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
                     <div className="flex items-center gap-4 w-full xl:w-auto">
                        <button onClick={() => navigate('/payroll')} className="p-2 bg-slate-50 border border-slate-200 rounded-xl hover:bg-white text-slate-500 transition-colors shadow-sm shrink-0">
                            <ArrowLeft size={20} />
                        </button>
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-slate-900 tracking-tight truncate">Generate Payslip</h2>
                            <div className="flex items-center gap-2 text-sm text-slate-500">
                                <span className="font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded truncate">{employee.name}</span>
                            </div>
                        </div>
                     </div>
                     <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full xl:w-auto">
                         <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200 w-full md:w-auto justify-center">
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex-1 md:flex-none justify-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From</span>
                                <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className="bg-transparent text-slate-900 text-xs font-bold outline-none cursor-pointer w-[110px]" />
                            </div>
                            <div className="w-4 h-[2px] bg-slate-300 rounded-full hidden md:block"></div>
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm flex-1 md:flex-none justify-center">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To</span>
                                <input type="month" value={endMonth} onChange={(e) => setEndMonth(e.target.value)} className="bg-transparent text-slate-900 text-xs font-bold outline-none cursor-pointer w-[110px]" />
                            </div>
                         </div>
                         <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
                                <button onClick={() => setViewMode('payslip')} className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'payslip' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>Payslip</button>
                                <button onClick={() => setViewMode('timecard')} className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'timecard' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500'}`}>Time Card</button>
                                <button onClick={() => setViewMode('full')} className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'full' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Full</button>
                        </div>
                     </div>
                </div>
                <div className="flex flex-wrap justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                   <button onClick={() => handleDownloadPDF('payslip')} disabled={isGenerating} className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 disabled:opacity-50"><Download size={16} /> Payslip Only</button>
                   <button onClick={() => handleDownloadPDF('timecard')} disabled={isGenerating} className="flex-1 sm:flex-none px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"><Download size={16} /> Time Card Only</button>
                   <button onClick={() => handleDownloadPDF('full')} disabled={isGenerating} className="flex-1 sm:flex-none px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 disabled:opacity-50"><Download size={16} /> Both</button>
                </div>
            </div>

            {/* A4 Preview Container with Horizontal Scroll for Mobile */}
            <div className="w-full overflow-x-auto flex justify-start lg:justify-center bg-slate-100/50 rounded-2xl py-8">
                <div ref={payslipContainerRef} className="pb-20 print:pb-0 print:w-full flex flex-col items-center min-w-[210mm] px-4 mx-auto">
                    {monthlyDataList.map((mItem) => {
                        const monthDate = parse(mItem.month, 'yyyy-MM', new Date());
                        const periodStart = startOfMonth(monthDate);
                        const periodEnd = endOfMonth(monthDate);
                        const paymentDate = setDate(addMonths(monthDate, 1), 7);
                        const hasImage = !!mItem.attachedImage;
                        
                        return (
                        <div key={mItem.month} className="payslip-page bg-white w-[210mm] min-h-[297mm] mb-8 shadow-2xl p-[8mm] relative flex flex-col text-black print:shadow-none print:mb-0 print:break-after-page box-border print:w-full font-sans border border-slate-200 print:border-none flex-none">
                            <div className="text-center mb-2">
                                <h1 className="text-xl font-extrabold uppercase tracking-wide text-black">{company?.name || 'QUALITY M&E PTE LTD'}</h1>
                                <p className="text-sm font-bold mt-0.5 text-black">Singapore</p>
                            </div>
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
                                        <div className="font-bold text-sm uppercase leading-tight">{format(periodStart, 'dd MMM yyyy')} - {format(periodEnd, 'dd MMM yyyy')}</div>
                                    </div>
                                    <div className="px-2 py-1.5">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase leading-none mb-0.5">DATE OF PAYMENT</div>
                                        <div className="font-bold text-sm uppercase leading-tight">{format(paymentDate, 'dd/MM/yyyy')}</div>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4 items-start flex-1 min-h-0">
                                <div className={`payslip-col border-2 border-black h-full flex flex-col transition-all ${viewMode === 'timecard' ? 'hidden' : 'flex'} ${viewMode === 'full' ? 'w-[50%]' : 'w-full'}`}>
                                    <div className="bg-slate-200 text-center font-bold border-b-2 border-black py-1.5 text-sm tracking-widest text-black">PAYSLIP</div>
                                    <div className="p-3 text-xs flex-1 flex flex-col leading-relaxed">
                                        <div className="font-bold mb-4 uppercase text-[10px] tracking-wide text-slate-700 border-b border-black pb-1">MODE: BANK TRANSFER</div>
                                        <div className="flex justify-between items-end mb-1"><span className="font-bold">BASIC PAY (A)</span><span className="font-bold text-lg w-24 text-right">${mItem.payroll.basicPayTotal.toFixed(2)}</span></div>
                                        <div className="border-b border-black mb-3"></div>
                                        <div className="font-bold mb-1">ALLOWANCES (B)</div>
                                        <div className="pl-2 space-y-2 mb-2">
                                            <div className="flex justify-between items-end"><span>Transport</span><span className="w-24 text-right">{mItem.payroll.transportAllowance ? `$${mItem.payroll.transportAllowance.toFixed(2)}` : '-'}</span></div>
                                            <div className="flex justify-between items-end"><span>Lunch Pay</span><span className="w-24 text-right">${mItem.payroll.lunchAllowanceTotal.toFixed(2)}</span></div>
                                            <div className="flex justify-between items-end"><span>Other</span><span className="w-24 text-right">{mItem.payroll.otherAllowances ? `$${mItem.payroll.otherAllowances.toFixed(2)}` : '-'}</span></div>
                                        </div>
                                        <div className="border-b border-black mb-3"></div>
                                        <div className="font-bold mb-1">DEDUCTIONS (C)</div>
                                        <div className="pl-2 space-y-2 mb-2">
                                            <div className="flex justify-between items-end"><span>Housing</span><span className="w-24 text-right">{mItem.payroll.housingDeduction ? `$${mItem.payroll.housingDeduction.toFixed(2)}` : '-'}</span></div>
                                            <div className="flex justify-between items-end"><span>Advance</span><span className="w-24 text-right">{mItem.payroll.advanceDeduction ? `$${mItem.payroll.advanceDeduction.toFixed(2)}` : '-'}</span></div>
                                        </div>
                                        <div className="border-b border-black mb-3"></div>
                                        <div className="font-bold mb-1">OVERTIME (D)</div>
                                        <div className="pl-2 space-y-2 mb-2">
                                            <div className="flex justify-between items-end"><span>OT Pay ({mItem.payroll.totalOtHours}h)</span><span className="w-24 text-right">${mItem.payroll.otPayTotal.toFixed(2)}</span></div>
                                        </div>
                                        <div className="border-b border-black mb-3"></div>
                                        <div className="font-bold mb-1">HOLIDAY PAY (E)</div>
                                        <div className="pl-2 space-y-2 mb-2">
                                            <div className="flex justify-between items-end"><span>Holiday Pay ({mItem.payroll.totalHolidayDays}d)</span><span className="w-24 text-right">${mItem.payroll.holidayPayTotal.toFixed(2)}</span></div>
                                        </div>
                                        <div className={`net-pay-section border-2 border-black p-2 bg-slate-50 ${hasImage && viewMode === 'full' ? 'mt-4' : 'mt-auto'}`}>
                                            <div className="flex justify-between items-center"><span className="font-extrabold text-sm uppercase">NET PAY</span><span className="font-extrabold text-xl">${mItem.payroll.netSalary.toFixed(2)}</span></div>
                                        </div>
                                        {mItem.attachedImage && (
                                            <div className={`attached-image-section mt-4 flex-1 flex items-center justify-center p-1 border border-dashed border-slate-200 min-h-[80px] ${viewMode !== 'full' ? 'hidden' : ''}`}>
                                                <img src={mItem.attachedImage} className="w-full h-full object-contain max-h-[150px]" alt="Attached Card" />
                                            </div>
                                        )}
                                    </div>
                                </div>
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
                                        <tbody>{renderTimeCardRows(mItem.dailyRecords)}</tbody>
                                        </table>
                                        <div className="mt-auto border-t-2 border-black p-2 flex justify-between text-[10px] font-bold bg-slate-100">
                                            <span className="uppercase">TOTALS</span>
                                            <span>Work Days: {mItem.payroll.totalDaysWorked}</span>
                                            <span>OT Hrs: {mItem.payroll.totalOtHours}</span>
                                            <span>Lunch: {mItem.payroll.totalLunchHours}</span>
                                        </div>
                                </div>
                            </div>
                            <div className="mt-[5px] border-2 border-black flex text-xs flex-none">
                                    <div className="flex-1 border-r-2 border-black flex flex-col">
                                        <div className="px-2 pt-1 pb-1 flex-1 relative flex flex-col justify-between h-[120px]">
                                            <div className="font-bold text-[10px] text-slate-500 uppercase leading-none">AUTHORIZED SIGNATURE & STAMP</div>
                                            <div className="flex-1 flex items-end justify-center gap-4">
                                                {company?.signature && <img src={company.signature} className="max-h-[100px] w-auto object-contain mix-blend-multiply" alt="Signature" />}
                                                {company?.stamp && <img src={company.stamp} className="max-h-[100px] w-auto object-contain mix-blend-multiply opacity-90" alt="Stamp" />}
                                            </div>
                                        </div>
                                        <div className="border-t-2 border-black h-[23px] flex items-center justify-center bg-slate-50"><span className="font-bold text-xs uppercase text-black">EMPLOYER</span></div>
                                    </div>
                                    <div className="flex-1 flex flex-col">
                                        <div className="px-2 pt-1 pb-1 flex-1 relative h-[120px]"><div className="font-bold text-[10px] text-slate-500 uppercase leading-none">ACKNOWLEDGED BY</div></div>
                                        <div className="border-t-2 border-black h-[23px] flex items-center justify-center bg-slate-50"><span className="font-bold text-xs uppercase text-black">EMPLOYEE SIGNATURE</span></div>
                                    </div>
                            </div>
                        </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default PayslipViewPage;
