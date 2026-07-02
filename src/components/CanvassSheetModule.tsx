/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { CanvassSheet, CanvassItem, User, UserRole } from "../types";
import { api } from "../lib/api";
import { Search, Plus, Filter, Calendar, FileText, ArrowUpDown, Trash2, Edit3, Eye, FileSpreadsheet, X, Download, Trash, Calculator } from "lucide-react";
import { exportWordWithTemplate, exportExcelWithTemplate } from "../utils/templateExport";
import { ExportExcelButton, CreateButton, exportListToExcel } from "./SharedButtons";
import { TableSkeleton } from "./ui/Skeleton";

interface CanvassModuleProps {
  currentUser: User;
}

export default function CanvassSheetModule({ currentUser }: CanvassModuleProps) {
  const [sheets, setSheets] = useState<CanvassSheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSheet, setSelectedSheet] = useState<CanvassSheet | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);

  // Form State
  const [canvassNumber, setCanvassNumber] = useState("");
  const [canvassDate, setCanvassDate] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [address, setAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [requestedBy, setRequestedBy] = useState(currentUser.fullName);
  const [checkedBy, setCheckedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");

  // Items State
  const [items, setItems] = useState<CanvassItem[]>([]);

  // Computed Fields
  const [lowestPrice, setLowestPrice] = useState(0);
  const [recommendedSupplier, setRecommendedSupplier] = useState("N/A");
  const [totalCost, setTotalCost] = useState(0);

  // Error States
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isAdmin = currentUser.role === UserRole.Administrator;
  const isStaff = currentUser.role === UserRole.PurchasingStaff;
  const isAuthorized = isAdmin || isStaff;

  const fetchSheets = async () => {
    setLoading(true);
    try {
      const data = await api.getCanvass();
      setSheets(data);
    } catch (err) {
      console.error("Error fetching canvass sheets:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSheets();
  }, []);

  // Recalculate automatic computations live when items change
  useEffect(() => {
    let totalA = 0;
    let totalB = 0;
    let totalC = 0;
    let calculatedTotalCost = 0;

    items.forEach((item) => {
      const qty = Number(item.quantity) || 0;
      const priceA = Number(item.supplierAPrice) || 0;
      const priceB = Number(item.supplierBPrice) || 0;
      const priceC = Number(item.supplierCPrice) || 0;

      totalA += priceA * qty;
      totalB += priceB * qty;
      totalC += priceC * qty;

      let selectedPrice = 0;
      if (item.selectedSupplier === "Supplier A") selectedPrice = priceA;
      else if (item.selectedSupplier === "Supplier B") selectedPrice = priceB;
      else if (item.selectedSupplier === "Supplier C") selectedPrice = priceC;

      calculatedTotalCost += selectedPrice * qty;
    });

    const prices = [];
    if (totalA > 0) prices.push({ name: "Supplier A", total: totalA });
    if (totalB > 0) prices.push({ name: "Supplier B", total: totalB });
    if (totalC > 0) prices.push({ name: "Supplier C", total: totalC });

    let calculatedLowestPrice = 0;
    let calculatedRecommended = "N/A";

    if (prices.length > 0) {
      prices.sort((a, b) => a.total - b.total);
      calculatedLowestPrice = prices[0].total;
      calculatedRecommended = prices[0].name;
    }

    setLowestPrice(calculatedLowestPrice);
    setRecommendedSupplier(calculatedRecommended);
    setTotalCost(calculatedTotalCost);
  }, [items]);

  // Filter & Search Logic
  const filteredSheets = useMemo(() => {
    return sheets.filter((sheet) => {
      return (
        sheet.canvassNumber.toLowerCase().includes(search.toLowerCase()) ||
        sheet.supplierName.toLowerCase().includes(search.toLowerCase()) ||
        (sheet.recommendedSupplier || "").toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [sheets, search]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredSheets.length / itemsPerPage) || 1;
  const paginatedSheets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredSheets.slice(start, start + itemsPerPage);
  }, [filteredSheets, currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  // Open modal for Create/View/Edit
  const handleOpenModal = async (sheet: CanvassSheet | null = null, edit = false) => {
    setErrors({});
    if (sheet) {
      setSelectedSheet(sheet);
      setIsEditMode(edit);
      setCanvassNumber(sheet.canvassNumber);
      setCanvassDate(sheet.canvassDate);
      setSupplierName(sheet.supplierName);
      setAddress(sheet.address || "");
      setContactPerson(sheet.contactPerson || "");
      setPhoneNumber(sheet.phoneNumber || "");
      setEmail(sheet.email || "");
      setRequestedBy(sheet.requestedBy);
      setCheckedBy(sheet.checkedBy || "");
      setApprovedBy(sheet.approvedBy || "");
      setItems(sheet.items || []);
    } else {
      setSelectedSheet(null);
      setIsEditMode(true);
      setCanvassDate(new Date().toISOString().split("T")[0]);
      setSupplierName("");
      setAddress("");
      setContactPerson("");
      setPhoneNumber("");
      setEmail("");
      setRequestedBy(currentUser.fullName);
      setCheckedBy("");
      setApprovedBy("");
      setItems([
        {
          id: `item_${Date.now()}_0`,
          item: "",
          specification: "",
          quantity: 1,
          unit: "pcs",
          supplierAPrice: 0,
          supplierBPrice: 0,
          supplierCPrice: 0,
          selectedSupplier: "Supplier A",
          remarks: ""
        }
      ]);

      // Fetch next auto-generated number
      try {
        const { nextNumber } = await api.getNextCanvassNumber();
        setCanvassNumber(nextNumber);
      } catch (err) {
        setCanvassNumber("");
      }
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedSheet(null);
  };

  // Items manipulation helpers
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `item_${Date.now()}_${prev.length}`,
        item: "",
        specification: "",
        quantity: 1,
        unit: "pcs",
        supplierAPrice: 0,
        supplierBPrice: 0,
        supplierCPrice: 0,
        selectedSupplier: "Supplier A",
        remarks: ""
      }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert("At least one item is required.");
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof CanvassItem, value: any) => {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, [field]: value } : it))
    );
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditMode) return;

    // Client-side Validations
    const newErrors: Record<string, string> = {};
    
    if (!supplierName.trim()) newErrors.supplierName = "Primary Supplier Name is required.";
    if (!canvassDate) newErrors.canvassDate = "Canvass date is required.";
    
    if (!canvassNumber.trim()) {
      newErrors.canvassNumber = "Canvass Number is required.";
    } else {
      const format = /^CANVASS-\d{2}-\d{3}$/;
      if (!format.test(canvassNumber)) {
        newErrors.canvassNumber = "Invalid format. Expected: CANVASS-YY-### (e.g., CANVASS-26-001).";
      }
    }

    // Validate Items
    if (items.length === 0) {
      newErrors.items = "Canvass Sheet must contain at least one item.";
    } else {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.item.trim()) {
          newErrors.items = `Item #${i + 1} name is required.`;
          break;
        }
        if (Number(item.quantity) <= 0) {
          newErrors.items = `Item #${i + 1} quantity must be greater than zero.`;
          break;
        }
        if (Number(item.supplierAPrice) < 0 || Number(item.supplierBPrice) < 0 || Number(item.supplierCPrice) < 0) {
          newErrors.items = `Item #${i + 1} pricing columns cannot contain negative amounts.`;
          break;
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: Partial<CanvassSheet> = {
      canvassNumber,
      canvassDate,
      supplierName,
      address,
      contactPerson,
      phoneNumber,
      email,
      items,
      lowestPrice,
      recommendedSupplier,
      totalCost,
      requestedBy,
      checkedBy,
      approvedBy
    };

    try {
      if (selectedSheet) {
        // Edit Mode
        await api.updateCanvass(selectedSheet.id, payload);
      } else {
        // Create Mode
        await api.createCanvass(payload);
      }
      fetchSheets();
      handleCloseModal();
    } catch (err: any) {
      setErrors({ server: err.message || "An unexpected error occurred." });
    }
  };

  const handleDelete = async (id: string, num: string) => {
    if (confirm(`Are you sure you want to delete Canvass Sheet ${num}?`)) {
      try {
        await api.deleteCanvass(id);
        fetchSheets();
      } catch (err: any) {
        alert(err.message || "Error deleting Canvass Sheet");
      }
    }
  };

  // Template-based Export
  const handleExport = async (sheet: CanvassSheet, format: "word" | "excel") => {
    const formattedLowest = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(sheet.lowestPrice);

    const formattedTotal = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(sheet.totalCost);

    const exportData = {
      CANVASS_NO: sheet.canvassNumber,
      CANVASS_DATE: sheet.canvassDate,
      SUPPLIER_NAME: sheet.supplierName,
      ADDRESS: sheet.address || "N/A",
      CONTACT: sheet.contactPerson || "N/A",
      PHONE: sheet.phoneNumber || "N/A",
      EMAIL: sheet.email || "N/A",
      LOWEST_PRICE: formattedLowest,
      RECOMMENDED_SUPPLIER: sheet.recommendedSupplier,
      TOTAL_COST: formattedTotal,
      REQUESTED_BY: sheet.requestedBy,
      CHECKED_BY: sheet.checkedBy || "N/A",
      APPROVED_BY: sheet.approvedBy || "N/A",
    };

    const exportItems = sheet.items.map((it, idx) => ({
      index: idx + 1,
      item: it.item,
      specification: it.specification || "N/A",
      quantity: it.quantity,
      unit: it.unit,
      supplierAPrice: it.supplierAPrice,
      supplierBPrice: it.supplierBPrice,
      supplierCPrice: it.supplierCPrice,
      selectedSupplier: it.selectedSupplier,
      remarks: it.remarks || "N/A",
    }));

    if (format === "word") {
      await exportWordWithTemplate("CANVASS_TEMPLATE.docx", { ...exportData, items: exportItems }, `${sheet.canvassNumber}_SMEI_CANVASS.docx`);
    } else {
      await exportExcelWithTemplate("CANVASS_TEMPLATE.xlsx", exportData, "items", exportItems, `${sheet.canvassNumber}_SMEI_CANVASS.xlsx`);
    }
  };

  const handleExportExcel = () => {
    const dataToExport = filteredSheets.map(sheet => ({
      "CS Number": sheet.canvassNumber,
      "Date": sheet.date,
      "Supplier": sheet.supplierName,
      "Prepared By": sheet.preparedBy,
      "Status": sheet.status,
      "Items Count": sheet.items.length
    }));
    exportListToExcel(dataToExport, "Canvass_Sheets");
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden" id="canvass-module-root">
      {/* Search and Filters Header */}
      <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search Canvass Number, Supplier, Recommended..."
              className="pl-9 pr-4 py-2 w-full text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-smei-crimson focus:border-transparent outline-none transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
            <ExportExcelButton onClick={handleExportExcel} />
            {isAuthorized && (
              <CreateButton onClick={() => handleOpenModal(null)} label="Create Canvass Sheet" />
            )}
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-red-50/20 text-gray-600 border-b border-gray-100 text-[11px] font-bold uppercase tracking-wider">
              <th className="py-4 px-6">Canvass Number</th>
              <th className="py-4 px-6">Canvass Date</th>
              <th className="py-4 px-6">Primary Supplier</th>
              <th className="py-4 px-6">Recommended Supplier</th>
              <th className="py-4 px-6 text-right font-mono">Lowest Price</th>
              <th className="py-4 px-6 text-right font-mono">Total Cost</th>
              <th className="py-4 px-6 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableSkeleton rows={5} columns={7} />
            ) : paginatedSheets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-400">
                  No Canvass Sheets found.
                </td>
              </tr>
            ) : (
              paginatedSheets.map((sheet, idx) => (
                <tr
                  key={sheet.id}
                  onClick={() => setActiveSheetId(sheet.id)}
                  onDoubleClick={() => handleOpenModal(sheet, false)}
                  className={`cursor-pointer transition-all border-b border-gray-50/60 group ${
                    activeSheetId === sheet.id
                      ? "bg-red-600/20 border-l-4 border-l-smei-crimson font-medium"
                      : idx % 2 === 1
                      ? "bg-gray-50/30 hover:bg-red-600/10"
                      : "bg-white hover:bg-red-600/10"
                  }`}
                  title="Double-click to View details"
                >
                  <td className="py-3 px-6 font-mono font-bold text-smei-darkred">
                    <div className="flex items-center gap-2">
                      {activeSheetId === sheet.id && (
                        <div className="w-1.5 h-1.5 bg-smei-crimson rounded-full animate-pulse shrink-0" />
                      )}
                      <span>{sheet.canvassNumber}</span>
                    </div>
                  </td>
                  <td className="py-3 px-6 text-gray-500 font-mono">{sheet.canvassDate}</td>
                  <td className="py-3 px-6 font-semibold text-gray-800">{sheet.supplierName}</td>
                  <td className="py-3 px-6 font-semibold text-emerald-700 text-xs">
                    <span className="bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      {sheet.recommendedSupplier}
                    </span>
                  </td>
                  <td className="py-3 px-6 text-right font-mono font-bold text-emerald-600">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(sheet.lowestPrice)}
                  </td>
                  <td className="py-3 px-6 text-right font-mono font-bold text-gray-800">
                    {new Intl.NumberFormat("en-PH", {
                      style: "currency",
                      currency: "PHP",
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }).format(sheet.totalCost)}
                  </td>
                  <td className="py-3 px-6 text-center" onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => handleOpenModal(sheet, false)}
                        className="p-1 hover:bg-red-50 hover:text-smei-crimson text-gray-400 rounded transition-all"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {isAuthorized && (
                        <button
                          onClick={() => handleOpenModal(sheet, true)}
                          className="p-1 hover:bg-blue-50 hover:text-blue-600 text-gray-400 rounded transition-all"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => handleExport(sheet, "word")}
                        className="p-1 hover:bg-indigo-50 hover:text-indigo-600 text-gray-400 rounded transition-all"
                        title="Export to Word"
                      >
                        <FileText className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleExport(sheet, "excel")}
                        className="p-1 hover:bg-emerald-50 hover:text-emerald-600 text-gray-400 rounded transition-all"
                        title="Export to Excel"
                      >
                        <FileSpreadsheet className="w-4 h-4" />
                      </button>

                      {isAuthorized && (
                        <button
                          onClick={() => handleDelete(sheet.id, sheet.canvassNumber)}
                          className="p-1 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded transition-all"
                          title="Delete Canvass"
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

      {/* Pagination Controls */}
      <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <span className="text-xs text-gray-500 font-semibold">
          Showing {filteredSheets.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to{" "}
          {Math.min(currentPage * itemsPerPage, filteredSheets.length)} of {filteredSheets.length} Sheets
        </span>
        <div className="flex items-center gap-1">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="px-2.5 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Prev
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentPage(i + 1)}
              className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                currentPage === i + 1
                  ? "bg-smei-crimson text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="px-2.5 py-1 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Canvass Sheet View/Create/Edit Modal Dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-full max-w-6xl overflow-hidden transition-all scale-100">
            <div className="bg-smei-crimson text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold uppercase tracking-wide">
                  {selectedSheet ? (isEditMode ? "Edit Canvass Sheet" : "Canvass Sheet Details") : "Create New Canvass Sheet"}
                </h3>
                <p className="text-[10px] text-red-100 font-medium">SMEI Comparative Price Canvassing</p>
              </div>
              <button onClick={handleCloseModal} className="text-white hover:text-red-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {errors.server && (
                <div className="bg-rose-50 border-l-4 border-rose-500 text-rose-700 text-xs p-3 rounded-md font-medium">
                  {errors.server}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Canvass Number */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Canvass Number *</label>
                  <input
                    type="text"
                    required
                    disabled={!isEditMode}
                    className={`w-full text-sm font-mono font-semibold p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson focus:border-smei-crimson outline-none ${
                      errors.canvassNumber ? "border-rose-500 bg-rose-50/20" : "border-gray-200 bg-gray-50"
                    }`}
                    value={canvassNumber}
                    onChange={(e) => setCanvassNumber(e.target.value)}
                    placeholder="CANVASS-YY-###"
                  />
                  {errors.canvassNumber && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.canvassNumber}</p>}
                </div>

                {/* Canvass Date */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Canvass Date *</label>
                  <input
                    type="date"
                    required
                    disabled={!isEditMode}
                    className={`w-full text-sm p-2 border rounded-lg focus:ring-1 focus:ring-smei-crimson outline-none ${
                      errors.canvassDate ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                    }`}
                    value={canvassDate}
                    onChange={(e) => setCanvassDate(e.target.value)}
                  />
                  {errors.canvassDate && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.canvassDate}</p>}
                </div>

                {/* Primary Supplier Name */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Primary Supplier / Project *</label>
                  <input
                    type="text"
                    required
                    disabled={!isEditMode}
                    placeholder="Enter main supplier/bidder"
                    className={`w-full text-sm p-2 border rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson ${
                      errors.supplierName ? "border-rose-500 bg-rose-50/20" : "border-gray-200"
                    }`}
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                  {errors.supplierName && <p className="text-[10px] text-rose-500 mt-0.5 font-semibold">{errors.supplierName}</p>}
                </div>

                {/* Supplier Contact Info */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    disabled={!isEditMode}
                    placeholder="Name of contact"
                    className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Phone Number</label>
                  <input
                    type="text"
                    disabled={!isEditMode}
                    placeholder="e.g. +63999999"
                    className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson font-mono"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    disabled={!isEditMode}
                    placeholder="supplier@email.com"
                    className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                {/* Supplier Address */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Supplier Business Address</label>
                  <input
                    type="text"
                    disabled={!isEditMode}
                    placeholder="Enter full physical address"
                    className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </div>

              {/* Automatic Computations Real-Time Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 border border-gray-100 rounded-xl p-4 mt-2">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 text-smei-crimson rounded-xl">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase font-bold">Lowest Aggregate Price</span>
                    <span className="block font-mono font-extrabold text-gray-900 text-lg">
                      {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(lowestPrice)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-l md:border-l border-gray-200 pl-4">
                  <div className="p-3 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase font-bold">Recommended Supplier</span>
                    <span className="block font-extrabold text-emerald-700 text-base uppercase tracking-wider">
                      {recommendedSupplier}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 border-l md:border-l border-gray-200 pl-4">
                  <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                    <Calculator className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[10px] text-gray-500 uppercase font-bold">Selected Procurement Total</span>
                    <span className="block font-mono font-extrabold text-blue-800 text-lg">
                      {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalCost)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items Grid Comparison Table */}
              <div className="border-t border-gray-100 pt-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide">Comparative Supply Items Comparison Grid</h4>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="text-xs bg-red-50 hover:bg-red-100 text-smei-crimson border border-red-200 px-2.5 py-1 rounded font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Item</span>
                    </button>
                  )}
                </div>

                {errors.items && <p className="text-xs text-rose-500 mb-2 font-semibold bg-rose-50 p-2 border-l-4 border-rose-500 rounded">{errors.items}</p>}

                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 text-gray-600 font-bold uppercase border-b border-gray-200 text-[10px]">
                        <th className="py-2 px-3 w-40">Item Description *</th>
                        <th className="py-2 px-3 w-32">Specification</th>
                        <th className="py-2 px-3 w-16 text-center">Qty</th>
                        <th className="py-2 px-3 w-16">Unit</th>
                        <th className="py-2 px-3 w-28 text-right bg-red-50/20">Supplier A Price</th>
                        <th className="py-2 px-3 w-28 text-right bg-amber-50/20">Supplier B Price</th>
                        <th className="py-2 px-3 w-28 text-right bg-blue-50/20">Supplier C Price</th>
                        <th className="py-2 px-3 w-36 text-center">Selected Choice</th>
                        <th className="py-2 px-3 w-32">Remarks</th>
                        {isEditMode && <th className="py-2 px-3 text-center w-12">Act</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, idx) => (
                        <tr key={it.id || idx} className="border-b border-gray-100 hover:bg-gray-50/50">
                          {/* Item Description */}
                          <td className="p-1">
                            <input
                              type="text"
                              required
                              disabled={!isEditMode}
                              placeholder="e.g. Copper pipes"
                              className="w-full border border-gray-200 p-1 rounded font-semibold text-gray-800 focus:border-smei-crimson outline-none"
                              value={it.item}
                              onChange={(e) => handleItemChange(idx, "item", e.target.value)}
                            />
                          </td>
                          {/* Specification */}
                          <td className="p-1">
                            <input
                              type="text"
                              disabled={!isEditMode}
                              placeholder="e.g. 1/2 inch thick"
                              className="w-full border border-gray-200 p-1 rounded focus:border-smei-crimson outline-none"
                              value={it.specification}
                              onChange={(e) => handleItemChange(idx, "specification", e.target.value)}
                            />
                          </td>
                          {/* Qty */}
                          <td className="p-1">
                            <input
                              type="number"
                              required
                              disabled={!isEditMode}
                              className="w-full border border-gray-200 p-1 rounded font-mono text-center focus:border-smei-crimson outline-none"
                              value={it.quantity}
                              onChange={(e) => handleItemChange(idx, "quantity", Number(e.target.value))}
                            />
                          </td>
                          {/* Unit */}
                          <td className="p-1">
                            <input
                              type="text"
                              disabled={!isEditMode}
                              placeholder="pcs"
                              className="w-full border border-gray-200 p-1 rounded text-center focus:border-smei-crimson outline-none"
                              value={it.unit}
                              onChange={(e) => handleItemChange(idx, "unit", e.target.value)}
                            />
                          </td>
                          {/* Supplier A Price */}
                          <td className="p-1 bg-red-50/10">
                            <input
                              type="number"
                              step="any"
                              disabled={!isEditMode}
                              className="w-full border border-red-200 p-1 rounded font-mono text-right focus:border-smei-crimson outline-none text-red-800"
                              value={it.supplierAPrice}
                              onChange={(e) => handleItemChange(idx, "supplierAPrice", Number(e.target.value))}
                            />
                          </td>
                          {/* Supplier B Price */}
                          <td className="p-1 bg-amber-50/10">
                            <input
                              type="number"
                              step="any"
                              disabled={!isEditMode}
                              className="w-full border border-amber-200 p-1 rounded font-mono text-right focus:border-smei-crimson outline-none text-amber-800"
                              value={it.supplierBPrice}
                              onChange={(e) => handleItemChange(idx, "supplierBPrice", Number(e.target.value))}
                            />
                          </td>
                          {/* Supplier C Price */}
                          <td className="p-1 bg-blue-50/10">
                            <input
                              type="number"
                              step="any"
                              disabled={!isEditMode}
                              className="w-full border border-blue-200 p-1 rounded font-mono text-right focus:border-smei-crimson outline-none text-blue-800"
                              value={it.supplierCPrice}
                              onChange={(e) => handleItemChange(idx, "supplierCPrice", Number(e.target.value))}
                            />
                          </td>
                          {/* Selected Choice */}
                          <td className="p-1 text-center">
                            <select
                              disabled={!isEditMode}
                              className="w-full border border-gray-200 p-1 rounded outline-none bg-white font-semibold text-gray-700"
                              value={it.selectedSupplier}
                              onChange={(e: any) => handleItemChange(idx, "selectedSupplier", e.target.value)}
                            >
                              <option value="Supplier A">Supplier A</option>
                              <option value="Supplier B">Supplier B</option>
                              <option value="Supplier C">Supplier C</option>
                            </select>
                          </td>
                          {/* Remarks */}
                          <td className="p-1">
                            <input
                              type="text"
                              disabled={!isEditMode}
                              placeholder="Notes"
                              className="w-full border border-gray-200 p-1 rounded focus:border-smei-crimson outline-none"
                              value={it.remarks}
                              onChange={(e) => handleItemChange(idx, "remarks", e.target.value)}
                            />
                          </td>
                          {/* Act */}
                          {isEditMode && (
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                              >
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Signatories Section */}
              <div className="border-t border-gray-100 pt-4 mt-2">
                <h4 className="text-xs font-bold text-smei-darkred uppercase tracking-wide mb-3">Workflow Signatories</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Requested By (Canvasser)</label>
                    <input
                      type="text"
                      disabled={!isEditMode}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg bg-gray-50/50"
                      value={requestedBy}
                      onChange={(e) => setRequestedBy(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Checked By (Supervisor)</label>
                    <input
                      type="text"
                      disabled={!isEditMode}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                      value={checkedBy}
                      onChange={(e) => setCheckedBy(e.target.value)}
                      placeholder="Supervisor name"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase font-bold text-gray-500 mb-1">Approved By (Purchasing Manager)</label>
                    <input
                      type="text"
                      disabled={!isEditMode}
                      className="w-full text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-smei-crimson"
                      value={approvedBy}
                      onChange={(e) => setApprovedBy(e.target.value)}
                      placeholder="Manager name"
                    />
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
                    Save Canvass Sheet
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
