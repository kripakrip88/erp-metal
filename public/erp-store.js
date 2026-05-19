/**
 * MetalPro ERP — API Client
 * Тонкий слой над HTTP API. Никакого хранения orders в localStorage.
 * localStorage используется только simulator.html для черновика (erp_draft).
 */

const ERPStore = (() => {

  const API_BASE = '';

  // In-memory список заказов (живёт только в рамках сессии страницы)
  let _orders = null;

  // ─── Helpers ──────────────────────────────────────────────────────
  function _url(path) { return API_BASE + path }

  async function _fetch(path, opts = {}) {
    const res = await fetch(_url(path), {
      headers: { 'Content-Type': 'application/json', ...(localStorage.getItem('erp_token') ? { 'Authorization': 'Bearer ' + localStorage.getItem('erp_token') } : {}) },
      ...opts,
    })
    if (!res.ok) {
      if (res.status === 401) { localStorage.removeItem('erp_token'); localStorage.removeItem('erp_user'); location.replace('login.html'); return; }
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

  async function createPart(orderId, assemblyId, { materialDefinitionId, name, measurementType, length, sheetWidth, sheetHeight, directWeightKg, quantity, position, partCategory, bomTemplateCode, bomTemplateId, bomTemplateVersion, bomGroupKey, bomGroupLabel, bomDepth, bomPath, bomSortPath }) {
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
          partCategory:   partCategory || 'MATERIAL',
          bomTemplateCode:    bomTemplateCode    || null,
          bomTemplateId:      bomTemplateId      || null,
          bomTemplateVersion: bomTemplateVersion != null ? parseInt(bomTemplateVersion) : null,
          bomGroupKey:        bomGroupKey        || null,
          bomGroupLabel:      bomGroupLabel      || null,
          bomDepth:           bomDepth           != null ? parseInt(bomDepth) : null,
          bomPath:            bomPath            || null,
          bomSortPath:        bomSortPath        || null,
        }),
      }
    )
  }

  // ─── Coating materials (catalog) ─────────────────────────────────

  async function listCoatingMaterials() {
    return _fetch('/api/coating-materials')
  }

  async function createCoatingMaterial(data) {
    return _fetch('/api/coating-materials', { method: 'POST', body: JSON.stringify(data) })
  }

  async function updateCoatingMaterial(id, data) {
    return _fetch('/api/coating-materials/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify(data) })
  }

  // ─── Assembly coatings ────────────────────────────────────────────

  async function listAssemblyCoatings(assemblyId) {
    return _fetch('/api/assemblies/' + encodeURIComponent(assemblyId) + '/coatings')
  }

  async function createAssemblyCoating(assemblyId, data) {
    return _fetch('/api/assemblies/' + encodeURIComponent(assemblyId) + '/coatings', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async function updateAssemblyCoating(assemblyId, coatingId, data) {
    return _fetch(
      '/api/assemblies/' + encodeURIComponent(assemblyId) + '/coatings/' + encodeURIComponent(coatingId),
      { method: 'PUT', body: JSON.stringify(data) }
    )
  }

  async function deleteAssemblyCoating(assemblyId, coatingId) {
    return _fetch(
      '/api/assemblies/' + encodeURIComponent(assemblyId) + '/coatings/' + encodeURIComponent(coatingId),
      { method: 'DELETE' }
    )
  }

  // ─── Revisions ────────────────────────────────────────────────────

  async function loadRevisions(orderId) {
    return _fetch('/api/orders/' + encodeURIComponent(orderId) + '/revisions')
  }

  async function createRevision(orderId, notes) {
    return _fetch('/api/orders/' + encodeURIComponent(orderId) + '/revisions', {
      method: 'POST',
      body: JSON.stringify({ notes: notes || null }),
    })
  }

  // ─── Full sync (simulator "Зафиксировать ревизию") ────────────────
  // Очищает старые узлы, записывает новые, создаёт ревизию.
  // Возвращает { revision } или бросает ошибку.
  async function syncAndRevise(orderId, asms, notes, asmCoatings) {
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
          partCategory:    p.partCategory || 'MATERIAL',
          bomTemplateCode:    p.bomTemplateCode    || null,
          bomTemplateId:      p.bomTemplateId      || null,
          bomTemplateVersion: p.bomTemplateVersion != null ? p.bomTemplateVersion : null,
          bomGroupKey:        p.bomGroupKey        || null,
          bomGroupLabel:      p.bomGroupLabel      || null,
          bomDepth:           p.bomDepth           != null ? p.bomDepth : null,
          bomPath:            p.bomPath            || null,
          bomSortPath:        p.bomSortPath        || null,
        })
      }
      // Save coating layers for this assembly
      const coatings = asmCoatings?.[a.id] || []
      for (const c of coatings) {
        await createAssemblyCoating(dbAsm.id, {
          coatingMaterialId: c.coatingMaterialId,
          layerNumber:       c.layerNumber,
          autoAreaLink:      c.autoAreaLink,
          manualAreaM2:      c.manualAreaM2 ?? null,
          selectedDftMkm:    c.selectedDftMkm ?? null,
          dilutionPercent:   c.dilutionPercent ?? null,
          notes:             c.notes ?? null,
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

  // ─── Templates ────────────────────────────────────────────────────

  async function listTemplates() {
    return _fetch('/api/templates')
  }

  async function getTemplate(id) {
    return _fetch('/api/templates/' + encodeURIComponent(id))
  }

  async function createTemplate({ code, name, description }) {
    return _fetch('/api/templates', {
      method: 'POST',
      body: JSON.stringify({ code, name, description: description || null }),
    })
  }

  async function updateTemplate(id, data) {
    return _fetch('/api/templates/' + encodeURIComponent(id), {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async function deleteTemplate(id) {
    return _fetch('/api/templates/' + encodeURIComponent(id), { method: 'DELETE' })
  }

  async function createTemplateNode(templateId, { parentNodeId, name, qty, position }) {
    return _fetch('/api/templates/' + encodeURIComponent(templateId) + '/nodes', {
      method: 'POST',
      body: JSON.stringify({ parentNodeId: parentNodeId || null, name, qty: qty || 1, position: position || 0 }),
    })
  }

  async function updateTemplateNode(templateId, nodeId, data) {
    return _fetch(
      '/api/templates/' + encodeURIComponent(templateId) + '/nodes/' + encodeURIComponent(nodeId),
      { method: 'PUT', body: JSON.stringify(data) }
    )
  }

  async function deleteTemplateNode(templateId, nodeId) {
    return _fetch(
      '/api/templates/' + encodeURIComponent(templateId) + '/nodes/' + encodeURIComponent(nodeId),
      { method: 'DELETE' }
    )
  }

  async function createTemplateNodePart(templateId, nodeId, body) {
    return _fetch(
      '/api/templates/' + encodeURIComponent(templateId) + '/nodes/' + encodeURIComponent(nodeId) + '/parts',
      { method: 'POST', body: JSON.stringify(body) }
    )
  }

  async function updateTemplateNodePart(templateId, nodeId, partId, body) {
    return _fetch(
      '/api/templates/' + encodeURIComponent(templateId) + '/nodes/' + encodeURIComponent(nodeId) + '/parts/' + encodeURIComponent(partId),
      { method: 'PUT', body: JSON.stringify(body) }
    )
  }

  async function deleteTemplateNodePart(templateId, nodeId, partId) {
    return _fetch(
      '/api/templates/' + encodeURIComponent(templateId) + '/nodes/' + encodeURIComponent(nodeId) + '/parts/' + encodeURIComponent(partId),
      { method: 'DELETE' }
    )
  }

  async function applyTemplate(orderId, assemblyId, templateId, multiplier) {
    return _fetch(
      '/api/orders/' + encodeURIComponent(orderId) + '/assemblies/' + encodeURIComponent(assemblyId) + '/apply-template',
      { method: 'POST', body: JSON.stringify({ templateId, multiplier: multiplier || 1 }) }
    )
  }

  // ─── URL helpers ──────────────────────────────────────────────────

  function buildSimulatorURL(orderId) {
    return 'simulator.html?orderId=' + encodeURIComponent(orderId)
  }

  function buildTemplatesURL() {
    return 'templates.html'
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
    // Coating materials
    listCoatingMaterials,
    createCoatingMaterial,
    updateCoatingMaterial,
    // Assembly coatings
    listAssemblyCoatings,
    createAssemblyCoating,
    updateAssemblyCoating,
    deleteAssemblyCoating,
    // Revisions
    loadRevisions,
    createRevision,
    syncAndRevise,
    // Templates
    listTemplates,
    getTemplate,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createTemplateNode,
    updateTemplateNode,
    deleteTemplateNode,
    createTemplateNodePart,
    updateTemplateNodePart,
    deleteTemplateNodePart,
    applyTemplate,
    // Helpers
    formatDate,
    formatWeight,
    formatMoney,
    buildSimulatorURL,
    buildTemplatesURL,
  }

})()

if (typeof module !== 'undefined') module.exports = ERPStore
