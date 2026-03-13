# Branching Policy (Mandatory)

This repository uses a strict two-stream model to protect production and run parallel migration work without cherry-pick.

## Permanent branches

- `main` — production branch, only stable and deployable code.
- `next` — integration branch for large migration work (`zustand` / `nest`) and related feature development.

## Allowed flows

- Urgent production fix:
  - branch from `main` as `hotfix/<short-name>`
  - PR target: `main`
  - after merge to `main`, sync `main -> next` via regular merge PR
- Migration and large features:
  - branch from `next` as `feature/<short-name>` (or `refactor/*`, `perf/*`, `chore/*`, `fix/*`)
  - PR target: `next`
- Release migration to production:
  - PR `next -> main`

## Forbidden

- No cherry-pick between `main` and `next`.
- No direct pushes to `main` or `next` (PR only).
- No hotfix PRs to `next`.
- No migration feature PRs directly to `main`.

## Practical rule

If a change may be needed in production, land it in `main` first, then merge `main -> next`.
