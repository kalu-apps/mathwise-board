# Workbook Performance Plan

## Goals

- Increase workbook FPS and reduce online interaction latency.
- Preserve current user-facing tool behavior unless an improvement is explicitly validated.
- Avoid risky rewrites while preparing clean boundaries for a future Zustand migration.

## Non-Negotiable Constraints

- Do not break stable tool semantics, especially eraser, pen, transforms, image import, and online collaboration.
- Do not introduce a big-bang state-management migration during optimization work.
- Keep production behavior observable and reversible through small commits and validation steps.

## Baseline

- Current backend runtime is production-backed by PostgreSQL and Redis.
- Remaining performance bottlenecks are primarily in frontend render/runtime hot paths.
- Main large surfaces:
  - `src/pages/workbook/WorkbookSessionPage.tsx`
  - `src/features/workbook/ui/WorkbookCanvas.tsx`
  - `src/styles/visual/migrated/workbook.scss`

## Performance Targets

- Local input-to-paint should feel immediate and avoid visible stutter.
- Remote teacher-to-student preview should remain visually continuous.
- Heavy scenes should degrade gracefully instead of causing global UI stalls.

## Execution Phases

### Phase 1: Measure and Protect

- Add lightweight performance instrumentation for workbook interactions.
- Establish repeatable profiling scenarios for pen, eraser, drag, rotate, and image import.
- Preserve current behavior and use the baseline to detect regressions after each milestone.

### Phase 2: Separate Frontend Domains

- Split workbook frontend responsibilities into:
  - committed scene
  - transient runtime preview
  - remote transient preview
  - UI shell state
- Keep this separation internal first, without changing the public behavior of tools.

### Phase 3: Layered Rendering

- Separate scene rendering into logical layers:
  - committed scene layer
  - local preview layer
  - remote preview layer
  - selection and controls layer
  - presence layer
- Ensure transient updates do not force committed scene rerenders.

### Phase 4: Hot Path Optimization

- Move high-frequency interaction updates away from broad React rerender paths.
- Use refs, animation-frame scheduling, and pure helpers for runtime updates.
- Keep committed state authoritative while making previews cheaper to paint.

### Phase 5: Scene Scalability

- Add viewport-aware rendering and scene indexing for large boards.
- Reduce work for hit-testing and visibility calculations on heavy scenes.
- Avoid recalculating expensive derived data during render.

### Phase 6: Future-State Preparation

- Leave clear state and controller boundaries so a future Zustand migration becomes mechanical.
- Do not migrate to Zustand during this optimization track unless it becomes strictly necessary.

## Validation Discipline

- Validate after every milestone:
  - pen behavior
  - eraser behavior
  - object manipulation
  - image import
  - online sync for at least teacher/student scenarios
- Prefer incremental commits with clear rollback points.

## Current Working Principle

Optimize first. Migrate later.
