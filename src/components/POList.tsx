/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { PurchaseOrder, Supplier, User, UserRole } from "../types";
import { Search, Plus, Filter, Calendar, FileText, ArrowUpDown, Trash2, Edit3, Eye, Printer, FileSpreadsheet, Download } from "lucide-react";
import { ExcelTemplateDownloadButton, exportPOToExcel } from "./ExcelIO";
import { exportPOToWord } from "../utils/wordExport";
import { TableSkeleton } from "./ui/Skeleton";
import { ExportWordButton } from "./SharedButtons";

interface POListProps {
  pos: PurchaseOrder[];
  suppliers: Supplier[];
  currentUser: User;
  onSelectPO: (po: PurchaseOrder) => void;
  onAddNewPO: () => void;
  onDeletePO: (id: string) => void;
  onImportPOs: (imported: PurchaseOrder[]) => void;
  initialStatusFilter?: string;
}

// Memoized PO Row
const PORow = React.memo(({
  po,
  index,
  selectedPOId,
  statusColors,
  isAdmin,
  isStaff,
  setSelectedPOId,
  onSelectPO,
  onDeletePO
}: {
  po: PurchaseOrder;
  index: number;
  selectedPOId: string | null;
  statusColors: Record<string, string>;
  isAdmin: boolean;
  isStaff: boolean;
  setSelectedPOId: (id: string) => void;
  onSelectPO: (po: PurchaseOrder) => void;
  onDeletePO: (id: string) => void;
}) => {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async (po: PurchaseOrder) => {
    setIsExporting(true);
    await exportPOToWord(po);
    setIsExporting(false);
  };

  return (
    <tr
      key={po.id}
      onClick={() => setSelectedPOId(po.id)}
      onDoubleClick={() => onSelectPO(po)}
      className={`cursor-pointer transition-all group ${
        selectedPOId === po.id
          ? "bg-red-600/20 border-l-4 border-l-smei-crimson font-medium"
          : index % 2 === 1
          ? "bg-gray-50/45 hover:bg-red-600/10"
          : "bg-white hover:bg-red-600/10"
      }`}
      title="Double-click to View/Edit PO"
    >
      <td className="py-4 px-6 font-mono font-bold text-smei-darkred">
        <div className="flex items-center gap-2">
          {selectedPOId === po.id && (
            <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
          )}
          <span>{po.poNumber}</span>
        </div>
      </td>
      <td className="py-4 px-6 font-medium text-gray-800 max-w-xs truncate" title={po.supplierName}>
        {po.supplierName}
      </td>
      <td className="py-4 px-6">
        <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono font-semibold uppercase tracking-wide text-[10px]">
          {po.category}
        </span>
      </td>
      <td className="py-4 px-6 text-gray-500 font-mono">{po.poDate}</td>
      <td className="py-4 px-6 text-right font-mono font-bold text-gray-800">
        {new Intl.NumberFormat("en-PH", {
          style: "currency",
          currency: "PHP",
          minimumFractionDigits: 2
        }).format(po.totalAmount)}
      </td>
      <td className="py-4 px-6">
        <span className={`inline-flex px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border ${statusColors[po.status] || "bg-gray-100"}`}>
          {po.status}
        </span>
      </td>
      <td className="py-4 px-6 text-gray-600 font-medium">{po.preparedBy}</td>
      <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-center gap-1.5">
          <button
            onClick={() => onSelectPO(po)}
            className="p-1.5 hover:bg-red-50 hover:text-smei-crimson text-gray-400 hover:text-smei-crimson rounded-lg transition-all"
            title="View / Edit PO Form"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => exportPOToExcel(po)}
            className="p-1.5 hover:bg-green-50 hover:text-green-600 text-gray-400 hover:text-green-600 rounded-lg transition-all"
            title="Export Single PO to Excel"
          >
            <FileSpreadsheet className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleExport(po)}
            disabled={isExporting}
            className="p-1.5 hover:bg-blue-50 hover:text-[#2B579A] text-gray-400 hover:text-[#2B579A] rounded-lg transition-all disabled:opacity-50"
            title="Export Single PO to Word (.docx)"
          >
            <FileText className="w-4 h-4" />
          </button>
          
          {(isAdmin || (isStaff && po.status === "Draft")) && (
            <button
              onClick={() => {
                if (confirm(`Are you sure you want to delete purchase order ${po.poNumber}?`)) {
                  onDeletePO(po.id);
                }
              }}
              className="p-1.5 hover:bg-red-50 hover:text-smei-crimson text-gray-400 hover:text-smei-crimson rounded-lg transition-all"
              title="Delete PO"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
});

export default function POList({
  pos,
  suppliers,
  currentUser,
  onSelectPO,
  onAddNewPO,
  onDeletePO,
  onImportPOs,
  initialStatusFilter = "All"
}: POListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedPOId, setSelectedPOId] = useState<string | null>(pos.length > 0 ? pos[pos.length - 1].id : null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  useEffect(() => {
    if (pos.length > 0 && !selectedPOId) {
      setSelectedPOId(pos[pos.length - 1].id);
    }
  }, [pos, selectedPOId]);

  const isViewer = currentUser.role === UserRole.Viewer;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isAdmin = currentUser.role === UserRole.Administrator;

  // Filter purchase orders
  const filteredPOs = useMemo(() => {
    return [...pos]
      .reverse() // Latest first
      .filter((po) => {
        // 1. Search filter
        const term = searchQuery.toLowerCase();
        const matchesSearch =
          po.poNumber.toLowerCase().includes(term) ||
          po.supplierName.toLowerCase().includes(term) ||
          po.category.toLowerCase().includes(term) ||
          po.preparedBy.toLowerCase().includes(term) ||
          (po.approvedBy && po.approvedBy.toLowerCase().includes(term));

        // 2. Status filter
        const matchesStatus = statusFilter === "All" || po.status === statusFilter;

        // 3. Date Range filters
        let matchesDate = true;
        if (dateFrom) {
          matchesDate = matchesDate && po.poDate >= dateFrom;
        }
        if (dateTo) {
          matchesDate = matchesDate && po.poDate <= dateTo;
        }

        return matchesSearch && matchesStatus && matchesDate;
      });
  }, [pos, searchQuery, statusFilter, dateFrom, dateTo]);

  const statusColors: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    "Pending Review": "bg-amber-50 text-amber-700 border-amber-200",
    "Pending Approval": "bg-yellow-50 text-yellow-700 border-yellow-200",
    Approved: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
    Cancelled: "bg-orange-50 text-orange-700 border-orange-200",
    Closed: "bg-blue-50 text-blue-700 border-blue-200",
  };

  const handleExportAll = async () => {
    const targetPO = pos.find((p) => p.id === selectedPOId);
    if (targetPO) {
      setIsExporting(true);
      await exportPOToWord(targetPO);
      setIsExporting(false);
    }
  };

  return (
    <div id="smei-po-list" className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Upper Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight font-display">Purchase Orders Directory</h2>
          <p className="text-sm text-gray-500 mt-0.5">Create, revise, and generate compliance-validated Cavite EPZA procurement sheets</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <ExportWordButton
            onClick={handleExportAll}
            disabled={!selectedPOId || isExporting}
            selectedText={pos.find((p) => p.id === selectedPOId)?.poNumber || ""}
            label={isExporting ? "Generating..." : "Export Word"}
          />

          {!isViewer && (
            <button
              onClick={onAddNewPO}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-red-950/15 hover:shadow-red-950/20 active:scale-[0.98] transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Create Purchase Order</span>
            </button>
          )}
        </div>
      </div>


      {/* Advanced Searching & Filters Board */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Search Term */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Search Keywords</label>
            <div className="relative">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="PO#, supplier, category, authorizer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-1.5 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all"
              />
            </div>
          </div>

          {/* Workflow Status Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Workflow Status</label>
            <div className="relative">
              <Filter className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-1.5 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700"
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Pending Review">Pending Review</option>
                <option value="Pending Approval">Pending Approval</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Closed">Closed</option>
              </select>
            </div>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date From</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-1.5 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700 font-mono"
              />
            </div>
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Date To</label>
            <div className="relative">
              <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-sans focus:outline-none focus:ring-1.5 focus:ring-smei-crimson focus:border-transparent focus:bg-white transition-all text-gray-700 font-mono"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main PO Grid List */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-visible">
          <table id="smei-po-table" className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm">
              <tr className="text-gray-500 text-xs uppercase tracking-wider font-semibold border-b border-gray-100">
                <th className="py-4 px-6 font-display whitespace-nowrap">PO Number</th>
                <th className="py-4 px-6 font-display whitespace-nowrap">Supplier</th>
                <th className="py-4 px-6 font-display whitespace-nowrap">Purchase Category</th>
                <th className="py-4 px-6 font-display whitespace-nowrap">Creation Date</th>
                <th className="py-4 px-6 font-display text-right whitespace-nowrap">Gross Total Amount</th>
                <th className="py-4 px-6 font-display whitespace-nowrap">Workflow Status</th>
                <th className="py-4 px-6 font-display whitespace-nowrap">Prepared By</th>
                <th className="py-4 px-6 font-display text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs">
              {isExporting ? (
                <TableSkeleton rows={5} columns={8} />
              ) : filteredPOs.length > 0 ? (
                filteredPOs.map((po, index) => (
                  <PORow
                    key={po.id}
                    po={po}
                    index={index}
                    selectedPOId={selectedPOId}
                    statusColors={statusColors}
                    isAdmin={isAdmin}
                    isStaff={isStaff}
                    setSelectedPOId={setSelectedPOId}
                    onSelectPO={onSelectPO}
                    onDeletePO={onDeletePO}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-gray-400 font-sans">
                    No purchase orders match your filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
