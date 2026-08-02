(function () {
  function initFeaturedCollection(root) {
    var sliderEl = root.querySelector('[data-featured-collection-slider]');
    if (!sliderEl) return;

    var perMobile = parseFloat(sliderEl.getAttribute('data-preview-mobile') || '1.6');
    var perMobileBig = parseFloat(sliderEl.getAttribute('data-preview-mobile-big') || '2.6');
    var perDesktop = parseFloat(sliderEl.getAttribute('data-preview-desktop') || '4');

    perMobile = Math.max(perMobile, 1.6);

    var nextBtn = root.querySelector('[data-featured-collection-next]');
    var prevBtn = root.querySelector('[data-featured-collection-prev]');
    var paginationEl = root.querySelector('[data-featured-collection-pagination]');

    if (!window.Swiper) return;
    if (sliderEl.classList.contains('swiper-initialized')) return;

    // eslint-disable-next-line no-new
    new Swiper(sliderEl, {
      speed: 300,
      spaceBetween: 20,
      slidesPerView: 2,
      // Make touch interactions less twitchy so taps and vertical scrolls do not
      // accidentally flip the carousel as easily.
      threshold: 14,
      touchRatio: 0.85,
      touchAngle: 45,
      longSwipesRatio: 0.45,
      navigation: nextBtn && prevBtn ? { nextEl: nextBtn, prevEl: prevBtn } : undefined,
      pagination: paginationEl ? { el: paginationEl, type: 'progressbar' } : undefined,
      breakpoints: {
        320: { slidesPerView: perMobile, spaceBetween: 12 },
        768: { slidesPerView: perMobileBig, spaceBetween: 16 },
        1024: { slidesPerView: perDesktop, spaceBetween: 20 },
      },
    });
  }

  function initFeaturedCollectionWishlist(root) {
    var storageKey = 'featured-collection-wishlist';
    var buttons = root.querySelectorAll('[data-wishlist-button]');
    if (!buttons.length) return;

    var wishlist = [];
    try {
      wishlist = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(wishlist)) wishlist = [];
    } catch (e) {
      wishlist = [];
    }

    function saveWishlist() {
      try {
        localStorage.setItem(storageKey, JSON.stringify(wishlist));
      } catch (e) {}
    }

    function updateButtonState(button) {
      var productId = button.getAttribute('data-product-id');
      if (!productId) return;
      var isActive = wishlist.includes(productId);
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.setAttribute('title', isActive ? 'Remove from wishlist' : 'Add to wishlist');
    }

    function updateAllButtons() {
      root.querySelectorAll('[data-wishlist-button]').forEach(updateButtonState);
    }

    updateAllButtons();

    if (root.dataset.wishlistBound === 'true') return;
    root.dataset.wishlistBound = 'true';

    root.addEventListener('click', function (event) {
      var button = event.target && event.target.closest ? event.target.closest('[data-wishlist-button]') : null;
      if (!button || !root.contains(button)) return;

      event.preventDefault();

      var productId = button.getAttribute('data-product-id');
      if (!productId) return;

      if (wishlist.includes(productId)) {
        wishlist = wishlist.filter(function (id) {
          return id !== productId;
        });
      } else {
        wishlist.push(productId);
      }

      saveWishlist();
      updateAllButtons();
    });
  }

  function initRoot(root) {
    initFeaturedCollectionWishlist(root);

    function waitForSwiper() {
      if (window.Swiper) {
        initFeaturedCollection(root);
        return;
      }
      window.setTimeout(waitForSwiper, 60);
    }

    waitForSwiper();
  }

  function boot() {
    document.querySelectorAll('[data-featured-collection]').forEach(initRoot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  if (window.Shopify && Shopify.designMode) {
    document.addEventListener('shopify:section:load', boot);
    document.addEventListener('shopify:section:select', boot);
  }
})();
