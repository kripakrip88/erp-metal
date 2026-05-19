'use strict'
// Unit tests for pure calculation functions (no DB required)

const { test, describe } = require('node:test')
const assert = require('node:assert/strict')

const { calcLinearWeight, calcAreaWeight } = require('../../src/calculations/weightCalc')
const { calcLinearPaint, calcAreaPaint }   = require('../../src/calculations/paintCalc')
const { calcMaterialCost }                 = require('../../src/calculations/costCalc')

describe('calcLinearWeight — line profiles (pipes, angles, channels)', () => {
  test('calculates weight for a single 6m pipe at 10 kg/m', () => {
    const r = calcLinearWeight(6000, 10, 1)
    assert.equal(r.weightPerUnit, 60)
    assert.equal(r.totalWeight, 60)
    assert.equal(r.lengthM, 6)
  })

  test('calculates total weight for multiple pieces', () => {
    const r = calcLinearWeight(1500, 2.5, 4)
    assert.equal(r.weightPerUnit, 3.75)
    assert.equal(r.totalWeight, 15)
    assert.equal(r.lengthM, 1.5)
  })

  test('rounds to 4 decimal places', () => {
    const r = calcLinearWeight(1000, 3.333, 3)
    assert.equal(r.weightPerUnit, 3.333)
    assert.equal(r.totalWeight, 9.999)
  })

  test('handles zero length', () => {
    const r = calcLinearWeight(0, 10, 5)
    assert.equal(r.totalWeight, 0)
  })
})

describe('calcAreaWeight — sheet metal plates', () => {
  test('calculates weight for 1m×1m sheet at 78.5 kg/m²', () => {
    const r = calcAreaWeight(1000, 1000, 78.5, 1)
    assert.equal(r.areaM2, 1)
    assert.equal(r.weightPerUnit, 78.5)
    assert.equal(r.totalWeight, 78.5)
  })

  test('calculates 10mm steel sheet 2000×1500mm, qty 3', () => {
    // 2m × 1.5m × 78.5 kg/m² = 235.5 kg each × 3 = 706.5 kg
    const r = calcAreaWeight(2000, 1500, 78.5, 3)
    assert.equal(r.areaM2, 3)
    assert.equal(r.weightPerUnit, 235.5)
    assert.equal(r.totalWeight, 706.5)
  })

  test('returns areaM2 in square meters', () => {
    const r = calcAreaWeight(500, 400, 78.5, 1)
    assert.equal(r.areaM2, 0.2)
  })
})

describe('calcLinearPaint — paint area for line profiles', () => {
  test('calculates paint area for 3m beam, 0.2 m²/m paint factor', () => {
    const area = calcLinearPaint(3000, 0.2, 1)
    assert.equal(area, 0.6)
  })

  test('returns 0 when paintM2perM is null (no paint coating)', () => {
    const area = calcLinearPaint(3000, null, 1)
    assert.equal(area, 0)
  })

  test('handles multiple quantities', () => {
    const area = calcLinearPaint(2000, 0.15, 5)
    assert.equal(area, 1.5)
  })
})

describe('calcAreaPaint — paint area for sheet metal (both sides)', () => {
  test('paints both sides: 1m×1m sheet × 1 piece = 2 m²', () => {
    const area = calcAreaPaint(1000, 1000, 1)
    assert.equal(area, 2)
  })

  test('paints both sides of 500×400mm, qty 4 = 0.2 m² each × 2 sides × 4 = 1.6 m²', () => {
    const area = calcAreaPaint(500, 400, 4)
    assert.equal(area, 1.6)
  })
})

describe('calcMaterialCost — material pricing in RUB/ton', () => {
  test('calculates cost: 500 kg at 95000 RUB/ton = 47500 RUB', () => {
    const cost = calcMaterialCost(500, 95000)
    assert.equal(cost, 47500)
  })

  test('returns 0 when price per ton is 0 (no price data)', () => {
    const cost = calcMaterialCost(100, 0)
    assert.equal(cost, 0)
  })

  test('returns 0 when price per ton is falsy', () => {
    const cost = calcMaterialCost(100, null)
    assert.equal(cost, 0)
  })

  test('small weight precision: 0.5 kg at 100000 RUB/ton = 50 RUB', () => {
    const cost = calcMaterialCost(0.5, 100000)
    assert.equal(cost, 50)
  })
})
