import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell } from "docx";
import ExcelJS from "exceljs";
import fs from "fs";
import { execSync } from "child_process";

async function createDocx(filename: string) {
    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    children: [new TextRun({ text: "Generated Word Template: " + filename, bold: true, size: 32 })]
                }),
                new Paragraph({ text: "RFS: {{rfsNumber}} {{RFS_NO}}" }),
                new Paragraph({ text: "PO: {{poNumber}} {{PO_NO}}" }),
                new Paragraph({ text: "Date: {{dateRequested}} {{REQUEST_DATE}}" }),
                new Paragraph({ text: "Department: {{department}} {{DEPARTMENT}}" }),
                new Paragraph({ text: "Supplier: {{supplierName}} {{SUPPLIER_NAME}}" }),
                new Paragraph({ text: "Address: {{supplierAddress}} {{SUPPLIER_ADDRESS}}" }),
                new Paragraph({ text: "Total: {{totalAmount}} {{TOTAL_AMOUNT}}" }),
                new Paragraph({ text: "Prepared By: {{PREPARED_BY}} / Approved By: {{APPROVED_BY}}" }),
                new Paragraph({ text: "Items:" }),
                new Table({
                    rows: [
                        new TableRow({
                            children: [
                                new TableCell({ children: [new Paragraph("{{#items}}")] }),
                                new TableCell({ children: [new Paragraph("{{description}} {{item}}")] }),
                                new TableCell({ children: [new Paragraph("{{quantity}}")] }),
                                new TableCell({ children: [new Paragraph("{{unitPrice}}")] }),
                                new TableCell({ children: [new Paragraph("{{total}}")] }),
                                new TableCell({ children: [new Paragraph("{{/items}}")] }),
                            ]
                        })
                    ]
                })
            ]
        }]
    });
    const buffer = await Packer.toBuffer(doc);
    const dest = "public/templates/" + filename;
    fs.writeFileSync(dest, buffer);
    console.log("Created", filename, "size:", buffer.length);
    
    // Verify
    try {
        execSync(`unzip -t ${dest}`);
        console.log("Verified", filename, "successfully!");
    } catch (e: any) {
        console.error("Verification failed for", filename, e.message);
    }
}

async function createXlsx(filename: string) {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Template");
    
    // Fill basic cells
    sheet.getCell("A1").value = "Generated Excel Template: " + filename;
    sheet.getCell("A2").value = "{{rfsNumber}} {{RFS_NO}} {{pisNumber}} {{PIS_NO}}";
    sheet.getCell("B2").value = "{{poNumber}} {{PO_NO}}";
    sheet.getCell("A3").value = "{{department}} {{DEPARTMENT}}";
    sheet.getCell("B3").value = "{{supplierName}} {{SUPPLIER_NAME}}";
    
    // items repeating area (some rows will have placeholders)
    // Row 5
    sheet.getCell("A5").value = "{{items.description}}";
    sheet.getCell("B5").value = "{{items.quantity}}";
    sheet.getCell("C5").value = "{{items.total}}";
    
    // For Canvass sheet specific cloner
    if (filename === "CANVASS_TEMPLATE.xlsx") {
        // Must populate rows 8 to 14, and row 17 (repeating parts row), and col 5 & 6
        for (let r = 1; r <= 35; r++) {
            for (let c = 1; c <= 12; c++) {
                sheet.getCell(r, c).value = "";
            }
        }
        sheet.getCell("A1").value = "Canvass Excel Template";
        // Row 8 to 14 are shop header attributes
        sheet.getCell(8, 5).value = "SHOP 1";
        sheet.getCell(8, 6).value = "SHOP 2";
        sheet.getCell(9, 6).value = "{{_name2}}";
        sheet.getCell(10, 6).value = "{{_person2}}";
        sheet.getCell(11, 6).value = "{{_no2}}";
        sheet.getCell(12, 6).value = "{{_duration2}}";
        sheet.getCell(13, 6).value = "{{_warranty2}}";
        sheet.getCell(14, 6).value = "{{_terms2}}";
        
        // Repeating parts row is row 17
        sheet.getCell(17, 1).value = "1";
        sheet.getCell(17, 2).value = "{{items.description}} {{item}}";
        sheet.getCell(17, 3).value = "{{items.quantity}} {{QTY}}";
        sheet.getCell(17, 4).value = "{{items.unit}} {{UNIT}}";
        sheet.getCell(17, 5).value = "{{parts_shop1_price1}}";
        sheet.getCell(17, 6).value = "{{parts_shop2_price2}}";
        
        // Dynamic summary rows
        sheet.getCell(18, 5).value = "{{total_shop1}}";
        sheet.getCell(18, 6).value = "{{total_shop2}}";
        sheet.getCell(19, 5).value = "{{vat1}}";
        sheet.getCell(19, 6).value = "{{vat2}}";
        sheet.getCell(20, 5).value = "{{total_amount1}}";
        sheet.getCell(20, 6).value = "{{total_amount2}}";
    }

    const dest = "public/templates/" + filename;
    await workbook.xlsx.writeFile(dest);
    
    const stats = fs.statSync(dest);
    console.log("Created", filename, "size:", stats.size);
    
    // Verify
    try {
        execSync(`unzip -t ${dest}`);
        console.log("Verified", filename, "successfully!");
    } catch (e: any) {
        console.error("Verification failed for", filename, e.message);
    }
}

async function main() {
    try {
        if (!fs.existsSync("public/templates")) {
            fs.mkdirSync("public/templates", { recursive: true });
        }
        
        // Create Word Templates
        await createDocx("PO_TEMPLATE.docx");
        await createDocx("CANVASS_TEMPLATE.docx");
        await createDocx("RFS_TEMPLATE.docx");
        await createDocx("PIS_TEMPLATE.docx");
        
        // Create Excel Templates
        await createXlsx("PIS_TEMPLATE.xlsx");
        await createXlsx("RFS_TEMPLATE.xlsx");
        await createXlsx("CANVASS_TEMPLATE.xlsx");
        
        // Sync with dist/templates (used in prod builds)
        fs.mkdirSync("dist/templates", { recursive: true });
        fs.copyFileSync("public/templates/PO_TEMPLATE.docx", "dist/templates/PO_TEMPLATE.docx");
        fs.copyFileSync("public/templates/CANVASS_TEMPLATE.docx", "dist/templates/CANVASS_TEMPLATE.docx");
        fs.copyFileSync("public/templates/RFS_TEMPLATE.docx", "dist/templates/RFS_TEMPLATE.docx");
        fs.copyFileSync("public/templates/PIS_TEMPLATE.docx", "dist/templates/PIS_TEMPLATE.docx");
        
        fs.copyFileSync("public/templates/PIS_TEMPLATE.xlsx", "dist/templates/PIS_TEMPLATE.xlsx");
        fs.copyFileSync("public/templates/RFS_TEMPLATE.xlsx", "dist/templates/RFS_TEMPLATE.xlsx");
        fs.copyFileSync("public/templates/CANVASS_TEMPLATE.xlsx", "dist/templates/CANVASS_TEMPLATE.xlsx");
        
        console.log("All 7 templates created and synced successfully!");
    } catch(e) {
        console.error(e);
    }
}
main();
