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
  go(0);
})();
