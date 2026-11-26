# Angad AI Portfolio

This is Angad Singh Sodhi’s portfolio. Visitors can explore his work and ask a chatbot about his experience in English or French. Angad can edit the site, manage the information the chatbot searches, and see how well it answered a set of test questions.

[Visit the portfolio](https://angad-portfolio.onrender.com) · [Open the owner’s RAG metrics](https://angad-portfolio.onrender.com/admin.html#rag-eval) · [See evaluation runs on GitHub](https://github.com/sodhi-007/angad-ai-portfolio/actions/workflows/rag-eval.yml)

[How scores are calculated](#how-to-read-the-four-metrics) · [How we fixed a failed run](#how-we-troubleshot-a-failed-run) · [Local setup](#run-locally)

## How the chatbot answers a question

Suppose a visitor asks **“What did Angad do at CIMA+?”**

1. **Find evidence.** The Node.js server searches the portfolio and enabled knowledge sources. It ranks short passages, called *chunks*, and selects up to five. It uses word matching and, when available, embeddings that help it find similar meanings.
2. **Write the answer.** In AI mode, the server sends the question, recent conversation, and selected passages to the OpenAI chat model. The model is instructed to base its facts on those passages. The visitor sees the answer appear as it is written. Without an OpenAI key, the server can still compose an answer from the ranked facts.
3. **Carry the conversation forward.** If the visitor asks “Tell me more,” the server uses recent turns to identify the topic and retrieve more evidence. It can also handle greetings and recognized off-topic questions directly.

This is **retrieval-augmented generation (RAG)**. Uploading the profile PDF makes its text searchable once enabled. Updating a source changes the evidence available for future answers without retraining the model.

### What runs where?

| Part | Its job |
| --- | --- |
| Public site on Render | Displays the portfolio and chat interface. A Node.js server serves the pages and handles questions. |
| Owner portal and storage | The owner edits the site, uploads knowledge, and reads evaluation results. Turso keeps hosted edits, uploads, the photo, and the published report across restarts. Local development uses JSON and SQLite. |
| GitHub Actions | Runs the benchmark against the deployed chatbot. It captures the actual answer and the passages the chatbot retrieved for each question. |
| Evidently and the judge model | The open-source Evidently Python library sends this project’s grading instructions and evidence to a separate model, OpenAI’s `gpt-4o-mini` by default. The scoring script turns its judgments into numbers. This setup runs on the GitHub runner without an Evidently Cloud account. [Evidently’s judge guide](https://docs.evidentlyai.com/metrics/customize_llm_judge) |

## Does every evaluation use the same dataset?

**Yes for the questions and reference facts at a given version. Every full run collects new answers and grades them again.** The benchmark is a set of test conversations defined in this repository. Its scores describe those cases.

| What the run uses | What stays fixed or can change |
| --- | --- |
| **23 named questions** | The runner uses the same list in the same order until someone edits it. It covers work experience, French, a follow-up, recruiter boundaries, and off-topic requests. The follow-up “Tell me more” receives the CIMA+ answer from that particular run. [Benchmark questions](lib/eval-cases.mjs) |
| **PDF reference facts for 14 questions** | The nine-page profile supplies 31 question-to-fact references. Some questions share facts. Each run checks that the cited excerpt still appears on its assigned page and records the PDF’s SHA-256 fingerprint. [Profile PDF](Angad_Singh_Sodhi_Professional_Profile_Public.pdf) · [Facts and page references](scripts/eval-reference.mjs) |
| **Retrieved passages and answers** | The live site answers each question against its current portfolio and enabled sources. An edit in the owner portal can change the passages even on the same code version. The repository PDF is the judge’s reference copy. To make it searchable by the live chatbot, upload and enable it under **Admin → Knowledge**. |
| **Judge decisions and scores** | A language model decides which passages are useful, which facts or claims they support, and how directly an answer responds. Its decisions can vary, even on the same saved inputs. Once the decisions are fixed, the arithmetic gives the same scores. [Judge instructions and calculations](scripts/judge_rag.py) |

## How to read the four metrics

All four are scored per question. The portal shows each metric as a percentage and gives each scored question equal weight in that metric’s average. **14/23 scored** means 14 questions contributed to that card. A dash in the question table means the score is unavailable and is excluded from the average.

| Metric | What is calculated for one question | Which questions count? |
| --- | --- | --- |
| **Context precision** | Did useful passages appear near the top? At each rank the judge marked useful, divide useful passages seen so far by passages seen so far. Average those fractions. Zero useful passages gives 0. | The 14 questions with PDF reference facts. |
| **Context recall** | How much of the expected evidence did retrieval find? Divide the number of expected PDF facts supported by the retrieved passages by the number of expected facts for that question. | The same 14 questions. For both retrieval metrics, returning no passages on an eligible question scores 0. |
| **Faithfulness** | Did the answer stay grounded? The judge breaks the answer into factual claims. Divide claims supported by the retrieved passages by all factual claims it identified. | Factual and follow-up answers with at least one factual claim. |
| **Answer relevancy** | Did the answer address the request? The judge assigns **1** for a sufficient answer, **0.5** for a partial answer, or **0** for an unrelated or evasive answer. It assesses responsiveness independently of factual accuracy. An appropriate refusal can earn 1. | Every successfully answered benchmark question, including boundary and off-topic cases. |

**A worked example.** The CIMA+ question has four reference facts, covering the bilingual agent, employee reach, search-time reduction, and document volume. Suppose the judge picks passages **1 and 3** as useful and finds **three of the four** facts across them. Context precision is `(1/1 + 2/3) / 2 = 83.3%`. Context recall is `3/4 = 75%`. If the answer makes two claims and both are supported, faithfulness is `2/2 = 100%`. The judge then reads the question and answer to grade relevancy. An answer can stick to its evidence and still leave part of the question unanswered.

## Automatic runs on Render

1. **Start a run.** GitHub Actions starts automatically when a push to `main` changes a path listed in the workflow, including chatbot code, the benchmark, or the reference PDF. To measure a knowledge-library edit or request a fresh run, open **Actions → RAG evaluation → Run workflow**, choose **main**, and confirm. README-only changes and ordinary visitor chats do not trigger the benchmark. [Open the workflow](https://github.com/sodhi-007/angad-ai-portfolio/actions/workflows/rag-eval.yml) · [Trigger paths](.github/workflows/rag-eval.yml)
2. **Collect and grade.** The runner waits until Render serves the exact Git commit being tested. It asks the 23 questions through the authenticated benchmark endpoint, captures the answers and ordered passages, and runs the judge. One judge task assesses both retrieval metrics. The others assess faithfulness and answer relevancy.
3. **Read the result.** Sign in to **Admin → RAG metrics**. The four cards show averages and coverage. The table shows individual questions. The heading identifies the model, run time, and tested commit. **Refresh** reloads the saved report. A failed run leaves the preceding published report visible. A green workflow means the benchmark completed and published its results. This workflow has no minimum score threshold. [Open RAG metrics](https://angad-portfolio.onrender.com/admin.html#rag-eval)

### One-time hosted setup

| Setting | Where it belongs | What it does |
| --- | --- | --- |
| `RAG_EVAL_TOKEN` | Same value in Render’s environment and GitHub’s repository Actions secrets | Generate it yourself with `openssl rand -hex 32`. It authorizes the runner to collect benchmark traces and publish scores. |
| `OPENAI_API_KEY` | GitHub Actions secret for the judge. Render environment for AI chat and embeddings. | Each service uses its own configured key for its model calls. |
| `ADMIN_PASSWORD`, `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Render environment | Protect the owner portal and persist its data. |

On GitHub, add secrets under **Settings → Secrets and variables → Actions**. On Render, deploy the Node service with `npm ci`, `npm start`, `HOST=0.0.0.0`, and health check path `/api/health`. Render supplies the port. [Render configuration](RENDER_ENV.md) · [Environment settings and model overrides](.env.example) · [Dockerfile](Dockerfile)

## How we troubleshot a failed run

The evaluation has separate steps for configuration, collection, scoring, and publication. The first failed step tells you where to look.

| What happened | How we narrowed it down |
| --- | --- |
| The first attempt stopped at **Check configuration**. | The runner checks the benchmark token format and the presence of the judge key before collecting answers. After the secrets were configured, collection reached all 23 cases. [Original attempt](https://github.com/sodhi-007/angad-ai-portfolio/actions/runs/45856725602/attempts/1) |
| A later attempt collected the answers and then failed at **Score the benchmark with Evidently**. | We added diagnostics naming the case and invalid field without logging credentials or captured text. They identified the Kubernetes question. Its judge output did not satisfy the required format for the list of relevant passages. [Diagnostic run](https://github.com/sodhi-007/angad-ai-portfolio/actions/runs/45866648371) |
| We changed how the judge reports its decision. | The earlier format required one true/false entry for every passage. The judge now selects numbered passage ranks and fact numbers, such as `[1, 3]`. The parser validates the selections and lets Evidently retry malformed output before scoring. [Fix and code changes](https://github.com/sodhi-007/angad-ai-portfolio/commit/ecfdb2a) |
| We verified the result on the live deployment. | The run for `ecfdb2a` collected 23/23 answers and published all 23 to the owner portal. It recorded **90.1% precision** (14 scored), **92.9% recall** (14), **100% faithfulness** (17), and **91.3% relevancy** (23). These figures belong to that run. [Successful run](https://github.com/sodhi-007/angad-ai-portfolio/actions/runs/45867346780) |

If the dashboard looks old, compare its commit and time with the GitHub run. Open the **evaluate** job and expand the first failed step. At collection, check the Render deployment, token match, or cited PDF page named in the error. At scoring, read the provider error or case and field. At publication, check whether Render moved to a newer commit while the benchmark was running.

## Run locally

The hosted portal and evaluation work without a local setup. To develop the project, use Node.js 22.13 or newer.

```bash
git clone https://github.com/sodhi-007/angad-ai-portfolio.git
cd angad-ai-portfolio
npm ci
npm start
```

Open the [local portfolio](http://127.0.0.1:4173) or [local owner portal](http://127.0.0.1:4173/admin.html). The default uses keyword retrieval. To enable OpenAI locally, copy `.env.example` to `.env`, fill in your key, stop the running server, and start it with `node --env-file=.env server.mjs`. Use `npm run dev` for automatic restarts, `npm run check` for syntax checks, and `npm test` for unit tests.

The portal supports manual facts, HTTPS page imports, and uploads of text-based PDFs, DOCX, or plain text up to 8 MB. Enabled **public** and **assistant-only** sources can both contribute to public answers. Private and disabled sources are excluded. Locally, portfolio edits go to `data/portfolio.json` and uploads go to SQLite. With Turso, the JSON seeds the database on first use. Make subsequent live edits in the portal.

<details>
<summary>Reproduce a score or inspect a judge decision</summary>

Start a local server that records the passages used for each answer. Upload and enable the profile PDF in this server’s knowledge library if needed.

```bash
EVAL_TRACE_DIR=artifacts/eval/traces npm start
```

In a second terminal, collect a run and set up the Python judge. Set `OPENAI_API_KEY` in the judge terminal before paid model calls. The dry run validates the inputs without calling the model.

```bash
EVAL_TRACE_DIR=artifacts/eval/traces npm run eval
python3.11 -m venv .venv-eval
source .venv-eval/bin/activate
python -m pip install -r requirements-eval.txt
npm run eval:judge:rag -- --dry-run
npm run eval:judge:rag
```

- **Inspect the evidence.** The capture is `artifacts/eval/results.json`. In `artifacts/eval/rag-judge/`, open `report.html` for Evidently charts, `rag-results.json` for each case’s passages and verdicts, `rag-scores.csv` for per-question scores, or `summary.json` for averages and counts. The hosted workflow publishes only the compact `dashboard.json` to the portal. Detailed files are available when you retain the runner’s output locally. The judge provider receives the captured text needed for each task.
- **Measure judge variability.** Before collecting another run, grade the same capture again with `npm run eval:judge:rag -- --input artifacts/eval/results.json --output-dir artifacts/eval/regrade`. This keeps the chatbot answers, passages, and references fixed and asks for fresh judgments. Use `--limit 3` for a smaller trial.
- **View existing scores again.** To rebuild `dashboard.json` from saved summaries and verdicts, use `npm run eval:judge:rag -- --export-dashboard`. This makes zero model calls. The local portal reads the default dashboard file, and the owner portal also supports **Import a report**.
- **Run the separate behavior check.** `npm run eval:judge` grades correctness, relevance, and policy compliance against each question’s written expectations. Its default pass-rate threshold is 80% for each metric. The production dashboard uses the four RAG metrics above. [Behavior judge](scripts/judge.py)

</details>

## Where to find the code

| If you want to change… | Start here |
| --- | --- |
| Visitor pages or the owner portal | [Web interface](public/) |
| Chat requests, model instructions, or streaming | [Node server](server.mjs) |
| How passages are ranked or follow-ups are resolved | [Retriever](lib/rag.mjs) · [Conversation handling](lib/assistant-behavior.mjs) |
| Portfolio content or how documents enter the library | [Seed portfolio](data/portfolio.json) · [Knowledge storage](lib/knowledge-store.mjs) · [Document extraction](lib/document-extractor.mjs) |
| Test questions, reference facts, or grading | [Cases](lib/eval-cases.mjs) · [PDF references](scripts/eval-reference.mjs) · [Response collector](scripts/eval.mjs) · [RAG judge](scripts/judge_rag.py) |
