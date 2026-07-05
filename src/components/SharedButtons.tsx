import React from "react";
import { FileSpreadsheet, Plus, FileText } from "lucide-react";
import * as XLSX from "xlsx";

export function exportListToExcel(data: any[], filename: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function ExportExcelButton({ 
  onClick, 
  disabled, 
  selectedText 
}: { 
  onClick: () => void; 
  disabled?: boolean; 
  selectedText?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
      {selectedText !== undefined && (
        <div className="flex items-center gap-2 mr-auto sm:mr-1">
          <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">Export Tool:</span>
          {selectedText ? (
            <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
              Selected: {selectedText}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">
              Click a row to select
            </span>
          )}
        </div>
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`text-sm font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap flex-shrink-0 w-full sm:w-auto ${
          disabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
            : "bg-emerald-600 hover:bg-emerald-700 text-white hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(16,185,129,0.2)]"
        }`}
      >
        <FileSpreadsheet className="w-4 h-4" />
        <span>Export Excel</span>
      </button>
    </div>
  );
}

export function ExportWordButton({ 
  onClick, 
  disabled, 
  selectedText,
  label = "Export Word"
}: { 
  onClick: () => void; 
  disabled?: boolean; 
  selectedText?: string;
  label?: string;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
      {selectedText !== undefined && (
        <div className="flex items-center gap-2 mr-auto sm:mr-1">
          <span className="text-xs font-bold text-gray-500 uppercase font-mono tracking-wider">Export Tool:</span>
          {selectedText ? (
            <span className="text-[11px] font-bold font-mono text-smei-crimson bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
              Selected: {selectedText}
            </span>
          ) : (
            <span className="text-xs text-gray-400 italic">
              Click a row to select
            </span>
          )}
        </div>
      )}
      <button
        onClick={onClick}
        disabled={disabled}
        className={`text-sm font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all whitespace-nowrap flex-shrink-0 w-full sm:w-auto ${
          disabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200"
            : "bg-indigo-600 hover:bg-indigo-700 text-white hover:scale-[1.02] active:scale-95 cursor-pointer shadow-[0_2px_8px_rgba(79,70,229,0.2)]"
        }`}
      >
        <FileText className="w-4 h-4" />
        <span>{label}</span>
      </button>
    </div>
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
