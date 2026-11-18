import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRagIndex, chunkPortfolio, localRagAnswer, resolveChatQuery, retrieve } from "../lib/rag.mjs";
import { smallTalkReply } from "../lib/assistant-behavior.mjs";
import { KnowledgeStore, knowledgeChunks } from "../lib/knowledge-store.mjs";

const portfolio = JSON.parse(await readFile(new URL("../data/portfolio.json", import.meta.url), "utf8"));
const noisyDocument = {
  id: "outreach-notes",
  title: "CIMA+ quick reference notes",
  category: "Career notes",
  content: "Outreach always includes context and stays polite. Use Angad Singh Sodhi on formal documents. Quick Reference Numbers: CIMA+ RAG users 700+ employees CIMA+ manual search time cut 60% CIMA+ documents indexed 10,000+ pages CIMA+ retrieval latency CIMA+ concurrent users CIMA+ onboarding CIMA+ project metrics. Jio servers and devices appear elsewhere in these notes.",
  sourceType: "document",
  documentId: "outreach-notes-document",
  document: { name: "Career notes.pdf" },
  visibility: "assistant_only",
  enabled: true
};

async function companyIndex({ includeCompanySource = true } = {}) {
  const entries = [noisyDocument];
  if (includeCompanySource) {
    const store = new KnowledgeStore(":memory:");
    try {
      entries.push(...store.list());
    } finally {
      store.database.close();
    }
  }
  return buildRagIndex(portfolio, { extraChunks: knowledgeChunks(entries) });
}

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
  const index = await companyIndex();
  const question = "what is cima+";
  const results = await retrieve(question, index, { limit: 4 });
  const answer = localRagAnswer(question, results);
  assert.match(answer, /^CIMA\+.*Canadian.*engineering/i);
  assert.match(answer, /Angad/i);
  assert.match(answer, /intern/i);
  assert.match(answer, /700\+|60%|10,000\+/);
  assert.doesNotMatch(answer, /Outreach|formal documents|Quick Reference|Jio/i);
  const sentences = answer.match(/[.!?](?:\s|$)/g) || [];
  assert.ok(sentences.length >= 3 && sentences.length <= 5, answer);
  assert.ok(results.some((result) => result.metadata.sourceUrl === "https://www.cima.ca/en/about-us/"));
});

test("an uploaded document cannot stand in for a missing company overview", async () => {
  const index = await companyIndex({ includeCompanySource: false });
  const question = "What is CIMA+?";
  const results = await retrieve(question, index, { limit: 4 });
  const answer = localRagAnswer(question, results);
  assert.match(answer, /(?:company|portfolio|source|information)/i);
  assert.match(answer, /Angad.*(?:intern|internship)/i);
  assert.doesNotMatch(answer, /Outreach|formal documents|Quick Reference|Canadian consulting engineering/i);
});

test("summarizes Angad's work at CIMA+ without repeating the role", async () => {
  const index = await companyIndex();
  const question = "What did Angad do at CIMA+?";
  const answer = localRagAnswer(question, await retrieve(question, index, { limit: 4 }));
  assert.match(answer, /Angad/i);
  assert.equal((answer.match(/\bintern(?:ship)?\b/gi) || []).length, 1, answer);
  assert.match(answer, /700\+|60%|10,000\+/);
  assert.doesNotMatch(answer, /Outreach|formal documents|Quick Reference/i);
});

test("uses the selected French language for a CIMA+ company answer", async () => {
  const index = await companyIndex();
  const question = "Qu'est-ce que CIMA+?";
  const results = await retrieve(question, index, { limit: 4 });
  const answer = localRagAnswer(question, results, "fr");
  assert.match(answer, /génie-conseil|génie conseil|ingénierie-conseil|conseil en ingénierie/i);
  assert.match(answer, /stage|stagiaire/i);
  assert.match(answer, /(?:700|60|10[\s\u00a0\u202f]000)/);
  assert.doesNotMatch(answer, /Canadian consulting|\bintern\b|Outreach|Quick Reference/i);
});

test("company follow-ups use the previous topic without repeating the overview", async () => {
  const index = await companyIndex();
  const question = "What did he do there?";
  const history = [
    { role: "user", content: "What is CIMA+?" },
    { role: "assistant", content: "CIMA+ is a Canadian consulting engineering firm." }
  ];
  const query = resolveChatQuery(question, history, index);
  assert.match(query, /CIMA\+/i);
  const results = await retrieve(query, index, { limit: 4 });
  const answer = localRagAnswer(query, results, "en", { followUp: true });
  assert.match(answer, /700\+|60%|10,000\+/);
  assert.doesNotMatch(answer, /Canadian consulting engineering|Outreach|Quick Reference/i);
});

test("a company follow-up ranks contributions the previous reply did not cover", async () => {
  const index = await companyIndex();
  const firstQuestion = "What is CIMA+?";
  const previousAnswer = localRagAnswer(firstQuestion, await retrieve(firstQuestion, index));
  const message = "Tell me more";
  const query = resolveChatQuery(message, [{ role: "user", content: firstQuestion }], index);
  const evidence = await retrieve(query, index, { followUp: true, previousAnswer });
  const answer = localRagAnswer(query, evidence, "en", { followUp: true });
  assert.match(answer, /FastAPI|Open WebUI/);
  assert.doesNotMatch(answer, /consulting engineering|AI intern|700\+|10,000\+/i);
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
    assert.match(answer, /He (?:led|ran|authored|mitigated)/);
    assert.doesNotMatch(answer, /CIMA|IBM/);
  }
});

test("missing company descriptions are acknowledged instead of invented", async () => {
  const index = await buildRagIndex(portfolio);
  const results = await retrieve("What is Reliance Jio?", index);
  const answer = localRagAnswer("What is Reliance Jio?", results);
  assert.match(answer, /don.t have a general company description/);
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
  assert.match(localRagAnswer("What is Jio?", results), /^I don.t have a general company description/);
});

test("specific company questions still answer the requested detail", async () => {
  const index = await buildRagIndex(portfolio);
  const question = "Hey, which database stored the engineering document embeddings at CIMA?";
  const results = await retrieve(question, index);
  assert.match(localRagAnswer(question, results), /^Angad used ChromaDB/);
});

test("answers greetings without consulting uploaded notes", () => {
  const notes = [{ id: "knowledge-notes", text: "Apply anyway (some referrers can't refer once he has applied).", score: 5 }];
  assert.match(localRagAnswer("yo", notes), /Angad.s AI assistant/);
  assert.equal(smallTalkReply("What can Angad do with FastAPI?"), null);
});

test("Kubernetes query retrieves the Skills · MLOps chunk", async () => {
  const index = await buildRagIndex(portfolio);
  const results = await retrieve("Does Angad have hands-on Kubernetes experience?", index, { limit: 5 });
  const skillsChunk = results.find((r) => r.id.startsWith("skills-") && /kubernetes/i.test(r.text));
  assert.ok(skillsChunk, `Expected a skills chunk with Kubernetes in top 5; got: ${results.map((r) => r.id).join(", ")}`);
});

test("RRF deduplicates results by chunk id", async () => {
  const index = await buildRagIndex(portfolio);
  const results = await retrieve("What technologies did Angad use?", index, { limit: 5 });
  const ids = results.map((r) => r.id);
  assert.equal(ids.length, new Set(ids).size, `Duplicate ids found: ${ids.join(", ")}`);
});

test("RRF scoring produces valid positive scores for all results", async () => {
  const index = await buildRagIndex(portfolio);
  const results = await retrieve("bilingual RAG agent CIMA+", index, { limit: 5 });
  assert.ok(results.length > 0, "Expected at least one result");
  for (const r of results) {
    assert.ok(typeof r.score === "number" && r.score > 0, `Invalid score ${r.score} for chunk ${r.id}`);
  }
});
