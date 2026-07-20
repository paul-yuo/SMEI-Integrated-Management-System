import ExcelJS from "exceljs";
import path from "path";

async function inspect() {
  const filePath = path.join(process.cwd(), "public/templates/WASTE_MOVEMENT_TEMPLATE.xlsm");
  console.log("Loading workbook:", filePath);
  
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  
  console.log("\nWorksheets found:", workbook.worksheets.map(ws => ws.name));
  
  for (const ws of workbook.worksheets) {
    console.log(`\n--- Inspecting Worksheet: ${ws.name} ---`);
    console.log(`Dimensions: ${ws.dimensions}`);
    
    // Scan rows 1 to 100
    for (let r = 1; r <= 80; r++) {
      const row = ws.getRow(r);
      let rowStr = "";
      let hasData = false;
      
      for (let c = 1; c <= 26; c++) {
        const cell = row.getCell(c);
        if (cell.value !== null && cell.value !== undefined) {
          hasData = true;
          const colLetter = String.fromCharCode(64 + c);
          rowStr += `[${colLetter}${r}]: ${JSON.stringify(cell.value)} | `;
        }
      }
      
      if (hasData) {
        console.log(rowStr);
      }
    }
  }
}

inspect().catch(err => {
  console.error("Error inspecting:", err);
});
