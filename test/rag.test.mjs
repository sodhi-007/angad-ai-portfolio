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

test("uses a concise extractive fallback for facts found in an uploaded document", async () => {
  const extraChunks = knowledgeChunks([{
    id: "resume",
    title: "Angad Resume",
    category: "Resume",
    content: "AI and LLM tools: LangChain, OpenAI embeddings, Claude Code, and ChromaDB.\nCloud tools: Azure Container Apps and Docker.",
    sourceType: "document",
    sourceUrl: "",
    documentId: "document-1",
    document: { name: "Resume.pdf" },
    tags: ["resume"],
    visibility: "assistant_only",
    enabled: true
  }]);
  const index = await buildRagIndex(portfolio, { extraChunks });
  const results = await retrieve("Did Angad use Claude Code?", index, { limit: 3 });
  const answer = localRagAnswer("Did Angad use Claude Code?", results);
  assert.match(answer, /^Yes\./);
  assert.match(answer, /Claude Code/);
  assert.ok(answer.length < 180);
});

test("company answers explain the company, then the role and contributions without repetition", async () => {
  const extraChunks = knowledgeChunks([{
    id: "jio-about", title: "About Reliance Jio", category: "Organizations",
    content: "Reliance Jio is an Indian telecommunications company.",
    sourceType: "manual", tags: ["Jio"], visibility: "assistant_only", enabled: true
  }]);
  const index = await buildRagIndex(portfolio, { extraChunks });
  for (const question of ["What is Reliance Jio?", "Tell me about Jio.", "What did Angad do at Reliance?"]) {
    const results = await retrieve(question, index);
    const answer = localRagAnswer(question, results);
    assert.match(answer, /^Reliance Jio is an Indian telecommunications company\. Angad worked as/);
    assert.equal(answer.match(/Deputy Manager/g)?.length, 1);
    assert.equal(answer.match(/March 2023/g)?.length, 1);
    assert.match(answer, /He (?:led|ran|authored)/);
    assert.doesNotMatch(answer, /CIMA|IBM/);
  }
});

test("missing company descriptions are acknowledged instead of invented", async () => {
  const index = await buildRagIndex(portfolio);
  const results = await retrieve("What is Reliance Jio?", index);
  const answer = localRagAnswer("What is Reliance Jio?", results);
  assert.match(answer, /don’t have a general company description/);
  assert.match(answer, /Angad worked as a Deputy Manager/);
  assert.doesNotMatch(answer, /telecommunications/);
});

test("an unrelated knowledge entry is not used as a company definition", async () => {
  const extraChunks = knowledgeChunks([{
    id: "skills", title: "Reliance Jio skills", category: "Skills",
    content: "Angad is a cybersecurity professional. At Jio, he used security tools.",
    sourceType: "manual", visibility: "assistant_only", enabled: true
  }]);
  const index = await buildRagIndex(portfolio, { extraChunks });
  const results = await retrieve("What is Jio?", index);
  assert.match(localRagAnswer("What is Jio?", results), /^I don’t have a general company description/);
});

test("specific company questions still answer the requested detail", async () => {
  const index = await buildRagIndex(portfolio);
  const question = "Hey, which database stored the engineering document embeddings at CIMA?";
  const results = await retrieve(question, index);
  assert.match(localRagAnswer(question, results), /^Angad used ChromaDB/);
});
