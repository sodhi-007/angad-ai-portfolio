import { createServer } from "node:http";
import { readFile, rename, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { buildRagIndex, localRagAnswer, retrieve } from "./lib/rag.mjs";
import { KnowledgeStore, knowledgeChunks } from "./lib/knowledge-store.mjs";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = join(root, "public");
const dataFile = process.env.PORTFOLIO_DATA_FILE || join(root, "data", "portfolio.json");
const knowledgeDatabaseFile = process.env.KNOWLEDGE_DB_FILE || join(root, "data", "knowledge.sqlite");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";
const model = process.env.OPENAI_MODEL || "gpt-6-luna";
const embeddingModel = process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
const adminPassword = process.env.ADMIN_PASSWORD || "";
const rateLimits = new Map();
const sessions = new Map();

let portfolio = JSON.parse(await readFile(dataFile, "utf8"));
const knowledgeStore = new KnowledgeStore(knowledgeDatabaseFile);
let ragIndex;

async function rebuildRagIndex() {
  ragIndex = await buildRagIndex(portfolio, {
    apiKey: process.env.OPENAI_API_KEY,
    embeddingModel,
    extraChunks: knowledgeChunks(knowledgeStore.list())
  });
}

await rebuildRagIndex();

const contentTypes = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png", ".webp": "image/webp", ".ico": "image/x-icon"
};

function securityHeaders(contentType = "application/json; charset=utf-8") {
  return {
    "Content-Type": contentType,
    "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()", "Cross-Origin-Opener-Policy": "same-origin"
  };
}

function sendJson(response, status, data, extraHeaders = {}) {
  response.writeHead(status, { ...securityHeaders(), ...extraHeaders });
  response.end(JSON.stringify(data));
}

async function readJsonBody(request, limit = 16_000) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > limit) throw new Error("PAYLOAD_TOO_LARGE");
  }
  return JSON.parse(body || "{}");
}

function allowRequest(request) {
  const ip = request.socket.remoteAddress || "unknown";
  const now = Date.now();
  const entry = rateLimits.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > entry.resetAt) { entry.count = 0; entry.resetAt = now + 60_000; }
  entry.count += 1;
  rateLimits.set(ip, entry);
  return entry.count <= 20;
}

function extractOutputText(payload) {
  return (payload.output || []).filter((item) => item.type === "message").flatMap((item) => item.content || [])
    .filter((part) => part.type === "output_text").map((part) => part.text).join("\n").trim();
}

function isLoopback(request) {
  return ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress || "");
}

function cookies(request) {
  return Object.fromEntries(String(request.headers.cookie || "").split(";").map((value) => value.trim().split("=")).filter(([key, value]) => key && value));
}

function isAdmin(request) {
  if (!adminPassword && isLoopback(request)) return true;
  const token = cookies(request).portfolio_admin;
  const session = token && sessions.get(token);
  if (!session || session.expiresAt < Date.now()) { if (token) sessions.delete(token); return false; }
  return true;
}

function passwordMatches(value) {
  const supplied = Buffer.from(String(value || ""));
  const expected = Buffer.from(adminPassword);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function sessionCookie(request, token, maxAge = 43_200) {
  const secure = request.headers["x-forwarded-proto"] === "https" ? "; Secure" : "";
  return `portfolio_admin=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`;
}

function validatePortfolio(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Portfolio must be an object.");
  if (!value.identity || typeof value.identity.name !== "string" || !value.identity.name.trim()) throw new Error("A profile name is required.");
  for (const key of ["experience", "projects", "education", "certifications", "languages"]) if (!Array.isArray(value[key])) throw new Error(`${key} must be a list.`);
  if (!value.skills || typeof value.skills !== "object" || Array.isArray(value.skills)) throw new Error("Skills must be grouped by category.");
  const serialized = JSON.stringify(value);
  if (Buffer.byteLength(serialized) > 250_000) throw new Error("Portfolio data is too large.");
  return JSON.parse(serialized);
}

async function savePortfolio(nextPortfolio) {
  const validated = validatePortfolio(nextPortfolio);
  const temporaryFile = `${dataFile}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  await rename(temporaryFile, dataFile);
  portfolio = validated;
  await rebuildRagIndex();
}

function isPrivateAddress(address) {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) || parts[0] >= 224;
  }
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized === "::" || normalized.startsWith("fc") || normalized.startsWith("fd") ||
    normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

async function validateRemoteUrl(value) {
  let url;
  try { url = new URL(String(value || "")); } catch { throw new Error("Enter a valid HTTPS URL."); }
  if (url.protocol !== "https:" || (url.port && url.port !== "443") || url.username || url.password) throw new Error("Only public HTTPS URLs are allowed.");
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) throw new Error("Local network URLs are not allowed.");
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("Private or local network URLs are not allowed.");
  return url;
}

function decodeHtml(value) {
  return value.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function extractWebText(html) {
  const title = decodeHtml((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const text = decodeHtml(html
    .replace(/<(script|style|noscript|svg|form|nav|header|footer)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim().slice(0, 50_000);
  if (text.length < 80) throw new Error("The page did not contain enough readable text.");
  return { title, text };
}

async function fetchWebSource(value, redirectCount = 0) {
  const url = await validateRemoteUrl(value);
  const result = await fetch(url, {
    redirect: "manual",
    headers: { "User-Agent": "AngadPortfolioKnowledgeBot/1.0", "Accept": "text/html,text/plain;q=0.9" },
    signal: AbortSignal.timeout(15_000)
  });
  if ([301, 302, 303, 307, 308].includes(result.status)) {
    if (redirectCount >= 3) throw new Error("The web page redirected too many times.");
    const location = result.headers.get("location");
    if (!location) throw new Error("The web page returned an invalid redirect.");
    return fetchWebSource(new URL(location, url).toString(), redirectCount + 1);
  }
  if (!result.ok) throw new Error(`The web page returned HTTP ${result.status}.`);
  const contentType = result.headers.get("content-type") || "";
  if (!contentType.includes("text/html") && !contentType.includes("text/plain")) throw new Error("Only HTML or plain-text web pages can be imported.");
  const contentLength = Number(result.headers.get("content-length") || 0);
  if (contentLength > 1_200_000) throw new Error("The web page is too large to import.");
  const chunks = [];
  let size = 0;
  for await (const chunk of result.body) {
    size += chunk.byteLength;
    if (size > 1_200_000) throw new Error("The web page is too large to import.");
    chunks.push(Buffer.from(chunk));
  }
  const body = Buffer.concat(chunks).toString("utf8");
  const extracted = contentType.includes("text/plain") ? { title: "", text: body.trim().slice(0, 50_000) } : extractWebText(body);
  return { ...extracted, url: url.toString(), fetchedAt: new Date().toISOString() };
}

async function askOpenAI(message, history, language, evidence) {
  const retrievedContext = evidence.map((item, index) => `[${index + 1}] ${item.title}\n${item.text}`).join("\n\n");
  const instructions = [
    "You are Angad's concise portfolio assistant.",
    "Answer only from RETRIEVED_EVIDENCE. If the evidence does not support the answer, say that the portfolio does not contain that detail.",
    "Never invent dates, employers, metrics, credentials, links, publications, or personal facts.",
    "Synthesize the retrieved facts instead of repeating a canned paragraph. Prefer 2-5 sentences and use concrete evidence.",
    language === "fr" ? "Answer in French." : "Answer in English.",
    `RETRIEVED_EVIDENCE:\n${retrievedContext}`
  ].join("\n\n");
  const recentHistory = Array.isArray(history) ? history.slice(-6)
    .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
    .map((item) => ({ role: item.role, content: item.content.slice(0, 1200) })) : [];
  const apiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, instructions, input: [...recentHistory, { role: "user", content: message }], store: false, max_output_tokens: 380 }),
    signal: AbortSignal.timeout(25_000)
  });
  if (!apiResponse.ok) throw new Error(`OpenAI request failed with ${apiResponse.status}`);
  const answer = extractOutputText(await apiResponse.json());
  if (!answer) throw new Error("OpenAI response did not contain text");
  return answer;
}

async function handleChat(request, response) {
  if (!allowRequest(request)) return sendJson(response, 429, { error: "Too many requests. Please wait a minute and try again." });
  try {
    const { message, history, language: requestedLanguage } = await readJsonBody(request);
    const language = requestedLanguage === "fr" ? "fr" : "en";
    if (typeof message !== "string" || !message.trim() || message.length > 800) return sendJson(response, 400, { error: "Message must be between 1 and 800 characters." });
    const evidence = await retrieve(message.trim(), ragIndex, { apiKey: process.env.OPENAI_API_KEY, limit: 4 });
    const sources = evidence.filter((item) => item.score > 0).map(({ id, title, score, metadata }) => ({
      id,
      title,
      score: Number(score.toFixed(3)),
      sourceUrl: metadata?.sourceUrl || ""
    }));
    if (!process.env.OPENAI_API_KEY) return sendJson(response, 200, { answer: localRagAnswer(message, evidence, language), mode: "retrieval", retrievalMode: ragIndex.mode, sources });
    try {
      const answer = await askOpenAI(message.trim(), history, language, evidence);
      return sendJson(response, 200, { answer, mode: "ai", retrievalMode: ragIndex.mode, sources });
    } catch {
      return sendJson(response, 200, { answer: localRagAnswer(message, evidence, language), mode: "retrieval", retrievalMode: ragIndex.mode, sources });
    }
  } catch (error) {
    const status = error.message === "PAYLOAD_TOO_LARGE" ? 413 : 400;
    return sendJson(response, status, { error: status === 413 ? "Request body is too large." : "Invalid JSON request." });
  }
}

async function handleAdmin(request, response, url) {
  if (url.pathname === "/api/admin/login" && request.method === "POST") {
    const body = await readJsonBody(request, 4_000);
    if (adminPassword && !passwordMatches(body.password)) return sendJson(response, 401, { error: "Incorrect password." });
    if (!adminPassword && !isLoopback(request)) return sendJson(response, 403, { error: "Set ADMIN_PASSWORD before using the editor remotely." });
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { expiresAt: Date.now() + 43_200_000 });
    return sendJson(response, 200, { ok: true }, { "Set-Cookie": sessionCookie(request, token) });
  }
  if (!isAdmin(request)) return sendJson(response, 401, { error: "Sign in to the owner portal." });
  if (["PUT", "POST", "DELETE"].includes(request.method) && request.headers["x-admin-request"] !== "1") return sendJson(response, 403, { error: "Invalid editor request." });
  if (url.pathname === "/api/admin/state" && request.method === "GET") return sendJson(response, 200, {
    portfolio,
    knowledge: knowledgeStore.list(),
    rag: { mode: ragIndex.mode, chunks: ragIndex.chunks.length, model: ragIndex.model },
    localAccess: !adminPassword
  });
  if (url.pathname === "/api/admin/logout" && request.method === "POST") {
    const token = cookies(request).portfolio_admin;
    if (token) sessions.delete(token);
    return sendJson(response, 200, { ok: true }, { "Set-Cookie": sessionCookie(request, "", 0) });
  }
  if (url.pathname === "/api/admin/portfolio" && request.method === "PUT") {
    const body = await readJsonBody(request, 300_000);
    await savePortfolio(body.portfolio);
    return sendJson(response, 200, { ok: true, portfolio, rag: { mode: ragIndex.mode, chunks: ragIndex.chunks.length } });
  }
  if (url.pathname === "/api/admin/knowledge" && request.method === "PUT") {
    const body = await readJsonBody(request, 3_000_000);
    const knowledge = knowledgeStore.replaceAll(body.items);
    await rebuildRagIndex();
    return sendJson(response, 200, { ok: true, knowledge, rag: { mode: ragIndex.mode, chunks: ragIndex.chunks.length } });
  }
  if (url.pathname === "/api/admin/knowledge/import-url" && request.method === "POST") {
    const body = await readJsonBody(request, 20_000);
    const imported = await fetchWebSource(body.url);
    const item = knowledgeStore.upsert({
      title: String(body.title || imported.title || new URL(imported.url).hostname),
      category: String(body.category || "Web sources"),
      content: imported.text,
      sourceType: "web",
      sourceUrl: imported.url,
      tags: body.tags,
      visibility: "assistant_only",
      enabled: true,
      fetchedAt: imported.fetchedAt
    });
    await rebuildRagIndex();
    return sendJson(response, 200, { ok: true, item, knowledge: knowledgeStore.list(), rag: { mode: ragIndex.mode, chunks: ragIndex.chunks.length } });
  }
  if (url.pathname === "/api/admin/profile" && request.method === "POST") {
    const body = await readJsonBody(request, 9_000_000);
    const match = String(body.dataUrl || "").match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!match) return sendJson(response, 400, { error: "Upload a JPEG, PNG, or WebP image." });
    const extension = match[1] === "jpeg" ? "jpg" : match[1];
    const image = Buffer.from(match[2], "base64");
    if (!image.length || image.length > 6_000_000) return sendJson(response, 400, { error: "Image must be smaller than 6 MB." });
    const filename = `profile-upload.${extension}`;
    await writeFile(join(publicDirectory, filename), image);
    const nextPortfolio = structuredClone(portfolio);
    nextPortfolio.site ||= {};
    nextPortfolio.site.profileImage = `/${filename}?v=${Date.now()}`;
    await savePortfolio(nextPortfolio);
    return sendJson(response, 200, { ok: true, profileImage: portfolio.site.profileImage });
  }
  return sendJson(response, 404, { error: "Editor endpoint not found." });
}

async function serveStatic(request, response, url) {
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(publicDirectory, safePath);
  if (!filePath.startsWith(publicDirectory)) return sendJson(response, 403, { error: "Forbidden" });
  try {
    const file = await readFile(filePath);
    response.writeHead(200, { ...securityHeaders(contentTypes[extname(filePath)] || "application/octet-stream"), "Cache-Control": extname(filePath) === ".html" ? "no-cache" : "public, max-age=3600" });
    if (request.method === "HEAD") return response.end();
    return response.end(file);
  } catch {
    const html = await readFile(join(publicDirectory, "index.html"));
    response.writeHead(404, securityHeaders("text/html; charset=utf-8"));
    return response.end(html);
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname === "/api/health" && request.method === "GET") return sendJson(response, 200, { ok: true, chatMode: process.env.OPENAI_API_KEY ? "ai" : "retrieval", retrievalMode: ragIndex.mode, chunks: ragIndex.chunks.length });
    if (url.pathname === "/api/portfolio" && request.method === "GET") return sendJson(response, 200, { portfolio, updatedAt: Date.now() });
    if (url.pathname === "/api/chat" && request.method === "POST") return await handleChat(request, response);
    if (url.pathname.startsWith("/api/admin/")) return await handleAdmin(request, response, url);
    if (!["GET", "HEAD"].includes(request.method)) return sendJson(response, 405, { error: "Method not allowed" });
    return await serveStatic(request, response, url);
  } catch (error) {
    const status = error.message === "PAYLOAD_TOO_LARGE" ? 413 : 500;
    return sendJson(response, status, { error: status === 413 ? "Request body is too large." : error.message || "The server could not complete that request." });
  }
});

server.listen(port, host, () => {
  console.log(`Portfolio running at http://${host}:${port}`);
  console.log(`Chat mode: ${process.env.OPENAI_API_KEY ? `${model} + ${ragIndex.mode} retrieval` : "local ranked retrieval"}`);
  console.log(`Knowledge database: ${knowledgeStore.list().length} sources`);
  console.log(`Owner portal: http://${host}:${port}/admin.html${adminPassword ? " (password protected)" : " (local access)"}`);
});
