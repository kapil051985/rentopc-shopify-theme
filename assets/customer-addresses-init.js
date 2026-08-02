(function () {
  function boot() {
    if (typeof CustomerAddresses === 'undefined') return;
    // eslint-disable-next-line no-new
    new CustomerAddresses();
  }

  if (document.readyState === 'complete') {
    boot();
  } else {
    window.addEventListener('load', boot);
  }
})();

