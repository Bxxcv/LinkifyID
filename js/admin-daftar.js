/**
 * LINKify — Admin Daftar (Manajemen User)
 * Modular, production-grade Firebase admin logic
 */

import { APP_CONFIG } from '../config.js';
import {
  initializeApp, getApps, deleteApp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, onAuthStateChanged, browserLocalPersistence, setPersistence,
  sendPasswordResetEmail, deleteUser
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, doc, setDoc, getDoc, getDocs, collection,
  updateDoc, deleteDoc, query, orderBy, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { escHtml } from './utils.js';

// ── CONSTANTS ──────────────────────────────────────────────────────────────
const EMAIL_ADMIN = 'unrageunrage@gmail.com';
const BASE_PATH   = window.location.hostname.includes('github.io') ? '/LINKify' : '';

// ── FIREBASE INIT ──────────────────────────────────────────────────────────
const app  = getApps().find(a => a.name === '[DEFAULT]') || initializeApp(APP_CONFIG.firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

await setPersistence(auth, browserLocalPersistence);

// ── STATE ──────────────────────────────────────────────────────────────────
let allUsers         = [];   // raw data from Firestore
let confirmCallback  = null;
let premiumTargetUid = null;
let selectedColor    = '#FF6B35';

// ── DOM REFS ───────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const loginAdminDiv = $('loginAdmin');
const formDaftarDiv = $('formDaftar');
const adminYgLogin  = $('adminYgLogin');
const tabelUser     = $('tabelUser');
const sidebar       = $('sidebar');
const overlay       = $('overlay');
const loginError    = $('loginError');
const searchInput   = $('searchInput');
const filterStatus  = $('filterStatus');
const tableCount    = $('tableCount');

// ── CLOCK ──────────────────────────────────────────────────────────────────
function updateJam() {
  const jam = new Date().toLocaleTimeString('id-ID', {
    timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit'
  });
  $('jam').textContent = jam + ' WIB';
}
setInterval(updateJam, 1000);
updateJam();

// ── SIDEBAR ────────────────────────────────────────────────────────────────
function closeSidebar() {
  sidebar.classList.add('-translate-x-full');
  overlay.classList.add('hidden');
}
$('hamburger').addEventListener('click', () => {
  sidebar.classList.remove('-translate-x-full');
  overlay.classList.remove('hidden');
});

// ── AUTH FUNCTIONS ─────────────────────────────────────────────────────────
async function loginAdmin() {
  const email = $('adminEmail').value.trim();
  const pass  = $('adminPass').value;
  loginError.classList.add('hidden');

  if (!email || !pass) {
    showLoginError('Email dan password wajib diisi!');
    return;
  }
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch (e) {
    const msgs = {
      'auth/wrong-password':       'Email atau password salah!',
      'auth/user-not-found':       'Email atau password salah!',
      'auth/invalid-credential':   'Email atau password salah!',
      'auth/invalid-email':        'Format email tidak valid!',
      'auth/too-many-requests':    'Terlalu banyak percobaan. Coba lagi nanti.',
    };
    showLoginError(msgs[e.code] || 'Login gagal: ' + e.message);
  }
}

function showLoginError(msg) {
  loginError.textContent = msg;
  loginError.classList.remove('hidden');
}

function logoutAdmin() {
  showConfirm({
    title: 'Logout Admin?',
    msg: 'Anda akan keluar dari panel admin.',
    type: 'warning',
    okLabel: 'Logout',
    onOk: () => signOut(auth)
  });
}

// ── AUTH STATE ─────────────────────────────────────────────────────────────
let isLoggingOut = false;
onAuthStateChanged(auth, user => {
  if (isLoggingOut) return;
  if (user && user.email === EMAIL_ADMIN) {
    loginAdminDiv.style.display  = 'none';
    formDaftarDiv.style.display  = 'block';
    adminYgLogin.textContent = user.email;
    ambilDataUser();
  } else {
    loginAdminDiv.style.display  = 'flex';
    loginAdminDiv.style.minHeight = '100%';
    formDaftarDiv.style.display  = 'none';
    if (user) {
      isLoggingOut = true;
      signOut(auth).finally(() => { isLoggingOut = false; });
    }
  }
});

// ── REGISTER USER ──────────────────────────────────────────────────────────
async function daftarkanUser() {
  const namaToko    = $('namaToko').value.trim();
  const namaPemilik = $('namaPemilik').value.trim();
  const emailUser   = $('emailUser').value.trim();
  const passUser    = $('passUser').value;
  const btnDaftar   = $('btnDaftar');

  if (!namaToko || !namaPemilik || !emailUser || !passUser) {
    return showToast('Isi semua field terlebih dahulu!', 'err');
  }
  if (passUser.length < 6) {
    return showToast('Password minimal 6 karakter!', 'err');
  }

  btnDaftar.disabled = true;
  btnDaftar.innerHTML = '<span class="spinner"></span>Mendaftarkan...';

  const secondaryName = 'secondary-' + Date.now();
  const secondaryApp  = initializeApp(APP_CONFIG.firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, emailUser, passUser);
    const uid  = cred.user.uid;

    await setDoc(doc(db, 'toko', uid), {
      namaToko,
      pemilik:    namaPemilik,
      email:      emailUser,
      authPass:   passUser,
      omset:      0,
      status:     'aktif',
      dibuatPada: serverTimestamp()
    });

    showToast('User ' + emailUser + ' berhasil didaftarkan!', 'ok');
    clearRegisterForm();
    await ambilDataUser();
  } catch (err) {
    const msgs = {
      'auth/email-already-in-use': 'Email sudah terdaftar! Gunakan email lain.',
      'auth/invalid-email':        'Format email tidak valid!',
    };
    showToast(msgs[err.code] || 'Gagal daftar: ' + err.message, 'err');
  } finally {
    await signOut(secondaryAuth).catch(() => {});
    await deleteApp(secondaryApp).catch(() => {});
    btnDaftar.disabled = false;
    btnDaftar.textContent = '+ Daftarkan';
  }
}

function clearRegisterForm() {
  ['namaToko', 'namaPemilik', 'emailUser', 'passUser'].forEach(id => { $(id).value = ''; });
}

// ── LOAD USERS ─────────────────────────────────────────────────────────────
async function ambilDataUser() {
  renderLoadingState();
  try {
    const q    = query(collection(db, 'toko'), orderBy('dibuatPada', 'desc'));
    const snap = await getDocs(q);

    allUsers = [];
    snap.forEach(ds => {
      const d = ds.data();
      if (!d.email) return;
      allUsers.push({ uid: ds.id, ...d });
    });

    updateSummaryCards();
    renderTable(allUsers);
  } catch (e) {
    tabelUser.innerHTML = `<tr><td colspan="7" class="table-empty">
      <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Gagal memuat: ${escHtml(e.message)}
    </td></tr>`;
  }
}

function renderLoadingState() {
  tabelUser.innerHTML = `<tr><td colspan="7" class="table-empty">
    <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
    Memuat data...
  </td></tr>`;
}

function updateSummaryCards() {
  let aktif = 0, premium = 0, suspend = 0;
  const now = new Date();
  allUsers.forEach(u => {
    if (u.status === 'aktif') aktif++;
    if (u.status === 'blokir') suspend++;
    if (isPremiumActive(u, now)) premium++;
  });
  $('totalUser').textContent    = allUsers.length;
  $('totalAktif').textContent   = aktif;
  $('totalPremium').textContent = premium;
  $('totalSuspend').textContent = suspend;
}

function isPremiumActive(userData, now = new Date()) {
  if (!userData.premium?.active) return false;
  const end = userData.premium.endDate;
  if (!end) return false;
  return (end?.toDate ? end.toDate() : new Date(end)) > now;
}

// ── FILTER / SEARCH ────────────────────────────────────────────────────────
function filterTable() {
  const q   = (searchInput?.value || '').toLowerCase().trim();
  const fil = filterStatus?.value || '';
  const now = new Date();

  const filtered = allUsers.filter(u => {
    // text search
    const matchText = !q
      || (u.namaToko || '').toLowerCase().includes(q)
      || (u.pemilik  || '').toLowerCase().includes(q)
      || (u.email    || '').toLowerCase().includes(q);

    // status filter
    const prem = isPremiumActive(u, now);
    let matchFil = true;
    if (fil === 'aktif')   matchFil = u.status === 'aktif';
    if (fil === 'blokir')  matchFil = u.status === 'blokir';
    if (fil === 'premium') matchFil = prem;
    if (fil === 'gratis')  matchFil = !prem;

    return matchText && matchFil;
  });

  renderTable(filtered, q);
}

// ── RENDER TABLE ───────────────────────────────────────────────────────────
function renderTable(users, highlight = '') {
  if (users.length === 0) {
    tabelUser.innerHTML = `<tr><td colspan="7" class="table-empty">
      <svg width="32" height="32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
      Tidak ada user ditemukan
    </td></tr>`;
    if (tableCount) tableCount.textContent = '0 user';
    return;
  }

  const now = new Date();
  const rows = users.map((u, i) => buildUserRow(u, i + 1, now, highlight)).join('');
  tabelUser.innerHTML = rows;

  if (tableCount) {
    tableCount.textContent = users.length + ' dari ' + allUsers.length + ' user';
  }
}

function hl(text, q) {
  if (!q || !text) return escHtml(text);
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return escHtml(text);
  return escHtml(text.slice(0, idx))
    + '<span class="hl">' + escHtml(text.slice(idx, idx + q.length)) + '</span>'
    + escHtml(text.slice(idx + q.length));
}

function buildUserRow(u, no, now, q = '') {
  const prem = isPremiumActive(u, now);

  const statusBadge = u.status === 'aktif'
    ? '<span class="badge badge-aktif">● Aktif</span>'
    : '<span class="badge badge-blokir">● Diblokir</span>';

  const premBadge = prem
    ? '<span class="badge badge-premium">⭐ Premium</span>'
    : '<span class="badge badge-gratis">Gratis</span>';

  const viewUrl  = BASE_PATH + '/?uid=' + u.uid;
  const omset    = (u.omset || 0).toLocaleString('id-ID');

  // action buttons
  const blockBtn = u.status === 'aktif'
    ? `<button class="act-btn act-block" onclick="blokirUser('${u.uid}','blokir')">Blokir</button>`
    : `<button class="act-btn act-unblock" onclick="blokirUser('${u.uid}','aktif')">Aktifkan</button>`;

  const premBtn = prem
    ? `<button class="act-btn act-unprem" onclick="nonaktifPremium('${u.uid}')">Nonaktif ⭐</button>`
    : `<button class="act-btn act-prem" onclick="openPremiumModal('${u.uid}')">Premium ⭐</button>`;

  return `<tr>
    <td class="py-3 px-4 text-slate-600 text-xs">${no}</td>
    <td class="py-3 px-4">
      <div class="text-sm font-semibold text-white">${hl(u.namaToko, q)}</div>
      <div class="text-xs text-slate-500 mt-0.5">${hl(u.pemilik || '—', q)}</div>
    </td>
    <td class="py-3 px-4 text-xs text-slate-400 hidden md:table-cell">${hl(u.email, q)}</td>
    <td class="py-3 px-4 text-xs text-slate-300 font-medium hidden lg:table-cell">Rp ${omset}</td>
    <td class="py-3 px-4">${statusBadge}</td>
    <td class="py-3 px-4">${premBadge}</td>
    <td class="py-3 px-4">
      <div class="act-wrap">
        <a href="${viewUrl}" target="_blank" rel="noopener" class="act-btn act-view">Lihat</a>
        <button class="act-btn act-reset" onclick="resetPassword('${escHtml(u.email)}')">Reset Pass</button>
        ${blockBtn}
        ${premBtn}
        <button class="act-btn act-delete" onclick="hapusUser('${u.uid}','${escHtml(u.namaToko)}')">Hapus</button>
      </div>
    </td>
  </tr>`;
}

// ── USER ACTIONS ───────────────────────────────────────────────────────────
async function resetPassword(email) {
  showConfirm({
    title: 'Reset Password',
    msg: `Kirim link reset password ke:\n${email}`,
    type: 'info',
    okLabel: 'Kirim Email',
    onOk: async () => {
      try {
        await sendPasswordResetEmail(auth, email);
        showToast('Link reset berhasil dikirim ke ' + email, 'ok');
      } catch (e) {
        showToast('Gagal kirim: ' + e.message, 'err');
      }
    }
  });
}

async function blokirUser(uid, statusBaru) {
  const label = statusBaru === 'blokir' ? 'memblokir' : 'mengaktifkan';
  showConfirm({
    title: statusBaru === 'blokir' ? 'Blokir User?' : 'Aktifkan User?',
    msg: `Yakin mau ${label} user ini?`,
    type: statusBaru === 'blokir' ? 'danger' : 'info',
    okLabel: statusBaru === 'blokir' ? 'Ya, Blokir' : 'Ya, Aktifkan',
    onOk: async () => {
      try {
        await updateDoc(doc(db, 'toko', uid), { status: statusBaru });
        showToast('Status user diperbarui.', 'ok');
        await ambilDataUser();
      } catch (err) {
        showToast('Gagal update: ' + err.message, 'err');
      }
    }
  });
}

async function nonaktifPremium(uid) {
  showConfirm({
    title: 'Nonaktifkan Premium?',
    msg: 'Fitur premium user ini akan dinonaktifkan.',
    type: 'warning',
    okLabel: 'Ya, Nonaktifkan',
    onOk: async () => {
      try {
        await updateDoc(doc(db, 'toko', uid), { 'premium.active': false });
        showToast('Premium dinonaktifkan.', 'ok');
        await ambilDataUser();
      } catch (err) {
        showToast('Gagal: ' + err.message, 'err');
      }
    }
  });
}

async function hapusUser(uid, namaToko) {
  showConfirm({
    title: 'Hapus Permanen?',
    msg: `Hapus akun "${namaToko}"?\n\nIni menghapus semua data toko, produk, dan statistik. TIDAK BISA DIBATALKAN.`,
    type: 'danger',
    okLabel: 'Hapus Selamanya',
    onOk: () => doHapusUser(uid, namaToko)
  });
}

async function doHapusUser(uid, namaToko) {
  let tokoData;
  try {
    const snap = await getDoc(doc(db, 'toko', uid));
    if (!snap.exists()) throw new Error('Data toko tidak ditemukan');
    tokoData = snap.data();
  } catch (e) { return showToast('Gagal baca data: ' + e.message, 'err'); }

  try {
    // Delete subcollections in batch
    for (const col of ['produk', 'stats']) {
      const sub = await getDocs(collection(db, 'toko', uid, col));
      if (!sub.empty) {
        const batch = writeBatch(db);
        sub.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, 'toko', uid));
  } catch (e) { return showToast('Gagal hapus data: ' + e.message, 'err'); }

  // Try delete auth account
  try {
    const sApp  = initializeApp(APP_CONFIG.firebaseConfig, 'del-' + Date.now());
    const sAuth = getAuth(sApp);
    const cred  = await signInWithEmailAndPassword(sAuth, tokoData.email, tokoData.authPass);
    await deleteUser(cred.user);
    await signOut(sAuth);
    await deleteApp(sApp);
    showToast(`"${namaToko}" berhasil dihapus sepenuhnya.`, 'ok');
  } catch {
    showToast('Data Firestore dihapus. Auth account perlu hapus manual di Firebase Console.', 'warn');
  }

  await ambilDataUser();
}

// ── PREMIUM MODAL ──────────────────────────────────────────────────────────
function openPremiumModal(uid) {
  premiumTargetUid = uid;
  selectedColor = '#FF6B35';
  $('pm-days').value = 30;
  $('pm-template').value = 'default';
  $('pm-slug').value = '';

  // reset color selection
  document.querySelectorAll('.pm-col').forEach(b => {
    b.classList.toggle('selected', b.dataset.c === selectedColor);
  });

  $('premium-modal').classList.remove('hidden');
}

function closePremiumModal() {
  $('premium-modal').classList.add('hidden');
  premiumTargetUid = null;
}

document.querySelectorAll('.pm-col').forEach(btn => {
  btn.addEventListener('click', () => {
    selectedColor = btn.dataset.c;
    document.querySelectorAll('.pm-col').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

async function savePremiumModal() {
  if (!premiumTargetUid) return;
  const days     = parseInt($('pm-days').value) || 30;
  const template = $('pm-template').value;
  const slug     = $('pm-slug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + days);

  const saveBtn = $('pm-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = '<span class="spinner"></span>Menyimpan...';

  try {
    const updateData = {
      'premium.active':          true,
      'premium.startDate':       serverTimestamp(),
      'premium.endDate':         endDate,
      'premium.accentColor':     selectedColor,
      'premium.template':        template,
      'premium.templateBg':      getTemplateBg(template),
      'premium.templateAccent':  getTemplateAccent(template),
    };
    if (slug) updateData['premium.slug'] = slug;

    await updateDoc(doc(db, 'toko', premiumTargetUid), updateData);
    showToast(`Premium aktif ${days} hari! ⭐`, 'ok');
    closePremiumModal();
    await ambilDataUser();
  } catch (err) {
    showToast('Gagal aktifkan premium: ' + err.message, 'err');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Aktifkan ⭐';
  }
}

function getTemplateBg(tpl) {
  const bgs = {
    forest:  'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1200&q=80&fit=crop&auto=format',
    ocean:   'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1200&q=80&fit=crop&auto=format',
    aurora:  'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1200&q=80&fit=crop&auto=format',
    desert:  'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=1200&q=80&fit=crop&auto=format',
    sakura:  'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=1200&q=80&fit=crop&auto=format',
  };
  return bgs[tpl] || '';
}

function getTemplateAccent(tpl) {
  const accents = { forest:'#4ADE80', ocean:'#38BDF8', aurora:'#A78BFA', desert:'#FBBF24', sakura:'#F472B6' };
  return accents[tpl] || '';
}

// ── CONFIRM MODAL ──────────────────────────────────────────────────────────
function showConfirm({ title, msg, type = 'danger', okLabel = 'Ya', onOk }) {
  confirmCallback = onOk;

  const iconEl  = $('confirm-icon');
  const titleEl = $('confirm-title');
  const msgEl   = $('confirm-msg');
  const okEl    = $('confirm-ok');

  titleEl.textContent = title;
  msgEl.textContent   = msg;
  okEl.textContent    = okLabel;

  // reset classes
  iconEl.className = 'w-11 h-11 rounded-full flex items-center justify-center mx-auto mb-4';
  okEl.className   = 'flex-1 py-2.5 rounded-xl font-semibold text-sm transition';

  const icons = {
    danger:  { iconClass: 'icon-danger',  okClass: 'ok-danger',  svg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>' },
    warning: { iconClass: 'icon-warning', okClass: 'ok-warning', svg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>' },
    info:    { iconClass: 'icon-info',    okClass: 'ok-info',    svg: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>' },
  };
  const cfg = icons[type] || icons.danger;
  iconEl.classList.add(cfg.iconClass);
  okEl.classList.add(cfg.okClass);
  iconEl.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${cfg.svg}</svg>`;

  $('confirm-modal').classList.remove('hidden');
}

function closeConfirm() {
  $('confirm-modal').classList.add('hidden');
  confirmCallback = null;
}

$('confirm-ok').addEventListener('click', async () => {
  if (typeof confirmCallback === 'function') {
    closeConfirm();
    await confirmCallback();
  }
});

// ── TOAST ──────────────────────────────────────────────────────────────────
let toastEl = null;
let toastTimer = null;

function showToast(msg, type = 'ok') {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.style.cssText = [
      'position:fixed', 'top:20px', 'left:50%', 'transform:translateX(-50%) translateY(-80px)',
      'padding:10px 20px', 'border-radius:99px', 'font-size:13px', 'font-weight:600',
      'z-index:9999', 'box-shadow:0 8px 24px rgba(0,0,0,0.4)',
      'transition:transform 0.3s ease,opacity 0.3s ease',
      'opacity:0', 'pointer-events:none', 'color:#fff',
      'font-family:Inter,sans-serif', 'white-space:nowrap'
    ].join(';');
    document.body.appendChild(toastEl);
  }
  const colors = { ok: '#16A34A', err: '#EE4D2D', warn: '#D97706' };
  toastEl.textContent = msg;
  toastEl.style.background = colors[type] || colors.ok;
  toastEl.style.transform   = 'translateX(-50%) translateY(0)';
  toastEl.style.opacity     = '1';

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.style.transform = 'translateX(-50%) translateY(-80px)';
    toastEl.style.opacity   = '0';
  }, 3200);
}

// ── EXPOSE TO WINDOW ───────────────────────────────────────────────────────
Object.assign(window, {
  closeSidebar,
  loginAdmin,
  logoutAdmin,
  daftarkanUser,
  ambilDataUser,
  filterTable,
  blokirUser,
  nonaktifPremium,
  resetPassword,
  hapusUser,
  openPremiumModal,
  closePremiumModal,
  savePremiumModal,
  closeConfirm,
});
