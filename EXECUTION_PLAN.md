# Frontend Execution Plan

## Current target

Ship a lightweight mobile-first PWA that feels credible on phone browsers and stays modular enough for stronger models later.

## Build order

1. Establish the Next.js shell, PWA behavior, and navigation.
2. Build recording setup and project creation flow.
3. Implement the live camera experience with raw feed and reframed preview.
4. Stabilize the in-browser shot planner and timeline capture.
5. Connect review, library, and export preview screens to the backend API.
6. Validate on mobile-oriented layouts and keep the bundle lean.

## Frontend guidance

- Prefer stable motion over aggressive switching.
- Keep touch targets large and recording controls obvious.
- Treat the raw capture as the source of truth and the reframed preview as a directed interpretation.
- Preserve clean module boundaries between UI, recorder logic, vision, audio, and shot planning.
- Avoid adding extra markdown docs beyond the repo cap.
