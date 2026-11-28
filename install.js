// Installera som app (2026-11-18) – samma fil i alla appar, vanligt skript. Visar en smal rad överst när appen
// öppnas i webbläsaren och går att installera. Android: Chromes ruta (beforeinstallprompt). iPhone (Safari): stegen.
// Visas inte första besöket, inte som installerad app, inte i HTML-filen. ✕ = 30 dagar; efter två ✕ aldrig mer. I en annan apps inbyggda
// webbläsare (Messenger m.fl.) visas i stället "Öppna i Chrome/Safari" direkt, varje gång.
// Data bara i localStorage, nyckel <prefix>.install (prefix från data-prefix på script-taggen).
(function () {
  'use strict';
  const prefix = document.currentScript?.dataset.prefix || 'app';
  const KEY = prefix + '.install', DAY = 864e5;
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone || location.protocol === 'file:') return;
  const ua = navigator.userAgent;
  // 2026-11-28: inbyggd webbläsare i en annan app (Messenger, Facebook, Instagram …). Där går appen inte att installera och
  // datan sparas för sig (osynkad med Chrome/Safari). Raden visas då direkt och öppnar sidan i Chrome (Android) eller Safari (iPhone).
  const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram|Line\/|Snapchat|musical_ly|TikTok|LinkedInApp|GSA\//.test(ua) || (/Android/.test(ua) && /; wv\)/.test(ua));
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const iosSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  let st = { n: 0, until: 0, closes: 0 };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* privat läge */ }
  st.n++;
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch { /* ignore */ } };
  store();
  const allowed = () => inApp || st.n >= 2 && st.closes < 2 && Date.now() >= st.until;
  let evt = null, bar = null;

  const mk = (tag, text, css) => { const n = document.createElement(tag); if (text) n.textContent = text; if (css) Object.assign(n.style, css); return n; };
  function show() {
    if (bar || !allowed()) return;
    const main = document.querySelector('main');
    if (!main) return;
    bar = mk('div', null, { display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 12px 0', padding: '8px 4px 8px 14px',
      borderRadius: '16px', background: 'var(--primary-container, #e8def8)', color: 'var(--on-primary-container, #1d192b)', fontSize: '.875rem' });
    bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Installera som app');
    // 2026-11-18: text till vänster, tydlig knapp till höger (Installera på Android, Visa hur på iPhone).
    const txt = mk('div', null, { flex: '1', minWidth: '0', lineHeight: '1.3' });
    if (inApp) txt.append(mk('div', ios ? '🧭 Öppna i Safari' : '🧭 Öppna i Chrome', { fontWeight: '600' }), mk('div', 'Här går appen inte att installera, och det du sparar hamnar bara här', { fontSize: '.8125rem', opacity: '.85' }));
    else txt.append(mk('div', '📲 Installera som app', { fontWeight: '600' }), mk('div', 'Öppnas snabbare och fungerar utan nät', { fontSize: '.8125rem', opacity: '.85' }));
    const go = mk('button', inApp ? 'Öppna' : evt ? 'Installera' : 'Visa hur', { border: '0', borderRadius: '20px', padding: '0 18px', minHeight: '40px',
      background: 'var(--primary, #6750a4)', color: 'var(--on-primary, #fff)', font: 'inherit', fontWeight: '600', cursor: 'pointer', flex: 'none' });
    go.type = 'button';
    const x = mk('button', '✕', { border: '0', background: 'none', color: 'inherit', font: 'inherit', fontSize: '1rem', minWidth: '40px', minHeight: '40px', cursor: 'pointer' });
    x.type = 'button'; x.setAttribute('aria-label', 'Stäng');
    const steps = mk('ol', null, { margin: '0 12px', padding: '8px 14px 10px 32px', fontSize: '.875rem', lineHeight: '1.5',
      borderRadius: '0 0 16px 16px', background: 'var(--primary-container, #e8def8)', color: 'var(--on-primary-container, #1d192b)' });
    steps.hidden = true;
    const list = inApp ? (ios ? ['Tryck på ⋯ eller Dela-knappen i appen du är i.', 'Välj Öppna i Safari (eller Öppna i webbläsare).', 'Installera sedan från Safari: Dela ⬆️ → Lägg till på hemskärmen.']
      : ['Tryck på ⋮ uppe till höger i appen du är i.', 'Välj Öppna i Chrome (eller Öppna i webbläsare).', 'Installera sedan från Chrome: ⋮ → Installera app.'])
      : ['Tryck på Dela ⬆️ längst ner i Safari.', 'Välj Lägg till på hemskärmen.', 'Tryck Lägg till. Öppna sedan appen från hemskärmen.'];
    for (const s of list) steps.append(mk('li', s));
    const showSteps = (on) => { steps.hidden = !on; bar.style.borderRadius = on ? '16px 16px 0 0' : '16px'; };
    go.addEventListener('click', async () => {
      if (inApp) {
        // Samma adress (egen sida), bara öppnad i rätt webbläsare. Fungerar det inte syns stegen efter en stund.
        const rest = location.host + location.pathname + location.search + location.hash;
        location.href = ios ? 'x-safari-https://' + rest
          : 'intent://' + location.host + location.pathname + location.search + '#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(location.href) + ';end';
        setTimeout(() => showSteps(true), 1500);
        return;
      }
      if (evt) { const e = evt; evt = null; try { e.prompt(); const r = await e.userChoice; if (r?.outcome === 'accepted') hide(); } catch { hide(); } }
      else if (iosSafari) showSteps(steps.hidden);
    });
    x.addEventListener('click', () => { st.closes++; st.until = Date.now() + 30 * DAY; store(); hide(); });
    bar.append(txt, go, x);
    bar._steps = steps;
    main.before(bar, steps);
  }
  function hide() { bar?._steps?.remove(); bar?.remove(); bar = null; }

  addEventListener('beforeinstallprompt', (e) => { evt = e; show(); });   // Android: går att installera, inte redan installerad
  addEventListener('appinstalled', () => { evt = null; hide(); });
  if (iosSafari || inApp) (document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', show) : show());
})();
