import React, { useState, useEffect, useRef } from "react";
import { Lock, ShieldAlert, CheckCircle2, ArrowRight } from "lucide-react";
import { User, UserRole } from "../types";

interface ModuleSecurityGateProps {
  moduleName: string;
  gateKey?: string;
  currentUser: User;
  children: React.ReactNode;
}

export default function ModuleSecurityGate({ moduleName, gateKey, currentUser, children }: ModuleSecurityGateProps) {
  const [isLocked, setIsLocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [error, setError] = useState("");
  const [requiredPin, setRequiredPin] = useState("");
  const [activeRuleId, setActiveRuleId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Admin always bypasses security
    if (currentUser.role === UserRole.Administrator) {
      setIsLocked(false);
      return;
    }

    // Check if security rule is enabled for this module / gateKey
    const checkSecurity = () => {
      try {
        const savedSetting = localStorage.getItem("smei_security_config");
        const globalEnabled = savedSetting === null ? false : JSON.parse(savedSetting).enabled;

        if (!globalEnabled) {
          setIsLocked(false);
          return;
        }

        const targetKey = gateKey || moduleName;
        const saved = localStorage.getItem("smei_module_pins");
        let rule: any = null;

        if (saved) {
          const rules = JSON.parse(saved);
          // Look for rule by ID first
          rule = rules.find((r: any) => r.id === targetKey);
          if (!rule) {
            // Fallback to lookup by module name
            rule = rules.find((r: any) => r.moduleName === targetKey || r.moduleName === moduleName);
          }
        }

        if (rule) {
          if (rule.isEnabled === false) {
            setIsLocked(false);
            return;
          }
          setRequiredPin(rule.pinCode);
          setActiveRuleId(rule.id || targetKey);

          const unlockKey = `smei_unlocked_${rule.id || targetKey}`;
          const isUnlockedInSession = sessionStorage.getItem(unlockKey) === "true";
          setIsLocked(!isUnlockedInSession);
          return;
        }

        // Default initial fallback PINs per isolated module gate
        let pinToUse = "";
        let ruleIdToUse = targetKey;

        if (targetKey === "po_approval_gate" || moduleName === "PO Approval") {
          pinToUse = "1234";
          ruleIdToUse = "po_approval_gate";
        } else if (targetKey === "pis_approval_gate" || moduleName === "PIS Approval") {
          pinToUse = "5678";
          ruleIdToUse = "pis_approval_gate";
        } else if (targetKey === "rfs_approval_gate" || moduleName === "RFS Approval") {
          pinToUse = "9012";
          ruleIdToUse = "rfs_approval_gate";
        } else if (targetKey === "canvass_approval_gate" || moduleName === "Canvass Approval") {
          pinToUse = "3456";
          ruleIdToUse = "canvass_approval_gate";
        } else {
          pinToUse = "1234";
          ruleIdToUse = targetKey;
        }

        setRequiredPin(pinToUse);
        setActiveRuleId(ruleIdToUse);

        // Session check specific to this gate key / rule ID
        const unlockKey = `smei_unlocked_${ruleIdToUse}`;
        const isUnlockedInSession = sessionStorage.getItem(unlockKey) === "true";
        setIsLocked(!isUnlockedInSession);
      } catch (err) {
        console.error("Failed to parse module pin configuration", err);
        setIsLocked(false);
      }
    };

    checkSecurity();

    window.addEventListener("storage", checkSecurity);
    return () => {
      window.removeEventListener("storage", checkSecurity);
    };
  }, [moduleName, gateKey, currentUser]);

  // Handle focus on lock mount
  useEffect(() => {
    if (isLocked && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isLocked]);

  // Handle keypresses (Escape should be blocked)
  useEffect(() => {
    if (!isLocked) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isLocked]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinInput) return;

    if (pinInput === requiredPin) {
      // Unlock module gate for this specific rule / gate key
      setIsLocked(false);
      const unlockKey = `smei_unlocked_${activeRuleId || gateKey || moduleName}`;
      sessionStorage.setItem(unlockKey, "true");
      setPinInput("");
      setError("");
      
      // Dispatch storage event so other components update if needed
      window.dispatchEvent(new Event("storage"));
    } else {
      setError("Invalid Administrative PIN code. Please try again.");
      setPinInput("");
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {/* Underlying content fully visible but blurred and user-interaction disabled */}
      <div className="pointer-events-none select-none blur-md filter brightness-[0.85] dark:brightness-[0.45] transition-all duration-300">
        {children}
      </div>

      {/* Glassmorphic Frosted PIN overlay */}
      <div 
        className="absolute inset-0 z-40 flex items-center justify-center p-4 backdrop-blur-xl bg-slate-900/40 dark:bg-black/60 transition-all duration-300"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div 
          className="bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-2xl max-w-sm w-full text-center space-y-6 transform animate-scaleIn"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {/* Lock Header Circle */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center text-smei-crimson dark:text-red-500 shadow-inner">
              <Lock className="w-6 h-6 animate-pulse" />
            </div>
          </div>

          <div className="space-y-1.5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-white font-sans flex items-center justify-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-red-500" />
              Security Lock Active
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
              Administrative credentials required. Enter the dynamic PIN to authorize access to the <span className="font-bold text-slate-700 dark:text-slate-300">{moduleName}</span> module.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="password"
                required
                pattern="[0-9]*"
                inputMode="numeric"
                placeholder="••••"
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value.replace(/\D/g, ""));
                  setError("");
                }}
                className="w-full text-center tracking-[1.5em] font-mono font-bold text-xl px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-600 focus:bg-white dark:focus:bg-slate-800 transition-all text-slate-800 dark:text-white placeholder-slate-300 dark:placeholder-slate-600"
              />
              
              {error ? (
                <p className="text-[11px] text-red-600 dark:text-red-400 font-semibold animate-shake">
                  {error}
                </p>
              ) : (
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  Click inside & enter your numeric PIN
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-gradient-to-r from-red-700 to-red-600 hover:from-red-800 hover:to-red-700 text-white rounded-xl shadow-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all duration-150 active:scale-[0.98] cursor-pointer"
            >
              Verify Credentials
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
