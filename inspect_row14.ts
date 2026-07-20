import fs from "fs";
import PizZip from "pizzip";

const buffer = fs.readFileSync("public/templates/RFS_TEMPLATE.xlsm");
const zip = new PizZip(buffer);
const sheetXml = zip.file("xl/worksheets/sheet1.xml")?.asText() || "";

const sheetDataMatch = sheetXml.match(/<sheetData>([\s\S]*?)<\/sheetData>/);
if (sheetDataMatch) {
  const rows = sheetDataMatch[1].match(/<row\s+[^>]+>[\s\S]*?<\/row>/g) || [];
  const row14 = rows.find(r => r.includes('r="14"'));
  if (row14) {
    console.log("Row 14 XML:");
    console.log(row14);
  } else {
    console.log("Row 14 not found!");
  }
}
