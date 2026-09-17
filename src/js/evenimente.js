/* Ploiești 360 — filtrare evenimente după perioadă și categorie (fără librării) */
(function () {
  'use strict';
  var lista = document.getElementById('lista-evenimente');
  var form = document.querySelector('[data-filtre-ev]');
  if (!lista || !form) return;

  var select = form.querySelector('#perioada');
  var chips = form.querySelectorAll('.chip[data-cat]');
  var gol = document.querySelector('[data-gol]');
  var numar = document.querySelector('[data-numar]');
  var itemi = Array.prototype.slice.call(lista.querySelectorAll('.ev'));

  function iso(d) { return d.toISOString().slice(0, 10); }
  function plusZile(n) { var d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
  var azi = iso(new Date());
  var acum = new Date();
  var sfLuna = iso(new Date(acum.getFullYear(), acum.getMonth() + 1, 0));

  var stare = { perioada: 'viitoare', cat: '' };

  /* parametri din URL: /evenimente/?cat=Concert&perioada=toate */
  var params = new URLSearchParams(location.search);
  if (params.get('cat')) stare.cat = params.get('cat');
  if (params.get('perioada')) stare.perioada = params.get('perioada');

  function inPerioada(ev) {
    var start = ev.getAttribute('data-data');
    var sfarsit = ev.getAttribute('data-sfarsit') || start;
    switch (stare.perioada) {
      case 'viitoare': return sfarsit >= azi;
      case 'saptamana': return sfarsit >= azi && start <= plusZile(7);
      case 'luna': return sfarsit >= azi && start <= sfLuna;
      case 'trecute': return sfarsit < azi;
      default: return true;
    }
  }

  function aplica() {
    var vizibile = 0;
    itemi.forEach(function (ev) {
      var ok = inPerioada(ev) && (!stare.cat || ev.getAttribute('data-cat') === stare.cat);
      ev.classList.toggle('ascuns', !ok);
      if (ok) vizibile++;
    });
    /* evenimentele trecute se afișează cele mai recente primele */
    if (stare.perioada === 'trecute') {
      itemi.slice().reverse().forEach(function (ev) { lista.appendChild(ev); });
    } else {
      itemi.forEach(function (ev) { lista.appendChild(ev); });
    }
    if (gol) gol.classList.toggle('gol--ascuns', vizibile > 0);
    if (numar) numar.textContent = vizibile === 1 ? '1 eveniment' : vizibile + ' evenimente';
    chips.forEach(function (c) { c.setAttribute('aria-pressed', (c.getAttribute('data-cat') || '') === stare.cat ? 'true' : 'false'); });
    if (select) select.value = stare.perioada;
    var url = new URL(location.href);
    if (stare.cat) url.searchParams.set('cat', stare.cat); else url.searchParams.delete('cat');
    if (stare.perioada !== 'viitoare') url.searchParams.set('perioada', stare.perioada); else url.searchParams.delete('perioada');
    history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  }

  if (select) select.addEventListener('change', function () { stare.perioada = select.value; aplica(); });
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () { stare.cat = chip.getAttribute('data-cat') || ''; aplica(); });
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  /* dacă URL-ul are #id-eveniment, arată-l indiferent de filtru */
  if (location.hash) {
    var tinta = document.getElementById(location.hash.slice(1));
    if (tinta && tinta.classList.contains('ev')) stare.perioada = 'toate';
  }
  aplica();
})();
