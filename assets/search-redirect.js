(function () {
  function boot() {
    var node = document.querySelector('[data-search-redirect]');
    if (!node) return;

    var searchUrl = node.getAttribute('data-search-url') || '/search';
    var params = new URLSearchParams(window.location.search);
    var query = params.get('q');
    var type = params.get('type');

    if (type !== 'product') {
      params.set('type', 'product');
      params.set('options[prefix]', 'last');
      window.location.replace(searchUrl + '?' + params.toString());
      return;
    }

    if (query === null || query.trim() === '') {
      params.set('q', '*');
      params.set('type', 'product');
      params.set('options[prefix]', 'last');
      window.location.replace(searchUrl + '?' + params.toString());
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();

