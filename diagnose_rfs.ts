import ExcelJS from "exceljs";
import fs from "fs";

async function diagnose() {
  const buffer = fs.readFileSync("public/templates/RFS_TEMPLATE.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  workbook.eachSheet((worksheet) => {
    for (let r = 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.value) {
          let text = "";
          if (typeof cell.value === "string") text = cell.value;
          if (typeof cell.value === "object" && (cell.value as any).richText) {
             text = (cell.value as any).richText.map((rt: any) => rt.text).join("");
          }
          if (text) {
             console.log(`Cell ${cell.address}: ${text}`);
          }
        }
      });
    }
  });
}

diagnose().catch(console.error);
