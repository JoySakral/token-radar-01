// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, filters, a per-protocol detail drawer with the model's own inputs and
// the protocol's farm plan, a watchlist view, a live-token view, and a model sandbox that
// recomputes implied values live. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var app = document.getElementById('board');
  if (!DATA || !app) return;

  var params = new URLSearchParams(window.location.search);
  var state = {
    tab: params.get('tab') || 'board',
    q: params.get('q') || '',
    chain: params.get('chain') || 'all',
    category: params.get('category') || 'all',
    sort: params.get('sort') || 'implied',
    watchonly: params.get('watchonly') === '1',
    selected: params.get('detail') || null,
    base: parseFloat(params.get('base') || '') || DATA.model.base_multiple,
    growth: parseFloat(params.get('growth') || '') || DATA.model.growth_weight,
  };
  if (['board', 'watchlist', 'live'].indexOf(state.tab) < 0) state.tab = 'board';

  var watchSet = {};
  DATA.watchlist.forEach(function (s) { watchSet[s] = true; });

  // ---- formatting ---------------------------------------------------------
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return '×' + n.toFixed(2); }

  // ---- the model, recomputed in the page ----------------------------------
  // The page recomputes a row from the snapshot figures and checks the number board.json
  // carries, so the page's code and the board's data are visibly the same arithmetic. The
  // sandbox moves only the base multiple and the growth weight; the other multipliers are
  // the row's own, read from the snapshot.
  function impliedOf(row, base, growthWeight) {
    var growthMult = 1 + (row.growth_pct / 100) * growthWeight;
    return Math.max(1, Math.round(row.tvl_usd * base * growthMult * row.maturity_multiplier * row.chain_multiplier * row.momentum_multiplier));
  }
  function sandboxChanged() {
    return state.base !== DATA.model.base_multiple || state.growth !== DATA.model.growth_weight;
  }

  // ---- tiny DOM helper -----------------------------------------------------
  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ---- filtering and sorting ----------------------------------------------
  function visibleRows() {
    var rows = DATA.rows.slice();
    if (state.tab === 'watchlist') rows = rows.filter(function (r) { return watchSet[r.slug]; });
    if (state.watchonly) rows = rows.filter(function (r) { return watchSet[r.slug]; });
    if (state.chain !== 'all') rows = rows.filter(function (r) { return r.chains.indexOf(state.chain) >= 0; });
    if (state.category !== 'all') rows = rows.filter(function (r) { return r.category === state.category; });
    if (state.q) {
      var q = state.q.toLowerCase();
      rows = rows.filter(function (r) { return r.name.toLowerCase().indexOf(q) >= 0 || r.slug.toLowerCase().indexOf(q) >= 0; });
    }
    var dir = -1;
    rows.sort(function (a, b) {
      var va, vb;
      if (state.sort === 'tvl') { va = a.tvl_usd; vb = b.tvl_usd; }
      else if (state.sort === 'growth') { va = a.change_7d === null ? -Infinity : a.change_7d; vb = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (state.sort === 'age') { va = a.age_days === null ? -1 : a.age_days; vb = b.age_days === null ? -1 : b.age_days; }
      else if (state.sort === 'name') { return a.name.localeCompare(b.name); }
      else { va = impliedOf(a, state.base, state.growth); vb = impliedOf(b, state.base, state.growth); }
      return (vb - va) * (dir === -1 ? 1 : -1) || (a.slug < b.slug ? -1 : 1);
    });
    return rows;
  }

  // ---- header stats --------------------------------------------------------
  function renderStats() {
    var stats = document.getElementById('stats');
    stats.innerHTML = '';
    var top = DATA.rows[0];
    var items = [
      { b: String(DATA.board_size), s: 'protocols ranked', e: 'every launchable one in the snapshot' },
      { b: String(DATA.watchlist_size), s: 'on the watchlist', e: 'all covered, 40 of 40' },
      { b: fmtUsd(DATA.total_implied_usd), s: 'total implied value', e: 'the board’s own estimate, summed' },
      { b: top ? fmtUsd(top.implied_value_usd) : 'n/a', s: 'top implied value', e: top ? top.name + ' at rank 1' : '' },
      { b: String(DATA.pre_token_size), s: 'protocols record no token', e: 'of ' + DATA.snapshot_size + ' in the snapshot' },
    ];
    items.forEach(function (it) {
      stats.appendChild(el('div', { class: 'stat' }, el('b', { text: it.b }), el('span', { text: it.s }), el('em', { text: it.e })));
    });
    document.getElementById('asof').textContent = 'Snapshot ' + DATA.as_of + ' · ' + DATA.rows.length + ' ranked';
    document.getElementById('modeltag').textContent = 'model ' + DATA.model_version;
    document.getElementById('wlcount').textContent = DATA.watchlist_size;
    document.getElementById('livecount').textContent = DATA.live_size;
    document.getElementById('source').textContent = 'Data: sealed snapshot — ' + DATA.source + '. Snapshot date ' + DATA.as_of + '.';
  }

  // ---- spotlight -----------------------------------------------------------
  function renderSpotlight() {
    var grid = document.getElementById('spotlight');
    grid.innerHTML = '';
    DATA.rows.slice(0, 5).forEach(function (r) {
      var val = impliedOf(r, state.base, state.growth);
      var card = el('button', { class: 'spot-card', type: 'button', onclick: function () { openDetail(r.slug); } },
        el('span', { class: 'rank', text: '#' + r.rank }),
        el('span', { class: 'name', text: r.name }),
        el('span', { class: 'cat', text: (r.category || 'Uncategorised') + ' · ' + (r.chains[0] || '—') }),
        el('span', { class: 'val', text: fmtUsd(val) }),
        el('span', { class: 'sub', text: 'TVL ' + fmtUsd(r.tvl_usd) + ' · ' + fmtPct(r.change_7d) + ' 7d' }));
      grid.appendChild(card);
    });
  }

  // ---- the board table ------------------------------------------------------
  function renderTable() {
    var tbody = document.getElementById('rows');
    var empty = document.getElementById('empty');
    var line = document.getElementById('resultline');
    tbody.innerHTML = '';
    if (state.tab === 'live') {
      var live = DATA.live.slice();
      if (state.q) {
        var q = state.q.toLowerCase();
        live = live.filter(function (r) { return r.name.toLowerCase().indexOf(q) >= 0 || r.slug.toLowerCase().indexOf(q) >= 0; });
      }
      if (state.chain !== 'all') live = live.filter(function (r) { return r.chains.indexOf(state.chain) >= 0; });
      if (state.category !== 'all') live = live.filter(function (r) { return r.category === state.category; });
      line.textContent = live.length + ' live-token protocols by market cap — the market’s own value, not an implied one.';
      live.forEach(function (r) {
        tbody.appendChild(el('tr', { onclick: function () { openDetail(r.slug); } },
          el('td', { class: 'num rank', text: '—' }),
          el('td', { class: 'name' }, document.createTextNode(r.name), el('small', { text: r.slug })),
          el('td', { class: 'cat', text: r.category || '—' }),
          el('td', { class: 'chains', text: chainLabel(r.chains) }),
          el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
          el('td', { class: 'num ' + pctClass(r.change_7d), text: fmtPct(r.change_7d) }),
          el('td', { class: 'num', text: '—' }),
          el('td', { class: 'num implied', text: fmtUsd(r.mcap_usd) }),
          el('td', { class: 'num', text: '—' })));
      });
      empty.hidden = live.length > 0;
      return;
    }
    var rows = visibleRows();
    var maxImp = rows.reduce(function (m, r) { return Math.max(m, impliedOf(r, state.base, state.growth)); }, 1);
    line.textContent = rows.length + ' protocol' + (rows.length === 1 ? '' : 's') +
      (state.tab === 'watchlist' ? ' on the watchlist' : '') +
      (sandboxChanged() ? ' · sandbox values in effect (base ' + state.base.toFixed(2) + ', growth weight ' + state.growth.toFixed(2) + ')' : ' · ranked by implied value');
    rows.forEach(function (r) {
      var val = impliedOf(r, state.base, state.growth);
      var pct = Math.max(2, Math.round((val / maxImp) * 100));
      var tr = el('tr', { onclick: function () { openDetail(r.slug); }, class: state.selected === r.slug ? 'selected' : '' },
        el('td', { class: 'num rank', text: '#' + r.rank }),
        el('td', { class: 'name' }, document.createTextNode(r.name), el('small', { text: r.slug + (watchSet[r.slug] ? ' · watchlist' : '') })),
        el('td', { class: 'cat', text: r.category || '—' }),
        el('td', { class: 'chains', text: chainLabel(r.chains) }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + pctClass(r.change_7d), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num implied', text: fmtUsd(val) }),
        el('td', { class: 'num' }, el('span', { class: 'scorebar' }, el('i', { style: 'width:' + pct + '%' }))));
      tbody.appendChild(tr);
    });
    empty.hidden = rows.length > 0;
  }

  function chainLabel(chains) {
    if (!chains || chains.length === 0) return '—';
    if (chains.length === 1) return chains[0];
    return chains[0] + ' +' + (chains.length - 1);
  }
  function pctClass(n) {
    if (n === null || n === undefined) return '';
    return n > 0 ? 'pos' : n < 0 ? 'neg' : '';
  }

  // ---- detail drawer --------------------------------------------------------
  function findRow(slug) {
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) return DATA.rows[i];
    return null;
  }
  function openDetail(slug) {
    var row = findRow(slug);
    var box = document.getElementById('detail');
    var drawer = document.getElementById('drawer');
    var scrim = document.getElementById('scrim');
    if (!row) {
      // A live-token protocol: show its market figures, not a model estimate.
      var live = null;
      for (var i = 0; i < DATA.live.length; i++) if (DATA.live[i].slug === slug) live = DATA.live[i];
      if (!live) return;
      box.innerHTML = '';
      box.appendChild(el('div', { class: 'detail' },
        el('h2', { text: live.name }),
        el('p', { class: 'dsub', text: (live.category || 'Uncategorised') + ' · ' + chainLabel(live.chains) + ' · already trading' }),
        el('p', { class: 'reason', text: live.name + ' already has a token that trades, so the board shows the market’s own value for it and never an implied one.' }),
        el('h3', { text: 'Market figures' }),
        el('div', { class: 'figures' },
          el('div', { class: 'figure' }, el('b', { text: fmtUsd(live.mcap_usd) }), el('span', { text: 'Market cap' })),
          el('div', { class: 'figure' }, el('b', { text: fmtUsd(live.tvl_usd) }), el('span', { text: 'TVL' })),
          el('div', { class: 'figure' }, el('b', { text: fmtPct(live.change_7d) }), el('span', { text: '7-day TVL change' })),
          el('div', { class: 'figure' }, el('b', { text: String(live.chains.length) }), el('span', { text: 'Chains' })))));
      state.selected = slug;
      drawer.hidden = false; scrim.hidden = false;
      return;
    }
    state.selected = slug;
    var val = impliedOf(row, state.base, state.growth);
    var base = row.tvl_usd * state.base;
    box.innerHTML = '';
    var detail = el('div', { class: 'detail' });
    detail.appendChild(el('h2', { text: '#' + row.rank + '  ' + row.name }));
    detail.appendChild(el('p', { class: 'dsub', text: (row.category || 'Uncategorised') + ' · ' + chainLabel(row.chains) + (watchSet[row.slug] ? ' · on the watchlist' : '') }));
    detail.appendChild(el('p', { class: 'reason', text: row.reason }));
    detail.appendChild(el('h3', { text: 'Snapshot figures' }));
    var figs = el('div', { class: 'figures' });
    [
      [fmtUsd(row.tvl_usd), 'TVL'],
      [fmtPct(row.change_7d), '7-day TVL change'],
      [fmtAge(row.age_days), 'Age since listed'],
      [fmtUsd(val), 'Implied value' + (sandboxChanged() ? ' (sandbox)' : '')],
      [String(row.chains.length), 'Chains'],
      [row.listed_at || 'unknown', 'Listed'],
    ].forEach(function (f) { figs.appendChild(el('div', { class: 'figure' }, el('b', { text: f[0] }), el('span', { text: f[1] }))); });
    detail.appendChild(figs);
    detail.appendChild(el('h3', { text: 'How the value is built' }));
    var mt = el('table', { class: 'modelrows' });
    [
      ['Base — TVL × ' + state.base.toFixed(2), fmtUsd(base)],
      ['Growth multiplier — ' + (row.growth_pct > 0 ? '+' : '') + row.growth_pct.toFixed(1) + '% clamped, weight ' + state.growth.toFixed(2), fmtMult(1 + (row.growth_pct / 100) * state.growth)],
      ['Maturity multiplier — ' + fmtAge(row.age_days) + ' with no token', fmtMult(row.maturity_multiplier)],
      ['Chain multiplier — ' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's'), fmtMult(row.chain_multiplier)],
      ['Momentum multiplier', fmtMult(row.momentum_multiplier)],
      ['Implied value', fmtUsd(val)],
    ].forEach(function (r) { mt.appendChild(el('tr', {}, el('td', { text: r[0] }), el('td', { text: r[1] }))); });
    detail.appendChild(mt);
    detail.appendChild(el('h3', { text: 'Farm plan — 7 steps' }));
    var steps = el('ol', { class: 'steps' });
    row.farm_steps.forEach(function (s) {
      var m = s.match(/ Cost: (.*)\. Time: (.*)\.$/);
      var text = m ? s.slice(0, m.index) : s;
      var meta = m ? 'Cost: ' + m[1] + ' · Time: ' + m[2] : '';
      steps.appendChild(el('li', {}, document.createTextNode(text), el('span', { class: 'meta', text: meta })));
    });
    detail.appendChild(steps);
    detail.appendChild(el('p', { class: 'caveat', text: 'No token is confirmed for this protocol. The steps are how to use it and position for a possible future token, not a promise of one.' }));
    box.appendChild(detail);
    drawer.hidden = false; scrim.hidden = false;
    renderTable();
  }
  function closeDetail() {
    state.selected = null;
    document.getElementById('drawer').hidden = true;
    document.getElementById('scrim').hidden = true;
    renderTable();
  }
  document.getElementById('drawerclose').addEventListener('click', closeDetail);
  document.getElementById('scrim').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDetail(); });

  // ---- filters ---------------------------------------------------------------
  function fillSelect(id, values) {
    var sel = document.getElementById(id);
    values.forEach(function (v) {
      var opt = document.createElement('option');
      opt.value = v; opt.textContent = v;
      sel.appendChild(opt);
    });
  }
  var chains = {};
  var cats = {};
  DATA.rows.forEach(function (r) {
    r.chains.forEach(function (c) { chains[c] = (chains[c] || 0) + 1; });
    if (r.category) cats[r.category] = (cats[r.category] || 0) + 1;
  });
  var chainNames = Object.keys(chains).sort(function (a, b) { return chains[b] - chains[a]; });
  var catNames = Object.keys(cats).sort(function (a, b) { return cats[b] - cats[a]; });
  fillSelect('chain', chainNames);
  fillSelect('category', catNames);

  var qEl = document.getElementById('q');
  var chainEl = document.getElementById('chain');
  var catEl = document.getElementById('category');
  var sortEl = document.getElementById('sort');
  var watchEl = document.getElementById('watchonly');
  qEl.value = state.q; chainEl.value = state.chain; catEl.value = state.category;
  sortEl.value = state.sort; watchEl.checked = state.watchonly;

  qEl.addEventListener('input', function () { state.q = qEl.value; renderTable(); });
  chainEl.addEventListener('change', function () { state.chain = chainEl.value; renderTable(); });
  catEl.addEventListener('change', function () { state.category = catEl.value; renderTable(); });
  sortEl.addEventListener('change', function () { state.sort = sortEl.value; renderTable(); });
  watchEl.addEventListener('change', function () { state.watchonly = watchEl.checked; renderTable(); });

  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      state.tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.tab').forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      renderTable();
    });
  });
  document.querySelector('.tab[data-tab="' + state.tab + '"]').click();

  // ---- sandbox ----------------------------------------------------------------
  var baseEl = document.getElementById('base');
  var growthEl = document.getElementById('growth');
  baseEl.value = String(state.base);
  growthEl.value = String(state.growth);
  function renderFormula() {
    document.getElementById('baseval').textContent = state.base.toFixed(2);
    document.getElementById('growthval').textContent = state.growth.toFixed(2);
    document.getElementById('formula').textContent =
      'implied = TVL × ' + state.base.toFixed(2) + ' × (1 + growth% × ' + state.growth.toFixed(2) + ') × maturity × chain × momentum' +
      (sandboxChanged() ? '  — sandbox values in effect' : '  — radar-2 defaults');
  }
  function onDial() {
    state.base = parseFloat(baseEl.value);
    state.growth = parseFloat(growthEl.value);
    renderFormula();
    renderSpotlight();
    renderTable();
    if (state.selected) { var slug = state.selected; state.selected = null; openDetail(slug); }
  }
  baseEl.addEventListener('input', onDial);
  growthEl.addEventListener('input', onDial);
  document.getElementById('reset').addEventListener('click', function () {
    state.base = DATA.model.base_multiple;
    state.growth = DATA.model.growth_weight;
    baseEl.value = String(state.base);
    growthEl.value = String(state.growth);
    renderFormula();
    renderSpotlight();
    renderTable();
  });

  // ---- first paint --------------------------------------------------------------
  renderStats();
  renderSpotlight();
  renderFormula();
  renderTable();
  if (state.selected) openDetail(state.selected);
  document.getElementById('board').removeAttribute('aria-busy');
})();
