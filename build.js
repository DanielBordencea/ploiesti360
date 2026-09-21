#!/usr/bin/env node
/*
  Ploiești 360 — generator de site static.
  Citește datele din /data/*.json, generează HTML în /dist și copiază /src (css, js, img, fonts).
  Rulează:  node build.js
*/
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(ROOT, 'data');

const readJSON = f => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));
const site = readJSON('site.json');
const toateLocurile = readJSON('locuri.json');
const locuri = toateLocurile.filter(l => l.publicat !== false);
const evenimente = readJSON('evenimente.json').slice().sort((a, b) => a.data.localeCompare(b.data));
const stiri = readJSON('stiri.json').slice().sort((a, b) => b.data.localeCompare(a.data));
const crediteFoto = readJSON('credite-foto.json');
/* postări Instagram luate cu `node tools/instagram.js`; lipsa fișierului = grilă-placeholder */
const instagram = fs.existsSync(path.join(DATA, 'instagram.json')) ? readJSON('instagram.json') : { postari: [] };
const creditFoto = rel => crediteFoto.find(c => c.fisier === rel);

const AZI = new Date().toISOString().slice(0, 10);
/* Poți suprascrie din mediu: SITE_URL (domeniul public) și BASE_PATH (subfolder, ex. /ploiesti360 pe GitHub Pages) */
const SITE_URL = String(process.env.SITE_URL || site.url || '').replace(/\/$/, '');
const BASE = String(process.env.BASE_PATH !== undefined ? process.env.BASE_PATH : (site.basePath || '')).replace(/\/$/, '');
const abs = p => SITE_URL + p;
/* rescrie căile absolute (/css/..., /atractii/...) cu prefixul BASE, dacă există */
const cuBase = html => BASE ? html.replace(/(href|src|action)="\/(?!\/)/g, `$1="${BASE}/`).replace(/"url":"\//g, `"url":"${BASE}/`) : html;

/* ---------- categorii ---------- */
const CATEGORII = {
  'atractii': {
    nume: 'Atracții',
    title: 'Atracții și obiective turistice în Ploiești',
    meta: 'Ce să vizitezi în Ploiești: Muzeul Ceasului, Halele Centrale, Palatul Culturii, Muzeul Județean și alte obiective turistice din Ploiești, cu adresă, program și poveste.',
    h1: 'Atracții în Ploiești',
    intro: 'Muzee unice în România, o piață-monument deschisă din 1935 și un bulevard de plimbat. Uite ce să vizitezi în Ploiești, cu adresă, program și povestea fiecărui loc.',
    keywords: 'obiective turistice Ploiești, ce să vizitezi în Ploiești, muzee Ploiești',
    icon: 'muzeu'
  },
  'cladiri-istorice': {
    nume: 'Clădiri istorice',
    title: 'Clădiri istorice din Ploiești',
    meta: 'Clădiri istorice din Ploiești: Muzeul Județean, Palatul Administrației Financiare, casele memoriale Nichita Stănescu și I.L. Caragiale. Povești, adrese și program de vizitare.',
    h1: 'Clădiri istorice din Ploiești',
    intro: 'Case boierești transformate în muzee, palate interbelice și școli neoclasice. Fiecare clădire de mai jos are o poveste pe care merită să o știi înainte să treci pe lângă ea.',
    keywords: 'clădiri istorice Ploiești, muzee Ploiești',
    icon: 'cladire'
  },
  'restaurante-cafenele': {
    nume: 'Restaurante & cafenele',
    title: 'Restaurante și cafenele în Ploiești, sortate după rating Google',
    meta: 'Restaurante Ploiești și cafenele Ploiești, sortate după ratingul Google: Cafeneaua Nației, Cafeneaua lui Caragiale, Piagi, Zaț, Interbelic by Zexe, Trattoria by MRS, Opera, Prestij, Best.',
    h1: 'Restaurante & cafenele în Ploiești',
    intro: 'Unde mănânci și unde bei cea mai bună cafea din Ploiești. Lista e sortată descrescător după ratingul Google, iar la egalitate după numărul de recenzii.',
    keywords: 'restaurante Ploiești, cafenele Ploiești',
    icon: 'cafea'
  },
  'parcuri': {
    nume: 'Parcuri & zone verzi',
    title: 'Parcuri și zone verzi în Ploiești',
    meta: 'Parcuri Ploiești: Parcul Mihai Viteazul, Parcul Central, Parcul Toma Socolescu și Parcul Municipal Vest. Unde te plimbi, alergi sau stai pe iarbă în Ploiești.',
    h1: 'Parcuri & zone verzi în Ploiești',
    intro: 'De la parcul din jurul statuii lui Mihai Viteazul până la lacurile din Parcul Municipal Vest. Locurile verzi în care ploieștenii își petrec weekendul.',
    keywords: 'parcuri Ploiești, weekend în Ploiești',
    icon: 'parc'
  }
};

const NAV = [
  ['/', 'Acasă'],
  ['/atractii/', 'Atracții'],
  ['/cladiri-istorice/', 'Clădiri istorice'],
  ['/restaurante-cafenele/', 'Restaurante & cafenele'],
  ['/parcuri/', 'Parcuri'],
  ['/evenimente/', 'Evenimente'],
  ['/stiri/', 'Știri'],
  ['/harta/', 'Hartă'],
  ['/despre/', 'Despre noi']
];

/* ---------- utilitare text ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PH = /\[(DE VERIFICAT|DE CONFIRMAT|RATING DE VERIFICAT|EXEMPLU|LINK INSTAGRAM|LINK FACEBOOK|LINK TIKTOK|EMAIL|NUMELE CORECT)[^\]]*\]/g;
const isPH = s => /^\[[^\]]*\]$/.test(String(s || '').trim());
const fmt = s => esc(cleanPH(s)); // marcajele [DE VERIFICAT] rămân în JSON ca listă de lucru, dar nu se afișează
const cleanPH = s => String(s || '').replace(PH, '').replace(/\s+/g, ' ').replace(/\s+([,.;])/g, '$1').trim();
function inline(s) {
  let t = fmt(s);
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, txt, href) => `<a href="${esc(href)}">${txt}</a>`);
  return t;
}
const paragrafe = arr => (arr || []).map(p => {
  if (p.startsWith('## ')) return `<h2>${inline(p.slice(3))}</h2>`;
  if (p.startsWith('### ')) return `<h3>${inline(p.slice(4))}</h3>`;
  return `<p>${inline(p)}</p>`;
}).join('\n');

const LUNI = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const LUNI_SCURT = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sept', 'oct', 'nov', 'dec'];
const ZILE = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă'];
const parts = iso => iso.split('-').map(Number);
const dataRo = iso => { const [y, m, d] = parts(iso); return `${d} ${LUNI[m - 1]} ${y}`; };
const dataRoNum = iso => { const [y, m, d] = parts(iso); return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`; };
const ziSapt = iso => ZILE[new Date(iso + 'T12:00:00').getDay()];
const nrRo = n => Number(n).toLocaleString('ro-RO');

const locUrl = loc => `/${loc.categorie}/${loc.slug}/`;
const bySlug = Object.fromEntries(locuri.map(l => [l.slug, l]));

/* ---------- imagini & placeholdere ---------- */
const placeholdereScrise = new Set();
function svgPlaceholder(eticheta, fisier) {
  const linii = [];
  let seed = 7;
  const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let y = 26; y < 600; y += 16) {
    let x = 20;
    while (x < 780) { const w = 18 + Math.floor(rnd() * 70); if (x + w > 780) break; linii.push(`<rect x="${x}" y="${y}" width="${w}" height="6" rx="2"/>`); x += w + 9; }
  }
  const nume = esc(eticheta).slice(0, 34);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600" role="img" aria-label="${nume}">
<rect width="800" height="600" fill="#EFE6D2"/>
<g fill="#5b5648" opacity=".28">${linii.join('')}</g>
<g transform="rotate(-2 400 300)">
<rect x="150" y="205" width="500" height="190" fill="#1C2B5D"/>
<text x="400" y="278" text-anchor="middle" font-family="Impact, 'Arial Narrow', Arial, sans-serif" font-size="46" fill="#FFC107" letter-spacing="2">FOTO ÎN CURÂND</text>
<text x="400" y="326" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#fff">${nume}</text>
<text x="400" y="364" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="15" fill="#FFC107">${esc(fisier)}</text>
</g>
<g fill="#D61818"><path d="M712 44l-26 30 32-6z"/><path d="M742 62l-30 8 20 22z"/><path d="M700 22l-6 26 24-14z"/></g>
</svg>`;
}
function imagine(rel, eticheta) {
  if (fs.existsSync(path.join(SRC, 'img', rel))) return '/img/' + rel;
  const nume = rel.replace(/[\\/]/g, '--').replace(/\.[a-z0-9]+$/i, '') + '.svg';
  if (!placeholdereScrise.has(nume)) {
    const out = path.join(DIST, 'img', 'placeholder', nume);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, svgPlaceholder(eticheta, rel));
    placeholdereScrise.add(nume);
  }
  return '/img/placeholder/' + nume;
}
/* legendă vizibilă cu autorul pozei (obligatoriu pentru licențele CC BY / CC BY-SA) */
function creditCaption(rel, alt) {
  const c = creditFoto(rel);
  if (!c || !fs.existsSync(path.join(SRC, 'img', rel))) return `<figcaption class="vizual-ascuns">${esc(alt)}</figcaption>`;
  return `<figcaption class="foto-credit">Foto: <a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.autor)}</a>, ${esc(c.licenta)}, ${esc(c.sursa)}</figcaption>`;
}
const SAILORS_EXISTA = ['Sailors.woff2', 'Sailors.otf'].some(f => fs.existsSync(path.join(SRC, 'fonts', f)));
const OG_IMPLICIT = fs.existsSync(path.join(SRC, 'img', 'og', 'ploiesti-360-og.png')) ? '/img/og/ploiesti-360-og.png' : '/img/logo-ploiesti-360.png';

/* ---------- canale de contact: doar Instagram și Facebook ---------- */
const RETELE = [['instagram', 'Instagram'], ['facebook', 'Facebook']];
const socialUrl = k => (isPH(site.social[k]) || !site.social[k]) ? '/despre/#contact' : site.social[k];

/* ---------- SVG decorative (inline, fără imagini externe) ---------- */
const SVG = {
  underline: (cls = '') => `<svg class="subl ${cls}" viewBox="0 0 320 28" aria-hidden="true" focusable="false"><path d="M6 15c50-8 110 9 170 2s90-9 138-4" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><path d="M52 24c60-6 130 4 196-3" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/></svg>`,
  burst: (cls = '') => `<svg class="burst ${cls}" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><g fill="none" stroke="#D61818" stroke-width="7" stroke-linecap="round"><path d="M32 8v17"/><path d="M9 19l14 10"/><path d="M55 19L41 29"/></g></svg>`,
  wedges: (cls = '') => `<svg class="wedges ${cls}" viewBox="0 0 72 72" aria-hidden="true" focusable="false"><g fill="#D61818"><path d="M6 34l30 4-22 12z"/><path d="M16 8l22 20-18 6z"/><path d="M44 4l4 26-16-8z"/></g></svg>`,
  arrow: (cls = '') => `<svg class="sageata ${cls}" viewBox="0 0 90 60" aria-hidden="true" focusable="false"><path d="M6 8c14 30 38 44 68 42" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M58 34l16 16-18 6" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  arrowRight: `<svg class="ico-sageata" viewBox="0 0 48 24" aria-hidden="true" focusable="false"><path d="M3 13c12-5 24-5 38-1" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/><path d="M32 5l10 7-9 8" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  star: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 2l3 7 7 .6-5.3 4.6L18.5 22 12 18l-6.5 4 1.8-7.8L2 9.6 9 9z" fill="currentColor"/></svg>`,
  pin: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 22s7-7.2 7-12.5A7 7 0 0 0 5 9.5C5 14.8 12 22 12 22z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="9.5" r="2.5" fill="currentColor"/></svg>`,
  clock: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  phone: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 3h4l2 5-2.5 1.5a11 11 0 0 0 5 5L16 12l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 5a2 2 0 0 1 2-2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`,
  globe: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  cal: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 10h18M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  tag: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 12V4h8l10 10-8 8z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="7.5" cy="8.5" r="1.5" fill="currentColor"/></svg>`,
  instagram: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>`,
  facebook: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z" fill="currentColor"/></svg>`,
  cat: {
    muzeu: `<svg class="ico-cat" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M8 26L32 12l24 14H8zM12 30h40M14 34v16M24 34v16M40 34v16M50 34v16M8 54h48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    cladire: `<svg class="ico-cat" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M14 54V18l18-8 18 8v36M22 26h6M36 26h6M22 36h6M36 36h6M22 46h6M36 46h6M8 54h48" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    cafea: `<svg class="ico-cat" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M12 26h32v12a12 12 0 0 1-12 12h-8a12 12 0 0 1-12-12zM44 30h5a6 6 0 0 1 0 12h-5M10 56h40M22 12c-3 4 3 6 0 10M30 12c-3 4 3 6 0 10" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    parc: `<svg class="ico-cat" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 8l14 20h-8l10 14H16l10-14h-8zM32 42v14M12 56h40" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    eveniment: `<svg class="ico-cat" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect x="10" y="14" width="44" height="40" rx="3" fill="none" stroke="currentColor" stroke-width="3.5"/><path d="M10 26h44M22 8v10M42 8v10M20 36h6M29 36h6M38 36h6M20 45h6M29 45h6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/></svg>`,
    stiri: `<svg class="ico-cat" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M12 12h40v40H12zM18 20h14v12H18zM38 20h8M38 28h8M18 40h28M18 46h20" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    harta: `<svg class="ico-cat" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M8 16l16-6 16 6 16-6v38l-16 6-16-6-16 6zM24 10v38M40 16v38" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"/></svg>`
  }
};

/* ---------- layout ---------- */
function layout({ title, description, urlPath, body, jsonld = [], bodyClass = '', scripts = [], ogImage, ogType = 'website', headExtra = '' }) {
  const canonical = abs(urlPath);
  const og = abs(ogImage || OG_IMPLICIT);
  const nav = NAV.map(([href, label]) => {
    const activ = href === '/' ? urlPath === '/' : urlPath.startsWith(href);
    return `<li><a href="${href}"${activ ? ' aria-current="page"' : ''}>${esc(label)}</a></li>`;
  }).join('');
  const social = RETELE.map(([k, label]) => {
    const v = site.social[k];
    const href = isPH(v) ? '#' : v;
    return `<a class="social__link" href="${esc(href)}" ${isPH(v) ? `title="${esc(v)}"` : 'target="_blank" rel="noopener"'} aria-label="${label}">${SVG[k]}<span>${label}</span></a>`;
  }).join('');
  const ld = jsonld.filter(Boolean).map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="robots" content="index, follow, max-image-preview:large">
<meta name="theme-color" content="#1C2B5D">
<meta property="og:locale" content="ro_RO">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${esc(site.nume)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${og}">
<meta property="og:image:alt" content="${esc(site.nume)} – ${esc(site.slogan)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/img/logo-ploiesti-360.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;700&display=swap">
${SAILORS_EXISTA ? '<link rel="stylesheet" href="/css/sailors.css">' : '<!-- Font Sailors: pune Sailors.woff2 în /src/fonts/ și rulează node build.js -->'}
<link rel="stylesheet" href="/css/style.css">
${headExtra}
${ld}
</head>
<body class="${bodyClass}">
<a class="skip" href="#continut">Sari la conținut</a>
<header class="antet">
  <div class="container antet__bara">
    <a class="logo" href="/" aria-label="${esc(site.nume)} – Acasă"><span class="logo__cerc"><img src="/img/logo-ploiesti-360.png" alt="Logo Ploiești 360" width="52" height="52"></span><span class="logo__text">Ploiești <b>360</b></span></a>
    <button class="meniu-btn" type="button" aria-expanded="false" aria-controls="nav-principal"><span class="meniu-btn__linii" aria-hidden="true"></span><span class="meniu-btn__text">Meniu</span></button>
    <nav class="nav" id="nav-principal" aria-label="Meniu principal"><ul>${nav}</ul></nav>
  </div>
</header>
<main id="continut" tabindex="-1">
${body}
</main>
<footer class="subsol">
  <div class="container subsol__grid">
    <div class="subsol__brand">
      <a class="logo logo--mare" href="/"><span class="logo__cerc"><img src="/img/logo-ploiesti-360.png" alt="Logo Ploiești 360" width="72" height="72" loading="lazy"></span></a>
      <p>Suntem echipa Ploiești 360, un proiect dedicat promovării orașului nostru. Muzee, obiective turistice, clădiri cu valoare istorică, evenimente și locuri mai puțin cunoscute care merită văzute.</p>
      <p class="subsol__cta">📍 Urmărește-ne și hai să explorăm Ploieștiul la 360°!</p>
      <div class="social">${social}</div>
    </div>
    <nav class="subsol__nav" aria-label="Meniu subsol">
      <h2 class="subsol__titlu">Explorează</h2>
      <ul>${NAV.slice(1).map(([h, l]) => `<li><a href="${h}">${esc(l)}</a></li>`).join('')}</ul>
    </nav>
    <div class="subsol__contact">
      <h2 class="subsol__titlu">Contact</h2>
      <p>Scrie-ne pe ${RETELE.map(([k, l]) => `<a href="${esc(socialUrl(k))}" target="_blank" rel="noopener">${l}</a>`).join(' sau ')}. Răspundem la mesaje și comentarii.</p>
      <p><a href="/despre/#contact">Cum ne contactezi ${SVG.arrowRight}</a></p>
      <p class="subsol__mic">Ratingurile localurilor sunt ratinguri Google la data de ${dataRoNum(site.ratingData)}. Programele pot fi modificate; verifică înainte să pleci.</p>
    </div>
  </div>
  <div class="container subsol__jos">
    <p>© <span class="js-an">2026</span> ${esc(site.nume)}. Toate drepturile rezervate.</p>
    <p><a href="/sitemap.xml">Sitemap</a></p>
  </div>
</footer>
<script src="/js/main.js" defer></script>
${scripts.map(s => `<script src="${s}" defer></script>`).join('\n')}
</body>
</html>`;
}

/* ---------- componente ---------- */
function ratingHtml(loc, mic = false) {
  if (!loc.rating || loc.rating.valoare == null) return '';
  return `<p class="rating"><span class="rating__stea" aria-hidden="true">${SVG.star}</span><strong>${loc.rating.valoare.toFixed(1)}</strong><span class="rating__nr">(${nrRo(loc.rating.recenzii)} recenzii)</span>${mic ? '' : ` <small class="rating__nota">rating Google la data de ${dataRoNum(site.ratingData)}</small>`}</p>`;
}
function cardLoc(loc, { rating = false, i = 0, mic = false } = {}) {
  const url = locUrl(loc);
  const cat = CATEGORII[loc.categorie];
  return `<article class="card ${i % 2 ? 'card--r' : 'card--l'}${mic ? ' card--mic' : ''}" data-subtip="${esc(loc.subtip || '')}" data-slug="${esc(loc.slug)}">
  <a class="card__img colaj" href="${url}" tabindex="-1">
    <img src="${imagine('locuri/' + loc.imagine, loc.numeScurt || loc.nume)}" alt="${esc(loc.alt)}" loading="lazy" width="800" height="600">
  </a>
  <div class="card__corp">
    <span class="badge">${fmt(loc.eticheta)}</span>
    <h3 class="card__titlu"><a href="${url}">${fmt(loc.nume)}</a></h3>
    ${rating ? ratingHtml(loc, true) : ''}
    <p class="card__text">${fmt(loc.rezumat)}</p>
    <p class="card__adresa">${SVG.pin}<span>${fmt(loc.adresa)}</span></p>
    <div class="card__actiuni">
      <a class="link-sageata" href="${url}">Vezi fișa ${SVG.arrowRight}</a>
      ${loc.maps ? `<a class="btn btn--mic" href="${esc(loc.maps)}" target="_blank" rel="noopener">Vezi pe Google Maps</a>` : ''}
    </div>
  </div>
</article>`;
}
function cardEveniment(ev, i = 0) {
  const [y, m, d] = parts(ev.data);
  const sfarsit = ev.dataSfarsit ? ` – ${dataRo(ev.dataSfarsit)}` : '';
  const loc = ev.locSlug && bySlug[ev.locSlug];
  const locatie = loc ? `<a href="${locUrl(loc)}">${fmt(ev.locatie || loc.nume)}</a>` : fmt(ev.locatie);
  return `<li class="ev ${i % 2 ? 'ev--r' : 'ev--l'}" data-data="${esc(ev.data)}" data-sfarsit="${esc(ev.dataSfarsit || ev.data)}" data-cat="${esc(ev.categorie)}">
  <div class="ev__data" aria-hidden="true"><span class="ev__zi">${d}</span><span class="ev__luna">${LUNI_SCURT[m - 1]}</span><span class="ev__an">${y}</span></div>
  <div class="ev__corp">
    <span class="badge">${fmt(ev.categorie)}</span>
    <h3 class="ev__titlu">${fmt(ev.titlu)}</h3>
    <p class="ev__meta">${SVG.cal}<span><time datetime="${esc(ev.data)}">${ziSapt(ev.data)}, ${dataRo(ev.data)}</time>${sfarsit}${ev.ora ? `, ora <strong>${esc(ev.ora)}</strong>` : ''}</span></p>
    <p class="ev__meta">${SVG.pin}<span>${locatie}${ev.adresa ? ` · ${fmt(ev.adresa)}` : ''}</span></p>
    ${ev.pret ? `<p class="ev__meta">${SVG.tag}<span>${fmt(ev.pret)}</span></p>` : ''}
    <p class="ev__text">${fmt(ev.descriere)}</p>
    ${ev.link ? `<a class="btn btn--mic" href="${esc(ev.link)}" target="_blank" rel="noopener">Detalii și bilete</a>` : ''}
  </div>
  ${ev.imagine ? `<figure class="ev__img colaj"><img src="${imagine(ev.imagine, ev.titlu)}" alt="${esc(ev.alt || ev.titlu)}" loading="lazy" width="800" height="600">${creditFoto(ev.imagine) ? `<figcaption class="foto-credit">Foto: ${esc(creditFoto(ev.imagine).autor)}, ${esc(creditFoto(ev.imagine).licenta)}</figcaption>` : ''}</figure>` : ''}
</li>`;
}
function cardStire(st, i = 0) {
  const url = `/stiri/${st.slug}/`;
  return `<article class="card card--stire ${i % 2 ? 'card--r' : 'card--l'}">
  <a class="card__img colaj" href="${url}" tabindex="-1"><img src="${imagine(st.imagine, st.titlu)}" alt="${esc(st.alt)}" loading="lazy" width="800" height="600"></a>
  <div class="card__corp">
    <p class="card__meta"><span class="badge">${fmt(st.categorie)}</span> <time datetime="${esc(st.data)}">${dataRo(st.data)}</time></p>
    <h3 class="card__titlu"><a href="${url}">${fmt(st.titlu)}</a></h3>
    <p class="card__text">${fmt(st.rezumat)}</p>
    <a class="link-sageata" href="${url}">Citește ${SVG.arrowRight}</a>
  </div>
</article>`;
}
function titluSectiune(text, { link, linkText = 'Vezi toate', nivel = 2 } = {}) {
  return `<div class="sectiune__cap">
  <h${nivel} class="titlu-s subliniat"><span>${text}</span>${SVG.underline()}</h${nivel}>
  ${link ? `<a class="link-sageata link-sageata--mare" href="${link}">${esc(linkText)} ${SVG.arrow()}</a>` : ''}
</div>`;
}
function crumbs(items) {
  return `<nav class="crumbs" aria-label="Ești aici"><ol>${items.map(([h, l], i) => h ? `<li><a href="${h}">${esc(l)}</a></li>` : `<li aria-current="page">${esc(l)}</li>`).join('')}</ol></nav>`;
}

/* ---------- JSON-LD ---------- */
const ldOrganization = () => {
  const o = {
    '@context': 'https://schema.org', '@type': 'Organization', '@id': abs('/#organizatie'),
    name: site.nume, url: abs('/'), logo: abs('/img/logo-ploiesti-360.png'), description: site.descriere,
    areaServed: { '@type': 'City', name: 'Ploiești' }
  };
  const same = Object.values(site.social || {}).filter(v => /^https?:/.test(v));
  if (same.length) o.sameAs = same;
  if (site.fondat && !isPH(site.fondat)) o.foundingDate = site.fondat;
  return o;
};
const ldWebSite = () => ({ '@context': 'https://schema.org', '@type': 'WebSite', name: site.nume, url: abs('/'), inLanguage: 'ro', publisher: { '@id': abs('/#organizatie') } });
const ldBreadcrumb = items => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([h, l], i) => ({ '@type': 'ListItem', position: i + 1, name: cleanPH(l), ...(h ? { item: abs(h) } : {}) }))
});
function ldLoc(loc) {
  const o = {
    '@context': 'https://schema.org', '@type': loc.tip, name: cleanPH(loc.nume), description: cleanPH(loc.rezumat), url: abs(locUrl(loc)),
    image: abs(imagine('locuri/' + loc.imagine, loc.nume)),
    address: { '@type': 'PostalAddress', streetAddress: cleanPH(loc.adresa).replace(/,?\s*Ploiești.*$/, ''), addressLocality: 'Ploiești', addressRegion: 'Prahova', addressCountry: 'RO' },
    isAccessibleForFree: loc.tip === 'Park' || loc.slug === 'bulevardul-republicii' ? true : undefined
  };
  if (loc.lat != null && loc.lng != null) o.geo = { '@type': 'GeoCoordinates', latitude: loc.lat, longitude: loc.lng };
  if (loc.website) o.sameAs = [loc.website];
  if (loc.telefon && !/DE VERIFICAT/.test(loc.telefon)) o.telephone = loc.telefon;
  if (loc.maps) o.hasMap = loc.maps;
  if (loc.tip === 'Restaurant') o.servesCuisine = loc.slug === 'trattoria-by-mrs-residence' ? 'Italiană' : 'Românească, internațională';
  if (loc.tip === 'Museum' || loc.tip === 'TouristAttraction' || loc.tip === 'LandmarksOrHistoricalBuildings') o.touristType = 'Turiști culturali';
  return JSON.parse(JSON.stringify(o));
}
function ldEvent(ev) {
  const loc = ev.locSlug && bySlug[ev.locSlug];
  const o = {
    '@context': 'https://schema.org', '@type': 'Event', name: cleanPH(ev.titlu), description: cleanPH(ev.descriere),
    startDate: ev.data + (ev.ora ? `T${ev.ora}:00` : ''), endDate: ev.dataSfarsit || undefined,
    eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: { '@type': 'Place', name: cleanPH(ev.locatie), address: { '@type': 'PostalAddress', streetAddress: cleanPH(ev.adresa), addressLocality: 'Ploiești', addressCountry: 'RO' }, ...(loc ? { url: abs(locUrl(loc)) } : {}) },
    image: abs(imagine(ev.imagine, ev.titlu)), organizer: { '@id': abs('/#organizatie') }, url: abs(`/evenimente/#${ev.id}`)
  };
  if (/^gratuit$/i.test(ev.pret || '')) o.offers = { '@type': 'Offer', price: 0, priceCurrency: 'RON', availability: 'https://schema.org/InStock' };
  return JSON.parse(JSON.stringify(o));
}
const ldArticle = st => ({
  '@context': 'https://schema.org', '@type': 'NewsArticle', headline: cleanPH(st.titlu), description: cleanPH(st.rezumat),
  datePublished: st.data, dateModified: st.data, inLanguage: 'ro', articleSection: st.categorie,
  image: [abs(imagine(st.imagine, st.titlu))], mainEntityOfPage: abs(`/stiri/${st.slug}/`),
  author: { '@type': 'Organization', name: site.nume, url: abs('/') },
  publisher: { '@type': 'Organization', name: site.nume, logo: { '@type': 'ImageObject', url: abs('/img/logo-ploiesti-360.png') } },
  ...(st.locuri && st.locuri.length ? { about: st.locuri.map(s => bySlug[s]).filter(Boolean).map(l => ({ '@type': l.tip, name: cleanPH(l.nume), url: abs(locUrl(l)) })) } : {})
});
const ldItemList = (nume, items) => ({ '@context': 'https://schema.org', '@type': 'ItemList', name: nume, numberOfItems: items.length, itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: cleanPH(it.nume), url: abs(it.url) })) });

/* ---------- scriere ---------- */
const paginiSitemap = [];
function scrie(urlPath, html, { lastmod = AZI, priority = '0.7', changefreq = 'weekly', sitemap = true } = {}) {
  const fisier = urlPath.endsWith('/') ? path.join(DIST, urlPath, 'index.html') : path.join(DIST, urlPath);
  fs.mkdirSync(path.dirname(fisier), { recursive: true });
  fs.writeFileSync(fisier, cuBase(html));
  if (sitemap) paginiSitemap.push({ loc: abs(urlPath), lastmod, priority, changefreq });
}
function copiaza(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dest, e.name);
    if (e.name.startsWith('.')) continue;
    if (e.isDirectory()) copiaza(s, d); else fs.copyFileSync(s, d);
  }
}

/* ---------- date derivate ---------- */
const locDinCat = cat => locuri.filter(l => (l.categorii || [l.categorie]).includes(cat));
const sortRating = arr => arr.slice().sort((a, b) => ((b.rating && b.rating.valoare) ?? -1) - ((a.rating && a.rating.valoare) ?? -1) || ((b.rating && b.rating.recenzii) ?? 0) - ((a.rating && a.rating.recenzii) ?? 0));
const evViitoare = evenimente.filter(e => (e.dataSfarsit || e.data) >= AZI);
const articoleDespre = slug => stiri.filter(s => (s.locuri || []).includes(slug));

/* ========== PAGINI ========== */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });
copiaza(path.join(SRC, 'css'), path.join(DIST, 'css'));
copiaza(path.join(SRC, 'js'), path.join(DIST, 'js'));
copiaza(path.join(SRC, 'img'), path.join(DIST, 'img'));
copiaza(path.join(SRC, 'fonts'), path.join(DIST, 'fonts'));
if (BASE) for (const f of fs.readdirSync(path.join(DIST, 'css'))) { const fp = path.join(DIST, 'css', f); fs.writeFileSync(fp, fs.readFileSync(fp, 'utf8').replace(/url\("\//g, `url("${BASE}/`)); }
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');
fs.writeFileSync(path.join(DIST, 'img', 'favicon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#fff"/><circle cx="32" cy="32" r="22" fill="none" stroke="#1C2B5D" stroke-width="3" opacity=".25"/><circle cx="32" cy="32" r="14" fill="none" stroke="#1C2B5D" stroke-width="3" opacity=".5"/><circle cx="32" cy="32" r="7" fill="#1C2B5D"/><text x="32" y="59" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="11" font-weight="900" fill="#FFC107">360°</text></svg>`);

/* --- Acasă --- */
{
  const categoriiCard = Object.entries(CATEGORII).map(([slug, c], i) => `<a class="cat-card" href="/${slug}/">
    ${SVG.cat[c.icon]}<span class="cat-card__nume">${esc(c.nume)}</span><span class="cat-card__nr"><b>${locDinCat(slug).length}</b> locuri</span>${SVG.arrowRight}
  </a>`).join('');
  const extra = [['/evenimente/', 'Evenimente', 'eveniment', `${evViitoare.length} viitoare`], ['/stiri/', 'Știri', 'stiri', `${stiri.length} articole`], ['/harta/', 'Hartă', 'harta', `${locuri.filter(l => l.lat != null).length} pe hartă`]]
    .map(([h, n, ic, nr]) => `<a class="cat-card cat-card--alt" href="${h}">${SVG.cat[ic]}<span class="cat-card__nume">${n}</span><span class="cat-card__nr">${nr}</span>${SVG.arrowRight}</a>`).join('');
  const recomandate = ['muzeul-ceasului', 'halele-centrale', 'palatul-culturii'].map(s => bySlug[s]).filter(Boolean);
  const postariIG = (instagram.postari || []).filter(p => fs.existsSync(path.join(SRC, 'img', p.imagine))).slice(0, 6);
  const insta = postariIG.length
    ? postariIG.map(p => `<a class="insta__tile insta__tile--foto" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Postare Instagram din ${dataRo(p.data) || 'Instagram'}: ${esc(p.alt)}"><img src="${imagine(p.imagine, 'Instagram')}" alt="${esc(p.alt)}" loading="lazy" width="640" height="640"><span class="insta__label">${p.data ? esc(dataRo(p.data)) : 'Instagram'}</span></a>`).join('')
      + (postariIG.length < 6 ? `<a class="insta__tile insta__tile--mai" href="${esc(socialUrl('instagram'))}" target="_blank" rel="noopener"><span class="insta__logo"><img src="/img/logo-ploiesti-360.png" alt="" width="40" height="40" loading="lazy"></span><span class="insta__mai">Vezi toate postările ${SVG.arrowRight}</span></a>` : '')
    : Array.from({ length: 6 }, (_, i) => `<a class="insta__tile" href="${esc(socialUrl('instagram'))}" target="_blank" rel="noopener" aria-label="Postare Instagram ${i + 1} – Ploiești 360"><span class="insta__logo"><img src="/img/logo-ploiesti-360.png" alt="" width="40" height="40" loading="lazy"></span><span class="insta__label">Postare ${i + 1}</span></a>`).join('');
  const body = `
<section class="hero">
  <div class="container hero__grid">
    <div class="hero__text">
      <p class="hero__sup">Hub-ul orașului tău</p>
      <h1 class="hero__titlu subliniat"><span>Explorează Ploieștiul<br>la 360°</span>${SVG.underline()}</h1>
      <p class="hero__lead">Atracții, clădiri istorice, restaurante, cafenele, parcuri, evenimente și știri din Ploiești, toate într-un singur loc. Hai să redescoperim orașul împreună.</p>
      <div class="hero__cta">
        <a class="btn" href="/atractii/">Ce să vizitezi ${SVG.arrowRight}</a>
        <a class="btn btn--contur" href="/harta/">Vezi harta</a>
      </div>
    </div>
    <div class="hero__logo">
      ${SVG.burst('burst--st')}
      <span class="hero__cerc"><img src="/img/logo-ploiesti-360.png" alt="Logo Ploiești 360, orașul Ploiești la 360 de grade" width="260" height="260" fetchpriority="high"></span>
      ${SVG.wedges('wedges--dr')}
    </div>
  </div>
</section>

<section class="sectiune" aria-labelledby="t-cat">
  <div class="container">
    ${titluSectiune('Ce vrei să descoperi?', { nivel: 2 }).replace('<h2', '<h2 id="t-cat"')}
    <div class="cat-grid">${categoriiCard}${extra}</div>
  </div>
</section>

<section class="sectiune sectiune--alt" aria-labelledby="t-rec">
  <div class="container">
    ${titluSectiune('Locuri de neratat', { link: '/atractii/', linkText: 'Toate atracțiile' }).replace('<h2', '<h2 id="t-rec"')}
    <div class="grid">${recomandate.map((l, i) => cardLoc(l, { i })).join('')}</div>
  </div>
</section>

<section class="sectiune" aria-labelledby="t-ev">
  <div class="container">
    ${titluSectiune('Evenimente viitoare', { link: '/evenimente/', linkText: 'Toate evenimentele' }).replace('<h2', '<h2 id="t-ev"')}
    ${evViitoare.length ? `<ul class="lista-ev" data-ascunde-trecute>${evViitoare.slice(0, 3).map((e, i) => cardEveniment(e, i)).join('')}</ul>` : ''}
    <p class="gol${evViitoare.length ? ' gol--ascuns' : ''}" data-gol>Nu avem evenimente anunțate încă. Urmărește-ne pe Instagram ca să afli primul.</p>
  </div>
</section>

<section class="sectiune sectiune--alt" aria-labelledby="t-st">
  <div class="container">
    ${titluSectiune('Ultimele știri din Ploiești', { link: '/stiri/', linkText: 'Toate știrile' }).replace('<h2', '<h2 id="t-st"')}
    <div class="grid">${stiri.slice(0, 3).map((s, i) => cardStire(s, i)).join('')}</div>
  </div>
</section>

<section class="sectiune" aria-labelledby="t-insta">
  <div class="container">
    ${titluSectiune('Ploieștiul, pe Instagram', { link: isPH(site.social.instagram) ? '/despre/' : site.social.instagram, linkText: site.instagramHandle || 'Urmărește-ne' }).replace('<h2', '<h2 id="t-insta"')}
    <!-- Postările vin din data/instagram.json (node tools/instagram.js). Fără fișier, grila afișează placeholdere. -->
    <div class="insta${postariIG.length && postariIG.length < 6 ? ' insta--putine' : ''}">${insta}</div>
    ${instagram.actualizat ? `<p class="insta__nota">Postări preluate de pe Instagram la ${dataRoNum(instagram.actualizat)}.</p>` : ''}
    <div class="urmareste">
      ${SVG.burst('burst--st')}
      <h3 class="urmareste__titlu">Urmărește-ne și hai să explorăm Ploieștiul la 360°!</h3>
      <div class="hero__cta">
        <a class="btn" href="${esc(socialUrl('instagram'))}" target="_blank" rel="noopener">${SVG.instagram} Instagram</a>
        <a class="btn btn--contur" href="${esc(socialUrl('facebook'))}" target="_blank" rel="noopener">${SVG.facebook} Facebook</a>
      </div>
    </div>
  </div>
</section>`;
  scrie('/', layout({
    title: 'Ploiești 360 – Ce să vizitezi în Ploiești: atracții, evenimente, restaurante, știri',
    description: 'Ploiești 360 este hub-ul orașului: obiective turistice Ploiești, clădiri istorice, restaurante și cafenele, parcuri, evenimente și știri locale. Explorează Ploieștiul la 360°.',
    urlPath: '/', body, jsonld: [ldOrganization(), ldWebSite()], bodyClass: 'pag-acasa'
  }), { priority: '1.0', changefreq: 'daily' });
}

/* --- Pagini de categorie --- */
for (const [slug, c] of Object.entries(CATEGORII)) {
  let lista = locDinCat(slug);
  let filtre = '';
  let nota = '';
  if (slug === 'restaurante-cafenele') {
    lista = sortRating(lista);
    filtre = `<div class="filtre" role="group" aria-label="Filtrează după tip">
      <button class="chip" type="button" data-filtru="" aria-pressed="true">Toate <span class="chip__nr">${lista.length}</span></button>
      <button class="chip" type="button" data-filtru="restaurant" aria-pressed="false">Restaurante <span class="chip__nr">${lista.filter(l => l.subtip === 'restaurant').length}</span></button>
      <button class="chip" type="button" data-filtru="cafenea" aria-pressed="false">Cafenele <span class="chip__nr">${lista.filter(l => l.subtip === 'cafenea').length}</span></button>
    </div>`;
    nota = `<p class="nota">${SVG.star} Ratingurile sunt <strong>ratinguri Google la data de ${dataRoNum(site.ratingData)}</strong> și pot fi diferite azi. Verifică mereu programul înainte să pleci.</p>`;
  }
  const body = `
<section class="pagina-cap">
  <div class="container">
    ${crumbs([['/', 'Acasă'], [null, c.nume]])}
    <h1 class="subliniat"><span>${esc(c.h1)}</span>${SVG.underline()}</h1>
    <p class="lead">${esc(c.intro)}</p>
    ${nota}
    ${filtre}
  </div>
</section>
<section class="sectiune sectiune--sus" aria-label="Lista de locuri">
  <div class="container">
    <div class="grid" data-lista-locuri>${lista.map((l, i) => cardLoc(l, { i, rating: slug === 'restaurante-cafenele' })).join('')}</div>
    <p class="gol gol--ascuns" data-gol>Niciun loc pentru filtrul ales.</p>
  </div>
</section>
<section class="sectiune sectiune--alt">
  <div class="container legaturi-cat">
    ${titluSectiune('Continuă explorarea', { nivel: 2 })}
    <div class="cat-grid cat-grid--mic">${Object.entries(CATEGORII).filter(([s]) => s !== slug).map(([s, cc]) => `<a class="cat-card" href="/${s}/">${SVG.cat[cc.icon]}<span class="cat-card__nume">${esc(cc.nume)}</span><span class="cat-card__nr"><b>${locDinCat(s).length}</b> locuri</span>${SVG.arrowRight}</a>`).join('')}<a class="cat-card cat-card--alt" href="/harta/?cat=${slug}">${SVG.cat.harta}<span class="cat-card__nume">Pe hartă</span><span class="cat-card__nr">${c.nume}</span>${SVG.arrowRight}</a></div>
  </div>
</section>`;
  scrie(`/${slug}/`, layout({
    title: `${c.title} | Ploiești 360`, description: c.meta, urlPath: `/${slug}/`, body,
    jsonld: [ldBreadcrumb([['/', 'Acasă'], [null, c.nume]]), { '@context': 'https://schema.org', '@type': 'CollectionPage', name: c.title, url: abs(`/${slug}/`), description: c.meta, inLanguage: 'ro', keywords: c.keywords }, ldItemList(c.title, lista.map(l => ({ nume: l.nume, url: locUrl(l) })))],
    bodyClass: `pag-categorie pag-${slug}`
  }), { priority: '0.9' });
}

/* --- Fișe de loc --- */
for (const loc of locuri) {
  const c = CATEGORII[loc.categorie];
  const url = locUrl(loc);
  const legate = (loc.legaturi || []).map(s => bySlug[s]).filter(Boolean);
  const articole = articoleDespre(loc.slug);
  const web = loc.website ? `<div><dt>${SVG.globe}Website</dt><dd><a href="${esc(loc.website)}" target="_blank" rel="noopener">${esc(loc.website.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></dd></div>` : '';
  const tel = loc.telefon ? `<div><dt>${SVG.phone}Telefon</dt><dd>${fmt(loc.telefon)}</dd></div>` : '';
  const body = `
<article class="fisa">
  <div class="container">
    ${crumbs([['/', 'Acasă'], [`/${loc.categorie}/`, c.nume], [null, loc.numeScurt || loc.nume]])}
    <header class="fisa__cap">
      <span class="badge badge--mare">${fmt(loc.eticheta)}</span>
      <h1 class="subliniat"><span>${fmt(loc.nume)}</span>${SVG.underline()}</h1>
      <p class="lead">${fmt(loc.rezumat)}</p>
    </header>
    <div class="fisa__grid">
      <figure class="colaj colaj--mare">
        ${SVG.wedges('wedges--dr')}
        <img src="${imagine('locuri/' + loc.imagine, loc.numeScurt || loc.nume)}" alt="${esc(loc.alt)}" width="800" height="600" fetchpriority="high">
        ${creditCaption('locuri/' + loc.imagine, loc.alt)}
      </figure>
      <aside class="fisa__info" aria-label="Informații practice">
        <h2 class="fisa__info-titlu">Pe scurt</h2>
        ${loc.rating !== undefined ? ratingHtml(loc) : ''}
        <dl>
          <div><dt>${SVG.tag}Categorie</dt><dd><a href="/${loc.categorie}/">${esc(c.nume)}</a>${(loc.categorii || []).filter(x => x !== loc.categorie).map(x => ` · <a href="/${x}/">${esc(CATEGORII[x].nume)}</a>`).join('')}</dd></div>
          <div><dt>${SVG.pin}Adresă</dt><dd>${fmt(loc.adresa)}</dd></div>
          <div><dt>${SVG.clock}Program</dt><dd>${fmt(loc.program)}</dd></div>
          ${tel}${web}
        </dl>
        <div class="fisa__butoane">
          ${loc.maps ? `<a class="btn" href="${esc(loc.maps)}" target="_blank" rel="noopener">Vezi pe Google Maps ${SVG.arrowRight}</a>` : ''}
          ${loc.lat != null ? `<a class="btn btn--contur" href="/harta/?loc=${esc(loc.slug)}">Vezi pe harta noastră</a>` : ''}
        </div>
        ${loc.coordAprox ? `<p class="nota nota--mic">Poziția pe hartă este aproximativă.</p>` : ''}
      </aside>
    </div>
    <section class="fisa__poveste">
      <h2 class="subliniat subliniat--mic"><span>Povestea locului</span>${SVG.underline()}</h2>
      <p>${fmt(loc.poveste)}</p>
      ${loc.detalii ? `<p>${fmt(loc.detalii)}</p>` : ''}
    </section>
    ${legate.length ? `<section class="fisa__legate" aria-labelledby="t-legate">
      <h2 id="t-legate" class="subliniat subliniat--mic"><span>Vezi și</span>${SVG.underline()}</h2>
      <div class="grid grid--3">${legate.map((l, i) => cardLoc(l, { i, mic: true, rating: !!l.rating })).join('')}</div>
    </section>` : ''}
    ${articole.length ? `<section class="fisa__articole" aria-labelledby="t-art">
      <h2 id="t-art" class="subliniat subliniat--mic"><span>Din știri și ghiduri</span>${SVG.underline()}</h2>
      <ul class="lista-simpla">${articole.map(s => `<li><a href="/stiri/${s.slug}/">${fmt(s.titlu)}</a> <time datetime="${s.data}">(${dataRo(s.data)})</time></li>`).join('')}</ul>
    </section>` : ''}
    <p class="inapoi"><a class="link-sageata" href="/${loc.categorie}/">${SVG.arrowRight} Înapoi la ${esc(c.nume)}</a></p>
  </div>
</article>`;
  const titlu = `${cleanPH(loc.nume)} – ${loc.tip === 'Restaurant' ? 'restaurant în Ploiești' : loc.tip === 'CafeOrCoffeeShop' ? 'cafenea în Ploiești' : loc.tip === 'Park' ? 'parc în Ploiești' : loc.tip === 'Museum' ? 'muzeu în Ploiești' : 'Ploiești'} | Ploiești 360`;
  scrie(url, layout({
    title: titlu, description: `${cleanPH(loc.rezumat)} ${cleanPH(loc.nume)}, Ploiești: adresă, program, poveste și link Google Maps.`.slice(0, 158),
    urlPath: url, body, ogType: 'article', ogImage: imagine('locuri/' + loc.imagine, loc.nume),
    jsonld: [ldLoc(loc), ldBreadcrumb([['/', 'Acasă'], [`/${loc.categorie}/`, c.nume], [null, loc.nume]])],
    bodyClass: 'pag-fisa'
  }), { priority: '0.8' });
}

/* --- Evenimente --- */
{
  const categorii = [...new Set(evenimente.map(e => e.categorie))].sort((a, b) => a.localeCompare(b, 'ro'));
  const body = `
<section class="pagina-cap">
  <div class="container">
    ${crumbs([['/', 'Acasă'], [null, 'Evenimente']])}
    <h1 class="subliniat"><span>Evenimente în Ploiești</span>${SVG.underline()}</h1>
    <p class="lead">Concerte, expoziții, târguri, teatru și evenimente de cartier. Filtrează după dată și categorie și vezi ce se întâmplă în Ploiești săptămâna asta.</p>
    <form class="filtre-ev" data-filtre-ev aria-label="Filtrează evenimentele">
      <div class="filtre-ev__rand">
        <label for="perioada" class="filtre-ev__eticheta">Când</label>
        <select id="perioada" name="perioada" class="select">
          <option value="viitoare" selected>Viitoare</option>
          <option value="saptamana">Săptămâna aceasta</option>
          <option value="luna">Luna aceasta</option>
          <option value="trecute">Trecute</option>
          <option value="toate">Toate</option>
        </select>
      </div>
      <div class="filtre" role="group" aria-label="Categorie">
        <button class="chip" type="button" data-cat="" aria-pressed="true">Toate</button>
        ${categorii.map(c => `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')}
      </div>
    </form>
    <p class="nota nota--mic" aria-live="polite" data-numar></p>
  </div>
</section>
<section class="sectiune sectiune--sus" aria-label="Lista de evenimente">
  <div class="container">
    <ul class="lista-ev" id="lista-evenimente">${evenimente.map((e, i) => cardEveniment(e, i).replace('<li ', `<li id="${esc(e.id)}" `)).join('')}</ul>
    <p class="gol gol--ascuns" data-gol>Niciun eveniment pentru filtrul ales. Încearcă „Toate” sau revino curând.</p>
    <div class="caseta">
      ${SVG.burst('burst--st')}
      <h2>Organizezi un eveniment în Ploiești?</h2>
      <p>Scrie-ne și îl adăugăm în listă. E gratuit pentru evenimentele comunității.</p>
      <a class="btn" href="/despre/#contact">Trimite-ne evenimentul ${SVG.arrowRight}</a>
    </div>
  </div>
</section>`;
  scrie('/evenimente/', layout({
    title: 'Evenimente în Ploiești – concerte, expoziții, târguri | Ploiești 360',
    description: 'Evenimente Ploiești: lista actualizată de concerte, expoziții, târguri, teatru și evenimente comunitare din Ploiești, filtrabilă după dată și categorie.',
    urlPath: '/evenimente/', body, scripts: ['/js/evenimente.js'],
    jsonld: [ldBreadcrumb([['/', 'Acasă'], [null, 'Evenimente']]), ...evenimente.map(ldEvent)],
    bodyClass: 'pag-evenimente'
  }), { priority: '0.9', changefreq: 'daily' });
}

/* --- Știri --- */
{
  const body = `
<section class="pagina-cap">
  <div class="container">
    ${crumbs([['/', 'Acasă'], [null, 'Știri']])}
    <h1 class="subliniat"><span>Știri din Ploiești</span>${SVG.underline()}</h1>
    <p class="lead">Ce se întâmplă în oraș, pe scurt și pe înțelesul tuturor. Plus ghiduri pentru un weekend în Ploiești.</p>
  </div>
</section>
<section class="sectiune sectiune--sus" aria-label="Articole">
  <div class="container"><div class="grid">${stiri.map((s, i) => cardStire(s, i)).join('')}</div></div>
</section>`;
  scrie('/stiri/', layout({
    title: 'Știri Ploiești – noutăți și ghiduri din oraș | Ploiești 360',
    description: 'Știri Ploiești: noutăți din oraș, transport, cultură și ghiduri practice pentru un weekend sau un city break în Ploiești.',
    urlPath: '/stiri/', body, jsonld: [ldBreadcrumb([['/', 'Acasă'], [null, 'Știri']]), ldItemList('Știri Ploiești', stiri.map(s => ({ nume: s.titlu, url: `/stiri/${s.slug}/` })))],
    bodyClass: 'pag-stiri'
  }), { priority: '0.9', changefreq: 'daily' });

  for (const st of stiri) {
    const url = `/stiri/${st.slug}/`;
    const locuriMent = (st.locuri || []).map(s => bySlug[s]).filter(Boolean);
    const altele = stiri.filter(s => s.slug !== st.slug).slice(0, 3);
    const share = encodeURIComponent(abs(url));
    const body = `
<article class="articol">
  <div class="container container--ingust">
    ${crumbs([['/', 'Acasă'], ['/stiri/', 'Știri'], [null, st.titlu]])}
    <header class="articol__cap">
      <p class="articol__meta"><span class="badge">${fmt(st.categorie)}</span> <time datetime="${esc(st.data)}">${dataRo(st.data)}</time></p>
      <h1 class="subliniat"><span>${fmt(st.titlu)}</span>${SVG.underline()}</h1>
      <p class="lead">${fmt(st.rezumat)}</p>
    </header>
    <figure class="colaj colaj--mare colaj--articol">
      ${SVG.wedges('wedges--dr')}
      <img src="${imagine(st.imagine, st.titlu)}" alt="${esc(st.alt)}" width="800" height="600" fetchpriority="high">
      ${creditCaption(st.imagine, st.alt)}
    </figure>
    <div class="articol__corp">
      ${paragrafe(st.continut)}
      ${st.sursa ? `<p class="articol__sursa">Sursa: ${fmt(st.sursa)}</p>` : ''}
    </div>
    <div class="articol__share">
      <span>Dă mai departe:</span>
      <a class="btn btn--mic" href="https://www.facebook.com/sharer/sharer.php?u=${share}" target="_blank" rel="noopener">Facebook</a>
      <a class="btn btn--mic" href="https://wa.me/?text=${encodeURIComponent(cleanPH(st.titlu) + ' ')}${share}" target="_blank" rel="noopener">WhatsApp</a>
    </div>
    ${locuriMent.length ? `<section class="articol__locuri" aria-labelledby="t-loc">
      <h2 id="t-loc" class="subliniat subliniat--mic"><span>Locuri menționate</span>${SVG.underline()}</h2>
      <ul class="lista-simpla">${locuriMent.map(l => `<li><a href="${locUrl(l)}">${fmt(l.nume)}</a> <span class="mut">· ${esc(CATEGORII[l.categorie].nume)}</span></li>`).join('')}</ul>
    </section>` : ''}
    ${altele.length ? `<section class="articol__altele" aria-labelledby="t-alt">
      <h2 id="t-alt" class="subliniat subliniat--mic"><span>Citește și</span>${SVG.underline()}</h2>
      <ul class="lista-simpla">${altele.map(s => `<li><a href="/stiri/${s.slug}/">${fmt(s.titlu)}</a> <time datetime="${s.data}">(${dataRo(s.data)})</time></li>`).join('')}</ul>
    </section>` : ''}
    <p class="inapoi"><a class="link-sageata" href="/stiri/">${SVG.arrowRight} Toate știrile</a></p>
  </div>
</article>`;
    scrie(url, layout({
      title: `${cleanPH(st.titlu)} | Știri Ploiești 360`, description: cleanPH(st.rezumat).slice(0, 158), urlPath: url, body, ogType: 'article',
      ogImage: imagine(st.imagine, st.titlu), jsonld: [ldArticle(st), ldBreadcrumb([['/', 'Acasă'], ['/stiri/', 'Știri'], [null, st.titlu]])], bodyClass: 'pag-articol'
    }), { lastmod: st.data, priority: '0.7', changefreq: 'monthly' });
  }
}

/* --- Hartă --- */
{
  const puncte = locuri.filter(l => l.lat != null && l.lng != null).map(l => ({
    slug: l.slug, nume: cleanPH(l.nume), cat: l.categorie, catNume: CATEGORII[l.categorie].nume, eticheta: cleanPH(l.eticheta),
    adresa: cleanPH(l.adresa), url: locUrl(l), lat: l.lat, lng: l.lng, aprox: !!l.coordAprox, maps: l.maps || '',
    rating: l.rating ? l.rating.valoare : null
  }));
  const body = `
<section class="pagina-cap pagina-cap--compact">
  <div class="container">
    ${crumbs([['/', 'Acasă'], [null, 'Hartă']])}
    <h1 class="subliniat"><span>Harta Ploiești 360</span>${SVG.underline()}</h1>
    <p class="lead">Toate locurile de pe site, pe o singură hartă. Filtrează după categorie și apasă pe un punct ca să vezi fișa.</p>
    <div class="filtre" role="group" aria-label="Filtrează harta după categorie" data-filtre-harta>
      <button class="chip" type="button" data-cat="" aria-pressed="true">Toate <span class="chip__nr">${puncte.length}</span></button>
      ${Object.entries(CATEGORII).map(([s, c]) => `<button class="chip chip--${s}" type="button" data-cat="${s}" aria-pressed="false"><span class="pin-legenda pin--${s}" aria-hidden="true"></span>${esc(c.nume)} <span class="chip__nr">${puncte.filter(p => p.cat === s).length}</span></button>`).join('')}
    </div>
  </div>
</section>
<section class="sectiune sectiune--sus" aria-label="Hartă interactivă">
  <div class="container">
    <div id="harta" class="harta" role="region" aria-label="Hartă interactivă cu locurile din Ploiești" tabindex="0">
      <p class="harta__fallback">Harta se încarcă… Dacă nu apare, folosește lista de mai jos sau butoanele „Vezi pe Google Maps”.</p>
    </div>
    <p class="nota nota--mic">Hartă: © colaboratorii <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>. Pozițiile marcate cu „aprox.” sunt aproximative.</p>
    <h2 class="subliniat subliniat--mic"><span>Lista locurilor</span>${SVG.underline()}</h2>
    <ul class="lista-harta" data-lista-harta>
      ${puncte.map(p => `<li data-cat="${p.cat}" data-slug="${p.slug}"><span class="pin-legenda pin--${p.cat}" aria-hidden="true"></span><a href="${p.url}">${esc(p.nume)}</a> <span class="mut">· ${esc(p.catNume)}${p.aprox ? ' · aprox.' : ''}</span> <button class="chip chip--mic" type="button" data-arata="${p.slug}">Arată pe hartă</button></li>`).join('')}
    </ul>
  </div>
</section>
<script type="application/json" id="date-locuri">${JSON.stringify(puncte).replace(/</g, '\\u003c')}</script>`;
  scrie('/harta/', layout({
    title: 'Harta Ploiești – atracții, muzee, restaurante, parcuri | Ploiești 360',
    description: 'Harta interactivă a Ploieștiului cu toate obiectivele turistice, muzeele, clădirile istorice, restaurantele, cafenelele și parcurile din Ploiești, filtrabilă pe categorii.',
    urlPath: '/harta/', body, scripts: ['/js/harta.js'],
    headExtra: `<link rel="stylesheet" href="/css/leaflet.min.css">
<script src="/js/vendor/leaflet.min.js" defer></script>`,
    jsonld: [ldBreadcrumb([['/', 'Acasă'], [null, 'Hartă']]), ldItemList('Locuri din Ploiești pe hartă', puncte.map(p => ({ nume: p.nume, url: p.url })))],
    bodyClass: 'pag-harta'
  }), { priority: '0.8' });
}

/* --- Despre noi + Contact --- */
{
  const socialLista = RETELE.map(([k, l]) => {
    const v = site.social[k];
    return `<li>${SVG[k]} ${isPH(v) ? `<span>${l}: <mark class="de-verificat">${esc(v)}</mark></span>` : `<a href="${esc(v)}" target="_blank" rel="noopener">${l}</a>`}</li>`;
  }).join('');
  const listaCredite = credite => credite.map(c => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(c.titlu)}</a> – ${esc(c.autor)}, <a href="${esc(c.licentaUrl || c.url)}" target="_blank" rel="noopener">${esc(c.licenta)}</a>, ${esc(c.sursa)}</li>`).join('');
  const body = `
<section class="pagina-cap">
  <div class="container container--ingust">
    ${crumbs([['/', 'Acasă'], [null, 'Despre noi']])}
    <h1 class="subliniat"><span>Despre Ploiești 360</span>${SVG.underline()}</h1>
    <div class="despre__text">
      <p class="lead">Suntem echipa Ploiești 360, un proiect dedicat promovării orașului nostru.</p>
      <p>Ne propunem să descoperim și să prezentăm muzee, obiective turistice, clădiri cu valoare istorică, evenimente și locuri mai puțin cunoscute care merită văzute.</p>
      <p>Scopul nostru este să arătăm că Ploieștiul are o mulțime de povești și locuri speciale, iar împreună le putem redescoperi.</p>
      <p class="despre__cta">📍 Urmărește-ne și hai să explorăm Ploieștiul la 360°!</p>
    </div>
  </div>
</section>
<section class="sectiune sectiune--sus">
  <div class="container container--ingust despre__grid">
    <div class="caseta caseta--alb">
      <h2 class="subliniat subliniat--mic"><span>Ce găsești pe site</span>${SVG.underline()}</h2>
      <ul class="lista-bife">
        <li><a href="/atractii/">Atracții</a> și <a href="/cladiri-istorice/">clădiri istorice</a>, fiecare cu povestea ei</li>
        <li><a href="/restaurante-cafenele/">Restaurante și cafenele</a>, sortate după rating Google</li>
        <li><a href="/parcuri/">Parcuri</a> pentru weekend</li>
        <li><a href="/evenimente/">Evenimente</a> și <a href="/stiri/">știri</a> din oraș</li>
        <li><a href="/harta/">Harta</a> cu toate locurile</li>
      </ul>
    </div>
    <div class="caseta caseta--alb">
      <h2 class="subliniat subliniat--mic"><span>Ne găsești pe</span>${SVG.underline()}</h2>
      <ul class="lista-social">${socialLista}</ul>
    </div>
  </div>
</section>
<section class="sectiune" id="contact" aria-labelledby="t-contact">
  <div class="container container--ingust">
    ${titluSectiune('Scrie-ne', { nivel: 2 }).replace('<h2', '<h2 id="t-contact"')}
    <p class="lead">Ai un loc pe care vrei să-l vedem, un eveniment de anunțat sau o corectură? Trimite-ne un mesaj pe Instagram sau pe Facebook. Sunt singurele noastre canale de contact.</p>
    <div class="hero__cta">
      <a class="btn" href="${esc(socialUrl('instagram'))}" target="_blank" rel="noopener">${SVG.instagram} Mesaj pe Instagram</a>
      <a class="btn btn--contur" href="${esc(socialUrl('facebook'))}" target="_blank" rel="noopener">${SVG.facebook} Mesaj pe Facebook</a>
    </div>
  </div>
</section>
<section class="sectiune sectiune--sus" id="credite-foto" aria-labelledby="t-credite">
  <div class="container container--ingust">
    ${titluSectiune('Credite foto', { nivel: 2 }).replace('<h2', '<h2 id="t-credite"')}
    <p>Fotografiile de pe site provin de pe Wikimedia Commons și sunt publicate sub licențe libere. Pozele restaurantelor și cafenelelor sunt ilustrative, nu sunt făcute în localurile respective.</p>
    <ul class="lista-credite">${listaCredite(crediteFoto)}</ul>
  </div>
</section>`;
  scrie('/despre/', layout({
    title: 'Despre noi și contact – echipa Ploiești 360',
    description: 'Cine suntem: echipa Ploiești 360, proiectul care promovează muzeele, obiectivele turistice, clădirile istorice și evenimentele din Ploiești. Contactează-ne.',
    urlPath: '/despre/', body, jsonld: [ldOrganization(), { '@context': 'https://schema.org', '@type': 'ContactPage', name: 'Contact Ploiești 360', url: abs('/despre/'), inLanguage: 'ro' }, ldBreadcrumb([['/', 'Acasă'], [null, 'Despre noi']])],
    bodyClass: 'pag-despre'
  }), { priority: '0.6', changefreq: 'monthly' });
}

/* --- 404 --- */
scrie('/404.html', layout({
  title: 'Pagina nu a fost găsită | Ploiești 360', description: 'Pagina căutată nu există. Explorează atracțiile, evenimentele și știrile din Ploiești.', urlPath: '/404.html',
  body: `<section class="sectiune"><div class="container container--ingust" style="text-align:center">
  ${SVG.burst('burst--st')}
  <h1 class="subliniat"><span>Ne-am rătăcit prin Ploiești</span>${SVG.underline()}</h1>
  <p class="lead">Pagina pe care o cauți nu există sau a fost mutată. Nicio grijă, orașul e mic.</p>
  <div class="hero__cta" style="justify-content:center"><a class="btn" href="/">Înapoi acasă ${SVG.arrowRight}</a><a class="btn btn--contur" href="/harta/">Vezi harta</a></div>
</div></section>`, bodyClass: 'pag-404'
}), { sitemap: false });

/* --- sitemap.xml + robots.txt --- */
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginiSitemap.map(p => `  <url><loc>${p.loc}</loc><lastmod>${p.lastmod}</lastmod><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`).join('\n')}
</urlset>
`);
fs.writeFileSync(path.join(DIST, 'robots.txt'), `User-agent: *
Allow: /

Sitemap: ${abs('/sitemap.xml')}
`);

/* --- raport --- */
const ph = [];
const scan = (obj, cale) => {
  if (typeof obj === 'string') { const m = obj.match(PH); if (m) ph.push({ cale, m: [...new Set(m)] }); }
  else if (Array.isArray(obj)) obj.forEach((v, i) => scan(v, `${cale}[${i}]`));
  else if (obj && typeof obj === 'object') Object.entries(obj).forEach(([k, v]) => scan(v, cale ? `${cale}.${k}` : k));
};
scan(site, 'site.json'); toateLocurile.forEach(l => scan(l, `locuri.json › ${l.slug}`)); evenimente.forEach(e => scan(e, `evenimente.json › ${e.id}`)); stiri.forEach(s => scan(s, `stiri.json › ${s.slug}`));
console.log(`  SITE_URL=${SITE_URL} BASE_PATH=${BASE || '(fără)'}`);
console.log(`✔ Site generat în /dist: ${paginiSitemap.length} pagini în sitemap, ${locuri.length} locuri, ${evenimente.length} evenimente, ${stiri.length} știri.`);
console.log(`  Placeholdere rămase de completat: ${ph.reduce((n, p) => n + p.m.length, 0)} (rulează "node build.js --placeholdere" pentru listă).`);
if (process.argv.includes('--placeholdere')) ph.forEach(p => console.log(`  - ${p.cale}: ${p.m.join(', ')}`));
