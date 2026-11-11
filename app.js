// Football, not soccer - data adapter (ESPN), rendering and logic. See CLAUDE.md and docs/SPEC.md.
// Plain script (not a module): loaded after version.js, backup.js and store.js.
// Rendering: DOM + textContent only (CSP has Trusted Types) – never innerHTML.
'use strict';

// ---------- Config ----------
const CONFIG = {
  leagues: LEAGUES,             // store.js: Premier League, LaLiga, Serie A, Champions League
  europe: EUROPE,               // collected in team mode together with the team's league
  upcomingCount: 5,
  recentCount: 5,
  roundSize: 10,
  leaguePreviewRows: 3,
  leaguePreviewMatches: 3,      // all live matches are always shown on top of these
  leaguePreviewResults: 2,
  leagueDaysBack: 21,
  leagueDaysAhead: 35,
  livePollMs: 30000,
  teamCacheMax: RECENT_MAX,
  leagueReuseMs: 600000,
  staleMs: 60000,
  keys: { cache: 'fns.cache.v3', team: 'fns.team.v2', teamV1: 'fns.team.v1', league: 'fns.league.v1', recent: 'fns.recent.v1', acc: 'fns.acc.v2' },
  prefix: 'fns.',
  slug: 'football-not-soccer',
};
const $ = (id) => document.getElementById(id);

// ---------- DOM helpers (textContent + setAttribute only) ----------
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'class') n.className = v;
    else if (k === 'on') for (const [ev, fn] of Object.entries(v)) n.addEventListener(ev, fn);
    else if (/^(on|style$|href$|src$|srcset$|action$|formaction$|xlink:href$)/i.test(k)) throw new Error('el: unsafe attribute ' + k);
    else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children.flat(Infinity)) if (c != null && c !== false) n.append(c);
  return n;
}
const fill = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
const ph = () => el('span', { class: 'ph', 'aria-hidden': 'true' });
// Club logo: only ESPN's image host (logoUrl), no cookies, no referrer.
function logo(url) {
  const u = logoUrl(url);
  if (!u) return ph();
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  img.crossOrigin = 'anonymous';
  img.addEventListener('error', () => img.replaceWith(ph()));
  img.src = u;   // validated by logoUrl
  return img;
}

// ---------- Swedish formatting ----------
function safeFmt(opts) {
  const f = new Intl.DateTimeFormat('sv-SE', opts);
  return { format: (d) => { const t = new Date(d); return isNaN(t) ? '–' : f.format(t); } };
}
const fmtDate = safeFmt({ weekday: 'short', day: 'numeric', month: 'short' });
const fmtTime = safeFmt({ hour: '2-digit', minute: '2-digit' });
const fmtShort = safeFmt({ day: 'numeric', month: 'short' });
const fmtDayKey = safeFmt({ year: 'numeric', month: '2-digit', day: '2-digit' });
const isoToday = () => { const t = new Date(); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
function countdown(ms) {
  if (ms <= 0) return 'Snart avspark';
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return `om ${d} d ${h} h`;
  if (h > 0) return `om ${h} h ${mm} min`;
  return `om ${mm} min`;
}

// ---------- Data adapter (ESPN) – URLs only from espnUrl() in store.js ----------
async function getJSON(url) {
  const res = await fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
async function fetchTable(leagueId) { return parseStandings(await getJSON(espnUrl('standings', leagueId))); }

// A team's results and fixtures in one competition (two requests). Resolves to { list, color }.
async function fetchSchedule(compId, teamId) {
  const settled = await Promise.allSettled([getJSON(espnUrl('schedule', compId, { team: teamId })), getJSON(espnUrl('schedule', compId, { team: teamId, fixture: true }))]);
  const ok = settled.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  if (!ok.length) throw settled[0].reason;
  const c = ok.map((d) => hexColor(d && d.team && d.team.color)).find(Boolean) || null;
  return { list: mergeMatches(ok.map((d) => parseEvents(d, compId))), color: c };
}
// All matches for one team: its league plus the European competitions. known = league matches already in hand.
async function fetchTeamMatches(teamId, leagueId, known, knownColor) {
  const comps = [leagueId, ...CONFIG.europe.map((e) => e.id).filter((id) => id !== leagueId)];
  const jobs = comps.map((id) => (known && id === leagueId ? Promise.resolve({ list: known, color: knownColor || null }) : fetchSchedule(id, teamId)));
  const settled = await Promise.allSettled(jobs);
  if (settled.every((s) => s.status === 'rejected')) throw settled[0].reason;
  const ok = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value);
  return { matches: mergeMatches(ok.map((o) => o.list)), color: (ok.find((o) => o.color) || {}).color || null };
}
// League matches around today: current scoreboard + one-week ranges; few results → every team's schedule.
async function fetchLeagueMatches(leagueId, table) {
  const now = Date.now(), day = 864e5;
  const urls = [espnUrl('scoreboard', leagueId)];
  for (let from = -CONFIG.leagueDaysBack; from < CONFIG.leagueDaysAhead; from += 7) urls.push(espnUrl('scoreboard', leagueId, { dates: `${ymd(now + from * day)}-${ymd(now + (from + 6) * day)}` }));
  const settled = await Promise.allSettled(urls.map((u) => getJSON(u).then((d) => parseEvents(d, leagueId))));
  const merged = mergeMatches(settled.filter((x) => x.status === 'fulfilled').map((x) => x.value));
  const n = CONFIG.roundSize;
  if (merged.filter((m) => m.state === 'pre').length >= n && merged.filter((m) => m.state === 'post').length >= n) return { matches: merged, full: false, colors: {} };
  try {
    const viaTeams = await fetchLeagueMatchesViaTeams(leagueId, table);
    return { ...viaTeams, matches: mergeMatches([viaTeams.matches, merged]) };
  } catch (e) { if (merged.length) return { matches: merged, full: false, colors: {} }; throw e; }
}
async function fetchLeagueMatchesViaTeams(leagueId, table) {
  const rows = table && table.length ? table : await fetchTable(leagueId);
  const ids = rows.map((r) => r.id).filter(validId);
  const settled = await Promise.allSettled(ids.map((id) => fetchSchedule(leagueId, id)));
  const colors = {}, lists = [];
  settled.forEach((x, i) => { if (x.status !== 'fulfilled') return; lists.push(x.value.list); if (x.value.color) colors[ids[i]] = x.value.color; });
  if (!lists.length) throw settled[0] ? settled[0].reason : new Error('no teams');
  return { matches: mergeMatches(lists), full: true, colors };
}
// Live: scoreboard per competition, the home team's schedule as fallback.
async function fetchLive(live) {
  const comps = [...new Set(live.map((m) => m.leagueId))];
  const out = [];
  await Promise.all(comps.map(async (compId) => {
    try { out.push(...parseEvents(await getJSON(espnUrl('scoreboard', compId)), compId)); return; } catch { /* fall back below */ }
    const homes = [...new Set(live.filter((m) => m.leagueId === compId).map((m) => m.home.id).filter(validId))];
    const res = await Promise.allSettled(homes.map((id) => fetchSchedule(compId, id)));
    for (const r of res) if (r.status === 'fulfilled') out.push(...r.value.list);
  }));
  return mergeMatches([out]);
}

// ---------- State ----------
let cache = emptyCache();
let team = null;                 // { id, name, logo, color, leagueId } or null = league mode
let league = DEFAULT_LEAGUE;     // chosen league in league mode
let recent = [];
let acc = loadAcc(null);
let liveTimer = null;
const mode = () => (team ? 'team' : 'league');
const viewLeague = () => (team ? team.leagueId : league);
const L = (id) => cache.leagues[id] || (cache.leagues[id] = emptyLeague());
const saveCache = () => { if (!store.set(CONFIG.keys.cache, cache)) { trimCache(0); store.set(CONFIG.keys.cache, cache); } };
const settings = () => ({ team, league, recent, acc });
function saveSettings() {
  store.set(CONFIG.keys.team, team);
  store.set(CONFIG.keys.league, league);
  store.set(CONFIG.keys.recent, recent);
  store.set(CONFIG.keys.acc, acc);
}
// Team cache: only the recently followed teams (and the current one).
function trimCache(max = CONFIG.teamCacheMax) {
  const keep = new Set([...recent.slice(0, max).map((t) => t.id), team && team.id].filter(Boolean));
  for (const id of Object.keys(cache.teams)) if (!keep.has(id)) delete cache.teams[id];
}
function leagueMatchesFor(lid, id) {
  const e = cache.leagues[lid];
  if (!e || !e.leagueFull || !Array.isArray(e.league)) return null;
  const list = e.league.filter((m) => m.home.id === id || m.away.id === id);
  return list.length ? list : null;
}
function teamData() {
  if (!team) return null;
  if (cache.teams[team.id]) return cache.teams[team.id];
  const known = leagueMatchesFor(team.leagueId, team.id);
  return known ? { matches: known, color: cache.colors[team.id] || null } : null;
}

// ---------- Perspective helpers (team mode) ----------
const isHomeFor = (m) => team && m.home.id === team.id;
const opponent = (m) => (isHomeFor(m) ? m.away : m.home);
function resultOf(m) {
  if (!team || m.homeScore == null || m.awayScore == null) return null;
  const home = isHomeFor(m), us = home ? m.homeScore : m.awayScore, them = home ? m.awayScore : m.homeScore;
  return us > them ? 'W' : us < them ? 'L' : 'D';
}
const RESULT_SHORT = { W: 'V', D: 'O', L: 'F' }, RESULT_LONG = { W: 'Vinst', D: 'Oavgjort', L: 'Förlust' };
const scoreText = (a, b) => `${a ?? '–'}–${b ?? '–'}`;

// ---------- Rendering: league bar, today, recent ----------
function renderLeagueBar() {
  $('leaguebar').hidden = !!team;
  fill($('league-picker'), CONFIG.leagues.map((l) => el('button', { type: 'button', 'aria-pressed': String(l.id === league), 'data-league': l.id, text: l.short,
    on: { click: () => setLeague(l.id) } })));
  // Today in all leagues: only from cached data fetched today (no extra requests).
  const today = fmtDayKey.format(Date.now());
  const items = CONFIG.leagues.map((l) => {
    const e = cache.leagues[l.id];
    if (!e || !e.updatedAt.league || fmtDayKey.format(e.updatedAt.league) !== today || !e.league) return null;
    const n = e.league.filter((m) => fmtDayKey.format(m.date) === today).length;
    return el('button', { type: 'button', class: 'chip' + (l.id === league ? ' on' : ''), 'data-today': l.id, text: `${l.short} ${n}`, on: { click: () => setLeague(l.id) } });
  }).filter(Boolean);
  $('today').hidden = !items.length;
  fill($('today'), items.length ? [el('span', { class: 'small muted', text: 'Idag' }), items] : []);
}
function renderRecent() {
  const list = recent.filter((t) => !team || t.id !== team.id);
  $('recent').hidden = !list.length;
  fill($('recent'), list.map((t) => el('span', { class: 'rchip' },
    el('button', { type: 'button', class: 'rpick', 'aria-label': `Följ ${t.name}`, on: { click: () => choose(t) } }, logo(t.logo), el('span', { text: t.name })),
    el('button', { type: 'button', class: 'rdel', 'aria-label': `Ta bort ${t.name} ur listan`, text: '✕', on: { click: () => removeRecent(t.id) } }))));
}

// ---------- Rendering: table ----------
const fmtGD = (n) => (n == null ? '–' : n > 0 ? `+${n}` : String(n));
function tableRow(r, lid, rows, pickable) {
  const v = (x) => (x == null ? '–' : String(x));
  const z = zoneOf(lid, r.rank, rows);
  const tr = el('tr', { class: [z ? z.cls : '', team && r.id === team.id ? 'me' : ''].join(' ').trim() || null },
    el('td', { class: 'pos', text: v(r.rank) }),
    el('td', { class: 'team' }, el('span', { class: 'tname' }, logo(r.logo), el('span', { text: r.name }))),
    el('td', { text: v(r.played) }),
    el('td', { class: 'wdl', text: v(r.w) }), el('td', { class: 'wdl', text: v(r.d) }), el('td', { class: 'wdl', text: v(r.l) }),
    el('td', { text: fmtGD(r.gd) }), el('td', { class: 'pts', text: v(r.pts) }));
  if (pickable) {
    tr.tabIndex = 0;
    tr.setAttribute('role', 'button');
    tr.setAttribute('aria-label', `Följ ${r.name}`);
    tr.dataset.team = r.id;
    tr.addEventListener('click', () => askPick(r, lid));
    tr.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); askPick(r, lid); } });
  }
  return tr;
}
const tableHead = () => el('thead', null, el('tr', null,
  el('th', { text: '#' }), el('th', { class: 'team', text: 'Lag' }), el('th', { text: 'M' }),
  el('th', { class: 'wdl', text: 'V' }), el('th', { class: 'wdl', text: 'O' }), el('th', { class: 'wdl', text: 'F' }),
  el('th', { text: 'MS' }), el('th', { text: 'P' })));
const tableLegend = (lid) => el('div', { class: 'legend' },
  leagueById(lid).zones.map((z) => el('span', null, el('i', { class: z.cls }), z.label)),
  el('span', { text: 'Tryck på ett lag för att följa det' }));
function fullTable(rows, lid, preview) {
  return el('table', { class: 'full' }, tableHead(), el('tbody', { class: 'pick' }, rows.map((r, i) => {
    const tr = tableRow(r, lid, rows.length, true);
    if (preview && i >= preview) tr.classList.add('more');
    return tr;
  })));
}
function formDots(matches) {
  const pl = (matches || []).filter((m) => m.state === 'post' && m.leagueId === team.leagueId).slice(-5);
  if (!pl.length) return null;
  return el('div', { class: 'form' }, el('span', { class: 'small muted', text: 'Form ' }), pl.map((m) => {
    const r = resultOf(m);
    return r ? el('span', { class: `dot ${r}`, title: `${opponent(m).name} ${scoreText(m.homeScore, m.awayScore)}`, text: RESULT_SHORT[r] }) : null;
  }));
}
function renderTable() {
  const lid = viewLeague(), rows = L(lid).table;
  const sum = $('table-summary'), full = $('table-full'), toggle = document.querySelector('[data-acc="table"]');
  sum.replaceChildren(); full.replaceChildren();
  toggle.querySelectorAll('.form').forEach((n) => n.remove());
  $('table-title').textContent = leagueById(lid).name;
  if (!rows || !rows.length) { toggle.hidden = true; sum.classList.remove('flush'); sum.append(el('span', { class: 'muted', text: 'Ingen tabell tillgänglig.' })); return; }
  toggle.hidden = false;
  if (!team) { sum.classList.add('flush'); sum.append(fullTable(rows, lid, CONFIG.leaguePreviewRows)); full.append(tableLegend(lid)); return; }
  sum.classList.remove('flush');
  const me = rows.find((r) => r.id === team.id);
  if (me) {
    sum.append(el('table', null, tableHead(), el('tbody', null, tableRow(me, lid, rows.length, false))));
    const f = formDots(teamData() && teamData().matches);
    if (f) toggle.insertBefore(f, toggle.querySelector('.chev'));
  } else sum.append(el('span', { class: 'muted', text: `${team.name} finns inte i tabellen.` }));
  full.append(fullTable(rows, lid, 0), tableLegend(lid));
}

// ---------- Rendering: matches ----------
function eventsView(m) {
  const evs = m.events;
  if (!evs) return el('div', { class: 'evs muted small', text: 'Ingen matchinfo tillgänglig.' });
  if (!evs.length) return el('div', { class: 'evs muted small', text: 'Inga mål.' });
  const line = (e) => el('div', { class: 'ev' }, el('span', { class: 'm', text: e.min }), e.kind === 'goal' ? '⚽ ' : '🟥 ',
    el('span', { text: e.name }), e.pen ? el('span', { class: 'muted', text: ' (str.)' }) : null, e.og ? el('span', { class: 'muted', text: ' (sj.)' }) : null);
  const col = (id, cls) => el('div', { class: cls }, evs.filter((e) => e.teamId === id).map(line));
  return el('div', { class: 'evs' }, col(m.home.id, 'h'), col(m.away.id, 'a'));
}
const openMatches = new Set();   // expanded match rows (session only)
function matchHero(m, kind) {
  const d = new Date(m.date);
  let mid;
  if (m.state === 'pre') mid = el('div', { class: 'mid' }, el('span', { class: 'time', text: fmtTime.format(d) }), el('span', { class: 'small muted', text: fmtDate.format(d) }));
  else {
    const r = resultOf(m);
    mid = el('div', { class: 'mid' }, el('span', { class: 'score', text: scoreText(m.homeScore, m.awayScore) }),
      m.state === 'in' ? el('span', { class: 'live', text: `LIVE ${m.clock || m.detail}`.trim() }) : (r ? el('span', { class: `badge ${r}`, text: RESULT_LONG[r] }) : null));
  }
  const side = (t) => el('div', { class: 'side' }, logo(t.logo), el('span', { text: t.name }));
  return el('div', null,
    el('div', { class: 'match-main' }, side(m.home), mid, side(m.away)),
    m.state !== 'pre' && m.events && m.events.length ? eventsView(m) : null,
    el('div', { class: 'meta' }, `${m.league} · ${isHomeFor(m) ? 'Hemma' : 'Borta'}`, m.state !== 'pre' ? ` · ${fmtDate.format(d)}` : null,
      m.state === 'pre' && kind === 'next' ? el('span', { class: 'countdown', 'data-kickoff': m.date, text: countdown(d - Date.now()) }) : null));
}
function teamMatchList(list, past) {
  if (!list.length) return el('div', { class: 'empty muted small', text: past ? 'Inga tidigare matcher.' : 'Inga fler inplanerade matcher.' });
  return el('ul', { class: 'mlist' }, list.map((m) => {
    const d = new Date(m.date), o = opponent(m), r = resultOf(m), home = isHomeFor(m);
    return el('li', null,
      el('span', { class: 'd' }, fmtShort.format(d), el('br'), past ? '' : fmtTime.format(d)),
      el('span', null, el('span', { class: 'o', text: `${o.name} (${home ? 'H' : 'B'})` }), el('br'), el('span', { class: 'c', text: m.league })),
      past ? el('span', { class: 'r' }, `${scoreText(home ? m.homeScore : m.awayScore, home ? m.awayScore : m.homeScore)} `, r ? el('span', { class: `badge ${r}`, text: RESULT_SHORT[r] }) : null)
        : el('span', { class: 'r' }));
  }));
}
function dayLabel(date) {
  const key = fmtDayKey.format(date), d = 864e5;
  if (key === fmtDayKey.format(Date.now())) return 'Idag';
  if (key === fmtDayKey.format(Date.now() + d)) return 'I morgon';
  if (key === fmtDayKey.format(Date.now() - d)) return 'I går';
  return fmtDate.format(date);
}
function leagueMatchList(list, past) {
  if (!list.length) return el('div', { class: 'empty muted small', text: past ? 'Inga spelade matcher.' : 'Inga inplanerade matcher.' });
  const wrap = el('div');
  let lastDay = null, group = null;
  for (const m of list) {
    const key = m.state === 'in' ? 'live' : fmtDayKey.format(m.date);
    if (key !== lastDay) { group = el('div', { class: 'dgroup' }, el('div', { class: 'day', text: m.state === 'in' ? 'Pågår nu' : dayLabel(m.date) })); wrap.append(group); lastDay = key; }
    const mid = m.state === 'pre' ? el('span', { class: 's', text: fmtTime.format(m.date) })
      : el('span', { class: 's' }, scoreText(m.homeScore, m.awayScore), m.state === 'in' ? el('span', { class: 'live', text: `LIVE ${m.clock || ''}`.trim() }) : null);
    const row = el('div', { class: 'lm', 'data-match': m.id },
      el('span', { class: 't h' }, el('span', { text: m.home.name }), logo(m.home.logo)), mid,
      el('span', { class: 't' }, logo(m.away.logo), el('span', { text: m.away.name })));
    if (m.state === 'pre') { group.append(row); continue; }
    const box = el('div', { class: 'lmx' });
    const sync = () => { const open = openMatches.has(m.id); row.setAttribute('aria-expanded', String(open)); fill(box, open ? eventsView(m) : null); };
    const toggle = () => { if (openMatches.has(m.id)) openMatches.delete(m.id); else openMatches.add(m.id); sync(); };
    row.classList.add('tap'); row.setAttribute('role', 'button'); row.tabIndex = 0;
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    sync();
    group.append(row, box);
  }
  return wrap;
}
const setTexts = (ids) => { for (const [id, t] of Object.entries(ids)) $(id).textContent = t; };
function renderMatches() {
  const ns = $('next-summary'), nl = $('next-list'), ls = $('last-summary'), ll = $('last-list');
  [ns, nl, ls, ll].forEach((n) => n.replaceChildren());
  if (!team) {
    setTexts({ 'next-title': 'Aktuella matcher', 'next-toggle': 'Fler kommande matcher', 'last-title': 'Senaste resultat', 'last-toggle': 'Fler resultat' });
    const ms = L(league).league;
    if (!ms) { ns.append(el('span', { class: 'muted', text: 'Inga matcher tillgängliga.' })); ls.append(el('span', { class: 'muted', text: 'Inga matcher tillgängliga.' })); return; }
    const live = ms.filter((m) => m.state === 'in');
    const upcoming = [...live, ...ms.filter((m) => m.state === 'pre')], past = ms.filter((m) => m.state === 'post').reverse();
    const n = 2 * CONFIG.roundSize;
    const k = wide.matches ? n : Math.max(live.length, CONFIG.leaguePreviewMatches), kp = wide.matches ? n : CONFIG.leaguePreviewResults;
    ns.append(leagueMatchList(upcoming.slice(0, k), false));
    ls.append(leagueMatchList(past.slice(0, kp), true));
    if (wide.matches) return;
    nl.append(leagueMatchList(upcoming.slice(k, Math.max(k, n)), false));
    ll.append(leagueMatchList(past.slice(kp, n), true));
    return;
  }
  setTexts({ 'next-title': 'Nästa match', 'next-toggle': 'Kommande matcher', 'last-title': 'Senaste match', 'last-toggle': 'Tidigare matcher' });
  const td = teamData();
  if (!td) { ns.append(el('span', { class: 'muted', text: 'Laddar…' })); ls.append(el('span', { class: 'muted', text: 'Laddar…' })); return; }
  const upcoming = td.matches.filter((m) => m.state !== 'post'), past = td.matches.filter((m) => m.state === 'post').reverse();
  ns.append(upcoming[0] ? matchHero(upcoming[0], 'next') : el('span', { class: 'muted', text: 'Ingen inplanerad match.' }));
  nl.append(teamMatchList(upcoming.slice(1, 1 + CONFIG.upcomingCount), false));
  ls.append(past[0] ? matchHero(past[0], 'last') : el('span', { class: 'muted', text: 'Inga spelade matcher.' }));
  ll.append(teamMatchList(past.slice(1, 1 + CONFIG.recentCount), true));
}
function renderTeamBar() {
  $('teambar').classList.toggle('show', !!team);
  const c = team && (team.color || (teamData() && teamData().color));
  if (color(c)) document.documentElement.style.setProperty('--sel', color(c));   // strict #rrggbb only
  else document.documentElement.style.removeProperty('--sel');
  if (!team) return;
  fill($('teambar-logo'), logo(team.logo));
  $('teambar-name').textContent = team.name;
}
function lastUpdated() {
  const e = cache.leagues[viewLeague()], u = e ? e.updatedAt : {};
  const other = team ? (cache.teams[team.id] || {}).ts : u.league;
  return Math.min(u.table || 0, other || 0) || null;
}
function renderStatus(msg, isError) {
  const s = $('status'), t = lastUpdated(), parts = [];
  s.className = isError ? 'offline' : '';
  if (t) parts.push(`Senast uppdaterad ${fmtDate.format(t)} ${fmtTime.format(t)}`);
  if (msg) parts.push(msg);
  s.textContent = parts.join(' · ');
}
function renderAll() { renderTeamBar(); renderLeagueBar(); renderRecent(); renderTable(); renderMatches(); applyAccordions(); }

// ---------- Accordions (state per mode) ----------
function setAcc(btn, open) {
  const panel = $(btn.getAttribute('aria-controls'));
  btn.setAttribute('aria-expanded', String(open));
  panel.classList.toggle('open', open);
  panel.inert = !open;
  btn.closest('.card').classList.toggle('expanded', open);
}
// Wide screens (≥ 840 px): matches and table are fully shown; Hjälp and Data stay accordions.
const wide = matchMedia('(min-width: 840px)');
function applyAccordions() {
  const saved = acc[mode()];
  document.querySelectorAll('.acc-toggle').forEach((btn) => {
    const forced = wide.matches && btn.dataset.wide === 'open';
    const keepRow = btn.dataset.acc === 'table' && !!team;
    btn.disabled = forced;
    btn.classList.toggle('gone', forced && !keepRow);
    if (btn.dataset.acc === 'table') btn.closest('.card').classList.toggle('wide-team', forced && !!team);
    setAcc(btn, !btn.hidden && (forced || !!saved[btn.dataset.acc]));
  });
}
wide.addEventListener('change', renderAll);
document.querySelectorAll('.acc-toggle').forEach((btn) => btn.addEventListener('click', () => {
  const open = btn.getAttribute('aria-expanded') !== 'true';
  setAcc(btn, open);
  if (open) acc[mode()][btn.dataset.acc] = true; else delete acc[mode()][btn.dataset.acc];
  store.set(CONFIG.keys.acc, acc);
}));

// ---------- League, team, recent ----------
function setLeague(id) {
  if (!isLeague(id) || (id === league && !team)) return;
  league = id;
  store.set(CONFIG.keys.league, league);
  renderAll();
  renderStatus(lastUpdated() ? 'Hämtar ny data…' : '');
  refresh();
}
let pending = null;
function askPick(row, lid) {
  if (team && row.id === team.id) return;
  pending = { ...row, leagueId: lid };
  fill($('pick-text'), logo(row.logo), el('span', { text: `${team ? 'Byt till' : 'Följ'} ${row.name}?` }));
  $('pick-ok').textContent = team ? 'Byt' : 'Följ';
  $('pick').showModal();
}
$('pick-ok').addEventListener('click', () => { const r = pending; pending = null; if (r) choose(r); });
$('pick').addEventListener('click', (e) => { if (e.target === $('pick')) $('pick').close(); });
// A team from the CL table gets its domestic league if it is one of ours (from cached or fetched tables).
async function domesticLeagueOf(id) {
  const doms = CONFIG.leagues.filter((l) => !l.cup);
  const hit = doms.find((l) => (L(l.id).table || []).some((r) => r.id === id));
  if (hit) return hit.id;
  const res = await Promise.allSettled(doms.map((l) => fetchTable(l.id)));
  let found = null;
  res.forEach((r, i) => {
    if (r.status !== 'fulfilled') return;
    const e = L(doms[i].id); e.table = r.value; e.updatedAt.table = Date.now();
    if (r.value.some((x) => x.id === id)) found = doms[i].id;
  });
  saveCache();
  return found;
}
async function choose(row) {
  const t = cleanTeam(row);
  if (!t) return;
  team = t;
  recent = addRecent(recent, team);
  saveSettings();
  window.scrollTo(0, 0);
  renderAll();
  if (!domestic(team.leagueId)) {
    const lid = await domesticLeagueOf(team.id).catch(() => null);
    if (lid && team && team.id === t.id) { team = { ...team, leagueId: lid }; recent = addRecent(recent, team); saveSettings(); renderAll(); }
  }
  refresh();
}
function removeRecent(id) {
  recent = recent.filter((t) => t.id !== id);
  if (!team || team.id !== id) delete cache.teams[id];
  saveSettings(); saveCache(); renderRecent();
}
$('teambar-close').addEventListener('click', () => {
  team = null;
  store.set(CONFIG.keys.team, null);
  window.scrollTo(0, 0);
  renderAll();
  refresh();
});

// ---------- Live ----------
const currentMatches = () => (team ? (teamData() || {}).matches || [] : L(league).league || []);
function scheduleLive() {
  clearTimeout(liveTimer);
  const live = currentMatches().filter((m) => m.state === 'in');
  if (!live.length || document.hidden) return;
  liveTimer = setTimeout(async () => {
    try {
      const fresh = await fetchLive(live);
      const byId = new Map(fresh.map((m) => [m.id, m]));
      const upd = (list) => list.map((m) => byId.get(m.id) || m);
      if (team && cache.teams[team.id]) cache.teams[team.id].matches = upd(cache.teams[team.id].matches);
      else if (!team && L(league).league) L(league).league = upd(L(league).league);
      saveCache();
      if (live.some((m) => (byId.get(m.id) || m).state === 'post')) { await refresh(); return; }
      renderMatches();
    } catch { /* keep showing last known */ }
    scheduleLive();
  }, CONFIG.livePollMs);
}
setInterval(() => { document.querySelectorAll('[data-kickoff]').forEach((n) => { n.textContent = countdown(new Date(n.dataset.kickoff) - Date.now()); }); }, 30000);
let filePick = false;   // returning from the file picker is not "reopening the app"
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(liveTimer); return; }
  if (filePick) { filePick = false; scheduleLive(); return; }
  const t = lastUpdated();
  if (!t || Date.now() - t > CONFIG.staleMs) refresh(); else scheduleLive();
});

// ---------- Refresh ----------
let busy = false, again = false;
async function refresh() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    const forTeam = team, lid = viewLeague(), e = L(lid);
    const known = forTeam && Date.now() - (e.updatedAt.league || 0) < CONFIG.leagueReuseMs ? leagueMatchesFor(lid, forTeam.id) : null;
    const [t, m] = await Promise.allSettled([fetchTable(lid),
      forTeam ? fetchTeamMatches(forTeam.id, lid, known, cache.colors[forTeam.id]) : fetchLeagueMatches(lid, e.table)]);
    const now = Date.now();
    if (t.status === 'fulfilled') { e.table = t.value; e.updatedAt.table = now; }
    if (m.status === 'fulfilled') {
      if (forTeam) cache.teams[forTeam.id] = { matches: m.value.matches, color: m.value.color, ts: now };
      else { e.league = m.value.matches; e.leagueFull = m.value.full; e.updatedAt.league = now; for (const [k, v] of Object.entries(m.value.colors)) if (validId(k) && color(v)) cache.colors[k] = v; }
    }
    trimCache();
    saveCache();
    if (team !== forTeam || viewLeague() !== lid) { again = true; return; }
    renderAll();
    const failed = [t, m].filter((x) => x.status === 'rejected').length;
    if (failed) {
      renderStatus(!navigator.onLine ? 'Offline – visar sparad data' : (failed === 2 ? 'Kunde inte hämta data – visar sparad data' : 'Viss data kunde inte hämtas'), true);
      if (failed === 2 && !e.table && !currentMatches().length) {
        for (const id of ['table-summary', 'next-summary', 'last-summary']) fill($(id), el('span', { class: 'error', text: 'Kunde inte hämta data. Kontrollera nätet och öppna appen igen.' }));
      }
    } else renderStatus();
  } catch {
    renderStatus('Något gick fel vid visning av data', true);
  } finally {
    busy = false;
    if (again) { again = false; setTimeout(refresh, 0); } else scheduleLive();
  }
}

// ---------- Snackbar ----------
let snackTimer = null;
function snackbar(text, actionText, action, ms = 5000) {
  $('snack-text').textContent = text;
  const btn = $('snack-action');
  btn.hidden = !actionText;
  btn.textContent = actionText || '';
  btn.onclick = () => { $('snackbar').hidden = true; if (action) action(); };
  $('snackbar').hidden = false;
  clearTimeout(snackTimer);
  if (ms) snackTimer = setTimeout(() => { $('snackbar').hidden = true; }, ms);
}

// ---------- Data card: backup (U5), import, reset ----------
function applySettings(s) {
  team = s.team; league = s.league; recent = s.recent; acc = s.acc;
  saveSettings(); trimCache(); saveCache();
  renderAll(); refresh();
}
const BACKUP_MSG = { saved: 'Backup-filen sparades', busy: 'Ett sparfönster är redan öppet', fallback: 'Backup-filen laddas ner',
  error: 'Kunde inte spara filen', nocrypto: 'Den här webbläsaren kan inte kryptera – ingen fil sparades' };
$('backup-save').addEventListener('click', async () => {
  const r = await Backup.saveWithPassword({ slug: CONFIG.slug, today: isoToday(), text: exportText(settings(), isoToday()) });
  if (BACKUP_MSG[r]) snackbar(BACKUP_MSG[r], null, null, 4000);
});
async function openImport(text) {
  const r = await Backup.openText(text, CONFIG.slug, MAX_IMPORT_CHARS);
  if (r.cancelled) return;
  if (r.error) { $('import-error').textContent = r.error; return; }
  startImport(r.text);
}
$('import-file').addEventListener('click', () => { filePick = true; });
$('import-file').addEventListener('change', async (e) => {
  const input = e.target, file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const r = await Backup.read(file, MAX_IMPORT_CHARS);
  if (r.error) { $('import-error').textContent = r.error; return; }
  openImport(r.text);
});
$('import-btn').addEventListener('click', () => openImport($('import-text').value));
let pendingImport = null;
function startImport(text) {
  const r = importText(text);
  $('import-error').textContent = r.error || '';
  if (r.error) return;
  pendingImport = r.data;
  const d = r.data;
  $('imp-sum').textContent = `Liga: ${leagueById(d.league).name}. Lag: ${d.team ? d.team.name : 'inget'}. ${d.recent.length} senast följda lag`
    + (r.exported ? `. Exporterad ${r.exported}.` : '.') + (r.skipped ? ` ${r.skipped} ogiltiga hoppas över.` : '');
  $('import-dialog').showModal();
}
$('imp-ok').addEventListener('click', () => {
  const next = pendingImport;
  pendingImport = null;
  if (!next) return;
  const before = loadSettings(JSON.parse(JSON.stringify(settings())));
  $('import-text').value = '';
  applySettings(next);
  snackbar('Inställningarna importerade', 'Ångra', () => applySettings(before));
});
$('reset').addEventListener('click', () => $('confirm-dialog').showModal());
$('cd-ok').addEventListener('click', () => {
  store.clear(CONFIG.prefix);
  cache = emptyCache(); team = null; league = DEFAULT_LEAGUE; recent = []; acc = loadAcc(null);
  renderAll();
  snackbar('All data är raderad', null, null, 3000);
  refresh();
});

// ---------- Install (beforeinstallprompt) ----------
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('install').hidden = false; });
addEventListener('appinstalled', () => { installEvent = null; $('install').hidden = true; });
$('install').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => null);
  installEvent = null;
  $('install').hidden = true;
});

// ---------- Start ----------
$('version').textContent = 'v' + self.APP_VERSION;
addEventListener('online', () => { if (!document.hidden) refresh(); });
addEventListener('offline', () => renderStatus('Offline – visar sparad data', true));
try {
  const s = loadSettings({ team: store.get(CONFIG.keys.team), league: store.get(CONFIG.keys.league), recent: store.get(CONFIG.keys.recent), acc: store.get(CONFIG.keys.acc) });
  team = s.team || loadTeam(null, store.get(CONFIG.keys.teamV1));
  if (store.get(CONFIG.keys.teamV1) != null) { store.set(CONFIG.keys.teamV1, null); if (team) store.set(CONFIG.keys.team, team); }
  league = s.league; recent = s.recent; acc = s.acc;
  cache = loadCache(store.get(CONFIG.keys.cache));
  renderAll();
  if (lastUpdated()) renderStatus('Hämtar ny data…');
} catch {
  cache = emptyCache();
  store.set(CONFIG.keys.cache, null);
  renderAll();
}
refresh();

// Service worker + update snackbar ("Ny version finns – Ladda om") instead of a silent reload.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => null);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) snackbar('Ny version finns', 'Ladda om', () => location.reload(), 0);
  });
}
