(() => {
  const main = document.querySelector('main');
  const pages = Array.from(main.querySelectorAll(':scope > section[id]')).filter(page => !page.dataset?.pageDisabled);
  const links = Array.from(document.querySelectorAll('.nav-links a'));
  const nav = document.querySelector('.nav-links');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let currentPage, animation;

  function updateUnderline() {
    const active = links.find(link => link.hash === `#${currentPage?.id}`);
    if (!active) return;
    const bounds = active.getBoundingClientRect();
    const parent = nav.getBoundingClientRect();
    nav.style.setProperty('--active-x', `${bounds.left - parent.left}px`);
    nav.style.setProperty('--active-y', `${bounds.bottom - parent.top - 1}px`);
    nav.style.setProperty('--active-width', `${bounds.width}px`);
  }

  function showPage(hash, { animate = true, focus = false } = {}) {
    const next = pages.find(page => `#${page.id}` === hash) || pages[0];
    if (next === currentPage) return;
    animation?.cancel();
    currentPage = next;
    main.classList.add('is-paged');
    pages.forEach(page => { page.hidden = page !== next; });
    links.forEach(link => {
      const active = link.hash === `#${next.id}`;
      link.parentElement.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    updateUnderline();
    if (next.id === 'coffee' && location.protocol === 'file:') {
      document.getElementById('coffee-status').textContent = 'Run npm run practice and open http://localhost:3000/#coffee to preview the coffee map.';
    }
    document.dispatchEvent(new CustomEvent('pagechange', { detail: next.id }));
    if (focus) {
      const heading = next.querySelector('h1, h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    // Content changes independently of navigation. No tab reordering, title
    // morphing, document snapshots, or paper effects are involved.
    if (animate && !reducedMotion.matches && main.animate) {
      animation = main.animate([{ opacity: 0.65 }, { opacity: 1 }], { duration: 150, easing: 'ease-out' });
    }
  }

  function navigate(link, { focus = true } = {}) {
    if (location.hash !== link.hash) {
      try { history.pushState(null, '', link.hash); }
      catch { location.hash = link.hash; }
    }
    showPage(link.hash, { focus });
  }

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !pages.some(page => `#${page.id}` === link.hash)) return;
    event.preventDefault();
    navigate(link);
  });
  window.addEventListener('popstate', () => showPage(location.hash, { focus: true }));
  window.addEventListener('hashchange', () => showPage(location.hash, { focus: true }));
  window.addEventListener('resize', updateUnderline);
  document.addEventListener('languagechange', updateUnderline);
  if (window.ResizeObserver) new ResizeObserver(updateUnderline).observe(nav);
  document.fonts?.ready.then(updateUnderline);
  showPage(location.hash, { animate: false });
  requestAnimationFrame(() => nav.classList.add('indicator-ready'));
})();
