// AVI Shopper Safari Extension — Content Script
// Runs on supermarket pages, adds products to cart

(function() {
  const url = window.location.href;
  const params = new URLSearchParams(window.location.search);
  const aviAutoAdd = params.get('avi_add') === '1';

  if (!aviAutoAdd) return;
  if (document.querySelector('[data-avi-done]')) return;

  const marker = document.createElement('div');
  marker.setAttribute('data-avi-done', '1');
  marker.style.display = 'none';
  document.body.appendChild(marker);

  console.log('[AVI Safari] Auto-add active');

  function waitForElement(selector, timeout) {
    timeout = timeout || 10000;
    return new Promise(function(resolve) {
      var el = document.querySelector(selector);
      if (el) return resolve(el);
      var observer = new MutationObserver(function() {
        el = document.querySelector(selector);
        if (el) { observer.disconnect(); resolve(el); }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(function() { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  async function autoAdd() {
    await new Promise(function(r) { setTimeout(r, 3000); });

    var addButton = null;
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var text = (buttons[i].textContent || '').trim();
      if (text.match(/^\+?\s*Agregar/i)) {
        addButton = buttons[i];
        break;
      }
    }

    if (!addButton) {
      addButton = await waitForElement('[data-automation-id="add-to-cart"], [data-automation-id="atc"]');
    }

    if (addButton) {
      addButton.style.outline = '3px solid #4F46E5';
      addButton.style.outlineOffset = '2px';
      await new Promise(function(r) { setTimeout(r, 500); });
      addButton.click();
      await new Promise(function(r) { setTimeout(r, 2000); });

      showNotification('Producto agregado al carrito');

      if (window.opener) {
        window.opener.postMessage({ type: 'AVI_PRODUCT_ADDED', url: url }, '*');
      }
      browser.runtime.sendMessage({ type: 'AVI_PRODUCT_ADDED', name: document.title });
    } else {
      showNotification('No se encontro el boton. Agregalo manualmente.');
    }
  }

  function showNotification(message) {
    var div = document.createElement('div');
    div.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;background:#4F46E5;color:white;padding:12px 20px;border-radius:12px;font-family:-apple-system,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.2);display:flex;align-items:center;gap:8px;';
    div.innerHTML = '<span style="font-size:18px">🛒</span> ' + message;
    document.body.appendChild(div);
    setTimeout(function() { div.remove(); }, 4000);
  }

  // Handle checkout pages
  async function autoCheckout() {
    if (!url.includes('/cart') && !url.includes('/checkout')) return;
    await new Promise(function(r) { setTimeout(r, 3000); });

    var buttons = document.querySelectorAll('button, a');
    for (var i = 0; i < buttons.length; i++) {
      var text = (buttons[i].textContent || '').trim();
      if (text.match(/^(Pagar|Confirmar pedido|Finalizar compra|Confirmar y pagar)$/i)) {
        showNotification('AVI llego al pago. Confirma: ' + text);
        buttons[i].style.outline = '4px solid #4F46E5';
        buttons[i].style.outlineOffset = '4px';
        buttons[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (text.match(/^(Continuar|Siguiente|Continuar al pago|Ir al pago)$/i)) {
        showNotification('AVI avanzando...');
        buttons[i].click();
        return;
      }
    }
  }

  if (url.includes('/cart') || url.includes('/checkout')) {
    autoCheckout();
  } else {
    autoAdd();
  }
})();
