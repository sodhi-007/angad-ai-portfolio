# AI Engineer Portfolio

A responsive, dark personal portfolio inspired by the restrained typography, fixed navigation, network backdrop, and subtle cards of the supplied reference site. The content and interaction model are original and tailored to an AI engineer.

The project has no runtime dependencies. Node serves the website, an owner editing portal, and a retrieval-augmented chatbot. The OpenAI API key stays on the server. With a key, the server embeds portfolio chunks, retrieves the best evidence by cosine similarity, and sends only that evidence to the Responses API. Without a key, the same chunks use tested local ranked retrieval.

## Run locally

Requirements: Node.js 22.13 or newer (the project uses Node's built-in SQLite database).

```bash
cd portfolio-site
npm start
```

Open:

- Portfolio: `http://127.0.0.1:4173`
- Owner portal: `http://127.0.0.1:4173/admin.html`

The owner portal opens automatically on the local computer. For any remote or public deployment, set `ADMIN_PASSWORD`.

For automatic restarts while editing:

```bash
npm run dev
```

Run the checks:

```bash
npm run check
npm test
```

## Owner portal

Use `/admin.html` to:

- edit profile, contact, experience, projects, skills, education, certifications, and languages;
- add or remove repeatable items;
- reorder or hide website sections;
- switch compact/standard spacing and change the accent colour;
- upload a new profile image;
- add manual facts to a searchable knowledge library;
- upload PDF, DOCX, and plain-text documents for private server-side extraction;
- import selected public HTTPS pages as trusted chatbot sources;
- mark knowledge as public, assistant-only, private, enabled, or disabled;
- save changes and rebuild the chatbot retrieval index.

Portfolio changes are written to `data/portfolio.json`. Extra chatbot knowledge is stored in the local SQLite database at `data/knowledge.sqlite`; set `KNOWLEDGE_DB_FILE` to place it elsewhere. The profile upload is saved in `public/`.

The SQLite schema uses two connected tables: `knowledge_sources` stores searchable content, visibility, tags, and retrieval state; `knowledge_documents` stores the original private file, filename, MIME type, size, page count, and content hash. A document source links the two records with a foreign key. Uploading a file extracts text on the server, redacts phone-number patterns from searchable text, creates both records in one database, and immediately rebuilds retrieval. Duplicate document bytes are detected by SHA-256 hash. Uploaded files are limited to 8 MB. Scanned PDFs need OCR before upload because the current extractor indexes selectable text.

The library starts with an assistant-only entry describing CIMA+ from the company's official About page. Web access is curated rather than unrestricted: the owner chooses each page to import, the server accepts public HTTPS HTML/text pages only, blocks local/private network addresses, extracts readable text, records the source URL, and rebuilds retrieval. This keeps answers grounded and prevents the assistant from treating arbitrary search results as facts.

## Enable live AI answers (optional)

### Assistant behavior

Edit `SYSTEM_PROMPT` in `lib/assistant-behavior.mjs` to change the assistant's role, tone, answer structure, and grounding rules. `server.mjs` passes this prompt to the language model and supplies retrieved evidence separately as reference data.

The same module handles greetings (including "yo" and "wassup"), introductions, thanks, and goodbyes before retrieval or any AI request. Recent chat history prevents repeated introductions. A greeting followed by a factual question still reaches retrieval.

Without an API key, `lib/rag.mjs` composes company overviews from retrieved company descriptions, one role summary, and up to two distinct contributions. Add company descriptions as enabled knowledge entries in the owner portal, for example a sourced sentence beginning "Company name is ...". Missing descriptions are acknowledged, not fabricated. Specific questions keep their focused retrieval path. Local mode preserves source language for extracted facts; fluent paraphrasing, translation, and contextual follow-ups require the AI mode.

After changing the prompt or response code, commit the changes to the deployed GitHub branch and deploy that commit on Render. Preserve owner-portal data and uploaded documents before redeploying if the service uses ephemeral storage.

The chatbot already works without a key. To enable live, grounded answers, set environment variables only on the server:

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-6-luna"
export OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
export ADMIN_PASSWORD="choose-a-long-unique-password"
npm start
```

Do not add the key or admin password to browser JavaScript, HTML, a public repository, or a committed `.env` file. The server retrieves the most relevant portfolio and SQLite knowledge chunks, sends those chunks plus recent chat context to the Responses API, requests `store: false`, and falls back to local retrieval if the API is unavailable. The public chat displays links for retrieved web sources.

## Deploy

Because the chatbot uses `/api/chat` and SQLite, deploy this as a small Node service rather than as a static-only GitHub Pages site. A deployment must preserve both `data/portfolio.json` and `data/knowledge.sqlite` if you want owner-portal edits and uploaded documents to survive restarts.

### Azure Container Apps

Build a container from the included `Dockerfile`, deploy it to Azure Container Apps, and add `OPENAI_API_KEY` and `ADMIN_PASSWORD` as secret-backed environment variables. The image already sets `HOST=0.0.0.0` and `PORT=4173`; public container ingress should target port 4173. Because the owner portal writes portfolio data, knowledge, and images, mount persistent storage and point `PORTFOLIO_DATA_FILE` and `KNOWLEDGE_DB_FILE` to mounted paths before relying on edits in production.

### Render, Railway, Fly.io, or another Node host

- Build command: none required
- Start command: `npm start`
- Runtime: Node 22.13+
- Optional secret: `OPENAI_API_KEY`
- Required secret for remote editing: `ADMIN_PASSWORD`
- Optional variable: `OPENAI_MODEL=gpt-6-luna`
- Optional variable: `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
- Optional variable: `KNOWLEDGE_DB_FILE=/persistent/path/knowledge.sqlite`
- Health endpoint: `/api/health`

For a free-tier target, the next deployment step is Cloudflare Workers plus D1 and R2. D1 holds structured knowledge and extracted text; R2 holds original uploaded files. The current local adapter keeps both in SQLite for a simple self-contained setup, so deployment needs a storage-adapter migration rather than a change to the portal workflow. Static hosting alone is insufficient for the editor and chatbot. Never put the API key in client-side code.

## Security notes

- API key remains server-side.
- Strict content-security and browser-permission headers are applied.
- Chat input is length-limited and request bodies are capped.
- A small in-memory per-IP rate limit protects the public chat endpoint.
- The owner portal uses an HTTP-only, same-site session cookie and requires a server-side password when accessed remotely.
- Model instructions restrict answers to retrieved portfolio evidence.
- The no-key fallback returns locally retrieved evidence rather than fixed intent answers.
- Imported web sources are HTTPS-only, size-limited, and screened against private/local addresses.
- Document uploads are type-checked, signature-checked, size-limited, and available only through authenticated owner endpoints.

For a public production launch, add an external rate limiter or bot protection at the hosting edge and review privacy/consent language for your jurisdiction.
