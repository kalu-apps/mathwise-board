# Политика ветвления (prod + migration)

## Цель

Поддерживать стабильный прод для реальных уроков и одновременно развивать крупную миграцию без потери фиксов и без cherry-pick.

## Базовая схема

- `main` — production-only.
- `next` — интеграция крупного обновления (`zustand` / `nest`) и сопутствующих задач.

## Потоки работ

### 1) Срочные правки продакшна

1. Создать ветку от `main`: `hotfix/<short-name>`.
2. Открыть PR в `main`.
3. После merge — деплой из `main`.
4. Сразу открыть PR `main -> next` и влить обычным merge.

### 2) Крупные доработки и миграция

1. Создать ветку от `next`: `feature/<short-name>` (допустимо также `refactor/*`, `perf/*`, `chore/*`, `fix/*`).
2. Открыть PR в `next`.
3. Регулярно подтягивать изменения из `main` в `next` через merge PR.

### 3) Релиз миграции

1. Финальный sync: `main -> next`.
2. Полный регресс на `next`.
3. PR `next -> main`.
4. Деплой `main`.

## Жёсткие правила

- Cherry-pick между `main` и `next` не используется.
- Прямой push в `main` и `next` запрещён (только PR).
- `hotfix/*` не сливается в `next` напрямую.
- Фичи миграции не сливаются в `main` напрямую.

## Почему это работает

- Прод всегда получает только проверенные hotfix-правки.
- Миграционная ветка не теряет продовые фиксы (за счёт регулярного `main -> next`).
- История изменений остаётся читаемой и предсказуемой.

## Одноразовая настройка GitHub (UI)

Для веток `main` и `next` включить branch protection:

- Require a pull request before merging.
- Require status checks to pass before merging:
  - `Branch Flow Guard / validate-branch-flow`
- Restrict who can push to matching branches (никому напрямую).
- Include administrators.
