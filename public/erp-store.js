/**
 * MetalPro ERP — Shared Data Store
 * Единый слой данных для всей системы.
 * Все страницы работают через этот модуль.
 * API-first: GET/POST /api/orders, fallback → localStorage (офлайн).
 */

const ERPStore = (() => {

  const API_BASE = 'http://5.35.92.112';

  // ─── Storage keys ────────────────────────────────────────────────
  const KEYS = {
    ORDERS: 'erp_orders_v2',
    SETTINGS: 'erp_settings_v1',
  };

  const SCHEMA_VERSION = '2.0';

  // In-memory cache populated by loadOrders()
  let _cache = null;

  // ─── Internal helpers ─────────────────────────────────────────────
  function _read(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); }
    catch(e) { console.error('[ERPStore] read error', key, e); return null; }
  }

  function _write(key, data) {
    try { localStorage.setItem(key, JSON.stringify(data)); return true; }
    catch(e) { console.error('[ERPStore] write error', key, e); return false; }
  }

  function _genId(prefix) {
    return prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  function _now() {
    return new Date().toISOString();
  }

  // ─── API → ERPStore mapping ────────────────────────────────────────
  // Merges an API order with local localStorage data (to preserve assemblies).
  function _mergeOrder(apiOrder, localOrders) {
    const local = localOrders.find(l => l.id === apiOrder.id);

    let revisions;
    if (local && local.revisions && local.revisions.length > 0) {
      // Preserve local revision data (has assemblies / simulation results)
      revisions = local.revisions;
    } else {
      revisions = [{
        id: _genId('rev'), label: 'R1', num: 1, active: true,
        createdAt: apiOrder.createdAt, note: 'Первичный расчёт',
        assemblies: [], totalWeightKg: 0, totalCostRub: 0, totalPaintM2: 0,
      }];
    }

    return {
      id:            apiOrder.id,
      number:        apiOrder.orderNumber,
      client:        apiOrder.customerName,
      object:        apiOrder.title,
      weightKg:      local ? (local.weightKg || 0) : 0,
      status:        apiOrder.status === 'CANCELLED' ? 'archived' : 'active',
      createdAt:     apiOrder.createdAt,
      updatedAt:     apiOrder.updatedAt,
      schemaVersion: SCHEMA_VERSION,
      revisions,
      meta: local ? local.meta : { bomVersion: null, productionStatus: null, files: [], procurement: null, aiData: null },
    };
  }

  // ─── API: load all orders ──────────────────────────────────────────
  // Call on page init. Populates _cache; subsequent sync reads use it.
  async function loadOrders() {
    const localOrders = _read(KEYS.ORDERS) || [];
    try {
      const res = await fetch(API_BASE + '/api/orders');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const apiOrders = await res.json();

      const apiIds = new Set(apiOrders.map(o => o.id));
      // Orders created offline (old ord_xxx IDs) — keep them
      const localOnly = localOrders.filter(l => !apiIds.has(l.id));

      _cache = [
        ...apiOrders.map(o => _mergeOrder(o, localOrders)),
        ...localOnly,
      ];
      _write(KEYS.ORDERS, _cache);
      return _cache;
    } catch(e) {
      console.warn('[ERPStore] API недоступен, используем localStorage:', e.message);
      _cache = localOrders;
      return _cache;
    }
  }

  // ─── Sync reads from cache ─────────────────────────────────────────
  function getAllOrders() {
    return _cache !== null ? _cache : (_read(KEYS.ORDERS) || []);
  }

  function getOrderById(id) {
    return getAllOrders().find(o => o.id === id) || null;
  }

  function getOrderByNumber(number) {
    return getAllOrders().find(o => o.number === String(number).trim()) || null;
  }

  function isNumberUnique(number, excludeId = null) {
    const existing = getOrderByNumber(number);
    if (!existing) return true;
    if (excludeId && existing.id === excludeId) return true;
    return false;
  }

  // ─── API: get single order (for simulator page load) ──────────────
  async function getOrderByIdAsync(id) {
    try {
      const res = await fetch(API_BASE + '/api/orders/' + encodeURIComponent(id));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const apiOrder = await res.json();
      const localOrders = _read(KEYS.ORDERS) || [];
      const order = _mergeOrder(apiOrder, localOrders);

      // Ensure order exists in localStorage so saveDraftToRevision works
      const idx = localOrders.findIndex(o => o.id === order.id);
      if (idx === -1) {
        localOrders.unshift(order);
      } else {
        // Update metadata but preserve local revisions/assemblies
        localOrders[idx] = {
          ...localOrders[idx],
          id: order.id, number: order.number,
          client: order.client, object: order.object,
          status: order.status,
          updatedAt: order.updatedAt,
        };
      }
      _write(KEYS.ORDERS, localOrders);

      if (_cache !== null) {
        const ci = _cache.findIndex(o => o.id === order.id);
        if (ci === -1) _cache.unshift(order);
        else _cache[ci] = order;
      }
      return order;
    } catch(e) {
      console.warn('[ERPStore] getOrderByIdAsync fallback:', e.message);
      return getOrderById(id);
    }
  }

  // ─── Create order ──────────────────────────────────────────────────
  // Async: POST /api/orders, fallback to localStorage on network error.
  async function createOrder({ number, client, object, weightKg = 0, note = '' }) {
    number = String(number || '').trim();
    if (!number) return { ok: false, error: 'Номер заказа обязателен' };
    if (!isNumberUnique(number)) return { ok: false, error: `Заказ №${number} уже существует` };

    try {
      const res = await fetch(API_BASE + '/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderNumber:  number,
          customerName: client || '—',
          title:        object || '—',
          description:  note   || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { ok: false, error: err.error || 'Ошибка API (' + res.status + ')' };
      }
      const apiOrder = await res.json();
      const order = _mergeOrder(apiOrder, []);
      // Override default R1 with the user-supplied note
      order.revisions = [{
        id: _genId('rev'), label: 'R1', num: 1, active: true,
        createdAt: apiOrder.createdAt || _now(),
        note: note || 'Первичный расчёт',
        assemblies: [], totalWeightKg: 0, totalCostRub: 0, totalPaintM2: 0,
      }];

      if (_cache !== null) _cache.unshift(order);
      const stored = _read(KEYS.ORDERS) || [];
      stored.unshift(order);
      _write(KEYS.ORDERS, stored);
      return { ok: true, order };
    } catch(e) {
      console.warn('[ERPStore] createOrder API error, сохраняем локально:', e.message);
      return _createOrderLocal({ number, client, object, weightKg, note });
    }
  }

  // localStorage-only fallback (офлайн)
  function _createOrderLocal({ number, client, object, weightKg = 0, note = '' }) {
    const now = _now();
    const order = {
      id: _genId('ord'),
      number,
      client: String(client || '').trim(),
      object: String(object || '').trim(),
      weightKg: parseFloat(weightKg) || 0,
      status: 'active',
      createdAt: now, updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
      revisions: [{
        id: _genId('rev'), label: 'R1', num: 1, active: true,
        createdAt: now, note: note || 'Первичный расчёт',
        assemblies: [], totalWeightKg: 0, totalCostRub: 0, totalPaintM2: 0,
      }],
      meta: { bomVersion: null, productionStatus: null, files: [], procurement: null, aiData: null },
    };
    const orders = getAllOrders();
    orders.unshift(order);
    if (_cache !== null) _cache = orders;
    _write(KEYS.ORDERS, orders);
    return { ok: true, order };
  }

  // ─── Add revision (orders.html "Новая ревизия") ────────────────────
  // Saves locally immediately; also POSTs to API (fire-and-forget).
  async function addRevision(orderId, { note = '', assemblies = [], totalWeightKg = 0, totalCostRub = 0, totalPaintM2 = 0 } = {}) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { ok: false, error: 'Заказ не найден' };

    const order = orders[idx];
    order.revisions.forEach(r => { r.active = false; });

    const num = order.revisions.length + 1;
    const revision = {
      id: _genId('rev'),
      label: 'R' + num,
      num,
      active: true,
      createdAt: _now(),
      note: note || 'Пересчёт',
      assemblies: JSON.parse(JSON.stringify(assemblies)),
      totalWeightKg, totalCostRub, totalPaintM2,
    };

    order.revisions.push(revision);
    order.updatedAt = _now();
    order.weightKg = totalWeightKg;
    orders[idx] = order;
    if (_cache !== null) _cache = orders;
    _write(KEYS.ORDERS, orders);

    // Sync to API in background (don't block UI)
    createApiRevision(orderId, note).catch(e => console.warn('[ERPStore] addRevision API:', e.message));

    return { ok: true, revision };
  }

  // ─── API: create revision record ────────────────────────────────────
  // Called from simulator "Зафиксировать ревизию".
  async function createApiRevision(orderId, note = '') {
    const res = await fetch(API_BASE + '/api/orders/' + encodeURIComponent(orderId) + '/revisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes: note }),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  // ─── Active revision helper ────────────────────────────────────────
  function getActiveRevision(order) {
    if (!order || !order.revisions || !order.revisions.length) return null;
    return order.revisions.find(r => r.active) || order.revisions[order.revisions.length - 1];
  }

  // ─── Save draft (simulator → active revision) ──────────────────────
  function saveDraftToRevision(orderId, { assemblies, totalWeightKg, totalCostRub, totalPaintM2 }) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { ok: false, error: 'Заказ не найден' };

    const order = orders[idx];
    const rev = order.revisions.find(r => r.active);
    if (!rev) return { ok: false, error: 'Нет активной ревизии' };

    rev.assemblies = JSON.parse(JSON.stringify(assemblies));
    rev.totalWeightKg = totalWeightKg;
    rev.totalCostRub  = totalCostRub;
    rev.totalPaintM2  = totalPaintM2;
    order.weightKg    = totalWeightKg;
    order.updatedAt   = _now();

    orders[idx] = order;
    if (_cache !== null) _cache = orders;
    _write(KEYS.ORDERS, orders);
    return { ok: true };
  }

  // ─── Update order fields ───────────────────────────────────────────
  function updateOrder(orderId, fields) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { ok: false, error: 'Заказ не найден' };

    const allowed = ['client', 'object', 'status'];
    allowed.forEach(k => {
      if (fields[k] !== undefined) orders[idx][k] = fields[k];
    });
    orders[idx].updatedAt = _now();
    if (_cache !== null) _cache = orders;
    _write(KEYS.ORDERS, orders);
    return { ok: true };
  }

  function archiveOrder(orderId) {
    return updateOrder(orderId, { status: 'archived' });
  }

  // ─── URL helpers ───────────────────────────────────────────────────
  function getOrderIdFromURL() {
    return new URLSearchParams(window.location.search).get('orderId');
  }

  function buildSimulatorURL(orderId) {
    return `simulator.html?orderId=${encodeURIComponent(orderId)}`;
  }

  function buildOrdersURL() {
    return 'orders.html';
  }

  // ─── Formatting helpers ────────────────────────────────────────────
  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return [d.getDate(), d.getMonth() + 1, d.getFullYear()]
      .map((v, i) => i < 2 ? String(v).padStart(2, '0') : v).join('.');
  }

  function formatWeight(kg) {
    if (!kg) return '0 кг';
    return kg >= 1000 ? (kg / 1000).toFixed(2) + ' т' : Math.round(kg) + ' кг';
  }

  function formatMoney(rub) {
    return '₽ ' + Number(Math.round(rub)).toLocaleString('ru-RU');
  }

  // ─── Public API ────────────────────────────────────────────────────
  return {
    loadOrders,
    getAllOrders,
    getOrderById,
    getOrderByIdAsync,
    getOrderByNumber,
    isNumberUnique,
    createOrder,
    addRevision,
    createApiRevision,
    getActiveRevision,
    saveDraftToRevision,
    updateOrder,
    archiveOrder,
    getOrderIdFromURL,
    buildSimulatorURL,
    buildOrdersURL,
    formatDate,
    formatWeight,
    formatMoney,
  };

})();

if (typeof module !== 'undefined') module.exports = ERPStore;
