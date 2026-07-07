import React, { useState, useEffect, useMemo } from "react";
import { RequestForSupply, User, UserRole } from "../types";
import { api } from "../lib/api";
import { Search, Filter, Edit3, Eye, X, FileSpreadsheet, FileText } from "lucide-react";
import { TableSkeleton } from "./ui/Skeleton";
import { exportWordWithTemplate, exportExcelWithTemplate } from "../utils/templateExport";
import { ExportExcelButton } from "./SharedButtons";
import DocumentPreview from "./DocumentPreview";
import { formatRFSNo } from "../utils/templateMapping";

interface RfsApprovalModuleProps {
  currentUser: User;
}

export default function RfsApprovalModule({ currentUser }: RfsApprovalModuleProps) {
  const [requests, setRequests] = useState<RequestForSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [selectedRFS, setSelectedRFS] = useState<RequestForSupply | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState<"Complete" | "Incomplete" | "On Time" | "Late">("Incomplete");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await api.getRFS();
      setRequests(data);
    } catch (error) {
      console.error("Error fetching RFS:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesSearch =
        req.rfsNumber.toLowerCase().includes(search.toLowerCase()) ||
        req.department.toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requests, search, statusFilter]);

  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequests.slice(start, start + itemsPerPage);
  }, [filteredRequests, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const currentRFSData = useMemo<RequestForSupply | null>(() => {
    if (!selectedRFS) return null;
    return {
      ...selectedRFS,
      dueDate,
      status,
    };
  }, [selectedRFS, dueDate, status]);

  const handleOpenModal = (req: RequestForSupply) => {
    setSelectedRFS(req);
    setDueDate(req.dueDate || "");
    setStatus(req.status || "Incomplete");
    setError("");
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRFS) return;
    
    setError("");
    setIsSaving(true);
    try {
      await api.updateRFS(selectedRFS.id, {
        dueDate,
        status,
      });
      setIsModalOpen(false);
      fetchRequests();
    } catch (err: any) {
      setError(err.message || "Failed to update RFS Approval details.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = async (req: RequestForSupply, format: "word" | "excel") => {
    try {
      const formattedRFS = formatRFSNo(req.rfsNumber, req.dateRequested);
      const exportData = {
        RFS_NO: formattedRFS,
        REQUEST_DATE: req.dateRequested,
        DUE_DATE: req.dueDate || "",
        RECEIVED_DATE: req.dueDate || "", // Map to template placeholder
        DEPARTMENT: req.department === "Others" ? req.departmentOthers : req.department,
        CONTROL_NO: formattedRFS,
        PO_NO: req.purchaseOrderNumber || "N/A",
        STATUS: req.status,
        MODE: req.modeOfRequest,
        PURPOSE: req.purpose,
        REQUESTED_BY: req.requestedBy,
        VERIFIED_BY: req.verifiedBy || "N/A",
        APPROVED_BY: req.approvedBy || "N/A",
      };

      const exportItems = (req.items || []).map((it, index) => ({
        index: index + 1,
        quantity: it.quantity,
        unit: it.unit,
        description: it.description,
        lastPurchaseDate: it.lastPurchaseDate || "N/A",
        lastPurchaseQuantity: it.lastPurchaseQuantity || 0,
        lastPurchaseUnitPrice: it.lastPurchaseUnitPrice || 0,
        currentPurchaseDate: it.currentPurchaseDate || "N/A",
        currentPurchaseQuantity: it.currentPurchaseQuantity || 0,
        currentPurchaseUnitPrice: it.currentPurchaseUnitPrice || 0,
        remarks: it.remarks || "N/A",
      }));

      if (format === "word") {
        await exportWordWithTemplate("RFS_TEMPLATE.docx", { ...exportData, items: exportItems }, `${formattedRFS}_SMEI_RFS.docx`);
      } else {
        await exportExcelWithTemplate("RFS_TEMPLATE.xlsx", exportData, "items", exportItems, `${formattedRFS}_SMEI_RFS.xlsx`);
      }
    } catch (err: any) {
      console.error("Export error:", err);
      alert("Failed to export RFS. Make sure templates are placed in public/templates/ directory.");
    }
  };

  const statusColors: Record<string, string> = {
    Complete: "bg-green-50 text-green-700 border-green-300",
    Incomplete: "bg-gray-100 text-gray-700 border-gray-300",
    "On Time": "bg-blue-50 text-blue-700 border-blue-300",
    Late: "bg-rose-50 text-rose-700 border-rose-300"
  };

  const modeColors: Record<string, string> = {
    Emergency: "bg-red-50 text-red-700 border-red-200 font-bold",
    Urgent: "bg-orange-50 text-orange-700 border-orange-200 font-bold",
    Regular: "bg-gray-50 text-gray-700 border-gray-200",
    Irregular: "bg-amber-50 text-amber-700 border-amber-200"
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto overflow-x-hidden">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight font-display uppercase flex items-center gap-2">
            RFS Approval
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage Supply Delivery Status and Due Dates for RFS</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Excel Export Action Bar */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/30 flex flex-col sm:flex-row gap-3 justify-between items-center">
          <ExportExcelButton
            onClick={() => {
              if (selectedRFS) {
                handleExport(selectedRFS, "excel");
              }
            }}
            disabled={!selectedRFS}
            selectedText={selectedRFS ? formatRFSNo(selectedRFS.rfsNumber, selectedRFS.dateRequested) : ""}
          />
        </div>

        {/* Filters */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search Control No or Department..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-smei-crimson focus:border-transparent bg-white"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                className="w-full md:w-auto text-sm border border-gray-200 rounded-lg p-2 outline-none bg-white focus:border-smei-crimson"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Incomplete">Incomplete</option>
                <option value="Complete">Complete</option>
                <option value="On Time">On Time</option>
                <option value="Late">Late</option>
              </select>
            </div>
          </div>
        </div>

        {/* Split Layout for RFS Grid and Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start p-6">
          {/* Left Column: Table */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
            <div className="overflow-x-auto flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                  <tr className="bg-red-50/20 text-gray-600 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider">
                    <th className="py-4 px-6">Control No.</th>
                    <th className="py-4 px-6">Department</th>
                    <th className="py-4 px-6">Mode</th>
                    <th className="py-4 px-6">Due Date</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    <TableSkeleton rows={5} columns={6} />
                  ) : paginatedRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span className="text-sm">No requests found matching your filters.</span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRequests.map((req, idx) => (
                      <tr 
                        key={req.id} 
                        onClick={() => setSelectedRFS(req)}
                        onDoubleClick={() => handleOpenModal(req)}
                        className={`group transition-all border-b border-gray-100 cursor-pointer ${
                          selectedRFS?.id === req.id
                            ? "bg-red-600/10 border-l-4 border-l-smei-crimson font-medium"
                            : idx % 2 === 1
                            ? "bg-gray-50/30 hover:bg-red-600/5"
                            : "bg-white hover:bg-red-600/5"
                        }`}
                        title="Click to select for export, Double-click to open details/edit"
                      >
                        <td className="py-3 px-6 font-mono font-bold text-smei-darkred">
                          <div className="flex items-center gap-2">
                            {selectedRFS?.id === req.id && (
                              <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                            )}
                            <span>{formatRFSNo(req.rfsNumber, req.dateRequested)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-6 text-gray-700 font-semibold text-xs">
                          {req.department === "Others" ? req.departmentOthers : req.department}
                        </td>
                        <td className="py-3 px-6">
                          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] border ${modeColors[req.modeOfRequest] || "bg-gray-100"}`}>
                            {req.modeOfRequest}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-gray-500 font-mono">
                          {req.dueDate || <span className="text-gray-300 italic">Not set</span>}
                        </td>
                        <td className="py-3 px-6">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColors[req.status] || "bg-gray-100"}`}>
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenModal(req)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                              title="Update Status & Due Date"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleExport(req, "excel")}
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                              title="Export to Excel"
                            >
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Column: Live Document Preview */}
          <div className="lg:col-span-7 h-[calc(100vh-280px)] min-h-[500px] sticky top-6">
            {selectedRFS ? (
              <DocumentPreview
                moduleName="rfs"
                format="excel"
                data={selectedRFS}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-slate-400">
                <FileText className="w-12 h-12 text-slate-300 mb-2 animate-pulse" />
                <p className="text-sm font-medium">Select an RFS document to display live preview</p>
              </div>
            )}
          </div>
        </div>

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <span className="text-xs text-gray-500 font-medium">
              Showing <span className="font-bold text-gray-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-700">{Math.min(currentPage * itemsPerPage, filteredRequests.length)}</span> of <span className="font-bold text-gray-700">{filteredRequests.length}</span> entries
            </span>
            <div className="flex gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Previous
              </button>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isModalOpen && selectedRFS && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl border border-gray-100 flex flex-col overflow-hidden animate-scaleIn">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-red-700 to-red-600 text-white">
              <h3 className="font-bold tracking-wide flex items-center gap-2 text-sm">
                <Edit3 className="w-4 h-4" /> RFS Approval (Control No: {formatRFSNo(selectedRFS.rfsNumber, selectedRFS.dateRequested)})
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-white/20 rounded-md transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-h-[80vh] overflow-y-auto">
              {/* Left Column: Form Editor */}
              <div className="lg:col-span-7">
                <form onSubmit={handleSave} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2 rounded-lg">
                      {error}
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Supply Delivery Status:</label>
                    <select
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-white outline-none focus:ring-1 focus:ring-smei-crimson"
                      value={status}
                      onChange={(e: any) => setStatus(e.target.value)}
                    >
                      <option value="Incomplete">Incomplete</option>
                      <option value="Complete">Complete</option>
                      <option value="On Time">On Time</option>
                      <option value="Late">Late</option>
                    </select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Due Date:</label>
                    <input
                      type="date"
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson outline-none"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>

                  <div className="pt-4 flex justify-end gap-2 border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => handleExport(selectedRFS, "excel")}
                      className="mr-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-all font-semibold shadow flex items-center gap-1.5 text-xs"
                    >
                      <FileSpreadsheet className="w-4 h-4" /> Export Excel
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-all font-semibold text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-4 py-2 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 text-white rounded-lg transition-all font-semibold shadow flex items-center gap-2 text-xs"
                    >
                      {isSaving ? "Saving..." : "Save Approval"}
                    </button>
                  </div>
                </form>
              </div>

              {/* Right Column: Live Document Preview */}
              <div className="lg:col-span-5 h-[450px] lg:h-[70vh] sticky top-0">
                {currentRFSData && (
                  <DocumentPreview
                    moduleName="rfs"
                    format="excel"
                    data={currentRFSData}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
