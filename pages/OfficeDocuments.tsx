
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { OfficeDocument } from '../types';
import { Briefcase, Upload, Download, Trash2, FileText, Search, UploadCloud, Tag, Package, Calendar, Filter } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import JSZip from 'jszip';

const OfficeDocuments = () => {
  const [documents, setDocuments] = useState<OfficeDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('All');
  
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [category, setCategory] = useState('');
  const [documentDate, setDocumentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isUploading, setIsUploading] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Derived state for years
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  useEffect(() => {
      fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
      const res = await api.officeDocuments.getAll();
      if(res.success) {
          const docs = res.data;
          setDocuments(docs);
          
          // Extract unique years
          const years = new Set<string>();
          docs.forEach(d => {
              if (d.documentDate) years.add(d.documentDate.substring(0, 4));
              else years.add(d.uploadDate.substring(0, 4));
          });
          // Also add current year if not present
          years.add(new Date().getFullYear().toString());
          
          setAvailableYears(Array.from(years).sort().reverse());
      }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setUploadFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsUploading(true);

    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result as string;
            
            const newDoc: OfficeDocument = {
                id: Date.now().toString(),
                name: uploadFile.name,
                category: category || 'General',
                uploadDate: new Date().toISOString(),
                documentDate: documentDate,
                fileData: base64String,
                fileType: uploadFile.type,
                size: uploadFile.size
            };

            await api.officeDocuments.save(newDoc);
            setDocuments(prev => [newDoc, ...prev]);
            
            // Update years if needed
            const year = documentDate.substring(0, 4);
            if (!availableYears.includes(year)) {
                setAvailableYears(prev => [year, ...prev].sort().reverse());
            }

            setUploadFile(null);
            setCategory('');
            setDocumentDate(format(new Date(), 'yyyy-MM-dd'));
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
          await api.officeDocuments.delete(id);
          setDocuments(prev => prev.filter(d => d.id !== id));
      }
  };

  const handleDownload = (doc: OfficeDocument) => {
      const link = document.createElement('a');
      link.href = doc.fileData;
      link.download = doc.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDownloadZip = async () => {
    if (documents.length === 0) return;
    setIsZipping(true);

    try {
        const zip = new JSZip();
        const folder = zip.folder(`Office_Documents_${selectedYear}`);

        // Filter based on current view
        const docsToZip = filteredDocs;

        docsToZip.forEach(doc => {
            const base64Data = doc.fileData.split(',')[1];
            if (base64Data && folder) {
                folder.file(doc.name, base64Data, { base64: true });
            }
        });

        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Office_Documents_${selectedYear}.zip`;
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

  const filteredDocs = documents.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.category.toLowerCase().includes(searchTerm.toLowerCase());
      const year = d.documentDate ? d.documentDate.substring(0, 4) : d.uploadDate.substring(0, 4);
      const matchesYear = selectedYear === 'All' || year === selectedYear;
      return matchesSearch && matchesYear;
  });

  const inputStyle = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 shadow-sm";

  return (
    <div className="h-[calc(100dvh-7rem)] md:h-[calc(100dvh-8rem)] flex flex-col gap-6 pb-20 md:pb-6 animate-fade-in">
      <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Office Documents</h2>
          <p className="text-slate-500 font-medium">Manage general company files, templates, and memos.</p>
      </div>
      
      <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col overflow-hidden h-full min-h-0">
            {/* Header / Upload Bar */}
            <div className="p-6 bg-white border-b border-slate-100 sticky top-0 z-10 flex flex-col xl:flex-row gap-6 items-end xl:items-center">
                 <div className="flex-1 w-full xl:w-auto">
                     <form onSubmit={handleUpload} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                             <div className="md:col-span-12 lg:col-span-4">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Select Document</label>
                                 <div className="relative group">
                                     <input type="file" id="file-upload" required onChange={handleFileSelect} className="hidden" />
                                     <label htmlFor="file-upload" className={`flex items-center gap-3 w-full bg-white border-2 border-dashed rounded-xl px-4 py-3 text-sm font-bold text-slate-800 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-all shadow-sm ${uploadFile ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-300'}`}>
                                         <div className={`p-1.5 rounded-lg shrink-0 ${uploadFile ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}><UploadCloud size={20} /></div>
                                         <span className="truncate flex-1">{uploadFile ? uploadFile.name : 'Click to choose file...'}</span>
                                     </label>
                                 </div>
                             </div>
                             <div className="md:col-span-6 lg:col-span-3">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Category</label>
                                 <div className="relative">
                                    <input 
                                        list="category-suggestions" 
                                        type="text" 
                                        className={inputStyle} 
                                        placeholder="Type or select..." 
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value)}
                                        required
                                    />
                                    <datalist id="category-suggestions">
                                        <option value="General" />
                                        <option value="Policy" />
                                        <option value="Template" />
                                        <option value="Invoice" />
                                        <option value="Contract" />
                                        <option value="Safety" />
                                        <option value="Memo" />
                                    </datalist>
                                     <Tag className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                 </div>
                             </div>
                             <div className="md:col-span-6 lg:col-span-3">
                                 <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5 ml-1">Document Date</label>
                                 <div className="relative">
                                     <input 
                                        type="date" 
                                        className={inputStyle}
                                        value={documentDate}
                                        onChange={(e) => setDocumentDate(e.target.value)}
                                        required
                                     />
                                     <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                                 </div>
                             </div>
                             <div className="md:col-span-12 lg:col-span-2">
                                 <button type="submit" disabled={!uploadFile || isUploading} className="w-full h-[46px] bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-95">
                                     {isUploading ? 'Uploading...' : <><Upload size={18} /> Upload</>}
                                 </button>
                             </div>
                     </form>
                 </div>
                 
                 <div className="w-full xl:w-auto flex flex-col sm:flex-row gap-4">
                     {/* Year Filter */}
                     <div className="relative w-full sm:w-32">
                         <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none"><Filter size={16} /></div>
                         <select 
                            className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer appearance-none"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                         >
                             <option value="All">All Years</option>
                             {availableYears.map(year => (
                                 <option key={year} value={year}>{year}</option>
                             ))}
                         </select>
                     </div>

                     <div className="relative flex-1 sm:w-56">
                         <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                         <input type="text" placeholder="Search..." className="w-full pl-11 pr-4 py-3 border border-slate-200 rounded-xl text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 transition-all shadow-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                     </div>
                     <button onClick={handleDownloadZip} disabled={filteredDocs.length === 0 || isZipping} className="flex items-center justify-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-xl text-sm font-bold hover:bg-slate-700 disabled:opacity-50 transition-all shadow-lg shadow-slate-900/10 active:scale-95 whitespace-nowrap">
                         {isZipping ? <span className="animate-spin">⌛</span> : <Package size={18} />}<span>Download</span>
                     </button>
                 </div>
            </div>

            {/* Documents Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
                {documents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white m-4">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><Briefcase size={32} className="opacity-40" /></div>
                        <h3 className="font-bold text-slate-600">No office documents yet</h3>
                    </div>
                ) : filteredDocs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 m-4">
                        <p>No documents found for {selectedYear !== 'All' ? selectedYear : ''} matching your search.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
                        {filteredDocs.map(doc => (
                            <div key={doc.id} className="border border-slate-200 rounded-2xl p-5 hover:shadow-lg hover:border-blue-200 transition-all relative bg-white group flex flex-col justify-between h-full min-h-[140px]">
                                <div>
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-4 w-full">
                                            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 shadow-sm group-hover:scale-110 transition-transform shrink-0">
                                                <FileText size={24} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-bold text-slate-800 text-sm truncate w-full" title={doc.name}>{doc.name}</div>
                                                <div className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md inline-block mt-1">{doc.category}</div>
                                            </div>
                                        </div>
                                        <button onClick={() => handleDelete(doc.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition opacity-0 group-hover:opacity-100 shrink-0">
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-xs mt-4 pt-4 border-t border-slate-50">
                                    <span className="text-slate-400 font-medium flex items-center gap-1">
                                        <Calendar size={12} />
                                        {doc.documentDate ? format(parseISO(doc.documentDate), 'dd MMM yyyy') : format(parseISO(doc.uploadDate), 'dd MMM yyyy')}
                                    </span>
                                    <button onClick={() => handleDownload(doc)} className="text-blue-600 font-bold hover:text-blue-700 hover:underline flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors">
                                        <Download size={14} /> Download
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
      </div>
    </div>
  );
};

export default OfficeDocuments;
