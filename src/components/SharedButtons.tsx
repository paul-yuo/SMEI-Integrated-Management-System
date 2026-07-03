import React from "react";
import { FileSpreadsheet, Plus, FileText } from "lucide-react";
import * as XLSX from "xlsx";

export function exportListToExcel(data: any[], filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function ExportExcelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] whitespace-nowrap flex-shrink-0"
    >
      <FileSpreadsheet className="w-4 h-4" />
      <span>Export Excel</span>
    </button>
  );
}

export function ExportWordButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] whitespace-nowrap flex-shrink-0"
    >
      <FileText className="w-4 h-4" />
      <span>Export Word</span>
    </button>
  );
}

export function CreateButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="bg-smei-crimson hover:bg-smei-darkred text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-1.5 shadow-sm transition-all hover:scale-[1.02] whitespace-nowrap flex-shrink-0"
    >
      <Plus className="w-4 h-4" />
      <span>{label}</span>
    </button>
  );
}
