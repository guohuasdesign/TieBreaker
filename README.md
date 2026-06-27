# Tie Breaker

Tie Breaker is an AI-powered decision support app. Users enter a decision question, optional personal context, several options, and a decision lens. The app compares trade-offs, recommends a path, shows SWOT, supports weight tuning, and can optionally generate a decision visual.

## Tech Stack

- Frontend: React 19, TypeScript, Vite
- Styling: Tailwind CSS utility classes plus custom CSS in `src/index.css`
- Icons: `lucide-react`
- Backend: Express, with the main API logic in `app.ts`
- Local server: `server.ts`, using Vite middleware in development
- Deployment: Vercel Serverless Function, with `api/[...path].ts` as the API entry point
- Decision AI: Anthropic Claude first, with optional Gemini fallback
- Optional visual generation: OpenAI Images, DashScope / Alibaba-compatible image or video APIs

## Key Features

- Landing hero page with a CTA into the decision flow
- New decision form with generated example questions
- Optional personal context directly under the question
- Automatic key-factor suggestions based on the question and personal context
- Multiple decision lenses:
  - The Rationalist
  - The Intuitive Finder
  - The Bold Adventurer
  - The Safe Steward
- Two-stage decision analysis:
  - Quick pass: returns a usable first result quickly
  - Deep pass: continues in the background and replaces the quick draft when finished
- Full-page results layout with left-side section navigation
- SWOT placed near the recommendation
- Responsive full-page weights tuner
- Draft save / discard and local archive
- Optional decision illustration generation

## Two-Stage Analysis Flow

The app no longer waits for the full AI report before showing results.

1. The frontend first requests `POST /api/analyze-decision-quick`.
2. The quick endpoint returns a shorter but complete structured JSON result.
3. The results page opens immediately and shows a `Quick draft` or `Refining full analysis` state.
4. The frontend then requests `POST /api/analyze-decision` in the background.
5. When the deep result returns, the active decision is automatically updated with the full analysis.

This improves the user experience on Vercel because full structured JSON responses can take 30-60 seconds, especially when the prompt is long, the decision has many options, or the model responds slowly.

## API Routes

### `GET /api/health`

Health check.

Response:

```json
{ "status": "ok" }
```

### `POST /api/analyze-decision-quick`

Fast first-stage analysis.

- Uses Claude when `ANTHROPIC_API_KEY` is configured
- Uses a shorter timeout and fewer tokens by default
- Returns a local quick draft if the provider times out or is unavailable
- Lets users reach the results page quickly

### `POST /api/analyze-decision`

Full structured decision analysis.

- Uses Claude first
- Supports optional Gemini fallback
- Returns a local structured fallback if the provider fails
- Used to replace the quick draft in the background

### `POST /api/generate-decision-image`

Optional decision visual generation.

- Uses the configured image / video provider first
- Returns a local SVG-style fallback visual when AI image providers are unavailable

## Environment Variables

Use `.env.local` for local development. Add the same variables in Vercel Project Settings for production.

### Required For Decision Analysis

```bash
ANTHROPIC_API_KEY=your_anthropic_key
```

### Optional Claude Settings

```bash
CLAUDE_DECISION_MODEL=claude-sonnet-4-6
ANTHROPIC_VERSION=2023-06-01
AI_QUICK_DECISION_TIMEOUT_MS=8000
CLAUDE_QUICK_MAX_TOKENS=1800
AI_DECISION_TIMEOUT_MS=18000
CLAUDE_MAX_TOKENS=7000
```

### Optional Gemini Fallback

```bash
GEMINI_API_KEY=your_gemini_key
ENABLE_GEMINI_FALLBACK=true
```

### Optional OpenAI Image Generation

```bash
OPENAI_API_KEY=your_openai_key
OPENAI_IMAGE_MODEL=gpt-image-2
OPENAI_IMAGE_SIZE=1536x1024
OPENAI_IMAGE_QUALITY=medium
```

### Optional Alibaba / DashScope Visuals

```bash
DASHSCOPE_API_KEY=your_dashscope_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com
DASHSCOPE_IMAGE_MODEL=wan2.2-t2i-flash
DASHSCOPE_IMAGE_SIZE=1280*720

ALIBABA_API_KEY=your_alibaba_key
ALIBABA_COMPATIBLE_BASE_URL=your_compatible_base_url
ALIBABA_IMAGE_MODEL=qwen-image
ALIBABA_IMAGE_SIZE=1536x1024

ENABLE_ALIBABA_VISUALS=true
ENABLE_IMAGE_FALLBACKS=true
```

## Run Locally

Prerequisite: Node.js 22 or another compatible modern Node runtime.

```bash
npm install
npm run dev
```

Default local URL:

```text
http://localhost:3000
```

If port `3000` is already in use:

```bash
PORT=3001 npm run dev
```

Test the backend:

```bash
curl http://localhost:3000/api/health
```

## Build

```bash
npm run build
```

This builds the Vite frontend into `dist` and bundles the Node server into `dist/server.mjs`.

## Type Check

```bash
npm run lint
```

The current `lint` script runs:

```bash
tsc --noEmit
```

## Vercel Deployment

Deployment uses:

- `vercel.json`
  - `buildCommand`: `npm run build`
  - `outputDirectory`: `dist`
  - rewrites non-API paths to `/index.html`
- `api/[...path].ts`
  - imports `app.ts`
  - forwards all `/api/*` requests to the Express app

Production checklist:

1. Add `ANTHROPIC_API_KEY` in Vercel environment variables.
2. Redeploy after changing environment variables.
3. Test `https://your-domain.vercel.app/api/health`.
4. If `/api/health` returns `FUNCTION_INVOCATION_FAILED`, check Vercel function logs first.
5. If decision analysis is slow, confirm the frontend requests the quick endpoint first and the deep endpoint second.

## Troubleshooting

### `FUNCTION_INVOCATION_FAILED`

This usually means the Vercel serverless function crashed during initialization or execution.

Check:

- The import path in `api/[...path].ts`
- Whether Vercel environment variables are configured
- The exact stack trace in Vercel function logs
- Whether `npm run build` succeeds locally

### `Cannot find module '/var/task/app'`

This usually means the serverless function import path or extension is wrong. The catch-all function should use:

```ts
await import("../app.js")
```

### Decision Analysis Takes Too Long

The full structured result is large, so the app now runs analysis in two stages:

- `POST /api/analyze-decision-quick`: returns the first result
- `POST /api/analyze-decision`: completes the deep analysis in the background

You can tune:

```bash
AI_QUICK_DECISION_TIMEOUT_MS=8000
CLAUDE_QUICK_MAX_TOKENS=1800
AI_DECISION_TIMEOUT_MS=18000
CLAUDE_MAX_TOKENS=7000
```

### The Page Shows `Quick draft`

`Quick draft` means the current result is the first-stage fast result. This is expected in the two-stage flow. If the deep pass succeeds, the page updates automatically.

### Local Works But Production Fails

The most common causes are:

- Missing Vercel environment variables
- The deployment is still using an old build
- Serverless import path mismatch
- AI provider timeout
- Invalid API key or insufficient quota

## Project Structure

```text
.
|-- api/[...path].ts              # Vercel serverless API catch-all
|-- app.ts                        # Express app and API routes
|-- server.ts                     # Local dev / production Node server
|-- src/
|   |-- App.tsx                   # Main UI and two-stage analysis flow
|   |-- components/
|   |   |-- DecisionForm.tsx
|   |   |-- ArchetypeSelector.tsx
|   |   `-- SavedDecisions.tsx
|   |-- index.css
|   `-- types.ts
|-- vercel.json
`-- package.json
```

## Scripts

```bash
npm run dev      # Start local Express + Vite dev server
npm run build    # Build frontend and bundled server
npm run start    # Run built server from dist/server.mjs
npm run lint     # Type-check with tsc --noEmit
npm run clean    # Remove dist
```
