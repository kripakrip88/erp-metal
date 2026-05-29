#!/usr/bin/env node
/**
 * Import fasteners (metiz) from IMPORT_METIZ_FINAL.csv into MaterialDefinition + ProcurementProfile
 * Usage: node scripts/import-metiz.js [path/to/IMPORT_METIZ_FINAL.csv]
 */

const fs      = require('fs')
const path    = require('path')
const readline = require('readline')
const prisma  = require('../src/repositories/prisma')

const CSV_PATH = process.argv[2] || path.join(__dirname, '../IMPORT_METIZ_FINAL.csv')
const SUPPLIER_NAME = 'Метиз Центр'
const PRICE_DATE    = new Date('2026-05-13')

function parseFloat2(v) {
  if (v === '' || v == null) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

function parseCsv(filePath) {
  return new Promise((resolve, reject) => {
    const rows = []
    const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity })
    let headers = null
    rl.on('line', (raw) => {
      // Strip BOM
      const line = raw.replace(/^﻿/, '')
      if (!headers) { headers = parseCsvLine(line); return }
      const vals = parseCsvLine(line)
      if (vals.length < 2) return
      const row = {}
      headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
      rows.push(row)
    })
    rl.on('close', () => resolve(rows))
    rl.on('error', reject)
  })
}

function parseCsvLine(line) {
  const result = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur)
  return result
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`)
    process.exit(1)
  }

  const company = await prisma.company.findFirst()
  if (!company) { console.error('Company not found'); process.exit(1) }
  const companyId = company.id

  const rows = await parseCsv(CSV_PATH)
  console.log(`Загружено строк из CSV: ${rows.length}`)

  let created = 0, updated = 0, skipped = 0

  for (const row of rows) {
    try {
      // Skip rows without unit (unit_erp must be 'шт')
      if (row.unit_erp !== 'шт') { skipped++; continue }
      // Skip packaging rows
      if (row.unit_supplier === 'упак') { skipped++; continue }

      const name = (row.name || '').trim()
      if (!name) { skipped++; continue }

      const weightG    = parseFloat2(row.weight_g_per_piece)
      const unitWeightKg = weightG != null ? weightG / 1000 : null
      const weightRequired = (weightG == null)

      const pricePerPiece    = parseFloat2(row.price_per_piece_rub)
      const priceSupplier    = parseFloat2(row.price_supplier)
      const diameterMm       = parseFloat2(row.diameter_mm)
      const lengthMm         = parseFloat2(row.length_mm)

      // Build a deterministic code from name (slugify)
      const code = 'MZ-' + name.replace(/[^a-zA-Zа-яёА-ЯЁ0-9]/g, '-').replace(/-+/g, '-').slice(0, 60)

      // Check existing material by name
      const existing = await prisma.materialDefinition.findFirst({
        where: { companyId, name, deletedAt: null },
        include: { geometry: true, procurementProfiles: { where: { supplierName: SUPPLIER_NAME, isActive: true } } }
      })

      if (existing) {
        // Update geometry weight
        await prisma.materialGeometry.update({
          where: { id: existing.geometryId },
          data: { unitWeightKg: unitWeightKg ?? undefined }
        })

        // Update fastener fields
        await prisma.materialDefinition.update({
          where: { id: existing.id },
          data: {
            weightRequired,
            weightNote: row.weight_source || null,
            gost:         row.gost         || null,
            fastenerType: row.type         || null,
            diameterMm:   diameterMm       ?? null,
            lengthMm:     lengthMm         ?? null,
            threadType:   row.thread       || null,
            coating:      row.coating      || null,
            strengthClass: row.strength_class || null,
            standard:     row.din          || null,
          }
        })

        // Upsert ProcurementProfile price
        const pp = existing.procurementProfiles[0]
        if (pp) {
          await prisma.procurementProfile.update({
            where: { id: pp.id },
            data: {
              pricePerPiece: pricePerPiece ?? null,
              notes: priceSupplier != null
                ? `${priceSupplier} руб/${row.unit_supplier || 'кг'} (${row.price_note || ''})`
                : null,
            }
          })
        } else {
          await prisma.procurementProfile.create({
            data: {
              companyId,
              materialDefinitionId: existing.id,
              supplierName: SUPPLIER_NAME,
              purchaseUnit: 'PIECE',
              pricePerPiece: pricePerPiece ?? null,
              notes: priceSupplier != null
                ? `${priceSupplier} руб/${row.unit_supplier || 'кг'} (${row.price_note || ''})`
                : null,
            }
          })
        }

        updated++
      } else {
        // Create geometry
        const geo = await prisma.materialGeometry.create({
          data: {
            measurementType: 'PIECE',
            unitWeightKg: unitWeightKg ?? null,
          }
        })

        // Create MaterialDefinition
        const mat = await prisma.materialDefinition.create({
          data: {
            companyId,
            code,
            name,
            materialType:  'STEEL',
            profileType:   'FASTENER',
            materialDomain: 'FASTENER',
            pieceUnit:     'pcs',
            geometryId:    geo.id,
            standard:      row.din          || null,
            gost:          row.gost         || null,
            strengthClass: row.strength_class || null,
            fastenerType:  row.type         || null,
            diameterMm:    diameterMm       ?? null,
            lengthMm:      lengthMm         ?? null,
            threadType:    row.thread       || null,
            coating:       row.coating      || null,
            weightRequired,
            weightNote:    row.weight_source || null,
          }
        })

        // Create ProcurementProfile
        await prisma.procurementProfile.create({
          data: {
            companyId,
            materialDefinitionId: mat.id,
            supplierName: SUPPLIER_NAME,
            purchaseUnit: 'PIECE',
            pricePerPiece: pricePerPiece ?? null,
            notes: priceSupplier != null
              ? `${priceSupplier} руб/${row.unit_supplier || 'кг'} (${row.price_note || ''})`
              : null,
          }
        })

        created++
      }
    } catch (err) {
      console.error(`  ОШИБКА: ${row.name} — ${err.message}`)
      skipped++
    }
  }

  console.log('\n=== Итог импорта ===')
  console.log(`Создано материалов:             ${created}`)
  console.log(`Обновлено (уже существовали):   ${updated}`)
  console.log(`Пропущено (ошибка/фильтр):      ${skipped}`)
  console.log(`Поставщик найден/создан:        "${SUPPLIER_NAME}"`)

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
