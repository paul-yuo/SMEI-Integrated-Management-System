/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PaymentInstructionSlip, RequestForSupply, CanvassSheet } from "../types.js";

export type PaymentInstructionSlipDB = PaymentInstructionSlip;
export type RequestForSupplyDB = RequestForSupply;
export type CanvassSheetDB = CanvassSheet;

// Password Hash Helper (using native Node crypto SHA-256)
export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export interface UserDB {
  id: string;
  username: string;
  passwordHash: string;
  fullName: string;
  email: string;
  role: string;
  department: string;
  status: "Active" | "Disabled" | "Locked" | "Pending";
  avatarUrl?: string;
  loginAttempts?: number;
  profile_image?: string;
  phone_number?: string;
  position?: string;
  notificationPreferences?: {
    email: boolean;
    system: boolean;
  };
}

export interface RoleDB {
  id: string;
  name: string;
  permissions: string[];
}

export interface DepartmentDB {
  id: string;
  name: string;
}

export interface SupplierDB {
  id: string;
  name: string;
  supplier_name?: string;
  attention: string;
  phone: string;
  fax: string;
  address: string;
  category: string;
  createdAt: string;
  created_at?: string;
  created_by?: string;
  status?: "Active" | "Disabled";
}

export interface POItemDB {
  id: string;
  quantity: number;
  unit: string;
  description: string;
  unitPrice: number;
  amount: number;
}

export interface PurchaseOrderDB {
  id: string;
  poNumber: string;
  poDate: string;
  deliveryDate: string;
  supplierId: string;
  supplierName: string;
  attention: string;
  telNo: string;
  faxNo: string;
  purpose: string;
  category: string;
  items: POItemDB[];
  
  // Tax & VAT Calculations
  vatableAmount: number;
  vat12: number;
  vatExemptAmount: number;
  zeroRatedAmount: number;
  grossAmount: number;
  discountVatAmount: number;
  partsEwt1: number;
  laborEwt2: number;
  totalAmount: number;
  
  // Terms
  paymentTerms: string;
  workDuration: string;
  warranty: string;
  remarks: string;
  
  // Ownership & Approval Flow
  created_by: string;           // user ID of creator
  created_department: string;   // creator's department
  department: string;           // PO target department
  approved_by?: string;         // Dept head user ID
  verified_by?: string;         // Accounting user ID
  final_approved_by?: string;   // Director user ID
  
  preparedBy: string;
  preparedByTitle?: string;
  checkedBy?: string;
  checkedByTitle?: string;
  verifiedBy?: string;
  verifiedByTitle?: string;
  verifiedBy2?: string;
  verifiedBy2Title?: string;
  approvedBy?: string;
  approvedByTitle?: string;
  conforme?: string;
  conformeTitle?: string;
  
  additionalSignatories?: any[]; // using any for simplicity in DB schema for now
  
  signature?: string;
  dateApproved?: string;
  status: string;
  currencySymbol?: string;
  updatedAt: string;
}

export interface ApprovalLogDB {
  id: string;
  poId: string;
  userId: string;
  fullName: string;
  role: string;
  action: "Submit" | "Approve" | "Verify" | "Final Approve" | "Reject" | "Return";
  remarks?: string;
  timestamp: string;
}

export interface NotificationDB {
  id: string;
  userId: string;
  role: string;
  title: string;
  message: string;
  date: string;
  time: string;
  isRead: boolean;
  poId?: string;
}

export interface AuditLogDB {
  id: string;
  user_id: string;
  username: string;
  role: string;
  action: string;
  module: string;
  record_id: string;
  old_value: string;
  new_value: string;
  ip_address: string;
  browser: string;
  timestamp: string;
}

export interface InvitationDB {
  token: string;
  role: string;
  department: string;
  expiresAt: string;
  isOneTime: boolean;
  used: boolean;
}

export interface DBStructure {
  users: UserDB[];
  roles: RoleDB[];
  departments: DepartmentDB[];
  suppliers: SupplierDB[];
  purchase_orders: PurchaseOrderDB[];
  approvals: ApprovalLogDB[];
  notifications: NotificationDB[];
  audit_logs: AuditLogDB[];
  invitations?: InvitationDB[];
  payment_instruction_slips?: PaymentInstructionSlipDB[];
  requests_for_supply?: RequestForSupplyDB[];
  canvass_sheets?: CanvassSheetDB[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "db.json");

class Database {
  private data: DBStructure;

  constructor() {
    this.data = {
      users: [],
      roles: [],
      departments: [],
      suppliers: [],
      purchase_orders: [],
      approvals: [],
      notifications: [],
      audit_logs: [],
      invitations: [],
      payment_instruction_slips: [],
      requests_for_supply: [],
      canvass_sheets: []
    };
    this.init();
  }

  private init() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.data = JSON.parse(raw);
        // Ensure all tables exist in loaded JSON
        if (!this.data.users) this.data.users = [];
        if (!this.data.roles) this.data.roles = [];
        if (!this.data.departments) this.data.departments = [];
        if (!this.data.suppliers) this.data.suppliers = [];
        this.data.suppliers = this.data.suppliers.map(s => ({
          ...s,
          status: s.status || "Active",
          created_by: s.created_by || "System Seed"
        }));
        if (!this.data.purchase_orders) this.data.purchase_orders = [];
        if (!this.data.approvals) this.data.approvals = [];
        if (!this.data.notifications) this.data.notifications = [];
        if (!this.data.audit_logs) this.data.audit_logs = [];
        if (!this.data.invitations) this.data.invitations = [];
        if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
        if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
        if (!this.data.canvass_sheets) this.data.canvass_sheets = [];

        // Force the admin's password to be "123!" and active status for user convenience
        const adminUser = this.data.users.find(u => u.username.toLowerCase() === "admin");
        if (adminUser) {
          adminUser.passwordHash = hashPassword("123!");
          adminUser.status = "Active";
          adminUser.loginAttempts = 0;
          this.save();
        }
      } catch (err) {
        console.error("Error reading database file, resetting to seed data:", err);
        this.seed();
      }
    } else {
      this.seed();
    }
  }

  private save() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing to database file:", err);
    }
  }

  private seed() {
    console.log("Seeding Database...");

    // Seed Departments
    const departments: DepartmentDB[] = [
      { id: "d1", name: "Purchasing" },
      { id: "d2", name: "Accounting" },
      { id: "d3", name: "Operations" },
      { id: "d4", name: "Production" },
      { id: "d5", name: "Warehouse" },
      { id: "d6", name: "Management" },
      { id: "d7", name: "HR" },
      { id: "d8", name: "IT" }
    ];

    // Seed Roles & Permissions
    const roles: RoleDB[] = [
      {
        id: "r1",
        name: "Administrator",
        permissions: ["view_dashboard", "manage_users", "manage_roles", "view_all_pos", "view_audit_logs", "view_suppliers", "manage_suppliers"]
      },
      {
        id: "r2",
        name: "Purchasing Staff",
        permissions: ["view_dashboard", "create_po", "edit_own_po", "submit_po", "view_all_pos", "view_suppliers", "import_excel", "export_excel"]
      },
      {
        id: "r3",
        name: "Department Head",
        permissions: ["view_dashboard", "review_po", "approve_po", "view_dept_pos"]
      },
      {
        id: "r4",
        name: "Accounting Staff",
        permissions: ["view_dashboard", "verify_po", "view_all_pos", "view_suppliers"]
      },
      {
        id: "r5",
        name: "Director",
        permissions: ["view_dashboard", "final_approve_po", "view_all_pos"]
      },
      {
        id: "r6",
        name: "Viewer",
        permissions: ["view_dashboard", "view_all_pos"]
      }
    ];

    // Seed Users (Default Passwords: Username + "123")
    const users: UserDB[] = [
      {
        id: "u1",
        username: "admin",
        passwordHash: hashPassword("123!"),
        fullName: "John Doe",
        email: "admin@southcoastmetal.com",
        role: "Administrator",
        department: "Management",
        status: "Active",
        avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150"
      },
      {
        id: "u2",
        username: "staff",
        passwordHash: hashPassword("staff123"),
        fullName: "Maria Santos",
        email: "maria.s@southcoastmetal.com",
        role: "Purchasing Staff",
        department: "Purchasing",
        status: "Active",
        avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150"
      },
      {
        id: "u3",
        username: "depthead",
        passwordHash: hashPassword("depthead123"),
        fullName: "Robert Chen",
        email: "r.chen@southcoastmetal.com",
        role: "Department Head",
        department: "Production",
        status: "Active",
        avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150"
      },
      {
        id: "u4",
        username: "accounting",
        passwordHash: hashPassword("accounting123"),
        fullName: "Elena Lopez",
        email: "elena.l@southcoastmetal.com",
        role: "Accounting Staff",
        department: "Accounting",
        status: "Active",
        avatarUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150"
      },
      {
        id: "u5",
        username: "director",
        passwordHash: hashPassword("director123"),
        fullName: "William Sy",
        email: "w.sy@southcoastmetal.com",
        role: "Director",
        department: "Management",
        status: "Active",
        avatarUrl: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150"
      },
      {
        id: "u6",
        username: "viewer",
        passwordHash: hashPassword("viewer123"),
        fullName: "Grace Perez",
        email: "g.perez@southcoastmetal.com",
        role: "Viewer",
        department: "Management",
        status: "Active",
        avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150"
      }
    ];

    // Seed Suppliers
    const suppliers: SupplierDB[] = [
      {
        id: "s1",
        name: "Cavite Metal Casting Corp.",
        attention: "Mr. Arthur Alcantara",
        phone: "+63-46-437-1234",
        fax: "+63-46-437-5678",
        address: "Block 5, Phase 2, CEZ, Rosario, Cavite",
        category: "Raw Metals",
        createdAt: "2026-01-15",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s2",
        name: "Rosario Steel Works Inc.",
        attention: "Ms. Sarah Jingco",
        phone: "+63-46-437-8899",
        fax: "+63-46-437-8800",
        address: "Lot 12, Phase 1, CEZ, Rosario, Cavite",
        category: "Steel Plates & Rods",
        createdAt: "2026-02-10",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s3",
        name: "Fastener World Philippines",
        attention: "Mr. Jose Rizal Jr.",
        phone: "+63-2-812-3456",
        fax: "+63-2-812-3457",
        address: "142 Pasong Tamo Ext., Makati City",
        category: "Hardware Supplies",
        createdAt: "2026-03-05",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s4",
        name: "Tri-State Industrial Gases",
        attention: "Mr. Henry Sy Jr.",
        phone: "+63-46-484-9000",
        fax: "+63-46-484-9001",
        address: "Anabu II-E, Imus, Cavite",
        category: "Gases & Chemicals",
        createdAt: "2026-04-12",
        status: "Active",
        created_by: "System Seed"
      },
      {
        id: "s5",
        name: "Zenith Machinery & Calibration",
        attention: "Engr. Paul Peralta",
        phone: "+63-46-501-1111",
        fax: "+63-46-501-2222",
        address: "Tejero, General Trias, Cavite",
        category: "Machinery Repair & Services",
        createdAt: "2026-05-20",
        status: "Active",
        created_by: "System Seed"
      }
    ];

    // Seed Purchase Orders
    const purchase_orders: PurchaseOrderDB[] = [
      {
        id: "po1",
        poNumber: "SMEI-2026-0001",
        poDate: "2026-06-10",
        deliveryDate: "2026-07-05",
        supplierId: "s1",
        supplierName: "Cavite Metal Casting Corp.",
        attention: "Mr. Arthur Alcantara",
        telNo: "+63-46-437-1234",
        faxNo: "+63-46-437-5678",
        purpose: "Fabrication of Main Support Girders for Assembly Line 3",
        category: "Zero Rated",
        items: [
          { id: "i1", quantity: 5, unit: "pcs", description: "H-Beam Structural Steel 150x150mm x 6m", unitPrice: 12500, amount: 62500 },
          { id: "i2", quantity: 20, unit: "pcs", description: "Reinforcement Steel Plate 12mm x 4ft x 8ft", unitPrice: 6800, amount: 136000 },
          { id: "i3", quantity: 1, unit: "lot", description: "Labor for precision metal cutting & edge grinding", unitPrice: 25000, amount: 25000 }
        ],
        vatableAmount: 0,
        vat12: 0,
        vatExemptAmount: 0,
        zeroRatedAmount: 223500,
        grossAmount: 223500,
        discountVatAmount: 0,
        partsEwt1: 1985,
        laborEwt2: 500,
        totalAmount: 223500,
        paymentTerms: "30 Days after complete delivery",
        workDuration: "25 Days from NTP",
        warranty: "1 Year against manufacturing defects",
        remarks: "Deliveries must be coordinated with CEZ gate pass control.",
        created_by: "u2",
        created_department: "Purchasing",
        department: "Production",
        approved_by: "u3",
        verified_by: "u4",
        final_approved_by: "u5",
        preparedBy: "Maria Santos",
        checkedBy: "Robert Chen",
        verifiedBy: "Elena Lopez",
        approvedBy: "William Sy",
        conforme: "Arthur Alcantara",
        signature: "William Sy Signature",
        dateApproved: "2026-06-15",
        status: "Approved",
        updatedAt: "2026-06-15T14:30:00-07:00"
      },
      {
        id: "po2",
        poNumber: "SMEI-2026-0002",
        poDate: "2026-06-20",
        deliveryDate: "2026-07-10",
        supplierId: "s2",
        supplierName: "Rosario Steel Works Inc.",
        attention: "Ms. Sarah Jingco",
        telNo: "+63-46-437-8899",
        faxNo: "+63-46-437-8800",
        purpose: "Raw materials for high-pressure hydraulic cylinders",
        category: "Vatable",
        items: [
          { id: "i4", quantity: 10, unit: "pcs", description: "Seamless Steel Tube OD 120mm x ID 100mm x 3m", unitPrice: 8500, amount: 85000 },
          { id: "i5", quantity: 15, unit: "pcs", description: "Chrome Plated Piston Rod 50mm dia x 2m", unitPrice: 5200, amount: 78000 }
        ],
        vatableAmount: 163000,
        vat12: 19560,
        vatExemptAmount: 0,
        zeroRatedAmount: 0,
        grossAmount: 163000,
        discountVatAmount: 0,
        partsEwt1: 1630,
        laborEwt2: 0,
        totalAmount: 182560,
        paymentTerms: "COD with 2% discount",
        workDuration: "10 Days",
        warranty: "6 Months",
        remarks: "Priority order for urgent production replacement.",
        created_by: "u2",
        created_department: "Purchasing",
        department: "Production",
        preparedBy: "Maria Santos",
        status: "Pending Review",
        updatedAt: "2026-06-20T10:15:00-07:00"
      },
      {
        id: "po3",
        poNumber: "SMEI-2026-0003",
        poDate: "2026-06-24",
        deliveryDate: "2026-07-20",
        supplierId: "s3",
        supplierName: "Fastener World Philippines",
        attention: "Mr. Jose Rizal Jr.",
        telNo: "+63-2-812-3456",
        faxNo: "+63-2-812-3457",
        purpose: "Standard warehouse fasteners replenishment",
        category: "Vatable",
        items: [
          { id: "i6", quantity: 500, unit: "pcs", description: "Grade 8.8 Hex Bolt M12 x 50mm with Nut", unitPrice: 45, amount: 22500 },
          { id: "i7", quantity: 1000, unit: "pcs", description: "Stainless Steel Washer M12", unitPrice: 8, amount: 8000 }
        ],
        vatableAmount: 30500,
        vat12: 3660,
        vatExemptAmount: 0,
        zeroRatedAmount: 0,
        grossAmount: 30500,
        discountVatAmount: 0,
        partsEwt1: 305,
        laborEwt2: 0,
        totalAmount: 34160,
        paymentTerms: "Net 60 Days",
        workDuration: "Immediate",
        warranty: "None",
        remarks: "For standard warehouse inventory storage.",
        created_by: "u2",
        created_department: "Purchasing",
        department: "Warehouse",
        preparedBy: "Maria Santos",
        status: "Draft",
        updatedAt: "2026-06-24T16:00:00-07:00"
      },
      {
        id: "po4",
        poNumber: "SMEI-2026-0004",
        poDate: "2026-06-21",
        deliveryDate: "2026-07-15",
        supplierId: "s5",
        supplierName: "Zenith Machinery & Calibration",
        attention: "Engr. Paul Peralta",
        telNo: "+63-46-501-1111",
        faxNo: "+63-46-501-2222",
        purpose: "Preventative overhaul maintenance on Lathe Machine C12",
        category: "VAT Exempt",
        items: [
          { id: "i8", quantity: 1, unit: "lot", description: "Annual calibration & dynamic alignment services", unitPrice: 35000, amount: 35000 },
          { id: "i9", quantity: 1, unit: "lot", description: "Labor for transmission gear overhaul & bearing seals replacement", unitPrice: 45000, amount: 45000 }
        ],
        vatableAmount: 0,
        vat12: 0,
        vatExemptAmount: 80000,
        zeroRatedAmount: 0,
        grossAmount: 80000,
        discountVatAmount: 0,
        partsEwt1: 0,
        laborEwt2: 1600,
        totalAmount: 80000,
        paymentTerms: "50% Downpayment, 50% upon completion",
        workDuration: "5 Working Days",
        warranty: "3 Months on service and replaced parts",
        remarks: "Work must be scheduled over the weekend to minimize plant downtime.",
        created_by: "u2",
        created_department: "Purchasing",
        department: "Production",
        approved_by: "u3",
        verified_by: "u4",
        preparedBy: "Maria Santos",
        checkedBy: "Robert Chen",
        verifiedBy: "Elena Lopez",
        status: "Pending Approval",
        updatedAt: "2026-06-22T09:00:00-07:00"
      }
    ];

    // Seed Approvals History
    const approvals: ApprovalLogDB[] = [
      {
        id: "app1",
        poId: "po1",
        userId: "u2",
        fullName: "Maria Santos",
        role: "Purchasing Staff",
        action: "Submit",
        timestamp: "2026-06-10T10:35:00Z"
      },
      {
        id: "app2",
        poId: "po1",
        userId: "u3",
        fullName: "Robert Chen",
        role: "Department Head",
        action: "Approve",
        remarks: "Main support girders checked, specs compliant.",
        timestamp: "2026-06-12T14:15:00Z"
      },
      {
        id: "app3",
        poId: "po1",
        userId: "u4",
        fullName: "Elena Lopez",
        role: "Accounting Staff",
        action: "Verify",
        remarks: "Zero rated VAT verified (PEZA Supplier).",
        timestamp: "2026-06-14T11:05:00Z"
      },
      {
        id: "app4",
        poId: "po1",
        userId: "u5",
        fullName: "William Sy",
        role: "Director",
        action: "Final Approve",
        remarks: "Approved for fabrication.",
        timestamp: "2026-06-15T14:30:00Z"
      }
    ];

    // Seed Notifications
    const notifications: NotificationDB[] = [
      {
        id: "n1",
        userId: "u3",
        role: "Department Head",
        title: "New Purchase Order for Review",
        message: "PO SMEI-2026-0002 has been submitted by Maria Santos and is awaiting your review.",
        date: "2026-06-20",
        time: "10:20 AM",
        isRead: false,
        poId: "po2"
      },
      {
        id: "n2",
        userId: "u5",
        role: "Director",
        title: "PO Awaiting Final Authorization",
        message: "PO SMEI-2026-0004 has been verified by Accounting and is ready for your approval.",
        date: "2026-06-22",
        time: "09:05 AM",
        isRead: false,
        poId: "po4"
      }
    ];

    // Seed Audit Logs
    const audit_logs: AuditLogDB[] = [
      {
        id: "log1",
        user_id: "u2",
        username: "staff",
        role: "Purchasing Staff",
        action: "Create PO Draft",
        module: "Purchase Orders",
        record_id: "po1",
        old_value: "-",
        new_value: "SMEI-2026-0001 (Draft)",
        ip_address: "192.168.12.45",
        browser: "Chrome 124.0.0",
        timestamp: "2026-06-10T10:30:00Z"
      },
      {
        id: "log2",
        user_id: "u3",
        username: "depthead",
        role: "Department Head",
        action: "Approve PO",
        module: "Purchase Orders",
        record_id: "po1",
        old_value: "Submitted",
        new_value: "Department Approved",
        ip_address: "192.168.12.48",
        browser: "Chrome 124.0.0",
        timestamp: "2026-06-12T14:15:00Z"
      }
    ];

    this.data = {
      users,
      roles,
      departments,
      suppliers,
      purchase_orders,
      approvals,
      notifications,
      audit_logs
    };

    this.save();
  }

  // Generic helpers
  public getUsers(): UserDB[] {
    return this.data.users;
  }

  public saveUser(user: UserDB) {
    const idx = this.data.users.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      this.data.users[idx] = user;
    } else {
      this.data.users.push(user);
    }
    this.save();
  }

  public deleteUser(id: string) {
    this.data.users = this.data.users.filter((u) => u.id !== id);
    this.save();
  }

  public getRoles(): RoleDB[] {
    return this.data.roles;
  }

  public saveRole(role: RoleDB) {
    const idx = this.data.roles.findIndex((r) => r.id === role.id);
    if (idx >= 0) {
      this.data.roles[idx] = role;
    } else {
      this.data.roles.push(role);
    }
    this.save();
  }

  public saveRoles(roles: RoleDB[]) {
    this.data.roles = roles;
    this.save();
  }

  public deleteRole(id: string) {
    this.data.roles = this.data.roles.filter((r) => r.id !== id);
    this.save();
  }

  public getDepartments(): DepartmentDB[] {
    return this.data.departments;
  }

  public getSuppliers(): SupplierDB[] {
    return this.data.suppliers;
  }

  public saveSupplier(supplier: SupplierDB) {
    const idx = this.data.suppliers.findIndex((s) => s.id === supplier.id);
    if (idx >= 0) {
      this.data.suppliers[idx] = supplier;
    } else {
      this.data.suppliers.push(supplier);
    }
    this.save();
  }

  public deleteSupplier(id: string) {
    this.data.suppliers = this.data.suppliers.filter((s) => s.id !== id);
    this.save();
  }

  public getPurchaseOrders(): PurchaseOrderDB[] {
    return this.data.purchase_orders;
  }

  public savePurchaseOrder(po: PurchaseOrderDB) {
    const idx = this.data.purchase_orders.findIndex((p) => p.id === po.id);
    if (idx >= 0) {
      this.data.purchase_orders[idx] = po;
    } else {
      this.data.purchase_orders.push(po);
    }
    this.save();
  }

  public deletePurchaseOrder(id: string) {
    this.data.purchase_orders = this.data.purchase_orders.filter((p) => p.id !== id);
    this.save();
  }

  public getApprovals(): ApprovalLogDB[] {
    return this.data.approvals;
  }

  public saveApprovalLog(log: ApprovalLogDB) {
    this.data.approvals.push(log);
    this.save();
  }

  public getNotifications(): NotificationDB[] {
    return this.data.notifications;
  }

  public saveNotification(notif: NotificationDB) {
    const idx = this.data.notifications.findIndex((n) => n.id === notif.id);
    if (idx >= 0) {
      this.data.notifications[idx] = notif;
    } else {
      this.data.notifications.push(notif);
    }
    this.save();
  }

  public deleteNotification(id: string) {
    this.data.notifications = this.data.notifications.filter((n) => n.id !== id);
    this.save();
  }

  public getAuditLogs(): AuditLogDB[] {
    return this.data.audit_logs;
  }

  public saveAuditLog(log: AuditLogDB) {
    this.data.audit_logs.push(log);
    this.save();
  }

  public getInvitations(): InvitationDB[] {
    if (!this.data.invitations) this.data.invitations = [];
    return this.data.invitations;
  }

  public saveInvitation(invite: InvitationDB) {
    if (!this.data.invitations) this.data.invitations = [];
    const idx = this.data.invitations.findIndex((i) => i.token === invite.token);
    if (idx >= 0) {
      this.data.invitations[idx] = invite;
    } else {
      this.data.invitations.push(invite);
    }
    this.save();
  }

  // Payment Instruction Slips (PIS) getters/setters/deleters
  public getPaymentInstructionSlips(): PaymentInstructionSlipDB[] {
    if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
    return this.data.payment_instruction_slips;
  }

  public savePaymentInstructionSlip(pis: PaymentInstructionSlipDB) {
    if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
    const idx = this.data.payment_instruction_slips.findIndex((p) => p.id === pis.id);
    if (idx >= 0) {
      this.data.payment_instruction_slips[idx] = pis;
    } else {
      this.data.payment_instruction_slips.push(pis);
    }
    this.save();
  }

  public deletePaymentInstructionSlip(id: string) {
    if (!this.data.payment_instruction_slips) this.data.payment_instruction_slips = [];
    this.data.payment_instruction_slips = this.data.payment_instruction_slips.filter((p) => p.id !== id);
    this.save();
  }

  // Request for Supply (RFS) getters/setters/deleters
  public getRequestsForSupply(): RequestForSupplyDB[] {
    if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
    return this.data.requests_for_supply;
  }

  public saveRequestForSupply(rfs: RequestForSupplyDB) {
    if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
    const idx = this.data.requests_for_supply.findIndex((r) => r.id === rfs.id);
    if (idx >= 0) {
      this.data.requests_for_supply[idx] = rfs;
    } else {
      this.data.requests_for_supply.push(rfs);
    }
    this.save();
  }

  public deleteRequestForSupply(id: string) {
    if (!this.data.requests_for_supply) this.data.requests_for_supply = [];
    this.data.requests_for_supply = this.data.requests_for_supply.filter((r) => r.id !== id);
    this.save();
  }

  // Canvass Sheet getters/setters/deleters
  public getCanvassSheets(): CanvassSheetDB[] {
    if (!this.data.canvass_sheets) this.data.canvass_sheets = [];
    return this.data.canvass_sheets;
  }

  public saveCanvassSheet(canvass: CanvassSheetDB) {
    if (!this.data.canvass_sheets) this.data.canvass_sheets = [];
    const idx = this.data.canvass_sheets.findIndex((c) => c.id === canvass.id);
    if (idx >= 0) {
      this.data.canvass_sheets[idx] = canvass;
    } else {
      this.data.canvass_sheets.push(canvass);
    }
    this.save();
  }

  public deleteCanvassSheet(id: string) {
    if (!this.data.canvass_sheets) this.data.canvass_sheets = [];
    this.data.canvass_sheets = this.data.canvass_sheets.filter((c) => c.id !== id);
    this.save();
  }
}

export const db = new Database();
