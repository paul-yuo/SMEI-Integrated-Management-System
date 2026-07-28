/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Notification,
  User,
  PurchaseOrder,
  PaymentInstructionSlip,
  RequestForSupply,
  CanvassSheet
} from "../types";
import { motion, AnimatePresence } from "motion/react";
import {
  Bell,
  Check,
  X,
  Clipboard,
  ArrowRight,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  Receipt,
  FileSpreadsheet,
  ClipboardList,
  RefreshCw,
  Trash2
} from "lucide-react";
import { api } from "../lib/api";
import {
  getAllowedPendingDocumentTypes,
  isPOPending,
  isPISPending,
  isRFSPending,
  isCanvassPending,
  normalizeDocumentType
} from "../utils/pendingDocumentUtils";

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  currentUser: User;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearReadNotifications?: () => Promise<void> | void;
  onSelectPO: (poId: string) => void;
  onNavigate?: (tab: string) => void;
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  notifications,
  currentUser,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearReadNotifications,
  onSelectPO,
  onNavigate
}: NotificationsPanelProps) {
  // Role-based document type permissions matrix
  const allowedTypes = getAllowedPendingDocumentTypes(currentUser.role);

  // Filter ordinary notifications relevant to this specific role/user and allowed document types
  const relevantNotifications = notifications
    .filter((n) => {
      const matchesUser =
        (n.userId && n.userId === currentUser.id) ||
        (!n.userId && n.role === currentUser.role) ||
        currentUser.role === "Administrator";

      if (!matchesUser) return false;

      // Strict role-based document authorization check
      if (n.documentType) {
        const normType = normalizeDocumentType(n.documentType);
        if (normType && !allowedTypes.includes(normType)) {
          return false;
        }
      }
      return true;
    })
    .reverse(); // latest first

  const unreadCount = relevantNotifications.filter((n) => !n.isRead && n.status !== "READ").length;
  const readCount = relevantNotifications.filter((n) => n.isRead || n.status === "READ").length;

  // Clear Read confirmation modal & process state
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearFeedback, setClearFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleConfirmClearRead = async () => {
    setIsClearing(true);
    setClearFeedback(null);
    try {
      if (onClearReadNotifications) {
        await onClearReadNotifications();
      }
      setClearFeedback({ type: "success", text: "Read notifications cleared successfully." });
      setTimeout(() => {
        setShowClearConfirm(false);
        setClearFeedback(null);
      }, 700);
    } catch (err) {
      console.error("Failed to clear read notifications:", err);
      setClearFeedback({ type: "error", text: "Unable to clear read notifications." });
    } finally {
      setIsClearing(false);
    }
  };

  // Procurement documents state for dynamic pending calculations
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [pises, setPises] = useState<PaymentInstructionSlip[]>([]);
  const [rfses, setRfses] = useState<RequestForSupply[]>([]);
  const [canvasses, setCanvasses] = useState<CanvassSheet[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);

  // Independent collapsible container states (true = expanded, false = collapsed)
  const [expandedContainers, setExpandedContainers] = useState<Record<string, boolean>>({
    PO: true,
    PIS: true,
    RFS: true,
    CANVASS: true
  });

  const toggleContainer = (type: string) => {
    setExpandedContainers((prev) => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  // Synchronize dynamic procurement records whenever notification drawer is opened
  useEffect(() => {
    if (isOpen) {
      setLoadingDocs(true);
      Promise.all([
        allowedTypes.includes("PO") ? api.getPOs().catch(() => []) : Promise.resolve([]),
        allowedTypes.includes("PIS") ? api.getPIS().catch(() => []) : Promise.resolve([]),
        allowedTypes.includes("RFS") ? api.getRFS().catch(() => []) : Promise.resolve([]),
        allowedTypes.includes("CANVASS") ? api.getCanvass().catch(() => []) : Promise.resolve([])
      ])
        .then(([poData, pisData, rfsData, canvData]) => {
          setPos(poData || []);
          setPises(pisData || []);
          setRfses(rfsData || []);
          setCanvasses(canvData || []);
        })
        .finally(() => {
          setLoadingDocs(false);
        });
    }
  }, [isOpen, currentUser.role]);

  // Dynamically calculate pending approval documents using centralized pending logic
  const pendingPOs = allowedTypes.includes("PO") ? pos.filter(isPOPending) : [];
  const pendingPIS = allowedTypes.includes("PIS") ? pises.filter(isPISPending) : [];
  const pendingRFS = allowedTypes.includes("RFS") ? rfses.filter(isRFSPending) : [];
  const pendingCanvass = allowedTypes.includes("CANVASS") ? canvasses.filter(isCanvassPending) : [];

  const totalPendingCount =
    pendingPOs.length + pendingPIS.length + pendingRFS.length + pendingCanvass.length;

  // Priority Order of Procurement Approval Containers (strictly filtered by role allowed types):
  const pendingGroups = [
    {
      type: "PO",
      title: "Purchase Orders",
      icon: FileText,
      items: pendingPOs,
      getNumber: (po: PurchaseOrder) => po.poNumber || "PO-UNASSIGNED",
      getSubtext: (po: PurchaseOrder) => po.supplierName || po.preparedBy || "Awaiting Approval",
      destination: "procurement-approval"
    },
    {
      type: "PIS",
      title: "Payment Instruction Slips",
      icon: Receipt,
      items: pendingPIS,
      getNumber: (pis: PaymentInstructionSlip) => pis.pisNumber || "PIS-UNASSIGNED",
      getSubtext: (pis: PaymentInstructionSlip) => pis.payee || pis.requestedBy || "Awaiting Approval",
      destination: "procurement-approval"
    },
    {
      type: "RFS",
      title: "Requests For Supply",
      icon: ClipboardList,
      items: pendingRFS,
      getNumber: (rfs: RequestForSupply) => rfs.rfsNumber || "RFS-UNASSIGNED",
      getSubtext: (rfs: RequestForSupply) => rfs.department || rfs.requestedBy || "Awaiting Approval",
      destination: "procurement-approval"
    },
    {
      type: "CANVASS",
      title: "Canvass Sheets",
      icon: FileSpreadsheet,
      items: pendingCanvass,
      getNumber: (canv: CanvassSheet) =>
        canv.canvassNumber ? `CS-${canv.canvassNumber}` : "CS-UNASSIGNED",
      getSubtext: (canv: CanvassSheet) =>
        canv.recommendedSupplier || canv.supplierName || canv.requestedBy || "Awaiting Approval",
      destination: "procurement-approval"
    }
  ].filter((group) => allowedTypes.includes(group.type as any));

  // Handle clicking a pending document: navigate to approval workflow/document
  const handlePendingDocClick = (docType: string, doc: any) => {
    onClose();
    if (docType === "PO") {
      onSelectPO(doc.id);
    } else if (onNavigate) {
      onNavigate("procurement-approval");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.3 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black z-40 no-print"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white shadow-2xl z-50 p-6 overflow-y-auto border-l border-gray-100 flex flex-col justify-between no-print"
          >
            <div>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Bell className="w-5 h-5 text-smei-crimson" />
                    {(unreadCount > 0 || totalPendingCount > 0) && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-yellow-500 rounded-full border border-white" />
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-gray-800 font-display">System Notifications</h3>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Notification Header Action Controls */}
              <div className="flex items-center justify-between gap-2 mb-4 pb-3 border-b border-gray-100">
                <div>
                  {unreadCount > 0 ? (
                    <button
                      onClick={onMarkAllAsRead}
                      className="text-xs font-bold text-smei-crimson hover:text-smei-darkred flex items-center gap-1 hover:underline cursor-pointer transition-colors"
                      title={`Mark all as read for ${currentUser.role}`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Mark All as Read</span>
                    </button>
                  ) : (
                    <span className="text-[11px] font-medium text-gray-400 italic">No unread alerts</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (readCount === 0) return;
                    setClearFeedback(null);
                    setShowClearConfirm(true);
                  }}
                  disabled={readCount === 0}
                  className={`text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-all ${
                    readCount > 0
                      ? "text-gray-700 hover:text-smei-crimson hover:bg-red-50 border border-gray-200 hover:border-red-200 cursor-pointer shadow-2xs"
                      : "text-gray-300 border border-gray-100 bg-gray-50/50 cursor-not-allowed opacity-60"
                  }`}
                  title={readCount > 0 ? "Clear all read notifications" : "No read notifications to clear."}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Read</span>
                </button>
              </div>

              {/* PRIORITIZED PENDING APPROVAL SECTION */}
              {totalPendingCount > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-smei-crimson uppercase tracking-wider font-mono">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Pending Approvals</span>
                    </div>
                    {loadingDocs && (
                      <RefreshCw className="w-3 h-3 text-gray-400 animate-spin" />
                    )}
                  </div>

                  {pendingGroups.map((group) => {
                    // Do NOT display empty containers!
                    if (group.items.length === 0) return null;

                    const isExpanded = expandedContainers[group.type] ?? true;
                    const GroupIcon = group.icon;

                    return (
                      <div
                        key={group.type}
                        className="border border-red-100 rounded-xl overflow-hidden bg-white shadow-xs transition-all"
                      >
                        {/* Container Header */}
                        <button
                          onClick={() => toggleContainer(group.type)}
                          className="w-full px-3.5 py-2.5 bg-red-50/40 hover:bg-red-50/80 transition-colors flex items-center justify-between text-left select-none cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <GroupIcon className="w-4 h-4 text-smei-crimson shrink-0" />
                            <span className="font-bold text-xs text-gray-900 truncate">
                              {group.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-smei-crimson text-white shadow-2xs">
                              {group.items.length} Pending
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-gray-500" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-500" />
                            )}
                          </div>
                        </button>

                        {/* Expandable Document Items */}
                        {isExpanded && (
                          <div className="divide-y divide-gray-100 border-t border-red-100/60 bg-white">
                            {group.items.map((item: any) => {
                              const docNumber = group.getNumber(item);
                              const subtext = group.getSubtext(item);
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => handlePendingDocClick(group.type, item)}
                                  className="p-3 hover:bg-red-50/20 transition-colors cursor-pointer group flex items-start justify-between gap-2"
                                >
                                  <div className="min-w-0 flex-1 space-y-0.5">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono text-xs font-bold text-smei-crimson group-hover:underline truncate">
                                        {docNumber}
                                      </span>
                                      <span className="text-[9px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200 shrink-0">
                                        Pending Review
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-gray-600 truncate">
                                      {subtext}
                                    </p>
                                  </div>
                                  <div className="flex items-center text-xs font-bold text-smei-crimson opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 pt-1">
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ORDINARY NOTIFICATIONS SECTION */}
              <div className="space-y-3">
                {relevantNotifications.length > 0 ? (
                  <>
                    {totalPendingCount > 0 && (
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-mono pt-2 border-t border-gray-100">
                        Activity Alerts
                      </div>
                    )}
                    {relevantNotifications.map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          if (notif.poId) {
                            onSelectPO(notif.poId);
                            onClose();
                          }
                          onMarkAsRead(notif.id);
                        }}
                        className={`p-4 rounded-xl border transition-all cursor-pointer hover:border-smei-lightred/40 hover:bg-red-50/10 flex items-start gap-3 relative overflow-hidden group ${
                          notif.isRead
                            ? "bg-white border-gray-100 text-gray-500"
                            : "bg-red-50/30 border-red-100/50 text-gray-800"
                        }`}
                      >
                        {/* Left color bar for unread notifications */}
                        {!notif.isRead && (
                          <span className="absolute left-0 top-0 bottom-0 w-1 bg-smei-crimson" />
                        )}

                        <div className={`p-2 rounded-lg ${notif.isRead ? "bg-gray-100" : "bg-red-50"} shrink-0`}>
                          <Clipboard className={`w-4 h-4 ${notif.isRead ? "text-gray-400" : "text-smei-crimson"}`} />
                        </div>

                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h4 className={`text-xs font-bold leading-tight truncate ${notif.isRead ? "text-gray-700" : "text-gray-900"}`}>
                              {notif.title}
                            </h4>
                            {!notif.isRead && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkAsRead(notif.id);
                                }}
                                className="text-[10px] text-gray-400 hover:text-smei-crimson font-bold shrink-0"
                                title="Mark read"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] leading-relaxed text-gray-600 break-words">
                            {notif.message}
                          </p>
                          <div className="flex items-center justify-between text-[9px] text-gray-400 font-mono mt-1 pt-1 border-t border-gray-100/40">
                            <span>{notif.date} • {notif.time}</span>
                            {notif.poId && (
                              <span className="text-smei-crimson font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                <span>Action PO</span>
                                <ArrowRight className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : totalPendingCount === 0 ? (
                  <div className="py-12 text-center text-gray-400 font-sans space-y-2">
                    <AlertCircle className="w-8 h-8 text-gray-200 mx-auto" />
                    <p className="text-xs">No pending notifications for your clearance.</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Footer details */}
            <div className="border-t border-gray-100 pt-4 text-center mt-6">
              <span className="text-[10px] text-gray-400 font-mono">
                SMEI Real-Time Activity Alert Dispatcher
              </span>
            </div>
          </motion.div>

          {/* CLEAR READ NOTIFICATIONS CONFIRMATION MODAL */}
          <AnimatePresence>
            {showClearConfirm && (
              <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 no-print">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl border border-gray-200 p-6 max-w-sm w-full shadow-2xl space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 bg-red-50 text-smei-crimson rounded-xl shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 min-w-0 flex-1">
                      <h4 className="text-base font-bold text-gray-900 font-display">
                        Clear Read Notifications?
                      </h4>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        This will permanently remove all notifications that have already been marked as read.
                      </p>
                      <p className="text-[11px] text-gray-500 font-semibold pt-1">
                        Unread notifications will not be affected.
                      </p>
                    </div>
                  </div>

                  {clearFeedback && (
                    <div className={`p-2.5 rounded-lg text-xs font-semibold ${
                      clearFeedback.type === "success"
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}>
                      {clearFeedback.text}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={() => setShowClearConfirm(false)}
                      className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isClearing}
                      onClick={handleConfirmClearRead}
                      className="px-4 py-2 text-xs font-bold text-white bg-smei-crimson hover:bg-smei-darkred rounded-lg shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isClearing ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Clearing...</span>
                        </>
                      ) : (
                        <span>Clear</span>
                      )}
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
    </AnimatePresence>
  );
}

