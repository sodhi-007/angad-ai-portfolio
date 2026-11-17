import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DatabaseSync } from "node:sqlite";
import { KnowledgeStore, knowledgeChunks } from "../lib/knowledge-store.mjs";

test("stores editable knowledge and seeds the official CIMA+ source", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-knowledge-"));
  try {
    const store = new KnowledgeStore(join(directory, "knowledge.sqlite"));
    const seeded = store.list();
    assert.equal(seeded.length, 1);
    assert.equal(seeded[0].title, "What is CIMA+?");
    assert.equal(seeded[0].sourceUrl, "https://www.cima.ca/en/about-us/");

    const note = store.upsert({
      title: "Preferred AI work",
      category: "Career",
      content: "Angad focuses on production RAG systems and applied AI engineering.",
      tags: ["AI", "RAG"],
      visibility: "assistant_only"
    });
    assert.equal(store.get(note.id).tags.length, 2);
    assert.equal(store.list().length, 2);
    assert.equal(store.health(), true);

    const document = store.addDocument({
      originalName: "career-notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("Angad builds reliable retrieval systems."),
      text: "Angad builds reliable retrieval systems with grounded evidence and measurable evaluations.",
      title: "Career notes",
      category: "Documents",
      tags: ["career"],
      visibility: "assistant_only"
    });
    assert.equal(document.sourceType, "document");
    assert.equal(document.document.name, "career-notes.txt");
    assert.equal(document.document.size, 40);

    const saved = store.replaceAll(store.list());
    assert.ok(saved.some((item) => item.document?.name === "career-notes.txt"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("retrieval chunks exclude disabled and private entries", () => {
  const entries = [
    { id: "public", title: "Public fact", category: "General", content: "This can be retrieved.", sourceType: "manual", sourceUrl: "", tags: [], visibility: "public", enabled: true },
    { id: "private", title: "Private fact", category: "General", content: "This must stay private.", sourceType: "manual", sourceUrl: "", tags: [], visibility: "private", enabled: true },
    { id: "disabled", title: "Disabled fact", category: "General", content: "This is disabled.", sourceType: "manual", sourceUrl: "", tags: [], visibility: "assistant_only", enabled: false }
  ];
  const chunks = knowledgeChunks(entries);
  assert.equal(chunks.length, 1);
  assert.match(chunks[0].text, /can be retrieved/);
});

test("migrates an existing knowledge database to document support", async () => {
  const directory = await mkdtemp(join(tmpdir(), "portfolio-knowledge-migration-"));
  const path = join(directory, "knowledge.sqlite");
  try {
    const legacy = new DatabaseSync(path);
    legacy.exec(`
      CREATE TABLE knowledge_sources (
        id TEXT PRIMARY KEY, title TEXT NOT NULL, category TEXT NOT NULL, content TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'web')), source_url TEXT,
        tags TEXT NOT NULL DEFAULT '[]', visibility TEXT NOT NULL, enabled INTEGER NOT NULL,
        content_hash TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, fetched_at TEXT
      ) STRICT;
      INSERT INTO knowledge_sources VALUES ('legacy', 'Legacy note', 'General', 'Existing knowledge remains available.', 'manual', NULL, '[]', 'assistant_only', 1, 'hash', '2026-01-01', '2026-01-01', NULL);
    `);
    legacy.close();
    const store = new KnowledgeStore(path);
    assert.equal(store.get("legacy").content, "Existing knowledge remains available.");
    const columns = store.database.prepare("PRAGMA table_info(knowledge_sources)").all().map((column) => column.name);
    assert.ok(columns.includes("document_id"));
    store.database.close();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
