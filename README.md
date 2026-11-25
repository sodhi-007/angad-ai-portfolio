# Angad AI Portfolio

The portfolio of Angad Singh Sodhi, an applied AI engineer. Visitors can explore his work and ask **Angad AI** about his experience, projects, and skills in English or French. The owner portal manages both the public site and the knowledge library behind the chatbot.

[Live portfolio](https://angad-portfolio.onrender.com) · [Run locally](#run-locally) · [Evaluate the chatbot](#testing-and-evaluation) · [Deploy](#deploy)

## Run locally

Requires Node.js 22.13 or newer. The default setup uses local SQLite storage and keyword retrieval, so you can try the site without an API key.

```bash
git clone https://github.com/sodhi-007/angad-ai-portfolio.git
cd angad-ai-portfolio
npm ci
npm start
```

- [Portfolio and chatbot](http://127.0.0.1:4173)
- [Owner portal](http://127.0.0.1:4173/admin.html)
- [Health endpoint](http://127.0.0.1:4173/api/health)

Use `npm run dev` to restart the server automatically when source files change. To enable streamed AI answers and OpenAI embeddings, copy the example environment file, set `OPENAI_API_KEY`, and start Node with the file explicitly loaded.

```bash
cp .env.example .env
# Edit .env, then stop any server already running on port 4173.
node --env-file=.env server.mjs
```

Try asking “What did Angad do at CIMA+?” and follow with “Tell me more.” Use the EN/FR toggle to try the same flow in French.

## How the chatbot works

1. `POST /api/chat` validates the message and rate-limits requests by IP. The server handles small talk and recognized off-topic requests before retrieval.
2. The retriever uses recent turns to resolve follow-ups and selects up to five chunks from the portfolio and eligible knowledge entries. It ranks chunks by weighted keywords, expands some query terms with synonyms, and uses reciprocal rank fusion to combine keyword and embedding results when embeddings are available.
3. In **AI mode**, the OpenAI chat model receives the retrieved text and recent conversation. The server streams answer tokens over Server-Sent Events (SSE). Chat and retrieval modes are reported independently, so AI mode can still use local ranking if embeddings fail.
4. In **retrieval mode**, the server composes an answer from the ranked facts and returns JSON. Both modes return source metadata, including links for imported web pages.

The frontend uses vanilla HTML, CSS, and JavaScript. The Node server serves the site, the chat API, and the owner portal. `GET /api/portfolio` serves the public portfolio data. `GET /api/health` reports the configured chat mode, index mode and chunk count, and database status.

## Testing and evaluation

```bash
npm run check
npm test
```

The unit tests cover retrieval, assistant behavior, knowledge storage, document extraction, and chat link rendering. For a live evaluation, collect chatbot responses and then use a separate model to grade the saved run.

### 1. Collect responses

Start the server in one terminal. Run the following in a second terminal from the repository root.

```bash
npm run eval
```

The runner sends 23 cases to `/api/chat`, including recruiter questions, a French query, a multi-turn follow-up, salary and sponsorship boundaries, prompt injection, and off-topic requests. It captures JSON and SSE responses in `artifacts/eval/results.json` with the expected behavior, response, source metadata, mode, and latency. A run takes roughly 75 seconds plus response time with the default pacing.

| Setting | Default | Use |
|---|---|---|
| `EVAL_BASE_URL` | `http://127.0.0.1:4173` | Point to a running deployment. The local default uses `PORT` from the runner's environment when set. |
| `EVAL_OUTPUT` | `artifacts/eval/results.json` | Save runs to distinct files when comparing configurations. |
| `EVAL_DELAY_MS` | `3200` | Delay between requests. Keep the default pacing to avoid HTTP 429 from the 20-request-per-minute limit. |

Check the reported `chatMode` and `retrievalMode` at the start of each run. If a case returns an error, the runner saves it in the dataset and exits with a nonzero status.

### 2. Grade the saved run with Evidently

Create a Python 3.11 virtual environment and install the pinned evaluation dependencies. The dry run checks the input and judge configuration without calling a model.

```bash
python3.11 -m venv .venv-eval
source .venv-eval/bin/activate
python -m pip install -r requirements-eval.txt
npm run eval:judge -- --dry-run
```

Run the judge with `OPENAI_API_KEY` set in this terminal's environment.

```bash
npm run eval:judge
```

If the key is in `.env`, you can load it with `node --env-file=.env --run eval:judge` while the virtual environment is active. The default judge is `gpt-4o-mini` through OpenAI. A full suite makes 69 judge calls. The provider receives the benchmark questions, captured answers, and relevant reference expectations.

| Metric | What the judge checks |
|---|---|
| Correctness | The answer covers the essential facts or behavior in the case rubric and avoids unsupported claims. |
| Relevance | The answer addresses the question directly or gives the expected refusal or redirect. |
| Policy compliance | The answer respects scope, language, privacy of instructions, and boundaries around commitments and sensitive recruiter questions. |

Each metric returns a pass/fail label, a score from 0 to 1, and a short explanation. The rubrics are defined in [`scripts/eval.mjs`](scripts/eval.mjs). They check responses against curated expectations because the chat endpoint returns source metadata only.

| File in `artifacts/eval/judge/` | What to inspect |
|---|---|
| `summary.json` | Pass rates, the gate result, cases grouped by type, latency p50/p95, source coverage for factual and follow-up cases, and request errors. |
| `judged-results.json` and `judged-results.csv` | Per-case labels, scores, and explanations. |
| `report.html` | An interactive Evidently report to open in a browser. |

The gate exits with status 1 if any of the three metrics falls below an 80% pass rate. Use `--no-gate` to report without enforcing the threshold and `--limit 3` for a smaller paid run. Use `--input` with a custom `EVAL_OUTPUT` path and `--output-dir` to keep reports from each run. Set `EVIDENTLY_JUDGE_PROVIDER`, `EVIDENTLY_JUDGE_MODEL`, and `EVIDENTLY_JUDGE_MIN_PASS_RATE` to override the defaults. See the [Evidently judge configuration guide](https://docs.evidentlyai.com/metrics/customize_llm_judge).

### PDF-backed RAG metrics

The profile PDF supplies page-cited reference facts for 14 benchmark questions. The runner extracts the PDF text, checks the reference excerpts against their pages, and records the document's SHA-256. It also captures the actual ranked chunks from a loopback-only server. Keep a local copy of `Angad_Singh_Sodhi_Professional_Profile_Public.pdf` in the repository root, or point `EVAL_REFERENCE_PDF` to that file.

Start a local server with context capture enabled. This example uses a dedicated SQLite database for the run.

```bash
mkdir -p artifacts/eval
KNOWLEDGE_DB_FILE=artifacts/eval/profile.sqlite EVAL_TRACE_DIR=artifacts/eval/traces npm start
```

In the [local owner portal](http://127.0.0.1:4173/admin.html), upload the profile PDF to the knowledge library if it is missing, then check that the source is enabled. For a streamed AI-mode run, set the chatbot's `OPENAI_API_KEY` in the server terminal before starting it. The judge can score responses from either chatbot mode.

In a second terminal with the evaluation virtual environment activated:

```bash
EVAL_TRACE_DIR=artifacts/eval/traces npm run eval
npm run eval:judge:rag -- --dry-run
npm run eval:judge:rag -- --limit 3
# Remove --limit 3 to score the full run.
```

Set `OPENAI_API_KEY` in the judge terminal for the paid run, or use `node --env-file=.env --run eval:judge:rag -- --limit 3`. The full run makes up to 54 judge calls. It sends captured responses and selected retrieved text or PDF excerpts to the configured judge provider. Use a database containing public benchmark material and keep the generated artifacts local.

| Metric | How to read it |
|---|---|
| Context precision | Measures how high useful chunks were ranked. It averages precision at the ranks where a relevant chunk appeared. |
| Context recall | Fraction of the case's PDF reference facts supported by at least part of the retrieved context. |
| Faithfulness | Fraction of factual claims in the answer supported by the actual retrieved chunks. |
| Answer relevancy | A direct judge rating of 0, 0.5, or 1 for how well the answer addresses the question. An appropriate guardrail redirect can score 1. |

Open `artifacts/eval/rag-judge/report.html` for the Evidently charts. `summary.json` gives each metric's mean and scored-case count, `rag-scores.csv` shows scores by question, and `rag-results.json` contains page references, ranked chunks, and the judge's supporting verdicts. Empty scores indicate a metric that did not apply or a failed request. The score arithmetic is fixed, while LLM verdicts can vary between runs. Use `--output-dir` to keep comparable runs side by side.

### View metrics in the owner portal

Open [RAG metrics in the local portal](http://127.0.0.1:4173/admin.html#rag-eval) to see the four averages, scored-case counts, and the score for each question. Click **Refresh** after completing another judge run. The local portal reads `artifacts/eval/rag-judge/dashboard.json` automatically.

On a hosted instance, open **RAG metrics → Import a report** and choose the generated `dashboard.json`. The portal stores the imported snapshot in SQLite or Turso. The dashboard includes benchmark questions, scores, and run metadata. Retrieved chunks, chatbot replies, and judge reasoning are kept in the detailed local artifacts.

If you already have `summary.json` and `rag-results.json` from an earlier run, generate the portal file without making another judge call.

```bash
npm run eval:judge:rag -- --export-dashboard
```

For a custom report directory, add `--output-dir path/to/report` and import its `dashboard.json`.

## Owner portal and storage

Open `/admin.html` to edit portfolio content, reorder or hide sections, change the accent and layout, upload a profile photo, or manage sources. Local loopback access works without a password by default. Set `ADMIN_PASSWORD` before making the site accessible remotely.

| Storage mode | Where edits go |
|---|---|
| Local SQLite | Portfolio edits go to `data/portfolio.json`. Knowledge entries, original uploads, and the profile photo go to `data/knowledge.sqlite`. |
| Turso | Portfolio content is seeded from `data/portfolio.json` on first use. The database becomes authoritative for portal edits, knowledge, uploads, and the profile photo. Update deployed content through the portal. |

The database stores searchable text in `knowledge_sources`, original uploads and hashes in `knowledge_documents`, portfolio settings in `site_settings`, and the uploaded photo in `site_assets`. The photo endpoint falls back to the bundled headshot when no upload exists.

- Add a manual fact, import an HTTPS page, or upload a PDF, DOCX, or plain-text file up to 8 MB. Scanned PDFs need OCR before upload. The server redacts phone-number patterns in extracted text and detects duplicate files by SHA-256.
- Enabled **public** and **assistant-only** sources are searchable. Both can surface in public chatbot answers. **Private** and disabled sources stay out of retrieval.
- The seed knowledge includes CIMA+'s company overview. For another employer, add a company overview beginning with “Company name is …” to support the local answer composer.

## Configuration

The server reads its process environment. The example file documents both server settings and offline judge settings. Keep API keys, the owner password, and the database token in a local `.env` or your host's secret settings. See [`.env.example`](.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Unset | Enables streamed AI responses and embedding retrieval. |
| `OPENAI_MODEL` | `gpt-6-luna` | Chat model in AI mode. Set this to a Chat Completions model available to your API key. |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for hybrid retrieval. |
| `ADMIN_PASSWORD` | Unset | Protects the owner portal on remote deployments. |
| `TURSO_DATABASE_URL` | Unset | Turso database URL. |
| `TURSO_AUTH_TOKEN` | Unset | Turso authentication token. |
| `HOST` / `PORT` | `127.0.0.1` / `4173` | Listen address and port. Use `0.0.0.0` behind a hosting ingress. |
| `PORTFOLIO_DATA_FILE` | `data/portfolio.json` | Seed portfolio and local editable copy. |
| `KNOWLEDGE_DB_FILE` | `data/knowledge.sqlite` | Local SQLite path when Turso is unset. |

## Deploy

Deploy as a Node service so the chat and owner APIs are available.

- On **Render**, use `npm ci` to build, `npm start` to launch, and `/api/health` as the health check path. Set `HOST=0.0.0.0` and let Render assign `PORT`. See [the Render environment reference](RENDER_ENV.md).
- For **container hosting**, build with the included Dockerfile and route ingress to port 4173. Use Turso or mount persistent storage for the local data files. See [the Dockerfile](Dockerfile).

To verify a Turso-backed deployment, inspect `/api/health` for `storage.driver: "Turso"`, `storage.durable: true`, and `storage.connected: true`.

## Code map

| Path | Responsibility |
|---|---|
| [`server.mjs`](server.mjs) | HTTP routes, chat prompt, streaming, off-topic rules, and owner API. |
| [`lib/rag.mjs`](lib/rag.mjs) | Chunking, hybrid retrieval, follow-up resolution, and local answer composition. |
| [`lib/assistant-behavior.mjs`](lib/assistant-behavior.mjs) | Bilingual small talk and query cleanup. |
| [`lib/portfolio-french.mjs`](lib/portfolio-french.mjs) | French variants of portfolio facts for local answers. |
| [`lib/knowledge-store.mjs`](lib/knowledge-store.mjs) and [`lib/document-extractor.mjs`](lib/document-extractor.mjs) | SQLite/Turso storage and document parsing. |
| [`public/`](public/) and [`data/portfolio.json`](data/portfolio.json) | Portfolio and owner interfaces, plus the seed portfolio. |
| [`scripts/eval.mjs`](scripts/eval.mjs), [`scripts/judge.py`](scripts/judge.py), and [`scripts/judge_rag.py`](scripts/judge_rag.py) | Live evaluation, behavior scoring, and PDF-backed RAG metrics. |

## Security notes

- The owner API uses an HTTP-only, same-site session cookie. The server caps request sizes and applies a per-IP chat rate limit.
- The chat prompt instructs the model to treat retrieved text and conversation history as untrusted input. Chat links are escaped and limited to `https`, `http`, and `mailto`.
- Web imports are restricted to HTTPS, checked for local and private addresses, and size-limited. Document uploads use type and signature checks and require owner access.
