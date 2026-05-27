# Changelog — MetalPro

> Этот файл ведёт Claude Code после каждого значимого изменения.
> Формат: дата, репозиторий, тип, описание, зачем сделано.
> Лежит в ОБОИХ репозиториях.

---

## 2026-05-27

### erp-metal
- [fix] AI Polygon прокси в server.js — устранена ошибка "AI-сервис недоступен (порт 4000)"
  - Причина: порт 4000 закрыт файрволом, браузер не может достучаться напрямую
  - Решение: `proxyToAI()` форвардит `/api/email-copilot/*` на `localhost:4000` (внутри сервера доступен)
  - `/api/email-copilot/log-reply` остаётся нативным (erp-metal DB)
  - `email-inbox.html`: `AI_API` теперь same-origin, без жёсткого порта 4000
  - Настройка через env: `AI_POLYGON_HOST`, `AI_POLYGON_PORT`
  - Смержено в `develop` → задеплоено на staging
