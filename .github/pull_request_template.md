## Summary

<!-- Что изменено и зачем -->

## Branching policy checklist (mandatory)

- [ ] Base branch chosen by policy:
  - `feature/*|refactor/*|perf/*|chore/*|fix/*|docs/* -> next` (default flow)
  - `next -> main` (release)
  - `hotfix/* -> main` (emergency only)
  - `main -> next` (mandatory sync after emergency hotfix)
- [ ] No cherry-pick between `main` and `next`.
- [ ] No dual manual implementation of one change in both branches.
- [ ] For hotfix in `main`: incident reason is documented and sync PR `main -> next` is opened/planned.
- [ ] Change is deploy-safe for target branch.

## Validation

- [ ] Local tests/build run (or explicitly explained why not).
- [ ] Regression risks are listed.
