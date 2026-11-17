import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";

const allowedVisibility = new Set(["public", "assistant_only", "private"]);
const allowedSourceTypes = new Set(["manual", "web", "document"]);

function clean(value, maximum = 20_000) {
  return String(value ?? "").replace(/\r\n/g, "\n").trim().slice(0, maximum);
}

function normalizeTags(value) {
  const tags = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(tags.map((tag) => clean(tag, 80)).filter(Boolean))].slice(0, 20);
}

function normalizeItem(value = {}, existing = null) {
  const now = new Date().toISOString();
  const sourceUrl = clean(value.sourceUrl, 2_000);
  const sourceType = allowedSourceTypes.has(value.sourceType) ? value.sourceType : sourceUrl ? "web" : "manual";
  const visibility = allowedVisibility.has(value.visibility) ? value.visibility : "assistant_only";
  const item = {
    id: clean(value.id, 100) || randomUUID(),
    title: clean(value.title, 300),
    category: clean(value.category, 100) || "General",
    content: clean(value.content, 500_000),
    sourceType,
    sourceUrl,
    documentId: sourceType === "document" ? clean(value.documentId || existing?.documentId, 100) : "",
    tags: normalizeTags(value.tags),
    visibility,
    enabled: value.enabled !== false,
    createdAt: existing?.createdAt || clean(value.createdAt, 50) || now,
    updatedAt: now,
    fetchedAt: sourceType === "web" ? clean(value.fetchedAt, 50) || now : ""
  };
  if (!item.title) throw new Error("Knowledge title is required.");
  if (!item.content) throw new Error("Knowledge content is required.");
  if (item.sourceType === "web" && !item.sourceUrl) throw new Error("A web source requires a source URL.");
  if (item.sourceType === "document" && !item.documentId) throw new Error("A document source requires an uploaded file.");
  return item;
}

function rowToItem(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    content: row.content,
    sourceType: row.source_type,
    sourceUrl: row.source_url || "",
    documentId: row.document_id || "",
    document: row.document_id ? {
      id: row.document_id,
      name: row.original_name,
      mimeType: row.mime_type,
      size: Number(row.byte_size),
      pageCount: row.page_count == null ? null : Number(row.page_count)
    } : null,
    tags: JSON.parse(row.tags || "[]"),
    visibility: row.visibility,
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fetchedAt: row.fetched_at || ""
  };
}

export class KnowledgeStore {
  constructor(path) {
    this.database = new DatabaseSync(path);
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        page_count INTEGER,
        content_hash TEXT NOT NULL UNIQUE,
        file_blob BLOB NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'web', 'document')),
        source_url TEXT,
        document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'assistant_only', 'private')),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        fetched_at TEXT
      ) STRICT;
    `);
    this.migrateDocumentSupport();
    this.database.exec(`
      CREATE INDEX IF NOT EXISTS idx_knowledge_sources_enabled ON knowledge_sources(enabled, visibility);
      CREATE INDEX IF NOT EXISTS idx_knowledge_sources_document ON knowledge_sources(document_id);
    `);
    this.seed();
  }

  migrateDocumentSupport() {
    const columns = this.database.prepare("PRAGMA table_info(knowledge_sources)").all().map((column) => column.name);
    if (columns.includes("document_id")) return;
    this.database.exec(`
      BEGIN IMMEDIATE;
      ALTER TABLE knowledge_sources RENAME TO knowledge_sources_legacy;
      CREATE TABLE knowledge_sources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'web', 'document')),
        source_url TEXT,
        document_id TEXT REFERENCES knowledge_documents(id) ON DELETE SET NULL,
        tags TEXT NOT NULL DEFAULT '[]',
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'assistant_only', 'private')),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        fetched_at TEXT
      ) STRICT;
      INSERT INTO knowledge_sources
        (id, title, category, content, source_type, source_url, document_id, tags, visibility, enabled, content_hash, created_at, updated_at, fetched_at)
      SELECT id, title, category, content, source_type, source_url, NULL, tags, visibility, enabled, content_hash, created_at, updated_at, fetched_at
      FROM knowledge_sources_legacy;
      DROP TABLE knowledge_sources_legacy;
      COMMIT;
    `);
  }

  seed() {
    const count = this.database.prepare("SELECT COUNT(*) AS count FROM knowledge_sources").get().count;
    if (count) return;
    this.upsert({
      id: "official-cima-about",
      title: "What is CIMA+?",
      category: "Organizations",
      content: "CIMA+ is a Canadian consulting engineering firm founded in 1990. It provides services across energy and resources, infrastructure, transportation, buildings, project management, operational and digital technologies, and earth and environment. The company operates across Canada and is largely employee-owned.",
      sourceType: "web",
      sourceUrl: "https://www.cima.ca/en/about-us/",
      tags: ["CIMA+", "consulting engineering", "Canada", "employer"],
      visibility: "assistant_only",
      enabled: true
    });
  }

  list() {
    return this.database.prepare(`
      SELECT source.*, document.original_name, document.mime_type, document.byte_size, document.page_count
      FROM knowledge_sources AS source
      LEFT JOIN knowledge_documents AS document ON document.id = source.document_id
      ORDER BY source.category COLLATE NOCASE, source.title COLLATE NOCASE
    `).all().map(rowToItem);
  }

  get(id) {
    const row = this.database.prepare(`
      SELECT source.*, document.original_name, document.mime_type, document.byte_size, document.page_count
      FROM knowledge_sources AS source
      LEFT JOIN knowledge_documents AS document ON document.id = source.document_id
      WHERE source.id = ?
    `).get(clean(id, 100));
    return row ? rowToItem(row) : null;
  }

  upsert(value) {
    const existing = value.id ? this.get(value.id) : null;
    const item = normalizeItem(value, existing);
    const contentHash = createHash("sha256").update(`${item.title}\n${item.content}\n${item.sourceUrl}`).digest("hex");
    this.database.prepare(`
      INSERT INTO knowledge_sources
        (id, title, category, content, source_type, source_url, document_id, tags, visibility, enabled, content_hash, created_at, updated_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        content = excluded.content,
        source_type = excluded.source_type,
        source_url = excluded.source_url,
        document_id = excluded.document_id,
        tags = excluded.tags,
        visibility = excluded.visibility,
        enabled = excluded.enabled,
        content_hash = excluded.content_hash,
        updated_at = excluded.updated_at,
        fetched_at = excluded.fetched_at
    `).run(item.id, item.title, item.category, item.content, item.sourceType, item.sourceUrl || null, item.documentId || null,
      JSON.stringify(item.tags), item.visibility, item.enabled ? 1 : 0, contentHash,
      item.createdAt, item.updatedAt, item.fetchedAt || null);
    return this.get(item.id);
  }

  replaceAll(values) {
    if (!Array.isArray(values) || values.length > 500) throw new Error("Knowledge entries must be a list of no more than 500 items.");
    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.database.exec("DELETE FROM knowledge_sources");
      values.forEach((value) => this.upsert(value));
      this.database.exec("DELETE FROM knowledge_documents WHERE id NOT IN (SELECT document_id FROM knowledge_sources WHERE document_id IS NOT NULL)");
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.list();
  }

  remove(id) {
    const item = this.get(id);
    const removed = this.database.prepare("DELETE FROM knowledge_sources WHERE id = ?").run(clean(id, 100)).changes > 0;
    if (removed && item?.documentId) this.database.prepare("DELETE FROM knowledge_documents WHERE id = ?").run(item.documentId);
    return removed;
  }

  addDocument({ originalName, mimeType, buffer, text, pageCount, title, category, tags, visibility }) {
    const hash = createHash("sha256").update(buffer).digest("hex");
    let document = this.database.prepare("SELECT id FROM knowledge_documents WHERE content_hash = ?").get(hash);
    if (!document) {
      document = { id: randomUUID() };
      this.database.prepare(`
        INSERT INTO knowledge_documents (id, original_name, mime_type, byte_size, page_count, content_hash, file_blob, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(document.id, clean(originalName, 240), clean(mimeType, 150), buffer.length, pageCount || null, hash, buffer, new Date().toISOString());
    }
    const existingSource = this.database.prepare("SELECT id FROM knowledge_sources WHERE document_id = ?").get(document.id);
    return this.upsert({
      id: existingSource?.id,
      title: clean(title, 300) || clean(originalName, 240).replace(/\.[^.]+$/, ""),
      category: clean(category, 100) || "Documents",
      content: text,
      sourceType: "document",
      documentId: document.id,
      tags,
      visibility: allowedVisibility.has(visibility) ? visibility : "assistant_only",
      enabled: true
    });
  }

  health() {
    return this.database.prepare("SELECT 1 AS ok").get().ok === 1;
  }
}

export function knowledgeChunks(items) {
  const chunks = [];
  items.filter((item) => item.enabled && item.visibility !== "private").forEach((item) => {
    const units = item.content.split(/\n+/).flatMap((line) => line.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [])
      .map((part) => part.trim()).filter(Boolean);
    const pieces = [];
    let current = "";
    units.forEach((unit) => {
      const segments = unit.length > 900 ? unit.match(/.{1,900}(?:\s|$)/g)?.map((part) => part.trim()).filter(Boolean) || [unit] : [unit];
      segments.forEach((segment) => {
        if (current && `${current}\n${segment}`.length > 900) {
          pieces.push(current);
          current = segment;
        } else {
          current = `${current}\n${segment}`.trim();
        }
      });
    });
    if (current) pieces.push(current);
    pieces.forEach((piece, chunkIndex) => chunks.push({
      id: `knowledge-${item.id}-${chunkIndex}`,
      title: `${item.category} — ${item.title}`,
      text: piece,
      metadata: {
        section: "knowledge",
        knowledgeId: item.id,
        chunkIndex,
        sourceType: item.sourceType,
        sourceUrl: item.sourceUrl,
        documentName: item.document?.name || "",
        visibility: item.visibility,
        tags: item.tags
      }
    }));
  });
  return chunks;
}
