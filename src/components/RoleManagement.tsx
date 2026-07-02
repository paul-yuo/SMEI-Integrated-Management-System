/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { api } from "../lib/api";
import { Shield, Check, Save, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface RoleRecord {
  id: string;
  name: string;
  permissions: string[];
}

export default function RoleManagement() {
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const AVAILABLE_PERMISSIONS = [
    { key: "view_dashboard", label: "View Dashboard", desc: "Access the role-customized KPI summary counters" },
    { key: "view_all_pos", label: "View All POs", desc: "View all purchase orders in the entire system" },
    { key: "view_dept_pos", label: "View Dept POs Only", desc: "Restrict PO view list strictly to user's department" },
    { key: "create_po", label: "Create PO", desc: "Draft new purchase orders with suppliers" },
    { key: "edit_own_po", label: "Edit Own PO", desc: "Modify only POs created by the user" },
    { key: "submit_po", label: "Submit PO", desc: "Submit Drafts into the review workflow" },
    { key: "review_po", label: "Review PO", desc: "Sign off on submitted items as Checker/Dept Head" },
    { key: "verify_po", label: "Verify VAT/EWT", desc: "Validate computations, tax rates, and ledger codes" },
    { key: "final_approve_po", label: "Final Approve PO", desc: "Issue legal digital authorization & final signature" },
    { key: "view_suppliers", label: "View Suppliers", desc: "Browse corporate supplier directories" },
    { key: "manage_suppliers", label: "Manage Suppliers", desc: "Create, edit or remove partner supplier records" },
    { key: "view_audit_logs", label: "View Audit Logs", desc: "Query immutable administrative log grids" },
    { key: "import_excel", label: "Import Excel", desc: "Upload batch contracts from spreadsheets" },
    { key: "export_excel", label: "Export Excel/PDF", desc: "Download validated compliance files" },
    { key: "manage_users", label: "Manage Accounts", desc: "Full administrative CRUD on employee users" },
    { key: "manage_roles", label: "Manage Roles", desc: "Modify fine-grained RBAC permission matrix" }
  ];

  const fetchRoles = async () => {
    setIsLoading(true);
    setError("");
    try {
      const data = await api.getRoles();
      setRoles(data);
    } catch (err: any) {
      setError(err.message || "Failed to load roles matrix");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handlePermissionToggle = (roleId: string, permissionKey: string) => {
    setRoles((prev) =>
      prev.map((r) => {
        if (r.id !== roleId) return r;
        
        // Prevent editing Admin permissions to avoid lockout
        if (r.name === "Administrator") return r;

        const exists = r.permissions.includes(permissionKey);
        const newPermissions = exists
          ? r.permissions.filter((p) => p !== permissionKey)
          : [...r.permissions, permissionKey];
        
        return { ...r, permissions: newPermissions };
      })
    );
  };

  const saveRolePermissions = async (role: RoleRecord) => {
    setError("");
    setSuccess("");
    setIsSaving(role.id);

    try {
      await api.updateRolePermissions(role.id, role.permissions);
      setSuccess(`Permissions updated successfully for ${role.name}!`);
      fetchRoles();
    } catch (err: any) {
      setError(err.message || `Failed to update permissions for ${role.name}`);
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <div id="role-management-module" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-gray-800 uppercase tracking-wide">
            Access Role & Privilege Matrix
          </h2>
          <p className="text-sm text-gray-500">
            Configure fine-grained system permissions and security profiles across corporate levels.
          </p>
        </div>
        <button
          onClick={fetchRoles}
          className="p-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 active:scale-[0.98] transition-all flex items-center gap-2 text-sm font-semibold"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Refresh Matrix</span>
        </button>
      </div>

      {/* Messaging */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2 animate-shake">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <span className="w-10 h-10 border-4 border-smei-crimson/30 border-t-smei-crimson rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-mono">Loading access lists...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {roles.map((role) => (
            <div key={role.id} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-gray-50/70 p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-2.5">
                  <Shield className="w-5 h-5 text-smei-crimson" />
                  <span className="font-bold text-gray-800 font-display text-base tracking-wide uppercase">
                    {role.name}
                  </span>
                  {role.name === "Administrator" && (
                    <span className="text-[10px] font-bold uppercase bg-red-100 text-smei-crimson px-2 py-0.5 rounded-full">
                      Immutable Full Access
                    </span>
                  )}
                </div>
                {role.name !== "Administrator" && (
                  <button
                    onClick={() => saveRolePermissions(role)}
                    disabled={isSaving === role.id}
                    className="bg-gradient-to-r from-smei-darkred to-smei-crimson text-white font-semibold py-2 px-3.5 rounded-xl shadow-lg shadow-red-900/10 hover:shadow-red-900/20 active:scale-[0.98] transition-all flex items-center gap-2 text-xs"
                  >
                    {isSaving === role.id ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>Apply Privilege Updates</span>
                  </button>
                )}
              </div>

              {/* Permissions List Grid */}
              <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const hasPermission = role.permissions.includes(perm.key);
                  const isAdminRole = role.name === "Administrator";
                  
                  return (
                    <div
                      key={perm.key}
                      onClick={() => !isAdminRole && handlePermissionToggle(role.id, perm.key)}
                      className={`p-3.5 rounded-xl border transition-all text-left flex gap-3 ${
                        isAdminRole
                          ? "border-red-100 bg-red-50/20 cursor-default"
                          : hasPermission
                          ? "border-smei-crimson bg-red-50/10 hover:bg-red-50/20 cursor-pointer"
                          : "border-gray-200 hover:border-gray-300 cursor-pointer"
                      }`}
                    >
                      <div className="mt-0.5">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                            isAdminRole || hasPermission
                              ? "bg-smei-crimson border-smei-crimson text-white"
                              : "border-gray-300 bg-white"
                          }`}
                        >
                          {(isAdminRole || hasPermission) && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-gray-800">{perm.label}</p>
                        <p className="text-[10px] text-gray-400 leading-normal">{perm.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
