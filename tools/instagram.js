#!/usr/bin/env node
/*
  Ploiești 360 — ia automat ultimele postări publice de pe Instagram.
  Instagram nu mai oferă un API public fără cont business, iar endpoint-urile JSON
  refuză cererile simple (curl → 401). De aceea folosim un browser headless
  (binarul `browse` din gstack, Playwright) care încarcă profilul ca un vizitator
  obișnuit, ia linkurile postărilor și, pentru fiecare, imaginea + textul din
  meta-tagurile Open Graph ale paginii postării.

  Rulează:  node tools/instagram.js            (apoi node build.js)
  Opțional: IG_MAX=6 (câte postări), BROWSE_BIN=/cale/către/browse

  Scrie:  data/instagram.json  +  src/img/instagram/<shortcode>.jpg
  Dacă ceva eșuează, fișierul vechi rămâne neatins și build-ul merge cu ce are.
*/
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const OUT_JSON = path.join(ROOT, 'data', 'instagram.json');
const OUT_IMG = path.join(ROOT, 'src', 'img', 'instagram');
const site = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'site.json'), 'utf8'));
const PROFIL = String(site.social && site.social.instagram || '').replace(/\/$/, '');
const MAX = Number(process.env.IG_MAX || 6);
const BROWSE = process.env.BROWSE_BIN || path.join(os.homedir(), '.claude', 'skills', 'gstack', 'browse', 'dist', 'browse');

if (!/^https?:\/\/(www\.)?instagram\.com\//.test(PROFIL)) { console.error('✖ site.json → social.instagram nu e un link valid de profil.'); process.exit(1); }
if (!fs.existsSync(BROWSE)) { console.error(`✖ Nu găsesc browserul headless la ${BROWSE}. Setează BROWSE_BIN.`); process.exit(1); }

const b = (...args) => execFileSync(BROWSE, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90000 });
/* ieșirea browserului vine împachetată în markere "UNTRUSTED EXTERNAL CONTENT"; păstrăm doar JSON-ul */
const jsonDin = s => { const i = s.indexOf('{'); const j = s.lastIndexOf('}'); return JSON.parse(s.slice(i, j + 1)); };

function postari() {
  b('goto', PROFIL + '/');
  try { b('wait', '--networkidle'); } catch { /* Instagram ține conexiuni deschise; nu e o problemă */ }
  const links = b('links');
  const vazute = new Set(); const lista = [];
  for (const m of links.matchAll(/https:\/\/www\.instagram\.com\/(?:[\w.]+\/)?(p|reel)\/([\w-]+)\/?/g)) {
    if (!vazute.has(m[2])) { vazute.add(m[2]); lista.push({ shortcode: m[2], tip: m[1], url: `https://www.instagram.com/${m[1]}/${m[2]}/` }); }
  }
  return lista.slice(0, MAX);
}

function detalii(post) {
  b('goto', post.url);
  const og = jsonDin(b('data', '--og')).openGraph || {};
  /* description: „67 likes, 2 comments - ploiesti_360 on July 31, 2026: "text"” */
  const d = String(og.description || '');
  const data = (d.match(/ on ([A-Z][a-z]+ \d{1,2}, \d{4}):/) || [])[1] || '';
  let text = (og.title || '').replace(/^.*? on Instagram: "/s, '').replace(/"\s*$/s, '').trim();
  if (!text) text = d.replace(/^.*?: "/s, '').replace(/"\.?\s*$/s, '').trim();
  return { ...post, imagineUrl: og.image || '', text, data: dataISO(data) };
}

const LUNI = { January: 1, February: 2, March: 3, April: 4, May: 5, June: 6, July: 7, August: 8, September: 9, October: 10, November: 11, December: 12 };
function dataISO(s) {
  const m = s.match(/^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/);
  return m && LUNI[m[1]] ? `${m[3]}-${String(LUNI[m[1]]).padStart(2, '0')}-${m[2].padStart(2, '0')}` : '';
}

function descarca(post) {
  const fisier = path.join(OUT_IMG, `${post.shortcode}.jpg`);
  b('download', post.imagineUrl, fisier);
  if (!fs.existsSync(fisier) || fs.statSync(fisier).size < 5000) throw new Error('imagine goală');
  return `instagram/${post.shortcode}.jpg`;
}

(function main() {
  console.log(`→ Instagram: ${PROFIL}`);
  let lista;
  try { lista = postari(); } catch (e) { console.error('✖ Nu am putut încărca profilul:', e.message); process.exit(1); }
  if (!lista.length) { console.error('✖ Nu am găsit postări (profil privat, gol sau Instagram a blocat cererea). Păstrez data/instagram.json vechi.'); process.exit(1); }
  fs.mkdirSync(OUT_IMG, { recursive: true });
  const rezultat = [];
  for (const p of lista) {
    try {
      const d = detalii(p);
      d.imagine = descarca(d);
      delete d.imagineUrl;
      d.alt = d.text.split('\n')[0].slice(0, 140) || 'Postare Instagram Ploiești 360';
      rezultat.push(d);
      console.log(`  ✔ ${d.shortcode} (${d.data || 'fără dată'}) ${d.alt.slice(0, 60)}`);
    } catch (e) { console.warn(`  ✖ ${p.shortcode}: ${e.message}`); }
  }
  if (!rezultat.length) { console.error('✖ Nicio postare descărcată.'); process.exit(1); }
  /* ștergem pozele postărilor care nu mai sunt în listă */
  const actuale = new Set(rezultat.map(r => path.basename(r.imagine)));
  for (const f of fs.readdirSync(OUT_IMG)) if (f.endsWith('.jpg') && !actuale.has(f)) fs.unlinkSync(path.join(OUT_IMG, f));
  fs.writeFileSync(OUT_JSON, JSON.stringify({ actualizat: new Date().toISOString().slice(0, 10), profil: PROFIL + '/', postari: rezultat }, null, 2) + '\n');
  console.log(`✔ ${rezultat.length} postări în data/instagram.json`);
})();
