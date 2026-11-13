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
  T.eq([...document.querySelectorAll('#tabbar .tab')].map((t) => t.textContent), ['⚽Matcher', '📋Tabell', '☆Favorit', '⭐Följer', '⚙️Inst.']);
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
const follows = () => (JSON.parse(localStorage.getItem('fns.teams.v1')) || { follow: [] }).follow.map((t) => t.id);
const favorite = () => (JSON.parse(localStorage.getItem('fns.teams.v1')) || {}).favorite ?? null;
const realRows = (sel) => document.querySelectorAll(`${sel} li:not(.lmx)`).length;
T.test('utan lag: Favorit och Lag tomma, Välj lag öppnar lagväljaren, ← tillbaka', () => {
  tab('fav');
  T.ok(!T.$('#team-empty').hidden && T.$('#arr-fav [data-card="next"]').hidden, 'tom favoritvy');
  tab('team');
  T.ok(!T.$('#lag-empty').hidden, 'tom lagvy');
  click('#lag-empty [data-open-pick]');
  T.eq(view, 'pick');
  T.eq(document.querySelectorAll('#pick-list .pick-l').length, LEAGUES.filter((l) => l.kind === 'league').length, 'bara ligor');
  click('#pick-back');
  T.eq(view, 'team');
});
T.test('Tabell: tryck visar laget som Favorit-vyn, + följer där, egen färg', async () => {
  tab('table');
  await settle();
  click(tableRows()[1]);
  T.eq(view, 'fav');
  T.eq(T.$('#teambar-name').textContent, 'Esp 2');
  T.eq(follows(), [], 'tryck följer inte');
  T.eq(T.$('#tab-fav-name').textContent, 'Favorit', 'mittknappen visar fortfarande favoriten');
  T.eq(T.$('#tabbar .on').dataset.view, 'table', 'Tabell förblir markerad');
  click('#teambar-fol');
  T.eq(follows(), ['202']);
  T.eq(favorite(), null);
  T.eq(T.$('#teambar-fol').textContent, '✓');
  click('#teambar-fol');
  T.eq(follows(), [], '✓ slutar följa, laget visas kvar');
  T.eq(T.$('#teambar-name').textContent, 'Esp 2');
  click('#teambar-fol');
  tab('fav');
  T.ok(T.$('#team-empty').hidden === false, 'mittknappen: favoriten (ingen vald)');
  tab('table');
  await settle();
  T.ok(tableRows()[1].classList.contains('me') && tableRows()[1].style.getPropertyValue('--tc') === '#3366cc', 'markerad med lagets färg');
  click(tableRows()[2]); click('#teambar-fol');
  T.eq(follows(), ['202', '203']);
  tab('table');
});
T.test('lagväljaren: liga fälls ut, ☆ favorit (ersätter, gamla följs), + följer, högst 8', async () => {
  tab('team');
  click('#lag-chips .add');
  T.eq(view, 'pick');
  click('[data-pick-league="eng.1"]');
  await T.until(() => T.$('#pick-list [data-team="101"]'), 'lagen i PL');
  const btn = (id, c) => T.$(`#pick-list [data-team="${id}"] .${c}`);
  click(btn('101', 'pk-fav'));
  T.eq([favorite(), follows()], ['101', ['202', '203', '101']]);
  click(btn('102', 'pk-fav'));
  T.eq([favorite(), follows()], ['102', ['202', '203', '101', '102']]);
  for (const id of ['103', '104', '105', '106']) click(btn(id, 'pk-fol'));
  T.eq(follows().length, 8);
  click(btn('107', 'pk-fol'));
  T.eq(follows().length, 8, 'det 9:e följs inte');
  T.ok(T.$('#snack-text').textContent.includes('högst 8'), T.$('#snack-text').textContent);
  click(btn('106', 'pk-fol'));
  T.eq(follows().length, 7);
  T.eq(T.$('#pick-count').textContent, '7 av 8 följda');
});
T.test('Favorit: mittknappen visar laget, form, listor, spelad match → mål via summary (inga kort)', async () => {
  tab('fav');
  await settle();
  T.eq(T.$('#tab-fav-name').textContent, 'Eng 2');
  T.eq(T.$('#teambar-name').textContent, 'Eng 2');
  T.eq(document.querySelectorAll('#team-form .dot').length, 5);
  T.eq(realRows('#team-last-list'), 3);
  T.ok(!T.$('#view-fav table') && !T.$('#team-last .evs'), 'ingen tabell, inga mål innan tryck');
  const m = T.$('#team-last .hero');
  click(m);
  await T.until(() => ((T.$('#team-last .evs') || {}).textContent || '').includes('S. Summary'), 'mål från summary');
  T.ok(!T.$('#team-last .evs').textContent.includes('🟨'), 'spelad match: bara mål');
  T.ok(__calls.some((c) => /\/eng\.1\/summary\?event=\d+$/.test(c.url)), 'summary-anrop');
  T.eq(Object.keys(JSON.parse(localStorage.getItem('fns.goals.v1'))).length, 1);
  const n = __calls.length;
  click(m); click(m);
  T.eq(__calls.length, n, 'sparade mål hämtas inte igen');
});
T.test('Lag: märkesrad, favoriten först, filter, pågående match, Kommande/Spelad fälls ut', async () => {
  tab('team');
  await settle();
  const cards = () => [...document.querySelectorAll('#lag-cards .card.lag')].map((c) => c.dataset.team);
  T.eq(cards()[0], '102');
  T.eq(cards().length, 7);
  T.eq(document.querySelectorAll('#lag-chips .lchip').length, 9, 'Alla + 7 + [+]');
  T.ok(!T.$('#lag-live').hidden && T.$('#lag-live-list .lm'), 'pågående match');
  click('#lag-chips [data-chip="202"]');
  T.eq(cards(), ['202']);
  T.ok(['next', 'past'].every((k) => T.$(`[data-lag="202:${k}"]`).getAttribute('aria-expanded') === 'true') && realRows('#lag-cards') >= 5,
    'ett valt lag: båda listorna utfällda och fyller skärmen: ' + realRows('#lag-cards'));
  click('#lag-chips [data-chip="202"]');
  T.eq(cards().length, 7);
  click('[data-lag="102:past"]');
  const sel = '#lag-cards [data-team="102"]';
  const k = realRows(sel);
  T.ok(k > 0 && k <= 5, 'högst 5: ' + k);
  click('[data-lag="102:past"]');
  T.eq(realRows(sel), 0);
  click('#lag-cards [data-team="202"] .lag-open');
  T.eq(view, 'fav');
  T.eq(T.$('#teambar-name').textContent, 'Esp 2', 'lagnamnet öppnar lagets vy');
  T.eq(T.$('#teambar-fol').textContent, '✓');
  tab('team');
});
T.test('Inst.: följda lag, ★ byter favorit, ✕ slutar följa och tar bort cachen', () => {
  tab('settings');
  T.eq(T.$('#hint-team').textContent, 'Eng 2');
  T.eq(T.$('#hint-follow').textContent, '7 av 8');
  click(document.querySelectorAll('#follow-list .rfav')[0]);   // Esp 2
  T.eq(favorite(), '202');
  click(document.querySelectorAll('#follow-list .rdel')[0]);
  T.eq([favorite(), follows().includes('202')], [null, false]);
  T.ok(!('202' in JSON.parse(localStorage.getItem('fns.cache.v4')).teams), 'cachen borttagen');
  T.eq(T.$('#tab-fav-name').textContent, 'Favorit');
  T.ok(T.$('#foot').textContent.includes('v' + self.APP_VERSION), 'version i foten');
});
T.test('fliken sparas och appen öppnas på den', () => {
  T.eq(localStorage.getItem('fns.tab.v1'), '"settings"');
});
T.test('CL: lag får sin inhemska liga', async () => {
  tab('table');
  await settle();
  pickLeague('uefa.champions');
  await settle();
  T.eq(T.$('#table-title').textContent, 'Champions League');
  click(tableRows()[3]);   // Ita 1 → Favorit-vyn, + följer
  click('#teambar-fol');
  await T.until(() => (JSON.parse(localStorage.getItem('fns.teams.v1')).follow.find((t) => t.id === '301') || {}).leagueId === 'ita.1', 'inhemsk liga hittades inte');
});
T.test('matchdetaljer: spelad visar bara mål, pågående även kort', async () => {
  tab('matches');
  await settle();
  click('#mtabs [data-mtab="past"]');
  const row = T.$('#match-list .lm.tap');
  click(row);
  T.ok(T.$('#match-list .evs').textContent.includes('A. Skytt'), 'målskytt');
  T.ok(!T.$('#match-list .evs').textContent.includes('🟨'), 'inget kort');
  T.eq(row.getAttribute('aria-expanded'), 'true');
  click('#mtabs [data-mtab="now"]');
  click(T.$('#match-list .lm.tap'));
  T.ok(T.$('#match-list .evs').textContent.includes('🟨'), 'gult kort i pågående');
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
  T.eq(JSON.parse(t).data.teams.follow.length, 7);
});
T.test('import: dialog, ersätt och ångra', async () => {
  tab('settings');
  const text = JSON.stringify({ app: 'football-not-soccer', format: 1, exported: '2026-11-01', data: { league: 'eng.1', teams: { favorite: '105', follow: [{ id: '105', name: 'Eng 5', leagueId: 'eng.1' }] } } });
  T.$('#import-text').value = text;
  click('#import-btn');
  await T.until(() => T.$('#import-dialog').open, 'importdialog');
  T.ok(T.$('#imp-sum').textContent.includes('Favorit: Eng 5'), T.$('#imp-sum').textContent);
  click('#imp-ok');
  T.$('#import-dialog').close();
  T.eq(T.$('#hint-team').textContent, 'Eng 5');
  click('#snack-action');   // Ångra
  T.ok(follows().includes('301') && favorite() === null, 'återställt');
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
  T.eq(T.$('#hint-team').textContent, 'Inga lag');
});
T.test('kortordning: flytta och dölja kort, sparas och återställs', async () => {
  tab('settings');
  T.ok(!T.$('.lay-list[data-view="matches"]'), 'Matcher har bara ett kort, ingen lista');
  const list = () => [...document.querySelectorAll('.lay-list[data-view="fav"] li .row-name')].map((n) => n.textContent);
  T.eq(list(), ['Nästa match', 'Senaste match']);
  click(T.$('.lay-list[data-view="fav"] [aria-label="Flytta upp Senaste match"]'));
  T.eq(list(), ['Senaste match', 'Nästa match']);
  click(T.$('.lay-list[data-view="fav"] [aria-label="Dölj Nästa match"]'));
  T.eq(JSON.parse(localStorage.getItem('fns.layout.v1')).fav, { order: ['last', 'next'], hidden: ['next'] });
  T.eq(T.$('#hint-layout').textContent, 'Egen');
  T.eq([...T.$('#arr-fav').children].map((n) => n.dataset.card), ['last', 'next']);
  click('[data-reset="fav"]');
  T.eq(localStorage.getItem('fns.layout.v1'), null);
  T.eq([...T.$('#arr-fav').children].map((n) => n.dataset.card), ['next', 'last']);
});
T.test('lagnamn i matchrad öppnar lagets vy, fäller inte ut matchen', async () => {
  tab('matches');
  await settle();
  const n = T.$('#view-matches .lm .tlink');
  T.ok(n, 'tryckbart lagnamn i matchrad');
  const name = n.textContent, row = n.closest('.lm');
  click(n);
  T.eq(view, 'fav');
  T.eq(T.$('#teambar-name').textContent, name);
  T.ok(row.getAttribute('aria-expanded') !== 'true', 'matchen fälldes inte ut');
  tab('matches');
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

T.test('Lösenordsgenerator: fyller båda fälten, Kopiera bara för genererat lösenord (U5)', async () => {
  const $id = (id) => document.getElementById(id);
  const done = Backup.askPassword('export');
  T.ok($id('pw-copy').disabled && $id('pw-user').autocomplete === 'username', 'Kopiera avstängd före generering');
  $id('pw-gen').click();
  const pwd = $id('pw-1').value;
  T.ok(/^([A-Za-z2-9]{4}-){3}[A-Za-z2-9]{4}$/.test(pwd) && pwd === $id('pw-2').value && $id('pw-show').checked, 'båda fälten ifyllda och synliga');
  T.ok(!$id('pw-preview').hidden && !$id('pw-copy').hidden && !$id('pw-copy').disabled, 'förhandsvisning och Kopiera');
  $id('pw-1').value += 'x'; $id('pw-1').dispatchEvent(new Event('input'));
  T.ok($id('pw-copy').disabled, 'Kopiera av när lösenordet ändras för hand');
  $id('pw-cancel').click();
  T.eq(await done, null);
  T.eq([$id('pw-1').value, $id('pw-preview').children.length], ['', 0], 'fält och förhandsvisning töms');
});
