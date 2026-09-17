/* Ploiești 360 — script comun: meniu mobil, filtre simple, formular */
(function () {
  'use strict';

  /* ----- meniu mobil ----- */
  var btn = document.querySelector('.meniu-btn');
  var nav = document.getElementById('nav-principal');
  if (btn && nav) {
    var inchide = function () {
      btn.setAttribute('aria-expanded', 'false');
      nav.classList.remove('deschis');
      document.body.classList.remove('meniu-deschis');
    };
    btn.addEventListener('click', function () {
      var deschis = btn.getAttribute('aria-expanded') === 'true';
      if (deschis) { inchide(); btn.focus(); return; }
      btn.setAttribute('aria-expanded', 'true');
      nav.classList.add('deschis');
      document.body.classList.add('meniu-deschis');
      var primul = nav.querySelector('a');
      if (primul) primul.focus();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { inchide(); btn.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 960) inchide(); });
  }

  /* ----- anul curent în subsol ----- */
  var an = document.querySelector('.js-an');
  if (an) an.textContent = String(new Date().getFullYear());

  /* ----- filtru restaurante / cafenele ----- */
  var lista = document.querySelector('[data-lista-locuri]');
  var chips = document.querySelectorAll('.chip[data-filtru]');
  if (lista && chips.length) {
    var gol = document.querySelector('[data-gol]');
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var f = chip.getAttribute('data-filtru') || '';
        chips.forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
        var vizibile = 0;
        lista.querySelectorAll('.card').forEach(function (card) {
          var ok = !f || card.getAttribute('data-subtip') === f;
          card.classList.toggle('ascuns', !ok);
          if (ok) vizibile++;
        });
        if (gol) gol.classList.toggle('gol--ascuns', vizibile > 0);
      });
    });
  }

  /* ----- pe Acasă: ascunde evenimentele deja trecute (dacă site-ul nu a fost regenerat) ----- */
  var listaAcasa = document.querySelector('[data-ascunde-trecute]');
  if (listaAcasa) {
    var azi = new Date().toISOString().slice(0, 10);
    var ramase = 0;
    listaAcasa.querySelectorAll('.ev').forEach(function (ev) {
      var sfarsit = ev.getAttribute('data-sfarsit') || ev.getAttribute('data-data');
      var trecut = sfarsit && sfarsit < azi;
      ev.classList.toggle('ascuns', !!trecut);
      if (!trecut) ramase++;
    });
    var golAcasa = document.querySelector('[data-gol]');
    if (golAcasa) golAcasa.classList.toggle('gol--ascuns', ramase > 0);
  }

  /* ----- mesaj de confirmare formular (după redirect ?trimis=1) ----- */
  var ok = document.querySelector('[data-formular-ok]');
  if (ok && /[?&]trimis=1/.test(location.search)) {
    ok.classList.remove('gol--ascuns');
    ok.setAttribute('tabindex', '-1');
    ok.focus();
  }
})();
