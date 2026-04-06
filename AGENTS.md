# Branching Policy (Mandatory)

This repository uses `staging-first` flow:

- `staging` is the primary working branch for all implementation.
- All first pushes go to `staging`.
- `main` is updated only after validation/promotion from `staging`.
- `next` is deprecated and must not be used.

## Permanent branches

- `staging` — основная ветка для разработки и первичной интеграции.
- `main` — стабильная/релизная ветка (продвижение только из `staging`).

## Allowed flows

- Default flow:
  - implement changes in `staging`
  - push changes to `staging`
- Optional safety flow:
  - create `feature/*`, `refactor/*`, `perf/*`, `chore/*`, `fix/*`, `docs/*` from `staging`
  - open PR target: `staging`

## Forbidden

- No work in `next`.
- No direct implementation pushes to `main`.
- No release/sync flows вида `next -> main`, `main -> next`, or `next -> staging`.
- No dual manual implementation of the same change in two branches.

## Practical rule

- Primary source of truth for active work is always `staging`.
