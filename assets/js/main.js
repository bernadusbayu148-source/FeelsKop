
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

  // Dots
  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot';
    dot.setAttribute('aria-label', `Pilih slide ${i + 1}`);
    dot.addEventListener('click', () => setActive(i));
    dotsWrap.appendChild(dot);
  });
  setActive(index);

  // Navigasi
  btnPrev?.addEventListener('click', () => setActive((index - 1 + slides.length) % slides.length));
  btnNext?.addEventListener('click', () => setActive((index + 1) % slides.length));

  // Auto-rotate (pause di background)
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
