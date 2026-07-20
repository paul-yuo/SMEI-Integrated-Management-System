import React, { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Trash2, 
  UploadCloud, 
  File, 
  Download,
  FileSpreadsheet,
  FileArchive,
  Loader2
} from "lucide-react";

interface UploadedDocument {
  id: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadedAt: string;
  caNumber: string;
  status: "Extracted" | "Manual";
  fileData?: string; // base64 data URL
}

export default function ControlNoModule() {
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("All");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Advanced extraction state
  const [isExtracting, setIsExtracting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState<{
    caNumber: string;
    confidence: number;
    method: string;
    page: number | null;
    source: string;
    fileName: string;
    fileSize: string;
    fileType: string;
    fileData: string;
  } | null>(null);

  // Duplicate state
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateData, setDuplicateData] = useState<{
    caNumber: string;
    newDoc: UploadedDocument;
    existingDoc: UploadedDocument;
  } | null>(null);

  // Inline/Row edit state (no prompt!)
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDocId, setEditDocId] = useState<string | null>(null);
  const [editCANumber, setEditCANumber] = useState("");

  // Document preview state
  const [previewDoc, setPreviewDoc] = useState<UploadedDocument | null>(null);
  const [activeDocData, setActiveDocData] = useState<string>("");

  // Lazy-load document data on preview demand
  useEffect(() => {
    if (previewDoc) {
      const savedData = localStorage.getItem(`tsd_doc_data_${previewDoc.id}`) || previewDoc.fileData || "";
      setActiveDocData(savedData);
    } else {
      setActiveDocData("");
    }
  }, [previewDoc]);

  // Load uploaded compliance documents with self-healing migration of legacy Base64 payloads
  useEffect(() => {
    const savedDocs = localStorage.getItem("tsd_uploaded_compliance_docs");
    if (savedDocs) {
      try {
        let parsed = JSON.parse(savedDocs) as UploadedDocument[];
        let migrated = false;

        // Perform self-healing migration of any inline Base64 data to separate keys
        parsed = parsed.map(doc => {
          if (doc.fileData) {
            localStorage.setItem(`tsd_doc_data_${doc.id}`, doc.fileData);
            migrated = true;
            const { fileData, ...rest } = doc;
            return rest;
          }
          return doc;
        });

        if (migrated) {
          localStorage.setItem("tsd_uploaded_compliance_docs", JSON.stringify(parsed));
        }

        setUploadedDocs(parsed);
      } catch (e) {
        console.error("Failed to parse compliance documents", e);
      }
    } else {
      // Seed initial compliance documents
      const initialDocs: UploadedDocument[] = [
        {
          id: "doc-1",
          fileName: "CA-2026-00481_Environmental_Clearance.pdf",
          fileSize: "1.2 MB",
          fileType: "PDF",
          uploadedAt: new Date().toLocaleDateString() + " 09:30 AM",
          caNumber: "CA-2026-00481",
          status: "Extracted"
        },
        {
          id: "doc-2",
          fileName: "DENR_Hazardous_Permit_CA_90184.docx",
          fileSize: "854 KB",
          fileType: "DOCX",
          uploadedAt: new Date().toLocaleDateString() + " 02:15 PM",
          caNumber: "CA-90184",
          status: "Extracted"
        }
      ];
      setUploadedDocs(initialDocs);
      localStorage.setItem("tsd_uploaded_compliance_docs", JSON.stringify(initialDocs));
    }
  }, []);

  const saveDocsToStorage = (updated: UploadedDocument[]) => {
    setUploadedDocs(updated);
    localStorage.setItem("tsd_uploaded_compliance_docs", JSON.stringify(updated));
  };

  const handleFile = (file: File) => {
    const allowedExtensions = ["pdf", "docx", "xlsx", "jpg", "jpeg", "png"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    
    if (!allowedExtensions.includes(ext)) {
      alert(`Invalid file format. Supported formats: PDF, DOCX, XLSX, JPG, JPEG, PNG`);
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSize) {
      alert(`File size exceeds 5MB limit. Please upload a smaller file.`);
      return;
    }

    const sizeStr = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + " MB" 
      : (file.size / 1024).toFixed(0) + " KB";

    setIsExtracting(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Data = e.target?.result as string;
      
      try {
        const response = await fetch("/api/compliance/extract", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("smei_jwt_token") || ""}`
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: ext.toUpperCase(),
            fileData: base64Data
          })
        });

        if (!response.ok) {
          throw new Error("Server extraction failed");
        }

        const result = await response.json();
        
        const formattedResult = {
          caNumber: result.caNumber === "NOT DETECTED" ? "" : result.caNumber,
          confidence: result.confidence,
          method: result.method,
          page: result.page,
          source: result.source,
          fileName: file.name,
          fileSize: sizeStr,
          fileType: ext.toUpperCase(),
          fileData: base64Data
        };

        // Automatic saving if high confidence (>=90) and detected successfully
        if (result.confidence >= 90 && result.caNumber !== "NOT DETECTED" && result.caNumber !== "") {
          const docId = `doc-${Date.now()}`;
          localStorage.setItem(`tsd_doc_data_${docId}`, base64Data);

          const docToSave: UploadedDocument = {
            id: docId,
            fileName: file.name,
            fileSize: sizeStr,
            fileType: ext.toUpperCase(),
            uploadedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            caNumber: result.caNumber.toUpperCase(),
            status: "Extracted"
          };
          checkAndSaveDoc(docToSave);
        } else {
          // Open manual review dialog
          setReviewData(formattedResult);
          setShowReviewModal(true);
        }
      } catch (err) {
        console.error("Extraction endpoint error:", err);
        alert("Unable to detect CA Number. Please enter it manually.");
        
        // Open manual review directly with blank entry and fallback label
        setReviewData({
          caNumber: "",
          confidence: 0,
          method: "Fallback Manual Parser",
          page: null,
          source: "N/A",
          fileName: file.name,
          fileSize: sizeStr,
          fileType: ext.toUpperCase(),
          fileData: base64Data
        });
        setShowReviewModal(true);
      } finally {
        setIsExtracting(false);
      }
    };

    reader.readAsDataURL(file);
  };

  const checkAndSaveDoc = (doc: UploadedDocument) => {
    // Exact duplicate detection (Step 6)
    const duplicate = uploadedDocs.find(
      d => d.caNumber.trim().toUpperCase() === doc.caNumber.trim().toUpperCase()
    );

    if (duplicate) {
      setDuplicateData({
        caNumber: doc.caNumber,
        newDoc: doc,
        existingDoc: duplicate
      });
      setShowDuplicateModal(true);
    } else {
      const updated = [doc, ...uploadedDocs];
      saveDocsToStorage(updated);
    }
  };

  const handleConfirmReview = () => {
    if (!reviewData) return;
    const finalCA = reviewData.caNumber.trim().toUpperCase();
    if (!finalCA) {
      alert("Please enter a valid CA Number.");
      return;
    }

    const docId = `doc-${Date.now()}`;
    if (reviewData.fileData) {
      localStorage.setItem(`tsd_doc_data_${docId}`, reviewData.fileData);
    }

    const docToSave: UploadedDocument = {
      id: docId,
      fileName: reviewData.fileName,
      fileSize: reviewData.fileSize,
      fileType: reviewData.fileType,
      uploadedAt: new Date().toLocaleDateString() + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      caNumber: finalCA,
      status: "Manual"
    };

    setShowReviewModal(false);
    setReviewData(null);
    checkAndSaveDoc(docToSave);
  };

  const handleReplaceDuplicate = () => {
    if (!duplicateData) return;
    const filtered = uploadedDocs.filter(
      d => d.caNumber.trim().toUpperCase() !== duplicateData.caNumber.trim().toUpperCase()
    );
    const duplicates = uploadedDocs.filter(
      d => d.caNumber.trim().toUpperCase() === duplicateData.caNumber.trim().toUpperCase()
    );
    duplicates.forEach(d => {
      localStorage.removeItem(`tsd_doc_data_${d.id}`);
    });
    const updated = [duplicateData.newDoc, ...filtered];
    saveDocsToStorage(updated);
    setShowDuplicateModal(false);
    setDuplicateData(null);
  };

  const handleKeepBothDuplicates = () => {
    if (!duplicateData) return;
    const updated = [duplicateData.newDoc, ...uploadedDocs];
    saveDocsToStorage(updated);
    setShowDuplicateModal(false);
    setDuplicateData(null);
  };

  const handleCancelDuplicate = () => {
    if (duplicateData?.newDoc) {
      localStorage.removeItem(`tsd_doc_data_${duplicateData.newDoc.id}`);
    }
    setShowDuplicateModal(false);
    setDuplicateData(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDeleteDoc = (id: string) => {
    if (confirm("Are you sure you want to permanently delete this document and its metadata?")) {
      const updated = uploadedDocs.filter(d => d.id !== id);
      saveDocsToStorage(updated);
      localStorage.removeItem(`tsd_doc_data_${id}`);
    }
  };

  const handleEditCA = (id: string, currentCA: string) => {
    setEditDocId(id);
    setEditCANumber(currentCA);
    setShowEditModal(true);
  };

  const handleSaveEdit = () => {
    if (!editDocId || !editCANumber.trim()) return;
    const updated = uploadedDocs.map(d => {
      if (d.id === editDocId) {
        return { ...d, caNumber: editCANumber.trim().toUpperCase(), status: "Manual" as const };
      }
      return d;
    });
    saveDocsToStorage(updated);
    setShowEditModal(false);
    setEditDocId(null);
  };

  const handleDownload = (doc: UploadedDocument) => {
    if (!doc.fileData) {
      alert("Source file data not persistent. Seeded documents have no active base64 payload.");
      return;
    }
    const link = document.createElement("a");
    link.href = doc.fileData;
    link.download = doc.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePreviewDoc = (doc: UploadedDocument) => {
    if (!doc.fileData) {
      alert("Source file data not persistent. Seeded documents have no active base64 payload.");
      return;
    }
    setPreviewDoc(doc);
  };

  const filteredDocs = uploadedDocs.filter(d => {
    const safeCaNumber = d.caNumber || "";
    const safeFileName = d.fileName || "";
    const term = (searchTerm || "").toLowerCase();
    const matchesSearch = safeCaNumber.toLowerCase().includes(term) || 
                          safeFileName.toLowerCase().includes(term);
    const matchesType = filterType === "All" || d.fileType === filterType;
    return matchesSearch && matchesType;
  });

  const getFileIcon = (type: string) => {
    switch (type) {
      case "PDF":
        return <FileText className="w-5 h-5 text-red-500 shrink-0" />;
      case "XLSX":
        return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
      case "DOCX":
        return <FileText className="w-5 h-5 text-blue-500 shrink-0" />;
      case "JPG":
      case "JPEG":
      case "PNG":
        return <FileText className="w-5 h-5 text-purple-500 shrink-0" />;
      default:
        return <File className="w-5 h-5 text-gray-400 shrink-0" />;
    }
  };

  return (
    <div id="smei-controlno-portal" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full">
      {/* Title block direct on page (matching reference design layout) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Compliance Control No. Document Manager
          </h2>
          <p className="text-xs md:text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Upload regulatory clearance documents to extract, store, and organize critical CA Numbers automatically.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Upload Compliance File Card */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-display uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-3">
            Upload Compliance File
          </h3>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragActive 
                ? "border-amber-500 bg-amber-500/5" 
                : "border-gray-200 dark:border-slate-800 hover:border-amber-500 hover:bg-slate-50/50 dark:hover:bg-slate-800/20"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
              accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
            />
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-950/20 flex items-center justify-center border border-amber-100 dark:border-amber-900/30">
                <UploadCloud className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Drag and drop file here, or click to browse
                </p>
                <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 font-mono">
                  Supports PDF, DOCX, XLSX, JPG, JPEG, PNG
                </p>
              </div>
            </div>
          </div>


        </div>

        {/* Directory & Table */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 font-display uppercase tracking-wider">
              Compliance Document Registry
            </h3>
            <span className="text-[10px] font-mono text-gray-500 dark:text-slate-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800">
              Total Count: {filteredDocs.length}
            </span>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search specifically by CA Number or File Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-700 dark:text-slate-200 font-mono"
              />
            </div>

            <div className="w-full sm:w-auto sm:min-w-[160px]">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="w-full pl-3 pr-8 py-2 bg-gray-50 dark:bg-slate-950 border border-gray-200 dark:border-slate-800 rounded-lg text-xs font-sans focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent focus:bg-white dark:focus:bg-slate-900 transition-all text-gray-700 dark:text-slate-200 font-mono font-bold cursor-pointer"
              >
                <option value="All">All Formats</option>
                <option value="PDF">PDF Only</option>
                <option value="DOCX">DOCX Only</option>
                <option value="XLSX">XLSX Only</option>
                <option value="JPG">JPG Only</option>
                <option value="PNG">PNG Only</option>
              </select>
            </div>
          </div>

          {/* Directory Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800/80">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 uppercase tracking-widest font-mono text-[9px] border-b border-slate-100 dark:border-slate-800">
                  <th className="py-3 px-4 font-display">File Format</th>
                  <th className="py-3 px-4 font-display">CA Number Reference</th>
                  <th className="py-3 px-4 font-display">File Details</th>
                  <th className="py-3 px-4 font-display">Extraction</th>
                  <th className="py-3 px-4 font-display text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                {filteredDocs.length > 0 ? (
                  filteredDocs.map((doc, index) => (
                    <tr 
                      key={doc.id} 
                      onDoubleClick={() => handlePreviewDoc(doc)}
                      className={`transition-colors cursor-pointer select-none ${
                        index % 2 === 1 
                          ? "bg-slate-50/30 dark:bg-slate-900/40 hover:bg-red-600/5 dark:hover:bg-red-600/10" 
                          : "bg-white dark:bg-slate-900 hover:bg-red-600/5 dark:hover:bg-red-600/10"
                      }`}
                      title="Double-click to preview document"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getFileIcon(doc.fileType)}
                          <span className="font-bold text-[10px] text-gray-500 dark:text-neutral-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-gray-200/50 dark:border-neutral-700/50">
                            {doc.fileType}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold text-xs px-2 py-0.5 rounded border select-all ${
                            doc.caNumber === "MANUAL-INPUT-REQUIRED" || doc.caNumber === "NOT DETECTED"
                              ? "bg-red-50 text-red-600 border-red-150 dark:bg-red-950/20 dark:text-rose-400 dark:border-red-900/30 animate-pulse"
                              : "bg-red-50 text-smei-crimson border-red-100 dark:bg-red-950/20 dark:text-rose-400 dark:border-red-900/30"
                          }`}>
                            {doc.caNumber}
                          </span>
                          <button
                            onClick={() => handleEditCA(doc.id, doc.caNumber)}
                            className="text-[9px] text-blue-500 hover:underline cursor-pointer"
                            title="Correct CA Reference"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5 max-w-[200px]">
                          <p className="font-sans font-bold text-slate-800 dark:text-white truncate" title={doc.fileName}>
                            {doc.fileName}
                          </p>
                          <p className="text-[10px] text-gray-400 dark:text-slate-500 flex items-center gap-1.5">
                            <span>Size: {doc.fileSize}</span>
                            <span>•</span>
                            <span>Uploaded: {doc.uploadedAt}</span>
                          </p>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider ${
                          doc.status === "Extracted"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/30"
                            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/30"
                        }`}>
                          {doc.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleDownload(doc)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer hover:scale-105 active:scale-95 ${
                              doc.fileData 
                                ? "text-gray-500 hover:text-amber-500 border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800" 
                                : "text-gray-300 border-gray-100 dark:border-slate-800 cursor-not-allowed bg-slate-50 dark:bg-slate-900"
                            }`}
                            disabled={!doc.fileData}
                            title="Download compliance file attachment"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteDoc(doc.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900 transition-all border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-950/20 cursor-pointer hover:scale-105 active:scale-95"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-gray-400 dark:text-slate-500 font-sans">
                      No compliance documents match your criteria. Upload one to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---------------- EXTRACTION ENGINE LOADING OVERLAY ---------------- */}
      {isExtracting && (
        <div id="extraction-loading-overlay" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-100 dark:border-slate-800 shadow-2xl max-w-sm w-full mx-4 text-center space-y-4">
            <div className="flex justify-center">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider font-display">
                Analyzing Compliance Document
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Running layout-aware extraction engine. Please wait...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MANUAL REVIEW MODAL (Step 7 / Priority 1-4) ---------------- */}
      {showReviewModal && reviewData && (
        <div id="manual-review-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest font-mono flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                Manual Review Required
              </h4>
              <span className="text-[10px] font-mono bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">
                Confidence: {reviewData.confidence}%
              </span>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Uploaded Document
                </label>
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  {getFileIcon(reviewData.fileType)}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate font-sans">
                      {reviewData.fileName}
                    </p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {reviewData.fileSize} • {reviewData.fileType}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  Extracted CA Number
                </label>
                <input
                  type="text"
                  value={reviewData.caNumber}
                  onChange={(e) => setReviewData({ ...reviewData, caNumber: e.target.value })}
                  placeholder="Enter or correct CA Number (e.g. CA-2026-001)"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-500 text-slate-800 dark:text-slate-200 uppercase"
                />
                <p className="text-[10px] text-slate-400 font-sans leading-normal">
                  The confidence score of <span className="font-bold">{reviewData.confidence}%</span> did not meet our 90% automation threshold. Please confirm or correct the value.
                </p>
              </div>

              <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-lg border border-slate-100 dark:border-slate-800 space-y-1 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                <div><span className="text-slate-400">Extraction Method:</span> {reviewData.method}</div>
                <div><span className="text-slate-400">Detected Page:</span> {reviewData.page || "N/A"}</div>
                <div><span className="text-slate-400">Context Source:</span> {reviewData.source}</div>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => { setShowReviewModal(false); setReviewData(null); }}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-mono"
              >
                Discard Upload
              </button>
              <button
                onClick={handleConfirmReview}
                className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- DUPLICATE WARNING MODAL (Step 6) ---------------- */}
      {showDuplicateModal && duplicateData && (
        <div id="duplicate-warning-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            <div className="bg-red-50 dark:bg-red-950/20 p-4 border-b border-red-100 dark:border-red-900/30 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-rose-400" />
              <h4 className="text-xs font-bold text-red-800 dark:text-rose-400 uppercase tracking-wider font-mono">
                Already Registered
              </h4>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
                The extracted CA Number <span className="font-mono font-bold text-red-600 dark:text-rose-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded border border-red-100 dark:border-red-900/30">{duplicateData.caNumber}</span> is already registered in the database.
              </p>

              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-lg border border-slate-100 dark:border-slate-800 space-y-2.5">
                <h5 className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  Existing Record
                </h5>
                <div className="space-y-1 font-mono text-xs text-slate-700 dark:text-slate-300">
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Name:</span>
                    <span className="font-sans font-bold truncate max-w-[200px]" title={duplicateData.existingDoc.fileName}>
                      {duplicateData.existingDoc.fileName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Upload Date:</span>
                    <span>{duplicateData.existingDoc.uploadedAt}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">File Type/Size:</span>
                    <span>{duplicateData.existingDoc.fileType} ({duplicateData.existingDoc.fileSize})</span>
                  </div>
                </div>
              </div>
              
              <p className="text-[10px] text-slate-400 leading-normal font-sans">
                Choose whether to replace the existing record with this new upload, keep both records under this CA number, or cancel the upload.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap justify-end gap-2">
              <button
                onClick={handleCancelDuplicate}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-mono"
              >
                Cancel Upload
              </button>
              <button
                onClick={handleKeepBothDuplicates}
                className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono"
              >
                Keep Both
              </button>
              <button
                onClick={handleReplaceDuplicate}
                className="bg-red-600 hover:bg-red-700 text-white px-3.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono"
              >
                Replace Existing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- CUSTOM ROW EDIT MODAL (No prompt!) ---------------- */}
      {showEditModal && (
        <div id="edit-ca-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-sm w-full mx-4 overflow-hidden">
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest font-mono">
                Modify CA Reference
              </h4>
            </div>
            <div className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="text-[10px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                  CA Number Reference
                </label>
                <input
                  type="text"
                  value={editCANumber}
                  onChange={(e) => setEditCANumber(e.target.value)}
                  placeholder="Enter CA Number Reference"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono focus:outline-none focus:ring-1 focus:ring-smei-crimson text-slate-800 dark:text-slate-200 uppercase"
                />
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950 p-3 px-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => { setShowEditModal(false); setEditDocId(null); }}
                className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-mono"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider font-mono"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- DOCUMENT PREVIEW MODAL ---------------- */}
      {previewDoc && (
        <div id="document-preview-modal" className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800 shadow-2xl max-w-4xl w-full h-[80vh] mx-4 overflow-hidden flex flex-col">
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-widest font-mono truncate">
                  Preview Document: {previewDoc.fileName}
                </h4>
                <p className="text-[10px] text-slate-400 font-mono">
                  {previewDoc.fileSize} • {previewDoc.fileType} • Ref: {previewDoc.caNumber}
                </p>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-bold uppercase tracking-wider font-mono cursor-pointer bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded"
              >
                Close
              </button>
            </div>
            <div className="p-4 flex-1 bg-slate-100 dark:bg-slate-950 overflow-auto flex items-center justify-center">
              {previewDoc.fileType.toUpperCase() === "PDF" ? (
                <iframe 
                  src={activeDocData} 
                  title={previewDoc.fileName}
                  className="w-full h-full rounded border border-slate-200 dark:border-slate-800"
                />
              ) : ["JPG", "JPEG", "PNG"].includes(previewDoc.fileType.toUpperCase()) ? (
                <img 
                  src={activeDocData} 
                  alt={previewDoc.fileName}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
                />
              ) : (
                <div className="text-center text-slate-500 py-10 font-sans">
                  Preview not supported in browser for {previewDoc.fileType}.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
