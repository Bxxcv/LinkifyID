import { CONFIG } from './config.js';
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Singleton — cegah duplicate init
const app  = getApps().length ? getApp() : initializeApp(CONFIG.firebase);
const db   = getFirestore(app);
const auth = getAuth(app);

// Auth persist local (tidak logout kalau browser ditutup)
// FIX LAG: hapus enableIndexedDbPersistence — menyebabkan lag & error di GitHub Pages (cross-origin)
setPersistence(auth, browserLocalPersistence).catch(() => {});

export { app, db, auth };
