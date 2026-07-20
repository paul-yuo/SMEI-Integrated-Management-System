import ExcelJS from "exceljs";
import fs from "fs";

async function inspect() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fs.readFileSync("public/templates/RFS_TEMPLATE.xlsm"));
  const ws = workbook.worksheets[0];
  ws.eachRow({ includeEmpty: true }, (row, r) => {
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      const val = cell.value;
      if (val && typeof val === "string" && val.includes("{{")) {
        console.log(`Cell ${cell.address} (Row ${r}, Col ${c}): ${val}`);
      }
    });
  });
}
inspect();
