#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { loadPdfReference } from "./eval-reference.mjs";
import { evalCases as cases } from "../lib/eval-cases.mjs";
import { hostedEvalClient } from "./eval-host.mjs";

const PORT = process.env.PORT || 4173;
const BASE = process.env.EVAL_BASE_URL || `http://127.0.0.1:${PORT}`;
const OUTPUT = resolve(process.env.EVAL_OUTPUT || "artifacts/eval/results.json");
const DELAY_MS = Number(process.env.EVAL_DELAY_MS || 3200);
const TRACE_DIR = process.env.EVAL_TRACE_DIR;
const HOSTED = Boolean(process.env.RAG_EVAL_TOKEN);

async function readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let sources = [];
  let mode = "";
  let error = "";
  let trace = null;
  let finished = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      try {
        const parsed = JSON.parse(trimmed.slice(6));
        if (parsed.token) answer += parsed.token;
        if (parsed.sources) { sources = parsed.sources; mode = parsed.mode || "ai"; }
        if (parsed.trace) trace = parsed.trace;
        if (parsed.done) finished = true;
        if (parsed.error) {
          error = parsed.error;
          answer = `[ERROR] ${parsed.error}`;
          mode = "error";
        }
      } catch { /* skip */ }
    }
  }
  if (!error && (!finished || !answer.trim())) error = "Incomplete streamed response.";
  return { answer, sources, trace, mode: error ? "error" : mode || "ai", error: error || null };
}

async function runCase(testCase, hosted) {
  const start = Date.now();
  const traceId = TRACE_DIR ? randomUUID() : null;
  const response = hosted ? await hosted.request("/api/eval/chat", {
    method: "POST",
    data: { caseName: testCase.name, previousAnswer: testCase.history.at(-1)?.content }
  }) : await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(traceId ? { "x-portfolio-eval-id": traceId } : {})
    },
    body: JSON.stringify({ message: testCase.message, history: testCase.history, language: testCase.language })
  });
  const contentType = response.headers.get("content-type") || "";
  let result;
  if (contentType.includes("text/event-stream")) {
    result = await readSSE(response);
  } else {
    const data = await response.json();
    if (data.error || !response.ok) {
      const error = data.error || `HTTP ${response.status}`;
      result = { answer: `[ERROR] ${error}`, sources: [], mode: "error", error };
    } else {
      result = { answer: data.answer || "", sources: data.sources || [], mode: data.mode || "retrieval", trace: data.trace };
    }
  }
  const latency = Date.now() - start;
  let trace = result.trace ?? null;
  if (traceId) {
    const path = join(TRACE_DIR, `${traceId}.json`);
    try {
      trace = JSON.parse(await readFile(path, "utf8"));
      await unlink(path);
    } catch (error) {
      if (error.code !== "ENOENT" || !result.error) throw error.code === "ENOENT"
        ? new Error("Context trace missing. Start the local server with the same EVAL_TRACE_DIR.")
        : error;
    }
  }
  if (hosted && !result.error && (typeof trace?.query !== "string" || !Array.isArray(trace?.chunks))) {
    throw new Error("The hosted response did not include its retrieval trace.");
  }
  if (hosted && !result.error && !result.answer.trim()) throw new Error("The hosted response had no answer.");
  return { ...result, latency, trace };
}

async function main() {
  if (HOSTED && TRACE_DIR) throw new Error("Choose either hosted or local evaluation capture.");
  if (HOSTED && !process.env.EVAL_BASE_URL) throw new Error("Set EVAL_BASE_URL for hosted evaluation.");
  const hosted = HOSTED ? hostedEvalClient() : null;
  if (TRACE_DIR && !["127.0.0.1", "[::1]", "localhost"].includes(new URL(BASE).hostname)) {
    throw new Error("EVAL_TRACE_DIR requires a local evaluation server.");
  }
  const reference = TRACE_DIR || hosted ? await loadPdfReference() : null;
  // Check server is running
  let healthData;
  try {
    if (hosted) healthData = await hosted.waitForDeployment();
    else {
      const health = await fetch(`${BASE}/api/health`);
      if (!health.ok) throw new Error(`Health check returned ${health.status}`);
      healthData = await health.json();
    }
    console.log(`Server OK: chatMode=${healthData.chatMode} retrievalMode=${healthData.retrievalMode} chunks=${healthData.chunks}`);
  } catch (error) {
    console.error(`Server not reachable at ${BASE}: ${error.message}`);
    process.exit(1);
  }

  const results = new Map();
  let failed = false;

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  for (const testCase of cases) {
    // Build history from a previous case if needed
    if (testCase.after) {
      const prev = results.get(testCase.after);
      if (prev && !prev.error) {
        const prevCase = cases.find((c) => c.name === testCase.after);
        testCase.history = [
          { role: "user", content: prevCase.message },
          { role: "assistant", content: hosted ? prev.answer.slice(0, 1200) : prev.answer }
        ];
      }
    }

    try {
      const result = await runCase(testCase, hosted);
      results.set(testCase.name, result);
      if (result.mode === "error" || result.error) failed = true;
      const answer = result.answer || "(empty)";
      const sourceTitles = (result.sources || []).map((s) => s.title).join(", ").slice(0, 100);
      console.log(`\n--- ${testCase.name} ---`);
      console.log(`  query:   ${testCase.message}`);
      console.log(`  latency: ${result.latency}ms`);
      console.log(`  mode:    ${result.mode}`);
      if (hosted) {
        console.log(result.error ? `  error:   ${result.error}` : `  chunks:  ${result.trace.chunks.length}`);
      } else if (testCase.fullAnswer) {
        console.log(`  answer:\n${answer.split("\n").map((l) => `    ${l}`).join("\n")}`);
      } else {
        console.log(`  answer:  ${answer.replace(/\n/g, " ")}`);
      }
      if (!hosted) console.log(`  sources: ${sourceTitles || "(none)"}`);
    } catch (error) {
      console.error(`\n--- ${testCase.name} --- ERROR: ${error.message}`);
      results.set(testCase.name, { answer: "", sources: [], mode: "error", latency: null, error: error.message });
      failed = true;
    }
    if (hosted && failed) break;
    if (Number.isFinite(DELAY_MS) && DELAY_MS > 0) await delay(DELAY_MS);
  }

  console.log("\n=== Summary ===");
  console.log(`Ran ${results.size}/${cases.length} cases`);
  for (const [name, result] of results) {
    const answer = result.answer || "(empty)";
    const preview = hosted ? "" : `  ${answer.slice(0, 80).replace(/\n/g, " ")}${answer.length > 80 ? "..." : ""}`;
    console.log(`  ${name.padEnd(20)} ${String(result.latency ?? "-").padStart(6)}ms  ${result.mode.padEnd(10)}${preview}`);
  }

  const output = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE,
    server: healthData,
    ...(reference ? { referencePdf: { name: reference.name, sha256: reference.sha256, pageCount: reference.pageCount } } : {}),
    cases: cases.map((testCase) => {
      const result = results.get(testCase.name) || {};
      return {
        name: testCase.name,
        kind: testCase.kind,
        question: testCase.message,
        language: testCase.language,
        expectation: testCase.expectation,
        after: testCase.after || null,
        ...(reference ? {
          history: testCase.history,
          retrievalQuery: result.trace?.query ?? null,
          retrievedContext: result.trace?.chunks ?? null,
          referenceFacts: reference.factsByCase[testCase.name] || []
        } : {}),
        response: result.answer || "",
        sources: result.sources || [],
        mode: result.mode || "error",
        latencyMs: result.latency ?? null,
        error: result.error || null
      };
    })
  };
  await mkdir(dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  console.log(`\nSaved evaluation dataset to ${OUTPUT}`);

  if (failed) process.exit(1);
}

main().catch((error) => {
  console.error(`Evaluation failed: ${error.message}`);
  process.exitCode = 1;
});
