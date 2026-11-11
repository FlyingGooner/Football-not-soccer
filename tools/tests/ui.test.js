// UI tests in dist/football-not-soccer.html with a fake ESPN (ui-before.js). Run: tools\test.ps1 football-not-soccer
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src https://site.api.espn.com; img-src 'self' https://a.espncdn.com; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'";
const rows = () => [...document.querySelectorAll('#table-summary tbody tr')];
const click = (s) => { const n = typeof s === 'string' ? T.$(s) : s; T.ok(n, `saknas: ${s}`); n.click(); };
const settle = () => T.until(() => !busy && !again, 'refresh blev inte klar');

// The test file (dist) gets a rewritten CSP from build-single.ps1 (inline code), so only the network directives are compared.
T.test('säkerhet: CSP-nätverk bara ESPN, no-referrer', () => {
  const d = (csp) => Object.fromEntries(csp.split(';').map((s) => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v]));
  const want = d(CSP), got = d(T.$('meta[http-equiv="Content-Security-Policy"]').content);
  T.eq(got['connect-src'], want['connect-src']);
  T.eq(got['img-src'].filter((v) => v !== 'data:'), want['img-src']);
  T.eq(got['default-src'], ["'none'"]);
  T.eq(T.$('meta[name="referrer"]').content, 'no-referrer');
});
T.test('första start: ligaläge PL, topp 3 synliga, aktuella matcher och resultat', async () => {
  await settle();
  T.eq(T.$('#table-title').textContent, 'Premier League');
  T.eq(rows().filter((r) => getComputedStyle(r).display !== 'none').length, 3);
  T.eq(T.$('#next-title').textContent, 'Aktuella matcher');
  T.ok(T.$('#next-summary').textContent.includes('Pågår nu'), 'pågående match överst');
  T.ok(T.$('#next-summary').textContent.includes('LIVE'), 'LIVE visas');
  T.eq(document.querySelectorAll('#last-summary .lm').length, 2);
  T.ok(T.$('#teambar').offsetParent === null, 'inget lag valt');
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
T.test('ligaväljare: LaLiga sparas och visas', async () => {
  click('[data-league="esp.1"]');
  await settle();
  T.eq(T.$('#table-title').textContent, 'LaLiga');
  T.eq(localStorage.getItem('fns.league.v1'), '"esp.1"');
  T.eq(T.$('[data-league="esp.1"]').getAttribute('aria-pressed'), 'true');
});
T.test('säkerhet: data från källan renderas som text, aldrig HTML', () => {
  T.ok(T.$('#table-full').textContent.includes('<img src=x onerror=alert(1)>') || T.$('#table-summary').textContent.includes('<img'), 'namnet visas som text');
  T.eq(document.querySelectorAll('img[src="x"]').length, 0);
});
T.test('Idag-raden byggs bara av cachen: PL och LaLiga, inte Serie A', () => {
  const t = [...document.querySelectorAll('#today [data-today]')].map((b) => b.dataset.today);
  T.eq(t, ['eng.1', 'esp.1']);
  T.ok(/LaLiga \d+/.test(T.$('#today').textContent), 'antal visas');
});
T.test('följa lag: dialog → lagläge, lagets liga och senast följda sparas', async () => {
  click(rows()[1]);
  T.ok(T.$('#pick').open, 'dialogen öppnas');
  T.ok(T.$('#pick-text').textContent.includes('Följ Esp 2'), T.$('#pick-text').textContent);
  click('#pick-ok');
  await settle();
  T.eq(T.$('#teambar-name').textContent, 'Esp 2');
  T.eq(JSON.parse(localStorage.getItem('fns.team.v2')).leagueId, 'esp.1');
  T.eq(JSON.parse(localStorage.getItem('fns.recent.v1')).map((t) => t.id), ['202']);
  T.eq(T.$('#next-title').textContent, 'Nästa match');
  T.ok(T.$('[data-kickoff]'), 'nedräkning');
  T.eq(document.querySelectorAll('.form .dot').length, 5);
  T.ok(T.$('#leaguebar').hidden, 'ligaväljaren dold i lagläge');
});
T.test('byta lag: hela tabellen, laget markerat, senast följda-raden', async () => {
  click('[data-acc="table"]');
  T.ok(T.$('#table-full tr.me'), 'laget markerat');
  click([...document.querySelectorAll('#table-full tbody tr')][2]);
  T.eq(T.$('#pick-ok').textContent, 'Byt');
  click('#pick-ok');
  await settle();
  T.eq(T.$('#teambar-name').textContent, 'Esp 3');
  T.eq([...document.querySelectorAll('#recent .rpick')].map((b) => b.textContent), ['Esp 2']);
  click('#recent .rpick');
  await settle();
  T.eq(T.$('#teambar-name').textContent, 'Esp 2');
  T.eq(JSON.parse(localStorage.getItem('fns.recent.v1')).map((t) => t.id), ['202', '203']);
});
T.test('ta bort ur senast följda tar bort lagets cache', () => {
  click('#recent .rdel');
  T.eq(JSON.parse(localStorage.getItem('fns.recent.v1')).map((t) => t.id), ['202']);
  T.ok(!('203' in JSON.parse(localStorage.getItem('fns.cache.v3')).teams), 'cachen borttagen');
});
T.test('✕ tillbaka till ligaläge, ligan kvar', async () => {
  click('#teambar-close');
  await settle();
  T.eq(localStorage.getItem('fns.team.v2'), null);
  T.eq(T.$('#table-title').textContent, 'LaLiga');
});
T.test('CL: lag får sin inhemska liga', async () => {
  click('[data-league="uefa.champions"]');
  await settle();
  T.eq(T.$('#table-title').textContent, 'Champions League');
  click(rows()[3]);   // Ita 1
  click('#pick-ok');
  await T.until(() => JSON.parse(localStorage.getItem('fns.team.v2')).leagueId === 'ita.1', 'inhemsk liga hittades inte');
  await T.wait(50);
  await settle();
  T.eq(T.$('#table-title').textContent, 'Serie A');
  click('#teambar-close');
  await settle();
});
T.test('matchdetaljer fälls ut med målskytt', () => {
  const row = T.$('#last-summary .lm.tap');
  click(row);
  T.ok(T.$('#last-summary .evs').textContent.includes('A. Skytt'), 'målskytt');
  T.eq(row.getAttribute('aria-expanded'), 'true');
});
T.test('export: bara inställningar, ingen matchdata', () => {
  const t = exportText(settings(), '2026-11-11');
  T.ok(!t.includes('matches') && !t.includes('homeScore'), 'ingen matchdata');
  T.eq(JSON.parse(t).data.recent.length, 2);
});
T.test('import: dialog, ersätt och ångra', async () => {
  const text = JSON.stringify({ app: 'football-not-soccer', format: 1, exported: '2026-11-01', data: { league: 'eng.1', team: { id: '105', name: 'Eng 5', leagueId: 'eng.1' } } });
  T.$('#import-text').value = text;
  click('#import-btn');
  await T.until(() => T.$('#import-dialog').open, 'importdialog');
  T.ok(T.$('#imp-sum').textContent.includes('Eng 5'), T.$('#imp-sum').textContent);
  click('#imp-ok');
  T.$('#import-dialog').close();
  await settle();
  T.eq(T.$('#teambar-name').textContent, 'Eng 5');
  click('#snack-action');   // Ångra
  await settle();
  T.eq(localStorage.getItem('fns.team.v2'), null);
});
T.test('offline: sparad data och felmeddelande, aldrig blank skärm', async () => {
  __fail = true;
  refresh();
  await settle();
  T.ok(T.$('#status').classList.contains('offline'), 'statusraden visar fel');
  T.ok(rows().length > 0, 'sparad tabell visas');
  __fail = false;
});
T.test('radera all data: alla fns.*-nycklar, andra appars nycklar kvar', async () => {
  localStorage.setItem('bb.data', '1');
  click('#reset');
  click('#cd-ok');
  T.$('#confirm-dialog').close();
  T.eq(Object.keys(localStorage).filter((k) => k.startsWith('fns.')).filter((k) => k !== 'fns.cache.v3'), []);
  T.eq(localStorage.getItem('bb.data'), '1');
  await settle();
  T.eq(T.$('#table-title').textContent, 'Premier League');
});
