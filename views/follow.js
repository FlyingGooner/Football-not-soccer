// Football, not soccer – Lag (alla följda lag) och lagväljaren. Vanligt skript (delar globalt scope med app.js).
'use strict';
let lagFilter = null;          // a team id shown alone (märkesraden, session only)
const lagOpen = new Map();     // `${teamId}:next|past` → 1 (5 more) or 2 (all), session only

function liveRow(m) {
  return el('div', { class: 'lm', 'data-match': m.id },
    el('span', { class: 't h' }, el('span', { text: m.home.name }), logo(m.home.logo)),
    el('span', { class: 's' }, scoreText(m.homeScore, m.awayScore), el('span', { class: 'live', text: liveText(m) }), el('span', { class: 'end', text: compShort(m) })),
    el('span', { class: 't' }, logo(m.away.logo), el('span', { text: m.away.name })));
}
// One line: Kommande (day, time, opponent (H/B)) or Spelad (V/O/F, score, opponent, date).
function lagLine(kind, t, list) {
  // One team chosen in the badge row: both lists open at once and fill the screen (half each).
  const key = `${t.id}:${kind}`, alone = lagFilter === t.id;
  const state = lagOpen.get(key) || (alone ? 3 : 0), m = list[0], past = kind === 'past';
  const label = el('span', { class: 'k', text: past ? 'Spelad' : 'Kommande' });
  if (!m) return el('div', { class: 'lrow' }, label, el('span', { class: 'muted', text: past ? 'Inga spelade matcher' : 'Ingen inplanerad match' }));
  const d = new Date(m.date), o = opponent(m, t.id), home = isHomeFor(m, t.id), r = resultOf(m, t.id);
  const what = past
    ? el('span', { class: 'v' }, r ? el('span', { class: `badge ${r}`, text: RESULT_SHORT[r] }) : null,
      el('span', { class: 'w', text: scoreText(home ? m.homeScore : m.awayScore, home ? m.awayScore : m.homeScore) }), logo(o.logo), el('span', { class: 'n', text: o.name }), el('span', { class: 'ha', text: home ? 'H' : 'B' }))
    : el('span', { class: 'v' }, el('span', { class: 'w muted', text: `${dayLabel(d)} ${fmtTime.format(d)}` }), logo(o.logo), el('span', { class: 'n', text: o.name }), el('span', { class: 'ha', text: home ? 'H' : 'B' }));
  const toggle = () => { if (state === 3) lagOpen.set(key, 2); else if (state) lagOpen.delete(key); else lagOpen.set(key, 1); renderFollowed(); };
  const row = el('div', { class: 'lrow tap', role: 'button', tabindex: '0', 'aria-expanded': String(!!state), 'data-lag': key,
    on: { click: toggle, keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } } } },
  label, what, el('span', { class: 'muted small', text: past ? fmtShort.format(d) : compShort(m) }));
  if (!state) return row;
  // Rows that fit: screen minus header, badge row, card head, two lines and the menu (~330 px), shared by two lists of ~33 px rows.
  const fit = Math.max(CONFIG.moreStep, Math.floor((innerHeight - 330) / 2 / 33));
  const rest = list.slice(1), n = state === 2 ? rest.length : state === 3 ? fit : CONFIG.moreStep;
  return [row, teamMatchList(rest.slice(0, n), past, t.id),
    state !== 2 && rest.length > n ? el('button', { type: 'button', class: 'btn text more-btn', 'data-more': key, text: `Visa fler (${rest.length - n})`,
      on: { click: () => { lagOpen.set(key, 2); renderFollowed(); } } }) : null];
}
function renderFollowed() {
  const has = teams.follow.length > 0;
  $('lag-empty').hidden = has;
  $('lag-body').hidden = !has;
  if (!has) return;
  if (lagFilter && !isFollowed(lagFilter)) lagFilter = null;
  const now = Date.now();
  const data = teams.follow.map((t) => {
    const ms = (teamData(t) || {}).matches;
    const up = (ms || []).filter((m) => m.state === 'pre');
    return { t, ms, live: (ms || []).filter((m) => m.state === 'in'), up, past: (ms || []).filter((m) => m.state === 'post').reverse(),
      next: up.length ? new Date(up[0].date) - now : Infinity };
  });
  // Favourite first, then by next kickoff.
  data.sort((a, b) => (b.t.id === teams.favorite) - (a.t.id === teams.favorite) || a.next - b.next);
  const chip = (id, label, kids) => el('button', { type: 'button', class: 'lchip', 'aria-pressed': String(lagFilter === id), 'aria-label': label, 'data-chip': id || 'all',
    on: { click: () => { lagFilter = id == null || lagFilter === id ? null : id; renderFollowed(); } } }, kids);
  fill($('lag-chips'), chip(null, 'Alla', 'Alla'), data.map(({ t }) => chip(t.id, t.name, logo(t.logo))),
    el('button', { type: 'button', class: 'lchip add', 'aria-label': 'Välj lag', text: '+', on: { click: openPicker } }));
  const shown = data.filter((x) => !lagFilter || x.t.id === lagFilter);
  const seen = new Set(), live = [];
  for (const x of shown) for (const m of x.live) if (!seen.has(m.id)) { seen.add(m.id); live.push(m); }
  $('lag-live').hidden = !live.length;
  fill($('lag-live-list'), live.map((m) => expandable(liveRow(m), m)));
  fill($('lag-cards'), shown.map(({ t, ms, up, past }) => el('section', { class: 'card lag', 'data-team': t.id },
    el('h2', { class: 'lag-h' }, el('button', { type: 'button', class: 'lag-open', 'aria-label': `Visa ${t.name}`, on: { click: () => openTeam(t, t.leagueId) } },
      logo(t.logo), el('span', { text: t.name }), t.id === teams.favorite ? el('span', { class: 'star', 'aria-label': 'Favorit', text: '★' }) : null)),
    ms ? [lagLine('next', t, up), lagLine('past', t, past)] : el('p', { class: 'muted', text: 'Laddar…' }))));
}

// ---------- Lagväljaren: domestic leagues, collapsed; teams from the league's table ----------
const pickOpen = new Set(), pickLoading = new Set();
function pickRow(r, lid) {
  const fav = teams.favorite === r.id, on = isFollowed(r.id);
  return el('li', { class: 'row', 'data-team': r.id }, logo(r.logo), el('span', { class: 'row-name', text: r.name }),
    el('button', { type: 'button', class: 'icon-btn sm pk-fav', 'aria-pressed': String(fav), 'aria-label': `${fav ? 'Ta bort som favorit' : 'Gör till favorit'}: ${r.name}`, text: fav ? '★' : '☆', on: { click: () => toggleFavorite(r, lid) } }),
    el('button', { type: 'button', class: 'icon-btn sm pk-fol', 'aria-pressed': String(on), 'aria-label': `${on ? 'Sluta följa' : 'Följ'} ${r.name}`, text: on ? '✓' : '+', on: { click: () => toggleFollow(r, lid) } }));
}
function renderTeamPicker() {
  if (view !== 'pick') return;
  $('pick-count').textContent = `${teams.follow.length} av ${TEAM_MAX} följda`;
  fill($('pick-list'), LEAGUES.filter((l) => l.kind === 'league').map((l) => {
    const open = pickOpen.has(l.id), rows = cache.leagues[l.id] && cache.leagues[l.id].table;
    const head = el('button', { type: 'button', class: 'pick-l', 'aria-expanded': String(open), 'data-pick-league': l.id, on: { click: () => togglePickLeague(l.id) } },
      el('span', { text: l.name }), el('span', { class: 'muted', 'aria-hidden': 'true', text: open ? '▾' : '▸' }));
    const body = !open ? null : rows && rows.length
      ? el('ul', { class: 'rows' }, [...rows].sort((a, b) => a.name.localeCompare(b.name, 'sv')).map((r) => pickRow(r, l.id)))
      : el('p', { class: 'muted small', text: pickLoading.has(l.id) ? 'Hämtar…' : 'Kunde inte hämta lagen.' });
    return el('section', { class: 'card pick-sec' }, head, body);
  }));
}
// Cached table first, else one request when the league is expanded.
async function togglePickLeague(id) {
  if (pickOpen.has(id)) { pickOpen.delete(id); renderTeamPicker(); return; }
  pickOpen.add(id);
  const e = L(id);
  if (!e.table) {
    pickLoading.add(id); renderTeamPicker();
    try { e.table = await fetchTable(id); e.updatedAt.table = Date.now(); saveCache(); } catch { /* shown as "Kunde inte hämta lagen." */ }
    pickLoading.delete(id);
  }
  renderTeamPicker();
}
