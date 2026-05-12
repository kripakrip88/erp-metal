/**
 * MetalPro ERP — API Client
 * Тонкий слой над HTTP API. Никакого хранения orders в localStorage.
 * localStorage используется только simulator.html для черновика (erp_draft).
 */

const ERPStore = (() => {

  const API_BASE = 'http://5.35.92.112';

  // In-memory список заказов (живёт только в рамках сессии страницы)
  let _orders = null;

  // ─── Helpers ──────────────────────────────────────────────────────
  function _url(path) { return API_BASE + path }

  async function _fetch(path, opts = {}) {
    const res = await fetch(_url(path), {
      headers: { 'Content-Type': 'application/json' },
      ...opts,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw Object.assign(new Error(err.error || 'HTTP ' + res.status), { status: res.status })
    }
    return res.json()
  }

  // ─── Orders ───────────────────────────────────────────────────────

  async function loadOrders() {
    _orders = await _fetch('/api/orders')
    return _orders
  }

  function getAllOrders() {
    return _orders || []
  }

  function getOrderById(id) {
    return (_orders || []).find(o => o.id === id) || null
  }

  async function fetchOrder(id) {
    return _fetch('/api/orders/' + encodeURIComponent(id))
  }

  async function createOrder({ orderNumber, customerName, title, description }) {
    const order = await _fetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ orderNumber, customerName, title, description: description || null }),
    })
    if (_orders) _orders.unshift(order)
    return order
  }

  // ─── Assemblies ───────────────────────────────────────────────────

  async function clearAssemblies(orderId) {
    return _fetch('/api/orders/' + encodeURIComponent(orderId) + '/assemblies', { method: 'DELETE' })
  }

  async function createAssembly(orderId, { name, qty, position }) {
    return _fetch('/api/orders/' + encodeURIComponent(orderId) + '/assemblies', {
      method: 'POST',
      body: JSON.stringify({ name, qty: qty || 1, position: position || 0 }),
    })
  }

  async function createPart(orderId, assemblyId, { materialDefinitionId, name, measurementType, length, sheetWidth, sheetHeight, directWeightKg, quantity, position }) {
    return _fetch(
      '/api/orders/' + encodeURIComponent(orderId) +
      '/assemblies/' + encodeURIComponent(assemblyId) + '/parts',
      {
        method: 'POST',
        body: JSON.stringify({
          materialDefinitionId,
          name:           name           || null,
          measurementType: measurementType || 'LINEAR',
          length:         length          != null ? Number(length)         : null,
          sheetWidth:     sheetWidth      != null ? Number(sheetWidth)     : null,
          sheetHeight:    sheetHeight     != null ? Number(sheetHeight)    : null,
          directWeightKg: directWeightKg  != null ? Number(directWeightKg) : null,
          quantity:       parseInt(quantity) || 1,
          position:       position || 0,
        }),
      }
    )
  }

  // ─── Revisions ────────────────────────────────────────────────────

  async function createRevision(orderId, notes) {
    return _fetch('/api/orders/' + encodeURIComponent(orderId) + '/revisions', {
      method: 'POST',
      body: JSON.stringify({ notes: notes || null }),
    })
  }

  // ─── Full sync (simulator "Зафиксировать ревизию") ────────────────
  // Очищает старые узлы, записывает новые, создаёт ревизию.
  // Возвращает { revision } или бросает ошибку.
  async function syncAndRevise(orderId, asms, notes) {
    await clearAssemblies(orderId)

    for (let i = 0; i < asms.length; i++) {
      const a = asms[i]
      const dbAsm = await createAssembly(orderId, { name: a.name, qty: a.qty || 1, position: i })
      for (let j = 0; j < a.parts.length; j++) {
        const p = a.parts[j]
        await createPart(orderId, dbAsm.id, {
          materialDefinitionId: p.mid,
          name:            p.name     || null,
          measurementType: _mtypeToDb(p.mtype),
          length:          p.mtype === 'linear' ? p.len  : null,
          sheetWidth:      p.mtype === 'area'   ? p.w    : null,
          sheetHeight:     p.mtype === 'area'   ? p.h    : null,
          directWeightKg:  p.mtype === 'piece'  ? p.pw   : null,
          quantity:        p.qty || 1,
          position:        j,
        })
      }
    }

    return createRevision(orderId, notes)
  }

  function _mtypeToDb(mtype) {
    return { linear: 'LINEAR', area: 'AREA', piece: 'PIECE' }[mtype] || 'LINEAR'
  }

  // ─── Formatting (UI helpers) ──────────────────────────────────────

  function formatDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return [d.getDate(), d.getMonth() + 1, d.getFullYear()]
      .map((v, i) => i < 2 ? String(v).padStart(2, '0') : v).join('.')
  }

  function formatWeight(kg) {
    if (!kg) return '0 кг'
    return kg >= 1000 ? (kg / 1000).toFixed(2) + ' т' : Math.round(kg) + ' кг'
  }

  function formatMoney(rub) {
    return '₽ ' + Number(Math.round(rub)).toLocaleString('ru-RU')
  }

  // ─── URL helpers ──────────────────────────────────────────────────

  function buildSimulatorURL(orderId) {
    return 'simulator.html?orderId=' + encodeURIComponent(orderId)
  }

  // ─── Public API ───────────────────────────────────────────────────
  return {
    // Orders
    loadOrders,
    getAllOrders,
    getOrderById,
    fetchOrder,
    createOrder,
    // Assemblies & parts (exposed for advanced use)
    clearAssemblies,
    createAssembly,
    createPart,
    // Revisions
    createRevision,
    syncAndRevise,
    // Helpers
    formatDate,
    formatWeight,
    formatMoney,
    buildSimulatorURL,
  }

})()

if (typeof module !== 'undefined') module.exports = ERPStore
