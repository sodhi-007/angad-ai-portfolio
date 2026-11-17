import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRagIndex, chunkPortfolio, localRagAnswer, retrieve } from "../lib/rag.mjs";
import { knowledgeChunks } from "../lib/knowledge-store.mjs";

const portfolio = JSON.parse(await readFile(new URL("../data/portfolio.json", import.meta.url), "utf8"));

test("chunks editable portfolio content into retrieval evidence", () => {
  const chunks = chunkPortfolio(portfolio);
  assert.ok(chunks.length > 15);
  assert.ok(chunks.some((chunk) => /10,000\+ pages/.test(chunk.text)));
});

test("retrieves specific CIMA evidence instead of a fixed topic paragraph", async () => {
  const index = await buildRagIndex(portfolio);
  const question = "Which database stored the engineering document embeddings at CIMA?";
  const results = await retrieve(question, index, { limit: 3 });
  assert.match(results[0].text, /ChromaDB/i);
  assert.match(results[0].text, /10,000\+ pages/i);
  assert.match(localRagAnswer(question, results), /^Angad used ChromaDB/);
});

test("retrieves project-specific evidence", async () => {
  const index = await buildRagIndex(portfolio);
  const results = await retrieve("What did Angad build with Solidity?", index, { limit: 2 });
  assert.match(results[0].text, /crowdfunding/i);
});

test("answers total experience from retrieved evidence", async () => {
  const index = await buildRagIndex(portfolio);
  const question = "How much total professional experience does Angad have?";
  const results = await retrieve(question, index, { limit: 4 });
  assert.match(localRagAnswer(question, results), /2 years and 6 months/i);
});

test("answers organization definitions from the curated web knowledge library", async () => {
  const extraChunks = knowledgeChunks([{
    id: "cima",
    title: "What is CIMA+?",
    category: "Organizations",
    content: "CIMA+ is a Canadian consulting engineering firm that provides services across infrastructure, transportation, buildings, energy, and environmental disciplines.",
    sourceType: "web",
    sourceUrl: "https://www.cima.ca/en/about-us/",
    tags: ["CIMA+"],
    visibility: "assistant_only",
    enabled: true
  }]);
  const index = await buildRagIndex(portfolio, { extraChunks });
  const results = await retrieve("What is CIMA+?", index, { limit: 3 });
  const answer = localRagAnswer("What is CIMA+?", results);
  assert.match(answer, /Canadian consulting engineering firm/i);
  assert.equal(results.find((result) => result.id.startsWith("knowledge-"))?.metadata.sourceUrl, "https://www.cima.ca/en/about-us/");
});
