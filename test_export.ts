import ExcelJS from "exceljs";
import fs from "fs";

async function exportExcelWithTemplateNode() {
  const buffer = fs.readFileSync("public/templates/PIS_TEMPLATE.xlsx");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const data = { PIS_NO: "12345" };

  workbook.eachSheet((worksheet) => {
    for (let r = 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      row.eachCell({ includeEmpty: true }, (cell) => {
        if (cell.isMerged && cell.master && cell.address !== cell.master.address) return;
        const val = cell.value;
        if (typeof val === "string" && val.includes("{{PIS_NO}}")) {
          cell.value = val.replace("{{PIS_NO}}", data.PIS_NO);
        }
      });
    }
  });

  const outBuffer = await workbook.xlsx.writeBuffer();
  fs.writeFileSync("test_output_fixed.xlsx", Buffer.from(outBuffer));
  console.log("Wrote test_output_fixed.xlsx", outBuffer.byteLength);
}

exportExcelWithTemplateNode().catch(console.error);
