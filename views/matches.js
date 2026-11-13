// Football, not soccer – Matcher (listor, flikar, Visa fler, svep). Vanligt skript (delar globalt scope med app.js).
'use strict';
function formDots(matches, t = team) {
  const pl = (matches || []).filter((m) => m.state === 'post' && m.leagueId === t.leagueId).slice(-5);
  if (!pl.length) return null;
  return el('div', { class: 'form' }, el('span', { class: 'small muted', text: 'Form' }), pl.map((m) => {
    const r = resultOf(m);
    return r ? el('span', { class: `dot ${r}`, title: `${opponent(m).name} ${scoreText(m.homeScore, m.awayScore)}`, text: RESULT_SHORT[r] }) : null;
  }));
}

// ---------- Rendering: matches ----------
function eventsView(m, goalsOnly) {
  const evs = m.events && goalsOnly ? m.events.filter((e) => e.kind === 'goal') : m.events;
  if (!evs) return el('div', { class: 'evs muted small', text: 'Ingen matchinfo tillgänglig.' });
  if (!evs.length) return el('div', { class: 'evs muted small', text: goalsOnly ? 'Inga mål.' : 'Inga mål eller kort.' });
  const icon = (e, i) => (e.kind === 'goal' ? '⚽ ' : e.kind === 'yellow' ? '🟨 '
    : evs.some((x, j) => j < i && x.kind === 'yellow' && x.name === e.name && x.teamId === e.teamId) ? '🟨🟥 ' : '🟥 ');   // second yellow
  const line = (e) => el('div', { class: 'ev' }, el('span', { class: 'm', text: e.min }), icon(e, evs.indexOf(e)),
    el('span', { text: e.name }), e.pen ? el('span', { class: 'muted', text: ' (str.)' }) : null, e.og ? el('span', { class: 'muted', text: ' (sj.)' }) : null);
  const col = (id, cls) => el('div', { class: cls }, evs.filter((e) => e.teamId === id).map(line));
  return el('div', { class: 'evs' }, col(m.home.id, 'h'), col(m.away.id, 'a'));
}
const openMatches = new Set();   // expanded match rows (session only)
// A live or played match that expands its events on tap: live = goals and cards, played = goals only.
// Goals missing (team schedule) → fetched once via summary ("Hämtar…"). Returns [row, box]; box is a `tag`.
function expandable(row, m, tag = 'div') {
  if (m.state === 'pre') return [row];
  const box = el(tag, { class: 'lmx' });
  const sync = () => {
    const open = openMatches.has(m.id);
    row.setAttribute('aria-expanded', String(open));
    if (!open) { fill(box); return; }
    const evs = matchEvents(m);
    if (evs === undefined) { fill(box, el('div', { class: 'evs muted small', text: 'Hämtar…' })); fetchGoals(m, () => { if (box.isConnected) sync(); }); return; }
    fill(box, eventsView({ ...m, events: evs }, m.state === 'post'));
  };
  const toggle = () => { if (openMatches.has(m.id)) openMatches.delete(m.id); else openMatches.add(m.id); sync(); };
  row.classList.add('tap'); row.setAttribute('role', 'button'); row.tabIndex = 0;
  row.addEventListener('click', toggle);
  row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  sync();
  return [row, box];
}
function matchHero(m, kind) {
  const d = new Date(m.date);
  let mid;
  if (m.state === 'pre') mid = el('div', { class: 'mid' }, el('span', { class: 'time', text: fmtTime.format(d) }), el('span', { class: 'small muted', text: fmtDate.format(d) }));
  else {
    const r = resultOf(m);
    mid = el('div', { class: 'mid' }, el('span', { class: 'score', text: scoreText(m.homeScore, m.awayScore) }),
      m.state === 'in' ? el('span', { class: 'live', text: liveText(m) }) : (r ? el('span', { class: `badge ${r}`, text: RESULT_LONG[r] }) : null));
  }
  const side = (t) => el('div', { class: 'side' }, logo(t.logo), teamName(t, m.leagueId));
  return el('div', { class: 'hero' },
    el('div', { class: 'match-main' }, side(m.home), mid, side(m.away)),
    el('div', { class: 'meta' }, `${m.league} · ${isHomeFor(m) ? 'Hemma' : 'Borta'}`, m.state !== 'pre' ? ` · ${fmtDate.format(d)}` : null,
      m.state === 'pre' && kind === 'next' ? el('span', { class: 'countdown', 'data-kickoff': m.date, text: countdown(d - Date.now()) }) : null));
}
const COMP_SHORT = { 'uefa.europa': 'EL', 'uefa.europa.conf': 'ECL' };
const compShort = (m) => { const c = compById(m.leagueId); return (c && c.short) || COMP_SHORT[m.leagueId] || m.league; };
function teamMatchList(list, past, id = favId()) {
  if (!list.length) return null;
  return el('ul', { class: 'mlist' }, list.map((m) => {
    const d = new Date(m.date), o = opponent(m, id), r = resultOf(m, id), home = isHomeFor(m, id);
    const comp = compShort(m);
    return expandable(el('li', null,
      el('span', { class: 'd', text: past ? fmtShort.format(d) : `${fmtShort.format(d)} ${fmtTime.format(d)}` }),
      el('span', { class: 'o' }, teamName(o, m.leagueId), ` (${home ? 'H' : 'B'})`),
      el('span', { class: 'c', text: comp }),
      past ? el('span', { class: 'r' }, `${scoreText(home ? m.homeScore : m.awayScore, home ? m.awayScore : m.homeScore)} `, r ? el('span', { class: `badge ${r}`, text: RESULT_SHORT[r] }) : null)
        : el('span', { class: 'r' })), m, 'li');
  }));
}
function dayLabel(date) {
  const key = fmtDayKey.format(date), d = 864e5;
  if (key === fmtDayKey.format(Date.now())) return 'Idag';
  if (key === fmtDayKey.format(Date.now() + d)) return 'I morgon';
  if (key === fmtDayKey.format(Date.now() - d)) return 'I går';
  return fmtDate.format(date);
}
// Live time: "45'+3" (added time), "67'", "HT" at half time.
function liveText(m) {
  if (/^(HT|half ?time)$/i.test(m.detail || '') || /^HT$/i.test(m.clock || '')) return 'HT';
  const c = (m.clock || '').replace(/'\+(\d+)'?$/, "'+$1");
  return `LIVE ${c}`.trim();
}
function leagueMatchList(list, emptyText) {
  if (!list.length) return el('p', { class: 'muted', text: emptyText });
  const wrap = el('div');
  let lastDay = null, group = null;
  for (const m of list) {
    const key = m.state === 'in' ? 'live' : fmtDayKey.format(m.date);
    if (key !== lastDay) { group = el('div', { class: 'dgroup' }, el('div', { class: 'day', text: m.state === 'in' ? 'Pågår nu' : dayLabel(m.date) })); wrap.append(group); lastDay = key; }
    const mid = m.state === 'pre' ? el('span', { class: 's', text: fmtTime.format(m.date) })
      : el('span', { class: 's' }, scoreText(m.homeScore, m.awayScore),
        m.state === 'in' ? el('span', { class: 'live', text: liveText(m) }) : el('span', { class: 'end', text: 'Slut' }));
    const row = el('div', { class: 'lm', 'data-match': m.id },
      el('span', { class: 't h' }, teamName(m.home, m.leagueId), logo(m.home.logo)), mid,
      el('span', { class: 't' }, logo(m.away.logo), teamName(m.away, m.leagueId)));
    group.append(...expandable(row, m));
  }
  return wrap;
}
// ---------- Card Matcher: tabs Aktuella / Kommande / Spelade (session only) ----------
const MTABS = [['now', 'Aktuella', 'Inga matcher i dag'], ['next', 'Kommande', 'Inga kommande matcher'], ['past', 'Spelade', 'Inga spelade matcher']];
let mtab = null;                 // null = default: Aktuella if there are live or today's matches, else Kommande (reset on every view change)
const curTab = () => mtab || (matchLists(L(league).league || []).now.length ? 'now' : 'next');
let extra = { next: 0, past: 0 }; // rows added with Visa fler
let loadingMore = false;
function matchLists(ms) {
  const today = fmtDayKey.format(Date.now()), isToday = (m) => fmtDayKey.format(m.date) === today;
  return {
    now: [...ms.filter((m) => m.state === 'in'), ...ms.filter((m) => m.state !== 'in' && isToday(m))],
    next: ms.filter((m) => m.state === 'pre' && !isToday(m) && new Date(m.date) > Date.now()),
    past: ms.filter((m) => m.state === 'post').reverse(),
  };
}
// Rows that fit down to the bottom menu (at least CONFIG.minRows).
function fitRows() {
  const top = $('match-list').getBoundingClientRect().top, bar = $('tabbar').getBoundingClientRect().height || 80;
  return Math.max(CONFIG.minRows, Math.floor((innerHeight - Math.max(top, 0) - bar - 72) / 44));
}
const rangeEnd = (dir) => { const r = L(league).range; return !r || (dir < 0 ? r.from <= monthAt(-CONFIG.monthsMax) : r.to >= monthAt(CONFIG.monthsMax)); };
function renderLeagueMatches() {
  const ms = L(league).league || [], lists = matchLists(ms);
  const tab = curTab();
  fill($('mtabs'), MTABS.map(([id, name]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(id === tab), 'aria-pressed': String(id === tab), 'data-mtab': id, text: name,
    on: { click: () => { mtab = id; renderLeagueMatches(); } } })));
  const [, , empty] = MTABS.find(([id]) => id === tab), list = lists[tab];
  if (tab === 'now') { fill($('match-list'), leagueMatchList(list, empty)); $('more').hidden = true; return; }
  const n = fitRows() + extra[tab], dir = tab === 'past' ? -1 : 1;
  fill($('match-list'), leagueMatchList(list.slice(0, n), L(league).league ? empty : 'Laddar…'));
  $('more').hidden = !L(league).league || (list.length <= n && rangeEnd(dir));
  $('more').disabled = loadingMore;
  $('more').dataset.dir = String(dir);
}
// Visa fler: more rows from the cache; when it runs out, one more month from ESPN in that direction.
async function showMore() {
  const tab = curTab();
  if (tab === 'now' || loadingMore) return;
  const step = fitRows(), dir = tab === 'past' ? -1 : 1, lid = league;
  extra[tab] += step;
  const have = matchLists(L(lid).league || [])[tab].length;
  if (have < fitRows() + extra[tab] && !rangeEnd(dir)) {
    const e = L(lid), k = dir < 0 ? monthAdd(e.range.from, -1) : monthAdd(e.range.to, 1);
    loadingMore = true; renderLeagueMatches();
    try {
      const got = await fetchMonths(lid, [k]);
      e.league = mergeMatches([e.league, got.matches]);
      if (got.ok && e.range) e.range = dir < 0 ? { from: k, to: e.range.to } : { from: e.range.from, to: k };
      saveCache();
    } catch { renderStatus(navigator.onLine ? 'Kunde inte hämta fler matcher' : 'Offline – visar sparad data', true); }
    loadingMore = false;
  }
  renderLeagueMatches();
}
$('more').addEventListener('click', showMore);
// Swipe left/right on the list → next/previous tab (only clearly horizontal swipes, ≥ 50 px).
function swipeTab(dir) {
  const ids = MTABS.map(([id]) => id), cur = curTab();
  const next = ids[ids.indexOf(cur) + dir];
  if (next) { mtab = next; renderLeagueMatches(); }
}
// Tabell: swipe → next/previous league in the picker.
function swipeLeague(dir) {
  const ids = pickerLeagues(layout), next = ids[ids.indexOf(league) + dir];
  if (next) setLeague(next);
}
function onSwipe(node, fn) {
  let t0 = null;
  node.addEventListener('touchstart', (e) => { const t = e.touches[0]; t0 = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null; }, { passive: true });
  node.addEventListener('touchend', (e) => {
    if (!t0) return;
    const t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y;
    t0 = null;
    if (Math.abs(dx) >= 50 && Math.abs(dx) > 1.5 * Math.abs(dy)) fn(dx < 0 ? 1 : -1);
  }, { passive: true });
}
onSwipe($('card-matches'), swipeTab);
onSwipe($('view-table'), swipeLeague);   // whole view, not only the card
