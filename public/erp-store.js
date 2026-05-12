/**
 * MetalPro ERP — Shared Data Store
 * Единый слой данных для всей системы.
 * Все страницы работают через этот модуль.
 * Готов к замене на Supabase/Postgres без изменения UI.
 */

const ERPStore = (() => {

  // ─── Storage keys ───────────────────────────────────────────────
  const KEYS = {
    ORDERS: 'erp_orders_v2',
    SETTINGS: 'erp_settings_v1',
  };

  // ─── Schema version ─────────────────────────────────────────────
  const SCHEMA_VERSION = '2.0';

  // ─── Internal helpers ───────────────────────────────────────────
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

  // ─── Orders ─────────────────────────────────────────────────────

  function getAllOrders() {
    return _read(KEYS.ORDERS) || [];
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

  /**
   * Создать новый заказ.
   * Автоматически создаёт первую ревизию R1.
   * Возвращает { ok, order, error }
   */
  function createOrder({ number, client, object, weightKg = 0, note = '' }) {
    number = String(number || '').trim();
    if (!number) return { ok: false, error: 'Номер заказа обязателен' };
    if (!isNumberUnique(number)) return { ok: false, error: `Заказ №${number} уже существует` };

    const now = _now();
    const order = {
      id: _genId('ord'),
      number,
      client: String(client || '').trim(),
      object: String(object || '').trim(),
      weightKg: parseFloat(weightKg) || 0,
      status: 'active',
      createdAt: now,
      updatedAt: now,
      schemaVersion: SCHEMA_VERSION,
      // Ревизии — immutable snapshots
      revisions: [
        {
          id: _genId('rev'),
          label: 'R1',
          num: 1,
          active: true,
          createdAt: now,
          note: note || 'Первичный расчёт',
          // Snapshot данных расчёта (заполняется из simulator)
          assemblies: [],
          totalWeightKg: 0,
          totalCostRub: 0,
          totalPaintM2: 0,
        }
      ],
      // Метаданные для будущих модулей
      meta: {
        bomVersion: null,
        productionStatus: null,
        files: [],
        procurement: null,
        aiData: null,
      }
    };

    const orders = getAllOrders();
    orders.unshift(order);
    _write(KEYS.ORDERS, orders);
    return { ok: true, order };
  }

  /**
   * Добавить новую ревизию к заказу.
   * Предыдущие ревизии становятся неактивными (immutable).
   * Возвращает { ok, revision, error }
   */
  function addRevision(orderId, { note = '', assemblies = [], totalWeightKg = 0, totalCostRub = 0, totalPaintM2 = 0 } = {}) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { ok: false, error: 'Заказ не найден' };

    const order = orders[idx];
    // Деактивируем все предыдущие ревизии
    order.revisions.forEach(r => { r.active = false; });

    const num = order.revisions.length + 1;
    const revision = {
      id: _genId('rev'),
      label: 'R' + num,
      num,
      active: true,
      createdAt: _now(),
      note: note || 'Пересчёт',
      assemblies: JSON.parse(JSON.stringify(assemblies)), // deep copy — snapshot
      totalWeightKg,
      totalCostRub,
      totalPaintM2,
    };

    order.revisions.push(revision);
    order.updatedAt = _now();
    // Обновляем вес заказа из активной ревизии
    order.weightKg = totalWeightKg;

    orders[idx] = order;
    _write(KEYS.ORDERS, orders);
    return { ok: true, revision };
  }

  /**
   * Получить активную ревизию заказа.
   */
  function getActiveRevision(order) {
    if (!order || !order.revisions || !order.revisions.length) return null;
    return order.revisions.find(r => r.active) || order.revisions[order.revisions.length - 1];
  }

  /**
   * Сохранить текущий черновик расчёта в активную ревизию заказа.
   * Используется из simulator при каждом изменении.
   */
  function saveDraftToRevision(orderId, { assemblies, totalWeightKg, totalCostRub, totalPaintM2 }) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { ok: false, error: 'Заказ не найден' };

    const order = orders[idx];
    const rev = order.revisions.find(r => r.active);
    if (!rev) return { ok: false, error: 'Нет активной ревизии' };

    rev.assemblies = JSON.parse(JSON.stringify(assemblies));
    rev.totalWeightKg = totalWeightKg;
    rev.totalCostRub = totalCostRub;
    rev.totalPaintM2 = totalPaintM2;
    order.weightKg = totalWeightKg;
    order.updatedAt = _now();

    orders[idx] = order;
    _write(KEYS.ORDERS, orders);
    return { ok: true };
  }

  /**
   * Обновить поля заказа (не ревизии).
   */
  function updateOrder(orderId, fields) {
    const orders = getAllOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return { ok: false, error: 'Заказ не найден' };

    const allowed = ['client', 'object', 'status'];
    allowed.forEach(k => {
      if (fields[k] !== undefined) orders[idx][k] = fields[k];
    });
    orders[idx].updatedAt = _now();
    _write(KEYS.ORDERS, orders);
    return { ok: true };
  }

  /**
   * Soft delete — помечаем как архивный, не удаляем физически.
   */
  function archiveOrder(orderId) {
    return updateOrder(orderId, { status: 'archived' });
  }

  // ─── URL helpers ─────────────────────────────────────────────────
  // Передача orderId между страницами через URL параметр

  function getOrderIdFromURL() {
    return new URLSearchParams(window.location.search).get('orderId');
  }

  function buildSimulatorURL(orderId) {
    return `simulator.html?orderId=${encodeURIComponent(orderId)}`;
  }

  function buildOrdersURL() {
    return 'orders.html';
  }

  // ─── Formatting helpers ──────────────────────────────────────────

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

  // ─── Public API ──────────────────────────────────────────────────
  return {
    getAllOrders,
    getOrderById,
    getOrderByNumber,
    isNumberUnique,
    createOrder,
    addRevision,
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

// Экспорт для совместимости
if (typeof module !== 'undefined') module.exports = ERPStore;
