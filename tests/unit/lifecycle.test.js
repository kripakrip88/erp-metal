'use strict'
// Unit tests for order status transition validation (pure function, no DB)

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { validateOrderStatusTransition } = require('../../src/services/orderLifecycleService')

// Статусная машина заказа:
// DRAFT → QUOTATION → AWAITING_APPROVAL → APPROVED → PRODUCTION → COMPLETED → DELIVERED
//                                        ↓
//                                    (CANCELLED — terminal)

describe('validateOrderStatusTransition — разрешённые переходы', () => {
  test('DRAFT → QUOTATION (отправка на расчёт)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('DRAFT', 'QUOTATION'))
  })

  test('QUOTATION → AWAITING_APPROVAL (передача на согласование)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('QUOTATION', 'AWAITING_APPROVAL'))
  })

  test('QUOTATION → DRAFT (возврат на доработку)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('QUOTATION', 'DRAFT'))
  })

  test('AWAITING_APPROVAL → APPROVED (КП утверждён)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('AWAITING_APPROVAL', 'APPROVED'))
  })

  test('AWAITING_APPROVAL → QUOTATION (возврат на пересчёт)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('AWAITING_APPROVAL', 'QUOTATION'))
  })

  test('APPROVED → PRODUCTION (запуск в производство)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('APPROVED', 'PRODUCTION'))
  })

  test('APPROVED → QUOTATION (отзыв на пересогласование)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('APPROVED', 'QUOTATION'))
  })

  test('PRODUCTION → COMPLETED (производство завершено)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('PRODUCTION', 'COMPLETED'))
  })

  test('COMPLETED → DELIVERED (отгрузка)', () => {
    assert.doesNotThrow(() => validateOrderStatusTransition('COMPLETED', 'DELIVERED'))
  })
})

describe('validateOrderStatusTransition — запрещённые переходы (защита бизнес-логики)', () => {
  test('DRAFT → PRODUCTION (нельзя перепрыгнуть через этапы)', () => {
    assert.throws(
      () => validateOrderStatusTransition('DRAFT', 'PRODUCTION'),
      { message: /Invalid transition/ }
    )
  })

  test('DRAFT → APPROVED (нельзя одобрить без КП)', () => {
    assert.throws(
      () => validateOrderStatusTransition('DRAFT', 'APPROVED'),
      { message: /Invalid transition/ }
    )
  })

  test('PRODUCTION → DRAFT (нельзя откатить из производства)', () => {
    assert.throws(
      () => validateOrderStatusTransition('PRODUCTION', 'DRAFT'),
      { message: /Invalid transition/ }
    )
  })

  test('DELIVERED → COMPLETED (нельзя откатить отгрузку)', () => {
    assert.throws(
      () => validateOrderStatusTransition('DELIVERED', 'COMPLETED'),
      { message: /Invalid transition/ }
    )
  })

  test('CANCELLED → DRAFT (терминальный статус необратим)', () => {
    assert.throws(
      () => validateOrderStatusTransition('CANCELLED', 'DRAFT'),
      { message: /Invalid transition/ }
    )
  })

  test('DELIVERED → DRAFT (терминальный статус DELIVERED необратим)', () => {
    assert.throws(
      () => validateOrderStatusTransition('DELIVERED', 'DRAFT'),
      { message: /Invalid transition/ }
    )
  })

  test('неизвестный статус бросает ошибку', () => {
    assert.throws(
      () => validateOrderStatusTransition('UNKNOWN_STATUS', 'DRAFT'),
      { message: /Unknown order status/ }
    )
  })
})

describe('validateOrderStatusTransition — полный цикл жизни заказа', () => {
  test('проходит весь путь от DRAFT до DELIVERED без ошибок', () => {
    const path = ['DRAFT', 'QUOTATION', 'AWAITING_APPROVAL', 'APPROVED', 'PRODUCTION', 'COMPLETED', 'DELIVERED']
    for (let i = 0; i < path.length - 1; i++) {
      assert.doesNotThrow(
        () => validateOrderStatusTransition(path[i], path[i + 1]),
        `Переход ${path[i]} → ${path[i + 1]} должен быть разрешён`
      )
    }
  })
})
