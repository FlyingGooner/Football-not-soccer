(() => {
  const slides = [...document.getElementById('deck').children];
  const prev = document.getElementById('prev'), next = document.getElementById('next'), count = document.getElementById('count');
  let cur = 0;
  // Delbilder (2026-11-15): en bild med .sub-element visar ett i taget, med egna pilar ovanför de vanliga.
  const sub = document.createElement('div'); sub.className = 'subnav'; sub.hidden = true;
  const sPrev = document.createElement('button'), sNext = document.createElement('button'), sLabel = document.createElement('span');
  sPrev.type = sNext.type = 'button'; sPrev.textContent = '‹'; sNext.textContent = '›';
  sPrev.setAttribute('aria-label', 'Föregående del'); sNext.setAttribute('aria-label', 'Nästa del');
  sLabel.setAttribute('aria-live', 'polite'); sLabel.setAttribute('data-no-tr', '');
  sub.append(sPrev, sLabel, sNext); document.body.append(sub);
  let si = 0;
  const subs = () => [...slides[cur].querySelectorAll('.sub')];
  const goSub = (i) => {
    const list = subs(); sub.hidden = !list.length; if (!list.length) return;
    si = (i + list.length) % list.length;
    list.forEach((x, k) => { x.hidden = k !== si; });
    sLabel.textContent = `${list[si].dataset.title || ''} · ${si + 1} / ${list.length}`;
  };
  sPrev.addEventListener('click', () => goSub(si - 1));
  sNext.addEventListener('click', () => goSub(si + 1));
  const go = (i) => {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => { s.hidden = k !== cur; });
    slides[cur].scrollTop = 0;
    count.textContent = `${cur + 1} / ${slides.length}`;
    prev.disabled = cur === 0;
    next.disabled = cur === slides.length - 1;
    goSub(0);
  };
  prev.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur + 1));
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(cur + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(cur - 1);
    else if (e.key === 'ArrowDown' && !sub.hidden) goSub(si + 1);
    else if (e.key === 'ArrowUp' && !sub.hidden) goSub(si - 1);
  });
  // Språkknapp på första bilden (2026-11-15): svenska är standard, knappen visar det andra språket. Byte laddar om sidan.
  if (self.I18N) {
    const other = I18N.lang() === 'en' ? 'sv' : 'en';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lang-btn'; b.lang = other; b.setAttribute('data-no-tr', '');
    b.textContent = other === 'sv' ? '🇸🇪 Svenska' : '🇬🇧 English';
    b.addEventListener('click', () => I18N.setLang(other));
    slides[0].append(b);
  }
  // Hopplänkar (2026-11-15): <a href="#id"> till en bild med det id:t byter bild i stället för att skrolla.
  const byId = (h) => slides.findIndex((x) => h && x.id === h.slice(1));
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="#"]'); if (!a) return;
    const k = byId(a.getAttribute('href')); if (k < 0) return;
    e.preventDefault(); go(k);
  });
  const start = byId(location.hash);
  go(start < 0 ? 0 : start);
})();
