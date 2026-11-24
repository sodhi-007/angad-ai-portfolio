# Angad AI Portfolio

Personal portfolio of Angad Singh Sodhi, applied AI engineer. The site includes **Angad AI**, a retrieval-grounded chatbot that answers visitors' questions about his experience, projects, and skills in English or French. An owner portal lets the site and the chatbot's knowledge library be updated without touching code.

**Live site:** [angad-portfolio.onrender.com](https://angad-portfolio.onrender.com)

## Features

- **Bilingual site and chatbot.** An EN/FR toggle switches page content, and the chatbot answers in the selected language.
- **Grounded answers.** The assistant answers only from retrieved portfolio evidence and shows the sources it used, including links for imported web pages.
- **Hybrid retrieval.** IDF-weighted keyword ranking with synonym expansion, fused with OpenAI embedding similarity through reciprocal rank fusion when an API key is set.
- **Works without an API key.** With no key, the same index runs in local ranked-retrieval mode and composes answers from the retrieved facts.
- **Streaming responses.** In AI mode, answers stream to the browser token by token over Server-Sent Events.
- **Guardrails.** Small talk is handled before retrieval, off-topic requests (code generation, trivia) are declined, retrieved text is treated as untrusted data, and chat links are sanitized to `https`, `http`, and `mailto` only.
- **Owner portal.** Edit content, upload documents, import web pages, and manage what the chatbot can see.
- **Durable storage.** Portal edits, the knowledge library, uploaded documents, and the profile photo are stored in Turso (hosted libSQL), so they survive restarts on hosts with ephemeral disks.
- **Tests and evals.** 44 unit tests plus a scripted evaluation run against a live server.

## How the chatbot works

Each message to `/api/chat` goes through these steps:

1. **Validation and rate limiting.** Messages are capped at 800 characters and the endpoint is rate-limited per IP.
2. **Small talk.** Greetings, thanks, goodbyes, and "what can you do?" questions get a direct reply in `lib/assistant-behavior.mjs`, with no retrieval or model call.
3. **Off-topic guard.** Requests unrelated to Angad receive a short redirect instead of an answer.
4. **Follow-up resolution.** Short follow-ups such as "tell me more" are expanded using recent chat history.
5. **Retrieval.** `lib/rag.mjs` ranks chunks built from `data/portfolio.json` and the knowledge library and keeps the top 5.
6. **Answer.**
   - **AI mode** (`OPENAI_API_KEY` set): the evidence and recent conversation go to the OpenAI Chat Completions API and the reply streams back over SSE. If the stream fails before it starts, the server falls back to local mode.
   - **Retrieval mode** (no key): `localRagAnswer` builds the reply from retrieved facts, written in the third person.

## Tech stack

| Layer | Tools |
|---|---|
| Server | Node.js 22.13+ (`node:http`, no web framework) |
| Frontend | Vanilla HTML, CSS, and JavaScript |
| LLM and embeddings | OpenAI Chat Completions (streaming), `text-embedding-3-small` |
| Storage | Turso / libSQL via `@libsql/client`, local SQLite file in development |
| Document parsing | `pdf-parse` (PDF), `mammoth` (DOCX), plain text |
| Testing | `node:test`, `scripts/eval.mjs` |
| Hosting | Render (Docker image also provided) |

## Project structure

```
server.mjs                  HTTP server, chat endpoint, owner portal API, LLM prompt
lib/
  rag.mjs                   Chunking, hybrid retrieval, local answer composer
  assistant-behavior.mjs    Small-talk replies and query clean-up
  chat.mjs                  Earlier keyword-based topic answers (tests only, not used by the server)
  knowledge-store.mjs       Turso / SQLite storage for knowledge, settings, photo
  document-extractor.mjs    PDF, DOCX, and text extraction
  portfolio-french.mjs      French versions of portfolio facts
public/                     Site (index.html, app.js, styles.css) and portal (admin.*)
data/portfolio.json         Seed portfolio content
scripts/eval.mjs            Evaluation run against a live server
test/                       Unit tests
Dockerfile                  Container image
RENDER_ENV.md               Render environment variable reference
```

## Run locally

Requirements: Node.js 22.13 or newer.

```bash
git clone https://github.com/sodhi-007/angad-ai-portfolio.git
cd angad-ai-portfolio
npm ci
npm start
```

Open:

- Portfolio: `http://127.0.0.1:4173`
- Owner portal: `http://127.0.0.1:4173/admin.html`

The owner portal opens without a password on the local machine. Set `ADMIN_PASSWORD` for any remote or public deployment.

For automatic restarts while editing:

```bash
npm run dev
```

Copy `.env.example` to configure optional settings. Without any variables, the site runs in retrieval mode with local SQLite storage.

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | *(unset)* | Enables AI mode and embedding retrieval. Without it the chatbot uses local retrieval. |
| `OPENAI_MODEL` | `gpt-6-luna` | Chat model used in AI mode. |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for hybrid retrieval. |
| `ADMIN_PASSWORD` | *(unset)* | Required to use the owner portal remotely. |
| `TURSO_DATABASE_URL` | *(unset)* | `libsql://...` URL for durable storage. |
| `TURSO_AUTH_TOKEN` | *(unset)* | Auth token for the Turso database. |
| `HOST` | `127.0.0.1` | Use `0.0.0.0` when hosting. |
| `PORT` | `4173` | Hosts such as Render inject their own. |
| `PORTFOLIO_DATA_FILE` | `data/portfolio.json` | Seed and local content file. |
| `KNOWLEDGE_DB_FILE` | `data/knowledge.sqlite` | Local SQLite file, used only when Turso is not configured. |

Keep the API key and admin password on the server only. Never put them in browser JavaScript, HTML, the repository, or a committed `.env` file.

## Owner portal

Use `/admin.html` to:

- edit profile, contact, experience, projects, skills, education, certifications, and languages;
- add, remove, reorder, or hide sections and items;
- switch compact or standard spacing and change the accent colour;
- upload a new profile photo;
- add manual facts to the knowledge library;
- upload PDF, DOCX, and plain-text documents for server-side text extraction;
- import selected public HTTPS pages as trusted chatbot sources;
- mark knowledge as public, assistant-only, private, enabled, or disabled;
- save changes and rebuild the retrieval index.

Anything enabled in the knowledge library can appear in public chatbot answers. Review documents before uploading and remove private details (application status, target companies, personal notes) first.

## Storage

Storage mode is chosen by environment variables:

- **Turso (hosting).** With `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set, the knowledge library, uploaded documents, portal edits, and profile photo are stored in Turso and survive restarts and redeploys. On first start the database is seeded from `data/portfolio.json`. After that, **the database is the source of truth**, and later edits to `data/portfolio.json` in git are ignored. Make content changes in the portal.
- **Local file (development).** Without those variables, knowledge, documents, and the photo go to `data/knowledge.sqlite`, and portal edits are written to `data/portfolio.json`.

The profile photo is served from `/profile-photo`, falling back to the committed `public/profile-headshot.jpg` until one is uploaded.

The schema has four tables:

- `knowledge_sources`: searchable content, visibility, tags, and retrieval state;
- `knowledge_documents`: the original file, filename, MIME type, size, page count, and SHA-256 hash, linked to its source by a foreign key;
- `site_settings`: portfolio content;
- `site_assets`: the profile photo.

Uploading a file extracts its text, redacts phone-number patterns, creates both records, and rebuilds retrieval. Duplicate files are detected by hash. Uploads are limited to 8 MB. Scanned PDFs need OCR first, since the extractor reads selectable text only.

Web imports are curated rather than open-ended: the owner picks each page, and the server accepts public HTTPS HTML or text only, blocks local and private network addresses, extracts readable text, and records the source URL. The library starts with an assistant-only entry describing CIMA+ from the company's official About page.

## Customizing the assistant

- **Model instructions** (AI mode) are built in `buildChatMessages()` in `server.mjs`. This is where tone, answer length, grounding rules, scope, and the reply for salary, visa, and availability questions are set.
- **Small talk and limits** replies, in English and French, live in `smallTalkReply()` in `lib/assistant-behavior.mjs`. Recent history prevents repeated introductions, and a greeting followed by a real question still goes to retrieval.
- **Retrieval-mode answers** are composed in `lib/rag.mjs`. Company overviews combine a company description, one role summary, and up to two contributions. To support a new company, add an enabled knowledge entry beginning "Company name is ...". Missing descriptions are acknowledged, not invented.
- **Off-topic rules** are in `isOffTopic()` in `server.mjs`.

After changing prompt or response code, commit to the deployed branch and redeploy. With Turso configured, portal data and uploaded documents are unaffected.

## Testing and evaluation

```bash
npm run check   # syntax check of server and client modules
npm test        # 44 unit tests (retrieval, behavior, storage, extraction, link rendering)
```

`scripts/eval.mjs` sends 23 recruiter-style questions to a running server and prints each answer with its mode, sources, and latency. Cases include role and project questions, a French query, a multi-turn follow-up, salary and visa questions, a request to commit on Angad's behalf, prompt injection, and off-topic requests.

```bash
npm start                  # in one terminal
node scripts/eval.mjs      # in another (uses PORT, default 4173)
```

## Deploy

The chatbot needs `/api/chat` and a database, so deploy this as a Node service, not a static site.

### Render (current host)

- Build command: `npm ci`
- Start command: `npm start`
- Runtime: Node 22.13+
- Environment variables: see [`RENDER_ENV.md`](RENDER_ENV.md)
- Health check: `/api/health` (reports chat mode, retrieval mode, chunk count, and `storage.driver` / `storage.durable`)

Render's free tier wipes local disk on restart, so set the Turso variables for anything edited in the portal to persist. It also sleeps after 15 idle minutes, and the first visit afterwards takes about a minute. An uptime monitor requesting `/api/health` every 10 minutes keeps it awake, and one always-on free service fits within the monthly free instance hours.

### Azure Container Apps or another container host

Build from the included `Dockerfile`. The image sets `HOST=0.0.0.0` and `PORT=4173`, so point ingress at port 4173. Add `OPENAI_API_KEY`, `ADMIN_PASSWORD`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN` as secrets. Without Turso, mount persistent storage and point `PORTFOLIO_DATA_FILE` and `KNOWLEDGE_DB_FILE` at it.

## Security notes

- The API key stays server-side.
- Strict content-security and browser-permission headers are applied.
- Chat input is length-limited, request bodies are capped, and the chat endpoint has an in-memory per-IP rate limit.
- The owner portal uses an HTTP-only, same-site session cookie and requires a password when accessed remotely.
- Model instructions restrict answers to retrieved evidence and treat that evidence, and the chat history, as untrusted data rather than instructions.
- Chat links are HTML-escaped and limited to `https`, `http`, and `mailto`.
- Imported web sources are HTTPS-only, size-limited, and screened against private and local addresses.
- Document uploads are type-checked, signature-checked, size-limited, and available only through authenticated owner endpoints.

For a larger public launch, add edge rate limiting or bot protection, and review privacy and consent language for your jurisdiction.
