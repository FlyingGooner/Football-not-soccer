// Football, not soccer – Favorit (mittknappen): favoritlagets nästa och senaste match. Vanligt skript (delar globalt scope med app.js).
'use strict';
function renderTeam() {
  $('teambar').hidden = !team;
  $('team-empty').hidden = !!team;
  for (const id of ['next', 'last']) $('arr-fav').querySelector(`[data-card="${id}"]`).hidden = !team;
  const c = team && (team.color || (teamData() && teamData().color));
  const st = document.documentElement.style, th = teamTheme(c, teamData() && teamData().color2);   // strict #rrggbb only
  if (th) { st.setProperty('--sel', color(c)); st.setProperty('--tc-l', th.light); st.setProperty('--tc-l-on', th.lightInk); st.setProperty('--tc-d', th.dark); st.setProperty('--tc-d-on', th.darkInk); for (const [k, x] of [['--tc2-l', th.stripeLight], ['--tc2-d', th.stripeDark]]) x ? st.setProperty(k, x) : st.removeProperty(k); }
  else for (const k of ['--sel', '--tc-l', '--tc-l-on', '--tc-d', '--tc-d-on', '--tc2-l', '--tc2-d']) st.removeProperty(k);
  if (!team) return;
  fill($('teambar-logo'), logo(team.logo));
  $('teambar-name').textContent = team.name;
  const fav = teams.favorite === team.id, on = isFollowed(team.id), fb = $('teambar-fav'), ob = $('teambar-fol');
  fb.textContent = fav ? '★' : '☆'; fb.setAttribute('aria-pressed', String(fav));
  fb.setAttribute('aria-label', `${fav ? 'Ta bort som favorit' : 'Gör till favorit'}: ${team.name}`);
  ob.textContent = on ? '✓' : '+'; ob.setAttribute('aria-pressed', String(on));
  ob.setAttribute('aria-label', `${on ? 'Sluta följa' : 'Följ'} ${team.name}`);
  const td = teamData();
  const loading = () => el('span', { class: 'muted', text: 'Laddar…' });
  if (!td) { fill($('team-next'), loading()); fill($('team-last'), loading()); fill($('team-next-list')); fill($('team-last-list')); }
  else {
    const upcoming = td.matches.filter((m) => m.state !== 'post'), past = td.matches.filter((m) => m.state === 'post').reverse();
    $('team-next-title').textContent = upcoming[0] && upcoming[0].state === 'in' ? 'Pågår nu' : 'Nästa match';
    fill($('team-next'), upcoming[0] ? expandable(matchHero(upcoming[0], 'next'), upcoming[0]) : el('p', { class: 'muted', text: 'Ingen inplanerad match.' }));
    fill($('team-next-list'), teamList(upcoming.slice(1), false, CONFIG.upcomingCount));
    fill($('team-last'), past[0] ? expandable(matchHero(past[0], 'last'), past[0]) : el('p', { class: 'muted', text: 'Inga spelade matcher.' }));
    fill($('team-last-list'), teamList(past.slice(1), true, CONFIG.recentCount));
  }
  // Form in the team bar (no placing, no table here; that is under Tabell).
  const dots = formDots(td && td.matches);
  fill($('team-form'), dots ? [...dots.children].slice(1) : null);
}
// Compact list under Nästa/Senaste match: first `n` rows, Visa fler expands the rest (session only).
const teamOpen = { next: false, last: false };
function teamList(list, past, n) {
  const key = past ? 'last' : 'next', open = teamOpen[key];
  if (!list.length) return null;
  return [teamMatchList(open ? list : list.slice(0, n), past),
    list.length > n ? el('button', { type: 'button', class: 'btn text more-btn', 'data-more': key, text: open ? 'Visa färre' : `Visa fler (${list.length - n})`,
      on: { click: () => { teamOpen[key] = !open; renderTeam(); } } }) : null];
}
