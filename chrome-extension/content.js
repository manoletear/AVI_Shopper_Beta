// AVI Shopper — Auto add to cart on Chilean supermarkets
// This script runs on product pages opened by AVI

(function () {
  const url = window.location.href;
  const params = new URLSearchParams(window.location.search);
  const aviAutoAdd = params.get('avi_add') === '1';
  const aviProductName = params.get('avi_product') || '';
  const isProductPage = url.includes('/ip/') || url.includes('/p?') || url.includes('/product/');
  const isSearchPage = url.includes('/search') || url.includes('/buscar') || url.includes('/busca');

  if (!aviAutoAdd) return;

  console.log('[AVI] Auto-add mode active, product:', aviProductName, 'isProductPage:', isProductPage);

  function waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  async function autoAdd() {
    // Prevent double execution
    if (document.querySelector('[data-avi-done]')) return;
    const marker = document.createElement('div');
    marker.setAttribute('data-avi-done', '1');
    marker.style.display = 'none';
    document.body.appendChild(marker);

    // Wait for page to fully load
    await new Promise((r) => setTimeout(r, 3000));

    let addButton = null;

    // Lider (super.lider.cl)
    if (url.includes('super.lider.cl')) {
      // Always look for the FIRST "Agregar" button only
      addButton = await waitForElement('[data-automation-id="add-to-cart"]');
      if (!addButton) {
        const btns = document.querySelectorAll('button');
        for (const btn of btns) {
          if (btn.textContent?.trim().match(/^\+?\s*Agregar$/i)) {
            addButton = btn;
            break;
          }
        }
      }
    }

    // Jumbo (jumbo.cl)
    if (url.includes('jumbo.cl')) {
      addButton = await waitForElement('button.vtex-add-to-cart-button, [class*="addToCart"], button:has(.vtex-button__label)');
      if (!addButton) {
        // Try generic Agregar button
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.trim().match(/^Agregar$/i)) {
            addButton = btn;
            break;
          }
        }
      }
    }

    // Unimarc
    if (url.includes('unimarc.cl')) {
      addButton = await waitForElement('[class*="add-to-cart"], [data-testid*="add"]');
      if (!addButton) {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.trim().match(/Agregar/i)) {
            addButton = btn;
            break;
          }
        }
      }
    }

    // Tottus
    if (url.includes('tottus.cl')) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        if (btn.textContent?.trim().match(/Agregar/i)) {
          addButton = btn;
          break;
        }
      }
    }

    // Santa Isabel (same as Jumbo — Cencosud)
    if (url.includes('santaisabel.cl')) {
      addButton = await waitForElement('button.vtex-add-to-cart-button');
      if (!addButton) {
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
          if (btn.textContent?.trim().match(/^Agregar$/i)) {
            addButton = btn;
            break;
          }
        }
      }
    }

    if (addButton) {
      console.log('[AVI] Found add button, clicking...');

      // Visual feedback
      addButton.style.outline = '3px solid #4F46E5';
      addButton.style.outlineOffset = '2px';
      await new Promise((r) => setTimeout(r, 500));

      addButton.click();

      console.log('[AVI] Product added to cart!');

      showAviNotification('Producto agregado al carrito');

      // Notify the AVI window to advance to next product
      if (window.opener) {
        window.opener.postMessage({ type: 'AVI_PRODUCT_ADDED', url }, '*');
      }
    } else {
      console.log('[AVI] Add button not found');
      showAviNotification('No se encontro el boton. Agregalo manualmente.');
    }
  }

  function showAviNotification(message) {
    const div = document.createElement('div');
    div.style.cssText = `
      position: fixed; top: 16px; right: 16px; z-index: 99999;
      background: #4F46E5; color: white; padding: 12px 20px;
      border-radius: 12px; font-family: -apple-system, sans-serif;
      font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      display: flex; align-items: center; gap: 8px;
      animation: aviSlideIn 0.3s ease-out;
    `;
    div.innerHTML = `<span style="font-size:18px">🛒</span> ${message}`;

    const style = document.createElement('style');
    style.textContent = `@keyframes aviSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`;
    document.head.appendChild(style);

    document.body.appendChild(div);
    setTimeout(() => div.remove(), 4000);
  }

  autoAdd();
})();
