import ExcelJS from "exceljs";

async function run() {
  const buffer = Buffer.from("<html><body><h1>Not an Excel file</h1></body></html>");
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer);
    console.log("Loaded successfully! Worksheets count:", workbook.worksheets.length);
  } catch (e) {
    console.error("Error loading:", e);
  }
}

run().catch(console.error);
