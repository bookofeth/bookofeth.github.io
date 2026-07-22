/* BOOE global behaviour. Progressive enhancement only: the site is fully legible
   with JS disabled. Three jobs: frost the nav on scroll, drive the mobile
   table-of-contents sheet, and reveal sections on scroll (transform + opacity). */
(function () {
  'use strict';

  /* --- Nav: frost on scroll --------------------------------------------- */
  var nav = document.querySelector('[data-nav]');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* --- Mobile menu: the table-of-contents sheet ------------------------- */
  var toggle = document.querySelector('[data-menu-toggle]');
  var sheet = document.querySelector('[data-menu]');
  if (toggle && sheet) {
    var setOpen = function (open) {
      sheet.classList.toggle('open', open);
      sheet.setAttribute('aria-hidden', open ? 'false' : 'true');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('menu-open', open);
    };
    toggle.addEventListener('click', function () {
      setOpen(!sheet.classList.contains('open'));
    });
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('a') || e.target.closest('[data-menu-close]')) {
        setOpen(false);
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open')) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* --- Scroll reveal ---------------------------------------------------- */
  var items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  items.forEach(function (el) { io.observe(el); });
})();
