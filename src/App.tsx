/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, UserRole, PurchaseOrder, Supplier, AuditLog, Notification } from "./types";
import { api, removeToken } from "./lib/api";
import Header, { PrintHeader } from "./components/Header";
import Login from "./components/Login";
import Register from "./components/Register";
import Dashboard from "./components/Dashboard";
import ProfileModal from "./components/ProfileModal";
import SuppliersList from "./components/SuppliersList";
import SupplierSummaryReport from "./components/SupplierSummaryReport";
import SupplierAnalyticsDashboard from "./components/SupplierAnalyticsDashboard";
import AuditLogView from "./components/AuditLogView";
import UserManagement from "./components/UserManagement";
import RoleManagement from "./components/RoleManagement";
import NotificationsPanel from "./components/NotificationsPanel";
import POList from "./components/POList";
import POForm from "./components/POForm";
import PaymentInstructionSlipModule from "./components/PaymentInstructionSlipModule";
import RequestForSupplyModule from "./components/RequestForSupplyModule";
import RfsApprovalModule from "./components/RfsApprovalModule";
import CanvassSheetModule from "./components/CanvassSheetModule";
import smeiLogo from "./assets/images/smei_logo_1782431389924.jpg";
import { 
  LayoutDashboard, 
  FileText, 
  Users, 
  History, 
  Settings, 
  FileUp, 
  FileDown, 
  Eye, 
  ClipboardCheck, 
  BarChart3,
  UserCheck,
  ShieldAlert,
  User as UserIcon,
  Building2,
  Package,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GitCompare,
  LogOut,
  Sun,
  Moon
} from "lucide-react";
import { useTheme } from "./components/ThemeProvider";

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [greetingMessage, setGreetingMessage] = useState<string | null>(null);
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const [currentTab, setCurrentTab] = useState<string>("dashboard");
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [showPOForm, setShowPOForm] = useState(false);
  const [poListStatusFilter, setPoListStatusFilter] = useState<string>("All");
  const [isInitializing, setIsInitializing] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOperationsOpen, setIsOperationsOpen] = useState(true);

  // Track and automatically collapse sidebar for document editors
  const previousSidebarStateRef = React.useRef<boolean>(false);
  const activeEditorsCountRef = React.useRef<number>(0);
  const isSidebarCollapsedRef = React.useRef(isSidebarCollapsed);

  React.useEffect(() => {
    isSidebarCollapsedRef.current = isSidebarCollapsed;
  }, [isSidebarCollapsed]);

  React.useEffect(() => {
    const handleEditorOpened = () => {
      activeEditorsCountRef.current += 1;
      if (activeEditorsCountRef.current === 1) {
        // First editor opened, remember user's manual state and collapse
        previousSidebarStateRef.current = isSidebarCollapsedRef.current;
        setIsSidebarCollapsed(true);
      }
    };

    const handleEditorClosed = () => {
      activeEditorsCountRef.current = Math.max(0, activeEditorsCountRef.current - 1);
      if (activeEditorsCountRef.current === 0) {
        // All editors closed, restore original state
        setIsSidebarCollapsed(previousSidebarStateRef.current);
      }
    };

    window.addEventListener("smei-editor-opened", handleEditorOpened);
    window.addEventListener("smei-editor-closed", handleEditorClosed);

    return () => {
      window.removeEventListener("smei-editor-opened", handleEditorOpened);
      window.removeEventListener("smei-editor-closed", handleEditorClosed);
    };
  }, []);
  
  const { theme, toggleTheme } = useTheme();

  // Logo Src
  const logoSrc = smeiLogo;
  const [logoError, setLogoError] = useState(false);

  // Profile Modal state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalSection, setProfileModalSection] = useState<"profile" | "settings" | "password">("profile");

  // Check auth session on startup
  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await api.getCurrentUser();
        setCurrentUser(response.user);
      } catch (err) {
        removeToken();
        setCurrentUser(null);
      } finally {
        setIsInitializing(false);
      }
    };
    initAuth();
  }, []);

  // Fetch all database records when authenticated
  const loadAllData = async () => {
    if (!currentUser) return;
    try {
      const fetchedPOs = await api.getPOs();
      setPOs(fetchedPOs);
      
      const fetchedSuppliers = await api.getSuppliers();
      setSuppliers(fetchedSuppliers);
      
      if (currentUser.role === UserRole.Administrator) {
        const fetchedLogs = await api.getAuditLogs();
        setAuditLogs(fetchedLogs);
      }
      
      const fetchedNotifs = await api.getNotifications();
      setNotifications(fetchedNotifs);
    } catch (err) {
      console.error("Failed to sync database resources:", err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAllData();
    }
  }, [currentUser]);

  // Auth Expired listener (auto log out on JWT expiry)
  useEffect(() => {
    const handleAuthExpired = () => {
      setCurrentUser(null);
      removeToken();
      alert("Your authentication session has expired. Please log in again.");
    };
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (window.smeiHasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    window.addEventListener("auth-expired", handleAuthExpired);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("auth-expired", handleAuthExpired);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // Auth Operations
  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentTab("dashboard");
    const greetings = ["Welcome back", "Hello there", "Good to see you", "Greetings"];
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    const firstName = user.fullName.split(" ")[0];
    setGreetingMessage(`${randomGreeting}!, ${firstName}`);
    setTimeout(() => setGreetingMessage(null), 5000); // hide after 5 seconds
  };

  const handleLogout = async () => {
    if (!checkUnsavedChanges()) return;
    await api.logout();
    setCurrentUser(null);
    setSelectedPO(null);
    setShowPOForm(false);
    setPOs([]);
    setSuppliers([]);
    setAuditLogs([]);
    setNotifications([]);
  };

  // PO CRUD operations synced with backend database
  const handleSavePO = async (savedPO: PurchaseOrder) => {
    try {
      const isNew = !pos.some((p) => p.id === savedPO.id);
      if (isNew) {
        await api.createPO(savedPO);
      } else {
        await api.updatePO(savedPO.id, savedPO);
      }
      await loadAllData();
      
      setSelectedPO(null);
      setShowPOForm(false);
      setCurrentTab("po-list");
    } catch (err: any) {
      alert(`Failed to save Purchase Order: ${err.message}`);
    }
  };

  const handleDeletePO = async (id: string) => {
    try {
      await api.deletePO(id);
      await loadAllData();
    } catch (err: any) {
      alert(`Failed to delete Purchase Order: ${err.message}`);
    }
  };

  const handleImportPOs = async (imported: PurchaseOrder[]) => {
    try {
      for (const po of imported) {
        await api.createPO(po);
      }
      await loadAllData();
      alert(`Successfully imported ${imported.length} purchase orders into persistent storage.`);
    } catch (err: any) {
      alert(`Bulk import failure: ${err.message}`);
    }
  };

  // Supplier Operations synced with backend database
  const handleAddSupplier = async (supData: Omit<Supplier, "id" | "createdAt"> & { status: "Active" | "Disabled"; created_by: string }) => {
    try {
      await api.createSupplier(supData);
      await loadAllData();
    } catch (err: any) {
      alert(`Failed to create supplier: ${err.message}`);
    }
  };

  const handleEditSupplier = async (sup: Supplier) => {
    try {
      await api.updateSupplier(sup.id, sup);
      await loadAllData();
    } catch (err: any) {
      alert(`Failed to update supplier: ${err.message}`);
    }
  };

  const handleDeleteSupplier = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      await api.deleteSupplier(id);
      await loadAllData();
      return { success: true };
    } catch (err: any) {
      console.error("Failed to delete supplier:", err);
      return { success: false, error: err.message || "Failed to delete supplier." };
    }
  };

  // Notification Operations
  const handleMarkNotifRead = async (id: string) => {
    try {
      await api.readNotification(id);
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkAllNotifRead = async () => {
    try {
      await api.readAllNotifications();
      await loadAllData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectPOFromNotif = (poId: string) => {
    const found = pos.find((p) => p.id === poId);
    if (found) {
      setSelectedPO(found);
      setShowPOForm(true);
      setCurrentTab("po-form");
    }
  };

  // Log Clear (Admins Only)
  const handleClearAuditLogs = () => {
    alert("Audit log deletion is prohibited by corporate policy to maintain compliance records.");
  };

  // Unread Alerts Count
  const unreadAlertsCount = currentUser
    ? notifications.filter((n) => n.userId === currentUser.id && !n.isRead).length
    : 0;

  // Dynamic Menu Items (Purged Demo switch)
  const getRoleMenuItems = (role: UserRole) => {
    switch (role) {
      case UserRole.Administrator:
        return [
          { name: "Dashboard", key: "dashboard", icon: "home" },
          { name: "Purchase Orders", key: "po-all", icon: "file" },
          { name: "Payment Instruction Slip", key: "pis", icon: "pis" },
          { name: "Request for Supply", key: "rfs", icon: "rfs" },
          { name: "Canvass Sheet", key: "canvass", icon: "canvass" },
          { name: "RFS Approval", key: "rfs-approval", icon: "check" },
          { name: "Supplier Registry", key: "suppliers", icon: "users" },
          { name: "Supplier Summary", key: "supplier-report", icon: "reports" },
          { name: "Supplier Analytics", key: "supplier-analytics", icon: "reports" },
          { name: "User Accounts", key: "user-management", icon: "user-management" },
          { name: "Access Privilege Matrix", key: "roles", icon: "role-management" },
          { name: "Audit Trail Logs", key: "audit-logs", icon: "log" }
        ];
      case UserRole.PurchasingStaff:
        return [
          { name: "Dashboard", key: "dashboard", icon: "home" },
          { name: "Purchase Orders", key: "po-all", icon: "file" },
          { name: "Payment Instruction Slip", key: "pis", icon: "pis" },
          { name: "Request for Supply", key: "rfs", icon: "rfs" },
          { name: "Canvass Sheet", key: "canvass", icon: "canvass" },
          { name: "RFS Approval", key: "rfs-approval", icon: "check" },
          { name: "Supplier Registry", key: "suppliers", icon: "users" },
          { name: "Supplier Summary", key: "supplier-report", icon: "reports" },
          { name: "Supplier Analytics", key: "supplier-analytics", icon: "reports" },
          { name: "Import Excel", key: "excel-import", icon: "import" },
          { name: "Export Excel", key: "excel-export", icon: "export" },
        ];
      case UserRole.DepartmentHead:
        return [
          { name: "Dashboard", key: "dashboard", icon: "home" },
          { name: "Purchase Order Review", key: "po-review", icon: "review" },
          { name: "Payment Instruction Slip", key: "pis", icon: "pis" },
          { name: "Request for Supply", key: "rfs", icon: "rfs" },
          { name: "Canvass Sheet", key: "canvass", icon: "canvass" },
          { name: "Approval Queue", key: "approval-queue", icon: "queue" },
        ];
      case UserRole.AccountingStaff:
        return [
          { name: "Dashboard", key: "dashboard", icon: "home" },
          { name: "Verification Queue", key: "verification-queue", icon: "verified" },
          { name: "Payment Instruction Slip", key: "pis", icon: "pis" },
          { name: "Request for Supply", key: "rfs", icon: "rfs" },
          { name: "Canvass Sheet", key: "canvass", icon: "canvass" },
          { name: "Supplier Registry", key: "suppliers", icon: "users" },
          { name: "Supplier Summary", key: "supplier-report", icon: "reports" },
          { name: "Supplier Analytics", key: "supplier-analytics", icon: "reports" },
        ];
      case UserRole.Director:
        return [
          { name: "Dashboard", key: "dashboard", icon: "home" },
          { name: "Final Approval Queue", key: "final-approval-queue", icon: "queue" },
          { name: "Payment Instruction Slip", key: "pis", icon: "pis" },
          { name: "Request for Supply", key: "rfs", icon: "rfs" },
          { name: "Canvass Sheet", key: "canvass", icon: "canvass" },
          { name: "Supplier Registry", key: "suppliers", icon: "users" },
          { name: "Supplier Summary", key: "supplier-report", icon: "reports" },
          { name: "Supplier Analytics", key: "supplier-analytics", icon: "reports" },
        ];
      case UserRole.Viewer:
        return [
          { name: "Dashboard", key: "dashboard", icon: "home" },
          { name: "Purchase Orders", key: "po-all", icon: "file" },
          { name: "Payment Instruction Slip", key: "pis", icon: "pis" },
          { name: "Request for Supply", key: "rfs", icon: "rfs" },
          { name: "Canvass Sheet", key: "canvass", icon: "canvass" },
          { name: "Supplier Registry", key: "suppliers", icon: "users" },
          { name: "Supplier Summary", key: "supplier-report", icon: "reports" },
          { name: "Supplier Analytics", key: "supplier-analytics", icon: "reports" },
        ];
      default:
        return [
          { name: "Dashboard", key: "dashboard", icon: "home" },
        ];
    }
  };

  const checkUnsavedChanges = (): boolean => {
    if (window.smeiHasUnsavedChanges) {
      const confirmDiscard = window.confirm("You have unsaved changes. Are you sure you want to discard them and navigate away?");
      if (!confirmDiscard) {
        return false;
      }
      window.smeiHasUnsavedChanges = false;
    }
    return true;
  };

  const handleMenuClick = (menuKey: string) => {
    if (!checkUnsavedChanges()) return;
    setSelectedPO(null);
    setShowPOForm(false);
    setIsMobileSidebarOpen(false);
    
    if (menuKey === "dashboard") {
      setCurrentTab("dashboard");
    } else if (menuKey === "po-all") {
      setPoListStatusFilter("All");
      setCurrentTab("po-list");
    } else if (menuKey === "pis") {
      setCurrentTab("pis");
    } else if (menuKey === "rfs") {
      setCurrentTab("rfs");
    } else if (menuKey === "rfs-approval") {
      setCurrentTab("rfs-approval");
    } else if (menuKey === "canvass") {
      setCurrentTab("canvass");
    } else if (menuKey === "suppliers") {
      setCurrentTab("suppliers");
    } else if (menuKey === "supplier-report") {
      setCurrentTab("supplier-report");
    } else if (menuKey === "supplier-analytics") {
      setCurrentTab("supplier-analytics");
    } else if (menuKey === "user-management") {
      setCurrentTab("users");
    } else if (menuKey === "users") {
      setCurrentTab("users");
    } else if (menuKey === "roles") {
      setCurrentTab("roles");
    } else if (menuKey === "audit-logs") {
      setCurrentTab("audit-logs");
    } else if (menuKey === "po-review" || menuKey === "approval-queue") {
      setPoListStatusFilter("Pending Review");
      setCurrentTab("po-list");
    } else if (menuKey === "verification-queue") {
      setPoListStatusFilter("Pending Review");
      setCurrentTab("po-list");
    } else if (menuKey === "final-approval-queue") {
      setPoListStatusFilter("Pending Approval");
      setCurrentTab("po-list");
    } else if (menuKey === "excel-import") {
      setPoListStatusFilter("All");
      setCurrentTab("po-list");
      setTimeout(() => {
        alert("To bulk-import spreadsheets, click the 'Bulk Spreadsheet Excel Import' button at the top of the Purchase Orders Directory.");
      }, 150);
    } else if (menuKey === "excel-export") {
      setPoListStatusFilter("All");
      setCurrentTab("po-list");
      setTimeout(() => {
        alert("To export purchase orders, select any approved Purchase Order to view its document, or use the summary reports options.");
      }, 150);
    }
  };

  const renderMenuIcon = (icon: string) => {
    switch (icon) {
      case "home":
        return <LayoutDashboard className="w-5 h-5 transition-transform duration-300" />;
      case "file":
      case "review":
      case "queue":
      case "verified":
        return <ClipboardCheck className="w-5 h-5 transition-transform duration-300" />;
      case "pis":
        return <CreditCard className="w-5 h-5 transition-transform duration-300" />;
      case "rfs":
        return <Package className="w-5 h-5 transition-transform duration-300" />;
      case "canvass":
        return <GitCompare className="w-5 h-5 transition-transform duration-300" />;
      case "check":
        return <UserCheck className="w-5 h-5 transition-transform duration-300" />;
      case "users":
        return <Building2 className="w-5 h-5 transition-transform duration-300" />;
      case "user-management":
        return <Users className="w-5 h-5 transition-transform duration-300" />;
      case "role-management":
        return <ShieldAlert className="w-5 h-5 transition-transform duration-300" />;
      case "log":
        return <History className="w-5 h-5 transition-transform duration-300" />;
      case "settings":
        return <Settings className="w-5 h-5 transition-transform duration-300" />;
      case "import":
        return <FileUp className="w-5 h-5 transition-transform duration-300" />;
      case "export":
        return <FileDown className="w-5 h-5 transition-transform duration-300" />;
      case "reports":
        return <BarChart3 className="w-5 h-5 transition-transform duration-300" />;
      default:
        return <LayoutDashboard className="w-5 h-5 transition-transform duration-300" />;
    }
  };

  const isMenuLinkActive = (menuKey: string) => {
    if (menuKey === "dashboard") return currentTab === "dashboard";
    if (menuKey === "pis") return currentTab === "pis";
    if (menuKey === "rfs") return currentTab === "rfs";
    if (menuKey === "rfs-approval") return currentTab === "rfs-approval";
    if (menuKey === "canvass") return currentTab === "canvass";
    if (menuKey === "suppliers") return currentTab === "suppliers";
    if (menuKey === "supplier-report") return currentTab === "supplier-report";
    if (menuKey === "supplier-analytics") return currentTab === "supplier-analytics";
    if (menuKey === "user-management") return currentTab === "users";
    if (menuKey === "users") return currentTab === "users";
    if (menuKey === "roles") return currentTab === "roles";
    if (menuKey === "audit-logs") return currentTab === "audit-logs";
    
    if (currentTab === "po-list" || currentTab === "po-form") {
      if (menuKey === "po-all") return poListStatusFilter === "All";
      if (menuKey === "po-review" || menuKey === "approval-queue" || menuKey === "verification-queue") return poListStatusFilter === "Pending Review";
      if (menuKey === "final-approval-queue") return poListStatusFilter === "Pending Approval";
    }
    return false;
  };

  // Spinner on load check
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
        <span className="w-12 h-12 border-4 border-[#B22222]/35 border-t-[#B22222] rounded-full animate-spin" />
        <h3 className="text-xs font-semibold tracking-wide uppercase font-mono text-neutral-400 mt-5">
          Verifying secure session tunnel...
        </h3>
      </div>
    );
  }

  if (!currentUser) {
    if (window.location.pathname === "/register") {
      return <Register />;
    }
    return <Login onLoginSuccess={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-[#0a0a0a] flex font-sans text-neutral-800 dark:text-neutral-200 print:block transition-colors duration-300">
      
      {/* Left Sidebar (Hidden on Print) */}
      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}
      
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen bg-white text-slate-800 dark:bg-slate-900 dark:text-white flex flex-col border-r border-gray-200 dark:border-slate-800 shrink-0 no-print transition-all duration-300 ease-in-out ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      } ${
        isMobileSidebarOpen ? 'translate-x-0 flex w-64' : '-translate-x-full lg:translate-x-0 hidden lg:flex'
      }`}>
        {/* HEADER */}
        <div className={`h-16 border-b border-gray-200 dark:border-neutral-900 flex items-center justify-between transition-all duration-300 ease-in-out shrink-0 ${isSidebarCollapsed ? 'px-3 justify-center' : 'px-4 gap-3'}`}>
          <div className="flex items-center gap-3 min-w-0">
            {/* Monogram logo */}
            <div 
              className="w-9 h-9 bg-smei-crimson dark:bg-[#B22222] rounded flex items-center justify-center shrink-0 shadow-sm dark:shadow-[0_0_12px_rgba(178,34,34,0.4)] border border-red-200 dark:border-[#d32f2f]/30 cursor-pointer transition-transform duration-200 hover:scale-105"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title="Click to toggle sidebar"
            >
              <span className="text-white font-mono font-black text-sm tracking-tighter animate-pulse">SM</span>
            </div>
            
            {/* Title Block */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden flex flex-col ${isSidebarCollapsed ? 'w-0 opacity-0 scale-95 pointer-events-none' : 'w-40 opacity-100'}`}>
              <span className="text-xs font-bold tracking-tight text-gray-800 dark:text-white font-sans truncate uppercase">
                Southcoast Metal
              </span>
              <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500 dark:text-neutral-500 mt-0.5 truncate leading-none">
                Enterprise Inc
              </span>
            </div>
          </div>

          {/* Toggle Button */}
          {!isSidebarCollapsed && (
            <button 
              onClick={() => setIsSidebarCollapsed(true)}
              className="text-gray-400 hover:text-gray-800 dark:text-neutral-500 dark:hover:text-white transition-colors duration-200 focus:outline-none shrink-0"
              title="Collapse Sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* NAVIGATION NAV RAIL */}
        <div className="flex-1 overflow-y-auto py-4 space-y-1 custom-scrollbar flex flex-col justify-between">
          <nav className="space-y-1">
            {getRoleMenuItems(currentUser.role).map((menuItem) => {
              const active = isMenuLinkActive(menuItem.key);
              return (
                <button
                  key={menuItem.key}
                  onClick={() => handleMenuClick(menuItem.key)}
                  className={`w-[calc(100%-16px)] mx-2 flex items-center py-2.5 transition-all duration-150 cursor-pointer group focus:outline-none rounded-lg ${
                    isSidebarCollapsed ? 'justify-center px-2' : 'px-4'
                  } ${
                    active
                      ? "bg-red-100 text-red-700 dark:bg-red-700 dark:text-white border-l-4 border-red-700 dark:border-red-500 font-extrabold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border-l-4 border-transparent"
                  }`}
                  title={isSidebarCollapsed ? menuItem.name : undefined}
                >
                  {/* Icon */}
                  <div className={`transition-all duration-150 shrink-0 ${
                    isSidebarCollapsed ? '' : 'mr-3'
                  } ${
                    active ? 'text-red-700 dark:text-white' : 'text-slate-500 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300'
                  }`}>
                    {renderMenuIcon(menuItem.icon)}
                  </div>
                  {/* Text */}
                  <span className={`transition-all duration-200 ease-in-out whitespace-nowrap overflow-hidden font-mono text-[10px] tracking-wider uppercase font-bold ${
                    isSidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-auto opacity-100'
                  }`}>
                    {menuItem.name}
                  </span>
                </button>
              );
            })}
          </nav>
          
          {/* Role Impersonation Switcher (Only visible to true Administrators) */}
          {currentUser.realRole === UserRole.Administrator && !isSidebarCollapsed && (
            <div className="mx-3 mt-4 mb-2 p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-smei-crimson dark:text-red-400 uppercase tracking-widest font-mono">
                  <Settings className="w-3 h-3 text-smei-crimson dark:text-red-400" />
                  <span>IMPERSONATE ROLE</span>
                </div>
                {currentUser.role !== UserRole.Administrator && (
                  <button
                    onClick={async () => {
                      localStorage.removeItem("smei_impersonated_role");
                      try {
                        const response = await api.getCurrentUser();
                        setCurrentUser(response.user);
                      } catch (err) {
                        console.error("Failed to restore Administrator mode:", err);
                      }
                    }}
                    className="text-[8px] font-extrabold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white uppercase tracking-wider underline cursor-pointer"
                  >
                    RESET
                  </button>
                )}
              </div>
              <select
                value={currentUser.role}
                onChange={async (e) => {
                  const newRole = e.target.value as UserRole;
                  if (newRole === UserRole.Administrator) {
                    localStorage.removeItem("smei_impersonated_role");
                  } else {
                    localStorage.setItem("smei_impersonated_role", newRole);
                  }
                  try {
                    const response = await api.getCurrentUser();
                    setCurrentUser(response.user);
                  } catch (err) {
                    console.error("Failed to impersonate role:", err);
                  }
                }}
                className="w-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 text-[10px] font-mono rounded px-2 py-1.5 focus:outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="Administrator">Admin</option>
                <option value="Purchasing Staff">Purchasing Staff</option>
                <option value="Department Head">Dept Head</option>
                <option value="Accounting Staff">Accounting Staff</option>
                <option value="Director">Director</option>
                <option value="Viewer">Viewer</option>
              </select>
            </div>
          )}
          {/* Theme Switcher */}
          {!isSidebarCollapsed && (
            <div className="mx-3 mt-auto mb-4 shrink-0">
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-xs border border-gray-200 dark:border-slate-700"
              >
                {theme === "dark" ? "☀️ Light Mode" : "🌙 Dark Mode"}
              </button>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="mt-auto mb-4 flex justify-center shrink-0">
              <button
                onClick={toggleTheme}
                className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
              >
                {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              </button>
            </div>
          )}

        </div>

        {/* PROFILE FOOTER */}
        <div className="bg-slate-50 dark:bg-slate-900/50 border-t border-gray-200 dark:border-slate-800 p-4 shrink-0 flex flex-col">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            {/* Circular badge avatar */}
            <div 
              className="w-9 h-9 rounded-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold font-mono text-smei-crimson dark:text-red-400 shrink-0 shadow-sm"
              title={`${currentUser.fullName} (${currentUser.role})`}
            >
              {(() => {
                const initials = currentUser.fullName
                  ? currentUser.fullName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
                  : "SM";
                return initials;
              })()}
            </div>
            
            {/* Active Username & Role subtitle */}
            <div className={`min-w-0 flex-1 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarCollapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-auto opacity-100'}`}>
              <p className="text-xs font-bold truncate text-gray-800 dark:text-white leading-tight">
                {currentUser.fullName}
              </p>
              <p className="text-[9px] text-slate-500 dark:text-slate-400 font-mono tracking-tight mt-0.5 truncate uppercase">
                {currentUser.role}
              </p>
            </div>
          </div>
          
          {/* Logout Action Button & System Version */}
          {!isSidebarCollapsed ? (
            <div className="mt-3 flex flex-col gap-2">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full py-1.5 px-1 text-[10px] font-mono uppercase tracking-wider text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors duration-150 justify-start focus:outline-none cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
                <span>LOG OUT</span>
              </button>
              
              <div className="text-[8px] text-slate-400 dark:text-slate-500 font-mono tracking-widest mt-1 border-t border-slate-200 dark:border-slate-800 pt-2 uppercase">
                SMEI-POMS v3.2.0
              </div>
            </div>
          ) : (
            <div className="mt-2.5 flex flex-col items-center gap-1.5">
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 transition-colors duration-150 focus:outline-none cursor-pointer p-1"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
              <div className="text-[8px] text-slate-400 dark:text-slate-500 font-mono tracking-tight scale-90">
                v3.2
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Right Column Layout Container */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        
        {/* 1. Header & Navigation (Always visible, hidden on print) */}
        <Header
          currentUser={currentUser}
          onLogout={handleLogout}
          onNavigate={(tab) => {
            if (!checkUnsavedChanges()) return;
            setSelectedPO(null);
            setShowPOForm(false);
            setCurrentTab(tab);
          }}
          currentTab={currentTab}
          unreadCount={unreadAlertsCount}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          onOpenProfile={(section) => {
            setProfileModalSection(section);
            setIsProfileModalOpen(true);
          }}
          onToggleSidebar={() => setIsMobileSidebarOpen(prev => !prev)}
        />

        {/* 2. Print-Only document header layout */}
        <PrintHeader />

        {/* 3. Main Content Views Routing */}
        <main className="flex-1 bg-neutral-50/50 dark:bg-[#0a0a0a] transition-colors duration-300">
          
          {/* Dynamic Forms views */}
          {showPOForm || currentTab === "po-form" ? (
            <POForm
              po={selectedPO}
              suppliers={suppliers}
              pos={pos}
              currentUser={currentUser}
              onSave={(savedPO) => {
                window.smeiHasUnsavedChanges = false;
                handleSavePO(savedPO);
              }}
              onCancel={() => {
                window.smeiHasUnsavedChanges = false;
                setSelectedPO(null);
                setShowPOForm(false);
                setCurrentTab("po-list");
              }}
            />
          ) : (
            <>
              {currentTab === "dashboard" && (
                <Dashboard
                  pos={pos}
                  suppliers={suppliers}
                  currentUser={currentUser}
                  onNavigateToPOList={() => setCurrentTab("po-list")}
                  onNavigateToSuppliers={() => setCurrentTab("suppliers")}
                  onSelectPO={(po) => {
                    setSelectedPO(po);
                    setShowPOForm(true);
                  }}
                />
              )}

              {currentTab === "po-list" && (
                <POList
                  pos={pos}
                  suppliers={suppliers}
                  currentUser={currentUser}
                  onSelectPO={(po) => {
                    setSelectedPO(po);
                    setShowPOForm(true);
                  }}
                  onAddNewPO={() => {
                    setSelectedPO(null);
                    setShowPOForm(true);
                  }}
                  onDeletePO={handleDeletePO}
                  onImportPOs={handleImportPOs}
                  initialStatusFilter={poListStatusFilter}
                />
              )}

              {currentTab === "suppliers" && (
                <SuppliersList
                  suppliers={suppliers}
                  pos={pos}
                  currentUser={currentUser}
                  onAddSupplier={handleAddSupplier}
                  onEditSupplier={handleEditSupplier}
                  onDeleteSupplier={handleDeleteSupplier}
                  onRefreshData={loadAllData}
                />
              )}

              {currentTab === "supplier-report" && (
                <SupplierSummaryReport
                  pos={pos}
                  suppliers={suppliers}
                  currentUser={currentUser}
                />
              )}

              {currentTab === "supplier-analytics" && (
                <SupplierAnalyticsDashboard
                  pos={pos}
                  suppliers={suppliers}
                  currentUser={currentUser}
                />
              )}

              {currentTab === "pis" && (
                <PaymentInstructionSlipModule
                  currentUser={currentUser}
                />
              )}

              {currentTab === "rfs" && (
                <RequestForSupplyModule
                  currentUser={currentUser}
                />
              )}

              {currentTab === "rfs-approval" && (
                <RfsApprovalModule
                  currentUser={currentUser}
                />
              )}

              {currentTab === "canvass" && (
                <CanvassSheetModule
                  currentUser={currentUser}
                />
              )}

              {(currentTab === "users" || currentTab === "roles" || currentTab === "audit-logs") && currentUser.role !== UserRole.Administrator ? (
                <div className="flex flex-col items-center justify-center h-[60vh]">
                  <div className="text-red-500 font-bold text-4xl mb-2">403 Access Denied</div>
                  <div className="text-gray-600 font-medium">You do not have permission to access this page.</div>
                </div>
              ) : (
                <>
                  {currentTab === "users" && (
                    <div className="p-6 md:p-10 max-w-7xl mx-auto">
                      <UserManagement />
                    </div>
                  )}

                  {currentTab === "roles" && (
                    <div className="p-6 md:p-10 max-w-7xl mx-auto">
                      <RoleManagement />
                    </div>
                  )}

                  {currentTab === "audit-logs" && (
                    <AuditLogView
                      auditLogs={auditLogs}
                      isAdmin={currentUser.role === UserRole.Administrator}
                      onClearLogs={handleClearAuditLogs}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>

        {/* 4. Real-time Notifications Slide-out Drawer */}
        <NotificationsPanel
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          currentUser={currentUser}
          onMarkAsRead={handleMarkNotifRead}
          onMarkAllAsRead={handleMarkAllNotifRead}
          onSelectPO={handleSelectPOFromNotif}
        />

        {/* 5. App Footer (Hidden on Print) */}
        <footer id="smei-poms-footer" className="bg-white border-t border-gray-100 dark:bg-neutral-950 dark:border-neutral-900 py-4 px-6 md:px-12 text-center text-[10px] text-gray-400 dark:text-neutral-500 font-mono flex flex-col sm:flex-row items-center justify-between gap-2 no-print transition-colors duration-300">
          <div>
            © 2026 SOUTHCOAST METAL ENTERPRISE, INC. • POMS SECURED TERMINAL
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="uppercase">CEZ COMPLIANCE ENCRYPTED SESSION</span>
          </div>
        </footer>

        {greetingMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-white dark:bg-gray-800 text-smei-crimson dark:text-red-400 px-6 py-4 rounded-xl shadow-2xl border-l-4 border-smei-crimson animate-fade-in flex items-center gap-3">
          <span className="text-2xl">👋</span>
          <p className="font-bold font-display">{greetingMessage}</p>
        </div>
      )}
        {/* 6. Profile & Security Management Modal */}
        <ProfileModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          currentUser={currentUser}
          onUpdateCurrentUser={(updatedUser) => {
            setCurrentUser(updatedUser);
          }}
          initialTab={profileModalSection}
        />
      </div>
    </div>
  );
}
