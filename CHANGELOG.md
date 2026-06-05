# Changelog — MetalPro

> Этот файл ведёт Claude Code после каждого значимого изменения.
> Формат: дата, репозиторий, тип, описание, зачем сделано.
> Лежит в ОБОИХ репозиториях.

---

## 2026-06-05

### erp-metal
- [feat] Core Event System — in-process EventBus на базе eventemitter2
  - `src/core/events/event-bus.js` — единственная точка pub/sub (wildcard)
  - `src/core/events/event-types.js` — константы всех доменных событий
  - `src/core/events/correlation-id.js` — AsyncLocalStorage для correlationId
  - `src/core/events/event-log.service.js` — запись событий в таблицу event_logs (PENDING → PROCESSED / FAILED)
  - `src/core/events/index.js` — регистрация handlers при старте
- [feat] Демо-сценарий: createOrder() → order.created → warehouse + production handlers
  - `src/modules/crm/order.service.js`
  - `src/modules/warehouse/order-created.handler.js` — эмитит warehouse.stock.reserved
  - `src/modules/production/order-created.handler.js` — эмитит production.order.created
- [migration] add_event_log — таблица event_logs с индексами по correlationId, eventType, status
- [config] eventemitter2 добавлен в зависимости

---

## 2026-05-28

### erp-metal
- [fix] email-inbox.html — позиции из письма всегда переносятся в КП
  - Причина: если `/api/normalization/match` недоступен, `normalizationResults` оставался пустым массивом
  - Решение: сначала строится fallback из сырых extractedItems (`status: no_match`), потом пробуем нормализацию — если она возвращает результаты, заменяем fallback; если упала, оставляем fallback
  - Позиции теперь всегда попадают в узлы калькулятора, даже без AI Polygon
- [feat] server.js — добавлен proxy для `/api/normalization/*` → AI Polygon port 4000
  - Порт 4000 закрыт файрволом — браузер обращается через erp-metal
  - `NATIVE_NORMALIZATION_PATHS` Set для будущих нативных путей (пока пустой)
  - Аналогично существующему блоку `/api/email-copilot/*`

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

---

## 2026-05-27 (продолжение)

### erp-metal
- [fix] Email Copilot: заменить fetch() на ERP.authFetch() — все запросы к AI API теперь передают JWT токен
  - Причина: erp-metal proxy требует авторизацию, fetch() не отправлял Bearer токен
  - Исправлены: pollMail, loadMessages, updateFolderCounts, reanalyzeEmail, sendReply, archiveMail
- [fix] server.js proxy: 401 от AI Polygon → 503 — не выбрасывать пользователя из ERP-сессии
  - ERP.authFetch при 401 удалял JWT и редиректил на логин, даже если ошибка была на стороне AI
- [ci] deploy-staging.yml: добавлен workflow_dispatch для ручного запуска из GitHub Actions
- [ci] configure-ai-polygon.yml: синхронизирован develop с main (Docker + PM2 поддержка)
