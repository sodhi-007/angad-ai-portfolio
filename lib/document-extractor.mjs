import { extname, basename } from "node:path";
import mammoth from "mammoth";

const types = new Map([
  [".pdf", "application/pdf"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".txt", "text/plain"]
]);

function cleanText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/^--\s*\d+\s+of\s+\d+\s*--$/gim, "")
    .replace(/\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g, "[phone number removed]")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, 500_000);
}

export function validateDocument(buffer, originalName, suppliedMimeType = "") {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error("The uploaded document is empty.");
  if (buffer.length > 8_000_000) throw new Error("Documents must be smaller than 8 MB.");
  const name = basename(String(originalName || "document")).replace(/[\u0000-\u001f]/g, "").slice(0, 240);
  const extension = extname(name).toLowerCase();
  const mimeType = types.get(extension);
  if (!mimeType) throw new Error("Upload a PDF, DOCX, or plain-text file.");
  if (suppliedMimeType && suppliedMimeType !== "application/octet-stream" && suppliedMimeType !== mimeType) {
    throw new Error("The file type does not match its filename.");
  }
  if (extension === ".pdf" && buffer.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("The file is not a valid PDF.");
  if (extension === ".docx" && buffer.subarray(0, 2).toString("ascii") !== "PK") throw new Error("The file is not a valid DOCX document.");
  return { name, extension, mimeType };
}

export async function extractDocument(buffer, originalName, suppliedMimeType = "") {
  const file = validateDocument(buffer, originalName, suppliedMimeType);
  let text = "";
  let pageCount = null;

  if (file.extension === ".txt") text = buffer.toString("utf8");
  if (file.extension === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }
  if (file.extension === ".pdf") {
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      text = result.text;
      pageCount = Number(result.total) || null;
    } finally {
      await parser.destroy();
    }
  }

  text = cleanText(text);
  if (text.length < 40) {
    throw new Error(file.extension === ".pdf"
      ? "This PDF contains too little selectable text. A scanned PDF needs OCR before it can be indexed."
      : "The document contains too little readable text to index.");
  }
  return { ...file, text, pageCount };
}
