// Football, not soccer – Tabell. Vanligt skript (delar globalt scope med app.js), laddas i ordningen i index.html.
'use strict';
// ---------- Rendering: league picker and today row ----------
function renderPickers() {
  const shown = pickerLeagues(layout).map(leagueById);
  document.querySelectorAll('.league-picker').forEach((p) => fill(p, shown.map((l) => el('button', { type: 'button',
    'aria-pressed': String(l.id === league), 'data-league': l.id, text: l.short, on: { click: () => setLeague(l.id) } }))));
}

// ---------- Rendering: table ----------
const fmtGD = (n) => (n == null ? '–' : n > 0 ? `+${n}` : String(n));
function tableRow(r, lid, rows, pickable) {
  const v = (x) => (x == null ? '–' : String(x));
  const z = zoneOf(lid, r.rank, rows);
  const followed = teams.follow.find((t) => t.id === r.id);
  const tr = el('tr', { class: [z ? z.cls : '', followed ? 'me' : ''].join(' ').trim() || null },
    el('td', { class: 'pos', text: v(r.rank) }),
    el('td', { class: 'team' }, el('span', { class: 'tname' }, logo(r.logo), el('span', { text: r.name }))),
    el('td', { text: v(r.played) }),
    el('td', { class: 'wdl', text: v(r.w) }), el('td', { class: 'wdl', text: v(r.d) }), el('td', { class: 'wdl', text: v(r.l) }),
    el('td', { text: fmtGD(r.gd) }), el('td', { class: 'pts', text: v(r.pts) }));
  // The team's own colour (strict #rrggbb) via CSSOM – never a style attribute.
  const tc = followed && color(followed.color || r.color || cache.colors[r.id]);
  if (tc) tr.style.setProperty('--tc', tc);
  if (pickable) {
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    tr.setAttribute('aria-label', `Visa ${r.name}`);
    tr.dataset.team = r.id;
    tr.addEventListener('click', () => tapTeam(r, lid));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapTeam(r, lid); } });
  }
  return tr;
}
// Tap a row: open the team under Favorit (follow it there).
const tapTeam = (r, lid) => openTeam(r, lid);
const tableHead = () => el('thead', null, el('tr', null,
  el('th', { text: '#' }), el('th', { class: 'team', text: 'Lag' }), el('th', { text: 'M' }),
  el('th', { class: 'wdl', text: 'V' }), el('th', { class: 'wdl', text: 'O' }), el('th', { class: 'wdl', text: 'F' }),
  el('th', { text: 'MS' }), el('th', { text: 'P' })));
const tableLegend = (lid) => el('div', { class: 'legend' },
  leagueById(lid).zones.map((z) => el('span', null, el('i', { class: z.cls }), z.label)),
  el('span', { text: 'Tryck på ett lag för att visa det' }));
const fullTable = (rows, lid) => el('table', { class: 'full' }, tableHead(), el('tbody', { class: 'pick' }, rows.map((r) => tableRow(r, lid, rows.length, true))));
const noTable = () => el('p', { class: 'muted pad-x', text: 'Ingen tabell tillgänglig.' });
function renderTable() {
  const rows = L(league).table;
  $('table-title').textContent = leagueById(league).name;
  if (!rows || !rows.length) { fill($('table-full'), noTable()); return; }
  // Group tables (World Cup, Euro …): one table per group with its name, no zones.
  const groups = [...new Set(rows.map((r) => r.group).filter(Boolean))];
  if (groups.length) { fill($('table-full'), groups.map((g) => [el('h3', { class: 'grp', text: g }), fullTable(rows.filter((r) => r.group === g), league)])); return; }
  fill($('table-full'), [fullTable(rows, league), tableLegend(league)]);
}
