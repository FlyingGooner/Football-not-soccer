// Unit tests for store.js (plain script). Run: tools\test.ps1 football-not-soccer
const LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png';

T.test('ligor: PL, LaLiga, Serie A och CL', () => {
  T.eq(LEAGUES.map((l) => l.id), ['eng.1', 'esp.1', 'ita.1', 'uefa.champions']);
  T.eq(loadLeague('esp.1'), 'esp.1');
  T.eq(loadLeague('x'), 'eng.1');
  T.eq(loadLeague('uefa.europa'), 'eng.1');
});
T.test('URL-byggare: bara kända turneringar, lag-id och datum', () => {
  T.eq(espnUrl('standings', 'esp.1'), 'https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings');
  T.eq(espnUrl('scoreboard', 'ita.1', { dates: '20261101-20261107' }), 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard?dates=20261101-20261107');
  T.eq(espnUrl('schedule', 'uefa.europa', { team: '359', fixture: true }), 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/teams/359/schedule?fixture=true');
  for (const bad of [() => espnUrl('standings', '../x'), () => espnUrl('schedule', 'eng.1', { team: '1/../2' }),
    () => espnUrl('scoreboard', 'eng.1', { dates: '2026&x=1' }), () => espnUrl('other', 'eng.1')]) {
    let threw = false; try { bad(); } catch { threw = true; }
    T.ok(threw, 'ska kasta');
  }
});
T.test('validering: färg, logga och text', () => {
  T.eq(hexColor('EF0107'), '#ef0107');
  T.eq(hexColor('red;x'), null);
  T.eq(color('#ef0107'), '#ef0107');
  T.eq(color('#ef0107;background:url(x)'), null);
  T.eq(logoUrl(LOGO), LOGO);
  T.eq(logoUrl('https://evil.example/x.png'), null);
  T.eq(logoUrl('http://a.espncdn.com/x.png'), null);
  T.eq(logoUrl('https://a.espncdn.com.evil.example/x.png'), null);
  T.eq(cleanText(' Ars‮enal\u0007 '), 'Arsenal');
  T.eq(cleanText('x'.repeat(90)).length, 60);
});
T.test('valt lag: v2 valideras, v1 läses som Premier League', () => {
  T.eq(loadTeam({ id: '86', name: 'Real Madrid', leagueId: 'esp.1', color: '#ffffff', logo: 'javascript:x' }, null),
    { id: '86', name: 'Real Madrid', logo: null, color: '#ffffff', leagueId: 'esp.1' });
  T.eq(loadTeam(null, { id: '359', name: 'Arsenal' }).leagueId, 'eng.1');
  T.eq(loadTeam({ id: '86', leagueId: 'xyz' }, null), null);
  T.eq(loadTeam({ id: '8a', leagueId: 'esp.1' }, null), null);
});
T.test('senast följda: max 5, inga dubbletter, nyast först', () => {
  let r = [];
  for (const id of ['1', '2', '3', '2', '4', '5', '6']) r = addRecent(r, { id, name: 'L' + id, leagueId: 'eng.1' });
  T.eq(r.map((t) => t.id), ['6', '5', '4', '2', '3']);
  T.eq(loadRecent([{ id: 'bad' }, { id: '1', leagueId: 'eng.1' }, { id: '1', leagueId: 'eng.1' }]).length, 1);
});
T.test('cache: ogiltiga ligor, matcher och nycklar tas bort', () => {
  const good = { id: '700', leagueId: 'esp.1', date: '2026-11-07T15:00Z', state: 'post', home: { id: '86', name: 'Real' }, away: { id: '83', name: 'Barça' }, homeScore: 2, awayScore: 1, events: [{ kind: 'goal', min: "12'", name: 'X', teamId: '86' }, { kind: 'evil' }] };
  const c = loadCache(JSON.parse(JSON.stringify({
    leagues: { 'esp.1': { table: [{ id: '86', name: 'Real', rank: 1, pts: 30 }, { id: 'x' }], league: [good, { ...good, id: 'x' }, { ...good, leagueId: 'zzz' }, { ...good, date: 'nej' }], updatedAt: { table: 5, league: 'x' } }, 'evil.1': { table: [] } },
    colors: { 86: '#ffffff', 83: 'red' },
    teams: { 86: { matches: [good], color: '#000000', ts: 1 }, bad: { matches: [] } },
  })));
  T.eq(Object.keys(c.leagues), ['esp.1']);
  T.eq(c.leagues['esp.1'].table.length, 1);
  T.eq(c.leagues['esp.1'].league.length, 1);
  T.eq(c.leagues['esp.1'].league[0].events.length, 1);
  T.eq(c.leagues['esp.1'].league[0].league, 'LaLiga');
  T.eq(c.leagues['esp.1'].updatedAt, { table: 5, league: null });
  T.eq(Object.keys(c.colors), ['86']);
  T.eq(Object.keys(c.teams), ['86']);
  const p = loadCache(JSON.parse('{"colors":{"__proto__":"#ffffff"},"teams":{"__proto__":{"matches":[]}}}'));
  T.eq(Object.keys(p.colors).length + Object.keys(p.teams).length, 0);
  T.eq(Object.getPrototypeOf(p.colors), null);
});
T.test('ESPN-tolkning: tabell och matcher med mål, okända fält ignoreras', () => {
  const rows = parseStandings({ children: [{ standings: { entries: [
    { team: { id: '359', shortDisplayName: 'Arsenal', color: 'ef0107', logos: [{ href: LOGO }] }, stats: [{ name: 'rank', value: 1 }, { name: 'points', value: 26 }, { name: 'pointDifferential', value: 15 }] },
    { team: { id: '<b>', shortDisplayName: 'X' }, stats: [] }] } }] });
  T.eq(rows, [{ id: '359', name: 'Arsenal', logo: LOGO, color: '#ef0107', rank: 1, played: null, w: null, d: null, l: null, gd: 15, pts: 26 }]);
  const ms = parseEvents({ events: [{ id: '1', date: '2026-11-07T15:00Z', competitions: [{ status: { type: { state: 'in' }, displayClock: "67'" },
    competitors: [{ homeAway: 'home', score: '2', team: { id: '359', shortDisplayName: 'Arsenal' } }, { homeAway: 'away', score: '1', team: { id: '363', shortDisplayName: 'Chelsea' } }],
    details: [{ scoringPlay: true, penaltyKick: true, type: { text: 'Penalty - Scored' }, clock: { displayValue: "40'" }, team: { id: '359' }, athletesInvolved: [{ shortName: 'B. Saka' }] }] }] }, null] }, 'eng.1');
  T.eq(ms.length, 1);
  T.eq([ms[0].state, ms[0].clock, ms[0].homeScore, ms[0].league], ['in', "67'", 2, 'Premier League']);
  T.eq(ms[0].events[0], { kind: 'goal', min: "40'", name: 'B. Saka', teamId: '359', pen: true, og: false });
});
T.test('sammanslagning: mest avancerat läge vinner, mål behålls', () => {
  const m = (state, events) => ({ id: '1', date: '2026-11-07T15:00Z', state, events });
  T.eq(mergeMatches([[m('in', [1])], [m('post', null)]])[0], { ...m('post', null), events: [1] });
  T.eq(mergeMatches([[m('post', [1])], [m('pre', null)]])[0].state, 'post');
});
T.test('zoner: per liga, nedflyttning räknas från botten', () => {
  T.eq(zoneOf('eng.1', 4, 20).cls, 'zone-cl');
  T.eq(zoneOf('eng.1', 18, 20).cls, 'zone-rel');
  T.eq(zoneOf('ita.1', 17, 20), null);
  T.eq(zoneOf('uefa.champions', 20, 36).cls, 'zone-eu');
  T.eq(zoneOf('uefa.champions', 36, 36), null);
});
T.test('export/import: inställningar fram och tillbaka, ingen cache', () => {
  const s = loadSettings({ team: { id: '86', name: 'Real', leagueId: 'esp.1' }, league: 'ita.1', recent: [{ id: '86', name: 'Real', leagueId: 'esp.1' }] });
  const t = exportText(s, '2026-11-11');
  const r = importText(t);
  T.eq(r.data, s);
  T.eq(r.exported, '2026-11-11');
  T.eq(Object.keys(JSON.parse(t).data).sort(), ['league', 'recent', 'team']);
});
T.test('import avvisar fel app, format, okänd liga och dåliga lag-id', () => {
  T.ok(importText('{').error);
  T.ok(importText(JSON.stringify({ app: 'budget-buddy', format: 1, data: {} })).error);
  T.ok(importText(JSON.stringify({ app: 'football-not-soccer', format: 2, data: {} })).error);
  const r = importText(JSON.stringify({ app: 'football-not-soccer', format: 1, data: { league: 'evil.1', team: { id: '1;x', leagueId: 'eng.1' },
    recent: [{ id: '5', leagueId: 'zzz' }, { id: '6', name: 'Ok', leagueId: 'ita.1' }] } }));
  T.eq([r.data.league, r.data.team, r.data.recent.map((t) => t.id), r.skipped], ['eng.1', null, ['6'], 2]);
});
T.test('flik: bara kända flikar', () => {
  T.eq(TABS, ['matches', 'table', 'team', 'settings']);
  T.eq(loadTab('team'), 'team');
  T.eq(loadTab('evil'), null);
});
T.test('kortordning: okända id bort, nya kort sist, standard sparas inte', () => {
  T.eq(layoutOf({ matches: { order: ['last', 'evil', 'last'], hidden: ['today', 'x'] } }, 'matches'), { order: ['last', 'today', 'next'], hidden: ['today'] });
  T.eq(loadLayout({ matches: { order: ['today', 'next', 'last'], hidden: [] }, evil: { order: [] } }), {});
  T.eq(Object.keys(loadLayout({ team: { hidden: ['recent'] } })), ['team']);
  const s = loadSettings({ league: 'eng.1', layout: { team: { order: ['table'] } } });
  T.eq(importText(exportText(s, '2026-11-11')).data.layout, s.layout);
});
