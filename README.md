# AG ⚡ FVD — OLLAMA CHAT

> **Alliance Gagnante — Francis Végiard Dev**

A punk-styled web chat + CLI for your **local** LLM, powered by [Ollama](https://ollama.com).
No cloud. No API keys. No gods, no masters. Just you and the machine. 🤘

- 🖤 Zero dependencies — pure `node:http`, no build step, no framework
- 🦙 Streaming, token-by-token, straight from Ollama's `/api/chat`
- 🎨 Dark punk UI (`#0a0a0f`, pink `#ff2d78`, lime `#a3ff12`, yellow `#ffe600`)
- 💾 Conversations in `localStorage` — nothing leaves your machine
- ⌨️ CLI included for terminal gremlins

---

## Quick start

### 1. Install Ollama

```sh
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull a model

```sh
ollama pull qwen2.5:7b
```

### 3. Start Ollama

```sh
ollama serve
```

### 4. Start the chat

```sh
npm install   # technically optional — zero deps!
npm start
```

→ **http://localhost:4200**

---

## The web UI

- **Model picker** in the header — auto-populated from `/api/models`, refreshed every 15s.
- If Ollama is down, a red banner yells at you: `🦙 Ollama offline — run ollama serve`.
- **Enter** sends, **Shift+Enter** for newline.
- **Stop ■** aborts the stream mid-token (AbortController FTW).
- **+ Nouvelle conversation** — because sometimes you gotta start fresh, camarade.
- Sidebar keeps your conversation history (localStorage key `ollama-chat-v1`).

## CLI

One-shot:

```sh
node cli/chat.js "Explique-moi le punk rock en 3 phrases"
```

Interactive REPL:

```sh
node cli/chat.js
# or via npm
npm run chat
```

Flags:

```sh
node cli/chat.js --model llama3.1:8b --url http://192.168.1.108:11434 "hello"
```

| Flag       | Description                        |
|------------|------------------------------------|
| `--model`  | Model name (default: first available) |
| `--url`    | Ollama base URL                    |
| `--help`   | Show usage                         |

## Configuration

Everything is env-driven. No config files, no secrets, no keys.

| Variable          | Default                   | Description            |
|-------------------|---------------------------|------------------------|
| `OLLAMA_BASE_URL` | `http://localhost:11434`  | Where Ollama lives     |
| `PORT`            | `4200`                    | Web server port        |

### Ollama on another machine (LAN / Tailscale)

Running Ollama on your beefy desktop and chatting from a laptop? Easy:

```sh
OLLAMA_BASE_URL=http://192.168.1.108:11434 npm start
# or over Tailscale
OLLAMA_BASE_URL=http://100.x.y.z:11434 npm start
```

Works for the CLI too:

```sh
OLLAMA_BASE_URL=http://192.168.1.108:11434 npm run chat
```

## API (if you want to build on it)

| Endpoint         | Method | Description                                        |
|------------------|--------|----------------------------------------------------|
| `/api/health`    | GET    | `{ ok: true }`                                     |
| `/api/models`    | GET    | `{ online, models: [...] }` — never throws         |
| `/api/chat`      | POST   | `{ model, messages }` → streamed NDJSON passthrough |

## Screenshot

```
┌──────────────────────────────────────────────────────────────┐
│  [SCREENSHOT HERE — coming soon, on n'est pas pressés]       │
└──────────────────────────────────────────────────────────────┘
```

## Requirements

- Node.js **>= 18** (uses native `fetch` — no `node_modules` nonsense)
- [Ollama](https://ollama.com) running somewhere reachable

## License

MIT © Francis Végiard — voir [LICENSE](LICENSE)

---

*Alliance Gagnante. Code local, esprit libre.* ⚡
