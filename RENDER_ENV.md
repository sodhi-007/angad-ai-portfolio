# Render Environment Variables

Add these in **Render → Environment → Environment Variables**.

## Required

| Key | Value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | Enables AI chat mode. Without it the chatbot is retrieval-only. |
| `ADMIN_PASSWORD` | *(your password)* | Protects the owner portal on a public URL. |

## Recommended

| Key | Value | Notes |
|---|---|---|
| `HOST` | `0.0.0.0` | Lets Render's proxy reach the server. Default `127.0.0.1` may block external traffic. |

## Optional (defaults are fine)

| Key | Default | Notes |
|---|---|---|
| `OPENAI_MODEL` | `gpt-6-luna` | Change to use a different OpenAI model. |
| `OPENAI_EMBEDDING_MODEL` | `text-embedding-3-small` | Change to use a different embedding model. |

## Do NOT set on Render

| Key | Reason |
|---|---|
| `PORT` | Render injects its own `PORT` automatically. |
| `PORTFOLIO_DATA_FILE` | Uses `data/portfolio.json` by default — correct on Render. |
| `KNOWLEDGE_DB_FILE` | Uses `data/knowledge.sqlite` by default — correct on Render. |
