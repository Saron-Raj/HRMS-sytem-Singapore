
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Employee, WorkerDocument, DocumentType } from '../types';
import { FolderOpen, Upload, Download, Trash2, FileText, Search, User, Package, UploadCloud, X, Calendar, Tag } from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import JSZip from 'jszip';

const WorkerDocuments = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<WorkerDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType | string>(DocumentType.OTHER);
  const [expiryDate, setExpiryDate] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    api.employees.getAll().then(res => { if(res.success) setEmployees(res.data) });
  }, []);

  useEffect(() => {
    if (selectedEmpId) {
        api.documents.getAll(selectedEmpId).then(res => { if(res.success) setDocuments(res.data) });
    } else {
        setDocuments([]);
    }
  }, [selectedEmpId]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !selectedEmpId) return;
    setIsUploading(true);

    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            
            const newDoc: WorkerDocument = {
                id: Date.now().toString(),
                workerId: selectedEmpId,
                name: uploadFile.name,
                type: docType,
                uploadDate: new Date().toISOString(),
                expiryDate: expiryDate || undefined,
                fileData: base64String,
                fileType: uploadFile.type,
                size: uploadFile.size
            };

            await api.documents.save(newDoc);
            setDocuments(prev => [...prev, newDoc]);
            setUploadFile(null);
            setDocType(DocumentType.OTHER);
            setExpiryDate('');
            setIsUploading(false);
        };
        reader.readAsDataURL(uploadFile);
    } catch (error) {
        console.error("Upload failed", error);
        alert("Failed to upload file. Please try again.");
        setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
      if (window.confirm("Are you sure you want to delete this document?")) {
          await api.documents.delete(id);
          setDocuments(prev => prev.filter(d => d.id !== id));
      }
  };

  const handleDownload = (doc: WorkerDocument) => {
      const link = document.createElement('a');
      link.href = doc.fileData;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDownloadZip = async () => {
    if (documents.length === 0 || !selectedEmpId) return;
    setIsZipping(true);

    try {
        const zip = new JSZip();
        const empName = employees.find(e => e.id === selectedEmpId)?.name.replace(/\s+/g, '_') || 'Worker';
        const folder = zip.folder(`${empName}_Documents`);

        documents.forEach(doc => {
            const base64Data = doc.fileData.split(',')[1];
            if (base64Data && folder) {
                folder.file(doc.name, base64Data, { base64: true });
            }
        });

        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `${empName}_All_Documents.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("ZIP Generation failed", err);
        alert("Failed to create ZIP archive.");
    } finally {
        setIsZipping(false);
    }
  };

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(searchTerm.toLowerCase()) || e.fin.toLowerCase().includes(searchTerm.toLowerCase()));
  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 shadow-sm";

  return (
    <div className="h-[calc(100dvh-120px)] flex flex-col gap-6 pb-6 animate-fade-in">
      <div><h2 className="text-3xl font-bold text-slate-900 tracking-tight">Worker Documents</h2><p className="text-slate-500 font-medium">Centralized document management for passports, permits, and certificates.</p></div>
      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
          <div className="w-full lg:w-1/3 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden flex-none lg:flex-1 h-64 lg:h-auto">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50"><div className="relative"><Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} /><input type="text" placeholder="Search Worker..." className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-white transition-all shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} /></div></div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                  {filteredEmployees.map(emp => (
                      <div key={emp.id} onClick={() => setSelectedEmpId(emp.id)} className={`p-3 rounded-xl cursor-pointer flex items-center gap-3 transition-all ${selectedEmpId === emp.id ? 'bg-blue-600 shadow-md shadow-blue-500/20 transform scale-[1.02]' : 'hover:bg-slate-50 border border-transparent'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-inner shrink-0 ${selectedEmpId === emp.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{emp.status === 'Cancelled' ? 'X' : <User size={18} />}</div>
                          <div className="min-w-0 flex-1"><div className={`font-bold text-sm truncate ${selectedEmpId === emp.id ? 'text-white' : 'text-slate-800'}`}>{emp.name}</div><div className={`text-xs flex items-center gap-1 ${selectedEmpId === emp.id ? 'text-blue-100' : 'text-slate-400'}`}>{emp.fin}</div></div>
                      </div>
                  ))}
              </div>
          </div>
          <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-full min-h-0">
              {selectedEmpId ? (
                  <>
                    <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white sticky top-0 z-10 gap-4"><div><h3 className="font-bold text-xl text-slate-800 leading-tight">{employees.find(e => e.id === selectedEmpId)?.name}</h3><p className="text-xs text-slate-500 font-medium">Manage uploaded documents</p></div><div className="flex gap-2 w-full sm:w-auto"><button onClick={handleDownloadZip} disabled={documents.length === 0 || isZipping} className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/10 active:scale-95 w-full sm:w-auto">{isZipping ? <span className="animate-spin">⌛</span> : <Package size={18} />}<span>Download All (ZIP)</span></button></div></div>
                    <div className="p-6 bg-slate-50/50 border-b border-slate-100"><form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                             <div className="md:col-span-12 lg:col-span-5"><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Select Document</label><div className="relative group"><input type="file" id="file-upload" required onChange={handleFileSelect} className="hidden" /><label htmlFor="file-upload" className={`flex items-center gap-3 w-full bg-white border-2 border-dashed rounded-xl px-4 py-3 text-sm font-bold text-slate-800 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm ${uploadFile ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-300'}`}><div className={`p-1.5 rounded-lg shrink-0 ${uploadFile ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><UploadCloud size={20} /></div><span className="truncate flex-1">{uploadFile ? uploadFile.name : 'Click to choose file...'}</span></label></div></div>
                             <div className="md:col-span-6 lg:col-span-3"><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Document Type</label><div className="relative"><select className={`${inputStyle} appearance-none cursor-pointer`} value={docType} onChange={(e) => setDocType(e.target.value)}>{Object.values(DocumentType).map(t => (<option key={t} value={t}>{t}</option>))}</select><Tag className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} /></div></div>
                             <div className="md:col-span-6 lg:col-span-2"><label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Expiry Date</label><div className="relative"><input type="date" className={inputStyle} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} /><Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} /></div></div>
                             <div className="md:col-span-12 lg:col-span-2"><button type="submit" disabled={!uploadFile || isUploading} className="w-full h-[46px] bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95">{isUploading ? 'Uploading...' : <><Upload size={18} /> Upload</>}</button></div></form></div>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                        {documents.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white m-4"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><FolderOpen size={32} className="opacity-40" /></div><h3 className="font-bold text-slate-600">No documents yet</h3></div>) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {documents.map(doc => {
                                    const isExpired = doc.expiryDate && differenceInDays(parseISO(doc.expiryDate), new Date()) <= 0;
                                    const isExpiringSoon = doc.expiryDate && !isExpired && differenceInDays(parseISO(doc.expiryDate), new Date()) <= 30;
                                    return (
                                        <div key={doc.id} className="border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-blue-200 transition-all relative bg-white group flex flex-col justify-between h-full">
                                            <div><div className="flex items-start justify-between mb-3"><div className="flex items-center gap-4 w-full"><div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform shrink-0"><FileText size={24} /></div><div className="min-w-0 flex-1"><div className="font-bold text-slate-800 text-sm truncate w-full" title={doc.name}>{doc.name}</div><div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">{doc.type}</div></div></div><button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100 shrink-0"><Trash2 size={18} /></button></div>{doc.expiryDate && (<div className={`text-[10px] font-bold mt-2 inline-flex items-center px-2 py-0.5 rounded-md ${isExpired ? 'bg-red-100 text-red-600' : isExpiringSoon ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>{isExpired ? 'EXPIRED' : isExpiringSoon ? 'EXPIRING SOON' : 'VALID'}<span className="mx-1">•</span>{format(parseISO(doc.expiryDate), 'dd MMM yyyy')}</div>)}</div><div className="flex items-center justify-between text-xs mt-4 pt-4 border-t border-slate-50"><span className="text-slate-400 font-medium">{format(parseISO(doc.uploadDate), 'dd MMM')}</span><button onClick={() => handleDownload(doc)} className="text-blue-600 font-bold hover:text-blue-700 hover:underline flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"><Download size={14} /> Download</button></div></div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                  </>
              ) : (<div className="flex flex-col items-center justify-center h-full text-slate-400"><div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-sm"><User size={40} className="opacity-50" /></div><h3 className="font-bold text-slate-700 text-xl mb-1">Select a Worker</h3></div>)}
          </div>
      </div>
    </div>
  );
};

export default WorkerDocuments;
