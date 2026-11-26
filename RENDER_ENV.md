# Render Environment Variables

Add these in **Render → Environment → Environment Variables**.

## Required

| Key | Value | Notes |
|---|---|---|
| `TURSO_DATABASE_URL` | `libsql://...` | Durable storage for portal edits, knowledge, documents, and the profile photo. Render's free tier wipes local disk on restart, so without this, edits are lost. |
| `TURSO_AUTH_TOKEN` | *(your token)* | Auth token for the Turso database. |
| `ADMIN_PASSWORD` | *(your password)* | Protects the owner portal on a public URL. |

## Recommended

| Key | Value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | Enables AI mode and embedding retrieval. Without it the chatbot uses local retrieval only. |
| `HOST` | `0.0.0.0` | Lets Render's proxy reach the server. The default `127.0.0.1` may block external traffic. |

## Optional (defaults are fine)

| Key | Default | Notes |
|---|---|---|
| `OPENAI_MODEL` | `gpt-6-luna` | Chat model used in AI mode. |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Embedding model for hybrid retrieval. |
| `RAG_EVAL_TOKEN` | *(unset)* | Enables the hosted benchmark. Use the same 64-character hex secret in Render and GitHub Actions. See [hosted RAG evaluation](README.md#automatic-runs-on-render). |

## Do NOT set on Render

| Key | Reason |
|---|---|
| `PORT` | Render injects its own `PORT` automatically. |
| `PORTFOLIO_DATA_FILE` | Only the seed file is read once Turso is configured; the default is correct. |
| `KNOWLEDGE_DB_FILE` | Only used when Turso is not configured. |

After deploying, open `/api/health` and confirm `storage.driver` is `Turso` and `storage.durable` is `true`.
