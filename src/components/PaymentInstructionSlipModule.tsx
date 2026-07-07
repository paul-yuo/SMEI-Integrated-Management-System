/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { PaymentInstructionSlip, User, UserRole } from "../types";
import { api } from "../lib/api";
import { Search, Plus, Filter, Calendar, FileText, ArrowUpDown, Trash2, Edit3, Eye, FileSpreadsheet, X, Download } from "lucide-react";
import { exportWordWithTemplate, exportExcelWithTemplate } from "../utils/templateExport";
import { ExportExcelButton, CreateButton } from "./SharedButtons";
import { TableSkeleton } from "./ui/Skeleton";
import DocumentPreview from "./DocumentPreview";

interface PISModuleProps {
  currentUser: User;
}

export default function PaymentInstructionSlipModule({ currentUser }: PISModuleProps) {
  const [slips, setSlips] = useState<PaymentInstructionSlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currencyFilter, setCurrencyFilter] = useState("All");
  const [paymentModeFilter, setPaymentModeFilter] = useState("All");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<PaymentInstructionSlip | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSlipId, setActiveSlipId] = useState<string | null>(null);

  // Form State
  const [pisNumber, setPisNumber] = useState("");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [ampm, setAmpm] = useState<"AM" | "PM">("AM");
  const [payee, setPayee] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [gross, setGross] = useState<number>(0);
  const [ewt, setEwt] = useState<number>(0);
  const [total, setTotal] = useState<number>(0);
  const [currency, setCurrency] = useState<"PHP" | "USD" | "JP Yen" | "Others">("PHP");
  const [currencyOthers, setCurrencyOthers] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Check Crossed" | "Check Not Crossed" | "T/T" | "Others">("Cash");
  const [paymentModeOthers, setPaymentModeOthers] = useState("");
  const [remarks, setRemarks] = useState("");
  const [requestedBy, setRequestedBy] = useState(currentUser.fullName);
  const [requestedDate, setRequestedDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkedAndVerifiedBy, setCheckedAndVerifiedBy] = useState("");
  const [checkedAndVerifiedByPosition, setCheckedAndVerifiedByPosition] = useState("");
  const [verifiedBy, setVerifiedBy] = useState("");
  const [verifiedByPosition, setVerifiedByPosition] = useState("");
  const [verifiedByDate, setVerifiedByDate] = useState("");
  const [acceptedBy, setAcceptedBy] = useState("");
  const [acceptedByPosition, setAcceptedByPosition] = useState("");
  const [acceptedByDate, setAcceptedByDate] = useState("");
  const [status, setStatus] = useState<"Draft" | "Pending" | "Approved" | "Released" | "Cancelled">("Draft");

  // Error States
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = currentUser.role === UserRole.Administrator;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isAuthorized = isAdmin || isStaff;

  const fetchSlips = async () => {
    setLoading(true);
    try {
      const data = await api.getPIS();
      setSlips(data);
      if (data && data.length > 0) {
        setActiveSlipId(data[data.length - 1].id);
        setSelectedSlip(data[data.length - 1]);
      }
    } catch (err) {
      console.error("Error fetching PIS slips:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSlips();
  }, []);

  // Auto-calculate total and set amount whenever gross or ewt changes
  useEffect(() => {
    const computedTotal = Number((gross - (gross * (ewt / 100))).toFixed(2));
    setTotal(computedTotal);
    setAmount(computedTotal);
  }, [gross, ewt]);

  // Filter & Search Logic
  const filteredSlips = useMemo(() => {
    return slips.filter((slip) => {
      const matchesSearch =
        slip.pisNumber.toLowerCase().includes(search.toLowerCase()) ||
        slip.payee.toLowerCase().includes(search.toLowerCase()) ||
        (slip.remarks || "").toLowerCase().includes(search.toLowerCase());
      
      const matchesStatus = statusFilter === "All" || slip.status === statusFilter;
      const matchesCurrency = currencyFilter === "All" || slip.currency === currencyFilter;
      const matchesPaymentMode = paymentModeFilter === "All" || slip.paymentMode === paymentModeFilter;

      return matchesSearch && matchesStatus && matchesCurrency && matchesPaymentMode;
    });
  }, [slips, search, statusFilter, currencyFilter, paymentModeFilter]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSlips.length / itemsPerPage) || 1;
  const paginatedSlips = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSlips.slice(start, start + itemsPerPage);
  }, [filteredSlips, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, currencyFilter, paymentModeFilter]);

  useEffect(() => {
    if (isModalOpen) {
      window.dispatchEvent(new CustomEvent("smei-editor-opened"));
    } else {
      window.dispatchEvent(new CustomEvent("smei-editor-closed"));
    }
    return () => {
      window.dispatchEvent(new CustomEvent("smei-editor-closed"));
    };
  }, [isModalOpen]);

  const currentPISData = useMemo<PaymentInstructionSlip>(() => {
    return {
      id: selectedSlip?.id || "temp-pis-id",
      pisNumber,
      scheduleDate,
      scheduleTime,
      ampm,
      payee,
      gross,
      ewt,
      total,
      amount,
      currency,
      currencyOthers,
      paymentMode,
      paymentModeOthers,
      remarks,
      requestedBy,
      requestedDate,
      checkedAndVerifiedBy,
      checkedAndVerifiedByPosition,
      verifiedBy,
      verifiedByPosition,
      verifiedByDate,
      acceptedBy,
      acceptedByPosition,
      acceptedByDate,
      status,
      created_by: selectedSlip?.created_by || currentUser.fullName,
      createdAt: selectedSlip?.createdAt || new Date().toISOString()
    };
  }, [
    selectedSlip, pisNumber, scheduleDate, scheduleTime, ampm, payee, gross, ewt, total, amount,
    currency, currencyOthers, paymentMode, paymentModeOthers, remarks, requestedBy, requestedDate,
    checkedAndVerifiedBy, checkedAndVerifiedByPosition, verifiedBy, verifiedByPosition, verifiedByDate,
    acceptedBy, acceptedByPosition, acceptedByDate, status, currentUser
  ]);

  // Open modal for Create/View/Edit
  const handleOpenModal = async (slip: PaymentInstructionSlip | null = null, edit = false) => {
    setErrors({});
    if (slip) {
      setSelectedSlip(slip);
      setIsEditMode(edit);
      setPisNumber(slip.pisNumber);
      setScheduleDate(slip.scheduleDate);
      setScheduleTime(slip.scheduleTime);
      setAmpm(slip.ampm);
      setPayee(slip.payee);
      setGross(slip.gross !== undefined ? slip.gross : slip.amount);
      setEwt(slip.ewt !== undefined ? slip.ewt : 0);
      setTotal(slip.total !== undefined ? slip.total : slip.amount);
      setAmount(slip.amount);
      setCurrency(slip.currency);
      setCurrencyOthers(slip.currencyOthers || "");
      setPaymentMode(slip.paymentMode);
      setPaymentModeOthers(slip.paymentModeOthers || "");
      setRemarks(slip.remarks || "");
      setRequestedBy(slip.requestedBy);
      setRequestedDate(slip.requestedDate);
      setCheckedAndVerifiedBy(slip.checkedAndVerifiedBy || "");
      setCheckedAndVerifiedByPosition(slip.checkedAndVerifiedByPosition || "");
      setVerifiedBy(slip.verifiedBy || "");
      setVerifiedByPosition(slip.verifiedByPosition || "");
      setVerifiedByDate(slip.verifiedByDate || "");
      setAcceptedBy(slip.acceptedBy || "");
      setAcceptedByPosition(slip.acceptedByPosition || "");
      setAcceptedByDate(slip.acceptedByDate || "");
      setStatus(slip.status);
    } else {
      setSelectedSlip(null);
      setIsEditMode(true);
      setScheduleDate(new Date().toISOString().split("T")[0]);
      setScheduleTime("09:00");
      setAmpm("AM");
      setPayee("");
      setGross(0);
      setEwt(0);
      setTotal(0);
      setAmount(0);
      setCurrency("PHP");
      setCurrencyOthers("");
      setPaymentMode("Cash");
      setPaymentModeOthers("");
      setRemarks("");
      setRequestedBy(currentUser.fullName);
      setRequestedDate(new Date().toISOString().split("T")[0]);
      setCheckedAndVerifiedBy("");
      setCheckedAndVerifiedByPosition("");
      setVerifiedBy("");
      setVerifiedByPosition("");
      setVerifiedByDate("");
      setAcceptedBy("");
      setAcceptedByPosition("");
      setAcceptedByDate("");
      setStatus("Draft");

      // Fetch next auto-generated number
      try {
        const { nextNumber } = await api.getNextPISNumber();
        setPisNumber(nextNumber);
      } catch (err) {
        setPisNumber("");
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSlip(null);
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) return;

    // Client-side Validations
    const newErrors: Record<string, string> = {};
    
    if (!payee.trim()) newErrors.payee = "Payee is required.";
    if (gross === undefined || gross < 0) newErrors.gross = "Gross amount must be zero or a positive value.";
    if (ewt === undefined || ewt < 0 || ewt > 100) newErrors.ewt = "EWT must be between 0 and 100.";
    if (amount === undefined || amount < 0) newErrors.amount = "Amount must be zero or a positive value.";
    if (!scheduleDate) newErrors.scheduleDate = "Schedule date is required.";
    if (!pisNumber.trim()) {
      newErrors.pisNumber = "PIS Number is required.";
    } else {
      const format = /^PURC-PIS-\d{2}-\d{3}$/;
      if (!format.test(pisNumber)) {
        newErrors.pisNumber = "Invalid format. Expected: PURC-PIS-YY-### (e.g., PURC-PIS-26-001).";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: Partial<PaymentInstructionSlip> = {
      pisNumber,
      scheduleDate,
      scheduleTime,
      ampm,
      payee,
      amount,
      gross,
      ewt,
      total,
      currency,
      currencyOthers: currency === "Others" ? currencyOthers : "",
      paymentMode,
      paymentModeOthers: paymentMode === "Others" ? paymentModeOthers : "",
      remarks,
      requestedBy,
      requestedDate,
      checkedAndVerifiedBy,
      checkedAndVerifiedByPosition,
      verifiedBy,
      verifiedByPosition,
      verifiedByDate,
      acceptedBy,
      acceptedByPosition,
      acceptedByDate,
      status
    };

    try {
      if (selectedSlip) {
        // Edit Mode
        await api.updatePIS(selectedSlip.id, payload);
      } else {
        // Create Mode
        await api.createPIS(payload);
      }
      fetchSlips();
      handleCloseModal();
    } catch (err: any) {
      setErrors({ server: err.message || "An unexpected error occurred." });
    }
  };

  const handleDelete = async (id: string, num: string) => {
    if (confirm(`Are you sure you want to delete Payment Instruction Slip ${num}?`)) {
      try {
        await api.deletePIS(id);
        fetchSlips();
      } catch (err: any) {
        alert(err.message || "Error deleting PIS");
      }
    }
  };

  // Template-based Export
  const handleExport = async (slip: PaymentInstructionSlip, format: "word" | "excel") => {
     console.log("===== HANDLE EXPORT =====");
      console.log("Format:", format);
      console.log("PIS:", slip.pisNumber);

    const formattedAmount = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: slip.currency === "PHP" ? "PHP" : "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(slip.amount);

    const exportData = {
      PIS_NO: slip.pisNumber,
      SCHEDULE_DATE: slip.scheduleDate,
      PAYMENT_DATE: slip.scheduleDate, // Map to template placeholder
      SCHEDULE_TIME: `${slip.scheduleTime} ${slip.ampm}`,
      PAYEE: slip.payee,
      AMOUNT: formattedAmount,
      GROSS: new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: slip.currency === "Others" ? "PHP" : (slip.currency === "JP Yen" ? "JPY" : slip.currency),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(slip.gross !== undefined ? slip.gross : slip.amount),
      EWT: `${slip.ewt !== undefined ? slip.ewt : 0}%`,
      TOTAL: new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: slip.currency === "Others" ? "PHP" : (slip.currency === "JP Yen" ? "JPY" : slip.currency),
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(slip.total !== undefined ? slip.total : slip.amount),
      CURRENCY: slip.currency === "Others" ? slip.currencyOthers : slip.currency,
      PAYMENT_MODE: slip.paymentMode === "Others" ? slip.paymentModeOthers : slip.paymentMode,
      REMARKS: slip.remarks || "N/A",
      REQUESTED_BY: slip.requestedBy,
      REQUESTED_DATE: slip.requestedDate,
      CHECKED_BY: slip.checkedAndVerifiedBy || "N/A",
      VERIFIED_BY: slip.verifiedBy || "N/A",
      ACCEPTED_BY: slip.acceptedBy || "N/A",
      STATUS: slip.status,
    };

    if (format === "word") {
      await exportWordWithTemplate("PIS_TEMPLATE.docx", exportData, `${slip.pisNumber}_SMEI_PIS.docx`);
    } else {
      console.log("Calling exportExcelWithTemplate...");
      await exportExcelWithTemplate("PIS_TEMPLATE.xlsx", exportData, "items", [], `${slip.pisNumber}_SMEI_PIS.xlsx`);
    }
  };

  const statusColors: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-800 border-gray-300",
    Pending: "bg-amber-50 text-amber-700 border-amber-300 animate-pulse",
    Approved: "bg-green-50 text-green-700 border-green-300",
    Released: "bg-blue-50 text-blue-700 border-blue-300",
    Cancelled: "bg-rose-50 text-rose-700 border-rose-300"
  };

  const handleExportExcel = async () => {
    console.log("===== GREEN EXPORT BUTTON =====");

    if (!activeSlipId) {
      console.log("No PIS active row selected");
      alert("Please select one Payment Instruction Slip first.");
      return;
    }

    const slipToExport = slips.find((s) => s.id === activeSlipId);

    if (!slipToExport) {
      console.log("No matching slip found for ID:", activeSlipId);
      alert("Please select one Payment Instruction Slip first.");
      return;
    }

    console.log("Selected PIS:", slipToExport.pisNumber);
    await handleExport(slipToExport, "excel");
    console.log("handleExport finished");
  };



  return (
    <div id="smei-pis-list" className="p-6 md:p-10 space-y-6 max-w-7xl mx-auto">
      {/* Upper Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 tracking-tight font-display">Payment Instruction Slips [PIS]</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage purchasing payment instructions and financial authorizations</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" id="pis-module-root">
      {/* Search and Filters Header */}
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search PIS Number, Payee, Remarks..."
            className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-smei-crimson focus:border-transparent outline-none transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Filter controls and Actions */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <div className="w-[180px]">
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Status Filter</label>
              <select
                className="w-full text-xs border border-gray-200 rounded-md p-1.5 outline-none bg-white focus:border-smei-crimson"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
                <option value="Released">Released</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="w-[180px]">
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Currency Filter</label>
              <select
                className="w-full text-xs border border-gray-200 rounded-md p-1.5 outline-none bg-white focus:border-smei-crimson"
                value={currencyFilter}
                onChange={(e) => setCurrencyFilter(e.target.value)}
              >
                <option value="All">All Currencies</option>
                <option value="PHP">PHP (Pesos)</option>
                <option value="USD">USD (Dollars)</option>
                <option value="JP Yen">JP Yen</option>
                <option value="Others">Others</option>
              </select>
            </div>

            <div className="w-[180px]">
              <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Payment Mode Filter</label>
              <select
                className="w-full text-xs border border-gray-200 rounded-md p-1.5 outline-none bg-white focus:border-smei-crimson"
                value={paymentModeFilter}
                onChange={(e) => setPaymentModeFilter(e.target.value)}
              >
                <option value="All">All Payment Modes</option>
                <option value="Cash">Cash</option>
                <option value="Check Crossed">Check Crossed</option>
                <option value="Check Not Crossed">Check Not Crossed</option>
                <option value="T/T">T/T (Telegraphic Transfer)</option>
                <option value="Others">Others</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 w-full md:w-auto ml-auto">
            <ExportExcelButton
              onClick={handleExportExcel}
              disabled={!activeSlipId}
              selectedText={slips.find((s) => s.id === activeSlipId)?.pisNumber || ""}
            />
            {isAuthorized && (
              <CreateButton onClick={() => handleOpenModal(null)} label="Create PIS" />
            )}
          </div>
        </div>
      </div>

      {/* Split Layout for PIS Grid and Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start p-6">
        {/* Left Column: PIS Table */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-280px)] min-h-[500px]">
          <div className="overflow-x-auto flex-1 overflow-y-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead className="sticky top-0 bg-white z-10 shadow-sm">
                <tr className="bg-red-50/20 text-gray-600 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider">
                  <th className="py-4 px-6">PIS Number</th>
                  <th className="py-4 px-6">Payee</th>
                  <th className="py-4 px-6">Schedule</th>
                  <th className="py-4 px-6 text-right">Amount</th>
                  <th className="py-4 px-6">Payment Mode</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {loading ? (
                  <TableSkeleton rows={5} columns={7} />
                ) : paginatedSlips.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      No Payment Instruction Slips found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredSlips.map((slip, idx) => (
                    <tr
                      key={slip.id}
                      onClick={() => {
                          setActiveSlipId(slip.id);
                          setSelectedSlip(slip);
                      }}
                      onDoubleClick={() => handleOpenModal(slip, isAuthorized)}
                      className={`cursor-pointer transition-all border-b border-gray-50/60 group ${
                        activeSlipId === slip.id
                          ? "bg-red-600/20 border-l-4 border-l-smei-crimson font-medium"
                          : idx % 2 === 1
                          ? "bg-gray-50/30 hover:bg-red-600/10"
                          : "bg-white hover:bg-red-600/10"
                      }`}
                      title="Double-click to View/Edit details"
                    >
                      <td className="py-3 px-6 font-mono font-bold text-smei-darkred">
                        <div className="flex items-center gap-2">
                          {activeSlipId === slip.id && (
                            <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                          )}
                          <span>{slip.pisNumber}</span>
                        </div>
                      </td>
                      <td className="py-3 px-6 font-semibold text-gray-800">{slip.payee}</td>
                      <td className="py-3 px-6 text-gray-500 font-mono">
                        {slip.scheduleDate} {slip.scheduleTime} {slip.ampm}
                      </td>
                      <td className="py-3 px-6 text-right font-mono font-bold text-gray-800">
                        {new Intl.NumberFormat("en-PH", {
                          style: "currency",
                          currency: slip.currency === "Others" ? "PHP" : (slip.currency === "JP Yen" ? "JPY" : slip.currency),
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }).format(slip.amount)}
                      </td>
                      <td className="py-3 px-6 text-gray-600 text-xs">
                        {slip.paymentMode === "Others" ? slip.paymentModeOthers : slip.paymentMode}
                      </td>
                      <td className="py-3 px-6">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusColors[slip.status] || "bg-gray-100"}`}>
                          {slip.status}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenModal(slip, false)}
                            className="p-1 hover:bg-red-50 hover:text-smei-crimson text-gray-400 rounded transition-all"
                            title="View PIS details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {isAuthorized && (
                            <button
                              onClick={() => handleOpenModal(slip, true)}
                              className="p-1 hover:bg-blue-50 hover:text-blue-600 text-gray-400 rounded transition-all"
                              title="Edit PIS"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}

                          {isAuthorized && (
                            <button
                              onClick={() => handleDelete(slip.id, slip.pisNumber)}
                              className="p-1 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded transition-all"
                              title="Delete PIS"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
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
          {selectedSlip ? (
            <DocumentPreview
              moduleName="pis"
              format="excel"
              data={selectedSlip}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-slate-50 border border-slate-200 border-dashed rounded-xl p-8 text-slate-400">
              <FileText className="w-12 h-12 text-slate-300 mb-2 animate-pulse" />
              <p className="text-sm font-medium">Select a PIS document to display live preview</p>
            </div>
          )}
        </div>
      </div>

      {/* View/Create/Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-7xl overflow-hidden transition-all scale-100">
            <div className="bg-smei-crimson text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold uppercase tracking-wide">
                  {selectedSlip ? (isEditMode ? "Edit PIS Document" : "Payment Instruction Slip Details") : "Create New PIS Document"}
                </h3>
                <p className="text-[10px] text-red-100 font-medium">SMEI Purchasing Management <strong>Operations</strong></p>
              </div>
              <button onClick={handleCloseModal} className="text-white hover:text-red-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 max-h-[80vh] overflow-y-auto">
              {/* Left Column: Form Editor */}
              <div className="lg:col-span-6">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {errors.server && (
                    <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs p-3 rounded-md font-medium">
                      {errors.server}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* PIS Number */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">PIS Document Number: *</label>
                      <input
                        type="text"
                        required
                        disabled={!isEditMode}
                        className={`w-full text-sm font-mono font-semibold p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                          errors.pisNumber ? "border-rose-500 bg-rose-50/20" : "border-gray-200 bg-gray-50"
                        }`}
                        value={pisNumber}
                        onChange={(e) => setPisNumber(e.target.value)}
                        placeholder="PURC-PIS-YY-###"
                      />
                      {errors.pisNumber && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.pisNumber}</p>}
                    </div>

                    {/* Status */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Slip Status:</label>
                      <select
                        disabled={!isEditMode}
                        className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none"
                        value={status}
                        onChange={(e: any) => setStatus(e.target.value)}
                      >
                        <option value="Draft">Draft</option>
                        <option value="Pending">Pending Approval</option>
                        <option value="Approved">Approved</option>
                        <option value="Released">Released</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>

                    {/* Payee */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Payee Name: *</label>
                      <input
                        type="text"
                        required
                        disabled={!isEditMode}
                        placeholder="Enter recipient company or person"
                        className={`w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                          errors.payee ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                        }`}
                        value={payee}
                        onChange={(e) => setPayee(e.target.value)}
                      />
                      {errors.payee && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.payee}</p>}
                    </div>

                    {/* Gross, EWT, and Total Calculations */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50/80 p-4 rounded-xl border border-gray-100">
                      {/* Gross */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Gross Amount:</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-gray-400">₱</span>
                          <input
                            type="number"
                            step="any"
                            disabled={!isEditMode}
                            placeholder="0.00"
                            className={`w-full text-sm pl-7 pr-2 p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none ${
                              errors.gross ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                            }`}
                            value={gross === 0 ? "" : gross}
                            onChange={(e) => setGross(e.target.value === "" ? 0 : Number(e.target.value))}
                          />
                        </div>
                        {errors.gross && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.gross}</p>}
                      </div>

                      {/* EWT (%) */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">EWT (%):</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="any"
                            disabled={!isEditMode}
                            placeholder="0.00"
                            className={`w-full text-sm pr-7 p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none ${
                              errors.ewt ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                            }`}
                            value={ewt === 0 ? "" : ewt}
                            onChange={(e) => setEwt(e.target.value === "" ? 0 : Number(e.target.value))}
                          />
                          <span className="absolute right-3 top-2 text-xs font-bold text-gray-400">%</span>
                        </div>
                        {errors.ewt && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.ewt}</p>}
                      </div>

                      {/* Total */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Total Net Amount:</label>
                        <div className="relative">
                          <span className="absolute left-3 top-2 text-xs font-bold text-gray-500">₱</span>
                          <input
                            type="number"
                            disabled
                            placeholder="0.00"
                            className="w-full text-sm pl-7 pr-2 p-2 border border-gray-100 rounded-lg bg-gray-100 font-mono font-bold text-gray-700 outline-none"
                            value={total}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Schedule Date */}
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Schedule Date to Pay: *</label>
                      <input
                        type="date"
                        required
                        disabled={!isEditMode}
                        className={`w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                          errors.scheduleDate ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                        }`}
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                      />
                      {errors.scheduleDate && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.scheduleDate}</p>}
                    </div>

                    {/* Blank element to balance row */}
                    <div className="hidden md:block"></div>

                    {/* Consolidated Time, Payment Mode, and Currency Row */}
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Schedule Time */}
                      <div className="flex gap-2">
                        <div className="w-2/3">
                          <label className="block text-xs font-bold text-gray-700 mb-1">Time:</label>
                          <input
                            type="time"
                            disabled={!isEditMode}
                            className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                          />
                        </div>
                        <div className="w-1/3">
                          <label className="block text-xs font-bold text-gray-700 mb-1">AM/PM:</label>
                          <select
                            disabled={!isEditMode}
                            className="w-full text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none"
                            value={ampm}
                            onChange={(e: any) => setAmpm(e.target.value)}
                          >
                            <option value="AM">AM</option>
                            <option value="PM">PM</option>
                          </select>
                        </div>
                      </div>

                      {/* Payment Mode */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Payment Mode:</label>
                        <div className="flex gap-2">
                          <select
                            disabled={!isEditMode}
                            className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none"
                            value={paymentMode}
                            onChange={(e: any) => setPaymentMode(e.target.value)}
                          >
                            <option value="Cash">Cash</option>
                            <option value="Check Crossed">Check Crossed</option>
                            <option value="Check Not Crossed">Check Not Crossed</option>
                            <option value="T/T">T/T</option>
                            <option value="Others">Others</option>
                          </select>
                          {paymentMode === "Others" && (
                            <input
                              type="text"
                              required
                              disabled={!isEditMode}
                              placeholder="Specify mode"
                              className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                              value={paymentModeOthers}
                              onChange={(e) => setPaymentModeOthers(e.target.value)}
                            />
                          )}
                        </div>
                      </div>

                      {/* Currency */}
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Currency:</label>
                        <div className="flex gap-2">
                          <select
                            disabled={!isEditMode}
                            className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson bg-white outline-none"
                            value={currency}
                            onChange={(e: any) => setCurrency(e.target.value)}
                          >
                            <option value="PHP">PHP</option>
                            <option value="USD">USD</option>
                            <option value="JP Yen">JP Yen</option>
                            <option value="Others">Others</option>
                          </select>
                          {currency === "Others" && (
                            <input
                              type="text"
                              required
                              disabled={!isEditMode}
                              placeholder="Specify"
                              className="w-1/2 text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                              value={currencyOthers}
                              onChange={(e) => setCurrencyOthers(e.target.value)}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remarks / Narrative (Increased width to col-span-2) */}
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-700 mb-1">Remarks / Narrative</label>
                      <input
                        type="text"
                        disabled={!isEditMode}
                        placeholder="e.g. For structural casting downpayment"
                        className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Signatories Section */}
                  <div className="border-t border-gray-100 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide mb-3">Signatories & Authorizations</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Requested By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50/50"
                          value={requestedBy}
                          onChange={(e) => setRequestedBy(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Checked & Verified By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson"
                          value={checkedAndVerifiedBy}
                          onChange={(e) => setCheckedAndVerifiedBy(e.target.value)}
                          placeholder="Name of verifier"
                        />
                        <div className="mt-1.5">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Position:</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs p-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-smei-crimson"
                            value={checkedAndVerifiedByPosition}
                            onChange={(e) => setCheckedAndVerifiedByPosition(e.target.value)}
                            placeholder="Position"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acceptance and Verification Section */}
                  <div className="border-t border-dashed border-gray-300 my-4 pt-4">
                    {/* Notice Text */}
                    <div className="text-center bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 mb-4 font-semibold text-xs tracking-wide">
                      ⚠ For Encashment and Irregular Transactions Only
                    </div>
                    
                    <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide mb-3">Acceptance and Verification</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Column: Accepted By */}
                      <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50/30">
                        <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">Accepted By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                          value={acceptedBy}
                          onChange={(e) => setAcceptedBy(e.target.value)}
                          placeholder="Name of accepting officer"
                        />
                        <div className="mt-1.5">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Position:</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs p-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-smei-crimson"
                            value={acceptedByPosition}
                            onChange={(e) => setAcceptedByPosition(e.target.value)}
                            placeholder="Position"
                          />
                        </div>
                      </div>

                      {/* Right Column: Verified By */}
                      <div className="space-y-2 border border-gray-100 rounded-lg p-3 bg-gray-50/30">
                        <label className="block text-[10px] uppercase font-bold text-gray-600 mb-1">Verified By:</label>
                        <input
                          type="text"
                          disabled={!isEditMode}
                          className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                          value={verifiedBy}
                          onChange={(e) => setVerifiedBy(e.target.value)}
                          placeholder="Name of verifier"
                        />
                        <div className="mt-1.5">
                          <label className="block text-[10px] uppercase font-bold text-gray-400 mb-0.5">Position:</label>
                          <input
                            type="text"
                            disabled={!isEditMode}
                            className="w-full text-xs p-1.5 border border-gray-200 rounded-md outline-none focus:ring-1 focus:ring-smei-crimson"
                            value={verifiedByPosition}
                            onChange={(e) => setVerifiedByPosition(e.target.value)}
                            placeholder="Position"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Form Buttons */}
                  <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-4 mt-6">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      {isEditMode ? "Cancel" : "Close"}
                    </button>
                    {isEditMode && (
                      <button
                        type="submit"
                        className="px-5 py-2 bg-smei-crimson hover:bg-smei-darkred text-white text-sm font-semibold rounded-lg shadow-xs"
                      >
                        Save Changes
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Right Column: Live Document Preview */}
              <div className="lg:col-span-6 h-[450px] lg:h-[70vh] sticky top-0">
                <DocumentPreview
                  moduleName="pis"
                  format="excel"
                  data={currentPISData}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
);
}
