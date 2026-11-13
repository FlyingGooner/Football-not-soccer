// Football, not soccer - data adapter (ESPN), rendering and logic. See CLAUDE.md and docs/SPEC.md.
// Plain script (not a module): loaded after version.js, backup.js and store.js; views/*.js and main.js follow (shared global scope).
// Rendering: DOM + textContent only (CSP has Trusted Types) – never innerHTML.
'use strict';

// ---------- Config ----------
const CONFIG = {
  fetchTimeoutMs: 10000,        // U6: every ESPN request is aborted after 10 s
  maxResponseChars: 8000000,    // U6: larger answers are rejected before JSON.parse
  leagues: LEAGUES,             // store.js: Premier League, LaLiga, Serie A, Champions League
  europe: EUROPE,               // collected in team mode together with the team's league
  upcomingCount: 3,             // Lag: rows under Nästa match before Visa fler
  recentCount: 3,               // Lag: rows under Senaste match before Visa fler
  roundSize: 10,
  monthsMax: 3,                 // Visa fler fetches one month at a time, at most 3 back and 3 ahead of the current month
  minRows: 5,
  livePollMs: 20000,
  teamCacheMax: TEAM_MAX,       // followed teams (favourite included)
  moreStep: 5,                  // Lag: a tap on Kommande/Spelad shows 5 more
  leagueCacheMax: 6,            // leagues kept in the cache (most recently used)
  teamAllMs: 24 * 3600e3,       // a team's all-competition schedule: at most once a day (or when its match has started)
  sameUrlMs: 60000,             // the same URL at most once a minute (not the live poll)
  leagueDebounceMs: 400,        // league switch/swipe: wait before fetching, so passed leagues are not fetched
  maxAgeMs: 6 * 3600e3,         // cache valid until next kickoff, but never longer than this
  keys: { cache: 'fns.cache.v4', teams: 'fns.teams.v1', goals: 'fns.goals.v1', team: 'fns.team.v2', teamV1: 'fns.team.v1', league: 'fns.league.v1', recent: 'fns.recent.v1', tab: 'fns.tab.v1', layout: 'fns.layout.v1' },
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
// The same URL at most once per CONFIG.sameUrlMs (the answer is reused); fresh = live poll.
const recentUrls = new Map();
function getJSON(url, fresh = false) {
  const now = Date.now(), hit = recentUrls.get(url);
  if (!fresh && hit && now - hit.t < CONFIG.sameUrlMs) return hit.p;
  const p = fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', mode: 'cors', signal: AbortSignal.timeout(CONFIG.fetchTimeoutMs) })
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.text(); }).then((t) => parseResponse(t, CONFIG.maxResponseChars));
  recentUrls.set(url, { t: now, p });
  p.catch(() => { if (recentUrls.get(url) && recentUrls.get(url).p === p) recentUrls.delete(url); });
  return p;
}
async function fetchTable(leagueId) { return parseStandings(await getJSON(espnUrl('standings', leagueId))); }

// A team's results and fixtures in all competitions (two requests). Resolves to { matches, color }.
async function fetchTeamMatches(teamId) {
  const settled = await Promise.allSettled([getJSON(espnUrl('teamAll', null, { team: teamId })), getJSON(espnUrl('teamAll', null, { team: teamId, fixture: true }))]);
  const ok = settled.filter((x) => x.status === 'fulfilled').map((x) => x.value);
  if (!ok.length) throw settled[0].reason;
  const c = ok.map((d) => hexColor(d && d.team && d.team.color)).find(Boolean) || null;
  const c2 = ok.map((d) => hexColor(d && d.team && d.team.alternateColor)).find(Boolean) || null;
  return { matches: mergeMatches(ok.map((d) => parseEvents(d, null))), color: c, color2: c2 };
}
// Current month as "YYYY-MM" (local), n months away.
const monthAt = (n = 0) => { const d = new Date(); return monthAdd(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, n); };
// League matches for whole months, in parallel. ok = every month came back (only then is the range extended).
async function fetchMonths(leagueId, months) {
  const settled = await Promise.allSettled(months.map((k) => getJSON(espnUrl('scoreboard', leagueId, { dates: k.replace('-', '') })).then((d) => parseEvents(d, leagueId))));
  if (settled.every((x) => x.status === 'rejected')) throw settled[0].reason;
  return { matches: mergeMatches(settled.filter((x) => x.status === 'fulfilled').map((x) => x.value)), ok: settled.every((x) => x.status === 'fulfilled') };
}
const fetchToday = async (leagueId, fresh = false) => parseEvents(await getJSON(espnUrl('scoreboard', leagueId), fresh), leagueId);
// Live: today's scoreboard per competition, always fresh.
async function fetchLive(live) {
  const comps = [...new Set(live.map((m) => m.leagueId))];
  const res = await Promise.allSettled(comps.map((id) => fetchToday(id, true)));
  if (res.every((r) => r.status === 'rejected')) throw res[0].reason;
  return mergeMatches(res.filter((r) => r.status === 'fulfilled').map((r) => r.value));
}

// ---------- State ----------
let cache = emptyCache();
let teams = emptyTeams();        // { favorite: id | null, follow: [{ id, name, logo, color, leagueId }] }, at most TEAM_MAX
let team = null;                 // the favourite (derived from teams by syncFav)
let league = DEFAULT_LEAGUE;     // chosen league for Matcher and Tabell
let layout = {};              // card order per view (Inställningar → Utseende)
let goals = Object.create(null); // fns.goals.v1: goals of played matches fetched via summary
let view = 'matches';
let liveTimer = null;
const tableDue = new Set();     // leagues where a match finished but the table is not refetched yet
const syncFav = () => { team = teams.follow.find((t) => t.id === teams.favorite) || null; };
const isFollowed = (id) => teams.follow.some((t) => t.id === id);
// A match has kicked off or is live since the data was fetched → the cache is no longer valid.
const started = (list) => (list || []).some((m) => m.state === 'in' || (m.state === 'pre' && new Date(m.date) <= Date.now()));
// Favorit shows the favourite; Matcher and Tabell show the chosen league.
const teamView = () => view === 'fav' && !!team;
const viewLeague = () => (teamView() ? team.leagueId : league);
const L = (id) => cache.leagues[id] || (cache.leagues[id] = emptyLeague());
const saveCache = () => { if (!store.set(CONFIG.keys.cache, cache)) { trimCache(0); store.set(CONFIG.keys.cache, cache); } };
const settings = () => ({ teams, league, layout });
function saveSettings() {
  syncFav();
  store.set(CONFIG.keys.teams, teams);
  store.set(CONFIG.keys.league, league);
  store.set(CONFIG.keys.layout, Object.keys(layout).length ? layout : null);
}
// Team cache: only the followed teams.
function trimCache(max = CONFIG.teamCacheMax) {
  const keep = new Set(teams.follow.slice(0, max).map((t) => t.id).concat(team ? [team.id] : []));
  for (const id of Object.keys(cache.teams)) if (!keep.has(id)) delete cache.teams[id];
  // Leagues: the open ones plus the most recently used, at most CONFIG.leagueCacheMax (localStorage size).
  const open = new Set([league, team && team.leagueId].filter(Boolean));
  const ids = Object.keys(cache.leagues).sort((a, b) => (cache.leagues[b].used || 0) - (cache.leagues[a].used || 0));
  let n = 0;
  for (const id of ids) if (!open.has(id) && ++n > Math.max(0, CONFIG.leagueCacheMax - open.size)) delete cache.leagues[id];
}
// A team's matches: its own schedule (all competitions) plus every cached league month, which has goals and cards.
function teamData(t = team) {
  if (!t) return null;
  const td = cache.teams[t.id], id = t.id;
  const fromLeagues = Object.values(cache.leagues).map((e) => (e.league || []).filter((m) => m.home.id === id || m.away.id === id));
  if (!td && !fromLeagues.some((l) => l.length)) return null;
  return { matches: mergeMatches([td ? td.matches : [], ...fromLeagues]), color: (td && td.color) || cache.colors[id] || null, color2: (td && td.color2) || null };
}

// ---------- Perspective helpers (Favorit, Lag): id = the team whose view it is, default the favourite ----------
const favId = () => (team ? team.id : null);
const isHomeFor = (m, id = favId()) => !!id && m.home.id === id;
const opponent = (m, id = favId()) => (isHomeFor(m, id) ? m.away : m.home);
function resultOf(m, id = favId()) {
  if (!id || m.homeScore == null || m.awayScore == null) return null;
  const home = isHomeFor(m, id), us = home ? m.homeScore : m.awayScore, them = home ? m.awayScore : m.homeScore;
  return us > them ? 'W' : us < them ? 'L' : 'D';
}
const RESULT_SHORT = { W: 'V', D: 'O', L: 'F' }, RESULT_LONG = { W: 'Vinst', D: 'Oavgjort', L: 'Förlust' };
const scoreText = (a, b) => `${a ?? '–'}–${b ?? '–'}`;

// ---------- Goals of a played match outside the league cache: summary, once per match (fns.goals.v1) ----------
const goalsLoading = new Set();
// Events to show: the match's own (scoreboard), else saved goals, else undefined (= must be fetched).
const goalsFailed = new Set();   // summary failed this session → "Ingen matchinfo tillgänglig."
const matchEvents = (m) => (m.events ? m.events : goals[m.id] ? goals[m.id].events : m.state === 'post' && !goalsFailed.has(m.id) ? undefined : null);
async function fetchGoals(m, done) {
  if (goalsLoading.has(m.id) || m.state !== 'post') return;
  goalsLoading.add(m.id);
  try {
    const evs = parseSummaryGoals(await getJSON(espnUrl('summary', m.leagueId, { event: m.id })));
    goals[m.id] = { ts: Date.now(), events: evs };
    goals = loadGoals(goals);   // at most GOALS_MAX, oldest out
    store.set(CONFIG.keys.goals, goals);
  } catch { goalsFailed.add(m.id); }
  goalsLoading.delete(m.id);
  done();
}
