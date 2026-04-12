# Политика ветвления (staging-first)

## Цель

Стабилизировать поставку: вся активная разработка и первичная интеграция идут в `staging`, продвижение в прод — только через `main`.

## Базовая схема

- `staging` — основная рабочая ветка.
- `main` — стабильная/релизная ветка.
- `next` — выведена из эксплуатации и не используется.

## Поток работ

1. Вносить изменения в `staging`.
2. Пушить в `staging`.
3. После валидации выполнять promotion `staging -> main`.
4. Деплоить из `main`.

Опционально для рискованных задач:

1. Создать ветку от `staging` (`fix/*`, `feature/*`, `refactor/*`, `perf/*`, `chore/*`, `docs/*`).
2. Открыть PR в `staging`.
3. После merge в `staging` выполнить проверку и только затем PR `staging -> main`.

## Жёсткие правила

- Источник активной разработки — всегда `staging`.
- Прямые implementation-push в `main` запрещены.
- Работу через `next` не использовать.
- Флоу `next -> main`, `main -> next`, `next -> staging` запрещены.
- Одна правка не реализуется вручную в двух ветках.

## Рекомендация по GitHub protection

Для `staging`:

- включить required status checks (`Quality Gates`, `Branch Flow Guard`);
- ограничить force-push;
- включить Include administrators.

Для `main`:

- включить required status checks (`Quality Gates`, `Branch Flow Guard`);
- разрешить merge только из `staging` (через Branch Flow Guard);
- ограничить force-push;
- включить Include administrators.
