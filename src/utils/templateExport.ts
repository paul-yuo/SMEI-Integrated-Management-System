/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/**
 * Reusable Word (.docx) Template Export Service
 */
export async function exportWordWithTemplate(
  templateName: string,
  data: Record<string, any>,
  outputFilename: string
) {
  try {
    let response = await fetch(`/templates/${templateName}`);
    if (!response.ok) {
      response = await fetch(`/${templateName}`);
    }
    if (!response.ok) {
      throw new Error(`Unable to export because the template '${templateName}' was not found in public/templates/ or public/.`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const zip = new PizZip(arrayBuffer);
    const doc = new Docxtemplater(zip, {
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
    let response = await fetch(`/templates/${templateName}`);
    if (!response.ok) {
      response = await fetch(`/${templateName}`);
    }
    if (!response.ok) {
      throw new Error(`Unable to export because the template '${templateName}' was not found in public/templates/ or public/.`);
    }
    const buffer = await response.arrayBuffer();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    
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
    saveAs(outBlob, outputFilename);
  } catch (error: any) {
    console.error("Excel Export Error:", error);
    alert(error.message || `An error occurred while exporting to ${outputFilename}`);
  }
}
