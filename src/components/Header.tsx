/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, UserRole } from "../types";
import { LogOut, Bell, Shield, User as UserIcon, Settings, Menu, KeyRound, UserCheck, Check, Sun, Moon } from "lucide-react";
import smeiLogo from "../assets/images/smei_logo_1782431389924.jpg";
import { useTheme } from "./ThemeProvider";
import { motion, AnimatePresence } from "motion/react";

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onNavigate: (tab: string) => void;
  currentTab: string;
  unreadCount: number;
  onOpenNotifications: () => void;
  onOpenProfile: (activeSection: "profile" | "settings" | "password") => void;
  onToggleSidebar?: () => void;
}

export default function Header({
  currentUser,
  onLogout,
  onNavigate,
  currentTab,
  unreadCount,
  onOpenNotifications,
  onOpenProfile,
  onToggleSidebar
}: HeaderProps) {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const [currentLiveTime, setCurrentLiveTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const formattedDate = now.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric"
      });
      const formattedTime = now.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true
      });
      setCurrentLiveTime(`${formattedDate} • ${formattedTime}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Translate currentTab to human-readable page name
  const getPageTitle = () => {
    switch (currentTab) {
      case "dashboard":
        return "Dashboard Overview";
      case "po-list":
        return "Purchase Orders Directory";
      case "po-form":
        return "Purchase Order Workspace";
      case "suppliers":
        return "Suppliers Directory";
      case "users":
        return "User Management";
      case "roles":
        return "Role & Privilege Settings";
      case "audit-logs":
        return "Audit Trail Logs";
      default:
        return "Procurement Portal";
    }
  };

  const handleProfileClick = (section: "profile" | "settings" | "password") => {
    onOpenProfile(section);
    setIsProfileMenuOpen(false);
  };

  return (
    <header id="smei-app-header" className="w-full flex flex-col no-print bg-white border-b border-gray-200 dark:bg-neutral-950 dark:border-neutral-900 transition-colors duration-300">
      {/* Top Operations & Profile Bar */}
      <div className="py-3 px-6 md:px-10 flex items-center justify-between border-b border-gray-100 dark:border-neutral-900/50">
        {/* Left Side: Page Context (No branding duplicate, branding is in sidebar) */}
        <div className="flex items-center gap-3">
          <button onClick={onToggleSidebar} className="lg:hidden p-1.5 -ml-1 text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded transition-colors focus:outline-none">
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-sm md:text-base font-bold text-gray-800 dark:text-white tracking-wide font-display uppercase">
              {getPageTitle()}
            </h1>
          </div>
        </div>

        {/* Right Side: Notification, Settings, Profile, Logout */}
        {currentUser && (
          <div className="flex items-center gap-3 md:gap-4">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none relative w-9 h-9 flex items-center justify-center overflow-hidden"
              title={theme === 'light' ? "Switch to Dark Mode" : "Switch to Light Mode"}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={theme}
                  initial={{ y: -20, opacity: 0, rotate: -90 }}
                  animate={{ y: 0, opacity: 1, rotate: 0 }}
                  exit={{ y: 20, opacity: 0, rotate: 90 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="absolute"
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </motion.div>
              </AnimatePresence>
            </button>

            {/* Notification Bell */}
            <button 
              onClick={onOpenNotifications}
              className="relative p-2 text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none"
              title="View Alerts"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 bg-[#B22222] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-white dark:border-neutral-950 animate-pulse">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Settings Button */}
            <button 
              className="p-2 text-gray-500 hover:text-[#B22222] hover:bg-gray-100 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900 rounded-lg transition-colors focus:outline-none"
              title="System Settings"
              onClick={() => {
                if (currentUser.role === UserRole.Administrator) {
                  onNavigate("roles"); // Admin Settings goes to roles matrix
                } else {
                  alert("Settings configuration is restricted to System Administrators.");
                }
              }}
            >
              <Settings className="w-5 h-5" />
            </button>

            <div className="h-6 w-px bg-gray-200 dark:bg-neutral-800" />

            {/* User Profile Card Dropdown Container */}
            <div className="relative">
              <button
                onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
                className="flex items-center gap-2.5 p-1.5 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg transition-all focus:outline-none text-left cursor-pointer"
                title="User Menu"
              >
                <div className="w-9 h-9 rounded bg-gray-50 border border-gray-200 dark:bg-neutral-900 dark:border-neutral-850 overflow-hidden flex items-center justify-center shadow-inner">
                  {currentUser.avatarUrl ? (
                    <img
                      src={currentUser.avatarUrl}
                      alt={currentUser.fullName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <UserIcon className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                  )}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-xs font-bold text-gray-800 dark:text-white truncate max-w-[140px]">
                    {currentUser.fullName}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Shield className="w-2.5 h-2.5 text-[#B22222]" />
                    <span className="text-[9px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider font-mono">
                      {currentUser.role}
                    </span>
                  </div>
                </div>
              </button>

              {/* Profile Dropdown Popover */}
              {isProfileMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsProfileMenuOpen(false)} 
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 dark:bg-neutral-900 dark:border-neutral-800 rounded shadow-2xl py-1.5 z-20 text-xs text-gray-700 dark:text-neutral-300 animate-fadeIn">
                    <div className="px-4 py-2 border-b border-gray-100 dark:border-neutral-850 bg-gray-50 dark:bg-neutral-950/80 rounded-t">
                      <p className="font-bold text-gray-800 dark:text-white truncate">{currentUser.fullName}</p>
                      <p className="text-[10px] text-gray-500 dark:text-neutral-400 font-mono truncate">{currentUser.email}</p>
                    </div>

                    <button
                      onClick={() => handleProfileClick("profile")}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <UserCheck className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                      <span>My Profile</span>
                    </button>

                    <button
                      onClick={() => handleProfileClick("settings")}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <Settings className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                      <span>Account Settings</span>
                    </button>

                    <button
                      onClick={() => handleProfileClick("password")}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-100 dark:hover:bg-neutral-800 flex items-center gap-2 text-gray-700 dark:text-neutral-300 hover:text-black dark:hover:text-white transition-colors"
                    >
                      <KeyRound className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                      <span>Change Password</span>
                    </button>

                    <div className="border-t border-gray-100 dark:border-neutral-800 my-1.5" />

                    <button
                      onClick={() => {
                        setIsProfileMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-4 py-2.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 text-rose-600 dark:text-rose-400 font-semibold transition-colors"
                    >
                      <LogOut className="w-4 h-4 text-rose-500" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            <div className="h-6 w-px bg-gray-200 dark:bg-neutral-800 hidden sm:block" />

            {/* Logout Button */}
            <button
              onClick={onLogout}
              className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-900 rounded-lg text-gray-500 dark:text-neutral-400 hover:text-[#B22222] transition-all focus:outline-none"
              title="Logout from System"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation and System Operations Bar */}
      {currentUser && (
        <div className="lg:hidden bg-gray-50 border-t border-gray-200 dark:bg-neutral-950 dark:border-neutral-900 px-6 md:px-10 py-2 overflow-x-auto scrollbar-none flex items-center justify-between gap-2">
          <nav className="flex flex-nowrap items-center gap-1 md:gap-2 whitespace-nowrap">
            <button
              onClick={() => onNavigate("dashboard")}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                currentTab === "dashboard"
                  ? "bg-[#B22222] text-white"
                  : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
              }`}
            >
              Dashboard
            </button>
            
            <button
              onClick={() => onNavigate("po-list")}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                currentTab === "po-list" || currentTab === "po-form"
                  ? "bg-[#B22222] text-white"
                  : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
              }`}
            >
              Purchase Orders
            </button>

            <button
              onClick={() => onNavigate("suppliers")}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                currentTab === "suppliers"
                  ? "bg-[#B22222] text-white"
                  : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
              }`}
            >
              Suppliers
            </button>

            <button
              onClick={() => onNavigate("pis")}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                currentTab === "pis"
                  ? "bg-[#B22222] text-white"
                  : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
              }`}
            >
              PIS
            </button>

            <button
              onClick={() => onNavigate("rfs")}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                currentTab === "rfs"
                  ? "bg-[#B22222] text-white"
                  : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
              }`}
            >
              RFS
            </button>

            <button
              onClick={() => onNavigate("canvass")}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                currentTab === "canvass"
                  ? "bg-[#B22222] text-white"
                  : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
              }`}
            >
              Canvass
            </button>

            {currentUser.role === UserRole.Administrator && (
              <>
                <button
                  onClick={() => onNavigate("users")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                    currentTab === "users"
                      ? "bg-[#B22222] text-white"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => onNavigate("roles")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                    currentTab === "roles"
                      ? "bg-[#B22222] text-white"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Roles
                </button>
                <button
                  onClick={() => onNavigate("audit-logs")}
                  className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider rounded transition-all ${
                    currentTab === "audit-logs"
                      ? "bg-[#B22222] text-white"
                      : "text-gray-600 hover:text-[#B22222] hover:bg-gray-200 dark:text-neutral-400 dark:hover:text-white dark:hover:bg-neutral-900"
                  }`}
                >
                  Audit Trail
                </button>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

// Beautiful print-only header layout using our high-quality generated logo
export function PrintHeader() {
  const logoSrc = smeiLogo;

  return (
    <div className="hidden print:flex flex-col items-center justify-center text-center border-b-2 border-black pb-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="smei-logo-container p-1 rounded-lg shrink-0 bg-white">
          <img
            src={logoSrc}
            alt="SMEI Logo"
            className="w-16 h-16 object-contain smei-logo-img"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="text-left">
          <h1 className="text-xl font-bold uppercase tracking-wider font-display">
            Southcoast Metal Enterprise, Inc.
          </h1>
          <p className="text-xs text-gray-600">
            Block 8A, Phase 1, East Avenue, Cavite Economic Zone, Rosario, Cavite, Philippines
          </p>
          <p className="text-xs text-gray-600">
            Tel No: +63-46-437-1234 / Fax: +63-46-437-5678
          </p>
        </div>
      </div>
      <h2 className="text-lg font-bold uppercase tracking-widest mt-3 text-gray-800 border-t border-gray-400 pt-2 w-full">
        Purchase Order Document
      </h2>
    </div>
  );
}
