import fs from "fs";
import PizZip from "pizzip";

const content = fs.readFileSync("./public/templates/PO_TEMPLATE.docx");
const zip = new PizZip(content);
let xml = zip.file("word/document.xml").asText();

const idx = xml.indexOf("RFS");
if (idx !== -1) {
  const startP = xml.lastIndexOf("<w:p ", idx);
  const endP = xml.indexOf("</w:p>", idx);
  console.log("--- RFS Paragraph XML ---");
  console.log(xml.slice(startP, endP + 6));
} else {
  console.log("Could not find RFS in XML.");
}
