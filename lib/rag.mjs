import { smallTalkReply, retrievalQuestion } from "./assistant-behavior.mjs";
import { frenchPortfolioFacts } from "./portfolio-french.mjs";

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
  add(chunks, "identity", "Profile", `${identity.name}. ${identity.headline}. ${identity.summary} ${identity.availability} Location: ${identity.location}.`, { section: "identity", summary: identity.summary, availability: identity.availability });
  add(chunks, "experience-total", "Documented professional experience", "Angad has approximately 2 years and 6 months of documented professional experience: 22 months at Reliance Jio, 5 months at CIMA+, and 3 months at IBM.");

  const allHighlights = (portfolio.experience || []).flatMap((item) => (item.highlights || []).map((h) => `${item.organization}: ${h}`));
  if (allHighlights.length) add(chunks, "highlights", "Career highlights", allHighlights.join(" "), { section: "experience" });

  (portfolio.experience || []).forEach((item, itemIndex) => {
    const context = `${item.role} at ${item.organization}, ${item.location}, ${item.dates}.`;
    const title = `${item.organization} · ${item.role}`;
    const { organization, role, dates } = item;
    const metadata = { section: "experience", itemIndex, organization, role, location: item.location, dates, context };
    add(chunks, `experience-${itemIndex}-overview`, title, context, metadata);
    (item.highlights || []).forEach((highlight, highlightIndex) => {
      add(chunks, `experience-${itemIndex}-${highlightIndex}`, title, `${context} ${highlight}`, { ...metadata, highlight: clean(highlight), highlightIndex });
    });
  });

  (portfolio.projects || []).forEach((item, index) => {
    const nameWithDates = [item.name, item.dates].filter(Boolean).join(", ");
    add(chunks, `project-${index}`, `Project · ${item.name}`, `${nameWithDates}. ${item.description} Technologies: ${(item.stack || []).join(", ")}.`, { section: "projects", itemIndex: index, name: item.name });
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
    .flatMap((token) => token.split("-"))
    .map((token) => token.replace(/^\.+|\.+$/g, "").replace(/\+$/, ""))
    .filter((token) => token && !stopWords.has(token));
}

const companyAliases = { cima: ["cima plus"], "reliance jio infocomm": ["reliance jio", "jio"] };

function words(value) {
  return clean(value).toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function companyNames(organization) {
  const name = words(organization);
  return name ? [name, ...(companyAliases[name] || [])] : [];
}

function mentionedCompany(query, chunks) {
  const normalized = ` ${words(query)} `;
  return chunks.find(({ metadata }) => metadata?.organization && companyNames(metadata.organization)
    .some((name) => normalized.includes(` ${name} `)))?.metadata.organization;
}

export function resolveChatQuery(message, history, index) {
  if (mentionedCompany(message, index.chunks) || !Array.isArray(history)) return message;
  const question = words(message);
  if (!/\b(there|that company|that firm|chez eux|la bas|cette entreprise)\b/.test(question) && !/^(?:tell me more|parlez? moi en plus)$/.test(question)) return message;

  for (const turn of history.slice(-8).reverse()) {
    if (turn?.role !== "user" || typeof turn.content !== "string") continue;
    const company = mentionedCompany(turn.content.slice(0, 800), index.chunks);
    if (company) return `${message.replace(/[?!\.\s]+$/, "")} (${company})`;
  }
  return message;
}

function isProfileQuestion(query) {
  return /^(?:who is|tell me about|qui est|parlez? moi d) angad(?: singh sodhi)?$/.test(words(query));
}

function isProjectsQuestion(query) {
  return /^(?:(?:tell me about |what are )?(?:(?:his|angad s) )?projects|(?:parlez? moi de )?(?:ses )?projets)$/.test(words(query));
}

function sourceSentences(text) {
  return String(text || "").split(/\n+|(?<=[.!?])\s+/).map((sentence) => sentence.trim()).filter(Boolean);
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

function companyDescription(chunk, company) {
  const { category, sourceType } = chunk.metadata || {};
  const companyCategory = /^(?:organizations?|companies|employers?)$/i.test(category || "");
  if (sourceType !== "web" && !(sourceType === "manual" && companyCategory)) return "";
  const names = companyNames(company);
  const title = ` ${words(chunk.title)} `;
  if (!names.some((name) => title.includes(` ${name} `))) return "";

  return sourceSentences(chunk.text).find((sentence) => sentence.length <= 300 && names.some((name) => {
    const normalized = words(sentence);
    return ["is", "provides", "offers", "operates", "est", "offre", "fournit"].some((verb) => normalized.startsWith(`${name} ${verb} `));
  })) || "";
}

function overviewOrganization(query, results) {
  const w = tokenize(retrievalQuestion(query).replace(/[.!?]+$/, ""));
  const organizations = [...new Set(results.map((item) => item.metadata?.organization).filter(Boolean))];
  const matches = organizations.filter((organization) => tokenize(organization).some((word) => w.includes(word)));
  if (matches.length !== 1) return null;
  const organization = matches[0];
  const allowed = new Set([...tokenize(organization), "angad", "sodhi", "his", "he", "tell", "about", "more", "else", "experience", "role", "work", "worked", "company", "there", "please", "overview", "background", "doing", "do", "chez", "parle", "moi", "plus", "entreprise", "est", "que", "qu", "ce", "son", "poste"]);
  return w.every((word) => allowed.has(word)) ? organization : null;
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

const englishHighlights = new Map([
  ["Angad shipped a bilingual English/French RAG agent for the internal sales network, used by 700+ employees and cutting manual document search time by 60%.",
    "delivered a bilingual search assistant that helped 700+ employees find internal documents and cut manual search time by 60%."],
  ["He built ingestion and retrieval over 10,000+ pages using MinerU OCR, OpenAI embeddings, ChromaDB, and Azure Container Apps Jobs, with sub-3-second retrieval on 95% of queries.",
    "built the search pipeline for 10,000+ pages of engineering documents, with retrieval taking under three seconds for 95% of queries."]
]);

function frenchDates(dates) {
  const months = new Map([
    ["January", "janvier"], ["February", "février"], ["March", "mars"], ["April", "avril"],
    ["May", "mai"], ["June", "juin"], ["July", "juillet"], ["August", "août"],
    ["September", "septembre"], ["October", "octobre"], ["November", "novembre"], ["December", "décembre"]
  ]);
  return dates.split(/\s+/).map((word) => months.get(word) || word).join(" ").replace(/\s*[–-]\s*/, " à ");
}

function thirdPerson(text) {
  return clean(text).replace(/\bI(?:[''\u2019]m| am)\b/g, "Angad is").replace(/\bI\b/g, "he")
    .replace(/\bmy\b/gi, "his").replace(/^he\b/, "Angad");
}

export async function retrieve(query, index, options = {}) {
  const limit = Math.max(1, Math.min(8, options.limit || 5));
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

  const withLexical = index.chunks.map((chunk) => ({
    id: chunk.id, title: chunk.title, text: chunk.text, metadata: chunk.metadata, vector: chunk.vector,
    lexical: lexicalScore(queryTokens, chunk.tokens, weights),
    cosineScore: queryVector && chunk.vector ? cosine(queryVector, chunk.vector) : 0
  }));

  const K = 60;
  let ranked;
  if (queryVector) {
    const byLexical = [...withLexical].sort((a, b) => b.lexical - a.lexical);
    const byCosine = [...withLexical].sort((a, b) => b.cosineScore - a.cosineScore);
    const lexicalRank = new Map(byLexical.map((c, i) => [c.id, i + 1]));
    const cosineRank = new Map(byCosine.map((c, i) => [c.id, i + 1]));
    ranked = withLexical.map((chunk) => ({
      id: chunk.id, title: chunk.title, text: chunk.text, metadata: chunk.metadata,
      score: 1 / (K + (cosineRank.get(chunk.id) || withLexical.length)) + 1 / (K + (lexicalRank.get(chunk.id) || withLexical.length))
    })).sort((a, b) => b.score - a.score);
  } else {
    ranked = withLexical.map((chunk) => ({
      id: chunk.id, title: chunk.title, text: chunk.text, metadata: chunk.metadata,
      score: chunk.lexical
    })).sort((a, b) => b.score - a.score);
  }

  const seen = new Set();
  ranked = ranked.filter((chunk) => { if (seen.has(chunk.id)) return false; seen.add(chunk.id); return true; });

  const organization = overviewOrganization(query, ranked);
  if (organization) {
    const definition = ranked.find((item) => item.score > 0 && companyDefinition(item, organization));
    const roles = ranked.filter((item) => item.score > 0 && item.metadata?.organization === organization);
    const overview = roles.find((item) => item.id.endsWith("-overview"));
    const highlights = roles.filter((item) => item.metadata?.highlight)
      .sort((left, right) => left.metadata.itemIndex - right.metadata.itemIndex || left.metadata.highlightIndex - right.metadata.highlightIndex);

    if (options.followUp && options.previousAnswer) {
      const previous = words(options.previousAnswer);
      const fresh = highlights.filter(({ metadata: { highlight } }) => {
        const variants = [highlight, englishHighlights.get(highlight), frenchPortfolioFacts.get(highlight)].filter(Boolean);
        return !variants.some((variant) => {
          const [firstSentence] = sourceSentences(variant);
          if (!firstSentence) return false;
          const normalized = words(firstSentence);
          const heVariant = normalized.replace(/^angad\b/, "he");
          const angadVariant = normalized.replace(/^he\b/, "angad");
          return previous.includes(normalized) || previous.includes(heVariant) || previous.includes(angadVariant);
        });
      });
      if (fresh.length) return [definition, overview, ...fresh].filter(Boolean).slice(0, limit)
        .map((chunk) => ({ ...chunk, score: Math.max(chunk.score, 1) }));
    }

    return [definition, overview, ...highlights].filter(Boolean).slice(0, limit)
      .map((chunk) => ({ ...chunk, score: Math.max(chunk.score, 1) }));
  }

  return ranked.slice(0, limit);
}

function companyAnswer(query, results, organization, language, followUp = false) {
  const role = results.find((item) => item.score > 0 && item.metadata?.organization === organization)?.metadata;
  if (!role) return null;
  const definition = !followUp ? results.filter((item) => item.score > 0).map((item) => companyDefinition(item, organization)).find(Boolean) : null;
  const highlights = uniqueSentences(results.filter((item) => item.score > 0 && item.metadata?.organization === organization)
    .map((item) => item.metadata?.highlight).filter(Boolean)).slice(0, followUp ? 3 : 2);
  const french = language === "fr";
  const parts = [];
  if (definition) {
    parts.push(french ? (frenchPortfolioFacts.get(definition) || definition) : definition);
  } else if (!followUp && /^(?:what is|what are|qu[''\u2019]est-ce que)/i.test(clean(query))) {
    parts.push(french
      ? "Je n\u2019ai pas de description g\u00e9n\u00e9rale de cette entreprise dans les sources disponibles."
      : "I don\u2019t have a general company description in the available sources.");
  }
  if (!followUp) {
    if (french) {
      const title = frenchPortfolioFacts.get(role.role);
      const position = title ? ` comme ${title}` : "";
      const period = role.dates ? ` de ${frenchDates(role.dates)}` : "";
      parts.push(`Angad a travaill\u00e9 chez ${organization}${position}${period}.`);
    } else {
      parts.push(`Angad worked as ${/^[aeiou]/i.test(role.role) ? "an" : "a"} ${role.role} at ${organization}${role.dates ? ` (${role.dates})` : ""}.`);
    }
  }
  parts.push(...highlights.map((text) => {
    if (french) {
      const translated = frenchPortfolioFacts.get(text);
      if (translated) return `Il ${translated}`;
      return text;
    }
    if (/^Angad\b/.test(text)) return `He${text.slice(5)}`;
    if (/^(?:He|His)\b/.test(text)) return text;
    return `He ${text[0].toLowerCase()}${text.slice(1)}`;
  }));
  return parts.join(" ") || null;
}

export function localRagAnswer(query, results, language = "en", optionsOrHistory = {}) {
  const options = Array.isArray(optionsOrHistory) ? { history: optionsOrHistory } : (optionsOrHistory || {});
  const history = options.history || [];
  const conversationalAnswer = smallTalkReply(query, language, history);
  if (conversationalAnswer) return conversationalAnswer;
  query = retrievalQuestion(query);
  const relevant = results.filter((result) => result.score > 0).slice(0, 4);
  const missing = language === "fr"
    ? "Le portfolio ne contient pas d\u2019information v\u00e9rifi\u00e9e qui r\u00e9ponde \u00e0 cette question."
    : "I couldn\u2019t find a verified answer to that question in Angad\u2019s portfolio.";
  if (!relevant.length) return missing;

  const normalized = clean(query).toLowerCase();
  const joined = relevant.map((result) => `${result.title}: ${result.text}`).join(" ");

  const organization = overviewOrganization(query, results);
  if (organization) return companyAnswer(query, results, organization, language, options.followUp) || missing;

  if (isProfileQuestion(query)) {
    const profile = relevant.find((result) => result.id === "identity")?.metadata;
    if (!profile) return missing;
    const facts = [profile.summary, profile.availability].filter(Boolean);
    const answer = language === "fr" ? facts.map((fact) => frenchPortfolioFacts.get(fact)).filter(Boolean) : facts.map(thirdPerson);
    return answer.join(" ") || missing;
  }

  if (/\b(experience|exp\u00e9rience)\b/.test(normalized) && /\b(how much|how long|years?|months?|total|combien|dur\u00e9e)\b/.test(normalized)) {
    const duration = results.find((result) => result.id === "experience-total")?.text;
    if (duration) return language === "fr"
      ? "Angad poss\u00e8de environ 2 ans et 6 mois d\u2019exp\u00e9rience professionnelle document\u00e9e, dont 22 mois chez Reliance Jio, 5 mois chez CIMA+ et 3 mois chez IBM."
      : duration;
  }

  if (/\b(database|vector store|stored?|stock|base de donn\u00e9es)\b/.test(normalized) && /\b(cima|embedding|engineering|document)\b/.test(normalized) && /\bchromadb\b/i.test(joined)) {
    return language === "fr"
      ? "Angad a utilis\u00e9 ChromaDB comme base vectorielle pour stocker et r\u00e9cup\u00e9rer les embeddings des documents d\u2019ing\u00e9nierie chez CIMA+."
      : "Angad used ChromaDB as the vector database for storing and retrieving the engineering-document embeddings at CIMA+.";
  }

  if (isProjectsQuestion(query)) {
    const names = relevant.filter(({ metadata }) => metadata?.section === "projects").map(({ metadata }) => metadata.name).filter(Boolean);
    if (names.length) {
      const list = new Intl.ListFormat(language).format(names);
      return language === "fr" ? `Parmi les projets d\u2019Angad figurent ${list}.` : `Angad\u2019s projects include ${list}.`;
    }
  }

  const queryTokens = new Set(tokenize(query).filter((token) => !["angad", "he", "his", "there", "use", "uses", "used", "know", "knows"].includes(token)));
  const candidates = relevant.flatMap((result) => sourceSentences(result.metadata?.highlight || result.text)
    .filter((text) => text.length >= 15 && text.length <= 280)
    .map((text) => ({ text, experience: result.metadata?.highlight === text, score: [...new Set(tokenize(text))].filter((token) => queryTokens.has(token)).length })));
  candidates.sort((left, right) => right.score - left.score || left.text.length - right.text.length);
  const match = candidates[0];
  if (!match?.score) return missing;
  const excerpt = match.text;
  if (language === "fr") {
    const translated = frenchPortfolioFacts.get(excerpt);
    if (translated) return match.experience ? `Il ${translated}` : translated;
    return "Le portfolio contient un passage pertinent en anglais. Je ne peux pas en donner une r\u00e9ponse v\u00e9rifi\u00e9e en fran\u00e7ais pour le moment.";
  }
  const yesNoQuestion = /^(did|does|has|can|is|was)\b/.test(normalized);
  const action = englishHighlights.get(excerpt) || excerpt;
  const specificAnswer = match.experience ? `Angad ${action[0].toLowerCase()}${action.slice(1)}` : thirdPerson(excerpt);
  const negated = /\b(?:not|never|without|no)\b/i.test(excerpt);
  return yesNoQuestion && !negated && [...queryTokens].every((token) => tokenize(excerpt).includes(token)) ? `Yes. ${specificAnswer}` : specificAnswer;
}
