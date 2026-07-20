import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from "fs";
import { execSync } from "child_process";

// Safe cleaner mimicking templatePreview.ts
function cleanSplitPlaceholders(xml: string): string {
  let cleaned = xml.replace(/<w:proofErr\b[^>]*\/>/g, "");
  cleaned = cleaned.replace(/\{<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\{/g, "{{");
  cleaned = cleaned.replace(/\}<\/w:t>(?:<[^>]+>|\s)*?<w:t\b[^>]*>\}/g, "}}");
  cleaned = cleaned.replace(/\{\{((?:(?!\{\{)[\s\S])*?)\}\}/g, (match, p1) => {
    const stripped = p1.replace(/<\/w:t>[\s\S]*?<w:t\b[^>]*>/g, "");
    return `{{${stripped}}}`;
  });
  return cleaned;
}

function runSimulatedDocxGen() {
  const buffer = fs.readFileSync("public/templates/CANVASS_TEMPLATE.docx");
  const zip = new PizZip(buffer);
  
  let docXml = zip.files["word/document.xml"].asText();
  docXml = cleanSplitPlaceholders(docXml);
  docXml = docXml.replace(/\(\(/g, "{{").replace(/\)\)/g, "}}");

  // Mock data for 2 suppliers (triggers the cloner code)
  const data: Record<string, any> = {
    Control_NO: "CANVASS-2026-0001",
    Category: "Mechanical",
    Plate_No: "ABC-123",
    remarks: "Urgent canvas sheet request",
    PREPARED_BY: "Juan Dela Cruz",
    PREPARED_BY_POSITION: "Canvasser",
    CHECKED_BY: "Robert Chen",
    CHECKED_BY_POSITION: "Maintenance Supervisor",
    VERIFIED_BY: "Elena Lopez",
    VERIFIED_BY_POSITION: "Operations Manager",
    APPROVED_BY: "William Sy",
    APPROVED_BY_POSITION: "Purchasing Manager",
    
    // Supplier 1
    shop_name1: "Supplier A",
    contact_person1: "Arthur Alcantara",
    contact_no1: "+63-46-437-1234",
    work_duration1: "15 Days",
    warranty1: "1 Year",
    payment_terms1: "Net 30",
    parts_shop1_price1: "₱ 10,000.00\n₱ 5,000.00",
    total_shop1: "₱ 15,000.00",
    vat1: "₱ 1,800.00",
    total_amount1: "₱ 16,800.00",

    // Supplier 2
    shop_name2: "Supplier B",
    contact_person2: "Sarah Jingco",
    contact_no2: "+63-46-437-8899",
    work_duration2: "10 Days",
    warranty2: "6 Months",
    payment_terms2: "Net 15",
    parts_shop2_price2: "₱ 12,000.00\n₱ 4,500.00",
    total_shop2: "₱ 16,500.00",
    vat2: "₱ 1,980.00",
    total_amount2: "₱ 18,480.00",
    
    parts1: "Stainless steel pipe\nBrass valves"
  };

  let numSuppliers = 1;
  while (data[`shop_name${numSuppliers + 1}`] !== undefined) {
    numSuppliers++;
  }
  
  console.log(`Detected suppliers: ${numSuppliers}`);

  if (numSuppliers > 0) {
    const partsOfTr = docXml.split("<w:tr");
    const processedTrs = partsOfTr.map((trPart, trIdx) => {
      if (trIdx === 0) return trPart;

      const hasSupplierPlaceholder = trPart.includes("shop_name1") ||
        trPart.includes("contact_person1") ||
        trPart.includes("contact_no1") ||
        trPart.includes("contact_no") ||
        trPart.includes("work_duration1") ||
        trPart.includes("warranty1") ||
        trPart.includes("payment_terms1") ||
        trPart.includes("parts_shop1_price1") ||
        trPart.includes("total_shop1") ||
        trPart.includes("vat1") ||
        trPart.includes("total_amount1");

      if (hasSupplierPlaceholder) {
        const endTrIdx = trPart.indexOf("</w:tr>");
        if (endTrIdx !== -1) {
          const rowContent = trPart.substring(0, endTrIdx);
          const trailingContent = trPart.substring(endTrIdx);

          let cells = rowContent.split("<w:tc");
          cells = cells.filter((cell, cellIdx) => {
            if (cellIdx === 0) return true;
            const containsOtherSupplier = 
              cell.includes("shop_name2") || cell.includes("shop_name3") ||
              cell.includes("contact_person2") || cell.includes("contact_person3") ||
              cell.includes("contact_no2") || cell.includes("contact_no3") ||
              cell.includes("work_duration2") || cell.includes("work_duration3") ||
              cell.includes("warranty2") || cell.includes("warranty3") ||
              cell.includes("payment_terms2") || cell.includes("payment_terms3") ||
              cell.includes("parts_shop2_price2") || cell.includes("parts_shop3_price3") ||
              cell.includes("total_shop2") || cell.includes("total_shop3") ||
              cell.includes("vat2") || cell.includes("vat3") ||
              cell.includes("total_amount2") || cell.includes("total_amount3");
            return !containsOtherSupplier;
          });
          
          let processedCells = cells.map((cell, cellIdx) => {
            if (cellIdx === 0) return cell;

            const isSupplierCell = cell.includes("shop_name1") ||
              cell.includes("contact_person1") ||
              cell.includes("contact_no1") ||
              cell.includes("contact_no") ||
              cell.includes("work_duration1") ||
              cell.includes("warranty1") ||
              cell.includes("payment_terms1") ||
              cell.includes("parts_shop1_price1") ||
              cell.includes("total_shop1") ||
              cell.includes("vat1") ||
              cell.includes("total_amount1");

            if (isSupplierCell) {
              const targetWidth = Math.round(5660 / numSuppliers);
              let cellXml = cell;
              console.log(`\n--- Original cell (isSupplierCell): ---\n${cell.substring(0, 200)}...\n`);
              cellXml = cellXml.replace(/<w:tcW w:w="[0-9]+" w:type="dxa"\/>/g, `<w:tcW w:w="${targetWidth}" w:type="dxa"/>`);

              let clones = [cellXml];
              for (let i = 2; i <= numSuppliers; i++) {
                let clonedCell = cellXml;
                clonedCell = clonedCell.replace(/shop_name1/g, `shop_name${i}`);
                clonedCell = clonedCell.replace(/contact_person1/g, `contact_person${i}`);
                clonedCell = clonedCell.replace(/contact_no1/g, `contact_no${i}`);
                clonedCell = clonedCell.replace(/contact_no/g, `contact_no${i}`);
                clonedCell = clonedCell.replace(/work_duration1/g, `work_duration${i}`);
                clonedCell = clonedCell.replace(/warranty1/g, `warranty${i}`);
                clonedCell = clonedCell.replace(/payment_terms1/g, `payment_terms${i}`);
                clonedCell = clonedCell.replace(/parts_shop1_price1/g, `parts_shop${i}_price${i}`);
                clonedCell = clonedCell.replace(/total_shop1/g, `total_shop${i}`);
                clonedCell = clonedCell.replace(/vat1/g, `vat${i}`);
                clonedCell = clonedCell.replace(/total_amount1/g, `total_amount${i}`);
                clones.push(clonedCell);
                console.log(`--- Cloned cell ${i}: ---\n${clonedCell.substring(0, 200)}...\n`);
              }
              const joinedClones = clones.join("<w:tc");
              console.log(`--- Joined Clones: ---\n${joinedClones.substring(0, 300)}...\n`);
              return joinedClones;
            }
            return cell;
          });
          return processedCells.join("<w:tc") + trailingContent;
        }
      }
      return trPart;
    });
    docXml = processedTrs.join("<w:tr");
  }

  docXml = docXml.replace(/\{\{([^{}]*?)\}\}/g, (match) => {
    return match.replace(/<[^>]+>/g, "").replace(/\s+/g, "");
  });
  
  zip.file("word/document.xml", docXml);

  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
    nullGetter() {
      return "";
    }
  });

  doc.render(data);

  const outBuffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE"
  });

  fs.writeFileSync("test_canvass_output.docx", outBuffer);
  console.log("Wrote test_canvass_output.docx successfully! Size:", outBuffer.length);
  
  // Verify with unzip
  try {
    execSync("unzip -t test_canvass_output.docx");
    console.log("Unzip integrity check: PASSED!");
  } catch (err: any) {
    console.error("Unzip integrity check: FAILED!", err.message);
  }
}

try {
  runSimulatedDocxGen();
} catch (e: any) {
  console.error("Fatal Error during generation:", e.message);
}
