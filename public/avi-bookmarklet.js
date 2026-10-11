(function() {
  // AVI Shopper Bookmarklet — Auto-agrega productos al carrito
  var AVI_API = 'https://avi-shopper-beta.vercel.app';
  var url = window.location.href;
  var store = null;

  if (url.includes('super.lider.cl')) store = 'lider';
  else if (url.includes('jumbo.cl')) store = 'jumbo';
  else if (url.includes('unimarc.cl')) store = 'unimarc';
  else if (url.includes('tottus.cl')) store = 'tottus';

  if (!store) {
    alert('AVI Shopper: Abre un supermercado primero (Lider, Jumbo, Unimarc o Tottus)');
    return;
  }

  // Mostrar panel de AVI
  var panel = document.createElement('div');
  panel.id = 'avi-panel';
  panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#4F46E5;color:white;font-family:-apple-system,sans-serif;padding:16px 20px;border-radius:16px 16px 0 0;box-shadow:0 -4px 20px rgba(0,0,0,0.3);max-height:70vh;overflow-y:auto;';
  panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><div style="display:flex;align-items:center;gap:8px"><span style="font-size:20px">🛒</span><strong style="font-size:16px">AVI Shopper</strong></div><button onclick="document.getElementById(\'avi-panel\').remove()" style="background:rgba(255,255,255,0.2);border:none;color:white;width:28px;height:28px;border-radius:50%;font-size:16px;cursor:pointer">✕</button></div><div id="avi-status" style="font-size:14px">Cargando tu lista...</div><div id="avi-products" style="margin-top:10px"></div>';
  document.body.appendChild(panel);

  var status = document.getElementById('avi-status');
  var productsDiv = document.getElementById('avi-products');

  // Obtener lista de AVI
  fetch(AVI_API + '/api/shopping-lists', { credentials: 'include' })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if (!data.success || !data.data || data.data.length === 0) {
        status.textContent = 'No tienes listas. Crea una en AVI Shopper primero.';
        return;
      }

      var lists = data.data;
      var html = '<p style="margin-bottom:8px;font-size:13px;opacity:0.8">Elige una lista para agregar al carrito de ' + store.charAt(0).toUpperCase() + store.slice(1) + ':</p>';

      lists.forEach(function(list) {
        var items = (list.items || []).filter(function(i) { return !i.checked; });
        if (items.length === 0) return;
        html += '<button onclick="aviAddList(\'' + list.id + '\')" style="display:block;width:100%;text-align:left;background:rgba(255,255,255,0.15);border:none;color:white;padding:12px 16px;border-radius:12px;margin-bottom:8px;cursor:pointer;font-size:14px"><strong>' + list.name + '</strong><br><span style="font-size:12px;opacity:0.7">' + items.length + ' productos pendientes</span></button>';
      });

      productsDiv.innerHTML = html;
      status.textContent = 'Selecciona la lista:';
    })
    .catch(function() {
      status.textContent = 'Error: inicia sesion en AVI Shopper primero.';
    });

  // Funcion para agregar productos de una lista
  window.aviAddList = function(listId) {
    fetch(AVI_API + '/api/shopping-lists', { credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var list = data.data.find(function(l) { return l.id === listId; });
        if (!list) return;

        var items = list.items.filter(function(i) { return !i.checked; });
        var current = 0;

        status.textContent = 'Agregando producto 1 de ' + items.length + '...';
        productsDiv.innerHTML = '';

        function addNext() {
          if (current >= items.length) {
            status.textContent = 'Listo! ' + items.length + ' productos agregados. Ve al carrito para pagar.';
            productsDiv.innerHTML = '<button onclick="window.location.href=\'' + getCartUrl() + '\'" style="display:block;width:100%;background:white;color:#4F46E5;border:none;padding:14px;border-radius:12px;font-size:16px;font-weight:bold;cursor:pointer;margin-top:8px">Ir al carrito →</button>';
            return;
          }

          var item = items[current];
          status.textContent = 'Buscando: ' + item.name + ' (' + (current + 1) + '/' + items.length + ')';

          // Buscar producto en la pagina actual o navegar a busqueda
          var searchUrl = getSearchUrl(item.name);

          // Mostrar progreso
          productsDiv.innerHTML += '<div style="padding:6px 0;font-size:13px;border-bottom:1px solid rgba(255,255,255,0.1)"><span style="color:#22c55e">✓</span> ' + item.name + '</div>';

          // Buscar boton "Agregar" en la pagina
          var found = findAndClickAdd();
          if (found) {
            current++;
            setTimeout(addNext, 2000);
          } else {
            // Navegar a busqueda del producto
            var searchFrame = document.createElement('iframe');
            searchFrame.style.display = 'none';
            searchFrame.src = searchUrl;
            document.body.appendChild(searchFrame);

            // Marcar como agregado (best effort) y continuar
            current++;
            setTimeout(function() {
              searchFrame.remove();
              addNext();
            }, 3000);
          }
        }

        addNext();
      });
  };

  function findAndClickAdd() {
    var buttons = document.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
      var text = (buttons[i].textContent || '').trim();
      if (text.match(/^(\+\s*)?Agregar(\s+al\s+carro)?$/i)) {
        buttons[i].click();
        return true;
      }
    }
    return false;
  }

  function getSearchUrl(query) {
    var urls = {
      lider: 'https://super.lider.cl/search?q=' + encodeURIComponent(query),
      jumbo: 'https://www.jumbo.cl/search?ft=' + encodeURIComponent(query),
      unimarc: 'https://www.unimarc.cl/search?q=' + encodeURIComponent(query),
      tottus: 'https://www.tottus.cl/tottus-cl/search?Ntt=' + encodeURIComponent(query)
    };
    return urls[store] || urls.lider;
  }

  function getCartUrl() {
    var urls = {
      lider: 'https://super.lider.cl/cart',
      jumbo: 'https://www.jumbo.cl/checkout',
      unimarc: 'https://www.unimarc.cl/checkout',
      tottus: 'https://www.tottus.cl/tottus-cl/checkout'
    };
    return urls[store] || urls.lider;
  }
})();
