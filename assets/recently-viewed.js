/* Auto-extracted from sections/recently-viewed-products.liquid */
(function () {
	    var section = document.querySelector('[data-recently-viewed-section]');
	    if (!section) return;
\t\tvar sectionId = section.getAttribute('data-section-id') || section.id || '';
	    var started = false;
	
	    function start() {
	      if (started) return;
	      started = true;
	
		    var storageKey = 'recentlyViewedProducts';
		    var maxStored = 20;
		    var currentHandle = section.dataset.currentHandle;
		    var currentVariantFromDom = section.dataset.currentVariant;
	    var limit = Number(section.dataset.limit || 4);
	    var sliderComponent = section.querySelector('slider-component');
	    var grid = section.querySelector('[data-recently-viewed-grid]');
	    var emptyState = section.querySelector('[data-recently-viewed-empty]');

	    function normalizeStoredItem(item) {
	      if (typeof item === 'string') return { handle: item, variantId: null };
	      if (!item || typeof item !== 'object') return null;
	      if (!item.handle) return null;

	      return {
	        handle: String(item.handle || ''),
	        variantId: item.variantId ? Number(item.variantId) : null
	      };
	    }

	    function getStoredItems() {
	      try {
	        var parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
	        if (!Array.isArray(parsed)) return [];
	        return parsed
	          .map(normalizeStoredItem)
	          .filter(function (entry) {
	            return entry && entry.handle;
	          });
	      } catch (error) {
	        return [];
	      }
	    }

	    function setStoredItems(items) {
	      try {
	        localStorage.setItem(storageKey, JSON.stringify(items));
	      } catch (error) {
	      }
	    }

	    function escapeHtml(value) {
	      return String(value || '')
	        .replace(/&/g, '&amp;')
	        .replace(/</g, '&lt;')
	        .replace(/>/g, '&gt;')
	        .replace(/"/g, '&quot;')
	        .replace(/'/g, '&#39;');
	    }
	
	    function withWidth(url, width) {
	      if (!url) return url;
	      var joiner = url.indexOf('?') === -1 ? '?' : '&';
	      return url + joiner + 'width=' + encodeURIComponent(String(width));
	    }

	    function formatMoney(cents) {
	      var amount = Number(cents || 0) / 100;
	      var currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'INR';

      try {
        return new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: currency,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(amount);
      } catch (error) {
        return 'Rs. ' + Math.round(amount).toLocaleString('en-IN');
      }
	    }

	    function getCurrentVariantId() {
	      var variantParam = null;

	      try {
	        variantParam = new URL(window.location.href).searchParams.get('variant');
	      } catch (error) {
	      }

	      var candidate = variantParam || currentVariantFromDom;
	      var parsed = Number(candidate);
	      return parsed && !isNaN(parsed) ? parsed : null;
	    }

	    function updateStorage() {
	      var currentVariantId = getCurrentVariantId();
	      var entries = getStoredItems().filter(function (entry) {
	        return entry && entry.handle && entry.handle !== currentHandle;
	      });

	      entries.unshift({
	        handle: currentHandle,
	        variantId: currentVariantId
	      });

	      entries = entries.slice(0, maxStored);
	      setStoredItems(entries);
	      return entries;
	    }

	    function findVariant(productData, preferredVariantId) {
	      if (!productData || !Array.isArray(productData.variants)) return null;

	      if (preferredVariantId) {
	        for (var i = 0; i < productData.variants.length; i++) {
	          if (Number(productData.variants[i].id) === Number(preferredVariantId)) return productData.variants[i];
	        }
	      }

	      for (var j = 0; j < productData.variants.length; j++) {
	        if (productData.variants[j] && productData.variants[j].available) return productData.variants[j];
	      }

	      return productData.variants[0] || null;
	    }

	    function productCardMarkup(productData, index) {
	      var selectedVariant = findVariant(productData, productData && productData._rvVariantId);
	      var selectedPrice = selectedVariant ? selectedVariant.price : productData.price;
	      var selectedCompareAt = selectedVariant ? selectedVariant.compare_at_price : productData.compare_at_price;
	      var selectedAvailable = selectedVariant ? selectedVariant.available : productData.available;

	      var productUrl = productData.url || ('/products/' + productData.handle);
	      if (selectedVariant && selectedVariant.id) productUrl += '?variant=' + encodeURIComponent(String(selectedVariant.id));

	      var imageUrl = productData.featured_image;
	      if (selectedVariant && selectedVariant.featured_image && selectedVariant.featured_image.src) {
	        imageUrl = selectedVariant.featured_image.src;
	      }

		      var image = imageUrl
		        ? '<img src="' +
		          escapeHtml(withWidth(imageUrl, 533)) +
		          '" alt="' +
		          escapeHtml(productData.title) +
		          '" loading="lazy" decoding="async" fetchpriority="low" class="motion-reduce" width="533" height="533">'
		        : '';
	      var isOnSale = selectedCompareAt && Number(selectedCompareAt) > Number(selectedPrice);
	      var soldOut = !selectedAvailable;
	      var badge = '';

      if (soldOut) {
        badge = '<span class="badge badge--bottom-left color-scheme-2">Sold out</span>';
      } else if (isOnSale) {
        badge = '<span class="badge badge--bottom-left color-scheme-1">Sale</span>';
      }

	      var comparePrice = isOnSale ? '<s class="price-item price-item--regular">' + formatMoney(selectedCompareAt) + '</s>' : '';

      return (
        '<li id="Slide-' + sectionId + '-' + (index + 1) + '" class="grid__item slider__slide">' +
          '<div class="card-wrapper product-card-wrapper underline-links-hover">' +
            '<div class="card card--standard card--media">' +
              '<div class="card__inner color-scheme-1 gradient ratio" style="--ratio-percent: 100%;">' +
                '<div class="card__media">' +
                  '<div class="media media--transparent">' +
                    '<a href="' + escapeHtml(productUrl) + '" class="full-unstyled-link" aria-label="' + escapeHtml(productData.title) + '">' + image + '</a>' +
                  '</div>' +
                '</div>' +
                '<div class="card__content"><div class="card__badge badge">' + badge + '</div></div>' +
              '</div>' +
              '<div class="card__content">' +
                '<div class="card__information">' +
                  '<h3 class="card__heading h5"><a class="full-unstyled-link" href="' + escapeHtml(productUrl) + '">' + escapeHtml(productData.title) + '</a></h3>' +
                  '<div class="card-information">' +
                    '<div class="price">' +
                      '<div class="price__container">' +
	                        '<div class="price__regular"><span class="price-item price-item--regular">' + formatMoney(selectedPrice) + '</span></div>' +
	                        '<div class="price__sale">' + comparePrice + '</div>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</li>'
      );
    }

    function renderProducts(products) {
      if (!grid || !emptyState) return;

      if (!products.length) {
        grid.hidden = true;
        emptyState.hidden = false;
        return;
      }

      grid.innerHTML = products.map(productCardMarkup).join('');
      grid.hidden = false;
      emptyState.hidden = true;

      if (sliderComponent && typeof sliderComponent.resetPages === 'function') {
        window.requestAnimationFrame(function () {
          sliderComponent.enableSliderLooping = true;
          sliderComponent.resetPages();
        });
      }
    }

	    function fetchProducts(handles) {
	      var requests = handles.map(function (entry) {
	        var url = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root ? window.Shopify.routes.root : '/') + 'products/' + encodeURIComponent(entry.handle) + '.js';
	        return fetch(url)
	          .then(function (response) {
	            if (!response.ok) return null;
	            return response.json();
          })
          .catch(function () {
            return null;
          });
	      });

	      Promise.all(requests).then(function (results) {
	        var validProducts = [];

	        results.forEach(function (productData, idx) {
	          if (!productData) return;
	          productData._rvVariantId = handles[idx] && handles[idx].variantId ? handles[idx].variantId : null;
	          validProducts.push(productData);
	        });

	        renderProducts(validProducts);
	      });
	    }

    if (!currentHandle) {
      renderProducts([]);
      return;
    }

	    var handles = updateStorage()
	      .filter(function (entry) {
	        return entry && entry.handle && entry.handle !== currentHandle;
	      })
	      .slice(0, limit);

    if (!handles.length) {
      renderProducts([]);
      return;
    }

	    fetchProducts(handles);
	    }
	
	    function scheduleStart() {
	      if ('requestIdleCallback' in window) {
	        window.requestIdleCallback(start, { timeout: 1500 });
	      } else {
	        window.setTimeout(start, 0);
	      }
	    }
	
	    if ('IntersectionObserver' in window) {
	      var io = new IntersectionObserver(
	        function (entries) {
	          for (var i = 0; i < entries.length; i++) {
	            if (entries[i].isIntersecting) {
	              io.disconnect();
	              scheduleStart();
	              return;
	            }
	          }
	        },
	        { rootMargin: '800px 0px' }
	      );
	      io.observe(section);
	    } else {
	      window.setTimeout(scheduleStart, 1500);
	    }
	  })();
