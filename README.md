# Ploiești 360 – site oficial

Site static (HTML/CSS/JS) generat dintr-un set de fișiere JSON. Fără framework, fără dependențe npm.

## Structura

```
ploiesti360/
├── build.js            # generatorul (Node ≥ 18): JSON → HTML în /dist
├── data/
│   ├── site.json       # nume, domeniu, linkuri Instagram/Facebook (singurele canale de contact), data ratingurilor
│   ├── locuri.json     # atracții, clădiri istorice, restaurante & cafenele, parcuri
│   ├── evenimente.json # evenimente (listă filtrabilă)
│   └── stiri.json      # articole / știri
├── src/
│   ├── css/style.css   # stiluri (brand: navy / galben / roșu)
│   ├── js/             # main.js (meniu, filtre), evenimente.js, harta.js
│   ├── img/            # logo + pozele voastre (locuri/, evenimente/, stiri/, og/)
│   └── fonts/          # Sailors.woff2 (opțional; fallback Bebas Neue)
├── dist/               # rezultatul build-ului (se regenerează, nu se editează)
├── netlify.toml        # deploy Netlify (build: node build.js, publish: dist)
└── vercel.json         # deploy Vercel
```

## Cum rulezi local

```bash
node build.js                              # generează /dist
python3 -m http.server 8080 --directory dist   # deschide http://localhost:8080
```

`node build.js --placeholdere` listează toate textele marcate [DE VERIFICAT] / [DE CONFIRMAT] rămase în date.

## Deploy

**GitHub Pages (activ):** repo-ul `ploiesti360` are workflow-ul `.github/workflows/deploy.yml`: la fiecare push pe `main` rulează `node build.js` și publică `dist/` la `https://<user>.github.io/ploiesti360/`. Workflow-ul setează automat `SITE_URL` și `BASE_PATH=/ploiesti360` (subfolderul), deci nu trebuie schimbat nimic în `data/site.json`. Când vei avea domeniu propriu: adaugă-l în Settings → Pages → Custom domain, pune `url` în `data/site.json` și schimbă în workflow `BASE_PATH=` (gol) și `SITE_URL` cu domeniul.

## Postările de pe Instagram (acasă)

`npm run instagram` (= `node tools/instagram.js`) deschide profilul din `site.json` într-un browser headless (binarul `browse` din gstack, `~/.claude/skills/gstack/browse/dist/browse`, sau `BROWSE_BIN=...`), ia ultimele postări publice (max. `IG_MAX`, implicit 6), descarcă imaginea fiecăreia în `src/img/instagram/` și scrie `data/instagram.json`. Apoi `node build.js` afișează grila reală pe pagina de start. Rulează-l manual când apar postări noi și comite rezultatul; nu rulează în GitHub Actions (Instagram blochează serverele). Fără `data/instagram.json`, grila afișează placeholdere.

Contactul se face exclusiv prin Instagram și Facebook (linkurile din `data/site.json`, câmpul `social`); nu există formular sau e-mail pe site. Creditele foto sunt în `data/credite-foto.json` și apar pe pagina Despre + sub fiecare poză.


**Netlify:** conectează repo-ul; `netlify.toml` setează deja build command `node build.js` și publish `dist`. Formularul de contact funcționează automat (Netlify Forms).

**Vercel:** conectează repo-ul; `vercel.json` setează build și output. Formularul de contact NU funcționează pe Vercel fără un serviciu extern (ex. Formspree): schimbă `action` în `build.js` (secțiunea „Despre noi + Contact”).

Înainte de lansare, schimbă `url` în `data/site.json` cu domeniul real (sitemap, canonical și Open Graph se generează din el).

## Cum adaugi un eveniment

1. Deschide `data/evenimente.json`.
2. Copiază un bloc existent și completează:

```json
{
  "id": "concert-parc-vest-2026-10",
  "titlu": "Concert în Parcul Municipal Vest",
  "data": "2026-10-03",
  "dataSfarsit": "",
  "ora": "19:00",
  "categorie": "Concert",
  "locatie": "Parcul Municipal Ploiești Vest",
  "locSlug": "parcul-municipal",
  "adresa": "Parcul Municipal Vest, Ploiești",
  "descriere": "Două-trei fraze: cine cântă, pentru cine e, ce trebuie să știi.",
  "pret": "Gratuit",
  "link": "https://...",
  "imagine": "evenimente/concert-parc-vest.jpg",
  "alt": "Concert în aer liber în Parcul Municipal Vest din Ploiești"
}
```

- `data` = prima zi (AAAA-LL-ZZ); `dataSfarsit` doar dacă ține mai multe zile.
- `categorie` e liberă (Concert, Festival, Expoziție, Teatru, Târg, Sport, Comunitate…); filtrele se generează automat din categoriile folosite.
- `locSlug` = `slug`-ul unui loc din `locuri.json`, ca evenimentul să aibă link către fișa locului; lasă `""` dacă nu e cazul.
- Poza: pune fișierul în `src/img/evenimente/` cu numele din `imagine`. Fără poză, apare un placeholder.
- Șterge blocurile cu `"exemplu": true` când ai evenimente reale.

3. Rulează `node build.js` (sau doar dă push: Netlify/Vercel rulează build-ul).

## Cum adaugi un articol (știre)

1. Deschide `data/stiri.json` și adaugă un bloc:

```json
{
  "slug": "noile-tramvaie-ajung-mai-devreme",
  "titlu": "Noile tramvaie ajung mai devreme",
  "data": "2026-09-17",
  "categorie": "Transport",
  "rezumat": "O frază-două pentru card și pentru Google.",
  "continut": [
    "Primul paragraf. Poți folosi **bold** și [linkuri](/atractii/halele-centrale/).",
    "## Un subtitlu",
    "Alt paragraf."
  ],
  "imagine": "stiri/tramvaie-noi-ploiesti.jpg",
  "alt": "Tramvai nou în Ploiești",
  "sursa": "Primăria Municipiului Ploiești",
  "locuri": ["bulevardul-republicii", "halele-centrale"]
}
```

- `slug` devine adresa: `/stiri/<slug>/` (litere mici, fără diacritice, cu cratime).
- `continut` e o listă de paragrafe; `## ` la început face un subtitlu; `[text](/url/)` face link; `**text**` face bold.
- `locuri` = slug-urile locurilor menționate; apar în „Locuri menționate” și articolul apare pe fișa locului.
- Poza: `src/img/stiri/<nume>.jpg`.

2. `node build.js`.

## Pagina de admin (articole scrise de studenți)

La `/admin/` există un formular simplu: **titlu, poză, locație, categorie, text, nume autor**. Studenții intră cu o parolă comună, apasă „Publică articolul”, iar articolul apare pe site în 1–2 minute, cu același aspect ca restul știrilor (listă, pagina de start, pagina locului). Nu au nevoie de cont GitHub.

Cum funcționează: formularul trimite articolul la un mic serviciu pe Cloudflare (`worker/worker.js`), care verifică parola și face un commit în repo cu poza (`src/img/stiri/<slug>.jpg`, micșorată automat la max. 1600px) și articolul adăugat în `data/stiri.json` (câmpuri noi: `locatie`, `autor`). Push-ul pornește workflow-ul de GitHub Pages ca de obicei.

### Configurare (o singură dată)

1. **Token GitHub**: GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → Generate. Repository access: *Only select repositories* → `ploiesti360`. Permissions → *Contents: Read and write*. Copiază tokenul.
2. **Cont Cloudflare** gratuit (dash.cloudflare.com), apoi în terminal:
   ```bash
   cd worker
   npx wrangler login                      # se deschide browserul
   npx wrangler secret put GITHUB_TOKEN    # lipește tokenul de la pasul 1
   npx wrangler secret put ADMIN_PASSWORD  # parola pe care o dai studenților
   npx wrangler deploy                     # afișează adresa, ex. https://ploiesti360-admin.<cont>.workers.dev
   ```
3. Pune adresa afișată în `data/site.json` → `adminApi`, comite și dă push.
4. Trimite studenților linkul `https://<site>/admin/` și parola.

Când treci pe domeniu propriu, schimbă `ALLOWED_ORIGIN` din `worker/wrangler.toml` (ex. `https://ploiesti360.ro`) și rulează din nou `npx wrangler deploy`.

### Întreținere

- **Schimbi parola** (ex. a plecat cineva din echipă): `npx wrangler secret put ADMIN_PASSWORD` în `worker/`. Efectul e imediat.
- **Ștergi sau corectezi un articol**: pe GitHub, editează `data/stiri.json` (șterge blocul articolului) și, opțional, poza din `src/img/stiri/`. Fiecare articol trimis din admin e un commit separat („Articol nou: … (scris de …)”), deci se poate anula și cu *Revert*.
- Tokenul GitHub expiră la data aleasă la creare; când expiră, publicarea dă eroare. Generează altul și rulează din nou `npx wrangler secret put GITHUB_TOKEN`.

## Cum adaugi un loc

În `data/locuri.json`, copiază un bloc din aceeași categorie. Câmpuri importante: `slug` (adresa paginii), `categorie` (atractii | cladiri-istorice | restaurante-cafenele | parcuri), `categorii` (unde apare listat), `tip` (Schema.org: Museum, TouristAttraction, LandmarksOrHistoricalBuildings, Restaurant, CafeOrCoffeeShop, Park), `subtip` (doar pentru restaurante-cafenele: restaurant | cafenea), `rating` (doar restaurante/cafenele: `{"valoare": 4.5, "recenzii": 120}` sau lipsă → [RATING DE VERIFICAT]), `lat`/`lng` (pentru hartă), `maps` (link Google Maps), `imagine` (fișier în `src/img/locuri/`).

Un loc cu `"publicat": false` nu apare pe site (util pentru ciorne).

## Fontul Sailors

Pune `Sailors.woff2` (și/sau `Sailors.otf`) în `src/fonts/`. `@font-face` e deja pregătit în `src/css/style.css`. Până atunci titlurile folosesc Bebas Neue.

## Imaginea de share (Open Graph)

Dacă există `src/img/og/ploiesti-360-og.png` (1200×630), este folosită la share pe social media pentru paginile fără imagine proprie; altfel se folosește logo-ul.
