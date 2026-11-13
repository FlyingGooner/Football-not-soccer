// Football, not soccer – Inställningar, status och Utseende. Vanligt skript (delar globalt scope med app.js).
'use strict';
function renderSettings() {
  $('hint-team').textContent = team ? team.name : teams.follow.length ? `${teams.follow.length} lag` : 'Inga lag';
  $('hint-follow').textContent = `${teams.follow.length} av ${TEAM_MAX}`;
  fill($('follow-list'), teams.follow.length ? teams.follow.map((t) => {
    const fav = teams.favorite === t.id;
    return el('li', { class: 'row' }, logo(t.logo), teamName(t, t.leagueId, 'row-name'),
      el('span', { class: 'row-sub', text: leagueById(t.leagueId).short }),
      el('button', { type: 'button', class: 'icon-btn sm rfav', 'aria-pressed': String(fav), 'aria-label': `${fav ? 'Ta bort som favorit' : 'Gör till favorit'}: ${t.name}`, text: fav ? '★' : '☆', on: { click: () => toggleFavorite(t) } }),
      el('button', { type: 'button', class: 'icon-btn sm rdel', 'aria-label': `Sluta följa ${t.name}`, text: '✕', on: { click: () => unfollow(t.id) } }));
  }) : el('li', { class: 'muted small', text: 'Inga lag följda.' }));
  $('foot').textContent = `Football, not soccer v${self.APP_VERSION} · matchdata från ESPN`;
}
function lastUpdated() {
  if (view === 'team') return Math.min(...teams.follow.map((t) => (cache.teams[t.id] || {}).ts || 0)) || null;
  if (view === 'pick') return null;
  const e = cache.leagues[viewLeague()], u = e ? e.updatedAt : {};
  if (view === 'table') return u.table || null;
  const other = teamView() ? (cache.teams[team.id] || {}).ts : u.league;
  return Math.min(u.table || 0, other || 0) || null;
}
function renderStatus(msg, isError) {
  const s = $('status'), t = view === 'settings' ? null : lastUpdated(), parts = [];
  s.className = isError ? 'error' : '';
  if (t) parts.push(`Uppdaterad ${new Date(t).toDateString() === new Date().toDateString() ? '' : fmtDate.format(t) + ' '}${fmtTime.format(t)}`);
  if (msg) parts.push(msg);
  s.textContent = parts.join(' · ');
}
// ---------- Card order (as simple-nutrition): ↑ ↓ moves, ●/○ shows/hides ----------
function arrange() {
  for (const v of Object.keys(LAYOUT)) {
    const box = $('arr-' + v), { order, hidden } = layoutOf(layout, v);
    if (!box) continue;   // leagues: the picker, not cards
    for (const id of order) {
      const n = box.querySelector(`:scope > [data-card="${id}"]`);
      n.classList.toggle('lay-off', hidden.includes(id));
      box.append(n);
    }
  }
}
function setLayout(v, l) {
  layout = loadLayout({ ...layout, [v]: l });
  store.set(CONFIG.keys.layout, Object.keys(layout).length ? layout : null);
  const shown = pickerLeagues(layout);
  if (!shown.includes(league)) { setLeague(shown[0]); return; }
  render();
}
function renderLayout() {
  $('hint-layout').textContent = Object.keys(layout).length ? 'Egen' : 'Standard';
  fill($('layout-body'), Object.entries(LAYOUT_VIEWS).map(([v, name]) => {
    const { order, hidden } = layoutOf(layout, v), label = Object.fromEntries(LAYOUT[v]);
    const move = (i, d) => { const o = [...order]; [o[i], o[i + d]] = [o[i + d], o[i]]; setLayout(v, { order: o, hidden }); };
    return [el('h2', { class: 'lay-h', text: name }),
      el('ul', { class: 'rows lay-list', 'data-view': v }, order.map((id, i) => {
        const off = hidden.includes(id);
        return el('li', { class: 'row' + (off ? ' l-off' : '') },
          el('span', { class: 'row-name', text: label[id] }),
          el('button', { type: 'button', class: 'icon-btn sm', disabled: i === 0, 'aria-label': `Flytta upp ${label[id]}`, text: '↑', on: { click: () => move(i, -1) } }),
          el('button', { type: 'button', class: 'icon-btn sm', disabled: i === order.length - 1, 'aria-label': `Flytta ner ${label[id]}`, text: '↓', on: { click: () => move(i, 1) } }),
          el('button', { type: 'button', class: 'icon-btn sm lay-eye', 'aria-pressed': String(!off), 'aria-label': `${off ? 'Visa' : 'Dölj'} ${label[id]}`, text: off ? '○' : '●',
            on: { click: () => setLayout(v, { order, hidden: off ? hidden.filter((x) => x !== id) : [...hidden, id] }) } }));
      })),
      el('button', { type: 'button', class: 'btn text', 'data-reset': v, text: `Återställ ${name}`, on: { click: () => setLayout(v, null) } })];
  }));
}
