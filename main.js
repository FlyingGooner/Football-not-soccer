// Football, not soccer – render, navigering, uppdatering, backup och start – laddas sist. Vanligt skript (delar globalt scope med app.js).
'use strict';
function render() {
  for (const v of [...TABS, 'pick']) $('view-' + v).hidden = v !== view;
  for (const t of document.querySelectorAll('#tabbar [data-view]')) {
    const on = t.dataset.view === (peek && view === 'fav' ? (peekFrom === 'pick' ? 'team' : peekFrom) : view);   // a peeked team keeps its origin tab marked
    t.classList.toggle('on', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  }
  // Middle button: the favourite's badge and name, else an empty ☆ "Favorit".
  const fav = favTeam();
  fill($('tab-fav-icon'), fav ? logo(fav.logo) : '☆');
  $('tab-fav-name').textContent = fav ? fav.name : 'Favorit';
  arrange(); renderPickers(); renderLeagueMatches(); renderTable(); renderTeam(); renderFollowed(); renderTeamPicker(); renderSettings(); renderLayout(); renderPwd();
}

// ---------- Router (tabs, see ../STIL.md); 'pick' = the team picker, not a tab ----------
// push: a new history step (tab change), so Bakåt walks back through the views and only leaves the app at the start view.
function go(v, fetch = true, push = true) {
  const prev = view;
  view = v === 'pick' ? 'pick' : loadTab(v) || 'matches';
  if (view !== 'fav' && peek) { peek = null; syncFav(); }
  if (view !== prev) { mtab = null; openMatches.clear(); teamOpen.next = teamOpen.last = false; lagOpen.clear(); extra = { next: 0, past: 0 }; showPwd = false; }   // new view: start fresh
  if (location.hash !== '#' + view) {
    if (push && view !== prev) history.pushState({ fns: 1 }, '', '#' + view);   // fns: a step this app added (← may go back)
    else history.replaceState(history.state, '', '#' + view);
  }
  if (view !== 'pick') store.set(CONFIG.keys.tab, view);
  render();
  renderStatus();
  scrollTo(0, 0);
  if (!fetch || view === 'settings' || view === 'pick' || (view === 'fav' && !team) || (view === 'team' && !teams.follow.length)) { scheduleLive(); return; }
  refresh();   // fetches only what is no longer valid in the cache
}
$('tabbar').addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-view]');
  if (!t) return;
  ev.preventDefault();
  if (t.dataset.view === 'fav' && peek) { peek = null; syncFav(); teamOpen.next = teamOpen.last = false; }   // the middle button always shows the favourite
  go(t.dataset.view);
});
// Bakåt (Android, Safari swipe, ←): show the view of that history step; an open team closes. No new step.
// ← buttons: show v at once and replace this history step (the step before may then show the same view once more).
function backTo(v) {
  if (peek) { peek = null; syncFav(); teamOpen.next = teamOpen.last = false; }
  go(v, v !== 'pick', false);   // replaces this step (no async history.back: taps right after must not race it)
}
addEventListener('popstate', () => {
  const h = location.hash.slice(1), v = h === 'pick' ? 'pick' : loadTab(h) || 'matches';
  if (v === view && !peek) return;
  if (peek) { peek = null; syncFav(); teamOpen.next = teamOpen.last = false; }
  go(v, v !== 'pick', false);
});

// ---------- League, followed teams, favourite ----------
function setLeague(id) {
  if (!isLeague(id) || id === league) return;
  league = id;
  extra = { next: 0, past: 0 };
  store.set(CONFIG.keys.league, league);
  render();
  renderStatus(lastUpdated() ? 'Hämtar ny data…' : '');
  // Debounce: swiping past several leagues only fetches the one you stop on.
  clearTimeout(leagueTimer);
  leagueTimer = setTimeout(() => { leagueTimer = null; refresh(); }, CONFIG.leagueDebounceMs);
}
let leagueTimer = null;
let pickFrom = 'team';   // view the picker's ← returns to
function openPicker() { if (view !== 'pick') pickFrom = view; go('pick', false); }
document.querySelectorAll('[data-open-pick]').forEach((b) => b.addEventListener('click', openPicker));
$('pick-back').addEventListener('click', () => backTo(pickFrom));
// A team from a cup table gets its domestic league if it is one of ours: cached tables first, else /teams/{id} (one call).
async function domesticLeagueOf(id, compId) {
  const doms = CONFIG.leagues.filter((l) => l.kind === 'league');
  const hit = doms.find((l) => (L(l.id).table || []).some((r) => r.id === id));
  if (hit) return hit.id;
  return parseDefaultLeague(await getJSON(espnUrl('team', compId, { team: id })));
}
async function resolveLeague(t) {
  if (domestic(t.leagueId) || national(t.leagueId)) return;
  const lid = await domesticLeagueOf(t.id, t.leagueId).catch(() => null);
  const f = teams.follow.find((x) => x.id === t.id);
  if (lid && f) { f.leagueId = lid; saveSettings(); render(); }
}
// Follow a team (row from a table, lid = that table's league). The 9th gives a message. Returns the followed team or null.
function follow(row, lid) {
  const had = teams.follow.find((t) => t.id === row.id);
  if (had) return had;
  if (teams.follow.length >= TEAM_MAX) { snackbar(`Du kan följa högst ${TEAM_MAX} lag`, null, null, 4000); return null; }
  const t = cleanTeam({ ...row, leagueId: lid || row.leagueId });
  if (!t) return null;
  teams.follow.push(t);
  saveSettings();
  resolveLeague(t);
  return t;
}
// Unfollowing the favourite leaves no favourite; the team's cache goes too.
function unfollow(id) {
  teams.follow = teams.follow.filter((t) => t.id !== id);
  if (teams.favorite === id) teams.favorite = null;
  if (lagFilter === id) lagFilter = null;
  delete cache.teams[id];
  saveSettings(); saveCache(); render(); renderStatus();
}
const toggleFollow = (row, lid) => { if (isFollowed(row.id)) unfollow(row.id); else if (follow(row, lid)) render(); };
// ★: one favourite; a new one replaces the old (which stays followed). ★ on the favourite removes it as favourite.
function toggleFavorite(row, lid) {
  if (teams.favorite === row.id) teams.favorite = null;
  else { const t = follow(row, lid); if (!t) return; teams.favorite = t.id; }
  saveSettings(); render();
}

// Tap a team (e.g. a row in Tabell): open it under Favorit, same view as the favourite; follow it there with + or ★.
function openTeam(row, lid) {
  const t = cleanTeam({ ...row, leagueId: lid || row.leagueId });
  if (!t) return;
  if (!peek) { peekFrom = view; if (view === 'fav') history.pushState({ fns: 1 }, '', location.hash); }   // from Favorit itself: go() adds no step, so add one
  peek = teams.follow.find((x) => x.id === t.id) || t;
  syncFav(); teamOpen.next = teamOpen.last = false;
  go('fav');
}
// A team's name anywhere (match rows, lists): tap → openTeam. Stops the tap so the row (e.g. a match that expands) does not react too.
function teamName(t, lid, cls = null) {
  const open = (e) => { e.stopPropagation(); e.preventDefault(); openTeam(t, lid); };
  return el('span', { class: cls ? `tlink ${cls}` : 'tlink', role: 'button', tabindex: 0, 'aria-label': `Visa ${t.name}`, text: t.name,
    on: { click: open, keydown: (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); } } });
}
// ← in the team bar: same as Bakåt (popstate below takes us to peekFrom).
$('teambar-back').addEventListener('click', () => { if (peek) backTo(peekFrom); });
// ★ and +/✓ in the team bar act on the shown team, which stays shown (also after unfollow).
$('teambar-fav').addEventListener('click', () => { if (!team) return; peek = team; toggleFavorite(team, team.leagueId); });
$('teambar-fol').addEventListener('click', () => { if (!team) return; peek = team; toggleFollow(team, team.leagueId); syncFav(); render(); });

// ---------- Live ----------
const currentMatches = () => (view === 'fav' ? (teamData() || {}).matches || []
  : view === 'team' ? mergeMatches(teams.follow.map((t) => (teamData(t) || {}).matches || []))
  : view === 'matches' ? L(league).league || [] : []);
function scheduleLive() {
  clearTimeout(liveTimer);
  const live = currentMatches().filter((m) => m.state === 'in');
  if (!live.length || document.hidden) return;
  liveTimer = setTimeout(async () => {
    try {
      const fresh = await fetchLive(live);
      const byId = new Map(fresh.map((m) => [m.id, m]));
      // Written to every cached league and team, so Matcher and Lag agree.
      const upd = (list) => (Array.isArray(list) ? list.map((m) => byId.get(m.id) || m) : list);
      for (const e of Object.values(cache.leagues)) e.league = upd(e.league);
      for (const t of Object.values(cache.teams)) t.matches = upd(t.matches);
      saveCache();
      const done = live.filter((m) => (byId.get(m.id) || m).state === 'post');
      if (done.length) { done.forEach((m) => tableDue.add(m.leagueId)); await refresh(); return; }
      render();
    } catch { /* keep showing last known */ }
    scheduleLive();
  }, CONFIG.livePollMs);
}
setInterval(() => { document.querySelectorAll('[data-kickoff]').forEach((n) => { n.textContent = countdown(new Date(n.dataset.kickoff) - Date.now()); }); }, 30000);
let filePick = false;   // returning from the file picker is not "reopening the app"
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { clearTimeout(liveTimer); return; }
  if (filePick) { filePick = false; scheduleLive(); return; }
  go(view);
});

// ---------- Refresh: what the open tab shows ----------
let busy = false, again = false;
// League matches: three months at first; past months are never fetched again; the current month after maxAgeMs;
// a started match → only today's scoreboard. Returns a job resolving to a function that applies the result, or null.
function leagueJob(lid, now) {
  const e = L(lid), want = { from: monthAt(-1), to: monthAt(1) };
  if (e.range && (e.range.to < want.from || e.range.from > want.to)) { e.league = null; e.range = null; }   // long away: start over
  const months = [];
  if (!e.league || !e.range) months.push(...monthsBetween(want.from, want.to));
  else {
    if (e.range.to < want.to) months.push(...monthsBetween(monthAdd(e.range.to, 1), want.to));   // a new month has begun
    if (now - (e.updatedAt.league || 0) > CONFIG.maxAgeMs && !months.includes(monthAt(0))) months.unshift(monthAt(0));
  }
  if (months.length) {
    return fetchMonths(lid, months).then((v) => () => {
      e.league = mergeMatches([e.league, v.matches]); e.updatedAt.league = now;
      const lo = months[0], hi = months[months.length - 1];
      if (v.ok) e.range = { from: e.range && e.range.from < lo ? e.range.from : lo, to: e.range && e.range.to > hi ? e.range.to : hi };
      return v.matches;
    });
  }
  if (started(e.league)) return fetchToday(lid, overdue(e.league)).then((list) => () => { e.league = mergeMatches([e.league, list]); e.updatedAt.league = now; return list; });
  return null;
}
async function refresh() {
  if (busy) { again = true; return; }
  busy = true;
  try {
    if (view === 'team') { await refreshFollowed(); return; }
    const forTeam = teamView() ? team : null, lid = viewLeague(), e = L(lid), onlyTable = view === 'table';
    const now = Date.now();
    e.used = now;
    const prev = new Map([...(e.league || []), ...((forTeam && (cache.teams[forTeam.id] || {}).matches) || [])].map((x) => [x.id, x.state]));
    // Matches, the team's schedule and the table in parallel.
    const jobs = [];
    const lj = onlyTable && !e.league ? null : leagueJob(lid, now);
    if (lj) jobs.push(lj);
    if (forTeam) {
      const td = cache.teams[forTeam.id], id = forTeam.id;
      if (!td || now - (td.ts || 0) > CONFIG.teamAllMs || started(td.matches))
        jobs.push(fetchTeamMatches(id).then((v) => () => { cache.teams[id] = { matches: v.matches, color: v.color, color2: v.color2, ts: now }; return v.matches; }));
    }
    const tableJob = () => fetchTable(lid).then((rows) => () => { e.table = rows; e.updatedAt.table = Date.now(); tableDue.delete(lid); return []; });
    const tableFirst = !e.table || now - (e.updatedAt.table || 0) > CONFIG.maxAgeMs || tableDue.has(lid);
    if (tableFirst) jobs.push(tableJob());
    const all = await Promise.allSettled(jobs);
    for (const r of all) if (r.status === 'fulfilled') {
      const got = r.value();
      if (got.some((x) => x.state === 'post' && x.leagueId === lid && prev.has(x.id) && prev.get(x.id) !== 'post')) tableDue.add(lid);
    }
    // A match finished just now → the table once more (only then after the matches).
    if (tableDue.has(lid) && !tableFirst) {
      const [t] = await Promise.allSettled([tableJob()]);
      if (t.status === 'fulfilled') t.value(); else all.push(t);
    }
    trimCache();
    saveCache();
    if ((teamView() ? team : null) !== forTeam || viewLeague() !== lid) { again = true; return; }
    render();
    const failed = all.filter((x) => x.status === 'rejected').length;
    if (failed) {
      const nothing = failed === all.length && !e.table && !currentMatches().length;
      renderStatus(nothing ? (navigator.onLine ? 'Kunde inte hämta data' : 'Offline') : !navigator.onLine ? 'Offline – visar sparad data'
        : (failed === all.length ? 'Kunde inte hämta data – visar sparad data' : 'Viss data kunde inte hämtas'), true);
      if (nothing) {
        const msg = () => el('p', { class: 'error', text: 'Kunde inte hämta data. Kontrollera nätet och öppna appen igen.' });
        for (const id of ['table-full', 'match-list', 'team-next']) fill($(id), msg());
      }
    } else renderStatus();
  } catch {
    renderStatus('Något gick fel vid visning av data', true);
  } finally {
    busy = false;
    if (again) { again = false; setTimeout(refresh, 0); } else scheduleLive();
  }
}

// Lag: every followed team's schedule (at most once a day per team, or when one of its matches has started), in parallel.
async function refreshFollowed() {
  const now = Date.now();
  const jobs = teams.follow.filter((t) => { const td = cache.teams[t.id]; return !td || now - (td.ts || 0) > CONFIG.teamAllMs || started(td.matches); })
    .map((t) => fetchTeamMatches(t.id).then((v) => { cache.teams[t.id] = { matches: v.matches, color: v.color, color2: v.color2, ts: now }; }));
  const all = await Promise.allSettled(jobs);
  trimCache(); saveCache();
  if (view !== 'team') { again = true; return; }
  render();
  const failed = all.filter((x) => x.status === 'rejected').length;
  if (failed) renderStatus(!navigator.onLine ? 'Offline – visar sparad data' : failed === all.length ? 'Kunde inte hämta data – visar sparad data' : 'Viss data kunde inte hämtas', true);
  else renderStatus();
}

// ---------- Snackbar ----------
let snackTimer = null;
function snackbar(text, actionText, action, ms = 5000) {
  $('snack-text').textContent = text;
  const btn = $('snack-action');
  btn.hidden = !actionText;
  btn.textContent = actionText || '';
  btn.onclick = () => { $('snackbar').hidden = true; if (action) action(); };
  $('snackbar').hidden = false;
  clearTimeout(snackTimer);
  if (ms) snackTimer = setTimeout(() => { $('snackbar').hidden = true; }, ms);
}

// ---------- Data: backup (U5), import, reset ----------
function applySettings(s) {
  teams = s.teams; league = pickerLeagues(s.layout).includes(s.league) ? s.league : pickerLeagues(s.layout)[0]; layout = s.layout;
  saveSettings(); trimCache(); saveCache();
  render(); renderStatus();
}
// ---------- Remembered backup password (U5) ----------
// On by default: the password typed in the backup dialog (save or read) is kept under fns.pwd, so the next backup is one
// tap. Only on this device – never in the app data, so never inside a backup file; the file is as encrypted as before.
// Unticked (fns.pwdoff = 1): forgotten, and the app asks every time. Radera all data removes both keys.
const PWD_KEY = 'fns.pwd', OFF_KEY = 'fns.pwdoff';
let showPwd = false, pwdBusy = false;
function savedPassword() { try { const p = localStorage.getItem(PWD_KEY); return p && !Backup.checkPassword(p) ? p : ''; } catch { return ''; } }
function rememberOn() { try { return localStorage.getItem(OFF_KEY) !== '1'; } catch { return false; } }
function setRemember(on) {
  showPwd = false;
  try { if (on) localStorage.removeItem(OFF_KEY); else { localStorage.setItem(OFF_KEY, '1'); localStorage.removeItem(PWD_KEY); } } catch { /* blocked */ }
  renderPwd();
}
function keep(pwd) {
  if (!rememberOn() || Backup.checkPassword(pwd) || savedPassword()) return;   // a password from another file never replaces the saved one
  try { localStorage.setItem(PWD_KEY, pwd); } catch { /* no room: asks next time */ }
  closeWelcome();
}
function forgetPassword() { showPwd = false; try { localStorage.removeItem(PWD_KEY); localStorage.removeItem(OFF_KEY); } catch { /* blocked */ } renderPwd(); }
async function rememberPassword() {
  const a = await Backup.askPassword('export'); if (!a) return;
  try { localStorage.setItem(PWD_KEY, a.pwd); } catch { snackbar('Kunde inte spara lösenordet', null, null, 3000); return; }
  renderPwd(); snackbar('Lösenordet sparas på den här enheten. Ha det kvar i din lösenordshanterare också.', null, null, 6000);
}
// Returns the Backup.save result ('saved', 'fallback', 'cancelled', …); null on a double tap.
async function saveBackupFile(slug, today, getText) {
  const pwd = savedPassword();
  if (!pwd && !rememberOn()) return Backup.saveWithPassword({ slug, today, text: getText() });
  if (pwdBusy) return null;
  pwdBusy = true;
  try {
    if (pwd) {   // one tap: encrypt with the remembered password, no dialog
      snackbar('Krypterar backup…', null, null, 2000);
      return await Backup.save({ slug, today, text: await Backup.encrypt(getText(), pwd, slug) });
    }
    // First time: the usual dialog, then the password is kept.
    const a = await Backup.askPassword('export', async (p) => ({ env: await Backup.encrypt(getText(), p, slug) }));
    if (!a) return 'cancelled';
    keep(a.pwd); renderPwd();
    const r = await Backup.save({ slug, today, text: a.value.env });
    if (r === 'saved' || r === 'fallback') { snackbar('Backup sparad. Lösenordet är sparat på enheten – nästa gång räcker ett tryck.', null, null, 5000); return 'first'; }
    return r;
  } catch { return 'error'; } finally { pwdBusy = false; }
}
// The remembered password first; another password → the usual question. Returns { text } | { error } | { cancelled }.
async function openBackupText(text, slug) {
  const pwd = savedPassword();
  if (pwd && Backup.isEncrypted(text)) {
    let t; try { t = await Backup.decrypt(text, pwd, slug, MAX_IMPORT_CHARS); } catch { t = null; }
    if (t && typeof t.text === 'string') return { text: t.text, unlocked: true };
  }
  if (rememberOn() && Backup.isEncrypted(text)) {   // ask, and keep the password that opened the file (a new phone)
    const wait = Backup.askPassword('import', (p) => Backup.decrypt(text, p, slug, MAX_IMPORT_CHARS));
    if (pwd) noteWrongSaved();
    const a = await wait;
    if (!a) return { cancelled: true };
    if (a.value?.error) return { error: a.value.error };
    keep(a.pwd); renderPwd(); return { text: a.value.text };
  }
  return Backup.openText(text, slug, MAX_IMPORT_CHARS);
}
/* ---------- Välkommen: välj lösenord först (2026-11-14) ----------
   Utan sparat lösenord är appen låst bakom en ruta tills ett lösenord är valt (eller en krypterad backup är inläst,
   vars lösenord sparas), som att registrera sig. Lösenordet är bara nyckeln till backup-filerna – det sparas på enheten (fns.pwd), aldrig i
   datan eller i filen. Bockar man ur Kom ihåg visas rutan inte (man har valt att få frågan varje gång). */
let welcomeDlg = null, importBtn = null;
const welcomeHasData = () => teams.follow.length;
const needsWelcome = () => !savedPassword() && rememberOn();   // låst tills ett lösenord är valt, även med data
function closeWelcome() { if (welcomeDlg?.open && !needsWelcome()) welcomeDlg.close(); }
function welcomeCheck() {
  if (!needsWelcome() || welcomeDlg?.open || typeof HTMLDialogElement !== 'function') return;
  const other = document.querySelector('dialog[open]');   // t.ex. backup-påminnelsen: fråga när den stängs
  if (other) { other.addEventListener('close', () => setTimeout(welcomeCheck, 0), { once: true }); return; }
  if (!welcomeDlg) {
    const err = el('p', { class: 'error', role: 'alert' });
    const file = el('input', { type: 'file', accept: '.txt,.json' });
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0]; if (!f) return;
      let r; try { r = await Backup.read(f, MAX_IMPORT_CHARS); } catch { r = { error: 'Kunde inte läsa filen.' }; }
      file.value = '';
      err.textContent = r.error || '';
      if (!r.error) openImport(r.text);
    });
    const pick = el('button', { type: 'button', class: 'btn filled', text: 'Välj lösenord' });
    pick.addEventListener('click', choosePassword);
    welcomeDlg = el('dialog', { class: 'welcome', 'aria-labelledby': 'wl-title' },
      el('h2', { id: 'wl-title', text: 'Välkommen!' }),
      el('p', { text: 'Välj ett lösenord för att komma igång och skriv ner det på en säker plats, till exempel i din lösenordshanterare. Dina backup-filer skyddas med lösenordet, och det behövs för att läsa in en backup.' }),
      el('p', { class: 'muted small', text: 'Vi samlar ingen data. Allt stannar på din enhet – lösenordet är bara en nyckel som skyddar dina backuper.' }),
      el('div', { class: 'welcome-actions' }, pick, importBtn = el('label', { class: 'btn tonal btn-file' }, 'Jag har en backup-fil att importera', file)),
      err);
    welcomeDlg.addEventListener('cancel', (e) => e.preventDefault());   // inte Esc/Bakåt: ett lösenord först
    document.body.append(welcomeDlg);
  }
  importBtn.hidden = !!welcomeHasData();   // har man redan data behövs bara lösenordet
  welcomeDlg.showModal();
}
async function choosePassword() {
  const wait = Backup.askPassword('export');   // sets the dialog texts synchronously; ours replace them
  const set = (id, t) => { const n = document.getElementById(id); if (n) n.textContent = t; };
  set('pw-title', 'Välj lösenord'); set('pw-text', 'Lösenordet krypterar dina backup-filer och sparas på den här enheten.'); set('pw-ok', 'Spara lösenord');
  const a = await wait; if (!a) return;
  keep(a.pwd); renderPwd();
  snackbar('Lösenordet är sparat. Backup sparas med ett tryck.', null, null, 4000);
}
// Point 2: the user is told when the remembered password opened the file, and when it did not fit.
function noteUnlocked() { const s = document.getElementById('imp-sum'); if (s && document.getElementById('import-dialog')?.open) s.textContent += ' Backupen låstes upp med det sparade lösenordet.'; }
function noteWrongSaved() { const n = document.getElementById('pw-text'); if (n) n.textContent = 'Det sparade lösenordet passade inte till den här filen. Skriv lösenordet du valde när du sparade den.'; }
// Visa lösenord: ett fält räcker (som i KeePass) – Upprepa döljs och följer det första. Görs här, backup.js är delad.
function oneFieldWhenShown() {
  const $id = (id) => document.getElementById(id);
  const dlg = $id('pw-dialog'), show = $id('pw-show'), p1 = $id('pw-1'), p2 = $id('pw-2'), row = $id('pw-2-row'), gen = $id('pw-gen');
  if (!dlg || !show || !p1 || !p2 || !row) return;
  let one = false;   // true while Upprepa is hidden by us (only when saving – reading never shows it)
  const apply = () => {
    if (show.checked && !row.hidden) { one = true; row.hidden = true; p2.value = p1.value; }
    else if (!show.checked && one) { one = false; row.hidden = false; }
  };
  new MutationObserver(() => { if (dlg.open) one = false; }).observe(dlg, { attributes: true, attributeFilter: ['open'] });
  show.addEventListener('change', apply);
  gen?.addEventListener('click', () => setTimeout(apply, 0));   // the generator ticks Visa itself
  p1.addEventListener('input', () => { if (one) p2.value = p1.value; });
}
oneFieldWhenShown();
function renderPwd() {
  const box = $('pwd-box'); if (!box) return;
  const p = savedPassword(), on = rememberOn();
  const cb = el('input', { type: 'checkbox', checked: on, on: { change: (e) => setRemember(e.target.checked) } });
  const toggle = el('button', { type: 'button', class: 'btn text', 'aria-pressed': showPwd ? 'true' : 'false', on: { click: () => { showPwd = !showPwd; renderPwd(); } } }, showPwd ? 'Dölj' : 'Visa');
  const change = el('button', { type: 'button', class: 'btn text', on: { click: rememberPassword } }, 'Byt');
  fill(box,
    el('label', { class: 'check' }, cb, el('span', { text: 'Kom ihåg backup-lösenordet på den här enheten' })),
    !on ? el('p', { class: 'muted small', text: 'Appen frågar efter lösenordet varje gång.' })
      : !p ? el('p', { class: 'muted small', text: 'Lösenordet du skriver vid nästa backup sparas – sedan räcker ett tryck. Filen är lika skyddad som förut.' })
      : el('div', { class: 'pwd-card' },
        el('div', { class: 'pwd-head' }, el('span', { text: '🔑 Lösenordet är sparat' }), toggle, change),
        showPwd ? el('p', { class: 'pwd-show', text: p }) : null,
        el('p', { class: 'muted small pwd-note', text: 'Backup sparas med ett tryck. Ha lösenordet kvar i din lösenordshanterare – utan det går backupen inte att öppna på en ny telefon.' })));
}
const BACKUP_MSG = { saved: 'Backup-filen sparades', busy: 'Ett sparfönster är redan öppet', fallback: 'Backup-filen laddas ner',
  error: 'Kunde inte spara filen', nocrypto: 'Den här webbläsaren kan inte kryptera – ingen fil sparades' };
$('backup-save').addEventListener('click', async () => {
  const r = await saveBackupFile(CONFIG.slug, isoToday(), () => exportText(settings(), isoToday()));
  if (r !== 'first' && BACKUP_MSG[r]) snackbar(BACKUP_MSG[r], null, null, 4000);
});
async function openImport(text) {
  const r = await openBackupText(text, CONFIG.slug);
  if (r.cancelled) return;
  if (r.error) { $('import-error').textContent = r.error; return; }
  startImport(r.text);
  if (r.unlocked) noteUnlocked();
}
$('import-file').addEventListener('click', () => { filePick = true; });
$('import-file').addEventListener('change', async (e) => {
  const input = e.target, file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const r = await Backup.read(file, MAX_IMPORT_CHARS);
  if (r.error) { $('import-error').textContent = r.error; return; }
  openImport(r.text);
});
$('import-btn').addEventListener('click', () => openImport($('import-text').value));
let pendingImport = null;
function startImport(text) {
  const r = importText(text);
  $('import-error').textContent = r.error || '';
  if (r.error) return;
  pendingImport = r.data;
  const d = r.data;
  const fav = d.teams.follow.find((t) => t.id === d.teams.favorite);
  $('imp-sum').textContent = `Liga: ${leagueById(d.league).name}. Favorit: ${fav ? fav.name : 'ingen'}. ${d.teams.follow.length} följda lag`
    + (r.exported ? `. Exporterad ${r.exported}.` : '.') + (r.skipped ? ` ${r.skipped} ogiltiga hoppas över.` : '');
  $('import-dialog').showModal();
}
$('imp-ok').addEventListener('click', () => {
  const next = pendingImport;
  pendingImport = null;
  if (!next) return;
  const before = loadSettings(JSON.parse(JSON.stringify(settings())));
  $('import-text').value = '';
  applySettings(next);
  closeWelcome();
  snackbar('Inställningarna importerade', 'Ångra', () => applySettings(before));
});
$('reset').addEventListener('click', () => $('confirm-dialog').showModal());
$('cd-ok').addEventListener('click', () => {
  store.clear(CONFIG.prefix); forgetPassword();
  cache = emptyCache(); teams = emptyTeams(); team = null; league = DEFAULT_LEAGUE; layout = {}; goals = Object.create(null); lagFilter = null;
  render(); renderStatus();
  snackbar('All data är raderad', null, null, 3000);
  setTimeout(welcomeCheck, 0);
});

// ---------- Install (beforeinstallprompt) ----------
let installEvent = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvent = e; $('install').hidden = false; });
addEventListener('appinstalled', () => { installEvent = null; $('install').hidden = true; });
$('install').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => null);
  installEvent = null;
  $('install').hidden = true;
});

// ---------- Start ----------
$('version').textContent = 'v' + self.APP_VERSION;
addEventListener('online', () => { if (!document.hidden && view !== 'settings') refresh(); });
addEventListener('offline', () => renderStatus('Offline – visar sparad data', true));
let startView = 'matches';
try {
  const k = CONFIG.keys;
  // fns.team.v2 / .v1 and fns.recent.v1 are read once (favourite + followed), then removed.
  const s = loadSettings({ teams: store.get(k.teams), team: loadTeam(store.get(k.team), store.get(k.teamV1)), recent: store.get(k.recent),
    league: store.get(k.league), layout: store.get(k.layout) });
  teams = s.teams; syncFav();
  if ([k.team, k.teamV1, k.recent].some((x) => store.get(x) != null)) { store.set(k.teams, teams); [k.team, k.teamV1, k.recent].forEach((x) => store.set(x, null)); }
  if (store.get(k.layout) && store.get(k.layout).team) store.set(k.layout, Object.keys(s.layout).length ? s.layout : null);
  league = pickerLeagues(s.layout).includes(s.league) ? s.league : pickerLeagues(s.layout)[0]; layout = s.layout;
  cache = loadCache(store.get(k.cache));
  goals = loadGoals(store.get(k.goals));
  startView = loadTab(location.hash.slice(1)) || loadTab(store.get(k.tab)) || (team ? 'fav' : 'matches');
} catch {
  cache = emptyCache();
  store.set(CONFIG.keys.cache, null);
}
go(startView, true, false);
welcomeCheck();

// Service worker + update snackbar ("Ny version finns – Ladda om") instead of a silent reload.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => null);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) snackbar('Ny version finns', 'Ladda om', () => location.reload(), 0);
  });
}
