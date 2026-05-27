# MetalPro — Контекст проекта

> Этот файл — живой документ. Claude Code обновляет его после каждого значимого изменения.
> Лежит в ОБОИХ репозиториях. Синхронизировать вручную при кросс-репо изменениях.

## Быстрые ссылки

- https://github.com/kripakrip88/erp-metal
- https://github.com/kripakrip88/metalpro-ai-polygon

> Для claude.ai: чтобы проверить репо — дай эти ссылки в сообщении, Claude их откроет.

---

## Инфраструктура

| Параметр | Значение |
|----------|----------|
| Сервер | 5.35.92.112 |
| Домен | erppark.ru |
| Production | http://erppark.ru, порт 80, ветка `main` |
| Staging | http://erppark.ru:3000, ветка `develop` |
| БД Production | `erp_metal` |
| БД Staging | `erp_metal_staging` |
| Process manager | PM2 |
| Оба репо | на одном сервере |

## Подключение к серверу

- **Host:** 5.35.92.112
- **User:** root
- **Auth:** SSH ключ `~/.ssh/erp_metal_deploy`
- **Команда:** `ssh -i ~/.ssh/erp_metal_deploy root@5.35.92.112`
- **PM2 prod:** `pm2 logs erp-metal`
- **PM2 staging:** `pm2 logs erp-metal-staging`

---

## Репозитории

### erp-metal
- **Repo:** https://github.com/kripakrip88/erp-metal
- **Стек:** Node.js + Prisma + PostgreSQL
- **Назначение:** Основная ERP система

#### Текущее состояние модулей

| Модуль | Статус | Ветка | Примечание |
|--------|--------|-------|------------|
| Заказы / Order lifecycle | ✅ Готов | main | DRAFT→DELIVERED |
| BOM / Assembly tree | ✅ Готов | main | Неограниченная вложенность |
| Материалы | ✅ Готов | main | Профили, нормы веса |
| Калькуляция / QuoteRevision | ✅ Готов | main | Снепшоты цен |
| Покрытия (ЛКМ) | ✅ Готов | main | Расчёт расхода по площади |
| Склад / Закупки | 🔄 Частично | develop | Резервирование |
| LKP Calculator | ✅ Готов | main | — |
| AI Mail Intake | 🔲 Концепт | — | UI концепт готов, интеграция — нет |
| Заказы в производстве | 🔲 Концепт | — | UI концепт готов |
| Планировщик технолога | 🔲 Концепт | — | UI концепт готов |
| DXF / Nesting | 🔲 Не начат | — | Phase 3 roadmap |

#### Известные проблемы
- Frontend state сбрасывается после refresh — нужен persist storage
- Ревизии подтягивают некорректные связанные сущности
- После обновления страницы появляются стартовые данные (hydration)
- Outbox worker иногда не стартует при инициализации

---

### metalpro-ai-polygon
- **Repo:** https://github.com/kripakrip88/metalpro-ai-polygon
- **Стек:** NestJS + TypeScript + PostgreSQL + Claude API + Llama/Ollama + Tesseract OCR + n8n
- **Назначение:** AI-модуль — парсинг документов, извлечение данных для ERP

#### Текущее состояние этапов

| Stage | Название | Статус |
|-------|----------|--------|
| Stage 1 | Infrastructure + DB schema | ✅ Готов |
| Stage 2 | Upload + Async OCR pipeline | ✅ Готов |
| Stage 3 | Claude Extraction (3-layer persistence) | ✅ Готов |
| Stage 4 | Llama Parallel Extraction + Telemetry | ✅ Готов |
| Stage 5 | Normalization Layer | 🔄 В работе |

#### Архитектура Stage 4 (зафиксировано)
- Claude = primary (определяет document.status)
- Llama = benchmark (сбой = только телеметрия, статус не меняется)
- Promise.allSettled — независимые домены отказов
- LlamaInferenceProvider — абстракция Ollama (можно заменить vLLM/GPU)
- ExtractionTelemetryService — append-only, fire-and-forget
- Одинаковый промпт для обеих моделей (ClaudePromptBuilderService, temperature=0)
- Один валидатор (safeParseClaudeResponse) для обеих моделей

#### Stage 5 — план (следующий)
- MaterialNormalizationService
- Alias matching против materials_dictionary
- Supplier-aware mappings
- User correction feedback loops
- Output: user-facing draft BOM → ai_extraction_results

---

## Связь между репозиториями

```
metalpro-ai-polygon          erp-metal
      |                          |
  OCR + AI parsing    →    AI Mail Intake модуль
  Stage 5 BOM draft   →    BOM / Assembly tree
  Нормализация        →    materials_dictionary
```

Интеграция планируется в Phase 4 основного roadmap (AI parsing, PDF, DXF).
Пока репозитории развиваются параллельно и стыкуются вручную.

---

## Визуальный стиль (MetalPro ERP UI)

- **Палитра:** тёмный графит, стальные индустриальные тона, cyan/blue акценты для AI-элементов
- **Типографика:** DM Mono для числовых данных, Syne для заголовков
- **Принцип:** строгий enterprise-облик, без consumer-friendly упрощений
- Стиль зафиксирован — не пересматривается для каждого нового экрана

---

## Последнее обновление

- **Дата:** 2025-05-27
- **Кто обновил:** claude.ai (вручную)
- **Что изменилось:** Добавлено подключение к серверу (SSH ключ erp_metal_deploy), порт 3001 не существует, подтверждён порт staging 3000
