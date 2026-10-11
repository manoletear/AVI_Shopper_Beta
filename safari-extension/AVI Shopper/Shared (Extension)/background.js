// AVI Shopper Safari Extension — Background Service Worker
// Polls AVI Shopper API for pending cart commands

const AVI_API = 'https://avi-shopper-beta.vercel.app';
let pollingInterval = null;

browser.action.onClicked.addListener(async (tab) => {
  // When user taps the extension icon, start the cart flow
  try {
    const res = await fetch(`${AVI_API}/api/cart-command`, {
      credentials: 'include',
    });
    const data = await res.json();

    if (data.success && data.data?.items?.length > 0) {
      // Send products to the content script
      await browser.tabs.sendMessage(tab.id, {
        type: 'AVI_ADD_PRODUCTS',
        items: data.data.items,
        store: data.data.store,
      });
    }
  } catch (e) {
    console.error('[AVI Background] Error:', e);
  }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'AVI_PRODUCT_ADDED') {
    console.log('[AVI Background] Product added:', msg.name);
  }
  if (msg.type === 'AVI_CART_COMPLETE') {
    console.log('[AVI Background] Cart complete');
  }
});
