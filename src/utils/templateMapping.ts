import { PurchaseOrder, PaymentInstructionSlip, RequestForSupply, CanvassSheet } from "../types";

export const formatCurrency = (val: number | string | undefined | null, symbol: string = "₱"): string => {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  return `${symbol}\u00A0${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatDate = (dateString: string | undefined | null): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

const alignSignatory = (
  nameVal: string | undefined | null,
  positionVal: string | undefined | null,
  isExcluded?: boolean
): { name: string; position: string } => {
  if (isExcluded) {
    return { name: "\u00A0", position: "\u00A0" };
  }
  const name = (nameVal ?? "").trim();
  const position = (positionVal ?? "").trim();
  return {
    name: name || "\u00A0",
    position: position || "\u00A0"
  };
};

const getWrappedLineCount = (text: string, charsPerLine: number = 59): number => {
  if (!text) return 1;
  const lines = text.split("\n");
  let totalLines = 0;
  lines.forEach(line => {
    totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  });
  return totalLines;
};

const truncateTextToMaxLines = (text: string, maxLines: number, charsPerLine: number = 59): string => {
  if (!text) return "";
  const lines = text.split("\n");
  const resultLines: string[] = [];
  let currentLinesCount = 0;

  for (const line of lines) {
    if (currentLinesCount >= maxLines) break;
    const chunksCount = Math.max(1, Math.ceil(line.length / charsPerLine));
    if (currentLinesCount + chunksCount <= maxLines) {
      resultLines.push(line);
      currentLinesCount += chunksCount;
    } else {
      const allowedChunks = maxLines - currentLinesCount;
      const allowedChars = allowedChunks * charsPerLine - 3;
      if (allowedChars > 0) {
        resultLines.push(line.slice(0, allowedChars) + "...");
      } else {
        if (resultLines.length === 0 || !resultLines[resultLines.length - 1].endsWith("...")) {
          resultLines.push("...");
        }
      }
      break;
    }
  }
  return resultLines.join("\n");
};

export function formatRFSNo(rfsNo: string | undefined | null, dateStr?: string): string {
  if (!rfsNo) {
    rfsNo = "001";
  }
  if (/^\d{4}-\d{2}-\d{3}$/.test(rfsNo)) {
    return rfsNo;
  }
  
  let year = "2026";
  let month = "07";
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      year = d.getFullYear().toString();
      month = (d.getMonth() + 1).toString().padStart(2, "0");
    }
  } else {
    const d = new Date();
    year = d.getFullYear().toString();
    month = (d.getMonth() + 1).toString().padStart(2, "0");
  }
  
  const match = rfsNo.match(/\d+/g);
  let seqStr = "001";
  if (match) {
    const lastDigits = match[match.length - 1];
    const parsed = parseInt(lastDigits, 10);
    seqStr = parsed.toString().slice(-3).padStart(3, "0");
  }
  
  return `${year}-${month}-${seqStr}`;
}

export function mapPOData(po: PurchaseOrder): Record<string, any> {
  const rawRfs = po.rfsNumber || (po.poNumber ? po.poNumber.split("-").pop() || "10672" : "10672");
  const rfsNo = formatRFSNo(rawRfs, po.poDate);
  const symbol = po.currencySymbol || "₱";
  const formattedPurpose = po.purpose ?? "";
  
  const itemsCount = po.items ? po.items.length : 0;
  const qtyLines: string[] = [];
  const unitLines: string[] = [];
  const descLines: string[] = [];
  const priceLines: string[] = [];
  const amountLines: string[] = [];

  let totalDescLines = 0;
  const MAX_TOTAL_DESC_LINES = 18;

  for (let i = 0; i < itemsCount; i++) {
    const item = po.items[i];
    let desc = item.description || "";
    const currentLinesBudget = Math.max(2, MAX_TOTAL_DESC_LINES - totalDescLines - (itemsCount - 1 - i));
    const rawLineCount = getWrappedLineCount(desc, 59);

    if (rawLineCount > currentLinesBudget) {
      desc = truncateTextToMaxLines(desc, currentLinesBudget, 59);
    }

    const lCount = getWrappedLineCount(desc, 59);
    totalDescLines += lCount;

    qtyLines.push(String(item.quantity || ""));
    unitLines.push(item.unit || "");
    descLines.push(desc);
    priceLines.push(formatCurrency(item.unitPrice, symbol));
    amountLines.push(formatCurrency(item.amount, symbol));

    for (let pad = 1; pad < lCount; pad++) {
      qtyLines.push("");
      unitLines.push("");
      priceLines.push("");
      amountLines.push("");
    }
  }

  const QUANTITY = qtyLines.join("\n");
  const UNIT = unitLines.join("\n");
  const DESCRIPTION = descLines.join("\n");
  const UNIT_PRICE = priceLines.join("\n");
  const AMOUNT = amountLines.join("\n");

  const prepared = alignSignatory(po.preparedBy, po.preparedByTitle, po.excludePreparedBy);
  const checked = alignSignatory(po.checkedBy, po.checkedByTitle, po.excludeCheckedBy);
  const verified = alignSignatory(po.verifiedBy, po.verifiedByTitle, po.excludeVerifiedBy);
  const verified2 = alignSignatory(po.verifiedBy2 || "", po.verifiedBy2Title || "", po.excludeVerifiedBy2 || false);
  const approved = alignSignatory(po.approvedBy, po.approvedByTitle, po.excludeApprovedBy);

  const VERIFIED_BY1 = verified.name;
  const VERIFIED_BY_POSITION1 = verified.position;

  let VERIFIED_BY2 = verified2.name || "\u00A0";
  let VERIFIED_BY_POSITION2 = verified2.position || "\u00A0";
  
  if (!po.verifiedBy2 && po.additionalSignatories && po.additionalSignatories.length > 0) {
    const vSigs = po.additionalSignatories.filter(
      (sig) => sig.role?.toLowerCase().includes("verified") || sig.role?.toLowerCase().includes("verifier")
    );
    if (vSigs.length > 0) {
      VERIFIED_BY2 = vSigs[0].name || "\u00A0";
      VERIFIED_BY_POSITION2 = vSigs[0].role || "\u00A0";
    }
  }

  return {
    DOCUMENT_NO: "FM-PPD-03",
    RFS_NO: rfsNo,
    SUPPLIER_NAME: po.supplierName ?? "",
    PO_NUMBER: po.poNumber ?? "",
    ATTENTION: po.attention ?? "",
    PO_DATE: formatDate(po.poDate) ?? "",
    TEL_FAX: `${po.telNo ?? ""} ${po.faxNo ? `/ ${po.faxNo}` : ""}`.trim() || "",
    DELIVERY_DATE: formatDate(po.deliveryDate) ?? "",
    PURPOSE: formattedPurpose,
    CATEGORY: po.category ?? "Vatable",

    QUANTITY,
    UNIT,
    DESCRIPTION,
    UNIT_PRICE,
    AMOUNT,

    VATABLE_AMOUNT: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vatableAmount, symbol) : "",
    VAT_AMOUNT: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vat12, symbol) : "",
    VAT_EXEMPT_AMOUNT: po.category?.toLowerCase().includes("exempt") ? formatCurrency(po.vatExemptAmount, symbol) : "",
    ZERO_RATED_AMOUNT: po.category?.toLowerCase().includes("zero") ? formatCurrency(po.zeroRatedAmount, symbol) : "",
    TOTAL_AMOUNT: formatCurrency(po.totalAmount, symbol),
    GROSS_AMOUNT: formatCurrency(po.grossAmount || po.totalAmount, symbol),
    PARTS_EWT: po.partsEwt1 > 0 ? formatCurrency(po.partsEwt1, symbol) : "",
    LABOR_EWT: po.laborEwt2 > 0 ? formatCurrency(po.laborEwt2, symbol) : "",
    DISCOUNT_VAT_AMOUNT: po.discountVatAmount > 0 ? formatCurrency(po.discountVatAmount, symbol) : "",

    PAYMENT_TERMS: po.paymentTerms ?? "",
    WORK_DURATION: po.workDuration ?? "",
    WARRANTY: po.warranty ?? "",

    PREPARED_BY: prepared.name,
    PREPARED_BY_POSITION: prepared.position,
    APPROVED_BY: approved.name,
    APPROVED_BY_POSITION: approved.position,
    CHECKED_BY: checked.name,
    CHECKED_BY_POSITION: checked.position,

    VERIFIED_BY1,
    VERIFIED_BY_POSITION1,
    VERIFIED_BY2,
    VERIFIED_BY_POSITION2,
  };
}

export function mapPISData(slip: PaymentInstructionSlip): Record<string, any> {
  const formattedAmount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: slip.currency === "PHP" ? "PHP" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(slip.amount || 0);

  return {
    PIS_NO: slip.pisNumber ?? "",
    SCHEDULE_DATE: slip.scheduleDate ?? "",
    PAYMENT_DATE: slip.scheduleDate ?? "", // Map to template placeholder
    SCHEDULE_TIME: `${slip.scheduleTime || ""} ${slip.ampm || ""}`.trim(),
    PAYEE: slip.payee ?? "",
    AMOUNT: formattedAmount,
    GROSS: new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: slip.currency === "Others" ? "PHP" : (slip.currency === "JP Yen" ? "JPY" : (slip.currency || "PHP")),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(slip.gross !== undefined ? slip.gross : (slip.amount || 0)),
    EWT: `${slip.ewt !== undefined ? slip.ewt : 0}%`,
    TOTAL: new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: slip.currency === "Others" ? "PHP" : (slip.currency === "JP Yen" ? "JPY" : (slip.currency || "PHP")),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(slip.total !== undefined ? slip.total : (slip.amount || 0)),
    CURRENCY: slip.currency === "Others" ? slip.currencyOthers : (slip.currency || ""),
    PAYMENT_MODE: slip.paymentMode === "Others" ? slip.paymentModeOthers : (slip.paymentMode || ""),
    REMARKS: slip.remarks || "",
    REQUESTED_BY: slip.requestedBy ?? "",
    REQUESTED_DATE: slip.requestedDate ?? "",
    CHECKED_BY: slip.checkedAndVerifiedBy || "",
    VERIFIED_BY: slip.verifiedBy || "",
    ACCEPTED_BY: slip.acceptedBy || "",
    STATUS: slip.status ?? "",
  };
}

export function mapRFSData(req: RequestForSupply): { exportData: Record<string, any>; items: any[] } {
  const formattedRFS = formatRFSNo(req.rfsNumber, req.dateRequested);
  const exportData = {
    RFS_NO: formattedRFS,
    REQUEST_DATE: req.dateRequested ?? "",
    DUE_DATE: req.dueDate || "",
    RECEIVED_DATE: req.dueDate || "", // Map to template placeholder
    DEPARTMENT: req.department === "Others" ? req.departmentOthers : (req.department || ""),
    CONTROL_NO: formattedRFS,
    PO_NO: req.purchaseOrderNumber || "",
    STATUS: req.status ?? "",
    MODE: req.modeOfRequest ?? "",
    PURPOSE: req.purpose ?? "",
    REQUESTED_BY: req.requestedBy ?? "",
    VERIFIED_BY: req.verifiedBy || "",
    APPROVED_BY: req.approvedBy || "",
  };

  const items = (req.items || []).map((it, index) => ({
    index: index + 1,
    quantity: it.quantity || 0,
    unit: it.unit || "",
    description: it.description || "",
    lastPurchaseDate: it.lastPurchaseDate || "",
    lastPurchaseQuantity: it.lastPurchaseQuantity || 0,
    lastPurchaseUnitPrice: it.lastPurchaseUnitPrice || 0,
    currentPurchaseDate: it.currentPurchaseDate || "",
    currentPurchaseQuantity: it.currentPurchaseQuantity || 0,
    currentPurchaseUnitPrice: it.currentPurchaseUnitPrice || 0,
    remarks: it.remarks || "",
  }));

  return { exportData, items };
}

export function mapCanvassData(sheet: CanvassSheet): { exportData: Record<string, any>; excelShops: any[]; excelItems: any[] } {
  const sList = sheet.shops || [];
  const pList = sheet.parts || [];

  const s0 = sList[0] || { id: "s0", name: "", contactPerson: "", contactNo: "", workDuration: "", warranty: "", paymentTerms: "" };
  const s1 = sList[1] || { id: "s1", name: "", contactPerson: "", contactNo: "", workDuration: "", warranty: "", paymentTerms: "" };

  const total_shop1 = pList.reduce((sum, p) => sum + (Number(p.prices[s0.id]) || 0), 0);
  const total_shop2 = pList.reduce((sum, p) => sum + (Number(p.prices[s1.id]) || 0), 0);

  const isNonVat1 = !!s0.isNonVat;
  const ratePercent1 = parseFloat((s0.nonVatRate || "1%").replace("%", "")) / 100;
  const rate1 = isNonVat1 ? (isNaN(ratePercent1) ? 0.01 : ratePercent1) : 0.12;
  const vat1 = total_shop1 * rate1;
  const total_amount1 = total_shop1 + vat1;

  const isNonVat2 = !!s1.isNonVat;
  const ratePercent2 = parseFloat((s1.nonVatRate || "1%").replace("%", "")) / 100;
  const rate2 = isNonVat2 ? (isNaN(ratePercent2) ? 0.01 : ratePercent2) : 0.12;
  const vat2 = total_shop2 * rate2;
  const total_amount2 = total_shop2 + vat2;

  const formatCurrencyLocal = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  const exportData = {
    Control_NO: sheet.canvassNumber ?? "",
    Category: sheet.category || "General Procurement",
    Plate_No: sheet.plateNo || "",

    shop_name1: s0.name || "",
    shop_name2: s1.name || "",

    contact_person1: s0.contactPerson || "",
    contact_person2: s1.contactPerson || "",

    contact_no1: s0.contactNo || "",
    contact_no2: s1.contactNo || "",

    remarks: sheet.remarks || "",

    work_duration1: s0.workDuration || "",
    work_duration2: s1.workDuration || "",

    warranty1: s0.warranty || "",
    warranty2: s1.warranty || "",

    payment_terms1: s0.paymentTerms || "",
    payment_terms2: s1.paymentTerms || "",

    parts1: pList.map((p) => p.description).join("\n"),
    parts_shop1_price1: pList.map((p) => (p.prices[s0.id] ? formatCurrencyLocal(p.prices[s0.id]) : "-")).join("\n"),
    parts_shop2_price2: pList.map((p) => (p.prices[s1.id] ? formatCurrencyLocal(p.prices[s1.id]) : "-")).join("\n"),

    total_shop1: formatCurrencyLocal(total_shop1),
    total_shop2: formatCurrencyLocal(total_shop2),

    vat1: formatCurrencyLocal(vat1),
    vat2: formatCurrencyLocal(vat2),

    total_amount1: formatCurrencyLocal(total_amount1),
    total_amount2: formatCurrencyLocal(total_amount2),

    PREPARED_BY: sheet.requestedBy || "",
    PREPARED_BY_POSITION: sheet.preparedByPosition || "Canvasser",
    CHECKED_BY: sheet.checkedBy || "",
    CHECKED_BY_POSITION: sheet.checkedByPosition || "Maintenance Supervisor",
    VERIFIED_BY: sheet.verifiedBy || "",
    VERIFIED_BY_POSITION: sheet.verifiedByPosition || "Operations Manager",
    APPROVED_BY: sheet.approvedBy || "",
    APPROVED_BY_POSITION: sheet.approvedByPosition || "Purchasing Manager",
  };

  const excelShops = sList.map((s) => {
    const t = pList.reduce((sum, p) => sum + (Number(p.prices[s.id]) || 0), 0);
    const isNonVat = !!s.isNonVat;
    const ratePercent = parseFloat((s.nonVatRate || "1%").replace("%", "")) / 100;
    const rate = isNonVat ? (isNaN(ratePercent) ? 0.01 : ratePercent) : 0.12;
    const v = t * rate;
    return {
      name: s.name || "",
      contact_person: s.contactPerson || "",
      contact_no: s.contactNo || "",
      work_duration: s.workDuration || "",
      warranty: s.warranty || "",
      payment_terms: s.paymentTerms || "",
      prices: pList.map((p) => p.prices[s.id] || 0),
      total: t,
      vat: v,
      total_amount: t + v,
    };
  });

  const excelItems = pList.map((p, idx) => ({
    index: idx + 1,
    item: p.description,
    quantity: 1,
    unit: "pcs",
    supplierAPrice: p.prices[s0.id] || 0,
    supplierBPrice: p.prices[s1.id] || 0,
    supplierCPrice: (sList[2] && p.prices[sList[2].id]) || 0,
  }));

  return { exportData, excelShops, excelItems };
}
