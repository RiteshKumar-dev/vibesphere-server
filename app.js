import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs/promises";
import path from "path";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { splitPdfByPages } from "./utils/pdfUtils.js";

const app = express();
const PORT = 5000;

// Ensure 'uploads' directory exists
const uploadsDir = path.join(process.cwd(), "uploads");
await fs.mkdir(uploadsDir, { recursive: true });

app.use(express.json());
app.use(
  cors({
    origin: ["https://tayyari-ai.vercel.app", "http://localhost:3000"],
    credentials: true,
  })
);

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
const upload = multer({ storage });

//health check route
app.get("/api/v1/health", (req, res) => {
  res.status(200).json({ message: "Server is running" });
});

// Upload route
app.post("/api/v1/upload/pdf", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const {
    jobDescription,
    jobPosition,
    interviewTypes,
    difficultyLevel,
    interviewDuration,
    userId,
  } = req.body;
  // Validate required fields
  if (
    !jobDescription ||
    !jobPosition ||
    !interviewTypes ||
    !userId ||
    !interviewDuration
  ) {
    return res.status(400).json({
      message: "Missing one or more required fields.",
    });
  }

  if (!["Easy", "Medium", "Hard"].includes(difficultyLevel)) {
    return res.status(400).json({
      message: "Invalid difficulty level. Allowed values: Easy, Medium, Hard.",
    });
  }

  let parsedInterviewTypes;
  try {
    parsedInterviewTypes = JSON.parse(interviewTypes);
    if (!Array.isArray(parsedInterviewTypes)) {
      throw new Error("Not an array");
    }
  } catch (e) {
    return res
      .status(400)
      .json({ message: "Interview types must be a valid array." });
  }

  const filePath = req.file.path;

  try {
    const pdfBuffer = await fs.readFile(filePath);
    const pagePaths = await splitPdfByPages(pdfBuffer, "uploads");

    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    const fullText = docs.map((doc) => doc.pageContent).join("\n");

    // Delete the original PDF after processing
    await fs.unlink(filePath);

    return res.status(200).json({
      message: "PDF processed successfully.",
      extractedText: fullText,
      jobDescription,
      jobPosition,
      interviewTypes: parsedInterviewTypes,
      userId,
      difficultyLevel,
      interviewDuration,
      totalPages: pagePaths.length,
      pageFiles: pagePaths,
    });
  } catch (err) {
    console.error("❌ Error processing PDF:", err.message);
    return res.status(500).json({
      message: "Failed to process PDF.",
      error: err.message,
    });
  }
});

app.post("/api/v1/upload/apply", upload.single("resume"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const { jobTitle } = req.body;

  if (!jobTitle) {
    return res.status(400).json({ message: "Missing job title." });
  }
  const filePath = req.file.path;

  try {
    const pdfBuffer = await fs.readFile(filePath);
    const pagePaths = await splitPdfByPages(pdfBuffer, "uploads");

    const loader = new PDFLoader(filePath);
    const docs = await loader.load();
    const fullText = docs.map((doc) => doc.pageContent).join("\n");

    await fs.unlink(filePath); // Delete original after processing

    return res.status(200).json({
      message: "Application received and resume processed.",
      // jobTitle,
      // extractedText: fullText,
      // totalPages: pagePaths.length,
      // pageFiles: pagePaths,
    });
  } catch (err) {
    console.error("❌ Error processing resume:", err.message);
    return res.status(500).json({
      message: "Failed to process resume.",
      error: err.message,
    });
  }
});

app.post(
  "/api/v1/extract/resume-text",
  upload.single("resume"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded." });
    }

    const filePath = req.file.path;
    try {
      const loader = new PDFLoader(filePath);
      const docs = await loader.load();
      const fullText = docs.map((doc) => doc.pageContent).join("\n");
      await fs.unlink(filePath); // remove uploaded file after extraction

      return res.status(200).json({
        message: "Resume text extracted successfully.",
        extractedText: fullText,
      });
    } catch (err) {
      console.error("❌ Error extracting resume text:", err.message);
      return res.status(500).json({
        message: "Failed to extract resume text.",
        error: err.message,
      });
    }
  }
);

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
