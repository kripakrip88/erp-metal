# Changelog — MetalPro

> Этот файл ведёт Claude Code после каждого значимого изменения.
> Формат: дата, репозиторий, тип, описание, зачем сделано.
> Лежит в ОБОИХ репозиториях.

---

## Формат записи

```
## YYYY-MM-DD

### erp-metal
- [feat] название — зачем сделано
- [fix] название — что было не так
- [refactor] название — мотивация

### metalpro-ai-polygon
- [feat] название — зачем сделано
```

Типы: `feat` / `fix` / `refactor` / `docs` / `migration` / `config` / `breaking`

---

## 2026-05-27

### erp-metal
- [fix] AI Polygon прокси в server.js — устранена CORS/400 ошибка Email Copilot при обращении к порту 4000
  - Добавлен `proxyToAI()` — форвардит `/api/email-copilot/*` на `localhost:4000`
  - `email-inbox.html`: убран жёсткий порт 4000, теперь same-origin через прокси
  - Настройка через env: `AI_POLYGON_HOST`, `AI_POLYGON_PORT`

## 2025-05-27

### Документация
- [docs] Создан CONTEXT.md — единый источник правды о состоянии обоих репо
- [docs] Создан CHANGELOG.md — лог изменений для синхронизации claude.ai и Claude Code
- [docs] Создан CLAUDE_ADDON.md — дополнение к CLAUDE.md с правилами синхронизации
- [fix] WORKFLOW.md — staging порт исправлен с 8080 на 3000
- [config] Сервер привязан к домену (обновить домен в CONTEXT.md)
