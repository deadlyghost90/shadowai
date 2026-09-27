# ShadowAI

**by ShadowMotion**

A conversation-first AI workspace. Open it, start typing, chat. Switch to Agent when the work
takes several steps. Everything — including generated files — stays in one thread.

ShadowAI ships with **no model of its own**. It is already pointed at Shadow v1.1; you can
point it anywhere you like.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

You will land on the sign-in door. Create an account with Google or email and password,
answer nine short questions, and you are in.

Shadow v1.1 is already wired up via `.env`. To try everything without touching a real model,
run the bundled mock in a second terminal — it speaks the same two wire formats:

```bash
node tools/mock-model.mjs     # :8899
```

…and point **Settings → Model** at `http://localhost:8899`.

---

## Connecting your model

ShadowAI talks to models through a single interface, `AIProvider`
(`src/lib/ai/types.ts`). Nothing in the UI knows which vendor is serving.

```ts
interface AIProvider {
  id: string
  label: string
  models(): ProviderModel[]
  chat(req: ProviderRequest): Promise<void>   // streams via req.onDelta, honours req.signal
  health?(req: { model: string }): Promise<ProviderHealth>
}
```

Shipped implementations:

| Source | File | Wire format | Covers |
| --- | --- | --- | --- |
| **ShadowAI Space** | `providers/shadowSpace.ts` | NDJSON | Your Hugging Face Space running Shadow v1.1 |
| `Custom endpoint` | `providers/openaiCompatible.ts` | SSE | Any `/chat/completions` — gateways, vLLM, TGI, Ollama, LM Studio, llama.cpp, LocalAI |
| `ShadowAI backend` | `providers/serverTransport.ts` | SSE | The bundled Node proxy, which holds the credential server-side |

**Adding another backend** is one file that satisfies `AIProvider`, plus one line in
`createProvider()` (`src/lib/ai/index.ts`). No component, hook, or store changes.

### Troubleshooting the Space

```bash
node tools/check-space.mjs
```

The Space validates the `Authorization` header itself, so the token has to match the value
configured inside the Space. A wrong token fails in two distinct ways, and the doctor tells
them apart:

| Result | Meaning |
| --- | --- |
| `401 Missing authorization` | no token was sent — add it in Settings → Model |
| `403 Invalid token` | the token does not match the Space's own configured value |
| `404` on every path | the Space is private or stopped — make it public and check the runtime stage |

Verify a token against Hugging Face directly:

```bash
curl -s -H "Authorization: Bearer hf_YOUR_TOKEN" https://huggingface.co/api/whoami-v2
```

A valid token returns your account; an invalid one returns
`{"error":"Invalid username or password."}`. If that fails, no Space will accept it.

### Shadow v1.1 (the Space)

Configured in `.env`:

```
VITE_SHADOW_SPACE_URL=https://<your-space>.hf.space
VITE_SHADOW_SPACE_TOKEN=hf_…
```

ShadowAI calls `GET /health` to check the model and `POST /api/chat` to talk to it. The
response is newline-delimited JSON, not SSE:

```jsonc
{"type":"progress","stage":"analyzing","message":"Analyzing your request..."}
{"type":"token","text":"Hello ","token_num":2}
{"type":"complete","response":"Hello there!","tokens":13,"task_type":"general_chat"}
```

Those `progress` messages are the backend's own user-facing stage labels, so ShadowAI shows
them verbatim in the top bar rather than inventing its own spinner text. The request sends the
prompt **both** as `message` and as a structured `messages` array, so it works whichever
shape the backend implements.

The token is stored per-browser and can be rotated in **Settings → Model** without a rebuild.

### Custom endpoint

The key lives in `localStorage` on your device and the request goes straight to your
endpoint — it must allow browser (CORS) requests. Presets cover the common shapes.

### ShadowAI backend (key never touches the browser)

```bash
SHADOWAI_BASE_URL=https://your-endpoint/v1 \
SHADOWAI_API_KEY=sk-… \
SHADOWAI_MODEL=your-model-id \
npm run server            # :8787
```

Then pick **ShadowAI backend** in Settings → Model, or drop the same keys into
`server/shadowai.config.json`. To point a built frontend at a backend on another origin,
set `VITE_SHADOWAI_API` at build time.

---

## Accounts and cloud storage

Authentication is **Firebase Auth** (Google popup, email + password, password reset).
Conversations and the onboarding profile are stored in **Realtime Database**.

```
/users/{uid}                        profile + onboarding answers
/users/{uid}/conversations/{id}      title, model, mode, timestamps, archived
/users/{uid}/conversations/{id}/messages/{mid}
```

`localStorage` stays the source of truth for an open session, so the app works instantly and
offline; writes to the cloud are debounced and fire-and-forget. On first load the two are
merged, and anything mid-stream is never clobbered by a snapshot.

**Deploy `database.rules.json` before going live.** The Firebase web config in
`src/lib/firebase.ts` is an identifier, not a secret — anyone can read it. The rules are the
actual protection: they scope every read and write to the signed-in owner.

```bash
firebase deploy --only database
```

### Onboarding

Nine questions on first sign-in — name, where you heard about us, role, goals, AI
experience, interests, who the workspace is for, answer style, and anything else. Skippable,
written to the profile, and surfaced again in **Settings → Account**.

---

## Modes

**Chat** is a normal conversational assistant — markdown, tables, code blocks, images, files.

**Agent** is a real loop, not an animated fake:

1. **Plan** — one model call returns 3–6 short, user-facing step titles.
2. **Execute** — one real model call per step, streamed into the conversation.
3. **Finish** — the last step produces the summary and any remaining files.

Every step calls your model and does actual work. If no model is connected the run fails
honestly rather than faking progress. Private reasoning is never requested, streamed, or shown.

Progress lives in a collapsible panel **inside the conversation**, never on a separate screen.

### File protocol

To hand a finished file to the user, the model emits an ordinary fenced block whose info string
is the path:

````
```file:index.html
<!doctype html>
…
```
````

ShadowAI lifts these out of the markdown, renders them as a file card with
**Open · Preview · Download · Download ZIP**, and keeps the rest of the prose intact.
A block that is still streaming shows as `writing…` instead of a half-drawn code fence.

---

## Features

- Streaming responses with a stop control that actually aborts the request
- Chat / Agent mode switch in the composer
- Collapsible agent progress panel — bottom sheet on mobile
- Attach files by picker, drag-and-drop, or paste (images, PDF, TXT/MD, CSV, JSON, DOCX, ZIP, code)
  — PDF text and DOCX text are genuinely extracted locally; ZIPs are indexed
- Generated files with inline preview, per-file download, and one-click ZIP
- Syntax-highlighted code blocks with copy / expand / download
- Per-message copy, regenerate, continue, edit, save
- Conversation history with rename, archive, delete, and full-text search
- Model selector showing only models you configured
- Streaming errors rendered inside the conversation — no stack traces
- Local persistence with quota-aware shrinking; JSON export / import
- Dark-first design on the ShadowMotion green palette, responsive to mobile

### Keyboard

| | |
| --- | --- |
| `⌘K` | Focus the composer |
| `⌘⇧O` | New conversation |
| `⌘B` | Toggle sidebar |
| `⌘,` | Settings |
| `/` | Search conversations |
| `Enter` | Send (`⇧Enter` for a new line) |
| `Esc` | Stop generating, or close what is open |

---

## Architecture

```
src/
├── App.tsx                     orchestration: state, streaming loop, auth gates, cloud sync
├── lib/
│   ├── ai/
│   │   ├── types.ts            AIProvider + domain types — the only contract
│   │   ├── config.ts           provider configuration + the Space defaults
│   │   ├── index.ts            createProvider() — the single seam
│   │   ├── providers/          one file per backend
│   │   ├── agent.ts            plan → execute → finish
│   │   ├── messages.ts         history + attachments → provider payload
│   │   └── artifacts.ts        ```file: block extraction
│   ├── firebase.ts             Firebase init, auth helpers, error translation
│   ├── cloud.ts                typed RTDB access + debounced sync
│   ├── attachments.ts          file intake and text extraction
│   ├── store.ts                localStorage persistence
│   ├── files.ts / zip.ts       downloads and archives
│   └── utils.ts
├── components/                 UI, one concern each
└── styles/                     tokens, application layer, auth & onboarding
```

Stack: React 18, TypeScript, Vite, Firebase 12. Runtime dependencies are deliberately few —
`react-markdown`, `highlight.js`, `jszip`, and `pdfjs-dist`, the last two lazy-loaded
only when you actually zip a bundle or attach a PDF.

---

## Brand

The ShadowAI mark is vector and lives in three places so it never drifts:

- `src/components/Mark.tsx` — inline React component (inherits the live accent token, can spin while streaming)
- `public/shadowai-mark.svg` — standalone
- `public/favicon.svg` / `public/icon.svg` — app icon

Accent colour is a token (`--accent`), so the mark re-tints when you change it in
Settings → Appearance.

---

## Commands

```bash
npm run dev       # dev server on :5173
npm run build     # production build → dist/
npm run preview   # serve the production build
npm run server    # optional backend proxy on :8787

node tools/check-space.mjs     # diagnose the live Space end to end
node tools/mock-model.mjs      # local stand-in model, both wire formats
```

`check-space.mjs` is the first thing to run when the model misbehaves. It resolves the space
from its hostname, confirms it is public and running, calls `/health`, then makes a real
`/api/chat` call and reports which link in the chain is broken:

```
  path   deadlyghost5090/fs-intelligence-whatsapp
✓ space is public · docker · cpu-basic
✓ runtime is RUNNING (domain READY)
✓ model loaded — Model loaded successfully
✗ 403 "Invalid token" — the space rejected this token.
```

## Notes

- The HF token and any API key live in `.env` (gitignored) or in `localStorage`. Neither is
  baked into a build you publish, as long as you keep them out of tracked files.
- The Space token is sent from the browser, so anyone with devtools can read it. That is fine
  for a private Space. For a paid or shared backend, use **ShadowAI backend** and keep the
  credential server-side.
- The file preview renders generated HTML in a sandboxed iframe without `allow-same-origin`,
  so previewed code cannot reach ShadowAI's storage.
- Conversation content leaves the device only when it is sent to your model endpoint.
