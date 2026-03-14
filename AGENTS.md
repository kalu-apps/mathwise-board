# Branching Policy (Mandatory)

This repository uses `next-first` flow:

- `next` is the only regular development and integration branch.
- `main` is release-only and production-only.

## Permanent branches

- `main` — production releases only.
- `next` — active development (`zustand` / `nest` migration and all regular features/fixes).

## Allowed flows

- Regular work (default):
  - branch from `next` as `feature/*`, `refactor/*`, `perf/*`, `chore/*`, `fix/*`, `docs/*`
  - PR target: `next`
- Release to production:
  - PR `next -> main`
- Emergency only (rare exception):
  - branch from `main` as `hotfix/<short-name>`
  - PR target: `main`
  - right after merge: sync PR `main -> next` is auto-created by workflow (`hotfix-sync-pr`)

## Forbidden

- No direct pushes to `main` or `next` (PR only).
- No regular feature/fix branches directly to `main`.
- No dual manual implementation of the same change in two branches.
- No cherry-pick between `main` and `next` as a normal process.

## Practical rule

- Implement once in one source branch.
- Use merges to propagate changes (`next -> main` for releases, `main -> next` only for emergency sync).
