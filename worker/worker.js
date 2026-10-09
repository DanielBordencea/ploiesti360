/*
  Ploiești 360 – serviciul de publicare pentru /admin/ (Cloudflare Worker).
  Primește un articol din formular, verifică parola, apoi face UN commit în repo-ul de GitHub cu:
    - poza în src/img/stiri/<slug>.jpg
    - articolul adăugat la începutul data/stiri.json
  Push-ul pe main pornește workflow-ul de GitHub Pages, deci articolul apare pe site în 1–2 minute.

  Secrete (wrangler secret put …):  ADMIN_PASSWORD, GITHUB_TOKEN
  Variabile (wrangler.toml):        GITHUB_REPO, GITHUB_BRANCH, ALLOWED_ORIGIN
*/

const MAX_POZA = 6 * 1024 * 1024; // octeți, după decodare
const GH = 'https://api.github.com';

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    };
    const raspuns = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return raspuns(405, { eroare: 'Metodă nepermisă' });

    const brut = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    // formularul trimite parola cu encodeURIComponent (antetele HTTP nu acceptă diacritice)
    let parola = '';
    try { parola = decodeURIComponent(brut); } catch { parola = brut; }
    if (!env.ADMIN_PASSWORD || !(await egal(parola, env.ADMIN_PASSWORD))) {
      await new Promise(r => setTimeout(r, 800)); // încetinește ghicitul parolei
      return raspuns(401, { eroare: 'Parolă greșită' });
    }

    const cale = new URL(req.url).pathname;
    if (cale === '/verifica') return raspuns(200, { ok: true });
    if (cale !== '/publica') return raspuns(404, { eroare: 'Adresă necunoscută' });

    let d;
    try { d = await req.json(); } catch { return raspuns(400, { eroare: 'Date invalide' }); }
    const art = valideaza(d);
    if (art.eroare) return raspuns(400, art);

    try {
      const slug = await publica(env, art);
      return raspuns(200, { ok: true, slug });
    } catch (e) {
      return raspuns(502, { eroare: 'GitHub a refuzat publicarea: ' + e.message });
    }
  }
};

/* ---------- validare & construirea articolului ---------- */
const curat = (s, max) => String(s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, max);

function valideaza(d) {
  const titlu = curat(d.titlu, 120);
  const text = curat(d.text, 20000).replace(/\r\n?/g, '\n');
  const autor = curat(d.autor, 60);
  const locatie = curat(d.locatie, 120);
  const categorie = curat(d.categorie, 40) || 'Știri';
  const locSlug = /^[a-z0-9-]{1,80}$/.test(d.locSlug || '') ? d.locSlug : '';
  if (!titlu) return { eroare: 'Lipsește titlul' };
  if (text.length < 40) return { eroare: 'Textul e prea scurt' };
  if (!autor) return { eroare: 'Lipsește numele autorului' };
  if (!locatie) return { eroare: 'Lipsește locația' };

  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(d.imagine || '');
  if (!m) return { eroare: 'Poza lipsește sau nu e JPEG' };
  const poza = m[1];
  if (poza.length * 0.75 > MAX_POZA) return { eroare: 'Poza e prea mare' };
  if (!poza.startsWith('/9j/')) return { eroare: 'Poza nu e un JPEG valid' };

  // un rând liber = paragraf nou; rândurile simple din același paragraf se unesc
  const continut = text.split(/\n\s*\n/).map(p => p.split('\n').map(r => r.trim()).filter(Boolean).join(' ')).filter(Boolean);
  // primul paragraf devine rezumatul (introducerea de sub titlu); dacă e scurt, nu-l mai repetăm în corp
  const iPrim = continut.findIndex(p => !p.startsWith('#'));
  const simplu = (iPrim >= 0 ? continut[iPrim] : titlu).replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  const rezumat = simplu.length > 180 ? simplu.slice(0, simplu.lastIndexOf(' ', 177)) + '…' : simplu;
  if (iPrim === 0 && simplu.length <= 180 && continut.length > 1) continut.shift();

  return { titlu, categorie, locSlug, locatie, autor, continut, rezumat, poza };
}

const slugify = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '') || 'articol';

const azi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest' }).format(new Date());

/* ---------- GitHub: un singur commit cu poza + stiri.json ---------- */
async function publica(env, art) {
  const repo = env.GITHUB_REPO, branch = env.GITHUB_BRANCH || 'main';
  const gh = async (cale, opt = {}) => {
    const r = await fetch(`${GH}/repos/${repo}${cale}`, {
      ...opt,
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept': opt.raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'ploiesti360-admin',
        ...(opt.body ? { 'Content-Type': 'application/json' } : {})
      }
    });
    if (!r.ok) { const e = new Error(`${r.status} ${(await r.text()).slice(0, 200)}`); e.status = r.status; throw e; }
    return opt.raw ? r.text() : r.json();
  };

  // blob-ul pozei nu depinde de starea repo-ului, îl urcăm o singură dată
  const blobPoza = await gh('/git/blobs', { method: 'POST', body: JSON.stringify({ content: art.poza, encoding: 'base64' }) });

  // dacă doi studenți publică în același timp, ref-ul se mișcă între timp: reîncercăm de la starea nouă
  for (let incercare = 0; incercare < 4; incercare++) {
    const ref = await gh(`/git/ref/heads/${branch}`);
    const parinte = ref.object.sha;
    const commit = await gh(`/git/commits/${parinte}`);
    const stiri = JSON.parse(await gh(`/contents/data/stiri.json?ref=${parinte}`, { raw: true }));

    const baza = slugify(art.titlu);
    const folosite = new Set(stiri.map(s => s.slug));
    let slug = baza;
    for (let i = 2; folosite.has(slug); i++) slug = `${baza}-${i}`;

    const fisierPoza = `stiri/${slug}.jpg`;
    stiri.unshift({
      slug,
      titlu: art.titlu,
      data: azi(),
      categorie: art.categorie,
      rezumat: art.rezumat,
      continut: art.continut,
      imagine: fisierPoza,
      alt: art.titlu,
      locatie: art.locatie,
      autor: art.autor,
      locuri: art.locSlug ? [art.locSlug] : []
    });

    const tree = await gh('/git/trees', {
      method: 'POST',
      body: JSON.stringify({
        base_tree: commit.tree.sha,
        tree: [
          { path: `src/img/${fisierPoza}`, mode: '100644', type: 'blob', sha: blobPoza.sha },
          { path: 'data/stiri.json', mode: '100644', type: 'blob', content: JSON.stringify(stiri, null, 2) + '\n' }
        ]
      })
    });
    const nou = await gh('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: `Articol nou: ${art.titlu} (scris de ${art.autor}, din /admin)`,
        tree: tree.sha,
        parents: [parinte],
        author: { name: 'Ploiești 360 Admin', email: 'admin@ploiesti360.invalid' }
      })
    });
    try {
      await gh(`/git/refs/heads/${branch}`, { method: 'PATCH', body: JSON.stringify({ sha: nou.sha, force: false }) });
      return slug;
    } catch (e) {
      if (e.status !== 422) throw e; // 422 = ref-ul s-a mișcat (alt articol publicat între timp)
    }
  }
  throw new Error('prea multe publicări simultane, încearcă din nou');
}

/* comparare în timp constant (nu dezvăluie prin timing câte caractere din parolă sunt corecte) */
async function egal(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(s => crypto.subtle.digest('SHA-256', enc.encode(s))));
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= u[i] ^ v[i];
  return diff === 0;
}
