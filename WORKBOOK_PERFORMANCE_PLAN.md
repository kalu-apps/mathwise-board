# Workbook Performance Plan

## Purpose

This plan defines the next frontend track for the workbook after the initial runtime and rendering optimizations. The goal is not a rewrite. The goal is to reach a structure where:

- local tools stay visually continuous and high-FPS;
- remote teacher-to-student interaction stays fast and stable in production;
- heavy scenes degrade gracefully instead of stalling the whole UI;
- workbook state and runtime boundaries are explicit enough that a later Zustand migration becomes mechanical instead of risky.

## Non-Negotiable Constraints

- Do not break stable tool semantics.
- Do not change eraser, pen, transforms, image import, or collaboration behavior unless the change is explicitly validated.
- Do not introduce a big-bang state-management migration during this track.
- Keep all optimizations observable, incremental, and rollback-safe.

## Current State

### Completed Foundation

- Production backend/runtime is already running on PostgreSQL and Redis.
- Workbook event flow, runtime helpers, PDF/media helpers, and telemetry were decomposed out of the old page monolith.
- Initial workbook hot-path optimization is already in place:
  - animation-frame batching for transient runtime updates;
  - layered render split;
  - viewport-aware scene rendering;
  - scene visibility helpers extracted out of the canvas component.

### Current Large Surfaces

- `src/pages/workbook/WorkbookSessionPage.tsx`
- `src/features/workbook/ui/WorkbookCanvas.tsx`
- `src/styles/visual/migrated/workbook.scss`

### Remaining Bottlenecks

- `WorkbookCanvas.tsx` still owns too much orchestration and too many concerns.
- Scene visibility is extracted, but scene indexing is still too lightweight for truly heavy boards.
- Preview-heavy paths still rely heavily on SVG and React coordination.
- Hit-testing and scene derivation still have more full-scene work than they should.
- Some heavy operations still execute on the main thread.
- State boundaries are clearer than before, but not yet clean enough for a low-risk Zustand migration.

## Success Criteria

### Performance

- Local input-to-paint is visually immediate on pen, eraser, drag, and transform interactions.
- Remote preview remains continuous and avoids visible catch-up bursts.
- Heavy boards avoid whole-page stalls during draw, erase, select, and move operations.
- Expensive render work is limited to the affected layer instead of the whole workbook scene.

### Structure

- Workbook rendering is split into clear scene/runtime/presence/selection responsibilities.
- `WorkbookSessionPage.tsx` is orchestration-first, not logic-first.
- `WorkbookCanvas.tsx` becomes a canvas shell instead of a giant all-knowing controller.
- Scene visibility, indexing, hit-testing, preview runtime, and remote preview application are isolated into domain modules.

### Future Zustand Readiness

- Domain state is already separated conceptually into:
  - committed scene;
  - transient local runtime;
  - transient remote runtime;
  - UI shell/session state.
- Components consume narrow controller APIs and derived selectors rather than broad local component state.
- A future Zustand migration can replace state sources without changing rendering semantics.

## Program Structure

## Phase A: Lock Stable Behavior

### Goal

Protect working tools before deeper structural optimization.

### Work

- Preserve behavioral baselines for:
  - pen;
  - eraser;
  - transforms;
  - area selection;
  - image import;
  - teacher/student live sync.
- Keep instrumentation active for:
  - frame stalls;
  - interaction latency;
  - remote preview timing;
  - long tasks.
- Treat behavior regressions as blockers for later phases.

### Exit Criteria

- All critical tools have a regression checklist.
- Runtime telemetry stays available in production.

## Phase B: Finish Domain Separation

### Goal

Make workbook state boundaries explicit without migrating to Zustand yet.

### Work

- Split workbook responsibilities into four internal domains:
  - committed scene;
  - local transient runtime;
  - remote transient runtime;
  - UI shell/session state.
- Continue reducing non-UI logic inside:
  - `src/pages/workbook/WorkbookSessionPage.tsx`
  - `src/features/workbook/ui/WorkbookCanvas.tsx`
- Introduce small controller-style modules for:
  - scene orchestration;
  - runtime preview orchestration;
  - selection/handles orchestration;
  - remote preview apply.

### Exit Criteria

- Workbook page is mostly wiring and lifecycle.
- Canvas is no longer the primary owner of business/runtime orchestration.

## Phase C: Canvas Shell and Layer Controllers

### Goal

Turn the current layered render split into a real layered architecture.

### Work

- Keep these layers isolated and cheap to update:
  - committed scene layer;
  - local preview layer;
  - remote preview layer;
  - selection/control layer;
  - presence layer.
- Move layer-specific preparation out of the main canvas body.
- Ensure transient updates do not invalidate committed scene preparation.
- Reduce cross-layer prop fan-out and broad memo dependencies.

### Exit Criteria

- Each layer has an explicit preparation path and render path.
- Committed scene rerenders are no longer coupled to frequent pointer updates.

## Phase D: Scene Scalability

### Goal

Scale large boards without linear render and hit-test penalties.

### Work

- Expand `sceneVisibility.ts` into a broader scene access layer:
  - viewport filtering;
  - fast object lookup;
  - fast stroke lookup;
  - near-viewport expansion;
  - hit-test candidate selection.
- Add stronger spatial indexing for:
  - board objects;
  - strokes;
  - selection candidates.
- Stop doing broad collection walks during render when indexed candidates are sufficient.

### Exit Criteria

- Heavy scenes no longer require full-scene hit-testing on routine interactions.
- Visibility and candidate selection are handled by model helpers rather than JSX-time loops.

## Phase E: Preview Rendering Path

### Goal

Make preview-heavy paths cheap enough for higher FPS under real classroom load.

### Work

- Keep current tool semantics intact while reducing preview rendering cost.
- Move preview-specific rendering toward the cheapest possible layer first.
- Prioritize:
  - local pen preview;
  - local eraser preview;
  - remote pen preview;
  - remote eraser preview.
- If SVG remains the bottleneck after measurement, introduce a dedicated preview canvas layer without changing committed-scene semantics.

### Exit Criteria

- High-frequency preview no longer causes large SVG churn.
- Remote preview is visually continuous without frequent repaint spikes.

## Phase F: Main-Thread Pressure Reduction

### Goal

Prevent heavy synchronous work from blocking interaction.

### Work

- Identify heavy pure computations still running on the main thread:
  - image preprocessing;
  - export preparation;
  - heavy geometry transforms;
  - snapshot compaction;
  - selected 3D calculations.
- Move safe pure work to workers or deferred background steps where appropriate.
- Keep interaction-critical work on the main thread only if it directly affects the current frame.

### Exit Criteria

- Heavy non-interaction work no longer produces visible stalls during active board usage.

## Phase G: Online Responsiveness Hardening

### Goal

Keep online classroom interaction smooth under real production latency.

### Work

- Continue optimizing remote preview apply as deltas, not broad scene refreshes.
- Separate remote preview paint cost from authoritative commit cost.
- Ensure remote pointer/preview pipelines only update the minimal affected layer.
- Use runtime telemetry to validate:
  - author action to peer preview time;
  - peer preview to peer paint time;
  - commit apply cost after preview.

### Exit Criteria

- Teacher actions appear on participant devices with stable, low-latency continuity.
- Remote preview remains smooth even when persistence/commit happens later.

## Phase H: Zustand Readiness Without Migration

### Goal

Leave the frontend in a state where Zustand can be adopted later with minimal behavioral risk.

### Work

- Ensure each domain exposes a narrow interface:
  - scene controller;
  - runtime controller;
  - remote-preview controller;
  - UI/session controller.
- Keep derived selectors and indexes in pure helpers, not embedded in render bodies.
- Avoid new cross-domain coupling inside giant components.
- Treat every new local state addition as temporary unless it belongs clearly to one domain.

### Exit Criteria

- Replacing local controller state with store-backed state would be mostly mechanical.
- No new giant-state patterns are added while performance work continues.

## Validation Matrix

Validate after every milestone:

- Pen draw on light board.
- Pen draw on heavy board.
- Eraser on continuous long gesture.
- Drag/resize/rotate transforms.
- Area selection and multi-object manipulation.
- Image import and object appearance.
- Teacher/student remote preview continuity.
- Audio enabled classroom session with active board interaction in parallel.

## Delivery Order

1. Phase A
2. Phase B
3. Phase C
4. Phase D
5. Phase E
6. Phase F
7. Phase G
8. Phase H

## Working Principle

Optimize behavior-preserving runtime architecture first. Migrate state management later.
