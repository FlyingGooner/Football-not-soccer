// UI tests in dist/football-not-soccer.html with a fake ESPN (ui-before.js). Run: tools\test.ps1 football-not-soccer
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://site.api.espn.com; img-src 'self' https://a.espncdn.com; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'";
const click = (s) => { const n = typeof s === 'string' ? T.$(s) : s; T.ok(n, `saknas: ${s}`); n.click(); };
const tab = (v) => click(`#tabbar [data-view="${v}"]`);
const settle = () => T.until(() => !busy && !again && !leagueTimer, 'refresh blev inte klar');
const tableRows = () => [...document.querySelectorAll('#table-full tbody tr')];
const pickLeague = (id) => click(`#view-${view} [data-league="${id}"]`);

// The test file (dist) gets a rewritten CSP from build-single.ps1 (inline code), so only the network directives are compared.
T.test('säkerhet: CSP-nätverk bara ESPN, no-referrer', () => {
  const d = (csp) => Object.fromEntries(csp.split(';').map((s) => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  const want = d(CSP), got = d(T.$('meta[http-equiv="Content-Security-Policy"]').content);
  T.eq(got['connect-src'], want['connect-src']);
  T.eq(got['img-src'].filter((v) => v !== 'data:'), want['img-src']);
  T.eq(got['default-src'], ["'none'"]);
  T.eq(T.$('meta[name="referrer"]').content, 'no-referrer');
});
T.test('struktur: rubrik med version, meny nertill med fyra flikar', () => {
  T.eq(T.$('.brand').textContent, 'Football, not soccer');
  T.ok(T.$('#version').textContent.startsWith('v'), 'version');
  T.eq([...document.querySelectorAll('#tabbar .tab')].map((t) => t.textContent), ['⚽Matcher', '📋Tabell', '⭐Lag', '⚙️Inst.']);
});
T.test('första start: Matcher i PL, pågående överst, resultat', async () => {
  await settle();
  T.eq(view, 'matches');
  T.ok(!T.$('#view-matches').hidden && T.$('#view-table').hidden, 'bara Matcher syns');
  T.eq(T.$('#tabbar .tab.on').dataset.view, 'matches');
  T.eq(T.$('#mtabs [aria-selected="true"]').dataset.mtab, 'now', 'Aktuella när det finns pågående matcher');
  click('#mtabs [data-mtab="now"]');
  T.ok(T.$('#match-list').textContent.includes('Pågår nu'), 'pågående match överst');
  T.ok(T.$('#match-list').textContent.includes("LIVE 67'"), 'LIVE med minut');
  T.ok(T.$('#more').hidden, 'Aktuella har ingen Visa fler');
  T.ok(!T.$('#today'), 'Idag-raden borttagen');
});
T.test('Matcher: flikarna Kommande och Spelade, Visa fler', async () => {
  click('#mtabs [data-mtab="next"]');
  T.ok(!T.$('#match-list').textContent.includes('Idag'), 'Kommande har inte dagens matcher');
  T.ok(document.querySelectorAll('#match-list .lm').length >= 5, 'minst 5 rader');
  click('#mtabs [data-mtab="past"]');
  const rows = () => document.querySelectorAll('#match-list .lm').length, n = rows();
  T.ok(n >= 5 && T.$('#match-list .end').textContent === 'Slut', 'spelade med Slut');
  T.ok(!T.$('#more').hidden, 'Visa fler');
  const before = __calls.length;
  click('#more');
  await T.until(() => !loadingMore, 'Visa fler blev inte klar');
  T.ok(rows() >= n, 'inte färre rader');
  if (__calls.length > before) T.ok(/dates=\d{6}$/.test(__calls[__calls.length - 1].url), 'en månad till hämtas');
  click('#mtabs [data-mtab="now"]');
});
T.test('Matcher: ingen rubrik, svep byter flik', () => {
  T.ok(!T.$('#card-matches h2'), 'ingen rubrik Matcher');
  const sel = () => T.$('#mtabs [aria-selected="true"]').dataset.mtab;
  const card = T.$('#card-matches');
  const swipe = (x0, x1, y1 = 100) => {
    const t = (x, y) => new Touch({ identifier: 1, target: card, clientX: x, clientY: y });
    card.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x0, 100)], changedTouches: [t(x0, 100)] }));
    card.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x1, y1)] }));
  };
  swipe(300, 100);
  T.eq(sel(), 'next');
  swipe(300, 100);
  T.eq(sel(), 'past');
  swipe(300, 100);
  T.eq(sel(), 'past', 'sista fliken');
  swipe(100, 300, 400);
  T.eq(sel(), 'past', 'lodrätt svep ignoreras');
  swipe(100, 300);
  swipe(100, 300);
  T.eq(sel(), 'now');
});
T.test('cache: ingen ny hämtning av tabell eller intervall vid flikbyte', async () => {
  const before = __calls.length;
  tab('table');
  await settle();
  tab('matches');
  await settle();
  const urls = __calls.slice(before).map((c) => c.url);
  T.ok(!urls.some((u) => u.includes('standings')), 'tabellen hämtas inte igen: ' + urls.join());
  T.ok(urls.every((u) => !u.includes('dates=')), 'bara dagens scoreboard (pågående match)');
});
T.test('säkerhet: bara ESPN:s API, utan cookies och referer, med tidsgräns', () => {
  T.ok(__calls.length > 0, 'inga anrop');
  for (const c of __calls) {
    T.ok(c.url.startsWith('https://site.api.espn.com/apis/'), 'fel värd: ' + c.url);
    T.eq([c.opts.credentials, c.opts.cache, c.opts.referrerPolicy], ['omit', 'no-store', 'no-referrer']);
    T.ok(c.opts.signal instanceof AbortSignal, 'tidsgräns saknas: ' + c.url);
  }
});
T.test('säkerhet: klubbmärken från annan värd visas inte', () => {
  T.eq(document.querySelectorAll('img').length, 0);
  T.ok(document.querySelectorAll('.ph').length > 0, 'platshållare');
});
T.test('ligor: standard fyra i väljaren, VM väljs under Inställningar och visar grupper, svep byter liga', async () => {
  const picker = () => [...T.$('#view-table .league-picker').children].map((b) => b.dataset.league);
  T.eq(picker(), ['eng.1', 'esp.1', 'ita.1', 'uefa.champions']);
  tab('settings');
  click(T.$('.lay-list[data-view="leagues"] [aria-label="Visa VM"]'));
  T.eq(JSON.parse(localStorage.getItem('fns.layout.v1')).leagues.hidden.includes('fifa.world'), false);
  tab('table');
  await settle();
  T.eq(picker(), ['eng.1', 'esp.1', 'ita.1', 'uefa.champions', 'fifa.world']);
  pickLeague('fifa.world');
  await settle();
  T.eq([...document.querySelectorAll('#table-full .grp')].map((h) => h.textContent), ['Group A', 'Group B']);
  T.eq(document.querySelectorAll('#table-full tbody tr').length, 8);
  const card = T.$('#view-table');
  const swipe = (x0, x1) => {
    const t = (x) => new Touch({ identifier: 1, target: card, clientX: x, clientY: 100 });
    card.dispatchEvent(new TouchEvent('touchstart', { touches: [t(x0)], changedTouches: [t(x0)] }));
    card.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [t(x1)] }));
  };
  swipe(100, 300);
  T.eq(league, 'uefa.champions');
  await settle();
  swipe(300, 100);
  T.eq(league, 'fifa.world');
  await settle();
  tab('settings');
  click('[data-reset="leagues"]');
  T.eq(league, 'eng.1', 'dold liga → första synliga');
  await settle();
  T.eq(picker(), ['eng.1', 'esp.1', 'ita.1', 'uefa.champions']);
});
T.test('Tabell: hela tabellen med zoner', async () => {
  tab('table');
  await settle();
  T.eq(location.hash, '#table');
  T.eq(T.$('#table-title').textContent, 'Premier League');
  T.eq(tableRows().length, 20);
  T.ok(tableRows()[0].classList.contains('zone-cl') && tableRows()[19].classList.contains('zone-rel'), 'zoner');
});
T.test('ligaväljare: LaLiga sparas och visas på båda flikarna', async () => {
  pickLeague('esp.1');
  await settle();
  T.eq(T.$('#table-title').textContent, 'LaLiga');
  T.eq(localStorage.getItem('fns.league.v1'), '"esp.1"');
  T.eq([...document.querySelectorAll('[data-league="esp.1"]')].map((b) => b.getAttribute('aria-pressed')), ['true', 'true']);
  tab('matches');
  await settle();
});
T.test('säkerhet: data från källan renderas som text, aldrig HTML', () => {
  T.ok(T.$('#table-full').textContent.includes('<img src=x onerror=alert(1)>'), 'namnet visas som text');
  T.eq(document.querySelectorAll('img[src="x"]').length, 0);
});
T.test('Lag utan valt lag: tom vy med knapp till tabellen', () => {
  tab('team');
  T.ok(!T.$('#team-empty').hidden && T.$('#arr-team [data-card="next"]').hidden, 'tom vy');
  click('#team-pick');
  T.eq(view, 'table');
});
T.test('följa lag: dialog → fliken Lag, lagets liga och senast följda sparas', async () => {
  await settle();
  click(tableRows()[1]);
  T.ok(T.$('#pick').open, 'dialogen öppnas');
  T.ok(T.$('#pick-text').textContent.includes('Följ Esp 2'), T.$('#pick-text').textContent);
  click('#pick-ok');
  await settle();
  T.eq(view, 'team');
  T.eq(T.$('#teambar-name').textContent, 'Esp 2');
  T.eq(JSON.parse(localStorage.getItem('fns.team.v2')).leagueId, 'esp.1');
  T.eq(JSON.parse(localStorage.getItem('fns.recent.v1')).map((t) => t.id), ['202']);
  T.ok(T.$('[data-kickoff]') || T.$('#view-team').textContent.includes('LIVE'), 'nedräkning eller live (ligans pågående match syns i Lag)');
  T.eq(document.querySelectorAll('#team-next-list li').length, 3, 'lika många som Senaste match');
  T.eq(document.querySelectorAll('#team-last-list li').length, 3);
  T.eq(document.querySelectorAll('#team-form .dot').length, 5);
  T.ok(!T.$('#view-team table'), 'ingen tabell under Lag');
  click('#team-last-list [data-more]');
  T.eq(document.querySelectorAll('#team-last-list li').length, 5);
  click('#team-last-list [data-more]');
});
T.test('byta lag och senast följda', async () => {
  tab('table');
  await settle();
  click(tableRows()[2]);
  T.eq(T.$('#pick-ok').textContent, 'Byt');
  click('#pick-ok');
  await settle();
  T.eq(T.$('#teambar-name').textContent, 'Esp 3');
  T.eq([...document.querySelectorAll('#recent .rchip')].map((b) => b.textContent), ['Esp 2']);
  click('#recent .rchip');
  await settle();
  T.eq(T.$('#teambar-name').textContent, 'Esp 2');
  T.eq(JSON.parse(localStorage.getItem('fns.recent.v1')).map((t) => t.id), ['202', '203']);
});
T.test('Inst.: grupper, ta bort ur senast följda tar bort lagets cache', () => {
  tab('settings');
  T.eq(T.$('#hint-team').textContent, 'Esp 2');
  T.eq(T.$('#hint-recent').textContent, '2 av 5');
  click(document.querySelectorAll('#recent-list .rdel')[1]);
  T.eq(JSON.parse(localStorage.getItem('fns.recent.v1')).map((t) => t.id), ['202']);
  T.ok(!('203' in JSON.parse(localStorage.getItem('fns.cache.v4')).teams), 'cachen borttagen');
  T.ok(T.$('#foot').textContent.includes('v' + self.APP_VERSION), 'version i foten');
});
T.test('fliken sparas och appen öppnas på den', () => {
  T.eq(localStorage.getItem('fns.tab.v1'), '"settings"');
});
T.test('✕ slutar följa laget', () => {
  tab('team');
  click('#teambar-close');
  T.eq(localStorage.getItem('fns.team.v2'), null);
  T.ok(!T.$('#team-empty').hidden, 'tom vy');
});
T.test('CL: lag får sin inhemska liga', async () => {
  tab('table');
  await settle();
  pickLeague('uefa.champions');
  await settle();
  T.eq(T.$('#table-title').textContent, 'Champions League');
  click(tableRows()[3]);   // Ita 1
  click('#pick-ok');
  await T.until(() => JSON.parse(localStorage.getItem('fns.team.v2')).leagueId === 'ita.1', 'inhemsk liga hittades inte');
  await T.wait(50);
  await settle();
  T.ok(T.$('#teambar-name').textContent === 'Ita 1' && document.querySelectorAll('#team-form .dot').length > 0, 'form i lagraden');
});
T.test('matchdetaljer fälls ut med målskytt', async () => {
  tab('matches');
  await settle();
  click('#mtabs [data-mtab="past"]');
  const row = T.$('#match-list .lm.tap');
  click(row);
  T.ok(T.$('#match-list .evs').textContent.includes('A. Skytt'), 'målskytt');
  T.ok(T.$('#match-list .evs').textContent.includes('🟨'), 'gult kort');
  T.eq(row.getAttribute('aria-expanded'), 'true');
});
T.test('matchdetaljer: andra gula visas 🟨🟥, live-tid med tilläggstid och HT', () => {
  const m = { home: { id: '1' }, away: { id: '2' }, events: [{ kind: 'yellow', min: "20'", name: 'X', teamId: '1' }, { kind: 'red', min: "70'", name: 'X', teamId: '1' }, { kind: 'red', min: "80'", name: 'Y', teamId: '2' }] };
  const t = [...eventsView(m).querySelectorAll('.ev')].map((n) => n.textContent);
  T.eq(t, ["20'🟨 X", "70'🟨🟥 X", "80'🟥 Y"]);
  T.eq(liveText({ clock: "45'+3'", detail: '' }), "LIVE 45'+3");
  T.eq(liveText({ clock: "45'", detail: 'HT' }), 'HT');
});
T.test('export: bara inställningar, ingen matchdata', () => {
  const t = exportText(settings(), '2026-11-11');
  T.ok(!t.includes('matches') && !t.includes('homeScore'), 'ingen matchdata');
  T.eq(JSON.parse(t).data.recent.length, 2);
});
T.test('import: dialog, ersätt och ångra', async () => {
  tab('settings');
  const text = JSON.stringify({ app: 'football-not-soccer', format: 1, exported: '2026-11-01', data: { league: 'eng.1', team: { id: '105', name: 'Eng 5', leagueId: 'eng.1' } } });
  T.$('#import-text').value = text;
  click('#import-btn');
  await T.until(() => T.$('#import-dialog').open, 'importdialog');
  T.ok(T.$('#imp-sum').textContent.includes('Eng 5'), T.$('#imp-sum').textContent);
  click('#imp-ok');
  T.$('#import-dialog').close();
  T.eq(T.$('#hint-team').textContent, 'Eng 5');
  click('#snack-action');   // Ångra
  T.eq(JSON.parse(localStorage.getItem('fns.team.v2')).id, '301');
});
T.test('offline: sparad data och felmeddelande, aldrig blank skärm', async () => {
  tab('table');
  await settle();
  __fail = true; recentUrls.clear();   // otherwise the answer from under a minute ago is reused
  refresh();
  await settle();
  T.ok(T.$('#status').classList.contains('error'), 'statusraden visar fel');
  T.ok(tableRows().length > 0, 'sparad tabell visas');
  __fail = false;
});
T.test('radera all data: alla fns.*-nycklar, andra appars nycklar kvar', () => {
  tab('settings');
  localStorage.setItem('bb.data', '1');
  click('#reset');
  click('#cd-ok');
  T.$('#confirm-dialog').close();
  T.eq(Object.keys(localStorage).filter((k) => k.startsWith('fns.')), []);
  T.eq(localStorage.getItem('bb.data'), '1');
  T.eq(T.$('#hint-team').textContent, 'Inget lag');
});
T.test('kortordning: flytta och dölja kort, sparas och återställs', async () => {
  tab('settings');
  T.ok(!T.$('.lay-list[data-view="matches"]'), 'Matcher har bara ett kort, ingen lista');
  const list = () => [...document.querySelectorAll('.lay-list[data-view="team"] li .row-name')].map((n) => n.textContent);
  T.eq(list(), ['Nästa match', 'Senaste match', 'Senast följda lag']);
  click(T.$('.lay-list[data-view="team"] [aria-label="Flytta upp Senaste match"]'));
  T.eq(list(), ['Senaste match', 'Nästa match', 'Senast följda lag']);
  click(T.$('.lay-list[data-view="team"] [aria-label="Dölj Senast följda lag"]'));
  T.eq(JSON.parse(localStorage.getItem('fns.layout.v1')).team, { order: ['last', 'next', 'recent'], hidden: ['recent'] });
  T.eq(T.$('#hint-layout').textContent, 'Egen');
  T.eq([...T.$('#arr-team').children].map((n) => n.dataset.card), ['last', 'next', 'recent']);
  click('[data-reset="team"]');
  T.eq(localStorage.getItem('fns.layout.v1'), null);
  T.eq([...T.$('#arr-team').children].map((n) => n.dataset.card), ['next', 'last', 'recent']);
});
T.test('byte av vy: Matcher öppnas på Kommande, utfällda matcher återställs', async () => {
  tab('matches');
  await settle();
  click('#mtabs [data-mtab="past"]');
  click('#match-list .lm.tap');
  T.ok(T.$('#match-list .evs'), 'utfälld');
  tab('table');
  tab('matches');
  await settle();
  T.eq(T.$('#mtabs [aria-selected="true"]').dataset.mtab, 'now');
  click('#mtabs [data-mtab="past"]');
  T.ok(!T.$('#match-list .evs'), 'ihopfälld igen');
});
T.test('Matcher utan matcher i dag öppnas på Kommande', () => {
  const e = L(league), saved = e.league;
  e.league = saved.filter((m) => m.state === 'pre' && new Date(m.date) - Date.now() > 2 * 864e5);
  mtab = null;
  renderLeagueMatches();
  T.eq(T.$('#mtabs [aria-selected="true"]').dataset.mtab, 'next');
  e.league = saved;
  renderLeagueMatches();
});
T.test('anrop: ligor per månad (3 parallellt), inga lagscheman per lag, CL har kommande', async () => {
  tab('matches');
  await settle();
  const before = __calls.length;
  pickLeague('uefa.champions');
  await settle();
  const urls = __calls.slice(before).map((c) => c.url);
  T.ok(!urls.some((u) => /\/teams\//.test(u)), 'inga lagscheman: ' + urls.join());
  T.ok(urls.every((u) => !u.includes('dates=') || /dates=\d{6}$/.test(u)), 'bara månader');
  click('#mtabs [data-mtab="next"]');
  T.ok(document.querySelectorAll('#match-list .lm').length > 0, 'CL: kommande matcher');
});
T.test('anrop: snabbt ligabyte hämtar bara sista ligan, samma URL högst en gång per minut', async () => {
  const before = __calls.length;
  pickLeague('eng.1'); pickLeague('esp.1'); pickLeague('ita.1');
  await settle();
  const urls = __calls.slice(before).map((c) => c.url);
  T.ok(!urls.some((u) => u.includes('/esp.1/')), 'passerad liga hämtas inte: ' + urls.join());
  T.eq(new Set(urls).size, urls.length, 'ingen URL två gånger');
});
T.test('Lag: all-schema (2 anrop), vänskapsmatcher bort, live var 20:e sekund', async () => {
  T.eq(CONFIG.livePollMs, 20000);
  T.ok(/^Uppdaterad (\S.* )?\d{2}[:.]\d{2}/.test(T.$('#status').textContent), 'kort statusrad: ' + T.$('#status').textContent);
  const urls = __calls.map((c) => c.url).filter((u) => u.includes('/teams/'));
  T.ok(urls.length > 0 && urls.every((u) => /soccer\/all\/teams\/\d+\/schedule/.test(u) || /soccer\/[a-z.]+\/teams\/\d+$/.test(u)), urls.join());
  T.ok(Object.values(cache.teams).every((t) => t.matches.every((m) => m.leagueId !== 'club.friendly' && m.id !== '1')), 'vänskapsmatch borttagen');
});

T.test('lag-hero visar bara mål; vyn spränger inte bredden', () => {
  const m = { home: { id: '1' }, away: { id: '2' }, events: [{ kind: 'goal', min: "10'", name: 'G', teamId: '1' }, { kind: 'yellow', min: "20'", name: 'Y', teamId: '2' }] };
  T.eq(eventsView(m, true).querySelectorAll('.ev').length, 1);
  T.eq(getComputedStyle(T.$('#view-matches')).gridTemplateColumns.split(' ').length, 1);
});
