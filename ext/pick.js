// Bouton « Sourcing » sur Chrono24 et WatchSalon : relève toutes les annonces de la recherche,
// montre leurs photos (toutes cochées), on décoche celles qui ne ressemblent pas, puis « Valider ».
(() => {
  if (window.__srcPick) return; window.__srcPick = true;
  const IS_WS = /watchsalon\.com$/.test(location.hostname);
  const SITE = IS_WS ? 'WatchSalon' : 'Chrono24';
  const isSearch = () => IS_WS
    ? document.querySelectorAll('h3 a[href*="/watch/"]').length > 0
    : (/\/search\/|\/ref-|--mod\d|\/index\.htm/.test(location.pathname) && document.querySelectorAll('a[href*="--id"]').length > 0);
  const P = s => +String(s || '').replace(/\D/g, '') || 0;

  // ---------- Chrono24 ----------
  function c24Parse(doc) {
    const M = new Map();
    doc.querySelectorAll('.js-listing-item-container, .js-article-item-container, .article-item-container').forEach(c => {
      const a = c.querySelector('a[href*="--id"]'); if (!a) return;
      const href = a.getAttribute('href') || ''; const id = (href.match(/--id(\d+)/) || [])[1]; if (!id || M.has(id)) return;
      const t = (c.innerText || c.textContent || '').replace(/Aller au feuillet \d+/g, ' ').replace(/\s+/g, ' ').trim();
      let p = 0;
      for (const m of t.matchAll(/(?<![\d.\-A-Za-z€$£])(?:€\s?(\d{1,3}(?:[\s  .,]\d{3})+)|(\d{1,3}(?:[\s  .,]\d{3})+)\s?€)/g)) {
        const af = t.slice(m.index + m[0].length), bf = t.slice(0, m.index);
        if (/^\s?€?\s*(de frais|shipping)/i.test(af) || /\+\s*€?\s*$/.test(bf)) continue;
        p = P(m[1] || m[2]); break;
      }
      if (!p) return;
      const cm = t.match(/(?:frais de port|Livraison gratuite|Hors frais de port|shipping|Free shipping)[^A-Z]*\b([A-Z]{2})\b/i);
      const im = [...c.querySelectorAll('img')].map(i => i.getAttribute('data-lazy-sweet-spot-master-src') || i.getAttribute('data-src') || i.currentSrc || i.getAttribute('src'))
        .find(s => s && /chrono24\.com\/images/.test(s));
      const title = t.replace(/^(Sponsorisée|Populaire|Sponsored|Popular)\s+/i, '').replace(/\s*\d{1,3}(?:[\s  .,]\d{3})+\s?€.*$/, '').slice(0, 140);
      M.set(id, { t: title, p, c: cm ? cm[1].toUpperCase() : '', u: 'https://www.chrono24.fr' + href.replace(/^https?:\/\/[^/]+/, '').split('?')[0], pv: /Vendeur particulier|Private seller/i.test(t) ? 1 : 0,
        img: im ? im.replace('Square_SIZE_', 'Square280').replace(/_SIZE_/, '280') : '' });
    });
    return [...M.values()];
  }
  async function c24All(status) {
    const base = new URL(location.href); base.searchParams.set('pageSize', '120'); base.searchParams.delete('showpage');
    const out = new Map();
    for (let pg = 1; pg <= 8; pg++) {
      status('Chrono24 : page ' + pg + '…');
      const u = new URL(base); u.searchParams.set('showpage', pg);
      let doc;
      try { doc = new DOMParser().parseFromString(await (await fetch(u.href, { credentials: 'include' })).text(), 'text/html'); } catch (_) { break; }
      const L = c24Parse(doc); let added = 0;
      L.forEach(x => { const k = x.u; if (!out.has(k)) { out.set(k, x); added++; } });
      if (L.length < 100 || !added) break;
    }
    if (!out.size) c24Parse(document).forEach(x => out.set(x.u, x));
    return [...out.values()];
  }

  // ---------- WatchSalon ----------
  function wsParse(doc) {
    const m = (doc.body.textContent || '').replace(/\s+/g, ' ').match(/(\d+) annonces?·page \d+ sur (\d+)/);
    const items = [...doc.querySelectorAll('h3 a[href*="/watch/"]')].map(a => {
      let c = a; for (let k = 0; k < 7 && c && !/€/.test(c.textContent); k++) c = c.parentElement;
      const ps = c && [...c.querySelectorAll('span')].find(s => s.childElementCount === 0 && /^[\d\s  .]+\s?€$/.test(s.textContent.trim()));
      let w = c || a; for (let k = 0; k < 3 && w.parentElement && w.parentElement.querySelectorAll('h3').length === 1; k++) w = w.parentElement;
      const txt = w.textContent.replace(/\s+/g, ' ');
      const l = (txt.match(/·\s*([^·]+?,\s*[^·]+?)\s*(publiée|vérifiée|$)/) || [])[1] || '';
      const imgEl = w.querySelector('img');
      let img = imgEl ? (imgEl.currentSrc || imgEl.getAttribute('src') || '') : '';
      if (!img && imgEl && imgEl.getAttribute('srcset')) img = imgEl.getAttribute('srcset').split(',')[0].trim().split(' ')[0];
      if (img && img.startsWith('/')) img = location.origin + img;
      return { t: a.textContent.trim().slice(0, 140), p: ps ? P(ps.textContent) : 0, l: l.trim(), u: 'https://watchsalon.com' + a.getAttribute('href'), img };
    }).filter(x => x.p);
    return { pages: m ? +m[2] : 1, items };
  }
  async function wsAll(status) {
    const out = new Map(); let pages = 1;
    for (let pg = 1; pg <= Math.min(pages, 10); pg++) {
      status('WatchSalon : page ' + pg + (pages > 1 ? ' sur ' + pages : '') + '…');
      const u = new URL(location.href); u.searchParams.set('page', pg);
      let doc;
      try { doc = new DOMParser().parseFromString(await (await fetch(u.href, { credentials: 'include' })).text(), 'text/html'); } catch (_) { break; }
      const o = wsParse(doc); pages = o.pages; o.items.forEach(x => { if (!out.has(x.u)) out.set(x.u, x); });
      if (!o.items.length) break;
    }
    if (!out.size) wsParse(document).items.forEach(x => out.set(x.u, x));
    return [...out.values()];
  }

  // ---------- Interface ----------
  const css = `*{box-sizing:border-box}#srcPickBtn{position:fixed;right:22px;bottom:22px;z-index:2147483646;background:#1c1917;color:#fff;border:0;border-radius:999px;padding:13px 22px;font:600 15px system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25)}
#srcPickBtn:hover{background:#000}
#srcPick{position:fixed;inset:0;z-index:2147483647;background:#fafaf9;display:flex;flex-direction:column;font:14px system-ui,sans-serif;color:#1c1917}
#srcPick .hd{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:12px 18px;border-bottom:1px solid #e7e5e4;background:#fff}
#srcPick .hd b{font-size:16px}#srcPick .hd input{font:inherit;padding:7px 10px;border:1px solid #d6d3d1;border-radius:8px;width:200px}
#srcPick button{font:inherit;cursor:pointer;border-radius:8px;border:1px solid #d6d3d1;background:#fff;padding:8px 14px}
#srcPick button.go{background:#1c1917;color:#fff;border-color:#1c1917;font-weight:600}
#srcPick .st{color:#78716c;font-size:13px}
#srcPick .gr{flex:1;overflow:auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:10px;padding:14px 18px 40px;align-content:start}
#srcPick .it{position:relative;background:#fff;border:3px solid #16a34a;border-radius:12px;overflow:hidden;cursor:pointer;user-select:none}
#srcPick .it.off{border-color:#e7e5e4;opacity:.35;filter:grayscale(1)}
#srcPick .it img{width:100%;aspect-ratio:1;object-fit:cover;display:block;background:#f5f5f4}
#srcPick .it .ck{position:absolute;top:6px;left:6px;width:24px;height:24px;border-radius:6px;background:#16a34a;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700}
#srcPick .it.off .ck{background:#fff;color:#fff;border:2px solid #a8a29e}
#srcPick .it .pr{font-weight:700;font-size:15px;padding:6px 8px 0}#srcPick .it .tx{font-size:11.5px;color:#57534e;padding:2px 8px 8px;line-height:1.3;max-height:3.9em;overflow:hidden}
#srcPick .it a{position:absolute;top:6px;right:6px;background:rgba(255,255,255,.92);border-radius:6px;padding:2px 7px;font-size:11.5px;color:#1c1917;text-decoration:none}`;
  // Tout est mis dans un « shadow DOM » pour que le style du site ne déforme pas la grille.
  const mount = id => { const h = document.createElement('div'); h.id = id + 'Host'; h.style.cssText = 'all:initial'; const r = h.attachShadow({ mode: 'open' }); const st = document.createElement('style'); st.textContent = css.replace(/#srcPickBtn/g, '#srcPickBtn') ; r.appendChild(st); document.body.appendChild(h); return { h, r }; };

  const qOf = () => { const u = new URL(location.href); return u.searchParams.get(IS_WS ? 'q' : 'query') || u.searchParams.get('query') || u.searchParams.get('q') || ''; };
  const fmt = n => n.toLocaleString('fr-FR') + ' €';
  const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function open() {
    const M = mount('srcPick'); const box = document.createElement('div'); box.id = 'srcPick';
    box.innerHTML = `<div class="hd"><b>Sourcing · ${SITE}</b><span class="st">Relevé des annonces…</span></div><div class="gr"></div>`;
    M.r.appendChild(box); box.remove = () => M.h.remove();
    const stEl = box.querySelector('.st'); const status = s => { stEl.textContent = s; };
    let L = [];
    try { L = IS_WS ? await wsAll(status) : await c24All(status); } catch (e) { status('Erreur : ' + e.message); }
    if (!L.length) { status('Aucune annonce trouvée sur cette page.'); box.querySelector('.hd').insertAdjacentHTML('beforeend', '<button class="cl">Fermer</button>'); box.querySelector('.cl').onclick = () => box.remove(); return; }
    L.sort((a, b) => a.p - b.p); L.forEach(x => x.on = true);
    const hd = box.querySelector('.hd');
    hd.innerHTML = `<b>Sourcing · ${SITE}</b><label class="st">Référence <input class="rq" value="${esc(qOf())}" placeholder="ex. 116234"></label>
      <span class="st cnt"></span><button class="all">Tout cocher</button><button class="none">Tout décocher</button>
      <span style="flex:1"></span><button class="cl">Annuler</button><button class="go">Valider</button>`;
    const gr = box.querySelector('.gr');
    gr.innerHTML = L.map((x, i) => `<div class="it" data-i="${i}"><span class="ck">✓</span><a href="${esc(x.u)}" target="_blank" rel="noopener" title="Ouvrir l'annonce">Voir</a>${x.img ? `<img loading="lazy" src="${esc(x.img)}" referrerpolicy="no-referrer">` : '<img alt="">'}<div class="pr">${fmt(x.p)}${x.c ? ' <span style="font-weight:400;color:#78716c;font-size:12px">' + esc(x.c) + '</span>' : ''}${x.l ? ' <span style="font-weight:400;color:#78716c;font-size:12px">' + esc(x.l) + '</span>' : ''}</div><div class="tx">${esc(x.t)}</div></div>`).join('');
    const cnt = () => { const n = L.filter(x => x.on).length; box.querySelector('.cnt').textContent = n + ' gardée' + (n > 1 ? 's' : '') + ' sur ' + L.length; box.querySelector('.go').textContent = 'Valider (' + n + ')'; };
    const paint = () => gr.querySelectorAll('.it').forEach(el => el.classList.toggle('off', !L[+el.dataset.i].on));
    gr.onclick = e => { if (e.target.closest('a')) return; const el = e.target.closest('.it'); if (!el) return; const x = L[+el.dataset.i]; x.on = !x.on; el.classList.toggle('off', !x.on); cnt(); };
    box.querySelector('.all').onclick = () => { L.forEach(x => x.on = true); paint(); cnt(); };
    box.querySelector('.none').onclick = () => { L.forEach(x => x.on = false); paint(); cnt(); };
    box.querySelector('.cl').onclick = () => box.remove();
    box.querySelector('.go').onclick = async () => {
      const keep = L.filter(x => x.on); if (!keep.length) { alert('Aucune annonce gardée.'); return; }
      const q = box.querySelector('.rq').value.trim(); if (!q) { alert('Indiquez la référence de la montre (ex. 116234).'); return; }
      const data = { source: IS_WS ? 'watchsalon' : 'chrono24search', q, date: new Date().toISOString().slice(0, 10), picked: true,
        annonces: keep.map(x => IS_WS ? { t: x.t, p: x.p, l: x.l, u: x.u } : { t: x.t, p: x.p, c: x.c, u: x.u, pv: x.pv }) };
      const txt = JSON.stringify(data);
      let copied = false; try { await navigator.clipboard.writeText(txt); copied = true; } catch (_) {}
      let sent = false;
      try { sent = await new Promise(ok => chrome.runtime.sendMessage({ type: 'toSourcing', data }, r => ok(!!(r && r.ok)))); } catch (_) {}
      box.remove();
      const t = document.createElement('div');
      t.style.cssText = 'position:fixed;right:22px;bottom:80px;z-index:2147483647;background:#15803d;color:#fff;padding:14px 18px;border-radius:12px;font:600 14px system-ui,sans-serif;max-width:360px;box-shadow:0 6px 20px rgba(0,0,0,.25)';
      t.textContent = sent ? keep.length + ' annonces envoyées au Sourcing (onglet ouvert).' : (copied ? keep.length + ' annonces copiées. Dans le Sourcing : « Importer », puis collez (Ctrl+V).' : 'Copie impossible : réessayez.');
      document.body.appendChild(t); setTimeout(() => t.remove(), 7000);
    };
    cnt();
  }

  const addBtn = () => {
    const has = document.getElementById('srcPickBtnHost');
    if (!isSearch()) { if (has) has.remove(); return; }
    if (has || !document.body) return;
    const M = mount('srcPickBtn'); const b = document.createElement('button'); b.id = 'srcPickBtn'; b.textContent = 'Sourcing';
    b.title = 'Choisir les annonces par photo et les envoyer au Sourcing';
    b.onclick = () => { if (!document.getElementById('srcPickHost')) open(); };
    M.r.appendChild(b);
  };
  addBtn(); setInterval(addBtn, 1500);
})();
