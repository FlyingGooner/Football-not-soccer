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
const LEAGUES = Object.freeze([
  { id: 'eng.1', name: 'Premier League', short: 'PL', zones: ZONES_DOMESTIC },
  { id: 'esp.1', name: 'LaLiga', short: 'LaLiga', zones: ZONES_DOMESTIC },
  { id: 'ita.1', name: 'Serie A', short: 'Serie A', zones: ZONES_DOMESTIC },
  { id: 'uefa.champions', name: 'Champions League', short: 'CL', cup: true,
    zones: [{ cls: 'zone-cl', from: 1, to: 8, label: 'Åttondelsfinal' }, { cls: 'zone-eu', from: 9, to: 24, label: 'Playoff' }] },
]);
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
  if (!isObj(e) || (e.kind !== 'goal' && e.kind !== 'red')) return null;
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
    rank: n(r.rank), played: n(r.played), w: n(r.w), d: n(r.d), l: n(r.l), gd: n(r.gd), pts: n(r.pts) };
}
// Object without prototype, keys checked (no __proto__ tricks).
function idMap(obj, fn) {
  const out = Object.create(null);
  if (isObj(obj)) for (const [k, v] of Object.entries(obj)) { const x = fn(k, v); if (x != null) out[k] = x; }
  return out;
}

// ---------- Cache (fns.cache.v3) ----------
// { leagues: { [leagueId]: { table, league, leagueFull, updatedAt: { table, league } } },
//   colors: { [teamId]: "#rrggbb" }, teams: { [teamId]: { matches, color, ts } } }
const emptyCache = () => ({ leagues: Object.create(null), colors: Object.create(null), teams: Object.create(null) });
const emptyLeague = () => ({ table: null, league: null, leagueFull: false, updatedAt: { table: null, league: null } });
function loadCache(c) {
  if (!isObj(c)) return emptyCache();
  return {
    leagues: idMap(c.leagues, (k, v) => (isLeague(k) && isObj(v) ? {
      table: Array.isArray(v.table) ? v.table.map(cleanRow).filter(Boolean).slice(0, 60) : null,
      league: cleanMatches(v.league),
      leagueFull: v.leagueFull === true,
      updatedAt: { table: ts(isObj(v.updatedAt) && v.updatedAt.table), league: ts(isObj(v.updatedAt) && v.updatedAt.league) },
    } : null)),
    colors: idMap(c.colors, (k, v) => (validId(k) ? color(v) : null)),
    teams: idMap(c.teams, (k, v) => (validId(k) && isObj(v) && Array.isArray(v.matches)
      ? { matches: cleanMatches(v.matches), color: color(v.color), ts: ts(v.ts) } : null)),
  };
}

// ---------- Settings: chosen team, league, recent teams, open accordions ----------
const ACC_KEYS = ['next', 'last', 'table', 'help', 'data'];
const RECENT_MAX = 5;
const loadLeague = (v) => (isLeague(v) ? v : DEFAULT_LEAGUE);
// fns.team.v2, or once from fns.team.v1 (no leagueId – that version only had the Premier League).
const loadTeam = (v2, v1) => cleanTeam(v2) || cleanTeam(v1, DEFAULT_LEAGUE);
function loadRecent(list) {
  const out = [];
  for (const t of Array.isArray(list) ? list : []) {
    const c = cleanTeam(t);
    if (c && !out.some((x) => x.id === c.id)) out.push(c);
    if (out.length >= RECENT_MAX) break;
  }
  return out;
}
function loadAcc(a) {
  const mode = (m) => { const o = {}; if (isObj(m)) for (const k of ACC_KEYS) if (m[k] === true) o[k] = true; return o; };
  return { league: mode(isObj(a) && a.league), team: mode(isObj(a) && a.team) };
}
// Recent list after following t: t first, no duplicates, at most RECENT_MAX.
const addRecent = (list, t) => loadRecent([t, ...list.filter((x) => x.id !== t.id)]);
function loadSettings(s) {
  const o = isObj(s) ? s : {};
  return { team: cleanTeam(o.team), league: loadLeague(o.league), recent: loadRecent(o.recent), acc: loadAcc(o.acc) };
}

// ---------- Export/import as text (U5, shared standard: format 1 = slim JSON in an envelope) ----------
// Only settings – the match cache is never exported, it is fetched again.
const EXPORT_APP = 'football-not-soccer';
const EXPORT_FORMAT = 1;
const MAX_IMPORT_CHARS = 100000;
function packData(s) {
  const out = { league: s.league };
  if (s.team) out.team = { ...s.team };
  if (s.recent.length) out.recent = s.recent.map((t) => ({ ...t }));
  const acc = {};
  for (const m of ['league', 'team']) if (Object.keys(s.acc[m]).length) acc[m] = { ...s.acc[m] };
  if (Object.keys(acc).length) out.acc = acc;
  return out;
}
function unpackData(p) {
  if (!isObj(p)) return null;
  return { team: p.team ?? null, league: p.league, recent: Array.isArray(p.recent) ? p.recent : [], acc: isObj(p.acc) ? p.acc : {} };
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
  const inCount = raw.recent.length + (raw.team ? 1 : 0);
  return { data, counts: { team: data.team ? 1 : 0, recent: data.recent.length },
    skipped: Math.max(0, inCount - data.recent.length - (data.team ? 1 : 0)),
    exported: typeof env.exported === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(env.exported) ? env.exported : '' };
}

// ---------- ESPN URLs (only from LEAGUES/EUROPE ids, validated team ids and fixed date ranges) ----------
const API_BASE = 'https://site.api.espn.com/apis';
function espnUrl(kind, compId, opt = {}) {
  if (!compById(compId)) throw new Error('espnUrl: okänd turnering');
  const site = `${API_BASE}/site/v2/sports/soccer/${compId}`;
  if (kind === 'standings') return `${API_BASE}/v2/sports/soccer/${compId}/standings`;
  if (kind === 'scoreboard') {
    if (opt.dates == null) return `${site}/scoreboard`;
    if (!/^\d{8}-\d{8}$/.test(opt.dates)) throw new Error('espnUrl: ogiltigt datumintervall');
    return `${site}/scoreboard?dates=${opt.dates}`;
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
    if (!goal && !red) continue;
    const a = Array.isArray(d.athletesInvolved) && d.athletesInvolved[0];
    out.push({ kind: goal ? 'goal' : 'red', min: str(d.clock && d.clock.displayValue) || '',
      name: str(a && (a.shortName || a.displayName)) || '?', teamId: String((d.team && d.team.id) ?? ''),
      pen: goal && (d.penaltyKick === true || t.includes('penalty')), og: goal && (d.ownGoal === true || t.includes('own goal')) });
  }
  return out;
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
const parseEvents = (data, compId) => (Array.isArray(data && data.events) ? data.events : []).map((ev) => parseEvent(ev, compId)).filter(Boolean);
function parseStandings(data) {
  const group = (isObj(data) && Array.isArray(data.children) && data.children[0]) || data || {};
  const entries = (isObj(group.standings) && Array.isArray(group.standings.entries) && group.standings.entries) || [];
  const rows = entries.filter(isObj).map((e) => {
    const s = {};
    for (const st of Array.isArray(e.stats) ? e.stats : []) if (isObj(st)) s[st.name || st.type] = apiNum(st);
    const t = teamOf(e);
    return cleanRow({ id: t.id, name: t.name, logo: t.logo, color: t.color, rank: s.rank, played: s.gamesPlayed, w: s.wins, d: s.ties, l: s.losses,
      gd: s.pointDifferential ?? ((s.pointsFor ?? 0) - (s.pointsAgainst ?? 0)), pts: s.points });
  }).filter(Boolean);
  rows.sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  rows.forEach((r, i) => { if (r.rank == null) r.rank = i + 1; });
  return rows;
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
