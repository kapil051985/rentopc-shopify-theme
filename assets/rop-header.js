/*!
 * RentOPC Header & Navigation v2 — behaviour module (Phase 2)
 * Source of truth: Build Spec 01 (v2, Final for Build) §3 Sticky, §3 Dropdown, §10, §11.
 *
 * Responsibilities:
 *   1. Sticky-condense — one passive, rAF-throttled scroll listener; toggles the
 *      `rop-header--condensed` class on <header> past 100px of scroll (spec §3 Sticky).
 *   2. Dropdown hover-intent — 120ms open delay / 200ms close grace for the two-column
 *      Laptops/Desktops dropdowns (spec §3 Dropdown "Open trigger" / "Close triggers").
 *      Keyboard (Enter/Space/Arrow) and touch tap always open instantly.
 *   3. CustomEvent analytics — dispatches clean events on document (spec user rule 5,
 *      L5 handling: NO dataLayer.push, NO GTM changes).
 *
 * Not in this phase: focus-trap (mobile drawer/overlay — Phase 3),
 * cart-drawer auto-open disable (Phase 4), predictive-search re-rank (Phase 3).
 */
(function () {
  'use strict';

  var STICKY_THRESHOLD = 100;      // px, spec §3 Sticky
  var HOVER_OPEN_DELAY  = 120;      // ms, spec §3 Dropdown "hover with 120ms intent delay"
  var HOVER_CLOSE_DELAY = 200;      // ms, spec §3 Dropdown "mouse leave with 200ms grace"

  /* ---------- Analytics dispatcher (CustomEvent only) ---------- */
  function emit(name, detail) {
    try {
      document.dispatchEvent(new CustomEvent(name, { detail: detail || {}, bubbles: true }));
    } catch (_) { /* no-op */ }
  }

  /* ---------- 1. Sticky condense ---------- */
  function initSticky() {
    var header = document.querySelector('[data-rop-header]');
    if (!header) return;

    var ticking = false;
    var isCondensed = false;

    function apply() {
      var y = window.pageYOffset || document.documentElement.scrollTop || 0;
      var shouldCondense = y > STICKY_THRESHOLD;
      if (shouldCondense !== isCondensed) {
        isCondensed = shouldCondense;
        header.classList.toggle('rop-header--condensed', isCondensed);
      }
      ticking = false;
    }

    function onScroll() {
      if (!ticking) {
        window.requestAnimationFrame(apply);
        ticking = true;
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    apply(); // sync initial state (e.g. deep-link scroll)
  }

  /* ---------- 2. Hover-intent for desktop dropdowns ---------- */
  function initHoverIntent() {
    var groups = document.querySelectorAll('[data-rop-dropdown]');
    if (!groups.length) return;

    groups.forEach(function (group) {
      var openTimer = null;
      var closeTimer = null;
      var isDetails = group.tagName && group.tagName.toLowerCase() === 'details';
      var trigger = group.querySelector('[data-rop-dropdown-trigger]');

      function open() {
        clearTimeout(closeTimer);
        group.setAttribute('data-rop-open', 'true');
        // Reflect state on <details> so browsers derive aria-expanded on <summary>
        // and CSS `details[open] > .mega-menu__content` matches.
        if (isDetails && !group.hasAttribute('open')) group.setAttribute('open', '');
        if (trigger) trigger.setAttribute('aria-expanded', 'true');
      }
      function close() {
        group.removeAttribute('data-rop-open');
        if (isDetails && group.hasAttribute('open')) group.removeAttribute('open');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
      }

      group.addEventListener('mouseenter', function () {
        clearTimeout(closeTimer);
        openTimer = setTimeout(open, HOVER_OPEN_DELAY);
      });
      group.addEventListener('mouseleave', function () {
        clearTimeout(openTimer);
        closeTimer = setTimeout(close, HOVER_CLOSE_DELAY);
      });
      // Keyboard: focus-in opens instantly; focus-out closes when focus leaves the group entirely.
      group.addEventListener('focusin', open);
      group.addEventListener('focusout', function (e) {
        if (!group.contains(e.relatedTarget)) close();
      });
      // Escape closes and returns focus to the trigger (spec §3 Dropdown Close triggers).
      group.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          close();
          var trig = group.querySelector('[data-rop-dropdown-trigger]');
          if (trig) trig.focus();
        }
      });
    });

    // Outside click closes any open dropdown.
    document.addEventListener('click', function (e) {
      groups.forEach(function (group) {
        if (group.hasAttribute('data-rop-open') && !group.contains(e.target)) {
          group.removeAttribute('data-rop-open');
          if (group.tagName && group.tagName.toLowerCase() === 'details' && group.hasAttribute('open')) {
            group.removeAttribute('open');
          }
          var trig = group.querySelector('[data-rop-dropdown-trigger]');
          if (trig) trig.setAttribute('aria-expanded', 'false');
        }
      });
    });
  }

  /* ---------- 3. Analytics wiring ---------- */
  function initAnalytics() {
    var header = document.querySelector('[data-rop-header]');
    if (!header) return;

    header.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-rop-analytics]');
      if (!t) return;
      var name = t.getAttribute('data-rop-analytics');
      if (!name) return;
      emit(name, {
        label: (t.textContent || '').trim().slice(0, 80),
        href: t.getAttribute('href') || null
      });
    });
  }

  /* ---------- Boot ---------- */
  function boot() {
    initSticky();
    initHoverIntent();
    initAnalytics();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
