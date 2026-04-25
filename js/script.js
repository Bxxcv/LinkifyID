import { db } from './firebase.js';
import {
  collection, getDocs, query, orderBy, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── HELPERS ──────────────────────────────────────────────────
const esc    = s => s ? String(s).replace(/[&<>"']/g, m =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])) : '';
const rupiah = v => Number(v||0).toLocaleString('id-ID');
const produkCol = uid => collection(db, 'toko', uid, 'produk');

// ── UID DARI URL ──────────────────────────────────────────────
const uid = new URLSearchParams(location.search).get('uid');

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (!uid) {
    document.getElementById('productList').innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,255,255,0.4);font-size:13px">
        Link tidak valid. Pastikan URL mengandung ?uid=...
      </div>`;
    return;
  }
  await Promise.all([loadSettings(), loadProducts()]);
});

// ── SETTINGS ─────────────────────────────────────────────────
async function loadSettings() {
  try {
    const snap = await getDoc(doc(db, 'toko', uid));
    if (!snap.exists()) return;
    const s = snap.data();

    // Nama & bio
    const nameEl = document.getElementById('storeName');
    const bioEl  = document.getElementById('storeBio');
    if (nameEl) nameEl.textContent = s.namaToko || 'My Store';
    if (bioEl)  bioEl.textContent  = s.bio      || '';

    // Footer
    const footerEl = document.getElementById('footerStore');
    if (footerEl) footerEl.textContent = `© ${new Date().getFullYear()} ${s.namaToko || 'My Store'}`;

    // Logo
    if (s.logo) {
      const img = document.getElementById('profileImg');
      if (img) img.src = s.logo;
    }

    // Page title
    document.title = `${s.namaToko || 'My Store'} — LINKify`;

    // WhatsApp
    const wa = s.wa || '#';
    const linkWa   = document.getElementById('link-wa');
    const floatWa  = document.getElementById('floatWa');
    if (linkWa)  { linkWa.href  = wa; linkWa.dataset.wa = wa; }
    if (floatWa) { floatWa.href = wa; }

    // Shopee
    if (s.shopee) {
      const elShopee = document.getElementById('link-shopee');
      if (elShopee) { elShopee.href = s.shopee; elShopee.classList.remove('hidden'); }
    }

    // Tokopedia — opsional, set via config atau settings
    // Uncomment baris berikut jika ingin pakai link Tokopedia dari settings toko
    // if (s.tokped) { const el = document.getElementById('link-tokped'); if(el){ el.href=s.tokped; el.classList.remove('hidden'); } }

  } catch (err) {
    console.error('loadSettings:', err);
  }
}

// ── PRODUK ───────────────────────────────────────────────────
async function loadProducts() {
  const container = document.getElementById('productList');
  try {
    const q    = query(produkCol(uid), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      container.innerHTML =
        `<div style="grid-column:1/-1;text-align:center;padding:60px 20px;color:rgba(255,255,255,0.35);font-size:13px">
          Belum ada produk di toko ini.
        </div>`;
      return;
    }

    const waUtama = document.getElementById('link-wa')?.dataset.wa || '#';
    container.innerHTML = '';

    snap.forEach(ds => {
      const p  = ds.data();
      const wa = p.wa || waUtama;
      const pesan = encodeURIComponent(
        `Halo kak, saya mau tanya/pesan:\n• Produk: ${p.nama}\n• Harga: Rp ${rupiah(p.harga)}`
      );

      const card = document.createElement('div');
      card.className = 'prod-card fade-up';
      card.innerHTML = `
        <div class="prod-img-wrap">
          <img class="prod-img" src="${esc(p.img)}" alt="${esc(p.nama)}"
               loading="lazy"
               onerror="this.src='https://placehold.co/600x400/1a1a2e/ffffff?text=Foto'">
          ${p.stok == 0 ? `<div class="habis-overlay">HABIS</div>` : ''}
        </div>
        <div class="prod-body">
          <div class="prod-name">${esc(p.nama)}</div>
          <div class="prod-price">Rp${rupiah(p.harga)}</div>
          <div class="prod-btns">
            <a href="${esc(wa)}?text=${pesan}" target="_blank" rel="noopener" class="prod-btn btn-wa">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WA
            </a>
            ${p.shopee ? `
            <a href="${esc(p.shopee)}" target="_blank" rel="noopener" class="prod-btn btn-shopee">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.793 7.507c0-2.075-.828-3.952-2.168-5.308a.675.675 0 00-.95-.014.664.664 0 00-.013.944 6.506 6.506 0 011.8 4.378 6.501 6.501 0 01-6.504 6.487 6.499 6.499 0 01-6.5-6.487 6.497 6.497 0 011.8-4.378.664.664 0 00-.013-.944.675.675 0 00-.95.014A7.824 7.824 0 004.127 7.507c0 .332.022.659.063.98H2.672a1.354 1.354 0 00-1.348 1.214L.024 21.347A1.344 1.344 0 001.37 22.86h21.26a1.344 1.344 0 001.346-1.513l-1.3-11.626a1.354 1.354 0 00-1.348-1.214h-1.597a7.9 7.9 0 00.062-.98zM12 1.14a2.694 2.694 0 110 5.388A2.694 2.694 0 0112 1.14z"/></svg>
              Shopee
            </a>` : ''}
          </div>
        </div>`;
      container.appendChild(card);
    });

    // Trigger animasi fade-up setelah render
    requestAnimationFrame(() => {
      document.querySelectorAll('#productList .fade-up').forEach((el, i) => {
        setTimeout(() => el.classList.add('show'), i * 60);
      });
    });

  } catch (err) {
    console.error('loadProducts:', err);
    container.innerHTML =
      `<div style="grid-column:1/-1;text-align:center;padding:40px;color:rgba(255,100,100,0.7);font-size:13px">
        Gagal memuat produk.<br><small>${err.message}</small>
      </div>`;
  }
}
