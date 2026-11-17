import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
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
