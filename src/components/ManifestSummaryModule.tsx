import React, { useState, useEffect } from "react";
import { Plus, Search, Filter, ArrowDownToLine, CheckCircle2, RefreshCw, Trash2 } from "lucide-react";

interface ManifestSummary {
  id: string;
  manifestNo: string;
  controlNo: string;
  generator: string; // Client Generator
  transporter: string; // Waste Transporter
  wasteCode: string;
  quantity: number;
  unit: "Tons" | "kg" | "Liters" | "Drums";
  dateReceived: string;
  status: "Under-Review" | "Transporting" | "Received" | "Treated" | "Disposed";
  tsdCertificateNo?: string;
}

export default function ManifestSummaryModule() {
  const [manifests, setManifests] = useState<ManifestSummary[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");

  // Form states
  const [manifestNo, setManifestNo] = useState("");
  const [controlNo, setControlNo] = useState("");
  const [generator, setGenerator] = useState("");
  const [transporter, setTransporter] = useState("");
  const [wasteCode, setWasteCode] = useState("D407");
  const [quantity, setQuantity] = useState<number | "">("");
  const [unit, setUnit] = useState<"Tons" | "kg" | "Liters" | "Drums">("Tons");
  const [status, setStatus] = useState<"Under-Review" | "Transporting" | "Received" | "Treated" | "Disposed">("Received");

  useEffect(() => {
    const saved = localStorage.getItem("tsd_manifests");
    if (saved) {
      try {
        setManifests(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse manifests", e);
      }
    } else {
      const initial: ManifestSummary[] = [
        {
          id: "m-1",
          manifestNo: "HW-MAN-2026-9921",
          controlNo: "TSD-2026-M-01824",
          generator: "Cavite Precision Casting Inc.",
          transporter: "Logistics Hazwaste Express",
          wasteCode: "D407: Waste Organic Solvents",
          quantity: 8.3,
          unit: "Tons",
          dateReceived: "2026-07-01",
          status: "Disposed",
          tsdCertificateNo: "TSD-CERT-2026-0041"
        },
        {
          id: "m-2",
          manifestNo: "HW-MAN-2026-1042",
          controlNo: "TSD-2026-T-02481",
          generator: "Semiconductor Assembly Corp.",
          transporter: "SafePath Safe Cargo Co.",
          wasteCode: "L404: Lead Compounds",
          quantity: 12.8,
          unit: "Tons",
          dateReceived: "2026-07-05",
          status: "Treated",
          tsdCertificateNo: "TSD-CERT-2026-0052"
        },
        {
          id: "m-3",
          manifestNo: "HW-MAN-2026-1085",
          controlNo: "TSD-2026-I-00155",
          generator: "Universal Electronics Cavite",
          transporter: "Internal Tanker Fleet 2",
          wasteCode: "I101: Waste Oil / Sludge",
          quantity: 25.0,
          unit: "Tons",
          dateReceived: "2026-07-10",
          status: "Received"
        }
      ];
      setManifests(initial);
      localStorage.setItem("tsd_manifests", JSON.stringify(initial));
    }
  }, []);

  const saveToStorage = (updated: ManifestSummary[]) => {
    setManifests(updated);
    localStorage.setItem("tsd_manifests", JSON.stringify(updated));
  };

  const handleRegisterManifest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manifestNo.trim() || !controlNo.trim() || !generator.trim() || !quantity) {
      alert("Please fill in Manifest No, Control Code, Generator Client, and Quantity.");
      return;
    }

    const newManifest: ManifestSummary = {
      id: `m-${Date.now()}`,
      manifestNo: manifestNo.toUpperCase(),
      controlNo: controlNo.toUpperCase(),
      generator,
      transporter: transporter || "CEZ Standard Transporter",
      wasteCode,
      quantity: Number(quantity),
      unit,
      dateReceived: new Date().toISOString().split("T")[0],
      status
    };

    saveToStorage([newManifest, ...manifests]);

    setManifestNo("");
    setControlNo("");
    setGenerator("");
    setTransporter("");
    setQuantity("");
  };

  const handleIssueCertificate = (id: string) => {
    const certNo = `TSD-CERT-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const updated = manifests.map(m => {
      if (m.id === id) {
        return {
          ...m,
          status: "Disposed" as const,
          tsdCertificateNo: certNo
        };
      }
      return m;
    });
    saveToStorage(updated);
    alert(`TSD Disposal Compliance Certificate issued successfully: ${certNo}`);
  };

  const toggleStatus = (id: string) => {
    const updated = manifests.map(m => {
      if (m.id === id) {
        const next: Record<string, "Under-Review" | "Transporting" | "Received" | "Treated" | "Disposed"> = {
          "Under-Review": "Transporting",
          "Transporting": "Received",
          "Received": "Treated",
          "Treated": "Disposed",
          "Disposed": "Under-Review"
        };
        return { ...m, status: next[m.status] };
      }
      return m;
    });
    saveToStorage(updated);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this manifest summary?")) {
      const updated = manifests.filter(m => m.id !== id);
      saveToStorage(updated);
    }
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Manifest No,Control No,Generator,Transporter,Waste Code,Volume,Unit,Date Received,Status,TSD Certificate No\n";
    
    manifests.forEach(m => {
      const row = [
        m.manifestNo,
        m.controlNo,
        `"${m.generator}"`,
        `"${m.transporter}"`,
        `"${m.wasteCode}"`,
        m.quantity,
        m.unit,
        m.dateReceived,
        m.status,
        m.tsdCertificateNo || "N/A"
      ].join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TSD_Manifest_Summary_Report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredManifests = manifests.filter(m => {
    const safeManifestNo = m.manifestNo || "";
    const safeControlNo = m.controlNo || "";
    const safeGenerator = m.generator || "";
    const safeTransporter = m.transporter || "";
    const term = (searchTerm || "").toLowerCase();

    const matchesSearch = safeManifestNo.toLowerCase().includes(term) ||
                          safeControlNo.toLowerCase().includes(term) ||
                          safeGenerator.toLowerCase().includes(term) ||
                          safeTransporter.toLowerCase().includes(term);
    const matchesStatus = statusFilter === "All" || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div id="smei-manifest-summary" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full text-slate-800 dark:text-slate-100">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            Hazardous Waste Manifest Summary Ledger
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Reconcile state-authorized environmental compliance manifests against physical delivery tracking numbers.
          </p>
        </div>
        
        <button
          onClick={exportCSV}
          className="bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all flex items-center gap-2 self-start md:self-auto cursor-pointer active:scale-95 hover:scale-[1.01]"
        >
          <ArrowDownToLine className="w-4 h-4" />
          <span>EXPORT CSV REPORT</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Register Manifest Form */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-6 h-fit">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200 border-b border-gray-100 dark:border-slate-800 pb-3 font-display">
            Log New Manifest Form
          </h3>

          <form onSubmit={handleRegisterManifest} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Manifest Serial No *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HW-MAN-9921"
                  value={manifestNo}
                  onChange={(e) => setManifestNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                  TSD Control Code *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TSD-2026-M-00812"
                  value={controlNo}
                  onChange={(e) => setControlNo(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                Client Generator *
              </label>
              <input
                type="text"
                required
                placeholder="Generator corporation name..."
                value={generator}
                onChange={(e) => setGenerator(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                Authorized Transporter
              </label>
              <input
                type="text"
                placeholder="Logistics transporter name..."
                value={transporter}
                onChange={(e) => setTransporter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Waste Material Code
                </label>
                <select
                  value={wasteCode}
                  onChange={(e) => setWasteCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all"
                >
                  <option value="D407: Waste Organic Solvents">D407 (Solvent)</option>
                  <option value="L404: Lead Compounds">L404 (Lead)</option>
                  <option value="I101: Waste Oil / Sludge">I101 (Waste Oil)</option>
                  <option value="H802: Alkali Waste">H802 (Alkali)</option>
                  <option value="J201: Acid Waste">J201 (Acid)</option>
                  <option value="M501: Pathological & Infectious">M501 (Infectious)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Qty *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="2.5"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : "")}
                    className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Unit
                  </label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value as any)}
                    className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all cursor-pointer"
                  >
                    <option value="Tons">Tons</option>
                    <option value="kg">kg</option>
                    <option value="Liters">Liters</option>
                    <option value="Drums">Drums</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 dark:text-slate-400 uppercase tracking-wider mb-1">
                Initial Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg p-2.5 focus:outline-none focus:ring-1 focus:ring-smei-crimson focus:border-transparent transition-all cursor-pointer"
              >
                <option value="Under-Review">Under-Review</option>
                <option value="Transporting">Transporting</option>
                <option value="Received">Received</option>
                <option value="Treated">Treated</option>
                <option value="Disposed">Disposed</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full bg-smei-crimson hover:bg-smei-darkred text-white text-xs font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer hover:scale-[1.01] active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>LOG COMPLIANCE MANIFEST</span>
            </button>
          </form>
        </div>

        {/* Live Manifest Grid Directory */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-800 dark:text-slate-200 font-display flex items-center gap-2">
              <span>Manifest Compliance Registry</span>
            </h3>

            {/* Reset */}
            <button 
              onClick={() => {
                if (confirm("Reset local Manifest Registry to defaults?")) {
                  localStorage.removeItem("tsd_manifests");
                  window.location.reload();
                }
              }}
              className="text-[10px] font-mono text-slate-400 hover:text-smei-crimson dark:hover:text-rose-400 uppercase tracking-wider bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded border border-gray-100 dark:border-slate-800/80 cursor-pointer transition-all"
            >
              Reset Data
            </button>
          </div>

          {/* Search filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search Manifest No, Control Code, Client Generator..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 rounded-lg text-xs pl-9 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-200 border border-gray-200 dark:border-slate-800 text-xs rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-smei-crimson transition-all cursor-pointer"
            >
              <option value="All">All Manifest States</option>
              <option value="Under-Review">Under-Review</option>
              <option value="Transporting">Transporting</option>
              <option value="Received">Received</option>
              <option value="Treated">Treated</option>
              <option value="Disposed">Disposed (Discharged)</option>
            </select>
          </div>

          {/* Manifest Directory Table */}
          <div className="border border-gray-100 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3 font-display">Manifest No</th>
                    <th className="py-2.5 px-3 font-display">Control Code</th>
                    <th className="py-2.5 px-3 font-display">Client Generator</th>
                    <th className="py-2.5 px-3 font-display">Waste / Qty</th>
                    <th className="py-2.5 px-3 font-display">Date</th>
                    <th className="py-2.5 px-3 text-center font-display">Status</th>
                    <th className="py-2.5 px-3 text-center font-display">Compliance Cert</th>
                    <th className="py-2.5 px-3 text-right font-display">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/85 font-mono">
                  {filteredManifests.length > 0 ? (
                    filteredManifests.map(m => {
                      const statusStyles = {
                        "Under-Review": "bg-slate-100 text-slate-700 border-slate-200 dark:bg-neutral-800 dark:text-neutral-300 dark:border-neutral-700",
                        Transporting: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800/50",
                        Received: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800/50",
                        Treated: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-800/50",
                        Disposed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-800/50"
                      };

                      return (
                        <tr key={m.id} className="hover:bg-red-600/5 dark:hover:bg-red-600/10 transition-colors bg-white dark:bg-slate-900">
                          <td className="py-3 px-3 font-bold text-slate-800 dark:text-white select-all">{m.manifestNo}</td>
                          <td className="py-3 px-3 select-all text-gray-500 dark:text-slate-400">{m.controlNo}</td>
                          <td className="py-3 px-3 font-sans text-gray-700 dark:text-slate-200">
                            <div className="font-semibold truncate max-w-[120px] text-gray-800 dark:text-white" title={m.generator}>{m.generator}</div>
                            <span className="text-[10px] text-gray-400 dark:text-slate-500 block" title={m.transporter}>Carrier: {m.transporter}</span>
                          </td>
                          <td className="py-3 px-3 font-sans text-gray-500 dark:text-slate-400">
                            <span className="font-mono text-smei-crimson dark:text-rose-400 font-bold block">{m.wasteCode.split(":")[0]}</span>
                            <span className="text-slate-800 dark:text-slate-200 font-bold">{m.quantity} {m.unit}</span>
                          </td>
                          <td className="py-3 px-3 text-gray-400 dark:text-slate-500 whitespace-nowrap">{m.dateReceived}</td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => toggleStatus(m.id)}
                              className={`px-2.5 py-0.5 border text-[9px] font-bold rounded-full uppercase tracking-wider cursor-pointer transition-all hover:scale-105 active:scale-95 ${statusStyles[m.status]}`}
                              title="Click to cycle status"
                            >
                              {m.status}
                            </button>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {m.tsdCertificateNo ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded select-all" title="Click to copy Certificate ID">
                                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                <span>{m.tsdCertificateNo}</span>
                              </span>
                            ) : m.status === "Treated" || m.status === "Disposed" ? (
                              <button
                                onClick={() => handleIssueCertificate(m.id)}
                                className="bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold font-mono px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-900/30 cursor-pointer transition-all hover:scale-105 active:scale-95 shadow-2xs"
                              >
                                ISSUE CERT
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 italic">Awaiting treatment</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <button
                              onClick={() => handleDelete(m.id)}
                              className="text-gray-400 hover:text-red-600 dark:text-neutral-500 dark:hover:text-red-400 transition-colors p-1 cursor-pointer"
                              title="Delete Manifest Summary"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-400 dark:text-slate-500 font-sans">
                        No matching manifests registered.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
