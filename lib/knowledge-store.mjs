import { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";

const allowedVisibility = new Set(["public", "assistant_only", "private"]);
const allowedSourceTypes = new Set(["manual", "web"]);

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
    content: clean(value.content, 60_000),
    sourceType,
    sourceUrl,
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
      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        source_type TEXT NOT NULL CHECK (source_type IN ('manual', 'web')),
        source_url TEXT,
        tags TEXT NOT NULL DEFAULT '[]',
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'assistant_only', 'private')),
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        content_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        fetched_at TEXT
      ) STRICT;
    `);
    this.seed();
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
    return this.database.prepare("SELECT * FROM knowledge_sources ORDER BY category COLLATE NOCASE, title COLLATE NOCASE").all().map(rowToItem);
  }

  get(id) {
    const row = this.database.prepare("SELECT * FROM knowledge_sources WHERE id = ?").get(clean(id, 100));
    return row ? rowToItem(row) : null;
  }

  upsert(value) {
    const existing = value.id ? this.get(value.id) : null;
    const item = normalizeItem(value, existing);
    const contentHash = createHash("sha256").update(`${item.title}\n${item.content}\n${item.sourceUrl}`).digest("hex");
    this.database.prepare(`
      INSERT INTO knowledge_sources
        (id, title, category, content, source_type, source_url, tags, visibility, enabled, content_hash, created_at, updated_at, fetched_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        category = excluded.category,
        content = excluded.content,
        source_type = excluded.source_type,
        source_url = excluded.source_url,
        tags = excluded.tags,
        visibility = excluded.visibility,
        enabled = excluded.enabled,
        content_hash = excluded.content_hash,
        updated_at = excluded.updated_at,
        fetched_at = excluded.fetched_at
    `).run(item.id, item.title, item.category, item.content, item.sourceType, item.sourceUrl || null,
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
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
    return this.list();
  }

  remove(id) {
    return this.database.prepare("DELETE FROM knowledge_sources WHERE id = ?").run(clean(id, 100)).changes > 0;
  }
}

export function knowledgeChunks(items) {
  const chunks = [];
  items.filter((item) => item.enabled && item.visibility !== "private").forEach((item) => {
    const sentences = item.content.match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((part) => part.trim()).filter(Boolean) || [item.content];
    const pieces = [];
    let current = "";
    sentences.forEach((sentence) => {
      if (current && `${current} ${sentence}`.length > 1_400) {
        pieces.push(current);
        current = sentence;
      } else {
        current = `${current} ${sentence}`.trim();
      }
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
        visibility: item.visibility,
        tags: item.tags
      }
    }));
  });
  return chunks;
}
