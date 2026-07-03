/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Helper to clean split placeholders {{...}} in the XML template before replacement
 */
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

/**
 * Reusable Word (.docx) Template Export Service
 */
export async function exportWordWithTemplate(
  templateName: string,
  data: Record<string, any>,
  outputFilename: string
) {
  try {
    console.log("===== TEMPLATE EXPORT STARTED =====");
    console.log("Template:", templateName);
    
    // Support cache-busting for PO_TEMPLATE.docx to avoid old cached templates
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
      throw new Error(`Unable to export because the template '${templateName}' was not found in public/templates/ or public/.`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    
    // Add required debugging immediately after loading the template
    if (templateName === "PO_TEMPLATE.docx") {
      console.log("Loading Purchase Order template...");
      console.log("Template:", templateName);
    }
    
    const zip = new PizZip(arrayBuffer);

    // Apply XML-level corrections for templates
    if (templateName === "CANVASS_TEMPLATE.docx") {
      let docXml = zip.files["word/document.xml"].asText();
      
      // Fix split curly braces in Category and Plate_No fields
      docXml = docXml.replace(/<w:t>\{<\/w:t>[\s\S]*?<w:t>\{<\/w:t>([\s\S]*?<w:t>Category<\/w:t>)/, "<w:t>{{</w:t>$1");
      docXml = docXml.replace(/<w:t>\{<\/w:t>[\s\S]*?<w:t>\{<\/w:t>([\s\S]*?<w:t>Plate_No<\/w:t>)/, "<w:t>{{</w:t>$1");
      
      // Fix parenthesis typos in contact_no placeholders
      docXml = docXml.replace(/\(\(contact_no/g, "{{contact_no");
      
      // Strip formatting tags and whitespaces within placeholders
      docXml = docXml.replace(/\{\{([^{}]*?)\}\}/g, (match) => {
        return match.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
      });
      
      zip.file("word/document.xml", docXml);
    } else if (templateName === "PO_TEMPLATE.docx") {
      let docXml = zip.files["word/document.xml"].asText();
      docXml = cleanSplitPlaceholders(docXml);
      zip.file("word/document.xml", docXml);
    }

    // Add required debugging for PO export data before rendering
    if (templateName === "PO_TEMPLATE.docx") {
      console.log(data);
    }

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
    
    // Save generated file using file-saver (highly resilient inside sandboxed frames)
    saveAs(outBlob, outputFilename);
  } catch (error: any) {
    console.error("Word Export Error:", error);
    alert(error.message || `An error occurred while exporting to ${outputFilename}`);
  }
}

/**
 * Helper to resolve all shared formulas into standard formulas to avoid ExcelJS shared-formula master-clone offset corruption errors.
 */
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
    const [startCellStr, endCellStr] = ref.split(":");
    if (!startCellStr || !endCellStr) return;
    
    const startMatch = startCellStr.match(/^([A-Z]+)([0-9]+)$/);
    const endMatch = endCellStr.match(/^([A-Z]+)([0-9]+)$/);
    if (!startMatch || !endMatch) return;
    
    const colLetter = startMatch[1];
    const startRow = parseInt(startMatch[2], 10);
    const endRow = parseInt(endMatch[2], 10);
    
    // Set the master cell value to a standard formula
    cell.value = { formula };
    
    // Fill other cells in the range with the translated row-offset formula
    for (let r = startRow + 1; r <= endRow; r++) {
      const targetCell = worksheet.getRow(r).getCell(colLetter);
      const adjustedFormula = formula.replace(
        new RegExp("(?<!\\$)([A-Z]+)" + startRow + "\\b", "g"),
        `$1${r}`
      );
      targetCell.value = { formula: adjustedFormula };
    }
  });
}

/**
 * Reusable Excel (.xlsx) Template Export Service
 * Supports row cloning for items grids, rich text cells, and template trimming
 */



export async function exportExcelWithTemplate(
  templateName: string,
  data: Record<string, any>,
  itemsKey: string,
  items: any[],
  outputFilename: string
) {
  try {
    console.log("Template:", templateName);
    console.log("Output:", outputFilename);
    console.log("Data:", data);
    let response = await fetch(`/templates/${templateName}`);
    if (!response.ok) {
      response = await fetch(`/${templateName}`);
    }
    if (!response.ok) {
      throw new Error(`Unable to export because the template '${templateName}' was not found in public/templates/ or public/.`);
    }
    const buffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    
    let templateLoaded = true;
    try {
      await workbook.xlsx.load(buffer);
      console.log("========== TEMPLATE LOADED ==========");
      console.log("Template:", templateName);
    } catch (loadError) {
      console.warn("Template load error, falling back to basic export:", loadError);
      templateLoaded = false;
    }

    if (!templateLoaded) {
      const ws = workbook.addWorksheet("Export Data");
      let rowIdx = 1;
      for (const [k, v] of Object.entries(data)) {
        if (k !== itemsKey && typeof v !== "object") {
          ws.getCell(`A${rowIdx}`).value = k;
          ws.getCell(`B${rowIdx}`).value = v;
          rowIdx++;
        }
      }
      rowIdx++;
      if (items && items.length > 0) {
        const keys = Object.keys(items[0]);
        keys.forEach((k, colIdx) => {
          ws.getCell(rowIdx, colIdx + 1).value = k;
        });
        rowIdx++;
        items.forEach((item) => {
          keys.forEach((k, colIdx) => {
            ws.getCell(rowIdx, colIdx + 1).value = item[k];
          });
          rowIdx++;
        });
      }
      const outBuffer = await workbook.xlsx.writeBuffer();
      const outBlob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(outBlob, outputFilename);
      return;
    }

    // ADVANCED CLONING ENGINE FOR CANVASS SHEET MODULE
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

      // 1. Dynamic Column Expansion
      if (N > 2) {
        for (let s = 2; s < N; s++) {
          const targetColIdx = 5 + s;
          ws.spliceColumns(targetColIdx, 0, []);
          ws.getColumn(targetColIdx).width = ws.getColumn(6).width;

          // Copy cell styling, values, borders, and fonts from Column 6 (F) to targetColIdx
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

      // 2. Dynamic Row Expansion (Row 17 is our repeating parts row)
      const repeatingRowIndex = 17;
      const itemsCount = items.length;
      if (itemsCount > 1) {
        ws.duplicateRow(repeatingRowIndex, itemsCount - 1, true);
      }

      // 3. Fill Row Data for items
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

      // 4. Fill Shop Headers & Attributes (Row 8 to 14)
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

      // 5. Fill Dynamic Summary Rows (shifted by itemsCount - 1)
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

      // 6. Fill General Metadata & Signatories
      for (let r = 1; r <= ws.rowCount; r++) {
        if (r >= repeatingRowIndex && r <= grandRowIdx) {
          continue; // Skip parts grid row area
        }
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

      const outBuffer = await workbook.xlsx.writeBuffer();
      const outBlob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(outBlob, outputFilename);
      return;
    }

    workbook.eachSheet((worksheet) => {
      // 1. Resolve shared formulas immediately to prevent save corruption errors
      resolveSharedFormulas(worksheet);

      let repeatingRowIndex = -1;
      
      // Find row containing repeating placeholders (item., items. or standard item fields)
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
        
        // Cache original cells from rowToCopy so we don't mutate them on first loop iteration
        const templateCells: { colNumber: number; value: any; style: any }[] = [];
        rowToCopy.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          templateCells.push({
            colNumber,
            value: cell.value,
            style: cell.style
          });
        });

        // If we have multiple items, duplicate the repeating row
        if (items.length > 1) {
          worksheet.duplicateRow(repeatingRowIndex, items.length - 1, true);
        }
        
        // Fill item data
        for (let i = 0; i < items.length; i++) {
          const currentRowIndex = repeatingRowIndex + i;
          const row = worksheet.getRow(currentRowIndex);
          const itemData = items[i];
          
          templateCells.forEach(({ colNumber, value, style }) => {
            const currentCell = row.getCell(colNumber);
            currentCell.style = style; // Preserve layout, colors, and borders
            
            if (currentCell.isMerged && currentCell.master && currentCell.address !== currentCell.master.address) {
              return;
            }
            
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
                
                // If the cell had exactly one placeholder, preserve original type if numeric/boolean
                if (value.trim().match(/^\{\{[^}]+\}\}$/)) {
                  const field = value.replace(/[\{\}]/g, "").replace(/^(items?\.)/, "").trim();
                  let rawVal = undefined;
                  if (itemData[field] !== undefined) rawVal = itemData[field];
                  else if (itemData[field.toLowerCase()] !== undefined) rawVal = itemData[field.toLowerCase()];
                  else if (field === "ITEM_DESCRIPTION" && itemData.description !== undefined) rawVal = itemData.description;
                  else if (field === "QTY" && itemData.quantity !== undefined) rawVal = itemData.quantity;
                  else if (field === "UNIT" && itemData.unit !== undefined) rawVal = itemData.unit;
                  else if (field === "REMARKS" && itemData.remarks !== undefined) rawVal = itemData.remarks;
                  
                  if (typeof rawVal === "number" || typeof rawVal === "boolean") {
                    currentCell.value = rawVal;
                    return;
                  }
                }
                
                // Prevent loss of leading zeros in serial codes, control numbers or numeric-looking strings
                currentCell.value = (isNaN(Number(cellStr)) || cellStr === "" || cellStr.startsWith("0") && cellStr.length > 1) ? cellStr : Number(cellStr);
              } else {
                currentCell.value = value;
              }
            } else if (value && typeof value === "object" && (value as any).richText && Array.isArray((value as any).richText)) {
              // Handle rich text inside repeating rows
              const rtArray = JSON.parse(JSON.stringify((value as any).richText));
              rtArray.forEach((rt: any) => {
                if (rt.text && typeof rt.text === "string") {
                  const matches = rt.text.match(/\{\{([^}]+)\}\}/g);
                  if (matches) {
                    matches.forEach((m: string) => {
                      const field = m.replace(/[\{\}]/g, "").replace(/^(items?\.)/, "").trim();
                      let replacedVal = "";
                      if (itemData[field] !== undefined) replacedVal = itemData[field];
                      else if (itemData[field.toLowerCase()] !== undefined) replacedVal = itemData[field.toLowerCase()];
                      else if (field === "ITEM_DESCRIPTION" && itemData.description !== undefined) replacedVal = itemData.description;
                      else if (field === "QTY" && itemData.quantity !== undefined) replacedVal = itemData.quantity;
                      else if (field === "UNIT" && itemData.unit !== undefined) replacedVal = itemData.unit;
                      else if (field === "REMARKS" && itemData.remarks !== undefined) replacedVal = itemData.remarks;
                      
                      rt.text = rt.text.replace(m, String(replacedVal));
                    });
                  }
                }
              });
              currentCell.value = { richText: rtArray };
            } else {
              currentCell.value = value;
            }
          });
        }
      }
      
      // Replace general, non-repeating placeholders in all other cells
      for (let r = 1; r <= worksheet.rowCount; r++) {
        if (repeatingRowIndex !== -1 && r >= repeatingRowIndex && r < repeatingRowIndex + (items ? items.length : 0)) {
          continue; // Skip the repeating rows we already processed
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
              
              // If cell had exactly one placeholder, preserve original type if numeric/boolean
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
            // Handle rich text
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
    
    // Save generated file in browser using file-saver (resilient in sandboxes)
    const outBuffer = await workbook.xlsx.writeBuffer();
    const outBlob = new Blob([outBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    console.log("========== BEFORE SAVE ==========");
    console.log("BB1 =", workbook.worksheets[0].getCell("BB1").value);
    console.log("T8 =", workbook.worksheets[0].getCell("T8").value);
    console.log("I13 =", workbook.worksheets[0].getCell("I13").value);
    saveAs(outBlob, outputFilename);
  } catch (error: any) {
    console.error("Excel Export Error:", error);
    alert(error.message || `An error occurred while exporting to ${outputFilename}`);
  }
}
