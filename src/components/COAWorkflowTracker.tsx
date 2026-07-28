import React, { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  Clock,
  Key,
  Truck,
  Flame,
  Layers,
  FileCheck,
  ChevronRight,
  ChevronLeft,
  Lock,
  RefreshCw,
  AlertCircle,
  X,
  Sparkles,
  Info,
  ShieldAlert,
  Sliders
} from "lucide-react";
import { useCOAWorkflowTracker } from "../hooks/useCOAWorkflowTracker";
import { COAWorkflowStepKey, COAWorkflowStep } from "../types/workflow";
import { User, UserRole } from "../types";

export interface COAWorkflowTrackerProps {
  activeTab?: string;
  onNavigate: (tab: string) => void;
  currentUser?: User;
  className?: string;
}

const STEP_ICONS: Record<COAWorkflowStepKey, React.ElementType> = {
  "control-no": Key,
  "unloading-loading": Truck,
  "hazardous-waste": Flame,
  "waste-movement": Layers,
  timestamp: Clock
};

export const COAWorkflowTracker = React.memo(function COAWorkflowTracker({
  activeTab,
  onNavigate,
  currentUser,
  className = ""
}: COAWorkflowTrackerProps) {
  const {
    progress,
    selectedControlNo,
    selectControlNo,
    availableControlNumbers,
    refreshData,
    error
  } = useCOAWorkflowTracker(activeTab, currentUser?.role);

  // Responsiveness & drawer state
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [hoveredStepKey, setHoveredStepKey] = useState<COAWorkflowStepKey | null>(null);

  // Check role permissions per step
  const isStepLocked = useCallback(
    (stepKey: COAWorkflowStepKey) => {
      if (!currentUser) return false;
      const role = currentUser.role;

      // Restrict specific administrative views based on standard portal security
      if (role === UserRole.Viewer && stepKey === "timestamp") {
        return false; // Viewers can view
      }
      return false;
    },
    [currentUser]
  );

  const handleStepClick = useCallback(
    (step: COAWorkflowStep) => {
      if (isStepLocked(step.key)) return;
      onNavigate(step.key);
      setIsMobileDrawerOpen(false);
    },
    [isStepLocked, onNavigate]
  );

  return (
    <>
      {/* MOBILE TRIGGER FLOATING BUTTON */}
      <div className="fixed bottom-5 right-5 z-40 xl:hidden">
        <button
          type="button"
          onClick={() => setIsMobileDrawerOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 bg-smei-crimson text-white font-bold text-xs rounded-full shadow-2xl hover:bg-smei-darkred transition-all transform hover:scale-105 active:scale-95 cursor-pointer border-2 border-white/20"
          aria-label="Open COA Document Progress Tracker"
        >
          <Sparkles className="w-4 h-4 animate-pulse text-amber-300" />
          <span>COA Tracker ({progress.percentage}%)</span>
          {progress.isReadyForCOA && (
            <span className="w-2 h-2 rounded-full bg-green-400 animate-ping shrink-0" />
          )}
        </button>
      </div>

      {/* MOBILE DRAWER OVERLAY */}
      <AnimatePresence>
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 xl:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileDrawerOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="absolute top-0 right-0 bottom-0 w-full max-w-sm bg-white dark:bg-neutral-900 border-l border-gray-200 dark:border-neutral-800 shadow-2xl flex flex-col z-10"
            >
              <div className="p-4 border-b border-gray-100 dark:border-neutral-800 flex items-center justify-between bg-gray-50/80 dark:bg-neutral-800/50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-smei-crimson" />
                  <span className="font-bold text-sm text-gray-900 dark:text-white font-display">
                    COA Workflow Progress
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <TrackerCoreContent
                  progress={progress}
                  selectedControlNo={selectedControlNo}
                  selectControlNo={selectControlNo}
                  availableControlNumbers={availableControlNumbers}
                  onStepClick={handleStepClick}
                  isStepLocked={isStepLocked}
                  hoveredStepKey={hoveredStepKey}
                  setHoveredStepKey={setHoveredStepKey}
                  onRefresh={refreshData}
                  error={error}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DESKTOP / TABLET CONTAINER */}
      <aside
        className={`hidden xl:block shrink-0 transition-all duration-300 ${
          isCollapsed ? "w-14 min-w-[56px]" : "min-w-[300px] max-w-[360px] w-full"
        } ${className}`}
        aria-label="COA Document Progress Tracker"
      >
        <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-gray-200 dark:border-neutral-800 shadow-sm p-4 sticky top-6 space-y-4 overflow-hidden transition-all">
          {/* HEADER BAR & COLLAPSE TOGGLE */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-100 dark:border-neutral-800">
            {!isCollapsed && (
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-smei-crimson dark:text-red-400" />
                  <h3 className="text-xs font-bold tracking-wider uppercase text-gray-900 dark:text-white font-display">
                    COA DOCUMENT PROGRESS
                  </h3>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                  Compliance Certification Tracker
                </p>
              </div>
            )}

            <div className="flex items-center gap-1 ml-auto">
              {!isCollapsed && (
                <button
                  type="button"
                  onClick={refreshData}
                  className="p-1.5 text-gray-400 hover:text-smei-crimson dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                  title="Refresh workflow status"
                  aria-label="Refresh status"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                title={isCollapsed ? "Expand Tracker" : "Collapse Tracker"}
                aria-label={isCollapsed ? "Expand Tracker" : "Collapse Tracker"}
              >
                {isCollapsed ? (
                  <ChevronLeft className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* COLLAPSED MINI VIEW */}
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-4 py-2">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                  progress.isReadyForCOA
                    ? "bg-emerald-500 text-white animate-pulse"
                    : "bg-smei-crimson text-white"
                }`}
                title={`Progress: ${progress.percentage}% (${progress.completedCount}/5 Complete)`}
              >
                {progress.percentage}%
              </div>
              <div className="w-1 h-32 bg-gray-100 dark:bg-neutral-800 rounded-full relative overflow-hidden">
                <div
                  className="w-full bg-smei-crimson transition-all duration-500 rounded-full"
                  style={{ height: `${progress.percentage}%` }}
                />
              </div>
            </div>
          ) : (
            /* FULL EXPANDED CORE TRACKER CONTENT */
            <TrackerCoreContent
              progress={progress}
              selectedControlNo={selectedControlNo}
              selectControlNo={selectControlNo}
              availableControlNumbers={availableControlNumbers}
              onStepClick={handleStepClick}
              isStepLocked={isStepLocked}
              hoveredStepKey={hoveredStepKey}
              setHoveredStepKey={setHoveredStepKey}
              onRefresh={refreshData}
              error={error}
            />
          )}
        </div>
      </aside>
    </>
  );
});

/* CORE TRACKER INTERNAL CONTENT */
interface TrackerCoreContentProps {
  progress: ReturnType<typeof useCOAWorkflowTracker>["progress"];
  selectedControlNo: string;
  selectControlNo: (no: string) => void;
  availableControlNumbers: string[];
  onStepClick: (step: COAWorkflowStep) => void;
  isStepLocked: (key: COAWorkflowStepKey) => boolean;
  hoveredStepKey: COAWorkflowStepKey | null;
  setHoveredStepKey: (key: COAWorkflowStepKey | null) => void;
  onRefresh: () => void;
  error: string | null;
}

function TrackerCoreContent({
  progress,
  selectedControlNo,
  selectControlNo,
  availableControlNumbers,
  onStepClick,
  isStepLocked,
  hoveredStepKey,
  setHoveredStepKey,
  onRefresh,
  error
}: TrackerCoreContentProps) {
  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50 space-y-3 text-center">
        <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 mx-auto" />
        <p className="text-xs font-semibold text-red-800 dark:text-red-300">
          Unable to load workflow.
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* CONTROL NUMBER SELECTOR */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold tracking-wider uppercase text-gray-500 dark:text-neutral-400 flex items-center gap-1">
          <Key className="w-3 h-3 text-smei-crimson" />
          <span>Active Tracking Code</span>
        </label>
        {availableControlNumbers.length > 0 ? (
          <select
            value={selectedControlNo}
            onChange={(e) => selectControlNo(e.target.value)}
            className="w-full text-xs font-bold px-3 py-2 bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-smei-crimson transition-all cursor-pointer"
          >
            {availableControlNumbers.map((no) => (
              <option key={no} value={no}>
                CA No: {no}
              </option>
            ))}
          </select>
        ) : (
          <div className="p-2.5 bg-gray-50 dark:bg-neutral-800/60 rounded-lg border border-dashed border-gray-200 dark:border-neutral-700 text-center">
            <span className="text-[11px] text-gray-400 italic">
              No active control numbers yet
            </span>
          </div>
        )}
      </div>

      {/* TOP PROGRESS BAR & BADGES */}
      <div className="p-3.5 bg-gray-50/80 dark:bg-neutral-800/40 rounded-xl border border-gray-100 dark:border-neutral-800 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-gray-700 dark:text-neutral-300 font-display">
            Overall Completion
          </span>
          <span className="font-bold text-smei-crimson dark:text-red-400 font-mono text-sm">
            {progress.percentage}%
          </span>
        </div>

        {/* PROGRESS BAR */}
        <div className="w-full h-2.5 bg-gray-200 dark:bg-neutral-700 rounded-full overflow-hidden p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.percentage}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={`h-full rounded-full transition-colors ${
              progress.isReadyForCOA
                ? "bg-emerald-500 shadow-sm"
                : "bg-smei-crimson"
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-medium text-gray-500 dark:text-neutral-400 pt-0.5">
          <span>{progress.completedCount} of 5 Complete</span>
          <span>5 Required Docs</span>
        </div>

        {/* READY FOR COA BANNER */}
        {progress.isReadyForCOA && (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-lg flex items-center justify-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs shadow-xs"
          >
            <FileCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-bounce" />
            <span>✔ READY FOR COA</span>
          </motion.div>
        )}
      </div>

      {/* VERTICAL TIMELINE STAGE FLOW */}
      <div className="relative pl-3 space-y-4 pt-1">
        {/* VERTICAL CONNECTOR LINE */}
        <div className="absolute left-[21px] top-4 bottom-6 w-0.5 bg-gray-200 dark:bg-neutral-800 z-0" />

        {progress.steps.map((step, idx) => {
          const IconComponent = STEP_ICONS[step.key] || Key;
          const locked = isStepLocked(step.key);
          const isHovered = hoveredStepKey === step.key;

          // Node styling
          let nodeBg = "bg-gray-100 dark:bg-neutral-800 text-gray-400 border-gray-300 dark:border-neutral-700";
          let statusText = "Waiting...";
          let statusColor = "text-gray-400";

          if (locked) {
            nodeBg = "bg-amber-100 text-amber-700 border-amber-300";
            statusText = "Locked";
            statusColor = "text-amber-600";
          } else if (step.isCompleted) {
            nodeBg = "bg-emerald-500 text-white border-emerald-600 shadow-xs";
            statusText = "Completed";
            statusColor = "text-emerald-600 dark:text-emerald-400";
          } else if (step.status === "in_progress") {
            nodeBg = "bg-blue-600 text-white border-blue-700 shadow-xs animate-pulse";
            statusText = "In Progress";
            statusColor = "text-blue-600 dark:text-blue-400";
          }

          return (
            <div
              key={step.key}
              className="relative z-10"
              onMouseEnter={() => setHoveredStepKey(step.key)}
              onMouseLeave={() => setHoveredStepKey(null)}
            >
              <div
                onClick={() => onStepClick(step)}
                tabIndex={locked ? -1 : 0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onStepClick(step);
                  }
                }}
                className={`group flex items-start gap-3 p-3 rounded-xl border transition-all duration-200 ease-in-out cursor-pointer hover:shadow-md hover:-translate-y-0.5 ${
                  step.isCurrent
                    ? "bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs hover:border-blue-400 dark:hover:border-blue-600"
                    : "bg-white dark:bg-neutral-900 border-gray-100 dark:border-neutral-800 hover:border-smei-crimson/40 dark:hover:border-red-500/40 hover:bg-slate-50/80 dark:hover:bg-neutral-800/60"
                }`}
                role="button"
                aria-label={`${step.stepNumber}. ${step.title}: ${statusText}`}
              >
                {/* NODE ICON */}
                <div
                  className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-transform duration-200 ease-in-out group-hover:scale-110 ${nodeBg}`}
                >
                  {locked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : step.isCompleted ? (
                    <Check className="w-4 h-4 stroke-[3]" />
                  ) : step.status === "in_progress" ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span className="font-mono">{step.stepNumber}</span>
                  )}
                </div>

                {/* TEXT CONTENT */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate font-display group-hover:text-smei-crimson dark:group-hover:text-red-400 transition-colors duration-200">
                      {step.stepNumber}. {step.title}
                    </h4>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider ${statusColor}`}
                    >
                      {statusText}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-500 dark:text-neutral-400 truncate">
                    {step.subtitle}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-gray-400 dark:text-neutral-500 pt-1 font-mono">
                    <span className="truncate font-semibold text-smei-crimson dark:text-rose-400">
                      {step.documentNumber || selectedControlNo || "Pending"}
                    </span>
                    <span className="shrink-0">{step.formattedDate}</span>
                  </div>
                </div>
              </div>

              {/* HOVER DETAILS CARD TOOLTIP */}
              <AnimatePresence>
                {isHovered && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-gray-900 text-white text-xs p-3 rounded-xl shadow-xl space-y-2 border border-gray-800"
                  >
                    <div className="flex items-center justify-between border-b border-gray-800 pb-1.5">
                      <span className="font-bold text-amber-400 font-display">
                        {step.title} Metadata
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                        Stage {step.stepNumber} of 5
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                      <div>
                        <span className="text-gray-400">Created By:</span>
                        <p className="font-semibold truncate text-gray-200">
                          {step.createdBy || "System"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Created Date:</span>
                        <p className="font-semibold text-gray-200">
                          {step.formattedDate || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Control No:</span>
                        <p className="font-semibold text-gray-200 truncate">
                          {selectedControlNo || step.documentNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-400">Status:</span>
                        <p className="font-semibold text-emerald-400">
                          {statusText}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default COAWorkflowTracker;
