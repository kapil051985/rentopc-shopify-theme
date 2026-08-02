(() => {
  const overlay = document.getElementById('raq-overlay');
  if (!overlay) return;

  const nameEl = document.getElementById('raq-name');
  const phoneEl = document.getElementById('raq-phone');
  const emailEl = document.getElementById('raq-email');
  const productNameEl = document.getElementById('raq-product-name');
  const submitBtn = document.getElementById('raq-submit');
  const formWrap = document.getElementById('raq-form-wrap');
  const footer = document.getElementById('raq-footer');
  const success = document.getElementById('raq-success');

  const errName = document.getElementById('raq-name-err');
  const errPhone = document.getElementById('raq-phone-err');
  const errEmail = document.getElementById('raq-email-err');

  let lastActiveEl = null;

  function show(el) {
    el?.removeAttribute('hidden');
  }
  function hide(el) {
    el?.setAttribute('hidden', '');
  }

  function setFieldError(input, errEl, isError) {
    input?.classList.toggle('raq-error', isError);
    errEl?.classList.toggle('show', isError);
  }

  function resetState() {
    [nameEl, phoneEl, emailEl].forEach((el) => {
      if (!el) return;
      el.value = '';
      el.classList.remove('raq-error');
    });
    [errName, errPhone, errEmail].forEach((el) => el?.classList.remove('show'));
    show(formWrap);
    show(footer);
    hide(success);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Request';
  }

  function open(btn) {
    lastActiveEl = document.activeElement;
    const title = btn?.dataset?.productTitle || '';
    productNameEl.textContent = title;
    overlay.dataset.productId = btn?.dataset?.productId || '';
    overlay.dataset.variantId = btn?.dataset?.variantId || '';
    resetState();
    show(overlay);
    document.body.style.overflow = 'hidden';
    setTimeout(() => nameEl?.focus(), 50);
  }

  function close() {
    hide(overlay);
    document.body.style.overflow = '';
    setTimeout(() => {
      if (lastActiveEl && typeof lastActiveEl.focus === 'function') lastActiveEl.focus();
      lastActiveEl = null;
    }, 0);
  }

  function validate() {
    const name = nameEl.value.trim();
    const phoneDigits = phoneEl.value.replace(/\D/g, '');
    const email = emailEl.value.trim();

    let ok = true;

    const nameOk = name.length > 0;
    setFieldError(nameEl, errName, !nameOk);
    if (!nameOk) ok = false;

    const phoneOk = /\d{7,}/.test(phoneDigits);
    setFieldError(phoneEl, errPhone, !phoneOk);
    if (!phoneOk) ok = false;

    if (email) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      setFieldError(emailEl, errEmail, !emailOk);
      if (!emailOk) ok = false;
    } else {
      setFieldError(emailEl, errEmail, false);
    }

    return ok;
  }

  async function submit() {
    if (!validate()) return;

    submitBtn.textContent = 'Sending...';
    submitBtn.disabled = true;

    const payload = {
      name: nameEl.value.trim(),
      phone: phoneEl.value.trim(),
      email: emailEl.value.trim() || 'noemail@store.com',
      product: productNameEl.textContent || '',
      product_id: overlay.dataset.productId || '',
      variant_id: overlay.dataset.variantId || '',
      url: window.location.href,
    };

    const body = new URLSearchParams({
      form_type: 'contact',
      utf8: '\u2713',
      'contact[name]': payload.name,
      'contact[phone]': payload.phone,
      'contact[email]': payload.email,
      'contact[body]': `Quote request for: ${payload.product}\nProduct ID: ${payload.product_id}\nVariant ID: ${payload.variant_id}\nURL: ${payload.url}`,
    });

    try {
      const googleUrl = (window.RAQ_GOOGLE_SCRIPT_URL || '').trim();
      if (googleUrl) {
        const googleBody = new URLSearchParams({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          product: payload.product,
          product_id: payload.product_id,
          variant_id: payload.variant_id,
          url: payload.url,
        });

        const res = await fetch(googleUrl, {
          method: 'POST',
          mode: 'no-cors',
          // Apps Script web apps often don't send CORS headers; avoid preflight and rely on doPost.
          headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
          body: googleBody.toString(),
        });

        // In no-cors mode the response is opaque; if fetch resolves, assume success.

        hide(formWrap);
        hide(footer);
        show(success);
        submitBtn.textContent = 'Send Request';
        submitBtn.disabled = false;
        setTimeout(close, 3500);
        return;
      }
    } catch (e) {
      // If the Google Script call fails (CORS/deploy issues), fall back to Shopify /contact.
    }

    try {
      const res = await fetch('/contact', {
        method: 'POST',
        credentials: 'same-origin',
        redirect: 'follow',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        body: body.toString(),
      });

      const isProbablyOk = res.ok || (res.status >= 300 && res.status < 400);
      if (!isProbablyOk) throw new Error(`Request failed (${res.status})`);

      hide(formWrap);
      hide(footer);
      show(success);
      submitBtn.textContent = 'Send Request';
      submitBtn.disabled = false;
      setTimeout(close, 3500);
    } catch (e) {
      try {
        const iframeName = 'raq_contact_iframe';
        let iframe = document.querySelector(`iframe[name="${iframeName}"]`);
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.name = iframeName;
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
        }

        const form = document.createElement('form');
        form.action = '/contact';
        form.method = 'POST';
        form.target = iframeName;
        form.style.display = 'none';

        for (const [key, value] of body.entries()) {
          const input = document.createElement('input');
          input.type = 'hidden';
          input.name = key;
          input.value = value;
          form.appendChild(input);
        }

        const cleanup = () => {
          form.remove();
          iframe.removeEventListener('load', onLoad);
        };

        const onLoad = () => {
          cleanup();
          hide(formWrap);
          hide(footer);
          show(success);
          submitBtn.textContent = 'Send Request';
          submitBtn.disabled = false;
          setTimeout(close, 3500);
        };

        iframe.addEventListener('load', onLoad);
        document.body.appendChild(form);
        form.submit();
      } catch (e2) {
        submitBtn.textContent = 'Send Request';
        submitBtn.disabled = false;
        alert('Submission failed. Please try again.');
      }
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  document.querySelectorAll('.raq-close-btn').forEach((b) => {
    b.addEventListener('click', close);
  });

  submitBtn?.addEventListener('click', submit);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hasAttribute('hidden')) close();
  });

  window.RAQ = window.RAQ || {};
  window.RAQ.open = open;
})();
