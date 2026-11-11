// Runs before the app in the UI tests (tools/test.ps1): a fake fetch with ESPN-shaped data, so tests never use the net.
// Every call is recorded in self.__calls ({ url, opts }) for the security tests.
(() => {
  const P = { 'eng.1': 100, 'esp.1': 200, 'ita.1': 300 };
  const day = 864e5, now = Date.now();
  self.__calls = [];
  self.__fail = false;   // true → every request fails (offline test)
  const tname = (lid, i) => (lid === 'esp.1' && i === 5 ? '<img src=x onerror=alert(1)>' : `${{ 'eng.1': 'Eng', 'esp.1': 'Esp', 'ita.1': 'Ita' }[lid]} ${i}`);
  const teamsOf = (lid) => (lid === 'uefa.champions'
    ? [[100, 1], [100, 2], [200, 1], [300, 1], [100, 3], [200, 2]].map(([p, i]) => ({ id: String(p + i), name: tname(Object.keys(P).find((k) => P[k] === p), i) }))
    : Array.from({ length: 20 }, (_, k) => ({ id: String(P[lid] + k + 1), name: tname(lid, k + 1) })));
  const team = (t) => ({ id: t.id, shortDisplayName: t.name, color: '3366cc', logos: [{ href: 'https://evil.example/x.png' }] });
  function standings(lid) {
    if (lid === 'fifa.world') return { children: ['Group A', 'Group B'].map((name, g) => ({ name, standings: { entries: [1, 2, 3, 4].map((i) => ({
      team: team({ id: String(900 + g * 10 + i), name: `Land ${g}${i}` }), stats: [{ name: 'rank', value: i }, { name: 'points', value: 9 - i }] })) } })) };
    if (!P[lid] && lid !== 'uefa.champions') return { children: [] };
    const ts = teamsOf(lid);
    return { children: [{ standings: { entries: ts.map((t, i) => ({ team: team(t), stats: [
      { name: 'rank', value: i + 1 }, { name: 'gamesPlayed', value: 10 }, { name: 'wins', value: 10 - i % 10 }, { name: 'ties', value: 0 },
      { name: 'losses', value: i % 10 }, { name: 'pointDifferential', value: 20 - i }, { name: 'points', value: 40 - i }] })) } }] };
  }
  let seq = 0;
  const ev = (lid, id, h, a, t, state, hs, as) => ({ id: String(id), date: new Date(t).toISOString(), competitions: [{
    status: { displayClock: state === 'in' ? "67'" : '', type: { state, shortDetail: state === 'post' ? 'FT' : '' } },
    competitors: [{ homeAway: 'home', team: team(h), score: state === 'pre' ? undefined : String(hs) }, { homeAway: 'away', team: team(a), score: state === 'pre' ? undefined : String(as) }],
    details: state === 'pre' ? [] : [{ scoringPlay: true, type: { text: 'Goal' }, clock: { displayValue: "12'" }, team: { id: h.id }, athletesInvolved: [{ shortName: 'A. Skytt' }] },
      { yellowCard: true, type: { text: 'Yellow Card' }, clock: { displayValue: "30'" }, team: { id: a.id }, athletesInvolved: [{ shortName: 'B. Gul' }] }] }] });
  function scoreboard(lid) {
    if (!P[lid] && lid !== 'uefa.champions') return { events: [] };
    const ts = teamsOf(lid), n = ts.length, base = (P[lid] || 400) * 1000, out = [];
    out.push(ev(lid, base + 1, ts[0], ts[1], now - 3600e3, 'in', 2, 1));
    for (let i = 0; i < 10; i++) out.push(ev(lid, base + 10 + i, ts[(2 + i) % n], ts[(3 + i) % n], now + (i < 2 ? 2 * 3600e3 : (i + 1) * day), 'pre'));
    for (let i = 0; i < 10; i++) out.push(ev(lid, base + 30 + i, ts[(4 + i) % n], ts[(5 + i) % n], now - (i + 1) * day, 'post', i % 3, 1));
    return { events: out };
  }
  function schedule(lid, id, fixture) {
    if (!P[lid]) return { events: [], team: { color: '3366cc' } };
    const ts = teamsOf(lid), me = ts.find((t) => t.id === id) || ts[0], o = ts.filter((t) => t.id !== me.id), base = Number(id) * 100;
    const list = fixture ? [0, 1, 2].map((i) => ev(lid, base + i, me, o[i], now + (i + 1) * day, 'pre'))
      : [0, 1, 2, 3, 4, 5].map((i) => ev(lid, base + 10 + i, o[i], me, now - (i + 1) * 2 * day, 'post', i % 2, 1));
    return { events: list, team: { color: '3366cc' } };
  }
  self.fetch = (url, opts) => {
    self.__calls.push({ url: String(url), opts: opts || null });
    seq++;
    if (self.__fail) return Promise.reject(new TypeError('Failed to fetch'));
    const u = new URL(String(url));
    const m = u.pathname.match(/soccer\/([a-z.0-9_]+)\/(standings|scoreboard|teams\/(\d+)\/schedule)$/);
    let body = { events: [] };
    if (m && m[2] === 'standings') body = standings(m[1]);
    else if (m && m[2] === 'scoreboard') body = scoreboard(m[1]);
    else if (m) body = schedule(m[1], m[3], u.searchParams.get('fixture') === 'true');
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  };
})();
