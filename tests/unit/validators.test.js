'use strict'
// Unit tests for input validators (no DB required)

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { validateCreateOrder } = require('../../src/validators/orderValidator')

describe('validateCreateOrder — валидация создания заказа', () => {
  test('принимает корректные данные заказа', () => {
    const result = validateCreateOrder({
      customerName: 'ООО Металлургия',
      title:        'Забор металлический, ул. Ленина 5',
      orderNumber:  'ORD-2024-001',
    })
    assert.equal(result.customerName, 'ООО Металлургия')
    assert.equal(result.title, 'Забор металлический, ул. Ленина 5')
    assert.equal(result.orderNumber, 'ORD-2024-001')
    assert.equal(result.mode, 'STANDARD')
  })

  test('генерирует orderNumber если не передан', () => {
    const result = validateCreateOrder({
      customerName: 'ИП Иванов',
      title:        'Ворота откатные',
    })
    assert.ok(result.orderNumber.startsWith('ORD-'), `orderNumber должен начинаться с ORD-, получили: ${result.orderNumber}`)
  })

  test('бросает ошибку если customerName отсутствует', () => {
    assert.throws(
      () => validateCreateOrder({ title: 'Забор' }),
      { message: /customerName/ }
    )
  })

  test('бросает ошибку если title отсутствует', () => {
    assert.throws(
      () => validateCreateOrder({ customerName: 'ООО Металлургия' }),
      { message: /title/ }
    )
  })

  test('принимает опциональное описание', () => {
    const result = validateCreateOrder({
      customerName: 'ООО Тест',
      title:        'Конструкция',
      description:  'Площадка для автомобиля',
    })
    assert.equal(result.description, 'Площадка для автомобиля')
  })

  test('description равен null если не передан', () => {
    const result = validateCreateOrder({
      customerName: 'ООО Тест',
      title:        'Конструкция',
    })
    assert.equal(result.description, null)
  })

  test('принимает режим PHASED', () => {
    const result = validateCreateOrder({
      customerName: 'ООО Тест',
      title:        'Поэтапный проект',
      mode:         'PHASED',
    })
    assert.equal(result.mode, 'PHASED')
  })
})
