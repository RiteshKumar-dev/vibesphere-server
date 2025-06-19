import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { PDFDocument } from "pdf-lib";
import path from "path";

const app = express();
app.use(cors());

// Multer disk storage setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.originalname.replace(/\.pdf$/, "") + "-" + uniqueSuffix + ".pdf"
    );
  },
});
const upload = multer({ storage: storage });

// Split PDF into pages
async function splitPdfByPages(pdfBuffer, outputDir) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();
  const pagePaths = [];

  for (let i = 0; i < totalPages; i++) {
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);
    const pdfBytes = await newPdf.save();
    const filePath = path.join(outputDir, `page-${i + 1}.pdf`);
    fs.writeFileSync(filePath, pdfBytes);
    pagePaths.push(filePath);
  }

  return pagePaths;
}

app.post("/api/v1/upload/pdf", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const filePath = req.file.path;

  try {
    // Step 1: Split PDF
    const pagePaths = await splitPdfByPages(
      fs.readFileSync(filePath),
      "uploads"
    );
    console.log(`✅ PDF split into ${pagePaths.length} pages`);

    // Step 2: Load & Extract Text using LangChain
    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    const fullText = docs.map((doc) => doc.pageContent).join("\n");

    // Optional: Delete uploaded original file after processing
    fs.unlink(filePath, () => {});

    return res.status(200).json({
      message: "PDF processed successfully.",
      extractedText: fullText,
      totalPages: pagePaths.length,
      pageFiles: pagePaths, // You can filter or format paths if needed
    });
  } catch (err) {
    return res.status(500).json({
      message: "Failed to process PDF.",
      error: err.message,
    });
  }
});

app.listen(5000, () => {
  console.log("✅ Server running on port 5000");
});
