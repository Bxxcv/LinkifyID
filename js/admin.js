import { auth, db } from './firebase.js';
import { CONFIG } from './config.js';
import {
  onAuthStateChanged, signOut, updatePassword, updateEmail,
  EmailAuthProvider, reauthenticateWithCredential
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  collection, getDocs, addDoc, doc, updateDoc, deleteDoc,
  serverTimestamp, getDoc, query, orderBy, setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ── HELPERS ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => s ? String(s).replace(/[&<>"']/g, m =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])) : '';
const rupiah = v => Number(v||0).toLocaleString('id-ID');
const produkCol = uid => collection(db,'toko',uid,'produk');
const produkDoc = (uid,id) => doc(db,'toko',uid,'produk',id);

// ── TOAST ─────────────────────────────────────────────────────
let _toastTimer;
function toast(msg, type='ok') {
  const el = $('toast');
  el.textContent = msg;
  el.style.background = type==='ok' ? '#111' : type==='err' ? '#EF4444' : '#F59E0B';
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ── CLOCK ─────────────────────────────────────────────────────
function tickClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  const d = now.toLocaleDateString('id-ID',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  $('clock-big') && ($('clock-big').textContent = t);
  $('clock-time') && ($('clock-time').textContent = t.slice(0,5));
  $('clock-date') && ($('clock-date').textContent = d);
}
tickClock(); setInterval(tickClock, 1000);

// ── SIDEBAR & TABS ────────────────────────────────────────────
const sidebar   = $('sidebar');
const overlay   = $('overlay');
const openSB  = () => { sidebar.classList.add('open');   overlay.classList.add('show');   document.body.style.overflow='hidden'; };
const closeSB = () => { sidebar.classList.remove('open');overlay.classList.remove('show');document.body.style.overflow=''; };
$('btn-hamburger').addEventListener('click', openSB);
overlay.addEventListener('click', closeSB);

const TABS = { dashboard:'Dashboard', products:'Produk', settings:'Pengaturan Toko', account:'Keamanan Akun' };
document.querySelectorAll('.sb-btn[data-tab]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    document.querySelectorAll('.sb-btn[data-tab]').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-'+tab).classList.add('active');
    $('topbar-title').textContent = TABS[tab] || 'Dashboard';
    closeSB();
  });
});

// ── COPY LINK ─────────────────────────────────────────────────
function copyLink(uid) {
  const base = window.location.origin + (window.location.hostname.includes('github.io') ? '/LINKify' : '');
  const link = `${base}/index.html?uid=${uid}`;
  navigator.clipboard.writeText(link)
    .then(() => toast('Link toko berhasil dicopy! 🎉'))
    .catch(() => toast('Gagal copy link', 'err'));
}
$('btn-copy-link').addEventListener('click', () => {
  const uid = auth.currentUser?.uid;
  if (uid) copyLink(uid); else toast('Login dulu!','err');
});
$('btn-copy-link-2').addEventListener('click', () => {
  const uid = auth.currentUser?.uid;
  if (uid) copyLink(uid); else toast('Login dulu!','err');
});

// ── AUTH ──────────────────────────────────────────────────────
$('btn-logout').addEventListener('click', () => {
  if (confirm('Yakin mau keluar?')) signOut(auth);
});

onAuthStateChanged(auth, async user => {
  if (!user) return (location.href = 'login-user.html');
  const snap = await getDoc(doc(db,'toko',user.uid));
  if (!snap.exists()) {
    toast('Akun belum terdaftar sebagai toko!','err');
    return setTimeout(() => signOut(auth), 2000);
  }
  $('sb-email').textContent = user.email;
  $('inp-new-email').value  = user.email;
  $('stat-email').textContent = user.email;
  loadProducts(user.uid);
  loadSettings(user.uid);
  loadStats(user.uid);
});

// ── STATS ─────────────────────────────────────────────────────
async function loadStats(uid) {
  try {
    const snap = await getDocs(produkCol(uid));
    let total=0, habis=0;
    snap.forEach(d => { total++; if(d.data().stok==0) habis++; });
    $('stat-total').textContent = total;
    $('stat-empty').textContent = habis;
  } catch(e) { console.error('loadStats',e); }
}

// ── PRODUK: LOAD ──────────────────────────────────────────────
async function loadProducts(uid) {
  const list = $('products-list');
  list.innerHTML = [1,2,3].map(() =>
    `<div class="skel-card"><div class="skel" style="height:140px"></div><div style="padding:12px">
     <div class="skel" style="height:12px;width:70%;margin-bottom:8px"></div>
     <div class="skel" style="height:14px;width:45%"></div></div></div>`).join('');
  try {
    const q    = query(produkCol(uid), orderBy('createdAt','desc'));
    const snap = await getDocs(q);
    if (snap.empty) {
      list.innerHTML = `<div class="empty">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z"/>
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
        </svg>
        <p class="empty-h">Belum ada produk</p>
        <p class="empty-p">Klik "Tambah Produk" untuk mulai menambahkan.</p>
      </div>`;
      return;
    }
    list.innerHTML = '';
    snap.forEach(ds => {
      const p=ds.data(), id=ds.id;
      const card = document.createElement('div');
      card.className = 'p-card';
      card.innerHTML = `
        <img class="p-img" src="${esc(p.img)}" alt="${esc(p.nama)}"
             onerror="this.src='https://placehold.co/400x300/F4F4F4/AAA?text=Foto'">
        <div class="p-body">
          <div class="p-name">${esc(p.nama)}</div>
          <div class="p-price">Rp${rupiah(p.harga)}</div>
          <div class="p-stok ${p.stok==0?'habis':''}">Stok: ${p.stok}${p.stok==0?' · Habis':''}</div>
          <div class="p-acts">
            <button class="btn-ed" data-id="${id}">Edit</button>
            <button class="btn-del" data-id="${id}">Hapus</button>
          </div>
        </div>`;
      list.appendChild(card);
    });
  } catch(e) {
    list.innerHTML = `<div class="empty"><p class="empty-h">Gagal memuat</p><p class="empty-p">${e.message}</p></div>`;
  }
}

// ── PRODUK: MODAL ─────────────────────────────────────────────
const modal   = $('product-modal');
const imgPrev = $('img-preview');
const openModal  = () => { modal.classList.add('open');    document.body.style.overflow='hidden'; };
const closeModal = () => { modal.classList.remove('open'); document.body.style.overflow=''; };

$('btn-add-product').addEventListener('click', () => {
  $('product-form').reset();
  $('inp-prod-id').value = '';
  $('inp-prod-img').value = '';
  $('inp-prod-file').value = '';
  imgPrev.style.display = 'none';
  $('modal-title').textContent = 'Tambah Produk Baru';
  openModal();
});
$('modal-pull').addEventListener('click', closeModal);
modal.addEventListener('click', e => { if(e.target===modal) closeModal(); });

// Upload zone
$('upload-zone').addEventListener('click', () => $('inp-prod-file').click());
$('inp-prod-file').addEventListener('change', () => {
  const f = $('inp-prod-file').files[0];
  if (!f) return;
  imgPrev.src = URL.createObjectURL(f);
  imgPrev.style.display = 'block';
});

// Edit & Hapus
$('products-list').addEventListener('click', async e => {
  const id  = e.target.dataset.id;
  const uid = auth.currentUser?.uid;
  if (!id || !uid) return;

  if (e.target.classList.contains('btn-ed')) {
    try {
      const snap = await getDoc(produkDoc(uid, id));
      if (!snap.exists()) return toast('Produk tidak ditemukan','err');
      const p = snap.data();
      $('inp-prod-id').value    = id;
      $('inp-prod-name').value  = p.nama      || '';
      $('inp-prod-price').value = p.harga     || 0;
      $('inp-prod-stock').value = p.stok      || 0;
      $('inp-prod-desc').value  = p.deskripsi || '';
      $('inp-prod-shopee').value= p.shopee    || '';
      $('inp-prod-wa').value    = p.wa        || '';
      $('inp-prod-img').value   = p.img       || '';
      $('inp-prod-file').value  = '';
      if (p.img) { imgPrev.src=p.img; imgPrev.style.display='block'; }
      else imgPrev.style.display='none';
      $('modal-title').textContent = 'Edit Produk';
      openModal();
    } catch(err) { toast('Gagal load: '+err.message,'err'); }
  }

  if (e.target.classList.contains('btn-del')) {
    if (!confirm('Yakin hapus produk ini?')) return;
    try {
      await deleteDoc(produkDoc(uid, id));
      toast('Produk dihapus');
      loadProducts(uid);
      loadStats(uid);
    } catch(err) { toast('Gagal hapus: '+err.message,'err'); }
  }
});

// Simpan produk
$('product-form').addEventListener('submit', async e => {
  e.preventDefault();
  const uid  = auth.currentUser?.uid;
  const id   = $('inp-prod-id').value;
  const file = $('inp-prod-file').files[0];
  let imgUrl = $('inp-prod-img').value;

  if (!file && !imgUrl) return toast('Pilih foto produk dulu!','warn');

  const btn = $('btn-save-product');
  btn.disabled = true;
  try {
    if (file) {
      btn.textContent = 'Upload foto...';
      imgUrl = await uploadCloudinary(file);
      if (!imgUrl) throw new Error('Upload foto gagal.');
    }
    btn.textContent = 'Menyimpan...';
    const data = {
      nama:      $('inp-prod-name').value.trim(),
      harga:     Number($('inp-prod-price').value),
      stok:      Number($('inp-prod-stock').value),
      deskripsi: $('inp-prod-desc').value.trim(),
      shopee:    $('inp-prod-shopee').value.trim(),
      wa:        $('inp-prod-wa').value.trim(),
      img:       imgUrl,
      updatedAt: serverTimestamp()
    };
    if (id) {
      await updateDoc(produkDoc(uid,id), data);
      toast('Produk diperbarui! ✅');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(produkCol(uid), data);
      toast('Produk ditambahkan! ✅');
    }
    closeModal();
    loadProducts(uid);
    loadStats(uid);
  } catch(err) {
    toast('Error: '+err.message,'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Produk';
  }
});

// ── SETTINGS ─────────────────────────────────────────────────
async function loadSettings(uid) {
  try {
    const snap = await getDoc(doc(db,'toko',uid));
    if (!snap.exists()) return;
    const s = snap.data();
    $('inp-username').value = s.namaToko || '';
    $('inp-bio').value      = s.bio      || '';
    $('inp-wa').value       = s.wa       || '';
    $('inp-shopee').value   = s.shopee   || '';
    $('inp-logo-url').value = s.logo     || '';
    if (s.logo) $('logo-preview').src = s.logo;
  } catch(e) { console.error('loadSettings',e); }
}

$('btn-logo-pick').addEventListener('click', () => $('inp-logo-file').click());
$('inp-logo-file').addEventListener('change', () => {
  const f = $('inp-logo-file').files[0];
  if (f) $('logo-preview').src = URL.createObjectURL(f);
});

$('btn-save-settings').addEventListener('click', async () => {
  const uid = auth.currentUser?.uid;
  const btn = $('btn-save-settings');
  btn.disabled = true; btn.textContent = 'Menyimpan...';
  try {
    let logo = $('inp-logo-url').value;
    const f  = $('inp-logo-file').files[0];
    if (f) {
      logo = await uploadCloudinary(f);
      if (!logo) throw new Error('Upload logo gagal.');
      $('inp-logo-url').value = logo;
    }
    await setDoc(doc(db,'toko',uid), {
      namaToko: $('inp-username').value.trim(),
      bio:      $('inp-bio').value.trim(),
      wa:       $('inp-wa').value.trim(),
      shopee:   $('inp-shopee').value.trim(),
      logo
    }, { merge:true });
    toast('Pengaturan tersimpan! ✅');
  } catch(err) { toast('Gagal: '+err.message,'err'); }
  finally { btn.disabled=false; btn.textContent='Simpan Pengaturan'; }
});

// ── AKUN ──────────────────────────────────────────────────────
$('btn-save-account').addEventListener('click', async () => {
  const user     = auth.currentUser;
  const newEmail = $('inp-new-email').value.trim();
  const newPass  = $('inp-new-pass').value;
  const oldPass  = $('inp-old-pass').value;
  const btn      = $('btn-save-account');

  if (!oldPass) return toast('Password lama wajib diisi!','warn');
  if (newEmail===user.email && !newPass) return toast('Tidak ada perubahan','warn');
  if (newPass && newPass.length<6) return toast('Password minimal 6 karakter!','warn');

  btn.disabled=true; btn.textContent='Memverifikasi...';
  try {
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, oldPass));
    if (newEmail !== user.email) await updateEmail(user, newEmail);
    if (newPass) await updatePassword(user, newPass);
    toast('Akun diperbarui! Keluar otomatis...');
    setTimeout(() => signOut(auth), 2000);
  } catch(err) {
    const msg = err.code==='auth/wrong-password' ? 'Password lama salah!' : err.message;
    toast(msg,'err');
  } finally { btn.disabled=false; btn.textContent='Update Akun'; }
});

// ── CLOUDINARY UPLOAD ─────────────────────────────────────────
async function uploadCloudinary(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CONFIG.cloudinary.uploadPreset);
  try {
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CONFIG.cloudinary.cloudName}/image/upload`, { method:'POST', body:fd });
    const data = await res.json();
    if (data.secure_url) return data.secure_url;
    throw new Error(data.error?.message || 'Upload gagal');
  } catch(err) {
    toast('Upload gagal: '+err.message,'err');
    return null;
  }
}
