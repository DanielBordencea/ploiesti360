/* Ploiești 360 – /admin/: formular pentru articole noi.
   Trimite articolul la worker-ul Cloudflare (worker/), care îl adaugă în data/stiri.json și publică site-ul. */
(function () {
  'use strict';
  var cfg = JSON.parse(document.getElementById('admin-cfg').textContent);
  var $ = function (id) { return document.getElementById(id); };
  var login = $('login'), form = $('articol'), gata = $('gata');
  var CHEIE = 'p360-parola';
  var poza = null; // data URL JPEG redimensionat

  function citeste() { try { return sessionStorage.getItem(CHEIE) || ''; } catch (e) { return ''; } }
  function salveaza(v) { try { if (v) sessionStorage.setItem(CHEIE, v); else sessionStorage.removeItem(CHEIE); } catch (e) {} }
  function arata(el) {
    [login, form, gata].forEach(function (x) { x.hidden = x !== el; });
    $('gestiune').hidden = el === login;
  }
  function eroare(el, msg) { el.querySelector('.admin__eroare').textContent = msg || ''; }

  function cerere(cale, corp) {
    return fetch(cfg.api + cale, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + encodeURIComponent(citeste()) },
      body: JSON.stringify(corp || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.eroare || 'Eroare ' + r.status); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  if (!cfg.api) { $('neconfigurat').hidden = false; return; }

  /* --- login --- */
  login.addEventListener('submit', function (ev) {
    ev.preventDefault();
    salveaza($('parola').value);
    eroare(login, '');
    cerere('/verifica').then(function () { arata(form); }).catch(function (e) {
      salveaza('');
      eroare(login, e.status === 401 ? 'Parolă greșită.' : 'Nu mă pot conecta. Încearcă din nou. (' + e.message + ')');
    });
  });
  arata(citeste() ? form : login);

  /* --- locație: „Alt loc” deschide câmpul liber --- */
  $('loc').addEventListener('change', function () {
    var alt = this.value === '__alt';
    $('locatie').hidden = !alt;
    $('locatie').required = alt;
    if (alt) $('locatie').focus();
  });

  /* --- poza: o micșorăm în browser (max. 1600px, JPEG), ca să urce repede și să nu încarce site-ul --- */
  $('poza').addEventListener('change', function () {
    var f = this.files && this.files[0];
    poza = null; $('poza-prev').hidden = true; eroare(form, '');
    if (!f) return;
    var img = new Image();
    var url = URL.createObjectURL(f);
    img.onload = function () {
      var max = 1600, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
      var c = document.createElement('canvas');
      c.width = Math.round(w * k); c.height = Math.round(h * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      poza = c.toDataURL('image/jpeg', 0.82);
      $('poza-prev').src = poza; $('poza-prev').hidden = false;
      URL.revokeObjectURL(url);
    };
    img.onerror = function () { eroare(form, 'Nu pot citi poza. Încearcă un fișier JPG sau PNG.'); URL.revokeObjectURL(url); };
    img.src = url;
  });

  /* --- publicare --- */
  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    eroare(form, '');
    var loc = $('loc').value;
    var date = {
      titlu: $('titlu').value.trim(),
      categorie: $('categorie').value,
      locSlug: loc && loc !== '__alt' ? loc : '',
      locatie: loc === '__alt' ? $('locatie').value.trim() : ($('loc').selectedOptions[0] || {}).text || '',
      text: $('text').value.trim(),
      autor: $('autor').value.trim(),
      imagine: poza
    };
    var lipsa = [];
    if (!date.titlu) lipsa.push('titlul');
    if (!date.imagine) lipsa.push('poza');
    if (!loc || (loc === '__alt' && !date.locatie)) lipsa.push('locația');
    if (date.text.length < 40) lipsa.push('textul (minim câteva rânduri)');
    if (!date.autor) lipsa.push('numele tău');
    if (lipsa.length) { eroare(form, 'Completează: ' + lipsa.join(', ') + '.'); return; }

    var btn = $('publica');
    btn.disabled = true; btn.textContent = 'Se publică…';
    cerere('/publica', date).then(function (r) {
      var link = cfg.siteUrl + '/stiri/' + r.slug + '/';
      $('gata-link').href = link; $('gata-link').textContent = link;
      form.reset(); poza = null; $('poza-prev').hidden = true; $('locatie').hidden = true;
      arata(gata);
    }).catch(function (e) {
      if (e.status === 401) { salveaza(''); arata(login); eroare(login, 'Parola nu mai e valabilă. Intră din nou.'); return; }
      eroare(form, 'Nu s-a publicat: ' + e.message);
    }).then(function () { btn.disabled = false; btn.textContent = 'Publică articolul'; });
  });

  $('altul').addEventListener('click', function () { arata(form); });

  /* --- ștergere --- */
  var gestiune = $('gestiune'), lista = $('lista');
  function deconectat() { salveaza(''); arata(login); eroare(login, 'Parola nu mai e valabilă. Intră din nou.'); }

  function incarcaLista() {
    var btn = $('incarca-lista');
    eroare(gestiune, '');
    btn.disabled = true; btn.textContent = 'Se încarcă…';
    cerere('/lista').then(function (r) {
      lista.textContent = '';
      if (!r.stiri.length) { lista.innerHTML = '<li class="mut">Nu există articole.</li>'; return; }
      r.stiri.forEach(function (s) {
        var li = document.createElement('li');
        var info = document.createElement('div');
        var a = document.createElement('a');
        a.href = cfg.siteUrl + '/stiri/' + s.slug + '/'; a.target = '_blank'; a.rel = 'noopener';
        a.textContent = s.titlu;
        var meta = document.createElement('small');
        meta.textContent = [s.data, s.categorie, s.autor ? 'de ' + s.autor : ''].filter(Boolean).join(' · ');
        info.appendChild(a); info.appendChild(meta);
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'btn btn--sterge'; b.textContent = 'Șterge';
        b.addEventListener('click', function () { stergeArticol(s, li, b); });
        li.appendChild(info); li.appendChild(b);
        lista.appendChild(li);
      });
    }).catch(function (e) {
      if (e.status === 401) return deconectat();
      eroare(gestiune, 'Nu pot încărca lista: ' + e.message);
    }).then(function () { btn.disabled = false; btn.textContent = 'Reîncarcă lista'; });
  }

  function stergeArticol(s, li, b) {
    if (!window.confirm('Sigur ștergi articolul „' + s.titlu + '”?\n\nDispare de pe site împreună cu poza lui.')) return;
    eroare(gestiune, '');
    b.disabled = true; b.textContent = 'Se șterge…';
    cerere('/sterge', { slug: s.slug }).then(function () {
      li.classList.add('admin__sters');
      li.querySelector('small').textContent = 'Șters. Dispare de pe site în 1–2 minute.';
      b.remove();
    }).catch(function (e) {
      if (e.status === 401) return deconectat();
      if (e.status === 404) { li.remove(); return; }
      eroare(gestiune, 'Nu s-a șters: ' + e.message);
      b.disabled = false; b.textContent = 'Șterge';
    });
  }

  $('incarca-lista').addEventListener('click', incarcaLista);
})();
