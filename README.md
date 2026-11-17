# AI Engineer Portfolio

A responsive, dark personal portfolio inspired by the restrained typography, fixed navigation, network backdrop, and subtle cards of the supplied reference site. The content and interaction model are original and tailored to an AI engineer.

The project has no runtime dependencies. Node serves the website, an owner editing portal, and a retrieval-augmented chatbot. The OpenAI API key stays on the server. With a key, the server embeds portfolio chunks, retrieves the best evidence by cosine similarity, and sends only that evidence to the Responses API. Without a key, the same chunks use tested local ranked retrieval.

## Run locally

Requirements: Node.js 20 or newer.

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
- save changes and rebuild the chatbot retrieval index.

Changes are written to `data/portfolio.json`. The profile upload is saved in `public/`.

## Enable live AI answers (optional)

The chatbot already works without a key. To enable live, grounded answers, set environment variables only on the server:

```bash
export OPENAI_API_KEY="your-key"
export OPENAI_MODEL="gpt-6-luna"
export OPENAI_EMBEDDING_MODEL="text-embedding-3-small"
export ADMIN_PASSWORD="choose-a-long-unique-password"
npm start
```

Do not add the key or admin password to browser JavaScript, HTML, a public repository, or a committed `.env` file. The server retrieves the most relevant portfolio chunks, sends those chunks plus recent chat context to the Responses API, requests `store: false`, and falls back to local retrieval if the API is unavailable.

## Deploy

Because the chatbot uses `/api/chat`, deploy this as a small Node service rather than as a static-only GitHub Pages site.

### Azure Container Apps

Build a container from the included `Dockerfile`, deploy it to Azure Container Apps, and add `OPENAI_API_KEY` and `ADMIN_PASSWORD` as secret-backed environment variables. The image already sets `HOST=0.0.0.0` and `PORT=4173`; public container ingress should target port 4173. Because the owner portal writes portfolio data and images, mount persistent storage and point `PORTFOLIO_DATA_FILE` to the mounted JSON path before relying on edits in production.

### Render, Railway, Fly.io, or another Node host

- Build command: none required
- Start command: `npm start`
- Runtime: Node 20+
- Optional secret: `OPENAI_API_KEY`
- Required secret for remote editing: `ADMIN_PASSWORD`
- Optional variable: `OPENAI_MODEL=gpt-6-luna`
- Optional variable: `OPENAI_EMBEDDING_MODEL=text-embedding-3-small`
- Health endpoint: `/api/health`

If you want static hosting, publish `public/` and point the chat request to a separately hosted serverless endpoint. Never put the API key in client-side code.

## Security notes

- API key remains server-side.
- Strict content-security and browser-permission headers are applied.
- Chat input is length-limited and request bodies are capped.
- A small in-memory per-IP rate limit protects the public chat endpoint.
- The owner portal uses an HTTP-only, same-site session cookie and requires a server-side password when accessed remotely.
- Model instructions restrict answers to retrieved portfolio evidence.
- The no-key fallback returns locally retrieved evidence rather than fixed intent answers.

For a public production launch, add an external rate limiter or bot protection at the hosting edge and review privacy/consent language for your jurisdiction.
