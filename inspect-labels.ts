import fs from "fs";
import PizZip from "pizzip";

const content = fs.readFileSync("./public/templates/PO_TEMPLATE.docx");
const zip = new PizZip(content);
let xml = zip.file("word/document.xml").asText();

const searchTerms = ["VATABLE AMOUNT", "Gross Amount", "VAT", "Total Amount"];
searchTerms.forEach(term => {
  const idx = xml.toLowerCase().indexOf(term.toLowerCase());
  if (idx !== -1) {
    console.log(`--- Segment around ${term} ---`);
    console.log(xml.slice(idx - 100, idx + 200));
  } else {
    console.log(`Could not find ${term}`);
  }
});
