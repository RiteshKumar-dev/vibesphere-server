import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

export async function splitPdfByPages(pdfBuffer, outputDir, prefix = "page") {
  // Ensure the output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  const pagePaths = [];

  for (let i = 0; i < totalPages; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);

    const pdfBytes = await newPdf.save();
    const fileName = `${prefix}-${i + 1}.pdf`;
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, pdfBytes);
    pagePaths.push(filePath);
  }

  return pagePaths;
}
