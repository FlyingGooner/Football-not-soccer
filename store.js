// Football, not soccer - storage, validation and the ESPN parsing layer. See CLAUDE.md and docs/SPEC.md.
// Plain script (not a module): loaded before app.js, which uses these names. Pure functions – tested in tools/tests/unit.test.js.
'use strict';

const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) {
    try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
  },
  // Removes every key with the prefix (Radera all data). Other apps on the same origin are left alone.
  clear(prefix) {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith(prefix)) localStorage.removeItem(k); return true; } catch { return false; }
  },
};

// ---------- Leagues and competitions (ids in URLs only ever come from here) ----------
const ZONES_DOMESTIC = [
  { cls: 'zone-cl', from: 1, to: 4, label: 'Champions League' },
  { cls: 'zone-eu', from: 5, to: 6, label: 'Europa' },
  { cls: 'zone-rel', from: -3, to: -1, label: 'Nedflyttning' },   // negative = counted from the bottom of the table
];
const Z = (cl, eu, rel) => [
  { cls: 'zone-cl', from: 1, to: cl, label: 'Champions League' },
  { cls: 'zone-eu', from: cl + 1, to: eu, label: 'Europa' },
  { cls: 'zone-rel', from: -rel, to: -1, label: 'Nedflyttning' },
];
const ZONES_PHASE = [{ cls: 'zone-cl', from: 1, to: 8, label: 'Åttondelsfinal' }, { cls: 'zone-eu', from: 9, to: 24, label: 'Playoff' }];
// kind: league (domestic), cup (European club cup), national (national-team tournament, group tables).
const LEAGUES = Object.freeze([
  { id: 'eng.1', name: 'Premier League', short: 'PL', kind: 'league', zones: ZONES_DOMESTIC },
  { id: 'esp.1', name: 'LaLiga', short: 'LaLiga', kind: 'league', zones: ZONES_DOMESTIC },
  { id: 'ita.1', name: 'Serie A', short: 'Serie A', kind: 'league', zones: ZONES_DOMESTIC },
  { id: 'uefa.champions', name: 'Champions League', short: 'CL', kind: 'cup', cup: true, zones: ZONES_PHASE },
  { id: 'ger.1', name: 'Bundesliga', short: 'Bundesliga', kind: 'league', zones: Z(4, 6, 2) },
  { id: 'fra.1', name: 'Ligue 1', short: 'Ligue 1', kind: 'league', zones: Z(3, 5, 2) },
  { id: 'ned.1', name: 'Eredivisie', short: 'Eredivisie', kind: 'league', zones: Z(2, 4, 2) },
  { id: 'por.1', name: 'Primeira Liga', short: 'Portugal', kind: 'league', zones: Z(2, 4, 2) },
  { id: 'swe.1', name: 'Allsvenskan', short: 'Allsvenskan', kind: 'league', zones: [{ cls: 'zone-eu', from: 1, to: 3, label: 'Europa' }, { cls: 'zone-rel', from: -2, to: -1, label: 'Nedflyttning' }] },
  { id: 'uefa.europa', name: 'Europa League', short: 'EL', kind: 'cup', cup: true, zones: ZONES_PHASE },
  { id: 'uefa.europa.conf', name: 'Conference League', short: 'ECL', kind: 'cup', cup: true, zones: ZONES_PHASE },
  { id: 'fifa.world', name: 'VM', short: 'VM', kind: 'national', cup: true, zones: [] },
  { id: 'uefa.euro', name: 'EM', short: 'EM', kind: 'national', cup: true, zones: [] },
  { id: 'conmebol.america', name: 'Copa América', short: 'Copa América', kind: 'national', cup: true, zones: [] },
  { id: 'caf.nations', name: 'Afrikanska mästerskapen', short: 'Afrika', kind: 'national', cup: true, zones: [] },
  { id: 'concacaf.gold', name: 'Gold Cup', short: 'Gold Cup', kind: 'national', cup: true, zones: [] },
]);
const DEFAULT_PICKER = ['eng.1', 'esp.1', 'ita.1', 'uefa.champions'];
const national = (id) => { const l = leagueById(id); return !!l && l.kind === 'national'; };
const EUROPE = Object.freeze([
  { id: 'uefa.champions', name: 'Champions League' },
  { id: 'uefa.europa', name: 'Europa League' },
  { id: 'uefa.europa.conf', name: 'Conference League' },
]);
const DEFAULT_LEAGUE = 'eng.1';
const COMPS = [...LEAGUES, ...EUROPE.filter((e) => !LEAGUES.some((l) => l.id === e.id))];
const compById = (id) => COMPS.find((c) => c.id === id) || null;
const leagueById = (id) => LEAGUES.find((l) => l.id === id) || null;
const isLeague = (id) => !!leagueById(id);
const domestic = (id) => { const l = leagueById(id); return !!l && !l.cup; };

// ---------- Validators (cached, imported and API data may be old, odd or tampered with) ----------
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v) => (typeof v === 'string' && v ? v : null);
// U6: an ESPN answer over the size cap is rejected before it is parsed.
const parseResponse = (text, max) => { if (typeof text !== 'string' || text.length > max) throw new Error('Svaret är för stort'); return JSON.parse(text); };
const validId = (v) => (typeof v === 'string' && /^\d{1,10}$/.test(v) ? v : null);
const color = (v) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);
const hexColor = (v) => (typeof v === 'string' && /^[0-9a-f]{6}$/i.test(v) ? `#${v.toLowerCase()}` : null);   // ESPN gives "ef0107"
// Club logos: only ESPN's image host (CSP img-src https://a.espncdn.com), never anything else.
const logoUrl = (v) => (typeof v === 'string' && v.length <= 300 && /^https:\/\/a\.espncdn\.com\/[\w./%-]+$/.test(v) ? v : null);
// Text from the source: control and bidi characters removed, trimmed, capped.
function cleanText(v, max = 60) {
  if (typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g, '').trim().slice(0, max);
}
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const ts = (v) => (Number.isFinite(v) && v > 0 ? v : null);
const okDate = (v) => typeof v === 'string' && v.length <= 30 && !isNaN(new Date(v));

// A team as stored (valt lag, senast följda): { id, name, logo, color, leagueId }.
function cleanTeam(t, fallbackLeague = null) {
  if (!isObj(t) || !validId(t.id)) return null;
  const leagueId = isLeague(t.leagueId) ? t.leagueId : fallbackLeague;
  if (!leagueId) return null;
  return { id: t.id, name: cleanText(t.name) || '?', logo: logoUrl(t.logo), color: color(t.color), leagueId };
}
const cleanRef = (t) => (isObj(t) ? { id: validId(t.id) || '', name: cleanText(t.name) || '?', logo: logoUrl(t.logo), color: color(t.color) } : null);
function cleanEvent(e) {
  if (!isObj(e) || !['goal', 'yellow', 'red'].includes(e.kind)) return null;
  return { kind: e.kind, min: cleanText(e.min, 10), name: cleanText(e.name) || '?', teamId: validId(e.teamId) || '', pen: e.pen === true, og: e.og === true };
}
const STATES = ['pre', 'in', 'post'];
function cleanMatch(m) {
  if (!isObj(m) || typeof m.id !== 'string' || !/^\d{1,12}$/.test(m.id) || !okDate(m.date) || !compById(m.leagueId)) return null;
  const home = cleanRef(m.home), away = cleanRef(m.away);
  if (!home || !away) return null;
  return {
    id: m.id, league: compById(m.leagueId).name, leagueId: m.leagueId, date: m.date,
    state: STATES.includes(m.state) ? m.state : 'pre',
    detail: cleanText(m.detail, 30), clock: cleanText(m.clock, 12),
    home, away, homeScore: num(m.homeScore), awayScore: num(m.awayScore),
    events: Array.isArray(m.events) ? m.events.map(cleanEvent).filter(Boolean).slice(0, 40) : null,
  };
}
const cleanMatches = (list) => (Array.isArray(list) ? list.map(cleanMatch).filter(Boolean).slice(0, 800) : null);
function cleanRow(r) {
  if (!isObj(r) || !validId(r.id)) return null;
  const n = (v) => (Number.isInteger(v) && Math.abs(v) < 1000 ? v : null);
  return { id: r.id, name: cleanText(r.name) || '?', logo: logoUrl(r.logo), color: color(r.color),
    rank: n(r.rank), played: n(r.played), w: n(r.w), d: n(r.d), l: n(r.l), gd: n(r.gd), pts: n(r.pts), group: cleanText(r.group) || null };
}
// Object without prototype, keys checked (no __proto__ tricks).
function idMap(obj, fn) {
  const out = Object.create(null);
  if (isObj(obj)) for (const [k, v] of Object.entries(obj)) { const x = fn(k, v); if (x != null) out[k] = x; }
  return out;
}

// ---------- Cache (fns.cache.v4) ----------
// { leagues: { [leagueId]: { table, league, range: { from: "YYYY-MM", to }, used, updatedAt: { table, league } } },
//   colors: { [teamId]: "#rrggbb" }, teams: { [teamId]: { matches, color, ts } } }
const emptyCache = () => ({ leagues: Object.create(null), colors: Object.create(null), teams: Object.create(null) });
const emptyLeague = () => ({ table: null, league: null, range: null, used: null, updatedAt: { table: null, league: null } });
const isoMonth = (v) => (typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : null);
const cleanRange = (r) => (isObj(r) && isoMonth(r.from) && isoMonth(r.to) && r.from <= r.to ? { from: r.from, to: r.to } : null);
// Months as "YYYY-MM": n months after key; all months from a to b.
const monthAdd = (key, n) => { const [y, m] = key.split('-').map(Number), d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
function monthsBetween(a, b) { const out = []; for (let k = a; k <= b && out.length < 24; k = monthAdd(k, 1)) out.push(k); return out; }
function loadCache(c) {
  if (!isObj(c)) return emptyCache();
  return {
    leagues: idMap(c.leagues, (k, v) => (isLeague(k) && isObj(v) ? {
      table: Array.isArray(v.table) ? v.table.map(cleanRow).filter(Boolean).slice(0, 80) : null,
      league: cleanMatches(v.league),
      range: cleanRange(v.range),
      used: ts(v.used),
      updatedAt: { table: ts(isObj(v.updatedAt) && v.updatedAt.table), league: ts(isObj(v.updatedAt) && v.updatedAt.league) },
    } : null)),
    colors: idMap(c.colors, (k, v) => (validId(k) ? color(v) : null)),
    teams: idMap(c.teams, (k, v) => (validId(k) && isObj(v) && Array.isArray(v.matches)
      ? { matches: cleanMatches(v.matches), color: color(v.color), color2: color(v.color2), ts: ts(v.ts) } : null)),
  };
}

// ---------- Settings: followed teams + favourite, league; open tab ----------
const TABS = ['matches', 'table', 'fav', 'team', 'settings'];
const loadTab = (v) => (TABS.includes(v) ? v : null);
const TEAM_MAX = 8;
const loadLeague = (v) => (isLeague(v) ? v : DEFAULT_LEAGUE);
// Old fns.team.v2, or fns.team.v1 (no leagueId – that version only had the Premier League).
const loadTeam = (v2, v1) => cleanTeam(v2) || cleanTeam(v1, DEFAULT_LEAGUE);
function cleanTeams(list, max = TEAM_MAX) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    const c = cleanTeam(t);
    if (c && !out.some((x) => x.id === c.id)) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}
// fns.teams.v1: { favorite: id | null, follow: [team] } – the favourite is always followed.
function loadTeams(v) {
  if (!isObj(v)) return null;
  const follow = cleanTeams(v.follow), fav = validId(v.favorite);
  return { favorite: fav && follow.some((t) => t.id === fav) ? fav : null, follow };
}
// Once from the old keys: chosen team → favourite, recently followed → followed.
function migrateTeams(team, recent) {
  const t = cleanTeam(team);
  return { favorite: t ? t.id : null, follow: cleanTeams([t, ...(Array.isArray(recent) ? recent : [])]) };
}
const emptyTeams = () => ({ favorite: null, follow: [] });
function loadSettings(s) {
  const o = isObj(s) ? s : {};
  return { teams: loadTeams(o.teams) || migrateTeams(o.team, o.recent), league: loadLeague(o.league), layout: loadLayout(o.layout) };
}
// Goals fetched via summary (fns.goals.v1): { [matchId]: { ts, events } }, at most GOALS_MAX, oldest dropped.
const GOALS_MAX = 200;
function loadGoals(v) {
  const out = idMap(v, (k, x) => (/^\d{1,12}$/.test(k) && isObj(x) && Array.isArray(x.events)
    ? { ts: ts(x.ts) || 1, events: x.events.map(cleanEvent).filter((e) => e && e.kind === 'goal').slice(0, 40) } : null));
  for (const id of Object.keys(out).sort((a, b) => out[b].ts - out[a].ts).slice(GOALS_MAX)) delete out[id];
  return out;
}

// ---------- Export/import as text (U5, shared standard: format 1 = slim JSON in an envelope) ----------
// Only settings – the match cache is never exported, it is fetched again.
const EXPORT_APP = 'football-not-soccer';
const EXPORT_FORMAT = 1;
const MAX_IMPORT_CHARS = 100000;
function packData(s) {
  const out = { league: s.league };
  if (s.teams.follow.length) out.teams = { favorite: s.teams.favorite, follow: s.teams.follow.map((t) => ({ ...t })) };
  if (Object.keys(s.layout).length) out.layout = s.layout;
  return out;
}
// Older exports have team + recent instead of teams; they are migrated like the old keys.
function unpackData(p) {
  if (!isObj(p)) return null;
  return { teams: p.teams ?? null, team: p.team ?? null, league: p.league, recent: Array.isArray(p.recent) ? p.recent : [], layout: isObj(p.layout) ? p.layout : {} };
}
function exportText(s, today) {
  return JSON.stringify({ app: EXPORT_APP, format: EXPORT_FORMAT, exported: today, data: packData(s) });
}
// Text → { data, counts, skipped, exported } or { error }. Nothing is saved here; the caller confirms first.
function importText(text) {
  if (typeof text !== 'string' || !text.trim()) return { error: 'Klistra in en exporterad text först.' };
  if (text.length > MAX_IMPORT_CHARS) return { error: 'Texten är för lång för en backup.' };
  let env;
  try { env = JSON.parse(text); } catch { return { error: 'Texten är inte en giltig export (trasig JSON). Kopiera hela texten igen.' }; }
  if (!isObj(env) || env.app !== EXPORT_APP) return { error: 'Texten kommer inte från Football, not soccer.' };
  if (env.format !== EXPORT_FORMAT) return { error: 'Okänt exportformat – uppdatera appen och försök igen.' };
  const raw = unpackData(env.data);
  if (!raw) return { error: 'Exporten saknar data.' };
  const data = loadSettings(raw);
  const inCount = isObj(raw.teams) ? (Array.isArray(raw.teams.follow) ? raw.teams.follow.length : 0)
    : new Set([raw.team, ...raw.recent].filter(isObj).map((t) => t.id)).size;
  return { data, skipped: Math.max(0, inCount - data.teams.follow.length),
    exported: typeof env.exported === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(env.exported) ? env.exported : '' };
}

// ---------- ESPN URLs (only from LEAGUES/EUROPE ids, validated team ids and fixed date ranges) ----------
const API_BASE = 'https://site.api.espn.com/apis';
function espnUrl(kind, compId, opt = {}) {
  // A team's schedule in all competitions at once (fixed path "all"; unknown competitions are dropped by cleanMatch).
  if (kind === 'teamAll') {
    if (!validId(opt.team)) throw new Error('espnUrl: ogiltigt lag-id');
    return `${API_BASE}/site/v2/sports/soccer/all/teams/${opt.team}/schedule${opt.fixture ? '?fixture=true' : ''}`;
  }
  if (!compById(compId)) throw new Error('espnUrl: okänd turnering');
  const site = `${API_BASE}/site/v2/sports/soccer/${compId}`;
  if (kind === 'standings') return `${API_BASE}/v2/sports/soccer/${compId}/standings`;
  if (kind === 'scoreboard') {
    if (opt.dates == null) return `${site}/scoreboard`;
    if (!/^\d{6}$/.test(opt.dates)) throw new Error('espnUrl: ogiltig månad');   // YYYYMM (ESPN gives 400 for day ranges)
    return `${site}/scoreboard?dates=${opt.dates}`;
  }
  if (kind === 'team') {
    if (!validId(opt.team)) throw new Error('espnUrl: ogiltigt lag-id');
    return `${site}/teams/${opt.team}`;
  }
  if (kind === 'summary') {
    if (typeof opt.event !== 'string' || !/^\d{1,12}$/.test(opt.event)) throw new Error('espnUrl: ogiltigt match-id');
    return `${site}/summary?event=${opt.event}`;
  }
  if (kind === 'schedule') {
    if (!validId(opt.team)) throw new Error('espnUrl: ogiltigt lag-id');
    return `${site}/teams/${opt.team}/schedule${opt.fixture ? '?fixture=true' : ''}`;
  }
  throw new Error('espnUrl: okänd typ');
}
const ymd = (t) => { const d = new Date(t); return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`; };

// ---------- ESPN responses → our shapes (then cleaned like cached data) ----------
function apiNum(v) {
  if (v == null) return null;
  if (typeof v === 'object') v = v.value ?? v.displayValue;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function teamOf(c) {
  const t = (isObj(c) && isObj(c.team) && c.team) || {};
  const logos = Array.isArray(t.logos) ? t.logos : (t.logo ? [{ href: t.logo }] : []);
  return { id: String(t.id ?? ''), name: str(t.shortDisplayName) || str(t.displayName) || str(t.name) || '?',
    logo: logos[0] && logos[0].href, color: hexColor(t.color) };
}
// Goals and red cards from a scoreboard competition's `details`.
function keyEvents(details) {
  if (!Array.isArray(details)) return null;
  const out = [];
  for (const d of details) {
    if (!isObj(d)) continue;
    const t = (str(d.type && d.type.text) || '').toLowerCase();
    const goal = d.scoringPlay === true || t.includes('goal') || t === 'penalty - scored';
    const red = d.redCard === true || t.includes('red card');
    const yellow = !red && (d.yellowCard === true || t.includes('yellow card'));
    if (!goal && !red && !yellow) continue;
    const a = Array.isArray(d.athletesInvolved) && d.athletesInvolved[0];
    out.push({ kind: goal ? 'goal' : red ? 'red' : 'yellow', min: str(d.clock && d.clock.displayValue) || '',
      name: str(a && (a.shortName || a.displayName)) || '?', teamId: String((d.team && d.team.id) ?? ''),
      pen: goal && (d.penaltyKick === true || t.includes('penalty')), og: goal && (d.ownGoal === true || t.includes('own goal')) });
  }
  return out;
}
// summary → the match's goals (keyEvents with scoringPlay), same shape as from the scoreboard.
function parseSummaryGoals(data) {
  const ke = isObj(data) && Array.isArray(data.keyEvents) ? data.keyEvents.filter((d) => isObj(d) && d.scoringPlay === true) : [];
  const evs = keyEvents(ke.map((d) => ({ ...d, athletesInvolved: (Array.isArray(d.participants) ? d.participants : []).map((p) => (isObj(p) ? p.athlete : null)) })));
  return evs.map(cleanEvent).filter((e) => e && e.kind === 'goal').slice(0, 40);
}
function parseEvent(ev, compId) {
  if (!isObj(ev) || ev.id == null) return null;
  const c0 = (Array.isArray(ev.competitions) && ev.competitions[0]) || {};
  const st = c0.status || ev.status || {};
  const type = st.type || {};
  const cs = (Array.isArray(c0.competitors) ? c0.competitors : []).filter(isObj);
  const home = cs.find((c) => c.homeAway === 'home') || cs[0];
  const away = cs.find((c) => c.homeAway === 'away') || cs[1];
  if (!home || !away) return null;
  return cleanMatch({
    id: String(ev.id), leagueId: compId, date: ev.date || c0.date,
    state: type.state || (type.completed ? 'post' : 'pre'),
    detail: str(type.shortDetail) || str(type.detail) || '', clock: str(st.displayClock) || '',
    home: teamOf(home), away: teamOf(away), homeScore: apiNum(home.score), awayScore: apiNum(away.score),
    events: keyEvents(c0.details),
  });
}
// compId null (the "all" schedule): each event's own league slug, kept only if it is one of COMPS.
const parseEvents = (data, compId) => (Array.isArray(data && data.events) ? data.events : [])
  .map((ev) => parseEvent(ev, compId || (isObj(ev) && isObj(ev.league) && str(ev.league.slug)) || null)).filter(Boolean);
// /teams/{id} → the team's domestic league, only if it is one of our leagues.
function parseDefaultLeague(data) {
  const slug = isObj(data) && isObj(data.team) && isObj(data.team.defaultLeague) ? data.team.defaultLeague.slug : null;
  const l = leagueById(slug);
  return l && l.kind === 'league' ? l.id : null;
}
// One table, or one per group (World Cup, Euro …): rows get `group` when there are several.
function parseStandings(data) {
  const kids = isObj(data) && Array.isArray(data.children) ? data.children.filter(isObj) : [];
  const groups = kids.length ? kids : [data || {}], many = groups.length > 1;
  return groups.slice(0, 20).flatMap((g) => {
    const entries = (isObj(g.standings) && Array.isArray(g.standings.entries) && g.standings.entries) || [];
    const rows = entries.filter(isObj).map((e) => {
      const s = {};
      for (const st of Array.isArray(e.stats) ? e.stats : []) if (isObj(st)) s[st.name || st.type] = apiNum(st);
      const t = teamOf(e);
      return cleanRow({ id: t.id, name: t.name, logo: t.logo, color: t.color, rank: s.rank, played: s.gamesPlayed, w: s.wins, d: s.ties, l: s.losses,
        gd: s.pointDifferential ?? ((s.pointsFor ?? 0) - (s.pointsAgainst ?? 0)), pts: s.points, group: many ? str(g.name) : null });
    }).filter(Boolean);
    rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    rows.forEach((r, i) => { if (r.rank == null) r.rank = i + 1; });
    return rows;
  });
}
const STATE_RANK = { pre: 0, in: 1, post: 2 };
// Same match from several sources: the most advanced state wins, goal details are kept.
function mergeMatches(lists) {
  const byId = new Map();
  for (const list of lists) for (const m of list || []) {
    const prev = byId.get(m.id);
    if (!prev || STATE_RANK[m.state] >= STATE_RANK[prev.state]) byId.set(m.id, prev && !m.events && prev.events ? { ...m, events: prev.events } : m);
  }
  return [...byId.values()].sort((x, y) => new Date(x.date) - new Date(y.date));
}
// Table zone for a rank, per league (negative from/to = from the bottom).
function zoneOf(leagueId, rank, rows) {
  const l = leagueById(leagueId);
  if (!l || !Number.isInteger(rank)) return null;
  for (const z of l.zones) {
    const from = z.from < 0 ? rows + z.from + 1 : z.from, to = z.to < 0 ? rows + z.to + 1 : z.to;
    if (rank >= from && rank <= to) return z;
  }
  return null;
}

// ---------- Card order per view (as simple-nutrition): { [view]: { order: [id], hidden: [id] } } ----------
// Ids are fixed; unknown ids are dropped and new cards go last, so a saved order never breaks.
const LAYOUT = Object.freeze({
  fav: [['next', 'Nästa match'], ['last', 'Senaste match']],
  // League picker (Matcher and Tabell): the default four first, the rest hidden until chosen.
  leagues: [...DEFAULT_PICKER, ...LEAGUES.map((l) => l.id).filter((id) => !DEFAULT_PICKER.includes(id))].map((id) => [id, leagueById(id).name]),
});
const LAYOUT_HIDDEN = Object.freeze({ leagues: LEAGUES.map((l) => l.id).filter((id) => !DEFAULT_PICKER.includes(id)) });
const LAYOUT_VIEWS = Object.freeze({ leagues: 'Ligor', fav: 'Favorit' });   // Matcher has one card only, so no list
function layoutOf(layout, v) {
  const def = LAYOUT[v].map(([id]) => id);
  const saved = isObj(layout) && ((isObj(layout[v]) && layout[v]) || (v === 'fav' && isObj(layout.team) && layout.team)), L = saved || {};   // "team" = before 2026-11-13
  const ids = (a) => (Array.isArray(a) ? a : []);
  const order = ids(L.order).filter((id, i, a) => def.includes(id) && a.indexOf(id) === i);
  def.forEach((id) => { if (!order.includes(id)) order.push(id); });
  let hidden = saved ? ids(L.hidden).filter((id, i, a) => def.includes(id) && a.indexOf(id) === i) : [...(LAYOUT_HIDDEN[v] || [])];
  if (v === 'leagues' && hidden.length >= order.length) hidden = hidden.filter((id) => id !== order[0]);   // at least one league shown
  return { order, hidden };
}
// Only views that differ from the default are kept.
function loadLayout(raw) {
  const out = {};
  for (const v of Object.keys(LAYOUT)) {
    const l = layoutOf(raw, v), def = LAYOUT[v].map(([id]) => id), dh = LAYOUT_HIDDEN[v] || [];
    const sameHidden = l.hidden.length === dh.length && l.hidden.every((id) => dh.includes(id));
    if (!sameHidden || l.order.join() !== def.join()) out[v] = l;
  }
  return out;
}
// Leagues shown in the picker, in the chosen order.
const pickerLeagues = (layout) => { const { order, hidden } = layoutOf(layout, 'leagues'); return order.filter((id) => !hidden.includes(id)); };
// A match that should have kicked off but still says 'pre': the cached answer is stale, fetch fresh (not the 60 s same-URL reuse).
const overdue = (list, now = Date.now()) => (list || []).some((m) => m.state === 'pre' && new Date(m.date) <= now);

// Team theme (beslut 2026-11-13): the favourite's colour → selected-element colours for light and dark,
// each pair with ink at contrast ≥ 4.5:1. Input must already be a strict #rrggbb (color()); otherwise null.
const lum = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (h, to, t) => '#' + [1, 3, 5].map((i) => { const a = parseInt(h.slice(i, i + 2), 16), b = parseInt(to.slice(i, i + 2), 16); return Math.round(a + (b - a) * t).toString(16).padStart(2, '0'); }).join('');
function teamTheme(hex, alt = null) {
  const c = color(hex); if (!c) return null;
  let l = c; for (let t = 0.1; lum(l) > 0.7 && t <= 1; t += 0.1) l = mix(c, '#000000', t);   // white kits: darken so the pill shows on a light surface
  const ink = (x) => (contrast(x, '#ffffff') >= contrast(x, '#111111') ? '#ffffff' : '#111111');
  for (let t = 0.05; contrast(l, ink(l)) < 4.5 && t <= 1; t += 0.05) l = mix(c, '#000000', t);   // e.g. Arsenal red → slightly deeper so white text passes
  const lInk = ink(l);
  let d = c; for (let t = 0.1; lum(d) > 0.06 && t <= 1; t += 0.1) d = mix(c, '#000000', t);   // dark tone of the same hue
  let dInk = mix(c, '#ffffff', 0.8); if (contrast(d, dInk) < 4.5) dInk = '#ffffff';
  // Second club colour (ESPN alternateColor) as a thin stripe, only where it stands out against the pill.
  const dist = (x, y) => Math.hypot(...[1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16) - parseInt(y.slice(i, i + 2), 16)));   // hue difference counts, not just lightness
  const a = color(alt), sL = a && dist(a, l) >= 100 ? a : null, dA = a && mix(a, '#000000', 0.3), sD = dA && dist(dA, d) >= 60 ? dA : null;
  return { light: l, lightInk: lInk, dark: d, darkInk: dInk, stripeLight: sL, stripeDark: sD };
}
