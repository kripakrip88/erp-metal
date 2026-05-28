# ТЗ: Мини-CRM — анализ реализации

Документ показывает, что уже готово, что частично и что нужно сделать по ТЗ "Мини-CRM внутри ERP-metal".

**Дата анализа:** 19 мая 2026  
**Ветка:** `develop`

---

## Быстрый итог

| Этап | Статус | Готово / Всего |
|------|--------|----------------|
| Этап 1: Customer Core | 🟡 Частично | ~60% |
| Этап 2: Interactions System | 🟡 Частично | ~55% |
| Этап 3: Email ↔ CRM | ✅ Готово | ~90% |
| Этап 4: CRM ↔ Orders | 🟡 Частично | ~65% |
| Этап 5: CRM UI | 🟡 Частично | ~50% |
| Этап 6: AI CRM Layer | ❌ Не начат | 0% |

---

## Этап 1 — Customer Core

### 1.1 Customer Entity

| Поле ТЗ | Есть в схеме | Примечание |
|---------|-------------|-----------|
| id | ✅ | uuid |
| companyId | ✅ | |
| name | ✅ | |
| legalName | ❌ | Нужно добавить в схему |
| email | ✅ | |
| phone | ✅ | |
| website | ✅ | |
| taxId | 🟡 | Есть `inn` (ИНН) — покрывает для РФ, но поле называется иначе |
| country | ❌ | Нужно добавить |
| city | ❌ | Нужно добавить |
| address | ❌ | Нужно добавить |
| notes | ✅ | |
| tags | ❌ | Нет (есть `priority: VIP/HIGH/NORMAL/LOW`) |
| isSupplier | ❌ | Нет разделения customer/supplier |
| isCustomer | ❌ | Все записи считаются клиентами |
| createdAt | ✅ | |
| updatedAt | ✅ | |

**Что нужно:** миграция Prisma — добавить `legalName`, `country`, `city`, `address`, `tags String[]`, `isSupplier Boolean`, `isCustomer Boolean`.

### 1.2 Contact Person Entity

Модель называется `Contact` (не `CustomerContact`), хранится в `crm_contacts`.

| Поле ТЗ | Есть в схеме | Примечание |
|---------|-------------|-----------|
| id | ✅ | |
| customerId | ✅ | |
| name | ✅ | |
| email | ✅ | |
| phone | ✅ | |
| position | ✅ | |
| isPrimary | ❌ | Нужно добавить |
| notes | ✅ | |

**Что нужно:** добавить поле `isPrimary Boolean @default(false)` в миграцию.

### 1.3 Customer Search

| Функция ТЗ | Статус | Реализация |
|-----------|--------|-----------|
| Поиск по названию | ✅ | `?search=...` → `name contains` (case-insensitive) |
| Поиск по email | ✅ | `?email=...` → `email contains` |
| Поиск по телефону | ❌ | Не реализован |
| Fuzzy search | ❌ | Только contains, не fuzzy |

**Что нужно:** добавить `?phone=...` в `listCustomers()` + `?q=` для мульти-поля поиска (name OR email OR phone).

---

## Этап 2 — Interactions System

### 2.1 Interaction Entity — типы

| Тип ТЗ | Есть | Примечание |
|--------|------|-----------|
| EMAIL | ✅ | |
| CALL | ✅ | |
| MEETING | ✅ | |
| RFQ | ❌ | Нет в enum `InteractionType` |
| NOTE | ✅ | |
| SYSTEM | ❌ | Нет |
| AI_ANALYSIS | ❌ | Нет |

**Что нужно:** добавить `RFQ`, `SYSTEM`, `AI_ANALYSIS` в enum `InteractionType` (миграция).

### 2.2 Interaction Fields

| Поле ТЗ | Есть в схеме | Примечание |
|---------|-------------|-----------|
| id | ✅ | |
| companyId | ❌ | Нет — Interaction привязана к Customer, у которого есть companyId |
| customerId | ✅ | |
| orderId | ✅ | |
| type | ✅ | |
| direction | ✅ | INBOUND / OUTBOUND |
| title | ❌ | Нет отдельного поля `title` (есть `subject`) |
| content | 🟡 | Поле называется `body` |
| createdBy | ✅ | `createdById` → FK на User |
| createdAt | ✅ | |
| emailMessageId | ✅ | `@unique` — используется для idempotency |
| emailThreadId | ❌ | Нет |
| emailFrom | ❌ | Нет (хранится в теле `body`) |
| emailTo | ❌ | Нет |
| emailSubject | 🟡 | Поле `subject` есть |
| receivedAt | ❌ | Нет |
| aiSummary | ❌ | Нет |
| aiTags | ❌ | Нет |
| aiConfidence | ❌ | Нет |

**Что нужно:** расширить модель Interaction — добавить `emailThreadId`, `emailFrom`, `emailTo`, `receivedAt`, `aiSummary String?`, `aiTags String[]`, `aiConfidence Float?`.

### 2.3 Timeline API

| Endpoint | Статус | Примечание |
|---------|--------|-----------|
| `GET /api/customers/:id/timeline` | ❌ | Не реализован |
| `GET /api/customers/:id/interactions` | ✅ | Только взаимодействия, не orders |

**Что нужно:** создать endpoint `/timeline` — объединяет interactions + orders в единый список, сортированный по дате, с полем `itemType`.

---

## Этап 3 — Email ↔ CRM Integration

### 3.1 POST /api/orders/from-email

✅ **Полностью реализован** (19 мая 2026, Вариант В).

- normalize email ✅
- find/create customer ✅
- create DRAFT order ✅
- create INBOUND Interaction ✅
- idempotency через `emailMessageId @unique` ✅
- `prisma.$transaction()` ✅
- OutboxEvent `RFQ_CREATED_FROM_EMAIL` ✅

### 3.2 Email Thread Linking

| Функция | Статус |
|---------|--------|
| Связь по `emailMessageId` | ✅ |
| `emailThreadId` | ❌ — нет поля в схеме |
| `references` / `inReplyTo` | ❌ — не парсится и не хранится |

**Что нужно:** добавить `emailThreadId` в Interaction и использовать при создании inbound-взаимодействий.

### 3.3 Customer Auto Detection

✅ **Реализован** — в `createOrderFromEmailService.js`:
- Email нормализуется (lowercase + trim)
- `Customer.findFirst({ email })` — если найден, берём существующего
- Если нет — создаём нового клиента автоматически

---

## Этап 4 — CRM ↔ Orders

### 4.1 Orders belong to Customer

| Требование | Статус | Примечание |
|-----------|--------|-----------|
| `customerId` обязателен | 🟡 | В схеме поле опциональное — `customerId String?` |
| Исключение для внутренних | — | Не определено, что считается "внутренним" |

**Что нужно:** бизнес-решение — делать ли `customerId` обязательным или добавить `isInternal Boolean`.

### 4.2 Customer Order History

✅ **Реализован** в `getCustomer()`:
- Список последних 20 заказов (orderNumber, title, status, createdAt)
- Счётчик заказов через `_count`
- Отображается на вкладке "Заказы" в `customer.html`

**Чего не хватает:** сумма заказов, последняя активность.

### 4.3 RFQ Statuses

Текущий `OrderStatus` в схеме:
```
DRAFT → QUOTATION → AWAITING_APPROVAL → APPROVED → PRODUCTION → COMPLETED → DELIVERED → CANCELLED
```

ТЗ требует отдельных RFQ-статусов:
```
NEW → ANALYZING → PRICING → WAITING → SENT → WON → LOST
```

**Что нужно:** бизнес-решение — добавить новые значения в `OrderStatus` или создать отдельный enum `RFQStatus` с отдельной моделью.

---

## Этап 5 — CRM UI

### 5.1 Customers Page (`crm.html`)

| Функция ТЗ | Статус |
|-----------|--------|
| Список клиентов | ✅ |
| Поиск | ✅ (по названию) |
| Фильтры | ❌ (нет фильтра по статусу, стране, isSupplier) |
| Быстрый просмотр | ❌ (клик → переход на customer.html, не слайд-панель) |

### 5.2 Customer Card (`customer.html`)

| Вкладка ТЗ | Статус |
|-----------|--------|
| Заказы | ✅ |
| История (Interactions) | ✅ |
| Overview | ❌ |
| Contacts | ❌ (контакты показаны, но нет отдельной вкладки) |
| Emails | ❌ |
| Timeline (объединённый) | ❌ |
| Notes | ❌ |

### 5.3 Email Integration UI

| Функция ТЗ | Статус |
|-----------|--------|
| Кнопка "Создать RFQ" | ✅ (Вариант В) |
| Клиент найден / не найден | ❌ |
| Количество заказов клиента | ❌ |
| Последний заказ | ❌ |

**Что нужно:** при открытии письма в inbox — подгружать данные клиента по `fromAddress` через `/api/customers?email=...` и показывать информационный блок.

---

## Этап 6 — AI CRM Layer

| Функция ТЗ | Статус |
|-----------|--------|
| `aiSummary` на Interaction | ❌ (нет поля в схеме) |
| `aiTags` на Interaction | ❌ |
| `aiIntent` на Interaction | ❌ |
| AI Customer Insights | ❌ |
| AI RFQ Extraction | ❌ (AI-сервис парсит письма, но не пишет в ERP) |

Этот этап зависит от готовности полей в Interaction (Этап 2.2) и API AI-сервиса.

---

## Рекомендуемый порядок следующих шагов

### Шаг 1 (приоритет: высокий) — Расширить схему

Одна миграция Prisma, которая добавляет:
- Customer: `legalName`, `country`, `city`, `address`, `tags String[]`, `isSupplier`, `isCustomer`
- Contact: `isPrimary`
- Interaction: `emailThreadId`, `emailFrom`, `emailTo`, `receivedAt`, `aiSummary`, `aiTags String[]`, `aiConfidence`
- InteractionType enum: добавить `RFQ`, `SYSTEM`, `AI_ANALYSIS`

### Шаг 2 (приоритет: высокий) — Timeline API

`GET /api/customers/:id/timeline` — объединённый список событий по клиенту.

### Шаг 3 (приоритет: средний) — Customer Card UI

Добавить в `customer.html` вкладки: Contacts (редактируемый список), Timeline, Notes.

### Шаг 4 (приоритет: средний) — Email inbox: панель клиента

При открытии письма — подгружать информацию о клиенте (найден/нет, заказы).

### Шаг 5 (приоритет: низкий) — AI поля

Подключить данные от AI-сервиса (порт 4000) и писать `aiSummary/aiTags/aiIntent` в Interaction.

---

## Архитектурные принципы (выполнено)

| Принцип ТЗ | Статус |
|-----------|--------|
| Логика НЕ в routes, а в services | ✅ (`customerService`, `interactionService`, `createOrderFromEmailService`, `emailCopilot` route → сервис) |
| Транзакции для email-операций | ✅ (`prisma.$transaction()` в createOrderFromEmailService и emailCopilot) |
| Idempotency | ✅ (`emailMessageId @unique`) |
| Frontend НЕ источник истины | ✅ (backend валидирует email, sender, нормализует) |
