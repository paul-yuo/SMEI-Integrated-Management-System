import PizZip from "pizzip";
import fs from "fs";
import path from "path";

function inspectSheetsMapping() {
  const filePath = path.join(process.cwd(), "public/templates/WASTE_MOVEMENT_TEMPLATE.xlsm");
  const data = fs.readFileSync(filePath);
  const zip = new PizZip(data);
  
  const workbookXml = zip.file("xl/workbook.xml")?.asText() || "";
  console.log("Workbook sheets element:");
  const sheetsRegex = /<sheets>([\s\S]*?)<\/sheets>/;
  const match = workbookXml.match(sheetsRegex);
  if (match) {
    console.log(match[1]);
  } else {
    console.log("No sheets element found");
  }

  const workbookRelsXml = zip.file("xl/_rels/workbook.xml.rels")?.asText() || "";
  console.log("Workbook.xml.rels contains relations:");
  const relRegex = /<Relationship\s+[^>]*Id="([^"]+)"\s+[^>]*Target="([^"]+)"/g;
  let rMatch;
  while ((rMatch = relRegex.exec(workbookRelsXml)) !== null) {
    console.log(`Relation: Id=${rMatch[1]} Target=${rMatch[2]}`);
  }
}

inspectSheetsMapping();
