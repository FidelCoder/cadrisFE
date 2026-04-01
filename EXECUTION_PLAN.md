# Frontend Execution Plan

## Beta target

Ship a phone-first beta that people can actually use for short interview and podcast sessions without the capture flow feeling fragile.

## Phase 1: Beta blockers

1. Lock recording reliability on real phones.
2. Tighten multi-face detection and track persistence for 1-4 people.
3. Confirm microphone sensing and recorded audio across target browsers.
4. Keep the live capture route full-screen, stable, and scroll-free.
5. Make review and export clearly show what is raw source versus directed output.

## Frontend task list

### 1. Capture reliability

- Verify start, stop, save, and reopen flows on iPhone Safari and Android Chrome.
- Confirm raw recording always contains audible microphone audio.
- Confirm directed preview capture either succeeds or fails visibly with a clear fallback.
- Handle permission denial, missing mic tracks, and interrupted recording states cleanly.
- Add a simple recovery path when recording upload fails after capture.

### 2. Vision and tracking tightening

- Improve face reacquisition when subjects lean, turn, or partially occlude each other.
- Reduce ID swapping in 2-person and 3-person scenes.
- Tune detector thresholds for dim rooms and medium-distance tripod setups.
- Keep wide resets available, but avoid losing active tracks too quickly.
- Add internal debug visibility for detector kind, face count, and track confidence.

### 3. Audio and speaker sensing

- Tune noise floor and speech-band heuristics against real room noise.
- Confirm voice activity changes meaningfully during speech, silence, and overlap.
- Make audio runtime state obvious in the live UI.
- Record and review short validation clips for quiet room, noisy room, and overlap cases.

### 4. Live workflow polish

- Keep the recording screen within one stable viewport on mobile.
- Respect safe-area insets and large touch targets.
- Keep the capture surface primary and minimize non-essential chrome.
- Prevent accidental scroll, bounce, and focus loss during recording.
- Use clearer user-facing messages for preparing, recording, stopping, saving, and failure states.

### 5. Review and export clarity

- Show the saved directed preview first when available.
- Make the raw source easy to inspect separately.
- Keep the timeline readable and aligned to the saved recording duration.
- Keep export lightweight for beta, but do not imply final cinematic rendering where it does not exist yet.

## Phase 2: Beta readiness

1. Add a small hidden debug panel or settings toggle for support sessions.
2. Add basic client-side error boundaries around key capture and review routes.
3. Track app version/build info in the UI for debugging beta reports.
4. Prepare a small device/browser QA matrix and run it before inviting testers.

## Go / no-go checklist

- A new user can create a project, enable camera and mic, record, stop, save, and review without dev intervention.
- The saved raw clip includes audio.
- The live screen shows real detector and audio activity, not just static placeholders.
- Multi-person scenes do not collapse into a single fake subject most of the time.
- The live route behaves like a capture tool, not a normal scrolling page.

## Frontend guidance

- Prefer stable framing over aggressive switching.
- Fail loudly when capture prerequisites are missing.
- Preserve raw source recording as the source of truth.
- Keep debug instrumentation available for beta support, but not noisy for end users.
- Avoid adding extra markdown docs beyond the repo cap.
