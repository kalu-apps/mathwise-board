## Summary

<!-- Что изменено и зачем -->

## Branching policy checklist (mandatory)

- [ ] Base branch chosen by policy:
  - `hotfix/* -> main`
  - `feature/*|refactor/*|perf/*|chore/*|fix/* -> next`
  - `main -> next` (sync)
  - `next -> main` (release)
- [ ] No cherry-pick between `main` and `next`.
- [ ] For hotfix in `main`: sync PR `main -> next` is opened/planned.
- [ ] Change is deploy-safe for target branch.

## Validation

- [ ] Local tests/build run (or explicitly explained why not).
- [ ] Regression risks are listed.
