import * as ExcelJS from "exceljs";
import * as fs from "fs";

async function run() {
  const buffer = fs.readFileSync("public/templates/PIS_TEMPLATE.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  console.log("Worksheets count:", workbook.worksheets.length);
  workbook.eachSheet((worksheet) => {
    console.log("Sheet name:", worksheet.name);
    console.log("Row count:", worksheet.rowCount);
    const row = worksheet.getRow(1);
    row.eachCell((cell) => {
      console.log("Cell A1 value:", cell.value);
    });
  });
}

run().catch(console.error);
