(() => {
  const slides = [...document.getElementById('deck').children];
  const prev = document.getElementById('prev'), next = document.getElementById('next'), count = document.getElementById('count');
  let cur = 0;
  const go = (i) => {
    cur = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, k) => { s.hidden = k !== cur; });
    slides[cur].scrollTop = 0;
    count.textContent = `${cur + 1} / ${slides.length}`;
    prev.disabled = cur === 0;
    next.disabled = cur === slides.length - 1;
  };
  prev.addEventListener('click', () => go(cur - 1));
  next.addEventListener('click', () => go(cur + 1));
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') go(cur + 1);
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(cur - 1);
  });
  // Språkknapp på första bilden (2026-11-15): engelska är standard, knappen visar det andra språket. Byte laddar om sidan.
  if (self.I18N) {
    const other = I18N.lang() === 'en' ? 'sv' : 'en';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lang-btn'; b.lang = other; b.setAttribute('data-no-tr', '');
    b.textContent = other === 'sv' ? '🇸🇪 Svenska' : '🇬🇧 English';
    b.addEventListener('click', () => I18N.setLang(other));
    slides[0].append(b);
  }
  go(0);
})();
