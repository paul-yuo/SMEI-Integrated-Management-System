import fs from "fs";
import PizZip from "pizzip";

const content = fs.readFileSync("./public/templates/PO_TEMPLATE.docx");
const zip = new PizZip(content);
let xml = zip.file("word/document.xml").asText();

const idx = xml.indexOf("TOTAL_AMOUNT");
if (idx !== -1) {
  // Find the start of the table row (<w:tr>) or cell (<w:tc>) containing this
  const startTr = xml.lastIndexOf("<w:tr ", idx);
  const endTr = xml.indexOf("</w:tr>", idx);
  if (startTr !== -1 && endTr !== -1) {
    console.log("--- XML of table row containing TOTAL_AMOUNT ---");
    console.log(xml.slice(startTr, endTr + 7));
  }
}
