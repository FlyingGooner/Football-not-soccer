// UI tests in dist/football-not-soccer.html with a fake ESPN (ui-before.js). Run: tools\test.ps1 football-not-soccer
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://site.api.espn.com; img-src 'self' https://a.espncdn.com; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'";
const click = (s) => { const n = typeof s === 'string' ? T.$(s) : s; T.ok(n, `saknas: ${s}`); n.click(); };
const tab = (v) => click(`#tabbar [data-view="${v}"]`);
const settle = () => T.until(() => !busy && !again, 'refresh blev inte klar');
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
  T.ok(T.$('#next-list').textContent.includes('Pågår nu'), 'pågående match överst');
  T.ok(T.$('#next-list').textContent.includes('LIVE'), 'LIVE visas');
  T.eq(document.querySelectorAll('#last-list .lm').length, 10);
});
T.test('säkerhet: bara ESPN:s API, utan cookies och referer', () => {
  T.ok(__calls.length > 0, 'inga anrop');
  for (const c of __calls) {
    T.ok(c.url.startsWith('https://site.api.espn.com/apis/'), 'fel värd: ' + c.url);
    T.eq([c.opts.credentials, c.opts.cache, c.opts.referrerPolicy], ['omit', 'no-store', 'no-referrer']);
  }
});
T.test('säkerhet: klubbmärken från annan värd visas inte', () => {
  T.eq(document.querySelectorAll('img').length, 0);
  T.ok(document.querySelectorAll('.ph').length > 0, 'platshållare');
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
T.test('Idag-raden byggs bara av cachen: PL och LaLiga, inte Serie A', () => {
  T.eq([...document.querySelectorAll('#today [data-today]')].map((b) => b.dataset.today), ['eng.1', 'esp.1']);
  T.ok(/LaLiga \d+/.test(T.$('#today').textContent), 'antal visas');
});
T.test('Lag utan valt lag: tom vy med knapp till tabellen', () => {
  tab('team');
  T.ok(!T.$('#team-empty').hidden && T.$('#team-cards').hidden, 'tom vy');
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
  T.ok(T.$('[data-kickoff]'), 'nedräkning');
  T.eq(document.querySelectorAll('#team-next-list li').length, 2);
  T.eq(document.querySelectorAll('#team-last-list li').length, 5);
  T.eq(document.querySelectorAll('#team-table .form .dot').length, 5);
  T.ok(T.$('#team-table .more tr.me'), 'laget markerat i hela tabellen');
});
T.test('byta lag och senast följda', async () => {
  T.$('#team-table .more').open = true;
  click([...document.querySelectorAll('#team-table .more tbody tr')][2]);
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
  T.ok(!('203' in JSON.parse(localStorage.getItem('fns.cache.v3')).teams), 'cachen borttagen');
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
  T.eq(T.$('#team-table-title').textContent, 'Serie A');
});
T.test('matchdetaljer fälls ut med målskytt', async () => {
  tab('matches');
  await settle();
  const row = T.$('#last-list .lm.tap');
  click(row);
  T.ok(T.$('#last-list .evs').textContent.includes('A. Skytt'), 'målskytt');
  T.eq(row.getAttribute('aria-expanded'), 'true');
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
  __fail = true;
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
