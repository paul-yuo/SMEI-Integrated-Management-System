import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { saveAs } from "file-saver";
import { PurchaseOrder } from "../types";

// Reusable currency helper supporting dynamic currency symbols and preventing cell wrapping
export const formatCurrency = (val: number | string | undefined | null, symbol: string = "₱"): string => {
  if (val === undefined || val === null || val === "") return "";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "";
  // Use non-breaking space (\u00A0) to guarantee currency symbol and amount do not split/wrap
  return `${symbol}\u00A0${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Helper to clean and format signatory names and titles, enforcing non-breaking spaces when blank
const getSignatoryValue = (val: string | undefined | null, isExcluded?: boolean): string => {
  if (isExcluded) return "\u00A0";
  if (!val || !val.trim()) return "\u00A0";
  return val.trim();
};

// Helper to left-align signatory name and position title in the generated Word document.
// The name and position title are left-aligned to start directly below the left edge of the underline.
// Empty names or positions use a non-breaking space (\u00A0) to preserve the layout.
const formatDate = (dateString: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: 'numeric', month: 'long', day: 'numeric' });
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

// Align left padding helper for left-side metadata fields
const padValueLeft = (val: string | undefined | null, targetLen: number = 52): string => {
  const str = (val ?? "").trim();
  if (str.length >= targetLen) return str;
  return str.padEnd(targetLen, " ");
};

// Align left padding helper for right-side metadata fields
const padValueRight = (val: string | undefined | null, targetLen: number = 25): string => {
  const str = (val ?? "").trim();
  if (str.length >= targetLen) return str;
  return str.padEnd(targetLen, " ");
};

// Helper to inject single underline formatting style into specific placeholder text runs in Word XML
const addUnderlineToPlaceholder = (xml: string, placeholder: string): string => {
  const regex = new RegExp(`(<w:r\\b[^>]*>)(?:(<w:rPr\\b[^>]*>[\\s\\S]*?<\\/w:rPr>))?(.*?<w:t\\b[^>]*>\\{\\{${placeholder}\\}\\}<\\/w:t>)`, "g");
  return xml.replace(regex, (match, rTag, rPrBlock, rest) => {
    if (rPrBlock) {
      if (!rPrBlock.includes("w:u")) {
        const updatedRPr = rPrBlock.replace("</w:rPr>", '<w:u w:val="single"/></w:rPr>');
        return `${rTag}${updatedRPr}${rest}`;
      }
      return match;
    } else {
      return `${rTag}<w:rPr><w:u w:val="single"/></w:rPr>${rest}`;
    }
  });
};

/**
 * Merges split double-curly-braces {{...}} placeholders in the XML content.
 * Spelling grammar checks and formatting changes can cause Word to split placeholders 
 * across multiple elements, which breaks Docxtemplater parsing.
 */
const cleanSplitPlaceholders = (xml: string): string => {
  let cleaned = xml.replace(/<w:proofErr\b[^>]*\/>/g, "");
  
  // Matches placeholders split across runs, e.g. {{PART1</w:t></w:r>...<w:t>PART2}}
  const splitRegex = /(\{\{[^}]+?)<\/w:t><\/w:r>(?:<w:proofErr\b[^>]*\/>)?<w:r\b[^>]*>(?:<w:rPr>[^]*?<\/w:rPr>)?<w:t\b[^>]*>([^}]*?\}\})/g;
  
  let prevCleaned;
  do {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(splitRegex, "$1$2");
  } while (cleaned !== prevCleaned);
  
  return cleaned;
};

/**
 * Truncates description text so it doesn't exceed a maximum line count.
 * Elegant, purely string-based, 100% compliant OpenXML representation.
 */
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
      const allowedChars = allowedChunks * charsPerLine - 3; // Space for "..."
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

/**
 * Safely removes empty spacer paragraphs from a table cell to compensate for newly added text lines.
 */
const removeSpacerParagraphs = (cellXml: string, totalExcessLines: number, placeholderText: string): string => {
  if (totalExcessLines <= 0) return cellXml;

  // Extract all paragraphs in the cell precisely
  const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/g;
  const matches: { full: string; inner: string }[] = [];
  let match;
  
  pRegex.lastIndex = 0;
  while ((match = pRegex.exec(cellXml)) !== null) {
    matches.push({
      full: match[0],
      inner: match[1]
    });
  }

  // A paragraph is a spacer if it doesn't contain the placeholder and has no text content
  const spacerParagraphs: typeof matches = [];
  for (const m of matches) {
    const isMainPlaceholder = m.inner.includes(placeholderText);
    const hasText = m.inner.includes("<w:t");
    if (!isMainPlaceholder && !hasText) {
      spacerParagraphs.push(m);
    }
  }

  // Safely remove up to totalExcessLines of spacer paragraphs
  const toRemoveCount = Math.min(totalExcessLines, spacerParagraphs.length);
  if (toRemoveCount <= 0) return cellXml;

  const parasToRemove = spacerParagraphs.slice(0, toRemoveCount);
  let updatedCellXml = cellXml;
  for (const p of parasToRemove) {
    updatedCellXml = updatedCellXml.replace(p.full, "");
  }

  return updatedCellXml;
};

export const exportPOToWord = async (po: PurchaseOrder) => {
  // 1. EXPORT VALIDATION
  const errors: string[] = [];
  if (!po) {
    alert("No Purchase Order data provided.");
    return;
  }
  if (!po.poNumber) errors.push("P.O. Number is required.");
  if (!po.poDate) errors.push("P.O. Date is required.");
  if (!po.deliveryDate) errors.push("Delivery Date is required.");
  if (!po.supplierName) errors.push("Supplier Name is required.");
  if (!po.preparedBy) errors.push("Prepared By signatory is required.");
  
  if (errors.length > 0) {
    alert(`Cannot export Purchase Order due to validation errors:\n\n${errors.map(e => `• ${e}`).join("\n")}`);
    return;
  }

  // Derive RFS No. dynamically
  const rfsNo = po.poNumber.split("-").pop() || "10672";

  // Selected or default currency symbol
  const symbol = po.currencySymbol || "₱";

  // Helper to calculate physical lines of text in Cell 3 (NAME / DESCRIPTION OF ITEM)
  const getWrappedLineCount = (text: string, charsPerLine: number = 59): number => {
    if (!text) return 1;
    const lines = text.split("\n");
    let totalLines = 0;
    lines.forEach(line => {
      totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
    });
    return totalLines;
  };

  const formattedPurpose = po.purpose ?? "";

  // 2. CURRENCY ALIGNMENT & MULTI-LINE ITEMS FORMATTING
  const itemsCount = po.items.length;

  const qtyLines: string[] = [];
  const unitLines: string[] = [];
  const descLines: string[] = [];
  const priceLines: string[] = [];
  const amountLines: string[] = [];

  let totalDescLines = 0;
  const MAX_TOTAL_DESC_LINES = 18; // Max description lines allowed across all items on 1 page

  for (let i = 0; i < itemsCount; i++) {
    const item = po.items[i];
    let desc = item.description || "";

    // Safely truncate descriptions if we exceed total vertical space budget
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

    // Align other columns by padding them with extra empty lines to match description's wrapped lines
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

  // Format padded and aligned input values
  const SUPPLIER_NAME_LINE = padValueLeft(po.supplierName);
  const ATTENTION_LINE = padValueLeft(po.attention);
  const TEL_FAX_LINE = padValueLeft(`${po.telNo ?? ""} ${po.faxNo ? `/ ${po.faxNo}` : ""}`.trim());
  const PURPOSE_LINE = padValueLeft(formattedPurpose);

  const PO_NUMBER_LINE = padValueRight(po.poNumber);
  const PO_DATE_LINE = padValueRight(po.poDate);
  const DELIVERY_DATE_LINE = padValueRight(po.deliveryDate);
  const CATEGORY_LINE = padValueRight(po.category || "Vatable");

  // 3. REMOVE "undefined" VALUES & DEFINE TEMPLATE DATA
  const prepared = alignSignatory(po.preparedBy, po.preparedByTitle, po.excludePreparedBy);
  const checked = alignSignatory(po.checkedBy, po.checkedByTitle, po.excludeCheckedBy);
  const verified = alignSignatory(po.verifiedBy, po.verifiedByTitle, po.excludeVerifiedBy);
  const approved = alignSignatory(po.approvedBy, po.approvedByTitle, po.excludeApprovedBy);
  const conformeSig = alignSignatory(po.conforme, po.conformeTitle, po.excludeConforme);

  const templateData = {
    // Basic Metadata
    RFS_NO: rfsNo ?? "",
    SUPPLIER_NAME: po.supplierName ?? "",
    PO_NUMBER: po.poNumber ?? "",
    ATTENTION: po.attention ?? "",
    PO_DATE: formatDate(po.poDate) ?? "",
    TEL_FAX: `${po.telNo ?? ""} ${po.faxNo ? `/ ${po.faxNo}` : ""}`.trim() || "",
    DELIVERY_DATE: formatDate(po.deliveryDate) ?? "",
    PURPOSE: formattedPurpose,
    CATEGORY: po.category ?? "Vatable",

    // Perfect Aligned Padded Fields for Underline Alignment
    SUPPLIER_NAME_LINE,
    ATTENTION_LINE,
    TEL_FAX_LINE,
    PURPOSE_LINE,
    PO_NUMBER_LINE,
    PO_DATE_LINE,
    DELIVERY_DATE_LINE,
    CATEGORY_LINE,

    // Terms
    PAYMENT_TERMS: po.paymentTerms ?? "N/A",
    WORK_DURATION: po.workDuration ?? "N/A",
    WARRANTY: po.warranty ?? "N/A",

    // Financial calculations using reusable formatCurrency helper and the selected symbol
    VATABLE_AMOUNT: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vatableAmount, symbol) : "",
    VAT_AMOUNT: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vat12, symbol) : "",
    VAT_EXEMPT_AMOUNT: po.category?.toLowerCase().includes("exempt") ? formatCurrency(po.vatExemptAmount, symbol) : "",
    ZERO_RATED_AMOUNT: po.category?.toLowerCase().includes("zero") ? formatCurrency(po.zeroRatedAmount, symbol) : "",
    GROSS_AMOUNT: formatCurrency(po.grossAmount || po.totalAmount, symbol),
    PARTS_EWT: po.partsEwt1 > 0 ? formatCurrency(po.partsEwt1, symbol) : "",
    LABOR_EWT: po.laborEwt2 > 0 ? formatCurrency(po.laborEwt2, symbol) : "",
    DISCOUNT_VAT_AMOUNT: po.discountVatAmount > 0 ? formatCurrency(po.discountVatAmount, symbol) : "",
    TOTAL_AMOUNT: formatCurrency(po.totalAmount, symbol),

    // Signatories and Titles
    PREPARED_BY: prepared.name,
    PREPARED_BY_POSITION: prepared.position,
    CHECKED_BY: checked.name,
    CHECKED_BY_POSITION: checked.position,
    VERIFIED_BY: verified.name,
    VERIFIED_BY_POSITION: verified.position,
    APPROVED_BY: approved.name,
    APPROVED_BY_POSITION: approved.position,
    CONFORME: conformeSig.name,
    CONFORME_POSITION: conformeSig.position,

    // Multi-line items aligned side-by-side
    QUANTITY,
    UNIT,
    DESCRIPTION,
    UNIT_PRICE,
    AMOUNT,

    // Legacy camelCase/snake_case properties for maximum resiliency
    poNumber: po.poNumber ?? "",
    po_number: po.poNumber ?? "",
    poDate: po.poDate ?? "",
    po_date: po.poDate ?? "",
    rfsNo: rfsNo ?? "",
    rfs_no: rfsNo ?? "",
    supplierName: po.supplierName ?? "",
    supplier_name: po.supplierName ?? "",
    attention: po.attention ?? "",
    telNo: po.telNo ?? "",
    tel_fax: `${po.telNo ?? ""} ${po.faxNo ? `/ ${po.faxNo}` : ""}`.trim() || "",
    deliveryDate: po.deliveryDate ?? "",
    purpose: formattedPurpose,
    category: po.category ?? "Vatable",
    paymentTerms: po.paymentTerms ?? "N/A",
    workDuration: po.workDuration ?? "N/A",
    warranty: po.warranty ?? "N/A",
    vatableAmount: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vatableAmount, symbol) : "",
    vat12: po.category?.toLowerCase().includes("vatable") ? formatCurrency(po.vat12, symbol) : "",
    vatExemptAmount: po.category?.toLowerCase().includes("exempt") ? formatCurrency(po.vatExemptAmount, symbol) : "",
    zeroRatedAmount: po.category?.toLowerCase().includes("zero") ? formatCurrency(po.zeroRatedAmount, symbol) : "",
    grossAmount: formatCurrency(po.grossAmount || po.totalAmount, symbol),
    partsEwt1: po.partsEwt1 > 0 ? formatCurrency(po.partsEwt1, symbol) : "",
    laborEwt2: po.laborEwt2 > 0 ? formatCurrency(po.laborEwt2, symbol) : "",
    discountVatAmount: po.discountVatAmount > 0 ? formatCurrency(po.discountVatAmount, symbol) : "",
    totalAmount: formatCurrency(po.totalAmount, symbol),
    preparedBy: prepared.name,
    preparedByTitle: prepared.position,
    checkedBy: checked.name,
    checkedByTitle: checked.position,
    verifiedBy: verified.name,
    verifiedByTitle: verified.position,
    approvedBy: approved.name,
    approvedByTitle: approved.position,
    conforme: conformeSig.name
  };

  try {
    console.time("WordExport:Total");
    
    // 1. Fetch the Word Template file
    console.time("WordExport:TemplateFetch");
    // Verify template path
    const response = await fetch("/PO_TEMPLATE.docx");
    if (!response.ok) {
      throw new Error(`Failed to fetch PO template from /PO_TEMPLATE.docx: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    console.timeEnd("WordExport:TemplateFetch");

    const zip = new PizZip(arrayBuffer);
    const docXml = zip.file("word/document.xml");
    if (!docXml) {
        throw new Error("Could not find word/document.xml in template.");
    }
    let xml = docXml.asText();

    // 3. Clean up split placeholders {{...}} in the XML template before replacement
    console.time("WordExport:CleanPlaceholders");
    xml = cleanSplitPlaceholders(xml);
    console.timeEnd("WordExport:CleanPlaceholders");

    // 4. REPLACE ENTIRE METADATA PARAGRAPHS WITH A BEAUTIFUL FIXED-WIDTH BOTTOM-BORDERED TABLE
    console.time("WordExport:ReplaceMetadata");
    const fullBlockRegex = /<w:p\b[^>]*>(?:(?!<\/w:p>).)*SUPPLIER:.*CATEGORY:(?:(?!<\/w:p>).)*<\/w:p>/s;

    const tableXml = `<w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="11065" w:type="dxa"/>
        <w:tblLayout w:type="fixed"/>
        <w:jc w:val="center"/>
        <w:tblBorders>
          <w:top w:val="none"/>
          <w:left w:val="none"/>
          <w:bottom w:val="none"/>
          <w:right w:val="none"/>
          <w:insideH w:val="none"/>
          <w:insideV w:val="none"/>
        </w:tblBorders>
        <w:tblCellMar>
          <w:top w:w="60" w:type="dxa"/>
          <w:bottom w:w="60" w:type="dxa"/>
          <w:left w:w="80" w:type="dxa"/>
          <w:right w:w="80" w:type="dxa"/>
        </w:tblCellMar>
      </w:tblPr>
      <w:tblGrid>
        <w:gridCol w:w="1800"/>
        <w:gridCol w:w="5100"/>
        <w:gridCol w:w="1600"/>
        <w:gridCol w:w="2565"/>
      </w:tblGrid>
      
      <!-- Row 1: SUPPLIER & P.O. NUMBER -->
      <w:tr>
        <w:trPr>
          <w:cantSplit/>
        </w:trPr>
        <!-- Column 1: SUPPLIER Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1800" w:type="dxa"/>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>SUPPLIER:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 2: SUPPLIER Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5100" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>{{SUPPLIER_NAME}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 3: P.O. NUMBER Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1600" w:type="dxa"/>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:jc w:val="right"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
              <w:t>P.O NUMBER:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 4: P.O. NUMBER Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2565" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>{{PO_NUMBER}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      
      <!-- Row 2: ATTENTION & P.O. DATE -->
      <w:tr>
        <w:trPr>
          <w:cantSplit/>
        </w:trPr>
        <!-- Column 1: ATTENTION Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1800" w:type="dxa"/>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>ATTENTION:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 2: ATTENTION Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5100" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>{{ATTENTION}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 3: P.O. DATE Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1600" w:type="dxa"/>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:jc w:val="right"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
              <w:t>P.O DATE:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 4: P.O. DATE Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2565" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>{{PO_DATE}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      
      <!-- Row 3: TEL NO. / FAX NO. & DELIVERY DATE -->
      <w:tr>
        <w:trPr>
          <w:cantSplit/>
        </w:trPr>
        <!-- Column 1: TEL NO. / FAX NO. Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1800" w:type="dxa"/>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>TEL/FAX NO.:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 2: TEL NO. / FAX NO. Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5100" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>{{TEL_FAX}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 3: DELIVERY DATE Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1600" w:type="dxa"/>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:jc w:val="right"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
              <w:t>DELIVERY DATE:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 4: DELIVERY DATE Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2565" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="bottom"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>{{DELIVERY_DATE}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      
      <!-- Row 4: PURPOSE & CATEGORY -->
      <w:tr>
        <w:trPr>
          <w:cantSplit/>
        </w:trPr>
        <!-- Column 1: PURPOSE Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1800" w:type="dxa"/>
            <w:vAlign w:val="top"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>PURPOSE:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 2: PURPOSE Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5100" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="top"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
              <w:t>{{PURPOSE}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 3: CATEGORY Label -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="1600" w:type="dxa"/>
            <w:vAlign w:val="top"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:jc w:val="right"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:b/>
                <w:bCs/>
                <w:sz w:val="16"/>
                <w:szCs w:val="16"/>
              </w:rPr>
              <w:t>CATEGORY:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <!-- Column 4: CATEGORY Value -->
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="2565" w:type="dxa"/>
            <w:tcBorders>
              <w:bottom w:val="single" w:sz="6" w:space="0" w:color="000000"/>
            </w:tcBorders>
            <w:vAlign w:val="top"/>
          </w:tcPr>
          <w:p>
            <w:pPr>
              <w:spacing w:before="60" w:after="60"/>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
                <w:sz w:val="18"/>
                <w:szCs w:val="18"/>
              </w:rPr>
              <w:t>{{CATEGORY}}</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>`;

    xml = xml.replace(fullBlockRegex, tableXml);
    console.timeEnd("WordExport:ReplaceMetadata");

    // Calculate total excess lines to dynamically reduce spacer paragraphs
    console.time("WordExport:AdjustSpacerParagraphs");
    const purposeLineCount = getWrappedLineCount(po.purpose, 44);
    const excessPurposeLines = Math.max(0, purposeLineCount - 1);
    const excessItemLines = Math.max(0, totalDescLines - 1);
    const totalExcessLines = excessPurposeLines + excessItemLines;

    // Dynamically adjust spacer paragraphs in Cell 3, 4, and 5 of Row 2 of the items table
    const descIdx = xml.indexOf("DESCRIPTION");
    if (descIdx !== -1) {
      const tableStart = xml.lastIndexOf("<w:tbl>", descIdx);
      const tableEnd = xml.indexOf("</w:tbl>", descIdx) + 8;
      if (tableStart !== -1 && tableEnd !== -1) {
        const tableXmlStr = xml.slice(tableStart, tableEnd);
        const rows = tableXmlStr.split("<w:tr ");
        // Row 2 is at index 2 (splits on '<w:tr ')
        const row2 = rows[2];
        if (row2) {
          const cells = row2.split("<w:tc>");
          // Cell 3 is index 3, Cell 4 is index 4, Cell 5 is index 5
          let cell3 = cells[3];
          let cell4 = cells[4];
          let cell5 = cells[5];

          if (cell3) {
            // Safer, non-textbox solution: if description total is long, reduce the font size of the description
            // column from 9pt (18 half-points) to 7pt (14 half-points). This is 100% compliant and safe!
            if (totalDescLines > 12) {
              cell3 = cell3.replace(/<w:sz w:val="18"\/>/g, '<w:sz w:val="14"/>');
              cell3 = cell3.replace(/<w:szCs w:val="18"\/>/g, '<w:szCs w:val="14"/>');
            }

            // Remove spacer paragraphs to prevent pushing signatories to next page
            cell3 = removeSpacerParagraphs(cell3, totalExcessLines, "DESCRIPTION");
          }

          if (cell4) {
            cell4 = removeSpacerParagraphs(cell4, totalExcessLines, "UNIT_PRICE");
          }

          if (cell5) {
            cell5 = removeSpacerParagraphs(cell5, totalExcessLines, "AMOUNT");
          }

          cells[3] = cell3;
          cells[4] = cell4;
          cells[5] = cell5;
          rows[2] = cells.join("<w:tc>");

          // Ensure all rows in this items table have <w:cantSplit/> so they don't break across pages
          rows.forEach((rowStr, rIdx) => {
            if (rIdx > 0 && !rowStr.includes("<w:cantSplit/>") && !rowStr.includes("w:cantSplit")) {
              if (rowStr.includes("<w:trPr>")) {
                rows[rIdx] = rowStr.replace("<w:trPr>", "<w:trPr><w:cantSplit/>");
              } else {
                rows[rIdx] = rowStr.replace(/(<w:tr\b[^>]*>)/, "$1<w:trPr><w:cantSplit/></w:trPr>");
              }
            }
          });

          const updatedTableXml = rows.join("<w:tr ");
          xml = xml.slice(0, tableStart) + updatedTableXml + xml.slice(tableEnd);
        }
      }
    }
    console.timeEnd("WordExport:AdjustSpacerParagraphs");

    // 5. GENERICALLY UNDERLINE THE REMAINING DYNAMIC PLACEHOLDERS
    console.time("WordExport:UnderlinePlaceholders");
    const placeholdersToUnderline = [
      "PAYMENT_TERMS", "WORK_DURATION", "WARRANTY", 
      "RFS_NO", "PURPOSE", "CATEGORY"
    ];
    placeholdersToUnderline.forEach(placeholder => {
      xml = addUnderlineToPlaceholder(xml, placeholder);
    });
    console.timeEnd("WordExport:UnderlinePlaceholders");

    // 4. BOLD SIGNATORIES AND TOTAL AMOUNT
    console.time("WordExport:BoldPlaceholders");
    const boldPlaceholders = [
      "{{TOTAL_AMOUNT}}",
      "{{PREPARED_BY}}", "{{PREPARED_BY_POSITION}}", 
      "{{CHECKED_BY}}", "{{CHECKED_BY_POSITION}}",
      "{{VERIFIED_BY}}", "{{VERIFIED_BY_POSITION}}",
      "{{APPROVED_BY}}", "{{APPROVED_BY_POSITION}}",
      "{{CONFORME}}",
      "{{RFS_NO}}", "{{SUPPLIER_NAME}}", "{{ATTENTION}}", "{{TEL_FAX}}", "{{PURPOSE}}", "{{PO_NUMBER}}", "{{PO_DATE}}", "{{DELIVERY_DATE}}", "{{CATEGORY}}"
    ];
    zip.file("word/document.xml", xml);

    // 6. Compile and initialize Docxtemplater
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: "{{",
        end: "}}"
      }
    });

    // 7. Render the data into the document
    doc.render(templateData);

    // 8. Generate the final DOCX blob
    const outputBuffer = doc.getZip().generate({
      type: "blob",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // Log export action asynchronously to match audit trail behavior
    try {
      await fetch("/api/audit/log-export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("smei_jwt_token")}`
        },
        body: JSON.stringify({
          action: "Export PO",
          module: "Purchase Orders",
          details: `Exported Purchase Order Word document (PO Number: ${po.poNumber})`
        })
      });
    } catch (err) {
      console.error("Failed to log Word export activity:", err);
    }

  // 9. Trigger download using FileSaver
    saveAs(outputBuffer, `PO_${po.poNumber}.docx`);
  } catch (error) {
    console.error("DOCX generation failed:", error);
    alert("Failed to generate Word document. Please try again.");
  }
};
