import React, { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { ShieldCheck, TrendingUp, Users, AlertTriangle, CheckCircle, RefreshCw, Award, Landmark } from "lucide-react";

interface ComplianceTask {
  id: string;
  permitName: string;
  agency: string;
  expiryDate: string;
  status: "Active" | "Critical-Renewal" | "Expired";
}

export default function TsdSummaryModule() {
  const [totalTonnage, setTotalTonnage] = useState(185.4);
  const [complianceRating, setComplianceRating] = useState(99.6);
  const [generatorsCount, setGeneratorsCount] = useState(14);
  const [treatedTons, setTreatedTons] = useState(158.2);

  // Compliance Permit Tasks Checklists
  const [tasks, setTasks] = useState<ComplianceTask[]>([
    {
      id: "pt-1",
      permitName: "TSD Facility Permit to Operate (PTO)",
      agency: "DENR-EMB Region IV-A",
      expiryDate: "2027-02-15",
      status: "Active"
    },
    {
      id: "pt-2",
      permitName: "Wastewater Discharge Permit (DP)",
      agency: "DENR-EMB Region IV-A",
      expiryDate: "2026-08-30",
      status: "Critical-Renewal"
    },
    {
      id: "pt-3",
      permitName: "Hazardous Waste Generator ID Certificate",
      agency: "DENR-EMB CO",
      expiryDate: "Permanent (Valid)",
      status: "Active"
    },
    {
      id: "pt-4",
      permitName: "Bureau of Fire Protection Safety Inspection Cert",
      agency: "BFP Cavite",
      expiryDate: "2026-06-30",
      status: "Expired"
    }
  ]);

  // Recharts Monthly Volumes (Treated vs Disposed)
  const monthlyData = [
    { month: "Feb 2026", treated: 22.4, disposed: 18.1 },
    { month: "Mar 2026", treated: 28.1, disposed: 24.5 },
    { month: "Apr 2026", treated: 35.0, disposed: 29.8 },
    { month: "May 2026", treated: 41.2, disposed: 38.0 },
    { month: "Jun 2026", treated: 48.6, disposed: 42.1 },
    { month: "Jul 2026", treated: 52.4, disposed: 46.5 }
  ];

  // Pie Chart Distribution
  const wasteDistribution = [
    { name: "Waste Organic Solvents (D407)", value: 42.5 },
    { name: "Lead Compounds (L404)", value: 12.8 },
    { name: "Strong Alkali (H802)", value: 8.4 },
    { name: "Infectious Waste (M501)", value: 9.8 },
    { name: "Waste Oils / Sludge (I101)", value: 25.0 }
  ];

  const PIE_COLORS = ["#8B0000", "#B22222", "#E57373", "#F28B82", "#FFCDD2"];

  const toggleTaskStatus = (id: string) => {
    const updated = tasks.map(t => {
      if (t.id === id) {
        const next: Record<string, "Active" | "Critical-Renewal" | "Expired"> = {
          "Active": "Critical-Renewal",
          "Critical-Renewal": "Expired",
          "Expired": "Active"
        };
        return { ...t, status: next[t.status] };
      }
      return t;
    });
    setTasks(updated);
  };

  return (
    <div id="smei-tsd-summary" className="p-4 md:p-6 space-y-6 max-w-[130rem] mx-auto w-full text-slate-800 dark:text-slate-100">
      {/* Rebranding Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm animate-fadeIn">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-white tracking-tight font-display uppercase">
            TSD Facility Summary Executive Dashboard
          </h2>
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Aggregated operational summary, monthly volumetric charts, and regulatory compliance schedules for Transport Storage Disposal lines.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono bg-slate-50 dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">
          <RefreshCw className="w-3.5 h-3.5 text-smei-crimson animate-spin" />
          <span className="uppercase text-slate-400 dark:text-slate-500 font-bold">MONITOR STATUS:</span>
          <span className="text-emerald-500 font-bold">100% ONLINE</span>
        </div>
      </div>

      {/* KPI Highlight stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-sans">Total Volume Handled</p>
            <h3 className="text-2xl font-black font-sans text-slate-800 dark:text-white">{totalTonnage} Tons</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">Cumulative annual materials</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/40">
            <TrendingUp className="w-5 h-5 text-smei-crimson" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-sans">Neutralized & Treated</p>
            <h3 className="text-2xl font-black font-sans text-emerald-600 dark:text-emerald-400">{treatedTons} Tons</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">Discharged safe residue volume</p>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-sans">Compliance Audit Rating</p>
            <h3 className="text-2xl font-black font-sans text-smei-crimson dark:text-rose-400">{complianceRating}%</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">DENR Environmental safety checks</p>
          </div>
          <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg border border-red-100 dark:border-red-900/40">
            <Award className="w-5 h-5 text-smei-crimson" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider font-sans">Active CEZ Client Base</p>
            <h3 className="text-2xl font-black font-sans text-slate-800 dark:text-white">{generatorsCount} Clients</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-sans">Industrial manufacturing partners</p>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-100 dark:border-blue-900/40">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      {/* Analytical charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Treated vs Disposed */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-display">
              Monthly Waste Neutralization Volumes (Tons)
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Comparing chemical physical treatment plant input against safe landfill residues.</p>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" className="dark:stroke-slate-800" />
                <XAxis dataKey="month" tick={{ fill: "#888", fontSize: 10 }} />
                <YAxis tick={{ fill: "#888", fontSize: 10 }} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#fff", fontSize: "11px" }} />
                <Legend tick={{ fill: "#888", fontSize: 10 }} />
                <Bar dataKey="treated" name="Neutralized (Treated)" fill="#B22222" radius={[4, 4, 0, 0]} />
                <Bar dataKey="disposed" name="Landfilled (Discharged)" fill="#E57373" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Waste Distribution Share */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-display">
              Live Storage Tank Stock Share (%)
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Volumetric ratio of active compound classes currently residing in storage sheds.</p>
          </div>

          <div className="h-64 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="w-full md:w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={wasteDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {wasteDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => `${v}% Share`} contentStyle={{ fontSize: "11px", background: "#1e293b", color: "#fff", borderRadius: "8px", border: "none" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legends customized */}
            <div className="w-full md:w-1/2 space-y-2 text-[10px] font-mono">
              {wasteDistribution.map((w, idx) => (
                <div key={w.name} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }} />
                  <span className="text-gray-500 dark:text-slate-400 truncate max-w-[180px]" title={w.name}>{w.name}</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200 ml-auto">{w.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Task permit list */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-gray-100 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 font-display flex items-center gap-2">
              <Landmark className="w-4 h-4 text-smei-crimson" />
              <span>DENR Regulatory Permits & Clearances Timeline Checklist</span>
            </h3>
            <p className="text-xs text-slate-400 dark:text-slate-500">Biannual audits, safety checks, and license permits monitoring to keep TSD 100% legal.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tasks.map(t => {
            let labelStyle = "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-800/40";
            if (t.status === "Critical-Renewal") {
              labelStyle = "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/25 dark:text-amber-400 dark:border-amber-800/40 animate-pulse";
            } else if (t.status === "Expired") {
              labelStyle = "bg-red-50 text-red-600 border-red-200 dark:bg-red-950/25 dark:text-red-400 dark:border-red-800/40";
            }

            return (
              <div
                key={t.id}
                onClick={() => toggleTaskStatus(t.id)}
                className="p-3.5 bg-slate-50/50 dark:bg-slate-950/30 border border-gray-100 dark:border-slate-800 rounded-xl flex items-center justify-between cursor-pointer transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/40"
              >
                <div className="space-y-1 pr-4">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 font-sans truncate max-w-[240px]" title={t.permitName}>
                    {t.permitName}
                  </h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{t.agency} • Expires: {t.expiryDate}</p>
                </div>

                <span className={`px-2 py-0.5 border text-[9px] font-bold font-mono rounded uppercase tracking-wider ${labelStyle}`}>
                  {t.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
