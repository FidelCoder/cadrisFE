# Cadris Frontend

Mobile-first Next.js 15 PWA for Cadris, a real-time AI camera director that helps one phone cover 2-4 person conversations with live reframing guidance.

## What is in this repo

- Next.js App Router frontend
- PWA shell and manifest
- Recording setup flow
- Live camera screen with raw feed plus directed preview
- Dual-output recording flow with raw source plus lightweight directed preview
- In-browser face tracking abstraction, audio activity analysis, and shot planner
- Project library, review screen, export preview screen
- Zustand-based client preferences

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_API_BASE_URL` to the backend URL.
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

Default local URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:4000`

## MVP notes

- The live detection layer prefers BlazeFace in-browser, then falls back to `FaceDetector`, then motion-based reacquisition.
- Active speaker estimation is still heuristic-based, but now combines audio activity with per-face visual speech/activity proxies.
- The saved session keeps the original raw recording and also captures a lightweight directed preview clip when the browser supports it.
- Export is intentionally lightweight for v1 and leans on the saved directed preview plus shot metadata rather than a heavyweight final renderer.
- The frontend assumes the backend owns persistence, media storage, and export-preview generation.
- A local AI review panel is available on the project review screen when the backend can reach an Ollama-compatible runtime.

## Main flows

- `/` landing
- `/record/new` project setup
- `/record/[projectId]` live directing and recording
- `/projects` library
- `/projects/[projectId]` review
- `/projects/[projectId]/export` export preview
- `/settings` client preferences
