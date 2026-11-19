import { createClient } from "@libsql/client";
import { createHash, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const allowedVisibility = new Set(["public", "assistant_only", "private"]);
const allowedSourceTypes = new Set(["manual", "web", "document"]);

const sourceColumns = `
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
  fetched_at TEXT`;

const selectSources = `
  SELECT source.*, document.original_name, document.mime_type, document.byte_size, document.page_count
  FROM knowledge_sources AS source
  LEFT JOIN knowledge_documents AS document ON document.id = source.document_id`;

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
    enabled: Boolean(Number(row.enabled)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    fetchedAt: row.fetched_at || ""
  };
}

function upsertStatement(item) {
  const contentHash = createHash("sha256").update(`${item.title}\n${item.content}\n${item.sourceUrl}`).digest("hex");
  return {
    sql: `
      INSERT INTO knowledge_sources
        (id, title, category, content, source_type, source_url, document_id, tags, visibility, enabled, content_hash, created_at, updated_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title, category = excluded.category, content = excluded.content,
        source_type = excluded.source_type, source_url = excluded.source_url, document_id = excluded.document_id,
        tags = excluded.tags, visibility = excluded.visibility, enabled = excluded.enabled,
        content_hash = excluded.content_hash, updated_at = excluded.updated_at, fetched_at = excluded.fetched_at`,
    args: [item.id, item.title, item.category, item.content, item.sourceType, item.sourceUrl || null, item.documentId || null,
      JSON.stringify(item.tags), item.visibility, item.enabled ? 1 : 0, contentHash,
      item.createdAt, item.updatedAt, item.fetchedAt || null]
  };
}

/**
 * Knowledge library, portal settings, and site assets, stored in libSQL.
 * Pass a Turso URL (libsql://...) and auth token for durable hosted storage,
 * or a local file path for development.
 */
export class KnowledgeStore {
  constructor(client, { remote = false } = {}) {
    this.client = client;
    this.remote = remote;
  }

  static async open({ url, path, authToken } = {}) {
    const remote = /^(libsql|https?|wss?):/i.test(String(url || ""));
    const client = createClient(remote ? { url, authToken } : { url: url || pathToFileURL(path).href });
    const store = new KnowledgeStore(client, { remote });
    await store.initialize();
    return store;
  }

  async initialize() {
    // Pragmas are connection-level niceties; hosted libSQL manages these itself.
    if (!this.remote) {
      await this.client.execute("PRAGMA journal_mode = WAL").catch(() => {});
      await this.client.execute("PRAGMA foreign_keys = ON");
    }
    await this.client.batch([
      `CREATE TABLE IF NOT EXISTS knowledge_documents (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        page_count INTEGER,
        content_hash TEXT NOT NULL UNIQUE,
        file_blob BLOB NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT`,
      `CREATE TABLE IF NOT EXISTS knowledge_sources (${sourceColumns}) STRICT`,
      `CREATE TABLE IF NOT EXISTS site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT`,
      `CREATE TABLE IF NOT EXISTS site_assets (
        name TEXT PRIMARY KEY,
        mime_type TEXT NOT NULL,
        data BLOB NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT`
    ], "write");
    await this.migrateDocumentSupport();
    await this.client.batch([
      "CREATE INDEX IF NOT EXISTS idx_knowledge_sources_enabled ON knowledge_sources(enabled, visibility)",
      "CREATE INDEX IF NOT EXISTS idx_knowledge_sources_document ON knowledge_sources(document_id)"
    ], "write");
    await this.seed();
  }

  async migrateDocumentSupport() {
    const columns = (await this.client.execute("PRAGMA table_info(knowledge_sources)")).rows.map((column) => column.name);
    if (columns.includes("document_id")) return;
    await this.client.batch([
      "ALTER TABLE knowledge_sources RENAME TO knowledge_sources_legacy",
      `CREATE TABLE knowledge_sources (${sourceColumns}) STRICT`,
      `INSERT INTO knowledge_sources
        (id, title, category, content, source_type, source_url, document_id, tags, visibility, enabled, content_hash, created_at, updated_at, fetched_at)
      SELECT id, title, category, content, source_type, source_url, NULL, tags, visibility, enabled, content_hash, created_at, updated_at, fetched_at
      FROM knowledge_sources_legacy`,
      "DROP TABLE knowledge_sources_legacy"
    ], "write");
  }

  async seed() {
    const count = Number((await this.client.execute("SELECT COUNT(*) AS count FROM knowledge_sources")).rows[0].count);
    if (count) return;
    await this.upsert({
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

  async list() {
    const result = await this.client.execute(`${selectSources} ORDER BY source.category COLLATE NOCASE, source.title COLLATE NOCASE`);
    return result.rows.map(rowToItem);
  }

  async get(id) {
    const result = await this.client.execute({ sql: `${selectSources} WHERE source.id = ?`, args: [clean(id, 100)] });
    return result.rows[0] ? rowToItem(result.rows[0]) : null;
  }

  async upsert(value) {
    const existing = value.id ? await this.get(value.id) : null;
    const item = normalizeItem(value, existing);
    await this.client.execute(upsertStatement(item));
    return this.get(item.id);
  }

  async replaceAll(values) {
    if (!Array.isArray(values) || values.length > 500) throw new Error("Knowledge entries must be a list of no more than 500 items.");
    const existing = new Map((await this.list()).map((item) => [item.id, item]));
    const items = values.map((value) => normalizeItem(value, value.id ? existing.get(clean(value.id, 100)) : null));
    await this.client.batch([
      "DELETE FROM knowledge_sources",
      ...items.map(upsertStatement),
      "DELETE FROM knowledge_documents WHERE id NOT IN (SELECT document_id FROM knowledge_sources WHERE document_id IS NOT NULL)"
    ], "write");
    return this.list();
  }

  async remove(id) {
    const item = await this.get(id);
    if (!item) return false;
    await this.client.batch([
      { sql: "DELETE FROM knowledge_sources WHERE id = ?", args: [item.id] },
      ...(item.documentId ? [{ sql: "DELETE FROM knowledge_documents WHERE id = ?", args: [item.documentId] }] : [])
    ], "write");
    return true;
  }

  async addDocument({ originalName, mimeType, buffer, text, pageCount, title, category, tags, visibility }) {
    const hash = createHash("sha256").update(buffer).digest("hex");
    let documentId = (await this.client.execute({ sql: "SELECT id FROM knowledge_documents WHERE content_hash = ?", args: [hash] })).rows[0]?.id;
    if (!documentId) {
      documentId = randomUUID();
      await this.client.execute({
        sql: `INSERT INTO knowledge_documents (id, original_name, mime_type, byte_size, page_count, content_hash, file_blob, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [documentId, clean(originalName, 240), clean(mimeType, 150), buffer.length, pageCount || null, hash, buffer, new Date().toISOString()]
      });
    }
    const existingSource = (await this.client.execute({ sql: "SELECT id FROM knowledge_sources WHERE document_id = ?", args: [documentId] })).rows[0];
    return this.upsert({
      id: existingSource?.id,
      title: clean(title, 300) || clean(originalName, 240).replace(/\.[^.]+$/, ""),
      category: clean(category, 100) || "Documents",
      content: text,
      sourceType: "document",
      documentId,
      tags,
      visibility: allowedVisibility.has(visibility) ? visibility : "assistant_only",
      enabled: true
    });
  }

  async getSetting(key) {
    const row = (await this.client.execute({ sql: "SELECT value FROM site_settings WHERE key = ?", args: [key] })).rows[0];
    return row ? JSON.parse(row.value) : null;
  }

  async setSetting(key, value) {
    await this.client.execute({
      sql: `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: [key, JSON.stringify(value), new Date().toISOString()]
    });
  }

  async getAsset(name) {
    const row = (await this.client.execute({ sql: "SELECT mime_type, data, updated_at FROM site_assets WHERE name = ?", args: [name] })).rows[0];
    return row ? { mimeType: row.mime_type, data: Buffer.from(row.data), updatedAt: row.updated_at } : null;
  }

  async putAsset(name, mimeType, data) {
    await this.client.execute({
      sql: `INSERT INTO site_assets (name, mime_type, data, updated_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET mime_type = excluded.mime_type, data = excluded.data, updated_at = excluded.updated_at`,
      args: [name, mimeType, data, new Date().toISOString()]
    });
  }

  async health() {
    try {
      return Number((await this.client.execute("SELECT 1 AS ok")).rows[0].ok) === 1;
    } catch {
      return false;
    }
  }

  close() {
    this.client.close();
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
      title: `${item.category} · ${item.title}`,
      text: piece,
      metadata: {
        section: "knowledge",
        category: item.category,
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
