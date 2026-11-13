// Unit tests for store.js (plain script). Run: tools\test.ps1 football-not-soccer
const LOGO = 'https://a.espncdn.com/i/teamlogos/soccer/500/359.png';

T.test('ligor: 16 ligor och turneringar, standard PL först', () => {
  T.eq(LEAGUES.length, 16);
  T.eq(LEAGUES.slice(0, 4).map((l) => l.id), ['eng.1', 'esp.1', 'ita.1', 'uefa.champions']);
  T.eq(loadLeague('esp.1'), 'esp.1');
  T.eq(loadLeague('x'), 'eng.1');
  T.eq([loadLeague('uefa.europa'), loadLeague('fifa.world')], ['uefa.europa', 'fifa.world']);
});
T.test('URL-byggare: bara kända turneringar, lag-id och datum', () => {
  T.eq(espnUrl('standings', 'esp.1'), 'https://site.api.espn.com/apis/v2/sports/soccer/esp.1/standings');
  T.eq(espnUrl('scoreboard', 'ita.1', { dates: '202611' }), 'https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/scoreboard?dates=202611');
  T.eq(espnUrl('teamAll', null, { team: '359', fixture: true }), 'https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/359/schedule?fixture=true');
  T.eq(espnUrl('team', 'uefa.champions', { team: '359' }), 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/teams/359');
  T.eq(espnUrl('schedule', 'uefa.europa', { team: '359', fixture: true }), 'https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.europa/teams/359/schedule?fixture=true');
  for (const bad of [() => espnUrl('standings', '../x'), () => espnUrl('schedule', 'eng.1', { team: '1/../2' }),
    () => espnUrl('scoreboard', 'eng.1', { dates: '2026&x=1' }), () => espnUrl('scoreboard', 'eng.1', { dates: '20261101-20261107' }), () => espnUrl('teamAll', null, { team: '1/2' }), () => espnUrl('team', 'evil', { team: '1' }), () => espnUrl('other', 'eng.1')]) {
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
T.test('följda lag: max 8, inga dubbletter, favoriten måste följas, gamla nycklar migreras', () => {
  const t = (id) => ({ id, name: 'L' + id, leagueId: 'eng.1' });
  const v = loadTeams({ favorite: '2', follow: ['1', '2', '2', 'bad', '3', '4', '5', '6', '7', '8', '9'].map(t) });
  T.eq([v.favorite, v.follow.map((x) => x.id)], ['2', ['1', '2', '3', '4', '5', '6', '7', '8']]);
  T.eq(loadTeams({ favorite: '99', follow: [t('1')] }).favorite, null);
  T.eq(loadTeams({ favorite: '__proto__', follow: 'x' }), { favorite: null, follow: [] });
  T.eq(loadTeams(null), null);
  const m = loadSettings({ team: t('5'), recent: [t('1'), t('5'), t('2')] }).teams;
  T.eq([m.favorite, m.follow.map((x) => x.id)], ['5', ['5', '1', '2']]);
});
T.test('summary: bara mål, URL valideras, mål-cache max 200', () => {
  T.eq(espnUrl('summary', 'eng.1', { event: '740000' }), 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1/summary?event=740000');
  for (const bad of [() => espnUrl('summary', 'eng.1', { event: '1&x=2' }), () => espnUrl('summary', 'evil', { event: '1' })]) {
    let threw = false; try { bad(); } catch { threw = true; } T.ok(threw, String(bad));
  }
  const g = parseSummaryGoals({ keyEvents: [
    { scoringPlay: true, type: { text: 'Goal - Penalty' }, clock: { displayValue: "40'" }, team: { id: '359' }, participants: [{ athlete: { shortName: 'B. Saka' } }] },
    { type: { text: 'Yellow Card' }, clock: { displayValue: "50'" }, team: { id: '1' }, participants: [{ athlete: { shortName: 'X' } }] },
    { scoringPlay: true, type: { text: 'Own Goal' }, clock: { displayValue: "60'" }, team: { id: '1' }, participants: [{ athlete: { shortName: '<b>Y' } }] }] });
  T.eq(g.map((e) => [e.kind, e.min, e.name, e.pen, e.og]), [['goal', "40'", 'B. Saka', true, false], ['goal', "60'", '<b>Y', false, true]]);
  T.eq(parseSummaryGoals({ keyEvents: 'x' }), []);
  const many = {};
  for (let i = 1; i <= 210; i++) many[String(i)] = { ts: i, events: [{ kind: 'goal', min: '1', name: 'A', teamId: '1' }, { kind: 'red' }] };
  many.bad = { ts: 999, events: [] };
  const lg = loadGoals(many);
  T.eq([Object.keys(lg).length, '1' in lg, '210' in lg, lg['210'].events.length], [200, false, true, 1]);
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
  T.eq(rows, [{ id: '359', name: 'Arsenal', logo: LOGO, color: '#ef0107', rank: 1, played: null, w: null, d: null, l: null, gd: 15, pts: 26, group: null }]);
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
  const s = loadSettings({ teams: { favorite: '86', follow: [{ id: '359', name: 'Arsenal', leagueId: 'eng.1' }, { id: '86', name: 'Real', leagueId: 'esp.1' }] }, league: 'ita.1' });
  const t = exportText(s, '2026-11-11');
  const r = importText(t);
  T.eq(r.data, s);
  T.eq(r.exported, '2026-11-11');
  T.eq(Object.keys(JSON.parse(t).data).sort(), ['league', 'teams']);
  // An older export (team + recent) is migrated.
  const old = importText(JSON.stringify({ app: 'football-not-soccer', format: 1, data: { league: 'eng.1', team: { id: '86', name: 'Real', leagueId: 'esp.1' }, recent: [{ id: '359', name: 'A', leagueId: 'eng.1' }] } }));
  T.eq([old.data.teams.favorite, old.data.teams.follow.map((x) => x.id)], ['86', ['86', '359']]);
});
T.test('import avvisar fel app, format, okänd liga och dåliga lag-id', () => {
  T.ok(importText('{').error);
  T.ok(importText(JSON.stringify({ app: 'budget-buddy', format: 1, data: {} })).error);
  T.ok(importText(JSON.stringify({ app: 'football-not-soccer', format: 2, data: {} })).error);
  const r = importText(JSON.stringify({ app: 'football-not-soccer', format: 1, data: { league: 'evil.1', team: { id: '1;x', leagueId: 'eng.1' },
    recent: [{ id: '5', leagueId: 'zzz' }, { id: '6', name: 'Ok', leagueId: 'ita.1' }] } }));
  T.eq([r.data.league, r.data.teams.favorite, r.data.teams.follow.map((t) => t.id), r.skipped], ['eng.1', null, ['6'], 2]);
  const r2 = importText(JSON.stringify({ app: 'football-not-soccer', format: 1, data: { league: 'eng.1', teams: { favorite: '1', follow: [{ id: '1;x', leagueId: 'eng.1' }, { id: '6', leagueId: 'ita.1' }] } } }));
  T.eq([r2.data.teams.favorite, r2.data.teams.follow.map((t) => t.id), r2.skipped], [null, ['6'], 1]);
});
T.test('flik: bara kända flikar', () => {
  T.eq(TABS, ['matches', 'table', 'fav', 'team', 'settings']);
  T.eq(loadTab('team'), 'team');
  T.eq(loadTab('evil'), null);
});
T.test('kortordning: okända id bort, nya kort sist, standard sparas inte', () => {
  T.eq(layoutOf({ fav: { order: ['last', 'evil', 'last'], hidden: ['recent', 'next'] } }, 'fav'), { order: ['last', 'next'], hidden: ['next'] });
  T.eq(loadLayout({ team: { order: ['last'], hidden: ['recent'] } }), { fav: { order: ['last', 'next'], hidden: [] } });   // before 2026-11-13: "team"
  T.eq(loadLayout({ matches: { order: ['today', 'next', 'last'], hidden: ['today'] }, evil: { order: [] } }), {});   // old Matcher layout dropped
});
T.test('cache v4: månadsintervall valideras, gula kort tolkas och behålls', () => {
  const c = loadCache({ leagues: { 'eng.1': { range: { from: '2026-10', to: '2026-12' } }, 'esp.1': { range: { from: '2026-12', to: '2026-10' } }, 'ita.1': { range: { from: '2026-11-04', to: '2026-11-18' } } } });
  T.eq([c.leagues['eng.1'].range, c.leagues['esp.1'].range, c.leagues['ita.1'].range], [{ from: '2026-10', to: '2026-12' }, null, null]);
  const ms = parseEvents({ events: [{ id: '2', date: '2026-11-07T15:00Z', competitions: [{ status: { type: { state: 'post' } },
    competitors: [{ homeAway: 'home', score: '0', team: { id: '1' } }, { homeAway: 'away', score: '0', team: { id: '2' } }],
    details: [{ yellowCard: true, type: { text: 'Yellow Card' }, clock: { displayValue: "30'" }, team: { id: '2' }, athletesInvolved: [{ shortName: 'G' }] },
      { redCard: true, type: { text: 'Red Card' }, clock: { displayValue: "80'" }, team: { id: '2' }, athletesInvolved: [{ shortName: 'G' }] }] }] }] }, 'eng.1');
  T.eq(ms[0].events.map((e) => e.kind), ['yellow', 'red']);
  T.eq(loadCache({ leagues: { 'eng.1': { league: ms } } }).leagues['eng.1'].league[0].events.length, 2);
  T.eq(Object.keys(loadLayout({ fav: { hidden: ['last'] } })), ['fav']);
  const s = loadSettings({ league: 'eng.1', layout: { fav: { order: ['last'] } } });
  T.eq(importText(exportText(s, '2026-11-11')).data.layout, s.layout);
});
T.test('ligor: standardväljare, ordning och dolda valideras, minst en visas', () => {
  T.eq(pickerLeagues({}), ['eng.1', 'esp.1', 'ita.1', 'uefa.champions']);
  T.eq(loadLayout({}), {});
  const all = LEAGUES.map((l) => l.id);
  T.eq(pickerLeagues({ leagues: { order: ['fifa.world', 'evil'], hidden: all.filter((id) => id !== 'fifa.world' && id !== 'swe.1') } }), ['fifa.world', 'swe.1']);
  T.eq(pickerLeagues({ leagues: { order: [], hidden: all } }).length, 1);
  T.ok(LEAGUES.every((l) => espnUrl('standings', l.id).startsWith('https://site.api.espn.com/apis/')), 'alla ligor via espnUrl');
  T.eq([national('fifa.world'), national('eng.1'), domestic('ger.1'), domestic('uefa.europa')], [true, false, true, false]);
});
T.test('ESPN-tolkning: grupptabeller får gruppnamn, en tabell får inget', () => {
  const e = (id) => ({ team: { id }, stats: [{ name: 'rank', value: 1 }] });
  const g = parseStandings({ children: [{ name: 'Group A', standings: { entries: [e('1')] } }, { name: 'Group B', standings: { entries: [e('2')] } }] });
  T.eq(g.map((r) => r.group), ['Group A', 'Group B']);
  T.eq(parseStandings({ children: [{ name: 'Bundesliga', standings: { entries: [e('3')] } }] })[0].group, null);
});
T.test('månader och all-schema: liga ur händelsen, okända tävlingar bort, hemmaliga ur /teams', () => {
  T.eq(monthAdd('2026-12', 1), '2027-01');
  T.eq(monthAdd('2026-01', -1), '2025-12');
  T.eq(monthsBetween('2026-11', '2027-01'), ['2026-11', '2026-12', '2027-01']);
  const e = (id, slug) => ({ id, date: '2026-11-07T15:00Z', league: { slug }, competitions: [{ status: { type: { state: 'pre' } },
    competitors: [{ homeAway: 'home', team: { id: '1' } }, { homeAway: 'away', team: { id: '2' } }] }] });
  T.eq(parseEvents({ events: [e('1', 'eng.1'), e('2', 'uefa.champions'), e('3', 'club.friendly'), e('4', 'eng.league_cup')] }, null).map((m) => m.leagueId), ['eng.1', 'uefa.champions']);
  T.eq(parseDefaultLeague({ team: { defaultLeague: { slug: 'esp.1' } } }), 'esp.1');
  T.eq([parseDefaultLeague({ team: { defaultLeague: { slug: 'uefa.champions' } } }), parseDefaultLeague({ team: { defaultLeague: { slug: '../x' } } }), parseDefaultLeague(null)], [null, null, null]);
});

T.test('U6: för stort ESPN-svar avvisas före JSON.parse', () => {
  T.eq(parseResponse('{"a":1}', 100), { a: 1 });
  let err = null; try { parseResponse('{"a":"' + 'x'.repeat(200) + '"}', 100); } catch (e) { err = e; }
  T.ok(err && /stort/.test(err.message), 'stort svar ger fel');
});
T.test('avspark passerad men status pre → färsk hämtning, inte 60 s-cachen', () => {
  const now = Date.parse('2026-11-11T15:00:15Z');
  T.ok(overdue([{ state: 'pre', date: '2026-11-11T15:00Z' }], now), 'avspark passerad');
  T.ok(!overdue([{ state: 'pre', date: '2026-11-11T17:00Z' }, { state: 'in', date: '2026-11-11T14:00Z' }], now), 'inget försenat');
  T.ok(!overdue(null, now), 'tom');
});
T.test('lagtema: färg ger ljus och mörk ton med kontrast ≥ 4.5 och avvisar skräp', () => {
  for (const h of ['#ef0107', '#034694', '#6cabdd', '#fde100', '#ffffff', '#000000', '#132257']) {
    const t = teamTheme(h);
    T.ok(contrast(t.light, t.lightInk) >= 4.5, h + ' ljust');
    T.ok(contrast(t.dark, t.darkInk) >= 4.5, h + ' mörkt');
    T.ok(lum(t.light) <= 0.7 && lum(t.dark) <= 0.06, h + ' toner');
  }
  T.eq(teamTheme('#034694').light, '#034694');
  T.eq(teamTheme('red;x'), null);
  T.eq(teamTheme(null), null);
});
