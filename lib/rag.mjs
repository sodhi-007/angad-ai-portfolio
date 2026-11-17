const embeddingEndpoint = "https://api.openai.com/v1/embeddings";
const stopWords = new Set(["a", "an", "and", "are", "at", "be", "by", "did", "do", "does", "for", "from", "how", "in", "is", "it", "me", "of", "on", "or", "the", "to", "was", "were", "what", "when", "where", "which", "who", "why", "with"]);

function clean(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function add(chunks, id, title, text, metadata = {}) {
  const content = clean(text);
  if (content) chunks.push({ id, title: clean(title), text: content, metadata });
}

export function chunkPortfolio(portfolio) {
  const chunks = [];
  const identity = portfolio.identity || {};
  add(chunks, "identity", "Profile", `${identity.name}. ${identity.headline}. ${identity.summary} ${identity.availability} Location: ${identity.location}.`);
  add(chunks, "experience-total", "Documented professional experience", "Angad has approximately 2 years and 6 months of documented professional experience: 22 months at Reliance Jio, 5 months at CIMA+, and 3 months at IBM.");

  (portfolio.experience || []).forEach((item, itemIndex) => {
    const context = `${item.role} at ${item.organization}, ${item.location}, ${item.dates}.`;
    const title = `${item.organization} · ${item.role}`;
    add(chunks, `experience-${itemIndex}-overview`, title, context, { section: "experience", itemIndex });
    (item.highlights || []).forEach((highlight, highlightIndex) => add(chunks, `experience-${itemIndex}-${highlightIndex}`, title, `${context} ${highlight}`, { section: "experience", itemIndex, highlightIndex }));
  });

  (portfolio.projects || []).forEach((item, index) => {
    const nameWithDates = [item.name, item.dates].filter(Boolean).join(", ");
    add(chunks, `project-${index}`, `Project · ${item.name}`, `${nameWithDates}. ${item.description} Technologies: ${(item.stack || []).join(", ")}.`, { section: "projects", itemIndex: index });
  });
  (portfolio.education || []).forEach((item, index) => add(chunks, `education-${index}`, `Education · ${item.institution}`, `${item.program} at ${item.institution}, ${item.location}, ${item.dates}. ${item.grade}.`, { section: "education", itemIndex: index }));
  Object.entries(portfolio.skills || {}).forEach(([category, values], index) => add(chunks, `skills-${index}`, `Skills · ${category}`, `${category}: ${(values || []).join(", ")}.`, { section: "skills", category }));
  add(chunks, "certifications", "Certifications", (portfolio.certifications || []).join(". "), { section: "education" });
  add(chunks, "languages", "Languages", (portfolio.languages || []).join(", "));
  const contact = portfolio.contact || {};
  add(chunks, "contact", "Contact", `Email: ${contact.email}. LinkedIn: ${contact.linkedin}. GitHub: ${contact.github}.`, { section: "contact" });
  return chunks;
}

export function tokenize(text) {
  return (clean(text).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").match(/[a-z0-9+#.-]+/g) || [])
    .map((token) => token.endsWith("+") ? token.slice(0, -1) : token)
    .filter((token) => token && !stopWords.has(token));
}

function lexicalScore(queryTokens, chunkTokens, weights = new Map()) {
  if (!queryTokens.length || !chunkTokens.length) return 0;
  const frequencies = new Map();
  chunkTokens.forEach((token) => frequencies.set(token, (frequencies.get(token) || 0) + 1));
  let score = 0;
  for (const token of new Set(queryTokens)) {
    const weight = weights.get(token) || 1;
    const count = frequencies.get(token) || 0;
    if (count) score += weight * (1 + Math.log1p(count) + Math.min(token.length / 12, .6));
    for (const candidate of frequencies.keys()) {
      if (token.length >= 5 && candidate.length >= 5 && (candidate.startsWith(token) || token.startsWith(candidate))) score += weight * .3;
    }
  }
  return score / (1 + Math.log1p(chunkTokens.length) * .15);
}

function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm) || 1);
}

export async function embedTexts(texts, apiKey, model = "text-embedding-3-small") {
  const response = await fetch(embeddingEndpoint, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: texts, encoding_format: "float" }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`Embedding request failed with ${response.status}`);
  const payload = await response.json();
  return payload.data.sort((left, right) => left.index - right.index).map((item) => item.embedding);
}

export async function buildRagIndex(portfolio, options = {}) {
  const chunks = [...chunkPortfolio(portfolio), ...(options.extraChunks || [])]
    .map((chunk) => ({ ...chunk, tokens: tokenize(`${chunk.title} ${chunk.text}`) }));
  const index = { chunks, mode: "local", model: null };
  if (options.apiKey) {
    try {
      const vectors = await embedTexts(chunks.map((chunk) => `${chunk.title}\n${chunk.text}`), options.apiKey, options.embeddingModel);
      index.chunks = chunks.map((chunk, indexValue) => ({ ...chunk, vector: vectors[indexValue] }));
      index.mode = "embeddings";
      index.model = options.embeddingModel || "text-embedding-3-small";
    } catch {
      index.mode = "local";
    }
  }
  return index;
}

export async function retrieve(query, index, options = {}) {
  const limit = Math.max(1, Math.min(6, options.limit || 4));
  let queryVector = null;
  if (index.mode === "embeddings" && options.apiKey) {
    try {
      [queryVector] = await embedTexts([query], options.apiKey, index.model);
    } catch {
      queryVector = null;
    }
  }
  const synonyms = { embeddings: ["chromadb", "vector", "retrieval"], embedding: ["chromadb", "vector", "retrieval"], database: ["chromadb", "mysql", "mongodb"], agent: ["agentic", "multi-agent"], security: ["cybersecurity", "vulnerability"], cloud: ["azure", "aws"] };
  const baseTokens = tokenize(query);
  const queryTokens = [...baseTokens, ...baseTokens.flatMap((token) => synonyms[token] || [])];
  const documentFrequency = new Map();
  index.chunks.forEach((chunk) => new Set(chunk.tokens).forEach((token) => documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1)));
  const weights = new Map(queryTokens.map((token) => [token, Math.log((index.chunks.length + 1) / ((documentFrequency.get(token) || 0) + 1)) + 1]));
  return index.chunks
    .map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      text: chunk.text,
      metadata: chunk.metadata,
      score: queryVector && chunk.vector ? cosine(queryVector, chunk.vector) : lexicalScore(queryTokens, chunk.tokens, weights)
    }))
    .sort((left, right) => right.score - left.score)
    .slice(0, limit);
}

export function localRagAnswer(query, results, language = "en") {
  const relevant = results.filter((result) => result.score > 0).slice(0, 3);
  if (!relevant.length) return language === "fr"
    ? "Je n’ai trouvé aucune information pertinente dans les données vérifiées du portfolio. Essayez une question sur l’expérience, les projets, les compétences, la formation ou les coordonnées d’Angad."
    : "I could not find relevant evidence in the verified portfolio data. Try asking about Angad’s experience, projects, skills, education, or contact details.";

  const normalized = clean(query).toLowerCase();
  const joined = relevant.map((result) => `${result.title}: ${result.text}`).join(" ");

  if (/^(what|who)\s+(is|are)\b|^(qu['’]est-ce que|qui est)\b/.test(normalized)) {
    const definition = relevant.find((result) => result.id.startsWith("knowledge-"));
    if (definition) return language === "fr" ? `Selon la source enregistrée : ${definition.text}` : definition.text;
  }

  if (/\b(experience|expérience)\b/.test(normalized) && /\b(how much|how long|years?|months?|total|combien|durée)\b/.test(normalized)) {
    const duration = results.find((result) => result.id === "experience-total")?.text;
    if (duration) return language === "fr" ? duration.replace("Angad has", "Angad possède") : duration;
  }

  if (/\b(database|vector store|stored?|stock|base de données)\b/.test(normalized) && /\b(cima|embedding|engineering|document)\b/.test(normalized) && /\bchromadb\b/i.test(joined)) {
    return language === "fr"
      ? "Angad a utilisé ChromaDB comme base vectorielle pour stocker et récupérer les embeddings des documents d’ingénierie chez CIMA+."
      : "Angad used ChromaDB as the vector database for storing and retrieving the engineering-document embeddings at CIMA+.";
  }

  if (/\b(projects?|projets?)\b/.test(normalized)) {
    const projects = results.filter((result) => result.id.startsWith("project-")).slice(0, 4);
    if (projects.length) {
      const summary = projects.map((result) => result.text).join(" ");
      return language === "fr" ? `Les projets les plus pertinents sont : ${summary}` : `The most relevant projects are: ${summary}`;
    }
  }

  if (/\b(cima|jio|ibm)\b/.test(normalized)) {
    const organization = normalized.includes("cima") ? "CIMA+" : normalized.includes("jio") ? "Reliance Jio" : "IBM";
    const matchName = organization.toLowerCase().replace("reliance ", "");
    const matches = relevant.filter((result) => result.title.toLowerCase().includes(matchName));
    if (matches.length) {
      const summary = matches.map((result) => result.text).join(" ");
      return language === "fr" ? `Chez ${organization}, ${summary}` : `At ${organization}, ${summary}`;
    }
  }

  const queryTokens = new Set(tokenize(query).filter((token) => !["angad", "use", "uses", "used", "know", "knows"].includes(token)));
  const candidates = relevant.flatMap((result) => result.text.split(/\n+|(?<=[.!?])\s+/)
    .map((text) => text.trim()).filter((text) => text.length >= 15)
    .map((text) => ({ text, score: tokenize(text).filter((token) => queryTokens.has(token)).length })));
  candidates.sort((left, right) => right.score - left.score || left.text.length - right.text.length);
  const excerpt = candidates[0]?.score ? candidates[0].text : relevant[0].text;
  const yesNoQuestion = /^(did|does|has|can|is|was)\b/.test(normalized);
  if (yesNoQuestion && candidates[0]?.score && queryTokens.size && [...queryTokens].every((token) => tokenize(excerpt).includes(token))) {
    return language === "fr" ? `Oui. ${excerpt}` : `Yes. ${excerpt}`;
  }
  return language === "fr" ? `Selon les données du portfolio : ${excerpt}` : excerpt;
}
