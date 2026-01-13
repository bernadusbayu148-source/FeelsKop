
// Tahun footer
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

// Header shadow saat scroll
const siteHeader = document.getElementById('siteHeader');
window.addEventListener('scroll', () => {
  if (siteHeader) siteHeader.classList.toggle('scrolled', window.scrollY > 2);
});

// ==== Toggle menu mobile ====
(function initMobileMenu() {
  const navToggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('primaryNav');
  if (!navToggle || !nav) return;
  navToggle.addEventListener('click', () => {
    const expanded = navToggle.getAttribute('aria-expanded') === 'true';
    navToggle.setAttribute('aria-expanded', String(!expanded));
    nav.classList.toggle('open');
    document.body.classList.toggle('nav-open', !expanded);
  });
})();

// ==== Hero slider sederhana ====
(function initHeroSlider() {
  const slider = document.getElementById('heroSlider');
  if (!slider) return;
  const slides = Array.from(slider.querySelectorAll('.slide'));
  const btnPrev = slider.querySelector('.prev');
  const btnNext = slider.querySelector('.next');
  const dotsWrap = slider.querySelector('.slider-dots');
  let index = slides.findIndex(s => s.classList.contains('is-active'));
  if (index < 0) index = 0;
  const setActive = (i) => {
    slides.forEach(s => s.classList.remove('is-active'));
    slides[i].classList.add('is-active');
    dotsWrap.querySelectorAll('.dot').forEach((d, di) => d.classList.toggle('active', di === i));
    index = i;
  };
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.setAttribute('aria-label', `Pilih slide ${i + 1}`);
    dot.addEventListener('click', () => setActive(i));
    dotsWrap.appendChild(dot);
  });
  setActive(index);
  btnPrev?.addEventListener('click', () => setActive((index - 1 + slides.length) % slides.length));
  btnNext?.addEventListener('click', () => setActive((index + 1) % slides.length));
  // Auto-rotate (pause saat tab tidak aktif)
  let timer = setInterval(() => setActive((index + 1) % slides.length), 6000);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInterval(timer);
    else timer = setInterval(() => setActive((index + 1) % slides.length), 6000);
  });
  // Respect reduced motion
  try {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) clearInterval(timer);
  } catch (e) {}
})();

// ==== Leaderboard: tinggi iframe via postMessage ====
(function listenLeaderboardHeight() {
  const iframe = document.getElementById('leaderboardFrame');
  if (!iframe) return;
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (data && data.type === 'LB_HEIGHT' && typeof data.height === 'number') {
      iframe.style.height = (data.height + 20) + 'px';
    }
  });
})();

// ==== Service Tabs (generic: dipakai di services & stations) ====
(function initServiceTabs() {
  const tabsWrap = document.querySelector('.service-tabs');
  const tabs = document.querySelectorAll('.service-tabs .tab');
  const panels = document.querySelectorAll('.tab-panel');
  if (!tabsWrap || !tabs.length || !panels.length) return;
  const getKey = (btn) => btn?.dataset?.tab ?? '';
  const setActive = (key) => {
    tabs.forEach(t => {
      const active = getKey(t) === key;
      t.classList.toggle('is-active', active);
      t.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    panels.forEach(p => {
      const active = p.id === `panel-${key}`;
      p.classList.toggle('is-active', active);
      if (active) p.removeAttribute('hidden'); else p.setAttribute('hidden', '');
    });
    if (key) history.replaceState(null, '', `#${key}`);
  };
  // init dari hash (jika ada)
  const keys = Array.from(tabs).map(getKey);
  const initial = (location.hash ?? '').replace('#', '');
  const startKey = keys.includes(initial) ? initial : getKey(tabs[0]);
  setActive(startKey);
  // handler click & keyboard
  tabs.forEach(btn => {
    btn.addEventListener('click', (e) => { e.preventDefault(); setActive(getKey(btn)); });
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(getKey(btn)); }
    });
  });
  // hashchange
  window.addEventListener('hashchange', () => {
    const key = (location.hash ?? '').replace('#', '');
    if (keys.includes(key)) setActive(key);
  });
})();
``
