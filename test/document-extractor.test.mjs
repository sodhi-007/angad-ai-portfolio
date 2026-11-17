import test from "node:test";
import assert from "node:assert/strict";
import { extractDocument, validateDocument } from "../lib/document-extractor.mjs";

test("extracts and normalizes plain-text knowledge documents while redacting phone numbers", async () => {
  const buffer = Buffer.from("Angad builds production RAG systems. Call +1 (579) 985-7367.\n\nThey use retrieved evidence to answer questions accurately.");
  const result = await extractDocument(buffer, "knowledge.txt", "text/plain");
  assert.equal(result.mimeType, "text/plain");
  assert.match(result.text, /production RAG systems/);
  assert.match(result.text, /\[phone number removed\]/);
  assert.doesNotMatch(result.text, /985-7367/);
});

test("rejects mismatched and invalid document formats", () => {
  assert.throws(() => validateDocument(Buffer.from("not a pdf"), "resume.pdf", "application/pdf"), /valid PDF/);
  assert.throws(() => validateDocument(Buffer.from("plain text"), "resume.exe", "application/octet-stream"), /PDF, DOCX, or plain-text/);
});
