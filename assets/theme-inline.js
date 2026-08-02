(function () {
  function loadMerchantWidget() {
    if (window.__merchantWidgetLoaded) return;
    window.__merchantWidgetLoaded = true;

    var script = document.createElement('script');
    script.src = 'https://www.gstatic.com/shopping/merchant/merchantwidget.js';
    script.async = true;
    script.onload = function () {
      if (!window.merchantwidget || typeof window.merchantwidget.start !== 'function') return;

      window.merchantwidget.start({
        merchant_id: 5557914494,
        position: 'LEFT_BOTTOM',
      });
    };

    document.head.appendChild(script);
  }

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadMerchantWidget, { timeout: 3500 });
  } else {
    window.setTimeout(loadMerchantWidget, 3500);
  }
})();

(function () {
  var PREFIX = '/cdn/shop/';
  var MAX_RUNTIME_MS = 8000;
  var start = Date.now();
  var scheduled = false;

  function fixElement(el) {
    if (!el || el.nodeType !== 1) return;
    var tag = el.tagName;
    if (tag !== 'IMG' && tag !== 'SOURCE') return;

    if (el.hasAttribute('src')) {
      var src = el.getAttribute('src') || '';
      if (src.indexOf('files/') === 0) el.setAttribute('src', PREFIX + src);
    }

    if (el.hasAttribute('srcset')) {
      var srcset = el.getAttribute('srcset') || '';
      if (srcset.indexOf('files/') !== -1) {
        var fixed = srcset
          .split(',')
          .map(function (part) {
            var trimmed = (part || '').trim();
            return trimmed.indexOf('files/') === 0 ? PREFIX + trimmed : part;
          })
          .join(', ');
        el.setAttribute('srcset', fixed);
      }
    }
  }

  function fixWithin(root) {
    if (!root || root.nodeType !== 1) return;
    fixElement(root);
    var list = root.querySelectorAll('img[src^="files/"], img[srcset*="files/"], source[srcset*="files/"]');
    for (var i = 0; i < list.length; i++) fixElement(list[i]);
  }

  function scheduleFix(root) {
    if (scheduled) return;
    scheduled = true;

    var runner = function () {
      scheduled = false;
      if (Date.now() - start > MAX_RUNTIME_MS) return;
      fixWithin(root || document.body);
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runner, { timeout: 1500 });
    } else {
      window.setTimeout(runner, 250);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    scheduleFix(document.body);
  });

  window.addEventListener('load', function () {
    scheduleFix(document.body);
  });

  document.addEventListener('flickity:ready', function () {
    scheduleFix(document.body);
  });
  document.addEventListener('flickity:change', function () {
    scheduleFix(document.body);
  });

  if (window.MutationObserver) {
    var observer = new MutationObserver(function (mutations) {
      if (Date.now() - start > MAX_RUNTIME_MS) {
        observer.disconnect();
        return;
      }

      for (var i = 0; i < mutations.length; i++) {
        var added = mutations[i] && mutations[i].addedNodes;
        if (!added) continue;
        for (var j = 0; j < added.length; j++) {
          var node = added[j];
          if (node && node.nodeType === 1) scheduleFix(node);
        }
      }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.setTimeout(function () {
      observer.disconnect();
    }, MAX_RUNTIME_MS);
  }
})();

