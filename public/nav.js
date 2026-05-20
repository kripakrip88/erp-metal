/* nav.js — МеталлПро ERP shared navigation component */
(function () {
  // ── Google Fonts ───────────────────────────────────────────────────────────────
  var fl = document.createElement('link');
  fl.rel = 'stylesheet';
  fl.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap';
  document.head.appendChild(fl);

  // ── Shared CSS ────────────────────────────────────────────────────────────────
  var css = ':root{' +
    '--bg:#0d0f12;--panel:#161b22;--card:#1c2330;--hov:#1e2738;' +
    '--brd:#252d3a;--brdl:#2d3748;' +
    '--txt:#e8ecf0;--txts:#8b9ab0;--txtm:#4a5568;' +
    '--blue:#3b82f6;--cyan:#06b6d4;--green:#10b981;--amber:#f59e0b;--red:#ef4444;--violet:#8b5cf6;' +
    '--sbw:205px;--topbarh:48px;' +
    "--ff:'Inter',sans-serif;--ffm:'DM Mono',monospace;" +
    '}' +
    '.light{' +
    '--bg:#eef1f5;--panel:#ffffff;--card:#f4f6f9;--hov:#e2e8f0;' +
    '--brd:#dde2ea;--brdl:#c8d0dc;' +
    '--txt:#1a1d23;--txts:#5a6478;--txtm:#9aa3b2;' +
    '}' +
    '*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}' +
    'html,body{height:100%;font-family:var(--ff);font-size:13px;background:var(--bg);color:var(--txt);line-height:1.5;}' +
    'a{color:inherit;text-decoration:none;}' +
    // Layout
    '.shell{display:flex;min-height:100vh;}' +
    '.main{margin-left:var(--sbw);flex:1;display:flex;flex-direction:column;min-height:100vh;}' +
    // Sidebar
    '.sb{background:var(--panel);border-right:1px solid var(--brd);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;width:var(--sbw);z-index:50;}' +
    '.sb::after{content:"";position:absolute;right:0;top:0;bottom:0;width:1px;background:linear-gradient(to bottom,transparent,var(--green) 35%,var(--cyan) 65%,transparent);opacity:.3;pointer-events:none;}' +
    '.slogo{padding:16px 14px 12px;font-size:13px;font-weight:700;color:var(--txt);letter-spacing:-.3px;flex-shrink:0;}' +
    '.slogo em{display:block;font-style:normal;font-size:10px;color:var(--txts);font-weight:400;margin-top:2px;}' +
    '.snav{flex:1;padding:4px 8px;overflow-y:auto;}' +
    '.nl{font-size:9.5px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--txtm);padding:10px 6px 4px;}' +
    '.ni{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;color:var(--txts);font-size:12.5px;font-weight:500;cursor:pointer;transition:color .12s,background .12s;text-decoration:none;position:relative;margin-bottom:1px;}' +
    '.ni:hover{background:var(--hov);color:var(--txt);}' +
    '.ni.on{color:var(--green);background:rgba(16,185,129,.08);}' +
    '.ni.on::before{content:"";position:absolute;left:-8px;top:50%;transform:translateY(-50%);width:3px;height:16px;background:var(--green);border-radius:0 2px 2px 0;}' +
    '.ni .ico{font-size:13px;flex-shrink:0;opacity:.7;width:16px;text-align:center;}' +
    '.ni.on .ico{opacity:1;}' +
    '.sfooter{padding:10px;border-top:1px solid var(--brd);flex-shrink:0;}' +
    '.sfooter-user{display:flex;align-items:center;gap:8px;margin-bottom:6px;}' +
    '.sfooter-av{width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,var(--blue),var(--violet));display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#fff;flex-shrink:0;}' +
    '.sfooter-info{flex:1;overflow:hidden;}' +
    '.sfooter-name{font-size:11.5px;font-weight:600;color:var(--txt);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.sfooter-email{font-size:10px;color:var(--txts);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
    '.sfooter-btns{display:flex;gap:4px;}' +
    '.sact{background:none;border:1px solid var(--brd);cursor:pointer;padding:4px 8px;border-radius:5px;color:var(--txts);font-size:11px;font-weight:500;transition:all .12s;font-family:var(--ff);flex:1;text-align:center;}' +
    '.sact:hover{background:var(--hov);color:var(--txt);border-color:var(--brdl);}' +
    // Topbar
    '.topbar{height:var(--topbarh);background:var(--panel);border-bottom:1px solid var(--brd);display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0;position:sticky;top:0;z-index:30;}' +
    '.topbar-title{font-weight:700;font-size:14px;}' +
    '.topbar-right{margin-left:auto;display:flex;gap:8px;align-items:center;}' +
    // Content
    '.content{padding:20px;flex:1;}' +
    // Buttons
    '.btn{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:6px;border:1px solid transparent;cursor:pointer;font-family:var(--ff);font-size:12.5px;font-weight:600;transition:all .12s;white-space:nowrap;}' +
    '.btn-primary{background:var(--blue);color:#fff;border-color:var(--blue);}' +
    '.btn-primary:hover{filter:brightness(1.1);}' +
    '.btn-secondary{background:var(--card);color:var(--txt);border-color:var(--brd);}' +
    '.btn-secondary:hover{border-color:var(--blue);color:var(--blue);}' +
    '.btn-danger{background:rgba(239,68,68,.1);color:var(--red);border-color:rgba(239,68,68,.2);}' +
    '.btn-danger:hover{background:rgba(239,68,68,.18);}' +
    '.btn-success{background:rgba(16,185,129,.1);color:var(--green);border-color:rgba(16,185,129,.2);}' +
    '.btn-success:hover{background:rgba(16,185,129,.18);}' +
    '.btn-sm{padding:4px 10px;font-size:12px;}' +
    '.btn-xs{padding:2px 8px;font-size:11px;}' +
    '.btn:disabled{opacity:.4;cursor:not-allowed;}' +
    // Inputs
    'input,select,textarea{background:var(--card);border:1px solid var(--brd);border-radius:6px;color:var(--txt);font-family:var(--ff);font-size:13px;outline:none;padding:7px 10px;transition:border-color .12s,box-shadow .12s;width:100%;}' +
    'input:focus,select:focus,textarea:focus{border-color:var(--blue);box-shadow:0 0 0 3px rgba(59,130,246,.12);}' +
    'input::placeholder,textarea::placeholder{color:var(--txtm);}' +
    'textarea{resize:vertical;min-height:72px;}' +
    'label{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--txts);}' +
    '.field{display:flex;flex-direction:column;gap:4px;margin-bottom:14px;}' +
    '.field:last-child{margin-bottom:0;}' +
    // Table
    'table{width:100%;border-collapse:collapse;}' +
    'thead th{padding:8px 12px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:var(--txts);background:var(--panel);border-bottom:1px solid var(--brd);white-space:nowrap;}' +
    'tbody tr{border-bottom:1px solid var(--brd);transition:background .1s;}' +
    'tbody tr:last-child{border-bottom:none;}' +
    'tbody tr:hover{background:var(--hov);}' +
    'tbody tr.clickable{cursor:pointer;}' +
    'td{padding:9px 12px;vertical-align:middle;}' +
    // Card
    '.card{background:var(--panel);border:1px solid var(--brd);border-radius:8px;overflow:hidden;}' +
    '.card-body{padding:16px;}' +
    // Badges
    '.badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:4px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;white-space:nowrap;}' +
    '.b-draft{background:rgba(139,154,176,.1);color:var(--txts);}' +
    '.b-quotation,.b-awaiting{background:rgba(245,158,11,.12);color:var(--amber);}' +
    '.b-production,.b-approved,.b-order,.b-high{background:rgba(59,130,246,.12);color:var(--blue);}' +
    '.b-completed,.b-delivered,.b-normal,.b-replied,.b-inbound,.b-active,.b-rfq{background:rgba(16,185,129,.12);color:var(--green);}' +
    '.b-cancelled,.b-complaint,.b-critical,.b-archived,.b-danger{background:rgba(239,68,68,.12);color:var(--red);}' +
    '.b-vip,.b-meeting,.b-piece{background:rgba(139,92,246,.12);color:var(--violet);}' +
    '.b-email,.b-area,.b-question,.b-urgent,.b-pending{background:rgba(245,158,11,.12);color:var(--amber);}' +
    '.b-call,.b-linear,.b-outbound{background:rgba(59,130,246,.12);color:var(--blue);}' +
    '.b-low,.b-spam,.b-other,.b-note,.b-secondary{background:rgba(139,154,176,.08);color:var(--txts);}' +
    // Mono
    '.mono{font-family:var(--ffm);font-size:11.5px;}' +
    // Modal
    '.modal-bg{position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100;display:flex;align-items:center;justify-content:center;padding:20px;}' +
    '.modal{background:var(--panel);border:1px solid var(--brd);border-radius:10px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 64px rgba(0,0,0,.5);}' +
    '.modal-header{padding:16px 20px;border-bottom:1px solid var(--brd);display:flex;justify-content:space-between;align-items:center;position:sticky;top:0;background:var(--panel);z-index:1;}' +
    '.modal-title{font-weight:700;font-size:15px;}' +
    '.modal-close{background:none;border:none;color:var(--txts);cursor:pointer;font-size:18px;padding:2px;line-height:1;border-radius:4px;}' +
    '.modal-close:hover{color:var(--txt);}' +
    '.modal-body{padding:20px;}' +
    '.modal-footer{padding:12px 20px;border-top:1px solid var(--brd);display:flex;justify-content:flex-end;gap:8px;position:sticky;bottom:0;background:var(--panel);}' +
    // Toast (shared, class erp-toast)
    '.erp-toast{position:fixed;bottom:20px;right:20px;background:var(--card);border:1px solid var(--brd);color:var(--txt);border-radius:8px;padding:11px 15px;font-size:13px;font-weight:500;z-index:2000;display:flex;align-items:center;gap:8px;transform:translateY(10px);opacity:0;transition:all .2s;max-width:360px;box-shadow:0 8px 24px rgba(0,0,0,.4);}' +
    '.erp-toast.show{transform:translateY(0);opacity:1;}' +
    '.erp-toast.success{border-color:rgba(16,185,129,.4);background:rgba(16,185,129,.1);color:var(--green);}' +
    '.erp-toast.error{border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.1);color:var(--red);}' +
    // Helpers
    '.empty{text-align:center;padding:40px 20px;color:var(--txts);}' +
    '.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;}' +
    '.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;}' +
    '.section-sep{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:var(--txts);padding-bottom:8px;border-bottom:1px solid var(--brd);margin-bottom:14px;margin-top:20px;}' +
    '.section-sep:first-child{margin-top:0;}' +
    // Search input override for search bars
    '.search-wrap{position:relative;}' +
    '.search-icon{position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--txts);pointer-events:none;font-size:13px;}' +
    '.search-input{padding-left:30px!important;}' +
    // Filter pills
    '.filter-pill{padding:4px 12px;border-radius:20px;border:1px solid var(--brd);background:var(--card);color:var(--txts);font-family:var(--ff);font-size:12px;font-weight:600;cursor:pointer;transition:all .12s;}' +
    '.filter-pill:hover{border-color:var(--blue);color:var(--blue);}' +
    '.filter-pill.on{background:var(--blue);border-color:var(--blue);color:#fff;}' +
    '';

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.insertBefore(styleEl, document.head.firstChild);

  // ── Theme ─────────────────────────────────────────────────────────────────────
  var _theme = localStorage.getItem('erp_theme') || 'dark';
  document.documentElement.classList.toggle('light', _theme === 'light');

  // ── Auth ──────────────────────────────────────────────────────────────────────
  var _token = localStorage.getItem('erp_token') || '';
  var _path = location.pathname;
  if (!_token && !_path.endsWith('login.html')) {
    location.replace('login.html');
  }
  var _user = {};
  try { _user = JSON.parse(localStorage.getItem('erp_user') || '{}'); } catch (e) {}

  // ── Nav items ─────────────────────────────────────────────────────────────────
  var NAV = [
    { group: 'Workflow', items: [
      { id: 'orders',    href: 'orders.html',       ico: '▤',  label: 'Журнал заказов' },
      { id: 'simulator', href: 'simulator.html',    ico: '◈',  label: 'Расчёт КП' },
    ]},
    { group: 'CRM', items: [
      { id: 'pipeline',  href: 'pipeline.html',     ico: '⬛',  label: 'CRM' },
      { id: 'crm',       href: 'crm.html',          ico: '◉',  label: 'Клиенты' },
      { id: 'email',     href: 'email-inbox.html',  ico: '✉',  label: 'Входящие' },
    ]},
    { group: 'Справочники', items: [
      { id: 'materials',         href: 'materials.html',          ico: '⬡',  label: 'Металлопрокат' },
      { id: 'fasteners',         href: 'fasteners.html',          ico: '⬡',  label: 'Метизы' },
      { id: 'coating-materials', href: 'coating-materials.html',  ico: '◫',  label: 'ЛКМ' },
      { id: 'templates',         href: 'templates.html',          ico: '⬤',  label: 'Шаблоны' },
    ]},
  ];

  function _esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _buildSidebar(activeId) {
    var navHtml = NAV.map(function (section) {
      return '<div class="nl">' + _esc(section.group) + '</div>' +
        section.items.map(function (item) {
          return '<a class="ni' + (item.id === activeId ? ' on' : '') + '" href="' + item.href + '">' +
            '<span class="ico">' + item.ico + '</span>' + _esc(item.label) + '</a>';
        }).join('');
    }).join('');

    var name = ((_user.firstName || '') + ' ' + (_user.lastName || '')).trim() || 'Менеджер';
    var initials = name.split(' ').map(function (w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase() || 'MP';
    var email = _user.email || '';

    return '<div class="slogo">МеталлПро ERP<em>Рабочий стенд v1.0</em></div>' +
      '<nav class="snav">' + navHtml + '</nav>' +
      '<div class="sfooter">' +
        '<div class="sfooter-user">' +
          '<div class="sfooter-av">' + initials + '</div>' +
          '<div class="sfooter-info">' +
            '<div class="sfooter-name">' + _esc(name) + '</div>' +
            (email ? '<div class="sfooter-email">' + _esc(email) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="sfooter-btns">' +
          '<button class="sact" id="_erpThemeBtn" title="Тема">☀ Тема</button>' +
          '<button class="sact" id="_erpLogoutBtn" title="Выйти">Выйти</button>' +
        '</div>' +
      '</div>';
  }

  // ── Toast ─────────────────────────────────────────────────────────────────────
  var _toastEl = null;
  var _toastTimer = null;

  function _toast(msg, type) {
    if (!_toastEl) {
      _toastEl = document.createElement('div');
      _toastEl.className = 'erp-toast';
      document.body.appendChild(_toastEl);
    }
    _toastEl.textContent = (type === 'success' ? '✓ ' : type === 'error' ? '✗ ' : '') + msg;
    _toastEl.className = 'erp-toast show' + (type ? ' ' + type : '');
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(function () { _toastEl.className = 'erp-toast'; }, 3000);
  }

  // ── authFetch ─────────────────────────────────────────────────────────────────
  function _authFetch(url, opts) {
    var options = Object.assign({}, opts || {});
    options.headers = Object.assign({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem('erp_token') || ''),
    }, options.headers || {});
    return fetch(url, options).then(function (r) {
      if (r.status === 401) {
        localStorage.removeItem('erp_token');
        localStorage.removeItem('erp_user');
        location.replace('login.html');
      }
      return r;
    });
  }

  function _authHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (localStorage.getItem('erp_token') || ''),
    };
  }

  // ── Public API ────────────────────────────────────────────────────────────────
  window.ERP = {
    token: _token,
    user: _user,
    esc: _esc,
    toast: _toast,
    authFetch: _authFetch,
    authHeaders: _authHeaders,
    init: function (pageId) {
      var navEl = document.getElementById('erp-nav');
      if (navEl) navEl.innerHTML = _buildSidebar(pageId);

      var themeBtn = document.getElementById('_erpThemeBtn');
      if (themeBtn) {
        themeBtn.addEventListener('click', function () {
          _theme = _theme === 'dark' ? 'light' : 'dark';
          localStorage.setItem('erp_theme', _theme);
          document.documentElement.classList.toggle('light', _theme === 'light');
        });
      }

      var logoutBtn = document.getElementById('_erpLogoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          localStorage.removeItem('erp_token');
          localStorage.removeItem('erp_user');
          location.replace('login.html');
        });
      }
    },
  };
})();
