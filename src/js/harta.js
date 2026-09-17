/* Ploiești 360 — hartă Leaflet cu filtre pe categorie */
(function () {
  'use strict';
  var el = document.getElementById('harta');
  var dateEl = document.getElementById('date-locuri');
  if (!el || !dateEl) return;

  var puncte;
  try { puncte = JSON.parse(dateEl.textContent); } catch (e) { return; }

  function init() {
    if (typeof L === 'undefined') { setTimeout(init, 100); return; }
    el.innerHTML = '';
    var harta = L.map(el, { scrollWheelZoom: false, zoomControl: true }).setView([44.9415, 26.0208], 14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(harta);
    harta.on('focus', function () { harta.scrollWheelZoom.enable(); });
    harta.on('blur', function () { harta.scrollWheelZoom.disable(); });

    var markere = {};
    var straturi = {};
    puncte.forEach(function (p) {
      var icon = L.divIcon({ className: 'pin-wrap', html: '<span class="pin pin--' + p.cat + '" title="' + p.nume.replace(/"/g, '&quot;') + '"></span>', iconSize: [22, 22], iconAnchor: [4, 22], popupAnchor: [7, -20] });
      var m = L.marker([p.lat, p.lng], { icon: icon, alt: p.nume, keyboard: true, title: p.nume });
      var html = '<p class="popup__cat">' + p.eticheta + ' · ' + p.catNume + '</p>' +
        '<h3 class="popup__titlu">' + p.nume + '</h3>' +
        '<p class="popup__adr">' + p.adresa + (p.aprox ? ' <em>(poziție aproximativă)</em>' : '') + '</p>' +
        '<a class="popup__link" href="' + p.url + '">Vezi fișa</a>' +
        (p.maps ? '<a class="popup__link popup__link--alt" href="' + p.maps + '" target="_blank" rel="noopener">Google Maps</a>' : '');
      m.bindPopup(html);
      if (!straturi[p.cat]) straturi[p.cat] = L.layerGroup().addTo(harta);
      straturi[p.cat].addLayer(m);
      markere[p.slug] = m;
    });

    var chips = document.querySelectorAll('[data-filtre-harta] .chip[data-cat]');
    var itemiLista = document.querySelectorAll('[data-lista-harta] li');
    function filtreaza(cat) {
      chips.forEach(function (c) { c.setAttribute('aria-pressed', (c.getAttribute('data-cat') || '') === cat ? 'true' : 'false'); });
      Object.keys(straturi).forEach(function (k) {
        if (!cat || k === cat) { straturi[k].addTo(harta); } else { harta.removeLayer(straturi[k]); }
      });
      itemiLista.forEach(function (li) { li.classList.toggle('ascuns', !!cat && li.getAttribute('data-cat') !== cat); });
      var vizibile = puncte.filter(function (p) { return !cat || p.cat === cat; });
      if (vizibile.length) {
        harta.fitBounds(vizibile.map(function (p) { return [p.lat, p.lng]; }), { padding: [30, 30], maxZoom: 16 });
      }
    }
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () { filtreaza(chip.getAttribute('data-cat') || ''); });
    });

    function arata(slug) {
      var m = markere[slug];
      if (!m) return;
      filtreaza('');
      harta.setView(m.getLatLng(), 17, { animate: true });
      m.openPopup();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    document.querySelectorAll('[data-arata]').forEach(function (b) {
      b.addEventListener('click', function () { arata(b.getAttribute('data-arata')); });
    });

    var params = new URLSearchParams(location.search);
    if (params.get('loc') && markere[params.get('loc')]) {
      var m = markere[params.get('loc')];
      harta.setView(m.getLatLng(), 17);
      m.openPopup();
    } else if (params.get('cat') && straturi[params.get('cat')]) {
      filtreaza(params.get('cat'));
    } else {
      filtreaza('');
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
