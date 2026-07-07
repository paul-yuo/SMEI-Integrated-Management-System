import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

// Merge split placeholders like {{PART1</w:t>...<w:t>PART2}} in Word XML
function cleanSplitPlaceholders(xml: string): string {
  let cleaned = xml.replace(/<w:proofErr\b[^>]*\/>/g, "");
  const splitRegex = /(\{\{[^}]+?)<\/w:t><\/w:r>(?:<w:proofErr\b[^>]*\/>)?<w:r\b[^>]*>(?:<w:rPr>[^]*?<\/w:rPr>)?<w:t\b[^>]*>([^}]*?\}\})/g;
  let prevCleaned;
  do {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(splitRegex, "$1$2");
  } while (cleaned !== prevCleaned);
  return cleaned;
}

// Resolve ExcelJS shared formulas
function resolveSharedFormulas(worksheet: ExcelJS.Worksheet) {
  const sharedMasters: { cell: ExcelJS.Cell; formula: string; ref: string }[] = [];
  for (let r = 1; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    row.eachCell({ includeEmpty: true }, (cell) => {
      const val = cell.value;
      if (val && typeof val === "object" && (val as any).shareType === "shared" && (val as any).formula && (val as any).ref) {
        sharedMasters.push({
          cell,
          formula: (val as any).formula,
          ref: (val as any).ref
        });
      }
    });
  }
  sharedMasters.forEach(({ cell, formula, ref }) => {
    const [start, end] = ref.split(":");
    if (!start) return;
    const startCell = worksheet.getCell(start);
    const endCell = end ? worksheet.getCell(end) : startCell;
    const startRow = Number(startCell.row);
    const startCol = Number(startCell.col);
    const endRow = Number(endCell.row);
    const endCol = Number(endCell.col);

    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const targetCell = worksheet.getCell(r, c);
        if (targetCell.address === cell.address) continue;
        const offsetRow = r - startRow;
        const offsetCol = c - startCol;
        targetCell.value = {
          formula,
          result: undefined,
          shareType: "shared",
          ref
        } as any;
      }
    }
  });
}

// Extract placeholders from Docx
export function extractDocxPlaceholders(zip: PizZip): string[] {
  const placeholders = new Set<string>();
  Object.keys(zip.files).forEach((filename) => {
    if (filename.endsWith(".xml")) {
      const xmlText = zip.files[filename].asText();
      const matches = xmlText.match(/\{\{([^}]+)\}\}/g) || [];
      matches.forEach((m) => {
        let clean = m.replace(/[\{\}]/g, "").trim();
        if (clean.startsWith("#") || clean.startsWith("/") || clean.startsWith("^")) {
          clean = clean.substring(1).trim();
        }
        if (clean) {
          placeholders.add(clean);
        }
      });
    }
  });
  return Array.from(placeholders);
}

// Extract placeholders from Excel
export function extractXlsxPlaceholders(workbook: ExcelJS.Workbook): string[] {
  const placeholders = new Set<string>();
  workbook.eachSheet((sheet) => {
    sheet.eachRow({ includeEmpty: true }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        const val = cell.value;
        if (typeof val === "string") {
          const matches = val.match(/\{\{([^}]+)\}\}/g) || [];
          matches.forEach((m) => {
            const clean = m.replace(/[\{\}]/g, "").trim();
            if (clean) placeholders.add(clean);
          });
        }
      });
    });
  });
  return Array.from(placeholders);
}

// Validate missing placeholders
export function validatePlaceholders(
  templatePlaceholders: string[],
  data: Record<string, any>,
  items: any[] = []
): string[] {
  const warnings: string[] = [];
  const lowercaseDataKeys = new Set(Object.keys(data).map((k) => k.toLowerCase()));
  const itemKeys = items.length > 0 ? new Set(Object.keys(items[0]).map((k) => k.toLowerCase())) : new Set<string>();

  templatePlaceholders.forEach((placeholder) => {
    const cleanPh = placeholder.replace(/^(items?\.)/, "").trim();
    const phLower = cleanPh.toLowerCase();

    const isRootFound = lowercaseDataKeys.has(phLower) || lowercaseDataKeys.has(placeholder.toLowerCase());
    const isItemFound =
      itemKeys.has(phLower) ||
      (phLower === "item_description" && itemKeys.has("description")) ||
      (phLower === "qty" && itemKeys.has("quantity")) ||
      (phLower === "unit" && itemKeys.has("unit")) ||
      (phLower === "remarks" && itemKeys.has("remarks"));

    if (!isRootFound && !isItemFound) {
      if (!["s", "index", "shops", "items"].includes(phLower)) {
        warnings.push(`Missing placeholder: ${placeholder}`);
      }
    }
  });
  return warnings;
}

// Generate Docx Blob with exact same core engine
export async function generateDocxBlob(
  templateName: string,
  data: Record<string, any>
): Promise<{ blob: Blob; warnings: string[] }> {
  const fetchUrl = templateName === "PO_TEMPLATE.docx"
    ? `/templates/PO_TEMPLATE.docx?t=${Date.now()}`
    : `/templates/${templateName}`;

  let response = await fetch(fetchUrl);
  if (!response.ok) {
    const fallbackUrl = templateName === "PO_TEMPLATE.docx"
      ? `/PO_TEMPLATE.docx?t=${Date.now()}`
      : `/${templateName}`;
    response = await fetch(fallbackUrl);
  }

  if (!response.ok) {
    throw new Error(`Unable to load template '${templateName}'. Please verify public/templates/ directory.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const zip = new PizZip(arrayBuffer);

  // Apply XML level corrections
  if (templateName === "CANVASS_TEMPLATE.docx") {
    let docXml = zip.files["word/document.xml"].asText();
    docXml = docXml.replace(/<w:t>\{<\/w:t>[\s\S]*?<w:t>\{<\/w:t>([\s\S]*?<w:t>Category<\/w:t>)/, "<w:t>{{</w:t>$1");
    docXml = docXml.replace(/<w:t>\{<\/w:t>[\s\S]*?<w:t>\{<\/w:t>([\s\S]*?<w:t>Plate_No<\/w:t>)/, "<w:t>{{</w:t>$1");
    docXml = docXml.replace(/\(\(contact_no/g, "{{contact_no");
    docXml = docXml.replace(/\{\{([^{}]*?)\}\}/g, (match) => {
      return match.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
    });
    zip.file("word/document.xml", docXml);
  } else if (templateName === "PO_TEMPLATE.docx") {
    let docXml = zip.files["word/document.xml"].asText();
    docXml = cleanSplitPlaceholders(docXml);
    zip.file("word/document.xml", docXml);
  }

  // extract template placeholders
  const templatePlaceholders = extractDocxPlaceholders(zip);
  const items = data.items || [];
  const warnings = validatePlaceholders(templatePlaceholders, data, items);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.setData(data);
  doc.render();

  const outBlob = doc.getZip().generate({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  return { blob: outBlob, warnings };
}

// Generate Excel Blob + HTML with exact same core engine
export async function generateXlsxBlob(
  templateName: string,
  data: Record<string, any>,
  itemsKey: string,
  items: any[]
): Promise<{ blob: Blob; html: string; warnings: string[] }> {
  let response = await fetch(`/templates/${templateName}`);
  if (!response.ok) {
    response = await fetch(`/${templateName}`);
  }
  if (!response.ok) {
    throw new Error(`Unable to load template '${templateName}'. Please verify public/templates/ directory.`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const templatePlaceholders = extractXlsxPlaceholders(workbook);
  const warnings = validatePlaceholders(templatePlaceholders, data, items);

  // Applycloning logic
  if (templateName === "CANVASS_TEMPLATE.xlsx") {
    const ws = workbook.worksheets[0];
    resolveSharedFormulas(ws);

    const shops = data.shops || [
      {
        name: data.SUPPLIER_NAME || "Supplier A",
        contact_person: data.CONTACT || "",
        contact_no: data.PHONE || "",
        work_duration: "",
        warranty: "",
        payment_terms: "",
        prices: items.map(it => it.supplierAPrice || 0),
        total: items.reduce((sum, it) => sum + ((it.supplierAPrice || 0) * (it.quantity || 0)), 0),
        vat: 0,
        total_amount: items.reduce((sum, it) => sum + ((it.supplierAPrice || 0) * (it.quantity || 0)), 0)
      },
      {
        name: "Supplier B",
        contact_person: "",
        contact_no: "",
        work_duration: "",
        warranty: "",
        payment_terms: "",
        prices: items.map(it => it.supplierBPrice || 0),
        total: items.reduce((sum, it) => sum + ((it.supplierBPrice || 0) * (it.quantity || 0)), 0),
        vat: 0,
        total_amount: items.reduce((sum, it) => sum + ((it.supplierBPrice || 0) * (it.quantity || 0)), 0)
      },
      {
        name: "Supplier C",
        contact_person: "",
        contact_no: "",
        work_duration: "",
        warranty: "",
        payment_terms: "",
        prices: items.map(it => it.supplierCPrice || 0),
        total: items.reduce((sum, it) => sum + ((it.supplierCPrice || 0) * (it.quantity || 0)), 0),
        vat: 0,
        total_amount: items.reduce((sum, it) => sum + ((it.supplierCPrice || 0) * (it.quantity || 0)), 0)
      }
    ];

    const N = shops.length;

    // Col cloner
    if (N > 2) {
      for (let s = 2; s < N; s++) {
        const targetColIdx = 5 + s;
        ws.spliceColumns(targetColIdx, 0, []);
        ws.getColumn(targetColIdx).width = ws.getColumn(6).width;

        for (let r = 1; r <= ws.rowCount; r++) {
          const fromCell = ws.getRow(r).getCell(6);
          const toCell = ws.getRow(r).getCell(targetColIdx);
          toCell.style = JSON.parse(JSON.stringify(fromCell.style || {}));
          
          const val = fromCell.value;
          if (typeof val === "string") {
            const newVal = val.replace(/_name2\}\}/g, `_name${s + 1}}}`)
                            .replace(/_person2\}\}/g, `_person${s + 1}}}`)
                            .replace(/_no2\}\}/g, `_no${s + 1}}}`)
                            .replace(/_duration2\}\}/g, `_duration${s + 1}}}`)
                            .replace(/_terms2\}\}/g, `_terms${s + 1}}}`)
                            .replace(/_price2\}\}/g, `_price${s + 1}}}`)
                            .replace(/_shop2\}\}/g, `_shop${s + 1}}}`)
                            .replace(/_amount2\}\}/g, `_amount${s + 1}}}`)
                            .replace(/_warranty2\}\}/g, `_warranty${s + 1}}}`)
                            .replace(/vat2\}\}/g, `vat${s + 1}}}`)
                            .replace(/parts_shop2_price2\}\}/g, `parts_shop${s + 1}_price${s + 1}}}`)
                            .replace(/total_shop2\}\}/g, `total_shop${s + 1}}}`)
                            .replace(/total_amount2\}\}/g, `total_amount${s + 1}}}`);
            toCell.value = newVal;
          } else {
            toCell.value = val;
          }
        }
      }
    }

    // Row cloner
    const repeatingRowIndex = 17;
    const itemsCount = items.length;
    if (itemsCount > 1) {
      ws.duplicateRow(repeatingRowIndex, itemsCount - 1, true);
    }

    for (let i = 0; i < itemsCount; i++) {
      const currentRowIdx = repeatingRowIndex + i;
      const row = ws.getRow(currentRowIdx);
      const itemData = items[i];

      row.getCell(1).value = i + 1;
      row.getCell(2).value = itemData.item || "";
      row.getCell(3).value = itemData.quantity || 0;
      row.getCell(4).value = itemData.unit || "";

      for (let s = 0; s < N; s++) {
        const colIdx = 5 + s;
        const shop = shops[s];
        row.getCell(colIdx).value = shop.prices[i] !== undefined ? shop.prices[i] : 0;
      }
    }

    // Shop headers
    for (let s = 0; s < N; s++) {
      const colIdx = 5 + s;
      const shop = shops[s];
      ws.getCell(8, colIdx).value = `SHOP ${s + 1}`;
      ws.getCell(9, colIdx).value = shop.name || "";
      ws.getCell(10, colIdx).value = shop.contact_person || "";
      ws.getCell(11, colIdx).value = shop.contact_no || "";
      ws.getCell(12, colIdx).value = shop.work_duration || "";
      ws.getCell(13, colIdx).value = shop.warranty || "";
      ws.getCell(14, colIdx).value = shop.payment_terms || "";
    }

    const totalRowIdx = repeatingRowIndex + itemsCount;
    const vatRowIdx = totalRowIdx + 1;
    const grandRowIdx = vatRowIdx + 1;

    for (let s = 0; s < N; s++) {
      const colIdx = 5 + s;
      const shop = shops[s];
      ws.getCell(totalRowIdx, colIdx).value = shop.total || 0;
      ws.getCell(vatRowIdx, colIdx).value = shop.vat || 0;
      ws.getCell(grandRowIdx, colIdx).value = shop.total_amount || 0;
    }

    // General replacements
    for (let r = 1; r <= ws.rowCount; r++) {
      if (r >= repeatingRowIndex && r <= grandRowIdx) continue;
      const row = ws.getRow(r);
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.isMerged && cell.master && cell.address !== cell.master.address) return;
        const val = cell.value;
        if (typeof val === "string") {
          let cellStr = val;
          const matches = cellStr.match(/\{\{([^}]+)\}\}/g);
          if (matches) {
            matches.forEach((m) => {
              const key = m.replace(/[\{\}]/g, "").trim();
              const replacedVal = data[key] !== undefined ? data[key] : "";
              cellStr = cellStr.replace(m, String(replacedVal));
            });
            cell.value = (isNaN(Number(cellStr)) || cellStr === "" || cellStr.startsWith("0") && cellStr.length > 1) ? cellStr : Number(cellStr);
          }
        }
      });
    }
  } else {
    // General excel template cloner
    workbook.eachSheet((worksheet) => {
      resolveSharedFormulas(worksheet);

      let repeatingRowIndex = -1;
      for (let r = 1; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        let isRepeatingRow = false;
        row.eachCell({ includeEmpty: true }, (cell) => {
          const val = cell.value;
          if (typeof val === "string" && (
            val.includes("{{item.") || 
            val.includes("{{items.") || 
            val.includes("{{QTY}}") || 
            val.includes("{{ITEM_DESCRIPTION}}") ||
            val.includes("{{UNIT}}") ||
            val.toLowerCase().includes("{{qty") ||
            val.toLowerCase().includes("{{unit") ||
            val.toLowerCase().includes("{{item_description")
          )) {
            isRepeatingRow = true;
          }
        });
        if (isRepeatingRow) {
          repeatingRowIndex = r;
          break;
        }
      }

      if (repeatingRowIndex !== -1 && items && items.length > 0) {
        const rowToCopy = worksheet.getRow(repeatingRowIndex);
        const templateCells: { colNumber: number; value: any; style: any }[] = [];
        rowToCopy.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          templateCells.push({
            colNumber,
            value: cell.value,
            style: cell.style
          });
        });

        if (items.length > 1) {
          worksheet.duplicateRow(repeatingRowIndex, items.length - 1, true);
        }

        for (let i = 0; i < items.length; i++) {
          const currentRowIndex = repeatingRowIndex + i;
          const row = worksheet.getRow(currentRowIndex);
          const itemData = items[i];

          templateCells.forEach(({ colNumber, value, style }) => {
            const currentCell = row.getCell(colNumber);
            currentCell.style = style;
            if (currentCell.isMerged && currentCell.master && currentCell.address !== currentCell.master.address) return;

            if (typeof value === "string") {
              let cellStr = value;
              const matches = cellStr.match(/\{\{([^}]+)\}\}/g);
              if (matches) {
                matches.forEach((m) => {
                  const field = m.replace(/[\{\}]/g, "").replace(/^(items?\.)/, "").trim();
                  let replacedVal = "";
                  if (itemData[field] !== undefined) {
                    replacedVal = itemData[field];
                  } else if (itemData[field.toLowerCase()] !== undefined) {
                    replacedVal = itemData[field.toLowerCase()];
                  } else if (field === "ITEM_DESCRIPTION" && itemData.description !== undefined) {
                    replacedVal = itemData.description;
                  } else if (field === "QTY" && itemData.quantity !== undefined) {
                    replacedVal = itemData.quantity;
                  } else if (field === "UNIT" && itemData.unit !== undefined) {
                    replacedVal = itemData.unit;
                  } else if (field === "REMARKS" && itemData.remarks !== undefined) {
                    replacedVal = itemData.remarks;
                  }
                  cellStr = cellStr.replace(m, String(replacedVal));
                });
              }
              currentCell.value = (isNaN(Number(cellStr)) || cellStr === "" || cellStr.startsWith("0") && cellStr.length > 1) ? cellStr : Number(cellStr);
            }
          });
        }
      }

      // Root substitutions
      for (let r = 1; r <= worksheet.rowCount; r++) {
        if (repeatingRowIndex !== -1 && r >= repeatingRowIndex && r < repeatingRowIndex + items.length) {
          continue;
        }
        const row = worksheet.getRow(r);
        row.eachCell({ includeEmpty: true }, (cell) => {
          if (cell.isMerged && cell.master && cell.address !== cell.master.address) return;
          const val = cell.value;
          if (typeof val === "string") {
            let cellStr = val;
            const matches = cellStr.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
              matches.forEach((m) => {
                const key = m.replace(/[\{\}]/g, "").trim();
                const replacedVal = data[key] !== undefined ? data[key] : "";
                cellStr = cellStr.replace(m, String(replacedVal));
              });

              if (val.trim().match(/^\{\{[^}]+\}\}$/)) {
                const key = val.replace(/[\{\}]/g, "").trim();
                const rawVal = data[key];
                if (typeof rawVal === "number" || typeof rawVal === "boolean") {
                  cell.value = rawVal;
                  return;
                }
              }
              cell.value = (isNaN(Number(cellStr)) || cellStr === "" || cellStr.startsWith("0") && cellStr.length > 1) ? cellStr : Number(cellStr);
            }
          } else if (val && typeof val === "object" && (val as any).richText && Array.isArray((val as any).richText)) {
            const rtArray = JSON.parse(JSON.stringify((val as any).richText));
            let hasMatch = false;
            rtArray.forEach((rt: any) => {
              if (rt.text && typeof rt.text === "string") {
                const matches = rt.text.match(/\{\{([^}]+)\}\}/g);
                if (matches) {
                  hasMatch = true;
                  matches.forEach((m: string) => {
                    const key = m.replace(/[\{\}]/g, "").trim();
                    const replacedVal = data[key] !== undefined ? data[key] : "";
                    rt.text = rt.text.replace(m, String(replacedVal));
                  });
                }
              }
            });
            if (hasMatch) {
              cell.value = { richText: rtArray };
            }
          }
        });
      }
    });
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  const outBlob = new Blob([outBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Convert Excel workbook to HTML using SheetJS
  let html = "";
  try {
    const wb = XLSX.read(outBuffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    html = XLSX.utils.sheet_to_html(ws, { editable: false });
  } catch (err) {
    console.error("SheetJS conversion error:", err);
    html = `<div class="p-4 text-rose-500">Failed to render Excel as HTML table.</div>`;
  }

  return { blob: outBlob, html, warnings };
}
