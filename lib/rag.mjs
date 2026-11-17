import { smallTalkReply, retrievalQuestion } from "./assistant-behavior.mjs";

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
    const metadata = { section: "experience", itemIndex, organization: item.organization, role: item.role, location: item.location, dates: item.dates, context };
    add(chunks, `experience-${itemIndex}-overview`, title, context, metadata);
    (item.highlights || []).forEach((highlight, highlightIndex) => add(chunks, `experience-${itemIndex}-${highlightIndex}`, title, `${context} ${highlight}`, { ...metadata, highlightIndex, highlight: clean(highlight) }));
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
    .map((token) => token.replace(/\.+$/, ""))
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
  const ranked = index.chunks
    .map((chunk) => ({
      id: chunk.id,
      title: chunk.title,
      text: chunk.text,
      metadata: chunk.metadata,
      score: queryVector && chunk.vector ? cosine(queryVector, chunk.vector) : lexicalScore(queryTokens, chunk.tokens, weights)
    }))
    .sort((left, right) => right.score - left.score);
  const organization = overviewOrganization(query, ranked);
  if (organization) {
    const definition = ranked.find((item) => item.score > 0 && companyDefinition(item, organization));
    const roles = ranked.filter((item) => item.score > 0 && item.metadata?.organization === organization);
    const overview = roles.find((item) => item.id.endsWith("-overview"));
    // Keep context and achievements together; repeated role headers should not crowd out the company description.
    const highlights = roles.filter((item) => item.metadata.highlight)
      .sort((left, right) => left.metadata.itemIndex - right.metadata.itemIndex || left.metadata.highlightIndex - right.metadata.highlightIndex);
    return [definition, overview, ...highlights].filter(Boolean).slice(0, limit);
  }
  return ranked.slice(0, limit);
}

function sentences(text) {
  return String(text || "").split(/\n+|(?<=[.!?])\s+/).map(clean).filter(Boolean);
}

function uniqueSentences(texts) {
  const seen = new Set();
  return texts.flatMap(sentences).filter((sentence) => {
    const key = sentence.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function overviewOrganization(query, results) {
  const words = tokenize(retrievalQuestion(query).replace(/[.!?]+$/, ""));
  const organizations = [...new Set(results.map((item) => item.metadata?.organization).filter(Boolean))];
  const matches = organizations.filter((organization) => tokenize(organization).some((word) => words.includes(word)));
  if (matches.length !== 1) return null;
  const organization = matches[0];
  const allowed = new Set([...tokenize(organization), "angad", "sodhi", "his", "he", "tell", "about", "experience", "role", "work", "worked", "company", "there", "please", "overview", "background", "doing", "do", "chez", "parle", "moi", "entreprise", "est", "que", "qu", "ce", "son", "poste"]);
  return words.every((word) => allowed.has(word)) ? organization : null;
}

function companyDefinition(result, organization) {
  if (result.metadata?.section !== "knowledge") return null;
  const companyWords = new Set(tokenize(organization));
  return sentences(result.text).find((sentence) => {
    const match = sentence.match(/^(.+?)\s+(?:is|est)\s+/i);
    if (!match) return false;
    const prefix = tokenize(match[1]);
    return prefix.some((word) => companyWords.has(word)) && prefix.every((word) => companyWords.has(word) || ["limited", "ltd"].includes(word));
  }) || null;
}

function companyAnswer(query, results, organization, language) {
  const role = results.find((item) => item.score > 0 && item.metadata?.organization === organization)?.metadata;
  if (!role) return null;
  const definition = results.filter((item) => item.score > 0).map((item) => companyDefinition(item, organization)).find(Boolean);
  const highlights = uniqueSentences(results.filter((item) => item.score > 0 && item.metadata?.organization === organization)
    .map((item) => item.metadata.highlight).filter(Boolean)).slice(0, 2);
  const french = language === "fr";
  const parts = [];
  if (definition) parts.push(definition);
  else if (/^(?:what is|what are|qu['’]est-ce que)/i.test(clean(query))) parts.push(french
    ? "Je n’ai pas de description générale de cette entreprise dans les sources disponibles."
    : "I don’t have a general company description in the available sources.");
  parts.push(french
    ? `Angad a occupé le poste de ${role.role} chez ${organization}${role.dates ? ` (${role.dates})` : ""}.`
    : `Angad worked as ${/^[aeiou]/i.test(role.role) ? "an" : "a"} ${role.role} at ${organization}${role.dates ? ` (${role.dates})` : ""}.`);
  // Without a language model, retain the source wording rather than inventing a translation.
  parts.push(...highlights.map((text) => french ? text : /^(?:Angad|He|His)\b/.test(text) ? text : `He ${text[0].toLowerCase()}${text.slice(1)}`));
  return parts.join(" ");
}

export function localRagAnswer(query, results, language = "en", history = []) {
  const conversationalAnswer = smallTalkReply(query, language, history);
  if (conversationalAnswer) return conversationalAnswer;
  query = retrievalQuestion(query);
  const relevant = results.filter((result) => result.score > 0).slice(0, 3);
  if (!relevant.length) return language === "fr"
    ? "Je n’ai trouvé aucune information pertinente dans les données vérifiées du portfolio. Essayez une question sur l’expérience, les projets, les compétences, la formation ou les coordonnées d’Angad."
    : "I could not find relevant evidence in the verified portfolio data. Try asking about Angad’s experience, projects, skills, education, or contact details.";

  const normalized = clean(query).toLowerCase();
  const joined = relevant.map((result) => `${result.title}: ${result.text}`).join(" ");

  const organization = overviewOrganization(query, results);
  if (organization) return companyAnswer(query, results, organization, language);

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
      const summary = uniqueSentences(projects.map((result) => result.text)).join(" ");
      return language === "fr" ? `Les projets les plus pertinents sont : ${summary}` : `The most relevant projects are: ${summary}`;
    }
  }

  const queryTokens = new Set(tokenize(query).filter((token) => !["angad", "use", "uses", "used", "know", "knows"].includes(token)));
  const candidates = uniqueSentences(relevant.map((result) => result.text)).filter((text) => text.length >= 15)
    .map((text) => ({ text, score: tokenize(text).filter((token) => queryTokens.has(token)).length }));
  candidates.sort((left, right) => right.score - left.score || left.text.length - right.text.length);
  const excerpt = candidates[0]?.score ? candidates[0].text : relevant[0].text;
  const yesNoQuestion = /^(did|does|has|can|is|was)\b/.test(normalized);
  if (yesNoQuestion && candidates[0]?.score && queryTokens.size && [...queryTokens].every((token) => tokenize(excerpt).includes(token))) {
    return language === "fr" ? `Oui. ${excerpt}` : `Yes. ${excerpt}`;
  }
  return language === "fr" ? `Selon les données du portfolio : ${excerpt}` : excerpt;
}
