# Branching Policy (Mandatory)

This repository uses `main-only` flow:

- `main` is the single working and release branch.
- `next` is deprecated and must not be used.

## Permanent branches

- `main` — единственная основная ветка (разработка + релизы).

## Allowed flows

- Default flow:
  - implement changes directly in `main`
  - push changes directly to `main`
- Optional safety flow:
  - create `feature/*`, `refactor/*`, `perf/*`, `chore/*`, `fix/*`, `docs/*` from `main`
  - open PR target: `main`

## Forbidden

- No work in `next`.
- No release/sync flows вида `next -> main` или `main -> next`.
- No dual manual implementation of the same change in two branches.

## Practical rule

- One source of truth is always `main`.
