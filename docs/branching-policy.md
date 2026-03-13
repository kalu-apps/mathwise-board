# Политика ветвления (next-first)

## Цель

Максимально упростить процесс: вся обычная разработка идёт в `next`, а `main` используется только как релизная ветка для продакшна.

## Базовая схема

- `next` — основная рабочая ветка (feature/fix/refactor/perf и миграция).
- `main` — только релиз в прод.

## Потоки работ

### 1) Обычная разработка (по умолчанию)

1. Создать ветку от `next`: `feature/*`, `refactor/*`, `perf/*`, `chore/*`, `fix/*`, `docs/*`.
2. Открыть PR в `next`.
3. Поддерживать `next` в релизопригодном состоянии (feature flags для незавершённого).

### 2) Релиз в прод

1. Открыть PR `next -> main`.
2. Прогнать регресс.
3. Слить PR и деплоить `main`.

### 3) Emergency-инцидент (исключение, не норма)

1. Создать ветку от `main`: `hotfix/<short-name>`.
2. Открыть PR в `main`.
3. После merge и деплоя обязательно открыть sync PR `main -> next`.

## Жёсткие правила

- Прямой push в `main` и `next` запрещён (только PR).
- Фичи и обычные фиксы напрямую в `main` запрещены.
- Одна правка не реализуется вручную в двух ветках одновременно.
- Cherry-pick между `main` и `next` не является штатным процессом.

## Почему это работает

- Один основной поток (`feature -> next -> main`) проще и быстрее.
- Меньше ручных синков и меньше риска расхождений.
- Emergency-path остаётся доступным без разрушения общей модели.

## Одноразовая настройка GitHub (UI)

Для веток `main` и `next` включить branch protection:

- Require a pull request before merging.
- Require status checks to pass before merging:
  - `Branch Flow Guard / validate-branch-flow`
- Restrict who can push to matching branches (никому напрямую).
- Include administrators.
