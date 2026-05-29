# Changelog — MetalPro

> Этот файл ведёт Claude Code после каждого значимого изменения.
> Формат: дата, репозиторий, тип, описание, зачем сделано.
> Лежит в ОБОИХ репозиториях.

---

## 2026-05-29 (Step D)

### erp-metal
- [feat] POST /internal/bom-extracted — принимает callback от metalpro-ai-polygon, создаёт Part-записи в BOM узла из items[], обновляет description узла на "BOM требует подтверждения"
- [feat] Graceful degradation: при status=failed записывает ошибку в description узла, не падает
- [config] /internal/bom-extracted добавлен в PUBLIC_PATHS (вызывается сервером без JWT)

## 2026-05-29

### erp-metal
- [migration] prisma — добавлены fastener-поля в `material_definitions`: `gost`, `fastenerType`, `diameterMm`, `lengthMm`, `threadType`, `coating`, `weightRequired`, `weightNote`
- [feat] scripts/import-metiz.js — скрипт импорта метизов из IMPORT_METIZ_FINAL.csv (1170 позиций, дедупликация, ProcurementProfile для "Метиз Центр")
- [feat] GET /api/materials — расширен фильтрами по характеристикам метизов + пагинация + сортировка
- [feat] GET /api/materials/fastener-filters — новый эндпоинт: уникальные значения для динамических фильтров
- [feat] fasteners.html — полный редизайн: табы Болты/Гайки/Шайбы с количеством, динамические фильтры, таблицы с колонками по типу, сортировка, пагинация 50/стр, детальная карточка метиза
- [feat] "КП из письма" теперь создаёт Узлы (Assembly) вместо материалов — каждая строка из письма становится изделием с пустым BOM, который заполняется позже из PDF/Excel
- [feat] createOrderFromEmailService: добавлена `createAssembliesFromEmailNodes()` — если пришли `assembliesFromEmail`, создаются Assembly-записи; старый путь через `normalizationResults` сохранён
- [feat] email-inbox.html: `createRfqFromEmail` вызывает `POST /api/ai-bom/extract-assemblies-from-text` с текстом письма вместо нормализации материалов

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
