import React, { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import { generateDocxBlob, generateXlsxBlob } from "../utils/templatePreview";
import { mapPOData, mapPISData, mapRFSData, mapCanvassData } from "../utils/templateMapping";
import { ZoomIn, ZoomOut, Maximize2, RefreshCw, AlertTriangle, FileText, Loader2, Minimize2 } from "lucide-react";

interface DocumentPreviewProps {
  moduleName: "po" | "pis" | "rfs" | "canvass";
  format: "word" | "excel";
  data: any; // Form state or object representing active document
}

export default function DocumentPreview({ moduleName, format, data }: DocumentPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  
  const [activeFormat, setActiveFormat] = useState<"word" | "excel">(format);
  const [loading, setLoading] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [excelHtml, setExcelHtml] = useState<string>("");
  const [zoom, setZoom] = useState<number>(100);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [showWarnings, setShowWarnings] = useState(false);

  useEffect(() => {
    setActiveFormat(format);
  }, [format]);

  // Debounced rendering logic to prevent lagging while typing
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const debounceTimer = setTimeout(async () => {
      if (!active) return;
      try {
        let mappedData: Record<string, any> = {};
        let items: any[] = [];

        // 1. Map data using single source of truth mappings
        if (moduleName === "po") {
          mappedData = mapPOData(data);
          items = data.items || [];
        } else if (moduleName === "pis") {
          mappedData = mapPISData(data);
          items = [];
        } else if (moduleName === "rfs") {
          const res = mapRFSData(data);
          mappedData = res.exportData;
          items = res.items;
        } else if (moduleName === "canvass") {
          const res = mapCanvassData(data);
          mappedData = res.exportData;
          items = res.excelItems;
        }

        // 2. Load template, fill placeholders, validate
        if (activeFormat === "word") {
          const templateName = 
            moduleName === "po" ? "PO_TEMPLATE.docx" :
            moduleName === "pis" ? "PIS_TEMPLATE.docx" :
            moduleName === "rfs" ? "RFS_TEMPLATE.docx" : "CANVASS_TEMPLATE.docx";

          const { blob, warnings: docxWarnings } = await generateDocxBlob(templateName, mappedData);
          
          if (!active) return;
          setWarnings(docxWarnings);
          setExcelHtml("");

          // Render Word Blob using docx-preview
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
            await renderAsync(blob, containerRef.current, undefined, {
              className: "docx-rendered-preview",
              inWrapper: false,
              ignoreWidth: true,
              ignoreHeight: true
            });
          }
        } else {
          // Excel format
          const templateName = 
            moduleName === "pis" ? "PIS_TEMPLATE.xlsx" :
            moduleName === "rfs" ? "RFS_TEMPLATE.xlsx" : "CANVASS_TEMPLATE.xlsx";

          const itemsKey = moduleName === "canvass" ? "items" : "items";
          const { html, warnings: xlsxWarnings } = await generateXlsxBlob(templateName, mappedData, itemsKey, items);

          if (!active) return;
          setWarnings(xlsxWarnings);
          setExcelHtml(html);
          if (containerRef.current) {
            containerRef.current.innerHTML = "";
          }
        }
      } catch (err: any) {
        console.error("Preview render error:", err);
        if (active) {
          setError(err.message || "An error occurred while rendering document preview.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }, 350); // 350ms debounce window for typing fluidity

    return () => {
      active = false;
      clearTimeout(debounceTimer);
    };
  }, [moduleName, activeFormat, data, refreshTrigger]);

  // Controls Handlers
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 10, 200));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 10, 40));
  const handleResetZoom = () => setZoom(100);

  const handleFitWidth = () => {
    if (wrapperRef.current) {
      const wrapperWidth = wrapperRef.current.clientWidth - 48; // subtract padding
      const targetWidth = activeFormat === "word" ? 816 : 900;
      const computedZoom = Math.floor((wrapperWidth / targetWidth) * 100);
      setZoom(Math.max(45, Math.min(computedZoom, 150)));
    }
  };

  const handleFitPage = () => {
    if (wrapperRef.current) {
      const wrapperHeight = wrapperRef.current.clientHeight - 48; // subtract padding
      const targetHeight = activeFormat === "word" ? 1050 : 700;
      const computedZoom = Math.floor((wrapperHeight / targetHeight) * 100);
      setZoom(Math.max(45, Math.min(computedZoom, 150)));
    }
  };

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Perform automatic fit width on initial load or on format switch
  const lastFitRef = useRef<string>("");
  useEffect(() => {
    if (!loading && !error) {
      const currentFitKey = `${moduleName}-${activeFormat}`;
      if (lastFitRef.current !== currentFitKey) {
        lastFitRef.current = currentFitKey;
        const timer = setTimeout(() => {
          handleFitWidth();
        }, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, error, moduleName, activeFormat]);

  return (
    <div className="flex flex-col h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm" id="document-preview-panel">
      {/* Upper Control Ribbon */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-smei-crimson" />
          <span className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Live {activeFormat === "word" ? "Word" : "Excel"} Preview
          </span>
          {loading && (
            <div className="flex items-center gap-1.5 ml-2">
              <Loader2 className="w-3.5 h-3.5 text-smei-crimson animate-spin" />
              <span className="text-[11px] text-slate-500 font-medium">Drafting...</span>
            </div>
          )}

          {moduleName !== "po" && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 ml-3">
              <button
                onClick={() => setActiveFormat("word")}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                  activeFormat === "word"
                    ? "bg-white text-smei-crimson shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                id="btn-preview-format-word"
              >
                DOCX
              </button>
              <button
                onClick={() => setActiveFormat("excel")}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-md transition-all ${
                  activeFormat === "excel"
                    ? "bg-white text-smei-crimson shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
                id="btn-preview-format-excel"
              >
                XLSX
              </button>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleZoomOut}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            title="Zoom Out"
            id="btn-zoom-out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={handleResetZoom}
            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors font-mono font-medium text-center"
            title="Reset to 100%"
            id="zoom-value"
          >
            {zoom}%
          </button>
          <button
            onClick={handleZoomIn}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            title="Zoom In"
            id="btn-zoom-in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <button
            onClick={handleFitWidth}
            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors font-medium flex items-center gap-1"
            title="Fit Width"
            id="btn-fit-width"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit Width</span>
          </button>
          <button
            onClick={handleFitPage}
            className="px-2 py-1 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors font-medium flex items-center gap-1"
            title="Fit Page"
            id="btn-fit-page"
          >
            <Minimize2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Fit Page</span>
          </button>

          <div className="w-px h-4 bg-slate-200 mx-1" />

          <button
            onClick={handleRefresh}
            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
            title="Refresh Preview"
            id="btn-refresh-preview"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Warnings & Errors Bar */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="text-xs font-semibold">
                Developer Validation Warnings ({warnings.length})
              </span>
            </div>
            <button
              onClick={() => setShowWarnings(!showWarnings)}
              className="text-xs text-amber-700 hover:text-amber-900 underline font-medium"
              id="btn-toggle-warnings"
            >
              {showWarnings ? "Hide Warnings" : "Show Warnings"}
            </button>
          </div>
          {showWarnings && (
            <ul className="mt-2 pl-6 list-disc text-[11px] text-amber-800 font-mono space-y-1 max-h-32 overflow-y-auto">
              {warnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main Preview Work Surface */}
      <div 
        ref={wrapperRef}
        className="flex-1 overflow-auto p-4 sm:p-6 md:p-8 flex justify-center bg-slate-100"
        id="preview-display-viewport"
      >
        {error ? (
          <div className="m-auto max-w-md bg-white border border-rose-200 rounded-lg p-6 shadow-sm text-center">
            <AlertTriangle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-900 mb-1">Preview Generation Failed</h3>
            <p className="text-xs text-slate-500 leading-relaxed font-mono">{error}</p>
          </div>
        ) : activeFormat === "excel" && excelHtml ? (
          <div 
            className="transition-all duration-150" 
            style={{ 
              zoom: zoom / 100,
              width: "100%",
              maxWidth: "1000px"
            }}
          >
            {/* Styled Sheet Wrapper */}
            <div 
              className="excel-preview-container bg-white shadow-md rounded-lg overflow-hidden border border-slate-200 p-6 min-w-[750px]"
              dangerouslySetInnerHTML={{ __html: excelHtml }}
            />
          </div>
        ) : (
          <div 
            className="transition-all duration-150" 
            style={{ 
              zoom: zoom / 100
            }}
          >
            {/* Word Document Target Container */}
            <div 
              ref={containerRef} 
              className="docx-preview-container bg-white shadow-md rounded border border-slate-200 min-h-[1050px] w-[816px] p-12 overflow-hidden"
              id="docx-render-target"
            />
          </div>
        )}
      </div>

      {/* Embedded Excel Preview Styling */}
      <style>{`
        .excel-preview-container table {
          border-collapse: collapse;
          width: 100%;
          font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
          font-size: 11px;
          color: #1e293b;
          text-align: left;
        }
        .excel-preview-container th, .excel-preview-container td {
          border: 1px solid #cbd5e1;
          padding: 6px 8px;
          min-width: 60px;
          white-space: pre-wrap;
          word-break: break-all;
        }
        .excel-preview-container tr:first-child, .excel-preview-container tr:nth-child(2) {
          font-weight: 700;
          background-color: #f1f5f9;
          text-align: center;
        }
        /* Custom styling for DOCX-rendered elements inside the preview container */
        .docx-rendered-preview {
          font-family: 'Calibri', 'Arial', sans-serif !important;
          line-height: 1.15 !important;
        }
        .docx-rendered-preview table {
          border-collapse: collapse !important;
          width: 100% !important;
        }
        .docx-rendered-preview td {
          border: 1px solid #000 !important;
          padding: 4px !important;
        }
        /* Page layout container customizations */
        .docx-preview-container {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          background-color: #ffffff;
        }
        .excel-preview-container {
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
          border-radius: 8px;
          background-color: #ffffff;
        }
      `}</style>
    </div>
  );
}
