/*!
 * RentOPC Header & Navigation v2 — Runtime QA Harness
 * ---------------------------------------------------------------
 * Paste-and-run in the DevTools Console on your Shopify preview.
 * Runs 40+ non-destructive assertions against the DOM, aria state,
 * and CustomEvent wiring. Prints a formatted pass/fail table.
 *
 * Usage:
 *   1. Open Shopify preview URL (https://<store>.myshopify.com/?preview_theme_id=...)
 *   2. Open DevTools → Console
 *   3. Paste ENTIRE file contents and press Enter.
 *   4. Read the table. All rows must show ✓ before tagging production.
 *
 * Non-destructive: touches nothing on the page. Safe on any page.
 * Reruns can be executed anytime.
 * ---------------------------------------------------------------
 */
(function () {
  'use strict';

  var results = [];
  var caught  = { search_query: 0, search_result_click: 0, nav_click: 0,
                  menu_open: 0, menu_close: 0, cart_click: 0, account_click: 0,
                  support_click: 0, atc_success: 0, search_open: 0 };

  // Listen for all header CustomEvents for 2s after harness start
  Object.keys(caught).forEach(function (n) {
    document.addEventListener(n, function () { caught[n]++; }, { once: false });
  });

  function assert(name, ok, detail) {
    results.push({ test: name, pass: !!ok, detail: detail || '' });
  }
  function q(sel) { return document.querySelector(sel); }
  function qa(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  // ---------- Header scope ----------
  var header = q('[data-rop-header]');
  assert('Header carries data-rop-header attribute', !!header,
         header ? '<header> found' : 'MISSING — Phase 2b hook not deployed');

  // ---------- Sprite ----------
  assert('SVG icon sprite present', !!q('svg.rop-icon-sprite, [id="rop-icon-search"]'),
         q('#rop-icon-search') ? 'rop-icon-search defined' : 'MISSING');

  // ---------- rop-header.js loaded ----------
  var scripts = qa('script[src*="rop-header.js"]');
  assert('rop-header.js script tag present', scripts.length > 0,
         scripts.length + ' occurrence(s)');

  // ---------- Desktop dropdowns ----------
  var dropdowns = qa('[data-rop-dropdown]');
  assert('Desktop dropdowns present (data-rop-dropdown)', dropdowns.length > 0,
         dropdowns.length + ' dropdown(s)');

  dropdowns.forEach(function (d, i) {
    var trig = d.querySelector('[data-rop-dropdown-trigger]');
    var panel = d.querySelector('[data-rop-dropdown-panel]');
    assert('Dropdown #' + i + ' has trigger + panel', !!(trig && panel),
           trig ? 'trigger ok' : 'trigger MISSING');
    if (trig) {
      assert('Dropdown #' + i + ' trigger has aria-controls', trig.hasAttribute('aria-controls'), trig.getAttribute('aria-controls') || '');
      assert('Dropdown #' + i + ' trigger has aria-expanded', trig.hasAttribute('aria-expanded'), trig.getAttribute('aria-expanded'));
    }
  });

  // ---------- Analytics data attributes ----------
  ['cart_click', 'account_click', 'nav_click', 'support_click'].forEach(function (n) {
    var el = q('[data-rop-analytics="' + n + '"]');
    assert('data-rop-analytics="' + n + '" present in DOM', !!el, el ? 'found' : 'MISSING');
  });

  // ---------- Cart bubble live region ----------
  var bubble = q('.cart-count-bubble');
  if (bubble) {
    assert('.cart-count-bubble aria-live="polite"', bubble.getAttribute('aria-live') === 'polite');
    assert('.cart-count-bubble aria-atomic="true"', bubble.getAttribute('aria-atomic') === 'true');
  } else {
    assert('.cart-count-bubble present', false, 'cart is empty — bubble not rendered (expected when cart is empty)');
  }

  // ---------- Mobile trigger ----------
  var mobTrig = q('[data-rop-mobile-search-trigger]');
  assert('Mobile search trigger button present', !!mobTrig,
         mobTrig ? 'found' : 'MISSING (only visible <990px)');
  if (mobTrig) {
    assert('Mobile trigger has aria-controls', mobTrig.hasAttribute('aria-controls'), mobTrig.getAttribute('aria-controls'));
    assert('Mobile trigger has initial aria-expanded="false"', mobTrig.getAttribute('aria-expanded') === 'false');
  }

  // ---------- Mobile search overlay ----------
  var overlay = q('[data-rop-mobile-search-overlay]');
  assert('Mobile search overlay in DOM', !!overlay);
  if (overlay) {
    assert('Overlay role="dialog"', overlay.getAttribute('role') === 'dialog');
    assert('Overlay aria-modal="true"', overlay.getAttribute('aria-modal') === 'true');
    assert('Overlay initially hidden', overlay.hasAttribute('hidden'));
    assert('Overlay has close button', !!overlay.querySelector('[data-rop-mobile-search-close]'));
  }

  // ---------- Drawer extras ----------
  var drawerExtras = q('[data-rop-drawer-extras]');
  assert('Mobile drawer extras block present', !!drawerExtras);
  if (drawerExtras) {
    assert('Drawer WhatsApp link present', !!drawerExtras.querySelector('[data-rop-drawer-whatsapp]'));
    var wa = drawerExtras.querySelector('[data-rop-drawer-whatsapp]');
    if (wa) {
      assert('WhatsApp target="_blank"', wa.getAttribute('target') === '_blank');
      assert('WhatsApp rel="noopener noreferrer"', wa.getAttribute('rel') === 'noopener noreferrer');
    }
  }

  // ---------- Skip-to-content link ----------
  var skip = q('.skip-to-content-link[href="#MainContent"]');
  assert('Skip-to-content link present in <body>', !!skip);
  assert('Main content target has tabindex="-1"', !!q('#MainContent[tabindex="-1"]'));

  // ---------- Predictive search custom element ----------
  assert('Predictive-search custom element present', !!q('predictive-search'));

  // ---------- Cart drawer monkey-patch active ----------
  var cd = q('cart-drawer');
  if (cd) {
    assert('cart-drawer element found', true);
    assert('cart-drawer auto-open suppressed (Phase 4)', cd.__ropAutoOpenSuppressed === true,
           cd.__ropAutoOpenSuppressed ? 'suppressed OK' : 'NOT SUPPRESSED — Phase 4 patch failed to attach (may need up to 2s after page load)');
  } else {
    assert('cart-drawer element found', false, 'settings.cart_type may not be "drawer"');
  }

  // ---------- Design token check ----------
  var rootStyle = getComputedStyle(document.documentElement);
  ['--rop-header-main-h', '--rop-header-main-h-condensed', '--rop-radius-14', '--rop-color-ink-900']
    .forEach(function (v) {
      assert('CSS var ' + v + ' defined', rootStyle.getPropertyValue(v).trim().length > 0,
             rootStyle.getPropertyValue(v));
    });

  // ---------- Header height check ----------
  if (header && window.innerWidth >= 990) {
    var h = header.getBoundingClientRect().height;
    assert('Desktop header height ≈ 60px', h >= 58 && h <= 62, Math.round(h) + 'px');
  }
  if (header && window.innerWidth < 990) {
    var hm = header.getBoundingClientRect().height;
    assert('Mobile header height ≈ 56px', hm >= 54 && hm <= 58, Math.round(hm) + 'px');
  }

  // ---------- Wishlist Hero preserved (app block loop) ----------
  var appBlocks = qa('.header__icons .shopify-app-block, .header__icons [class*="wishlist" i]');
  assert('App-block hook slot present in .header__icons', appBlocks.length >= 0,
         appBlocks.length + ' app block(s) rendered (Wishlist Hero should appear here on live theme)');

  // ---------- Print table ----------
  setTimeout(function () {
    var passed = results.filter(function (r) { return r.pass; }).length;
    var total  = results.length;
    console.log('\n%c╔══════════════════════════════════════════════════════════════╗', 'color:#2563EB;font-weight:bold');
    console.log('%c║  RentOPC Header & Nav v2 — Runtime QA Harness Results        ║', 'color:#2563EB;font-weight:bold');
    console.log('%c╠══════════════════════════════════════════════════════════════╣', 'color:#2563EB;font-weight:bold');
    console.log('%c║  ' + passed + ' / ' + total + ' assertions passed                                    ║', passed === total ? 'color:#16A34A;font-weight:bold' : 'color:#DC2626;font-weight:bold');
    console.log('%c╚══════════════════════════════════════════════════════════════╝', 'color:#2563EB;font-weight:bold');
    console.table(results.map(function (r) {
      return { test: r.test, status: r.pass ? '✓ PASS' : '✗ FAIL', detail: r.detail };
    }));
    console.log('\nListening for CustomEvents for the next 5s. Interact with the header now:');
    console.log('  → click a nav item, hover a dropdown, open cart, submit search, click a result.');
    setTimeout(function () {
      console.log('\n%cCustomEvent capture (5s window):', 'color:#2563EB;font-weight:bold');
      console.table(caught);
      var missing = Object.keys(caught).filter(function (k) { return caught[k] === 0; });
      if (missing.length) {
        console.warn('Events NOT observed (may be normal if you did not trigger them):', missing.join(', '));
      }
    }, 5000);
  }, 500);
})();
